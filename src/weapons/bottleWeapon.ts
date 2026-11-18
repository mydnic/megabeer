import * as THREE from 'three';
import { SYNERGY_FX } from '../config/arsenal';
import { TARGETING, WEAPONS, type BottleWeaponId } from '../config/weapons';
import type { WeaponId, Zone } from './weapon';
import { anyInRange, pickTarget } from './targeting';
import type { UpgradeDef } from '../config/upgrades';
import type { Zombie } from '../enemies/zombie';
import type { StatLine } from '../game/playerStats';
import type { Projectile, Weapon, WeaponContext, WeaponMods } from './weapon';

/**
 * Une bouteille en vol : zombies qu'elle peut encore traverser, ceux déjà touchés (pas deux fois le
 * même), sa cible et les dégâts qu'elle lui réserve (comptés dans `incoming` jusqu'à sa fin).
 */
type Bottle = Projectile & { pierce: number; hits: Zombie[]; target: Zombie | null; expected: number; bounces: number; ground: number; child: boolean; face: number; jackpot: boolean; back: boolean };

/** Réglages d'une arme à bouteilles : ceux de la Canette (config/weapons.ts), plus les briques facultatives. */
export type BottleConfig = { [K in keyof typeof WEAPONS.canette]: number } & {
  /** Rebonds d'ennemi en ennemi (Triple) et portée d'un rebond (m) ; dégâts x `bounceGain` à chaque rebond. */
  bounces?: number; bounceRange?: number; bounceGain?: number;
  /** Éclaboussure à l'impact (Kriek) : rayon (m), part des dégâts, ralentissement (part de vitesse) et durée (s). */
  splashRadius?: number; splashDamage?: number; slow?: number; slowTime?: number;
  /** Brûlure (IPA) : dégâts par seconde (part des dégâts du coup) et durée (s). */
  burn?: number; burnTime?: number;
  /** Rotation en vol : par-dessus (bouteille, par défaut), à plat autour de la verticale, ou pointe en avant. */
  spin?: 'over' | 'flat' | 'forward';
  /** Éventail (Bouchons) : toute la volée part d'un coup vers la même cible, écartée de `fan` rad ; `count` projectiles de base. */
  fan?: number; count?: number;
  /** Rebonds au sol (Pétanque) : nombre, et part de la vitesse verticale gardée. */
  groundBounces?: number; restitution?: number;
  /** Fragmentation (Bac de bière) : bouteilles qui partent dans toutes les directions à la fin, part des dégâts, vitesse (m/s). */
  fragments?: number; fragmentDamage?: number; fragmentSpeed?: number;
  /** Flaque de poison à l'impact (Vomi) : rayon (m), durée (s), dégâts par seconde (part des dégâts) par cumul, cumul maxi. */
  pool?: { radius: number; life: number; dps: number; maxStacks: number };
  /**
   * Dés (le 421) : chaque projectile est un dé tiré de 1 à 6, ses dégâts x face / 3,5 ; chaque 6 ajoute `critPerSix`
   * de chances de critique pour le reste de la run (jusqu'à `critCap`) ; une volée qui sort 4, 2 et 1 fait jackpot :
   * le 4 explose à l'impact (`jackpotDamage` x les dégâts, rayon `jackpotRadius` m). `minFace` : plus petite face.
   */
  dice?: { critPerSix: number; critCap: number; jackpotDamage: number; jackpotRadius: number; minFace?: number };
  /** Visée : 'near' (les plus proches, par défaut) ou 'strong' (le plus de PV à portée : Fléchettes). */
  aim?: 'near' | 'strong' | 'crowd';
};

/** Bouteille en attente de lâcher (volée en cours). */
type Pending = { t: number; index: number; of: number; face: number; jackpot: boolean };

