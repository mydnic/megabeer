import * as THREE from 'three';
import { SABRE as T, SABRE_UPGRADES } from '../config/arsenal';
import { WEAPON_INFO } from '../config/weapons';
import type { Zombie } from '../enemies/zombie';
import type { StatLine } from '../game/playerStats';
import type { Projectile, Weapon, WeaponContext, WeaponMods } from './weapon';

/** Une lame pendant son coup : son décalage sur le cercle (rad) et les zombies déjà frappés par ce coup. */
type Blade = Projectile & { offset: number; hits: Zombie[] };

/**
 * Le Sabre laser (issue #17) : mêlée rapide en arc. Dès qu'un zombie est à portée, la lame balaie un arc de `T.arc` rad
 * devant le joueur, vers lui, en `T.swingTime` s, une fois dans un sens, la fois suivante dans l'autre ; chaque zombie
 * traversé est frappé une fois par coup, et les bouteilles ennemies que la lame croise sont coupées en vol. Les lames en
 * plus (évolution : sabre double) se répartissent sur le cercle.
 *
 * Pour l'affichage, chaque lame est un projectile couché le long de son rayon (`up0`), qui tourne autour de la verticale
 * du joueur au rythme du coup (`spinAxis`, `spinRate`).
 */
export function createSabre(ctx: WeaponContext): Weapon {
  const MODS0: WeaponMods = { level: 1, damage: 1, rate: 1, size: 1, knock: 1, projectiles: 0, critChance: 0, critMult: 0, evolved: 0 };
  const mods: WeaponMods = { ...MODS0 };
  const projectiles: Blade[] = [];
  let timer: number = T.firstDelay;
  /** Coup en cours : temps écoulé (s), -1 si aucun ; sens du coup (1 ou -1, il alterne) ; repère du coup. */
  let swing = -1, sense = 1;
  const up = new THREE.Vector3(), radial0 = new THREE.Vector3(), side0 = new THREE.Vector3();
  const d = new THREE.Vector3(), vel = new THREE.Vector3(), tmp = new THREE.Vector3();
  const around: Zombie[] = [];

  /** Portée du coup (m) : la Taille l'allonge. */
  const reach = () => T.radius * mods.size * ctx.stats.size;
  /** Angle de chaque lame au temps `t` du coup (rad) : d'un bord de l'arc à l'autre. */
  const angleAt = (t: number, offset: number) => offset + sense * (-T.arc / 2 + (Math.min(t, T.swingTime) / T.swingTime) * T.arc);

  function blade(i: number): Blade {
    let b = projectiles[i];
    if (!b) {
      b = {
        pos: new THREE.Vector3(), vel: new THREE.Vector3(), up0: new THREE.Vector3(), spinAxis: new THREE.Vector3(),
        spinRate: 0, gravity: 0, age: 0, size: 1, active: false, offset: 0, hits: [],
      };
      projectiles[i] = b;
    }
    return b;
  }

  /** Place chaque lame active le long de son rayon, à hauteur de main. */
  function place() {
    const p = ctx.playerPos();
    up.copy(p).normalize();
    for (const b of projectiles) {
      if (!b.active) continue;
      const a = angleAt(swing, b.offset);
      d.copy(radial0).multiplyScalar(Math.cos(a)).addScaledVector(side0, Math.sin(a));
      b.pos.copy(p).addScaledVector(d, T.holdDist * mods.size * ctx.stats.size).addScaledVector(up, T.height);
      b.vel.crossVectors(up, d).multiplyScalar(sense * (T.arc * reach()) / T.swingTime);
    }
  }

  /** Lance un coup vers `toward` (direction tangente). */
  function startSwing(toward: THREE.Vector3) {
    const p = ctx.playerPos();
    up.copy(p).normalize();
    radial0.copy(toward).addScaledVector(up, -toward.dot(up));
    if (radial0.lengthSq() < 1e-6) radial0.copy(ctx.playerFacing());
    radial0.normalize();
    side0.crossVectors(up, radial0).normalize();
    sense = -sense;
    const n = 1 + ctx.stats.volleyBonus() + mods.projectiles + (mods.evolved ? 1 : 0);
    for (const b of projectiles) b.active = false;
    for (let k = 0; k < n; k++) {
      const b = blade(k);
      b.offset = (k / n) * Math.PI * 2;
      b.hits.length = 0;
      b.age = 0;
      b.size = mods.size * ctx.stats.size;
      b.active = true;
      // Couchée le long de son rayon au départ du coup ; elle tournera ensuite avec lui
      const a = angleAt(0, b.offset);
      b.up0.copy(radial0).multiplyScalar(Math.cos(a)).addScaledVector(side0, Math.sin(a)).normalize();
      b.spinAxis.copy(up);
      b.spinRate = (sense * T.arc) / (Math.PI * 2 * T.swingTime);
    }
    swing = 0;
    ctx.rig.gesture(T.gestureRate);
  }

  /** Frappe les zombies que chaque lame a traversés entre deux images ; coupe les bouteilles ennemies sur la lame. */
  function sweep(prev: number, now: number) {
    const p = ctx.playerPos();
    const r = reach() + T.zombieRadius;
    for (const b of projectiles) {
      if (!b.active) continue;
      // La lame coupe les projectiles ennemis qu'elle croise (milieu et pointe)
      d.copy(b.up0).applyAxisAngle(up, sense * T.arc * (Math.min(now, T.swingTime) / T.swingTime));
      ctx.blockShots(tmp.copy(p).addScaledVector(d, reach() * 0.5).addScaledVector(up, T.height), T.deflect * mods.size * ctx.stats.size);
      ctx.blockShots(tmp.copy(p).addScaledVector(d, reach()).addScaledVector(up, T.height), T.deflect * mods.size * ctx.stats.size);
    }
    for (const z of ctx.zombiesNear(p, r, around)) {
      if (!z.targetable) continue;
      d.subVectors(z.pos, p);
      d.addScaledVector(up, -d.dot(up));
      const dist = d.length();
      if (dist > r) continue;
      let phi = Math.atan2(d.dot(side0), d.dot(radial0));
      for (const b of projectiles) {
        if (!b.active || b.hits.includes(z)) continue;
        const a0 = angleAt(prev, b.offset), a1 = angleAt(now, b.offset);
        const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
        // Le zombie est-il dans l'arc balayé à cette image (modulo un tour) ? Collé au joueur, il est pris tout de suite
        let x = phi - lo;
        x -= Math.floor(x / (Math.PI * 2)) * Math.PI * 2;
        if (x > hi - lo && dist > T.innerRadius) continue;
        b.hits.push(z);
        const crit = Math.random() < T.critChance + mods.critChance + ctx.stats.critChance;
        const dmg = T.damage * mods.damage * (crit ? T.critMult + mods.critMult : 1);
        vel.copy(d).normalize().multiplyScalar(T.knockSpeed);
        ctx.hitZombie(weapon, z, dmg, crit, tmp.copy(z.pos).addScaledVector(up, T.height), vel, T.knock * mods.knock);
      }
      phi = 0;
    }
  }

  const weapon: Weapon = {
    id: 'sabre',
    name: WEAPON_INFO.sabre.name,
    upgrades: SABRE_UPGRADES,
    mods,
    projectiles,
    update(dt: number) {
      if (swing >= 0) return;
      timer -= dt;
      if (timer > 0) return;
      const p = ctx.playerPos();
      const r = reach() + T.zombieRadius + T.triggerMargin;
      let best: Zombie | null = null, bestD = r;
      for (const z of ctx.zombiesNear(p, r, around)) {
        if (!z.targetable) continue;
        const dz = z.pos.distanceTo(p);
        if (dz < bestD) { bestD = dz; best = z; }
      }
      if (!best) return;
      timer = T.cooldown / (ctx.stats.fireRate * mods.rate);
      startSwing(tmp.subVectors(best.pos, p));
      place();
    },
    trigger() {
      if (swing >= 0) return;
      startSwing(ctx.playerFacing());
      place();
    },
    updateProjectiles(dt: number) {
      if (swing < 0) return;
      const prev = swing;
      swing += dt;
      for (const b of projectiles) if (b.active) b.age = swing;
      place();
      sweep(prev, swing);
      if (swing >= T.swingTime) {
        swing = -1;
        for (const b of projectiles) b.active = false;
      }
    },
    reset() {
      timer = T.firstDelay;
      swing = -1;
      for (const b of projectiles) b.active = false;
      Object.assign(mods, MODS0);
    },
    stats(): StatLine[] {
      const s = ctx.stats, m = mods;
      return [
        { label: 'Dégâts', value: T.damage * m.damage, unit: 'number', bonus: m.damage - 1, bonusKind: 'percent' },
        { label: "Vitesse d'attaque", value: s.attackSpeed * m.rate / T.cooldown, unit: 'perSecond', bonus: m.rate - 1, bonusKind: 'percent' },
        { label: 'Lames', value: 1 + s.extraProjectiles + m.projectiles + (m.evolved ? 1 : 0), unit: 'count', bonus: m.projectiles, bonusKind: 'plus' },
        { label: 'Portée du coup', value: T.radius * m.size, unit: 'meters', bonus: m.size - 1, bonusKind: 'percent' },
        { label: 'Chances de critique', value: T.critChance + m.critChance, unit: 'percent', bonus: m.critChance, bonusKind: 'percent' },
        { label: 'Multiplicateur critique', value: T.critMult + m.critMult, unit: 'mult', bonus: m.critMult, bonusKind: 'plus' },
      ];
    },
  };
  return weapon;
}
