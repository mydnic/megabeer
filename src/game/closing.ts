import * as THREE from 'three';
import { CLOSING as C } from '../config/closing';
import { PLANET_RADIUS } from '../config/world';
import { heightAt } from '../world/terrain';

/** Distance au centre du relief sous `dir` (unitaire) : les Morts flottent au-dessus du terrain, à travers le décor. */
const ground = (dir: THREE.Vector3) => PLANET_RADIUS + heightAt(dir);

/** Une Mort de la fermeture : position (flottant au-dessus du sol), direction, état et animation. */
export type Reaper = {
  readonly id: number;
  readonly pos: THREE.Vector3;
  readonly facing: THREE.Vector3;
  state: 'rise' | 'chase' | 'swing';
  /** Temps passé dans l'état (s). */
  t: number;
  /** Le coup de faux en cours a-t-il déjà frappé ? */
  struck: boolean;
  /** Vitesse actuelle (m/s), pour la cadence de l'animation. */
  speed: number;
  anim: 'spawn' | 'walk' | 'attack' | 'idle';
};

/** Ce dont la fermeture a besoin du jeu. */
export type ClosingHooks = {
  playerPos(): THREE.Vector3;
  hurtPlayer(dir: THREE.Vector3, damage: number): void;
  random(): number;
  onStart(): void;
  onSpawn(r: Reaper): void;
  onSwing(r: Reaper): void;
};

/**
 * La fermeture du bar (GDD section 12) : à 10:00, dans tous les cas, des Morts sortent de terre autour du Buveur, de
 * plus en plus nombreuses et rapides. Elles sont intouchables, traversent le décor, et un coup de faux tue.
 */
export class Closing {
  /** Coupée par les outils de dev et les tests qui veulent une arène calme. */
  enabled = true;
  started = false;
  readonly reapers: Reaper[] = [];
  private nextAt = 0;
  private ids = 0;
  private readonly up = new THREE.Vector3();
  private readonly to = new THREE.Vector3();
  private readonly axis = new THREE.Vector3();

  constructor(private readonly hooks: ClosingHooks) {}

  /** Vitesse des Morts à ce moment de la run. */
  speedAt(runTime: number) {
    return Math.min(C.maxSpeed, C.speed + C.speedPerMinute * Math.max(0, runTime - C.at) / 60);
  }

  update(dt: number, runTime: number) {
    if (!this.enabled || runTime < C.at) return;
    if (!this.started) {
      this.started = true;
      this.nextAt = runTime;
      this.hooks.onStart();
    }
    if (runTime >= this.nextAt) {
      if (this.reapers.length < C.max) this.spawn();
      this.nextAt += C.every;
    }
    const speed = this.speedAt(runTime);
    for (const r of this.reapers) this.step(r, dt, speed);
  }

  /** Fait sortir une Mort de terre à `spawnDist` m du joueur (direction au hasard, ou `at`). */
  spawn(at?: THREE.Vector3) {
    const p = this.hooks.playerPos();
    const up = this.up.copy(p).normalize();
    let dir: THREE.Vector3;
    if (at) dir = at.clone().normalize();
    else {
      const ref = Math.abs(up.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const a = new THREE.Vector3().crossVectors(up, ref).normalize();
      this.axis.copy(a).applyAxisAngle(up, this.hooks.random() * Math.PI * 2);
      dir = up.clone().applyAxisAngle(this.axis, C.spawnDist / PLANET_RADIUS);
    }
    const pos = dir.clone().multiplyScalar(ground(dir) + C.hover);
    const facing = p.clone().sub(pos);
    facing.addScaledVector(dir, -facing.dot(dir)).normalize();
    const r: Reaper = { id: this.ids++, pos, facing, state: 'rise', t: 0, struck: false, speed: 0, anim: 'spawn' };
    this.reapers.push(r);
    this.hooks.onSpawn(r);
    return r;
  }

  private step(r: Reaper, dt: number, speed: number) {
    r.t += dt;
    const p = this.hooks.playerPos();
    const up = this.up.copy(r.pos).normalize();
    const to = this.to.copy(p).sub(r.pos);
    to.addScaledVector(up, -to.dot(up));
    const dist = r.pos.angleTo(p) * PLANET_RADIUS;
    if (to.lengthSq() > 1e-8) r.facing.copy(to).normalize();
    r.speed = 0;
    if (r.state === 'rise') {
      r.anim = 'spawn';
      if (r.t >= C.rise) { r.state = 'chase'; r.t = 0; }
      return;
    }
    if (r.state === 'swing') {
      r.anim = 'attack';
      if (!r.struck && r.t >= C.hitAt) {
        r.struck = true;
        if (dist < C.hitReach) this.hooks.hurtPlayer(r.facing.clone(), C.damage);
      }
      if (r.t >= C.duration) { r.state = 'chase'; r.t = 0; }
      return;
    }
    if (dist < C.reach) {
      r.state = 'swing';
      r.t = 0;
      r.struck = false;
      r.anim = 'attack';
      this.hooks.onSwing(r);
      return;
    }
    // Poursuite : droit sur le joueur le long de la sphère, à travers le décor, en flottant au-dessus du sol
    r.anim = 'walk';
    r.speed = speed;
    const step = Math.min(speed * dt, Math.max(0, dist - C.reach * 0.8));
    this.axis.crossVectors(up, r.facing).normalize();
    const dir = up.applyAxisAngle(this.axis, step / PLANET_RADIUS);
    r.pos.copy(dir).multiplyScalar(ground(dir) + C.hover);
  }

  clear() {
    this.reapers.length = 0;
    this.started = false;
    this.nextAt = 0;
  }
}
