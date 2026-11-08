import * as THREE from 'three';
import { PLANET_RADIUS } from '../config/world';
import { SPAWN, SPAWN_CURVE } from '../config/spawn';
import { ZOMBIE_MODELS, type ZombieModel } from '../config/zombies';
import type { Zombie } from '../enemies/zombie';
import type { PlayerController } from '../player/controller';
import type { DecorCollider } from '../world/decor/collider';
import { heightAt } from '../world/terrain';

/** État de la courbe de difficulté à un instant de la run. */
export type SpawnPoint = { alive: number; perSecond: number; hpMul: number };

/** Courbe de la run (config) à l'instant `t` (s) : interpolée entre deux points, bloquée après le dernier. */
export function spawnCurveAt(t: number): SpawnPoint {
  const c = SPAWN_CURVE;
  if (t <= c[0].t) return { ...c[0] };
  for (let i = 1; i < c.length; i++) {
    if (t > c[i].t) continue;
    const a = c[i - 1], b = c[i], k = (t - a.t) / (b.t - a.t);
    const lerp = (x: number, y: number) => x + (y - x) * k;
    return { alive: lerp(a.alive, b.alive), perSecond: lerp(a.perSecond, b.perSecond), hpMul: lerp(a.hpMul, b.hpMul) };
  }
  return { ...c[c.length - 1] };
}

export type SpawnDirectorDeps = {
  player: PlayerController;
  collider: DecorCollider;
  zombies: () => readonly Zombie[];
  /** Fait apparaître un zombie (PV réglés par le jeu selon le moment de la run). */
  spawn: (model: ZombieModel, at: THREE.Vector3, facing: THREE.Vector3) => Zombie | undefined;
};

const MODELS = Object.keys(ZOMBIE_MODELS) as ZombieModel[];

/**
 * Le directeur de vagues : maintient autour du joueur une horde dont la taille suit la courbe de la
 * run (config `SPAWN_CURVE`). Les zombies sortent de terre sur un anneau hors de portée, plutôt
 * devant le joueur quand il court ; ceux qu'il distance trop ressortent devant lui.
 */
export class SpawnDirector {
  /** Arrêté : plus aucune arrivée (outils de dev, scénarios de test isolés). */
  enabled = true;
  /** Zombies debout visés en ce moment (pour le HUD de dev et le journal). */
  target = 0;
  private budget = 0;
  private readonly up = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly at = new THREE.Vector3();
  private readonly tang = new THREE.Vector3();
  private readonly probe = new THREE.Vector3();

  constructor(private readonly d: SpawnDirectorDeps) {}

  /** Début de run : la première horde est là d'un coup. */
  start(countMul: number) {
    this.budget = spawnCurveAt(0).alive * countMul;
  }

  reset() { this.budget = 0; this.target = 0; }

  /** Avance de `dt` secondes de jeu, au temps de run `runTime`. */
  update(dt: number, runTime: number, countMul: number) {
    const curve = spawnCurveAt(runTime);
    this.target = Math.round(curve.alive * countMul);
    this.recycle();
    if (!this.enabled) return;
    const rate = curve.perSecond * countMul;
    // Le budget ne s'accumule pas sans fin quand la horde est au complet
    this.budget = Math.min(Math.max(this.budget, 0) + rate * dt, Math.max(this.budget, rate * 2));
    let alive = 0;
    for (const z of this.d.zombies()) if (!z.dead) alive++;
    while (this.budget >= 1 && alive < this.target) {
      if (!this.place(this.at) || !this.spawnAt(this.at)) break;
      this.budget--;
      alive++;
    }
  }

  /**
   * Fait sortir de terre `count` zombies de type `model` tout autour du joueur, entre `minDist` et
   * `maxDist` m (événements de map). Renvoie le nombre réellement placé.
   */
  spawnAround(count: number, minDist: number, maxDist: number, model: ZombieModel) {
    this.frame();
    let placed = 0;
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < SPAWN.tries; k++) {
        if (!this.tryPoint(this.at, Math.random() * Math.PI * 2, minDist + Math.random() * (maxDist - minDist))) continue;
        if (this.spawnAt(this.at, model)) placed++;
        break;
      }
    }
    return placed;
  }

  private spawnAt(dir: THREE.Vector3, model = MODELS[Math.floor(Math.random() * MODELS.length)]) {
    const facing = this.d.player.pos.clone().sub(dir.clone().multiplyScalar(PLANET_RADIUS));
    return this.d.spawn(model, dir, facing) !== undefined;
  }

  /** Zombies distancés : ils ressortent de terre sur l'anneau, devant le joueur. */
  private recycle() {
    const p = this.d.player.pos;
    for (const z of this.d.zombies()) {
      if (z.dead || z.pos.distanceTo(p) < SPAWN.recycleDist) continue;
      if (!this.place(this.at, true)) continue;
      z.pos.copy(this.at).setLength(PLANET_RADIUS + heightAt(this.at));
      z.emerge();
    }
  }

  /** Cherche un point libre sur l'anneau d'apparition (direction depuis le centre de la planète). */
  private place(out: THREE.Vector3, ahead = Math.random() < SPAWN.aheadShare) {
    this.frame();
    for (let i = 0; i < SPAWN.tries; i++) {
      const angle = ahead ? (Math.random() * 2 - 1) * SPAWN.aheadSpread : Math.random() * Math.PI * 2;
      if (this.tryPoint(out, angle, SPAWN.minDist + Math.random() * (SPAWN.maxDist - SPAWN.minDist))) return true;
    }
    return false;
  }

  /** Repère du joueur : haut, devant (sens de la course, ou du regard s'il est immobile), droite. */
  private frame() {
    const p = this.d.player;
    const up = this.up.copy(p.pos).normalize();
    const v = this.tang.copy(p.velocity).addScaledVector(up, -p.velocity.dot(up));
    this.fwd.copy(v.lengthSq() > 1 ? v : p.facing);
    this.fwd.addScaledVector(up, -this.fwd.dot(up)).normalize();
    this.right.crossVectors(this.fwd, up);
  }

  /** Point au sol à `dist` m du joueur dans la direction `angle` (0 : devant) ; faux s'il tombe dans le décor. */
  private tryPoint(out: THREE.Vector3, angle: number, dist: number) {
    // Distance au sol : on tourne autour du centre de la planète de l'angle correspondant
    const arc = dist / PLANET_RADIUS;
    this.tang.copy(this.fwd).multiplyScalar(Math.cos(angle)).addScaledVector(this.right, Math.sin(angle));
    out.copy(this.up).multiplyScalar(Math.cos(arc)).addScaledVector(this.tang, Math.sin(arc)).normalize();
    // Le corps (à hauteur de taille) ne doit pas être dans un mur ou un rocher
    this.probe.copy(out).multiplyScalar(PLANET_RADIUS + heightAt(out) + 1);
    return !this.d.collider.occupied(this.probe, SPAWN.clearance);
  }
}