import * as THREE from 'three';
import { TARGETING, WEAPONS, type BottleWeaponId } from '../config/weapons';
import type { WeaponId } from './weapon';
import { anyInRange, pickTarget } from './targeting';
import type { UpgradeDef } from '../config/upgrades';
import type { Zombie } from '../enemies/zombie';
import type { StatLine } from '../game/playerStats';
import type { Projectile, Weapon, WeaponContext, WeaponMods } from './weapon';

/**
 * Une bouteille en vol : zombies qu'elle peut encore traverser, ceux déjà touchés (pas deux fois le
 * même), sa cible et les dégâts qu'elle lui réserve (comptés dans `incoming` jusqu'à sa fin).
 */
type Bottle = Projectile & { pierce: number; hits: Zombie[]; target: Zombie | null; expected: number; bounces: number };

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
  /** Visée : 'near' (les plus proches, par défaut) ou 'strong' (le plus de PV à portée : Fléchettes). */
  aim?: 'near' | 'strong';
};

/** Bouteille en attente de lâcher (volée en cours). */
type Pending = { t: number; index: number };

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
  let burnTick = 0;
  let timer = 0.3;
  /**
   * Améliorations (cartes de level-up), propres à l'arme : multiplicateurs (dégâts, cadence,
   * vitesse, portée, taille, recul) et ajouts (projectiles, perçage, chance et multiplicateur critiques).
   */
  const MODS0: WeaponMods = { level: 1, damage: 1, rate: 1, projectiles: 0, speed: 1, range: 1, critChance: 0, critMult: 0, size: 1, knock: 1, pierce: 0, bounces: 0, burn: 1 };
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
  function launch(pos: THREE.Vector3, v: THREE.Vector3, target: Zombie) {
    let b = projectiles.find((x) => !x.active);
    if (!b) {
      b = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), up0: new THREE.Vector3(), spinAxis: new THREE.Vector3(), spinRate: 0, gravity: 0, age: 0, size: 1, active: false, pierce: 0, hits: [], target: null, expected: 0, bounces: 0 };
      projectiles.push(b);
    }
    b.pos.copy(pos);
    b.vel.copy(v);
    b.gravity = W.gravity;
    b.spinRate = W.spinRate * (0.85 + Math.random() * 0.3);
    b.age = 0;
    b.size = mods.size;
    b.active = true;
    b.pierce = W.pierce + mods.pierce;
    b.bounces = (W.bounces ?? 0) + (mods.bounces ?? 0);
    b.hits.length = 0;
    // Réserve ses dégâts sur sa cible : les tirs suivants visent ailleurs si elle est condamnée
    b.target = target;
    b.expected = W.damage * mods.damage;
    target.incoming += b.expected;
    // Tourne « par-dessus » : axe horizontal perpendiculaire à la trajectoire
    b.up0.copy(pos).normalize();
    b.spinAxis.crossVectors(v, b.up0).normalize();
    if (b.spinAxis.lengthSq() < 1e-6) b.spinAxis.set(1, 0, 0);
    // À plat (sous-bock) : face vers le ciel, il tourne autour de la verticale ; pointe en avant (fléchette)
    if (W.spin === 'flat') b.spinAxis.copy(b.up0);
    else if (W.spin === 'forward') { b.up0.copy(v).normalize(); b.spinAxis.copy(b.up0); }
  }

  /** Lâche une bouteille de la main vers une cible de la volée (voir targeting.ts). */
  function release() {
    ctx.rig.handPos(hand);
    const range = W.range * mods.range;
    let z = W.aim === 'strong' ? strongest(hand, range, volley) : pickTarget(ctx.zombies(), hand, range, TARGETING.spread, volley);
    // Plus de bouteilles que de zombies : les suivantes repartent sur les cibles déjà prises, un peu écartées
    const again = !z;
    z ??= pickTarget(ctx.zombies(), hand, range, TARGETING.spread);
    if (!z) return;
    volley.add(z);
    solve(hand, z, vel);
    if (again) vel.applyAxisAngle(tmp.copy(hand).normalize(), (Math.random() - 0.5) * 0.25);
    launch(hand, vel, z);
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
    const r = (W.splashRadius ?? 0) * mods.size;
    if (r <= 0) return;
    for (const o of ctx.zombiesNear(at, r, side)) {
      if (!o.targetable || o.pos.distanceTo(at) > r) continue;
      if (W.slow) { o.slowMul = Math.min(o.slowMul, 1 - W.slow); o.slowTime = Math.max(o.slowTime, (W.slowTime ?? 1) * ctx.stats.duration); }
      if (o !== except) ctx.hitZombie(weapon, o, dmg * (W.splashDamage ?? 0.5), false, o.pos, tmp.subVectors(o.pos, at), 0.3);
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
      if (segToZombie(prev, b.pos, z) < W.radius * mods.size + W.zombieRadius) {
        const crit = Math.random() < W.critChance + mods.critChance + ctx.stats.critChance;
        const gain = (W.bounceGain ?? 1) ** Math.max(0, b.hits.length);
        const dmg = W.damage * mods.damage * gain * (crit ? W.critMult + mods.critMult : 1);
        ctx.hitZombie(weapon, z, dmg, crit, b.pos, b.vel, W.knock * mods.knock);
        b.hits.push(z);
        splash(b.pos, dmg, z);
        if (W.burn) burning.set(z, { dps: W.damage * mods.damage * W.burn * (mods.burn ?? 1), left: (W.burnTime ?? 3) * ctx.stats.duration });
        if (bounce(b, z)) return true;
        if (b.pierce-- <= 0) return false;
      }
    }
    if (b.pos.length() <= ctx.groundAt(b.pos)) { splash(b.pos, W.damage * mods.damage, null); ctx.hitGround(weapon, b.pos, b.vel); return false; }
    return true;
  }

  const weapon: Weapon = {
    id,
    name,
    upgrades,
    mods,
    projectiles,
    update(dt: number) {
      const s = ctx.stats;
      const interval = W.cooldown / (s.fireRate * mods.rate);
      // Lâchers en attente (volée en cours)
      for (let i = pending.length - 1; i >= 0; i--) {
        pending[i].t -= dt;
        if (pending[i].t <= 0) { release(); pending.splice(i, 1); }
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
      const n = 1 + s.volleyBonus() + mods.projectiles;
      const first = W.releaseDelay / rate;
      // Rafale : les bouteilles d'une volée partent à la suite, l'écart se resserre avec la cadence
      const gap = Math.min(W.volleyGap, interval / (n + 1));
      for (let k = 0; k < n; k++) pending.push({ t: first + k * gap, index: k });
    },
    updateProjectiles(dt: number) {
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
      for (const b of projectiles) {
        if (!b.active) continue;
        prev.copy(b.pos);
        up.copy(b.pos).normalize();
        b.vel.addScaledVector(up, -b.gravity * dt);
        b.pos.addScaledVector(b.vel, dt);
        b.age += dt;
        if (b.age > W.life || !fly(b)) { b.active = false; settle(b); }
      }
    },
    reset() {
      burning.clear();
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