/**
 * Brique « bouteille lancée » (Canette, Stout...) : bouteilles (ou canettes) lancées en cloche vers les zombies les
 * plus proches, qui s'écrasent sur le premier zombie touché, ou en traversent quelques-uns (perçage)
 * et les repoussent plus ou moins fort (recul). Tous les réglages viennent de WEAPONS[id].
 *
 * Tient la montée en puissance : la cadence suit la stat Vitesse d'attaque (jusqu'à une dizaine de
 * lancers par seconde), et chaque lancer est une volée de 1 + projectiles en plus bouteilles, sur
 * des cibles différentes, lâchées en rafale rapide. Le geste accélère avec la cadence ; au-delà, les
 * bouteilles partent de la main là où elle se trouve.
 */
export function createBottleWeapon(ctx: WeaponContext, id: WeaponId, name: string, upgrades: readonly UpgradeDef[], config?: BottleConfig): Weapon {
  const W: BottleConfig = config ?? WEAPONS[id as BottleWeaponId];
  /** Zombies qui brûlent (IPA) : dégâts par seconde et temps restant. */
  const burning = new Map<Zombie, { dps: number; left: number }>();
  let burnTick = 0, flameTick = 0;
  /** Flaques de poison (Vomi) et cumul de poison de chaque zombie dedans. */
  const zones: Zone[] = [];
  const poison = new Map<Zombie, number>();
  let poisonTick = 0;
  /** Chances de critique gagnées avec les 6 des dés (le 421), pour la run. */
  let diceCrit = 0;
  /** Cible commune de la volée en éventail (Bouchons). */
  let fanTarget: Zombie | null = null;
  let timer = 0.3;
  /**
   * Améliorations (cartes de level-up), propres à l'arme : multiplicateurs (dégâts, cadence,
   * vitesse, portée, taille, recul) et ajouts (projectiles, perçage, chance et multiplicateur critiques).
   */
  const MODS0: WeaponMods = { level: 1, damage: 1, rate: 1, projectiles: 0, speed: 1, range: 1, critChance: 0, critMult: 0, size: 1, knock: 1, pierce: 0, bounces: 0, burn: 1, fragments: 0, duration: 1, splash: 0, gain: 0 };
  const mods: WeaponMods = { ...MODS0 };
  const pending: Pending[] = [];
  const projectiles: Bottle[] = [];
  const tmp = new THREE.Vector3();
  const up = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const hand = new THREE.Vector3();
  const prev = new THREE.Vector3();
  const a0 = new THREE.Vector3(), a1 = new THREE.Vector3();

  /** Zombies proches de la bouteille en vol (réserve réutilisée). */
  const around: Zombie[] = [];
  /** Seconde réserve (éclaboussure, rebond), remplie pendant qu'on parcourt `around`. */
  const side: Zombie[] = [];
  /** Zombies déjà visés par la volée en cours (une cible différente par bouteille). */
  const volley = new Set<Zombie>();

  /** Vitesse de lancer pour atteindre le zombie en cloche, en anticipant sa marche. */
  function solve(from: THREE.Vector3, z: Zombie, out: THREE.Vector3) {
    up.copy(from).normalize();
    let t = 0;
    for (let i = 0; i < 3; i++) {
      aim.copy(z.pos).addScaledVector(tmp.copy(z.pos).normalize(), W.aimHeight).addScaledVector(z.facing, z.walkSpeed * t);
      const dlt = tmp.subVectors(aim, from);
      const h = dlt.dot(up);
      dlt.addScaledVector(up, -h); // partie horizontale
      t = Math.max(0.08, dlt.length() / (W.speed * mods.speed));
      if (i === 2) out.copy(dlt).divideScalar(t).addScaledVector(up, h / t + 0.5 * W.gravity * t);
    }
    return out;
  }

  /** Lance une bouteille (réutilise un emplacement libre). */
  function launch(pos: THREE.Vector3, v: THREE.Vector3, target: Zombie | null, child = false, face = 0, jackpot = false) {
    let b = projectiles.find((x) => !x.active);
    if (!b) {
      b = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), up0: new THREE.Vector3(), spinAxis: new THREE.Vector3(), spinRate: 0, gravity: 0, age: 0, size: 1, active: false, pierce: 0, hits: [], target: null, expected: 0, bounces: 0, ground: 0, child: false, face: 0, jackpot: false, back: false };
      projectiles.push(b);
    }
    b.pos.copy(pos);
    b.vel.copy(v);
    b.gravity = W.gravity;
    b.spinRate = W.spinRate * (0.85 + Math.random() * 0.3);
    b.age = 0;
    b.size = (mods.size * ctx.stats.size);
    b.active = true;
    b.pierce = W.pierce + mods.pierce;
    b.bounces = (W.bounces ?? 0) + (mods.bounces ?? 0)
      + (id === 'flechettes' && ctx.synergy('troisVingt') ? SYNERGY_FX.ricochets.bounces : 0)
      + (child && ctx.synergy('palettePinball') ? SYNERGY_FX.flipper.bounces : 0);
    b.ground = (W.groundBounces ?? 0) + (id === 'petanque' && ctx.synergy('carreauFut') ? SYNERGY_FX.carreau.groundBounces : 0);
    b.child = child;
    b.face = face;
    b.back = false;
    b.jackpot = jackpot;
    b.hidden = child;
    b.hits.length = 0;
    // Réserve ses dégâts sur sa cible : les tirs suivants visent ailleurs si elle est condamnée
    b.target = target;
    b.expected = W.damage * mods.damage * (child ? W.fragmentDamage ?? 0.5 : 1);
    if (target) target.incoming += b.expected;
    // Tourne « par-dessus » : axe horizontal perpendiculaire à la trajectoire
    b.up0.copy(pos).normalize();
    b.spinAxis.crossVectors(v, b.up0).normalize();
    if (b.spinAxis.lengthSq() < 1e-6) b.spinAxis.set(1, 0, 0);
    // À plat (sous-bock) : face vers le ciel, il tourne autour de la verticale ; pointe en avant (fléchette)
    if (W.spin === 'flat') b.spinAxis.copy(b.up0);
    else if (W.spin === 'forward') { b.up0.copy(v).normalize(); b.spinAxis.copy(b.up0); }
    return b;
  }

  /** Lâche une bouteille de la main vers une cible de la volée (voir targeting.ts). */
  function release(k = 0, n = 1, face = 0, jackpot = false) {
    ctx.rig.handPos(hand);
    const range = W.range * mods.range;
    // Éventail : toute la volée vers la même cible, chaque projectile écarté de son angle
    if (W.fan) {
      if (k === 0 || !fanTarget || !fanTarget.targetable) fanTarget = pickTarget(ctx.zombies(), hand, range, TARGETING.spread);
      if (!fanTarget) return;
      solve(hand, fanTarget, vel);
      vel.applyAxisAngle(tmp.copy(hand).normalize(), (k - (n - 1) / 2) * (mods.ring ? (Math.PI * 2) / n : W.fan));
      launch(hand, vel, k === Math.floor(n / 2) ? fanTarget : null);
      return;
    }
    let z = W.aim === 'strong' ? strongest(hand, range, volley) : W.aim === 'crowd' ? crowd(hand, range) : pickTarget(ctx.zombies(), hand, range, TARGETING.spread, volley);
    // Plus de bouteilles que de zombies : les suivantes repartent sur les cibles déjà prises, un peu écartées
    const again = !z;
    z ??= pickTarget(ctx.zombies(), hand, range, TARGETING.spread);
    if (!z) return;
    volley.add(z);
    solve(hand, z, vel);
    if (again) vel.applyAxisAngle(tmp.copy(hand).normalize(), (Math.random() - 0.5) * 0.25);
    launch(hand, vel, z, false, face, jackpot);
  }

  /** Jackpot du 421 : le dé explose et frappe tous les zombies autour. */
  function jackpot(at: THREE.Vector3) {
    const J = W.dice!;
    // Noël au comptoir (avec la Bière de Noël) : le 421 double la couronne quelques secondes
    if (ctx.synergy('noelAuComptoir')) ctx.trigger('biereNoel');
    const r = J.jackpotRadius * mods.size * ctx.stats.size;
    ctx.explode(weapon, at, r);
    for (const o of ctx.zombiesNear(at, r, side)) {
      if (!o.targetable || o.pos.distanceTo(at) > r) continue;
      ctx.hitZombie(weapon, o, W.damage * mods.damage * J.jackpotDamage, true, o.pos, tmp.subVectors(o.pos, at), 2);
    }
  }

  /** Le zombie au cœur du plus gros groupe à portée (Vomi) : celui qui a le plus de voisins proches. */
  function crowd(from: THREE.Vector3, range: number) {
    let best: Zombie | null = null, most = -1, seen = 0;
    for (const z of ctx.zombies()) {
      if (!z.targetable || z.pos.distanceTo(from) > range) continue;
      if (++seen > 48) break; // assez pour trouver un groupe, sans parcourir toute la horde
      let n = 0;
      for (const o of ctx.zombiesNear(z.pos, 2.5, side)) if (o.targetable && o.pos.distanceTo(z.pos) < 2.5) n++;
      if (n > most) { most = n; best = z; }
    }
    return best;
  }

  /** Flaque de poison posée au sol (Vomi). */
  function puddle(at: THREE.Vector3) {
    const P = W.pool;
    if (!P) return;
    let z = zones.find((x) => !x.active);
    if (!z) { z = { pos: new THREE.Vector3(), radius: 1, age: 0, life: 1, active: false }; zones.push(z); }
    z.pos.copy(at);
    z.radius = P.radius * mods.size * ctx.stats.size;
    z.life = P.life * mods.duration * ctx.stats.duration;
    z.age = 0;
    z.active = true;
  }

  /** Fin d'un projectile qui se fragmente (Bac de bière) : des bouteilles partent dans toutes les directions. */
  function shatter(b: Bottle) {
    const n = (W.fragments ?? 0) + (W.fragments ? mods.fragments : 0);
    if (!n || b.child) return;
    const up = b.pos.clone().normalize();
    const e1 = new THREE.Vector3().crossVectors(up, Math.abs(up.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    const start = b.pos.clone().addScaledVector(up, 0.1);
    for (let i = 0; i < n; i++) {
      const v = e1.clone().applyAxisAngle(up, (i / n) * Math.PI * 2 + Math.random() * 0.3).multiplyScalar(W.fragmentSpeed ?? 9).addScaledVector(up, 1.5); // à hauteur de torse, pas par-dessus les têtes
      launch(start, v, null, true).hits.push(...b.hits); // pas sur le zombie que le bac vient de toucher
    }
    ctx.explode(weapon, b.pos, 1.5);
  }

  /** Le zombie le plus solide à portée (Fléchettes) : le plus de PV, sans ceux déjà condamnés par les tirs en vol. */
  function strongest(from: THREE.Vector3, range: number, exclude: ReadonlySet<Zombie>) {
    let best: Zombie | null = null;
    for (const z of ctx.zombies()) {
      if (!z.targetable || exclude.has(z) || z.incoming >= z.hp || z.pos.distanceTo(from) > range) continue;
      if (!best || z.hp > best.hp) best = z;
    }
    return best;
  }

  /** Éclaboussure (Kriek) : dégâts réduits et ralentissement autour du point d'impact. */
  function splash(at: THREE.Vector3, dmg: number, except: Zombie | null) {
    const r = ((W.splashRadius ?? 0) + mods.splash) * mods.size * ctx.stats.size;
    if (r <= 0) return;
    if (W.splashRadius === undefined) ctx.explode(weapon, at, r); // onde de l'évolution (Imperial Stout, Double IPA)
    for (const o of ctx.zombiesNear(at, r, side)) {
      if (!o.targetable || o.pos.distanceTo(at) > r) continue;
      if (W.slow) { o.slowMul = Math.min(o.slowMul, 1 - W.slow); o.slowTime = Math.max(o.slowTime, (W.slowTime ?? 1) * ctx.stats.duration); }
      if (o !== except) ctx.hitZombie(weapon, o, dmg * (W.splashDamage ?? 0.5), false, o.pos, tmp.subVectors(o.pos, at), 0.3);
      // Double IPA : la brûlure se propage aux voisins
      if (W.burn && mods.evolved) burning.set(o, { dps: W.damage * mods.damage * W.burn * mods.burn, left: (W.burnTime ?? 3) * ctx.stats.duration });
    }
  }

  /** Rebond (Triple) : repart vers le zombie le plus proche pas encore touché. Faux s'il n'y en a pas. */
  function bounce(b: Bottle, from: Zombie) {
    if (b.bounces <= 0) return false;
    let next: Zombie | null = null, best = (W.bounceRange ?? 6);
    for (const o of ctx.zombiesNear(from.pos, best, side)) {
      if (!o.targetable || b.hits.includes(o)) continue;
      const d = o.pos.distanceTo(from.pos);
      if (d < best) { best = d; next = o; }
    }
    if (!next) return false;
    // Cerises en chaîne (Triple avec la Kriek) : le rebond éclabousse de kriek
    if (id === 'triple' && ctx.synergy('cerisesEnChaine')) {
      const C = SYNERGY_FX.cerises;
      for (const o of ctx.zombiesNear(from.pos, C.radius, side)) {
        if (!o.targetable || o.pos.distanceTo(from.pos) > C.radius) continue;
        o.slowMul = Math.min(o.slowMul, 1 - C.slow);
        o.slowTime = Math.max(o.slowTime, C.slowTime);
        if (o !== from) ctx.hitZombie(weapon, o, b.expected * C.damage, false, o.pos, tmp.subVectors(o.pos, from.pos), 0.3);
      }
      ctx.explode(weapon, from.pos, C.radius);
    }
    b.bounces--;
    settle(b);
    b.target = next;
    b.expected *= W.bounceGain ?? 1;
    next.incoming += b.expected;
    solve(b.pos, next, b.vel);
    return true;
  }

  /** Fin d'une bouteille : elle libère les dégâts réservés sur sa cible. */
  function settle(b: Bottle) {
    if (b.target) b.target.incoming = Math.max(0, b.target.incoming - b.expected);
    b.target = null;
  }

  /** Distance entre le segment [p, q] et l'axe du zombie (pieds -> tête). */
  function segToZombie(p: THREE.Vector3, q: THREE.Vector3, z: Zombie) {
    a0.copy(z.pos);
    a1.copy(z.pos).addScaledVector(tmp.copy(z.pos).normalize(), W.zombieHeight);
    return segSegDist(p, q, a0, a1);
  }

  /**
   * Un pas de vol : coup sur chaque zombie traversé (une fois chacun), écrasement quand le perçage est
   * épuisé, ou éclat au sol. Renvoie false si la bouteille disparaît.
   */
  function fly(b: Bottle) {
    for (const z of ctx.zombiesNear(b.pos, 3, around)) {
      if (!z.targetable || b.hits.includes(z) || z.pos.distanceToSquared(b.pos) > 9) continue;
      if (segToZombie(prev, b.pos, z) < W.radius * mods.size * ctx.stats.size + W.zombieRadius) {
        const crit = Math.random() < W.critChance + mods.critChance + ctx.stats.critChance + diceCrit;
        const gain = ((W.bounceGain ?? 1) + mods.gain) ** Math.max(0, b.hits.length) * (b.face ? b.face / 3.5 : 1);
        const carreau = id === 'petanque' && ctx.synergy('carreauFut') ? SYNERGY_FX.carreau.damage : 1;
        const dmg = W.damage * mods.damage * gain * carreau * (crit ? W.critMult + mods.critMult : 1);
        if (b.face === 6 && W.dice) diceCrit = Math.min(W.dice.critCap, diceCrit + W.dice.critPerSix);
        if (b.jackpot) { b.jackpot = false; jackpot(b.pos); }
        ctx.hitZombie(weapon, z, b.child ? dmg * (W.fragmentDamage ?? 0.5) : dmg, crit, b.pos, b.vel, W.knock * mods.knock);
        b.hits.push(z);
        splash(b.pos, dmg, z);
        // Bouchons explosifs (Bouchons avec la Gueuze) : le bouchon explose à l'impact
        if (id === 'bouchons' && ctx.synergy('bouchonsExplosifs')) {
          const X = SYNERGY_FX.bouchons;
          ctx.explode(weapon, b.pos, X.radius);
          for (const o of ctx.zombiesNear(b.pos, X.radius, side)) {
            if (o !== z && o.targetable && o.pos.distanceTo(b.pos) <= X.radius) ctx.hitZombie(weapon, o, dmg * X.damage, false, o.pos, tmp.subVectors(o.pos, b.pos), 0.5);
          }
        }
        if (W.burn) burning.set(z, { dps: W.damage * mods.damage * W.burn * (mods.burn ?? 1), left: (W.burnTime ?? 3) * ctx.stats.duration });
        if (bounce(b, z)) return true;
        if (b.pierce-- <= 0) { puddle(z.pos); shatter(b); return false; }
      }
    }
    const g = ctx.groundAt(b.pos);
    if (b.pos.length() <= g) {
      // Rebond au sol (Pétanque) : la boule repart, plus bas, et continue de rouler
      if (b.ground > 0) {
        b.ground--;
        const up = tmp.copy(b.pos).normalize();
        const vn = b.vel.dot(up);
        if (vn < 0) b.vel.addScaledVector(up, -(1 + (W.restitution ?? 0.5)) * vn);
        b.pos.setLength(g + 0.01);
        return true;
      }
      splash(b.pos, W.damage * mods.damage, null);
      puddle(b.pos);
      shatter(b);
      if (b.jackpot) jackpot(b.pos);
      ctx.hitGround(weapon, b.pos, b.vel);
      return false;
    }
    return true;
  }

  const weapon: Weapon = {
    id,
    name,
    upgrades,
    mods,
    projectiles,
    zones,
    update(dt: number) {
      const s = ctx.stats;
      const interval = W.cooldown / (s.fireRate * mods.rate);
      // Lâchers en attente (volée en cours)
      for (let i = pending.length - 1; i >= 0; i--) {
        pending[i].t -= dt;
        if (pending[i].t <= 0) { const q = pending[i]; release(q.index, q.of, q.face, q.jackpot); pending.splice(i, 1); }
      }
      timer -= dt;
      if (timer > 0) return;
      if (!anyInRange(ctx.zombies(), ctx.playerPos(), W.range * mods.range)) return;
      volley.clear();
      timer += interval;
      if (timer < 0) timer = interval;
      // Geste accéléré quand la cadence monte (un geste complet tient dans l'intervalle)
      const rate = Math.min(W.maxGestureRate, Math.max(1, W.gestureDuration / interval));
      ctx.rig.gesture(rate);
      const n = (W.count ?? 1) + s.volleyBonus() + mods.projectiles;
      const first = W.releaseDelay / rate;
      // Rafale : les bouteilles d'une volée partent à la suite, l'écart se resserre avec la cadence
      const gap = W.fan ? 0 : Math.min(W.volleyGap, interval / (n + 1));
      // Dés (le 421) : les faces de la volée sont tirées d'un coup ; 4, 2 et 1 ensemble font jackpot (sur le 4)
      const low = mods.loaded ? 2 : W.dice?.minFace ?? 1;
      const faces = W.dice ? Array.from({ length: n }, () => low + Math.floor(Math.random() * (7 - low))) : [];
      const win = W.dice ? [4, 2, 1].every((f) => faces.includes(f)) : false;
      for (let k = 0; k < n; k++) pending.push({ t: first + k * gap, index: k, of: n, face: faces[k] ?? 0, jackpot: (win && k === faces.indexOf(4)) || (!!mods.loaded && faces[k] === 4) });
    },
    updateProjectiles(dt: number) {
      // Ça flambe / Gastro flambée (IPA avec la Flaque de bière ou le Vomi) : les zombies dans les flaques prennent feu
      flameTick += dt;
      if (W.burn && flameTick >= 0.5) { // toutes les demi-secondes, pas à chaque image
        flameTick = 0;
        for (const [syn, src] of [['flammes', 'flaqueBiere'], ['flammesVomi', 'vomi']] as const) {
          if (!ctx.synergy(syn)) continue;
          for (const zone of ctx.zonesOf(src)) {
            if (!zone.active) continue;
            for (const z of ctx.zombiesNear(zone.pos, zone.radius, side)) {
              if (!z.targetable || z.pos.distanceTo(zone.pos) > zone.radius || burning.has(z)) continue;
              burning.set(z, { dps: W.damage * mods.damage * SYNERGY_FX.flammes.dps, left: SYNERGY_FX.flammes.time });
            }
          }
        }
      }
      // Brûlure : un coup toutes les demi-secondes tant qu'elle dure
      if (burning.size) {
        burnTick += dt;
        if (burnTick >= 0.5) {
          for (const [z, f] of burning) {
            f.left -= burnTick;
            if (z.dead || f.left <= 0) { burning.delete(z); continue; }
            ctx.hitZombie(weapon, z, f.dps * burnTick, false, z.pos, tmp.set(0, 0, 0), 0);
          }
          burnTick = 0;
        }
      }
      // Flaques de poison : chaque demi-seconde, un zombie dedans gagne un cumul et prend des dégâts selon son cumul
      if (W.pool) {
        poisonTick += dt;
        const tick = poisonTick >= 0.5;
        for (const zone of zones) {
          if (!zone.active) continue;
          zone.age += dt;
          if (zone.age >= zone.life) { zone.active = false; continue; }
          if (!tick) continue;
          for (const z of ctx.zombiesNear(zone.pos, zone.radius, side)) {
            if (!z.targetable || z.pos.distanceTo(zone.pos) > zone.radius) continue;
            const stacks = Math.min(W.pool.maxStacks, (poison.get(z) ?? 0) + 1);
            poison.set(z, stacks);
            ctx.hitZombie(weapon, z, W.damage * mods.damage * W.pool.dps * stacks * poisonTick, false, z.pos, tmp.set(0, 0, 0), 0);
          }
        }
        if (tick) {
          poisonTick = 0;
          if (poison.size > 256) for (const z of poison.keys()) if (z.dead) poison.delete(z);
        }
      }
      for (const b of projectiles) {
        if (!b.active) continue;
        prev.copy(b.pos);
        up.copy(b.pos).normalize();
        b.vel.addScaledVector(up, -b.gravity * dt);
        b.pos.addScaledVector(b.vel, dt);
        b.age += dt;
        // Sous-bock tranchant : à mi-course il fait demi-tour vers le joueur, et peut refrapper au retour
        if ((mods.returns || (id === 'sousBock' && ctx.synergy('retourAuBar'))) && !b.back && b.age > W.life * 0.45) {
          b.back = true;
          b.hits.length = 0;
          b.pierce = W.pierce + mods.pierce;
          b.vel.subVectors(ctx.playerPos(), b.pos).addScaledVector(up, -tmp.subVectors(ctx.playerPos(), b.pos).dot(up)).normalize().multiplyScalar(W.speed * mods.speed);
          b.age = W.life * 0.5; // le retour dure autant que l'aller
        }
        if (b.age > W.life || !fly(b)) { b.active = false; settle(b); }
      }
    },
    reset() {
      diceCrit = 0;
      burning.clear();
      poison.clear();
      for (const z of zones) z.active = false;
      timer = 0.3;
      pending.length = 0;
      for (const b of projectiles) { b.active = false; settle(b); }
      volley.clear();
      Object.assign(mods, MODS0);
    },
    stats(): StatLine[] {
      const s = ctx.stats, m = mods;
      return [
        { label: 'Dégâts', value: W.damage * m.damage, unit: 'number', bonus: m.damage - 1, bonusKind: 'percent' },
        { label: "Vitesse d'attaque", value: s.attackSpeed * m.rate / W.cooldown, unit: 'perSecond', bonus: m.rate - 1, bonusKind: 'percent' },
        { label: 'Projectiles', value: 1 + s.extraProjectiles + m.projectiles, unit: 'count', bonus: m.projectiles, bonusKind: 'plus' },
        { label: 'Vitesse des projectiles', value: W.speed * m.speed, unit: 'speed', bonus: m.speed - 1, bonusKind: 'percent' },
        { label: 'Portée', value: W.range * m.range, unit: 'meters', bonus: m.range - 1, bonusKind: 'percent' },
        { label: 'Chances de critique', value: W.critChance + m.critChance, unit: 'percent', bonus: m.critChance, bonusKind: 'percent' },
        { label: 'Multiplicateur critique', value: W.critMult + m.critMult, unit: 'mult', bonus: m.critMult, bonusKind: 'plus' },
        { label: 'Taille', value: m.size, unit: 'percent', bonus: m.size - 1, bonusKind: 'percent' },
        ...(W.knock + m.knock - 1 > 1 ? [{ label: 'Recul', value: W.knock * m.knock, unit: 'mult', bonus: m.knock - 1, bonusKind: 'percent' } as StatLine] : []),
        ...(W.pierce + m.pierce > 0 ? [{ label: 'Zombies traversés', value: W.pierce + m.pierce, unit: 'count', bonus: m.pierce, bonusKind: 'plus' } as StatLine] : []),
        ...(W.bounces ? [{ label: 'Rebonds', value: W.bounces + m.bounces, unit: 'count', bonus: m.bounces, bonusKind: 'plus' } as StatLine] : []),
        ...(W.burn ? [{ label: 'Brûlure par seconde', value: W.damage * m.damage * W.burn * m.burn, unit: 'number', bonus: m.burn - 1, bonusKind: 'percent' } as StatLine] : []),
        ...(W.splashRadius ? [{ label: "Rayon de l'éclaboussure", value: W.splashRadius * m.size, unit: 'meters', bonus: m.size - 1, bonusKind: 'percent' } as StatLine] : []),
      ];
    },
  };
  return weapon;
}
/** Distance minimale entre deux segments 3D. */
const _u = new THREE.Vector3(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _c1 = new THREE.Vector3(), _c2 = new THREE.Vector3();
function segSegDist(p1: THREE.Vector3, q1: THREE.Vector3, p2: THREE.Vector3, q2: THREE.Vector3) {
  _u.subVectors(q1, p1); _v.subVectors(q2, p2); _w.subVectors(p1, p2);
  const a = _u.dot(_u), b = _u.dot(_v), c = _v.dot(_v), dd = _u.dot(_w), e = _v.dot(_w);
  const D = a * c - b * b;
  let sN, sD = D, tN, tD = D;
  if (D < 1e-8) { sN = 0; sD = 1; tN = e; tD = c; }
  else {
    sN = b * e - c * dd; tN = a * e - b * dd;
    if (sN < 0) { sN = 0; tN = e; tD = c; } else if (sN > sD) { sN = sD; tN = e + b; tD = c; }
  }
  if (tN < 0) { tN = 0; sN = THREE.MathUtils.clamp(-dd, 0, a); sD = a || 1; }
  else if (tN > tD) { tN = tD; sN = THREE.MathUtils.clamp(-dd + b, 0, a); sD = a || 1; }
  const sc = Math.abs(sN) < 1e-8 ? 0 : sN / sD, tc = Math.abs(tN) < 1e-8 ? 0 : tN / tD;
  _c1.copy(p1).addScaledVector(_u, sc);
  _c2.copy(p2).addScaledVector(_v, tc);
  return _c1.distanceTo(_c2);
}
