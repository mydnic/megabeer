import * as THREE from 'three';
import { NARUTO as N } from '../config/naruto';
import { PLANET_RADIUS } from '../config/world';
import type { DecorCollider } from '../world/decor/collider';
import { heightAt } from '../world/terrain';

/** Il court, il souffle (sur place), ou il est parti (attrapé). */
export type NarutoState = 'running' | 'resting' | 'gone';

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);

/**
 * Naruto : il traverse la planète en courant, vite, et change de cap au hasard ; il souffle de temps en temps. Il évite
 * le décor en regardant devant lui. Le joueur qui le touche l'attrape (`update` renvoie true) : il disparaît.
 */
export class Naruto {
  pos: THREE.Vector3 | null = null;
  /** Où il regarde (tangent au sol) ; son cap visé. */
  facing = new THREE.Vector3();
  state: NarutoState = 'gone';
  /** Vitesse à cette image (m/s) : 0 quand il souffle. */
  speed = 0;
  private heading = new THREE.Vector3();
  /** Temps qui reste avant la fin de la course ou du repos ; avant le prochain changement de cap (s). */
  private phaseLeft = 0;
  private turnLeft = 0;
  private tmp = new THREE.Vector3();
  private up = new THREE.Vector3();
  private axis = new THREE.Vector3();

  /** Son propre hasard (tiré du point d'arrivée) : il ne décale pas celui du reste du jeu. */
  private seed = 1;

  constructor(private collider: DecorCollider) {}

  clear() {
    this.pos = null;
    this.state = 'gone';
    this.speed = 0;
  }

  /** Nouvelle run : Naruto apparaît loin de `spawnDir`, sur un sol libre. */
  place(spawnDir: THREE.Vector3) {
    this.clear();
    this.seed = (Math.floor((spawnDir.x * 49979687) ^ (spawnDir.y * 15485863) ^ (spawnDir.z * 32452843)) >>> 0) || 1;
    const dir = new THREE.Vector3();
    for (let i = 0; i < N.tries; i++) {
      const u = this.random() * 2 - 1, a = this.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      dir.set(r * Math.cos(a), u, r * Math.sin(a));
      if (dir.angleTo(spawnDir) * PLANET_RADIUS < N.minFromSpawn) continue;
      if (this.placeAt(dir)) return this.pos;
    }
    return null;
  }

  /** Pose Naruto à la direction `dir`, en pleine course (aussi : panneau DEV, tests). */
  placeAt(dir: THREE.Vector3) {
    const d = dir.clone().normalize();
    const pos = d.clone().multiplyScalar(PLANET_RADIUS + heightAt(d));
    if (this.collider.occupied(this.tmp.copy(d).multiplyScalar(pos.length() + 0.9), 0.5)) return false;
    this.pos = pos;
    this.facing.crossVectors(d, Math.abs(d.y) < 0.9 ? Y : X).normalize().applyAxisAngle(d, this.random() * Math.PI * 2);
    this.heading.copy(this.facing);
    this.state = 'running';
    this.phaseLeft = this.between(N.run);
    this.turnLeft = this.between(N.turnEvery);
    return true;
  }

  /** Avance d'un pas ; renvoie true si le joueur (à `playerPos`) vient de l'attraper. */
  update(dt: number, playerPos: THREE.Vector3) {
    const p = this.pos;
    if (!p || this.state === 'gone') return false;
    if (p.angleTo(playerPos) * PLANET_RADIUS < N.catchRange) {
      this.state = 'gone';
      this.speed = 0;
      return true;
    }
    this.phaseLeft -= dt;
    if (this.state === 'resting') {
      this.speed = 0;
      if (this.phaseLeft <= 0) {
        this.state = 'running';
        this.phaseLeft = this.between(N.run);
        this.newHeading(180);
      }
      return false;
    }
    if (this.phaseLeft <= 0) {
      this.state = 'resting';
      this.phaseLeft = this.between(N.rest);
      this.speed = 0;
      return false;
    }
    const up = this.up.copy(p).normalize();
    // Cap au hasard de temps en temps ; un obstacle devant lui, et il repart ailleurs
    this.turnLeft -= dt;
    if (this.turnLeft <= 0) { this.turnLeft = this.between(N.turnEvery); this.newHeading(N.turnMax); }
    if (this.blocked(p, this.heading)) this.newHeading(180, true);
    // Il vire vers son cap, puis avance le long de la sphère
    this.facing.lerp(this.heading, 1 - Math.exp(-dt * N.turnRate));
    this.facing.addScaledVector(up, -this.facing.dot(up)).normalize();
    if (this.blocked(p, this.facing)) { this.speed = 0; return false; }
    this.speed = N.speed;
    this.axis.crossVectors(up, this.facing).normalize();
    const step = (N.speed * dt) / p.length();
    p.applyAxisAngle(this.axis, step);
    // Son cap suit la courbure de la planète
    this.facing.applyAxisAngle(this.axis, step);
    this.heading.applyAxisAngle(this.axis, step);
    const d = this.up.copy(p).normalize();
    p.copy(d).multiplyScalar(PLANET_RADIUS + heightAt(d));
    this.facing.addScaledVector(d, -this.facing.dot(d)).normalize();
    this.heading.addScaledVector(d, -this.heading.dot(d)).normalize();
    return false;
  }

  /** Un nouveau cap, tourné de `max` degrés au plus ; `free` : le premier cap sans obstacle devant. */
  private newHeading(max: number, free = false) {
    const p = this.pos!;
    const up = p.clone().normalize();
    for (let i = 0; i < (free ? 8 : 1); i++) {
      const a = THREE.MathUtils.degToRad((this.random() * 2 - 1) * max);
      const h = this.facing.clone().applyAxisAngle(up, a);
      this.heading.copy(h);
      if (!free || !this.blocked(p, h)) return;
    }
  }

  /** Un obstacle du décor à `lookAhead` m devant, dans la direction `dir` ? */
  private blocked(p: THREE.Vector3, dir: THREE.Vector3) {
    const ahead = this.tmp.copy(p).addScaledVector(dir, N.lookAhead);
    const d = ahead.normalize();
    return this.collider.occupied(d.multiplyScalar(PLANET_RADIUS + heightAt(d) + 0.9), 0.3);
  }

  private random() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 2 ** 32;
  }

  private between(r: readonly [number, number]) {
    return r[0] + this.random() * (r[1] - r[0]);
  }
}
