import * as THREE from 'three';
import { WEAPONS } from '../config/weapons';
import { BLONDE_UPGRADES } from '../config/upgrades';
import type { Zombie } from '../enemies/zombie';
import type { StatLine } from '../game/playerStats';
import type { Projectile, Weapon, WeaponContext, WeaponMods } from './weapon';

const W = WEAPONS.blonde;

/** Bouteille en attente de lâcher (volée en cours). */
type Pending = { t: number; index: number };

/**
 * La Blonde : bouteilles lancées en cloche vers les zombies les plus proches, qui s'écrasent sur le
 * premier zombie touché.
 *
 * Tient la montée en puissance : la cadence suit la stat Vitesse d'attaque (jusqu'à une dizaine de
 * lancers par seconde), et chaque lancer est une volée de 1 + projectiles en plus bouteilles, sur
 * des cibles différentes, lâchées en rafale rapide. Le geste accélère avec la cadence ; au-delà, les
 * bouteilles partent de la main là où elle se trouve.
 */
export function createBlonde(ctx: WeaponContext): Weapon {
  let timer = 0.3;
  /**
   * Améliorations (cartes de level-up), propres à la Blonde : multiplicateurs (dégâts, cadence,
   * vitesse, portée, taille) et ajouts (projectiles, chance et multiplicateur critiques).
   */
  const MODS0: WeaponMods = { level: 1, damage: 1, rate: 1, projectiles: 0, speed: 1, range: 1, critChance: 0, critMult: 0, size: 1 };
  const mods: WeaponMods = { ...MODS0 };
  const pending: Pending[] = [];
  const projectiles: Projectile[] = [];
  const tmp = new THREE.Vector3();
  const up = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const hand = new THREE.Vector3();
  const prev = new THREE.Vector3();
  const a0 = new THREE.Vector3(), a1 = new THREE.Vector3();

  /** Les n zombies les plus proches à portée (le plus proche d'abord). */
  function nearest(from: THREE.Vector3, n: number) {
    const list: { z: Zombie; d: number }[] = [];
    for (const z of ctx.zombies()) {
      if (!z.targetable) continue;
      const dist = z.pos.distanceTo(from);
      if (dist < W.range * mods.range) list.push({ z, d: dist });
    }
    list.sort((a, b) => a.d - b.d);
    return list.slice(0, n).map((x) => x.z);
  }

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
  function launch(pos: THREE.Vector3, v: THREE.Vector3) {
    let b = projectiles.find((x) => !x.active);
    if (!b) {
      b = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), up0: new THREE.Vector3(), spinAxis: new THREE.Vector3(), spinRate: 0, gravity: 0, age: 0, size: 1, active: false };
      projectiles.push(b);
    }
    b.pos.copy(pos);
    b.vel.copy(v);
    b.gravity = W.gravity;
    b.spinRate = W.spinRate * (0.85 + Math.random() * 0.3);
    b.age = 0;
    b.size = mods.size;
    b.active = true;
    // Tourne « par-dessus » : axe horizontal perpendiculaire à la trajectoire
    b.up0.copy(pos).normalize();
    b.spinAxis.crossVectors(v, b.up0).normalize();
    if (b.spinAxis.lengthSq() < 1e-6) b.spinAxis.set(1, 0, 0);
  }

  /** Lâche une bouteille de la main vers la cible n° `index` de la volée. */
  function release(index: number) {
    ctx.rig.handPos(hand);
    const targets = nearest(hand, index + 1);
    if (!targets.length) return;
    // Plus de bouteilles que de zombies : les suivantes repartent sur les cibles déjà prises
    const z = targets[index % targets.length];
    solve(hand, z, vel);
    if (index >= targets.length) vel.applyAxisAngle(tmp.copy(hand).normalize(), (Math.random() - 0.5) * 0.25);
    launch(hand, vel);
  }

  /** Distance entre le segment [p, q] et l'axe du zombie (pieds -> tête). */
  function segToZombie(p: THREE.Vector3, q: THREE.Vector3, z: Zombie) {
    a0.copy(z.pos);
    a1.copy(z.pos).addScaledVector(tmp.copy(z.pos).normalize(), W.zombieHeight);
    return segSegDist(p, q, a0, a1);
  }

  /** Un pas de vol : écrasement sur le premier zombie touché, ou éclat au sol. Renvoie false si la bouteille disparaît. */
  function fly(b: Projectile) {
    for (const z of ctx.zombies()) {
      if (!z.targetable || z.pos.distanceToSquared(b.pos) > 9) continue;
      if (segToZombie(prev, b.pos, z) < W.radius * mods.size + W.zombieRadius) {
        const crit = Math.random() < W.critChance + mods.critChance;
        const dmg = W.damage * mods.damage * (crit ? W.critMult + mods.critMult : 1);
        ctx.hitZombie(weapon, z, dmg, crit, b.pos, b.vel);
        return false;
      }
    }
    if (b.pos.length() <= ctx.groundAt(b.pos)) { ctx.hitGround(weapon, b.pos, b.vel); return false; }
    return true;
  }

  const weapon: Weapon = {
    id: 'blonde',
    name: 'Blonde',
    upgrades: BLONDE_UPGRADES,
    mods,
    projectiles,
    update(dt: number) {
      const s = ctx.stats;
      const interval = W.cooldown / (s.attackSpeed * mods.rate);
      // Lâchers en attente (volée en cours)
      for (let i = pending.length - 1; i >= 0; i--) {
        pending[i].t -= dt;
        if (pending[i].t <= 0) { release(pending[i].index); pending.splice(i, 1); }
      }
      timer -= dt;
      if (timer > 0) return;
      if (!nearest(ctx.playerPos(), 1).length) return;
      timer += interval;
      if (timer < 0) timer = interval;
      // Geste accéléré quand la cadence monte (un geste complet tient dans l'intervalle)
      const rate = Math.min(W.maxGestureRate, Math.max(1, W.gestureDuration / interval));
      ctx.rig.gesture(rate);
      const n = 1 + s.extraProjectiles + mods.projectiles;
      const first = W.releaseDelay / rate;
      // Rafale : les bouteilles d'une volée partent à la suite, l'écart se resserre avec la cadence
      const gap = Math.min(W.volleyGap, interval / (n + 1));
      for (let k = 0; k < n; k++) pending.push({ t: first + k * gap, index: k });
    },
    updateProjectiles(dt: number) {
      for (const b of projectiles) {
        if (!b.active) continue;
        prev.copy(b.pos);
        up.copy(b.pos).normalize();
        b.vel.addScaledVector(up, -b.gravity * dt);
        b.pos.addScaledVector(b.vel, dt);
        b.age += dt;
        if (b.age > W.life || !fly(b)) b.active = false;
      }
    },
    reset() {
      timer = 0.3;
      pending.length = 0;
      for (const b of projectiles) b.active = false;
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
