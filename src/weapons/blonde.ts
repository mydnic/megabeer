import * as THREE from 'three';
import { WEAPONS } from '../config/weapons';
import type { Zombie } from '../enemies/zombie';
import type { Bottles } from './bottles';

const W = WEAPONS.blonde;

type Deps = {
  bottles: Bottles;
  zombies: () => readonly Zombie[];
  playerPos: () => THREE.Vector3;
  /** Joue le geste de lancer à la vitesse donnée (1 = normal). */
  gesture: (rate: number) => void;
  /** Position actuelle de la main qui lance. */
  handPos: (out: THREE.Vector3) => THREE.Vector3;
  /** Stats du joueur qui modifient l'arme. */
  stats: () => { attackSpeed: number; extraProjectiles: number };
  /** Rayon du sol sous un point. */
  groundAt: (p: THREE.Vector3) => number;
  /** La bouteille touche le sol (position, vitesse). */
  onGround: (pos: THREE.Vector3, vel: THREE.Vector3) => void;
  /** La bouteille s'écrase sur un zombie (point d'impact). */
  onHitZombie: (z: Zombie, pos: THREE.Vector3, vel: THREE.Vector3, damage: number) => void;
};

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
export function createBlonde(d: Deps) {
  let timer = 0.3;
  /** Améliorations de l'arme (cartes de level-up) : multiplicateurs propres à la Blonde. */
  const mods = { level: 1, damage: 1, rate: 1, projectiles: 0, speed: 1, range: 1 };
  const pending: Pending[] = [];
  const tmp = new THREE.Vector3();
  const up = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const hand = new THREE.Vector3();
  const a0 = new THREE.Vector3(), a1 = new THREE.Vector3();

  /** Les n zombies les plus proches à portée (le plus proche d'abord). */
  function nearest(from: THREE.Vector3, n: number) {
    const list: { z: Zombie; d: number }[] = [];
    for (const z of d.zombies()) {
      if (z.dead) continue;
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

  /** Lâche une bouteille de la main vers la cible n° `index` de la volée. */
  function release(index: number) {
    d.handPos(hand);
    const targets = nearest(hand, index + 1);
    if (!targets.length) return;
    // Plus de bouteilles que de zombies : les suivantes repartent sur les cibles déjà prises
    const z = targets[index % targets.length];
    solve(hand, z, vel);
    if (index >= targets.length) vel.applyAxisAngle(tmp.copy(hand).normalize(), (Math.random() - 0.5) * 0.25);
    d.bottles.launch(hand, vel, W.gravity, W.spinRate * (0.85 + Math.random() * 0.3), null);
  }

  /** Distance entre le segment [p, q] et l'axe du zombie (pieds -> tête). */
  function segToZombie(p: THREE.Vector3, q: THREE.Vector3, z: Zombie) {
    a0.copy(z.pos);
    a1.copy(z.pos).addScaledVector(tmp.copy(z.pos).normalize(), W.zombieHeight);
    return segSegDist(p, q, a0, a1);
  }

  return {
    update(dt: number) {
      const s = d.stats();
      const interval = W.cooldown / (s.attackSpeed * mods.rate);
      // Lâchers en attente (volée en cours)
      for (let i = pending.length - 1; i >= 0; i--) {
        pending[i].t -= dt;
        if (pending[i].t <= 0) { release(pending[i].index); pending.splice(i, 1); }
      }
      timer -= dt;
      if (timer > 0) return;
      if (!nearest(d.playerPos(), 1).length) return;
      timer += interval;
      if (timer < 0) timer = interval;
      // Geste accéléré quand la cadence monte (un geste complet tient dans l'intervalle)
      const rate = Math.min(W.maxGestureRate, Math.max(1, W.gestureDuration / interval));
      d.gesture(rate);
      const n = 1 + s.extraProjectiles + mods.projectiles;
      const first = W.releaseDelay / rate;
      // Rafale : les bouteilles d'une volée partent à la suite, l'écart se resserre avec la cadence
      const gap = Math.min(W.volleyGap, interval / (n + 1));
      for (let k = 0; k < n; k++) pending.push({ t: first + k * gap, index: k });
    },
    /** Avance les bouteilles : écrasement sur le premier zombie touché, ou éclat au sol. */
    updateBottles(dt: number) {
      d.bottles.update(dt, W.life, (b, prev) => {
        for (const z of d.zombies()) {
          if (z.dead || z.pos.distanceToSquared(b.pos) > 9) continue;
          if (segToZombie(prev, b.pos, z) < W.radius + W.zombieRadius) {
            d.onHitZombie(z, b.pos, b.vel, W.damage * mods.damage);
            return false;
          }
        }
        if (b.pos.length() <= d.groundAt(b.pos)) { d.onGround(b.pos, b.vel); return false; }
        return true;
      });
    },
    mods,
    reset() {
      timer = 0.3; pending.length = 0; d.bottles.clear();
      Object.assign(mods, { level: 1, damage: 1, rate: 1, projectiles: 0, speed: 1, range: 1 });
    },
  };
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
