import * as THREE from 'three';
import { GUTS as G } from '../config/bosses';
import { PLANET_RADIUS } from '../config/world';
import type { Zombie } from '../enemies/zombie';
import type { Boss } from './boss';

/** Ce que joue le modèle (clips de tools/blender/guts.py). */
export type GutsAnim = 'idle' | 'walk' | 'sweep' | 'slam' | 'roar' | 'death';

/** L'arc d'un fauchage : centre (lui), direction du milieu (au sol), rayon (m), demi-angle (rad) ; `t` : préparation (0 à 1). */
export type SweepArc = { at: THREE.Vector3; dir: THREE.Vector3; radius: number; half: number; t: number };
/** La bande d'un coup abattu : départ, direction (au sol), longueur et largeur (m) ; `t` : préparation (0 à 1). */
export type SlamLane = { from: THREE.Vector3; dir: THREE.Vector3; length: number; width: number; t: number };

/** Ce dont Guts a besoin du jeu. */
export type GutsHooks = {
  playerPos(): THREE.Vector3;
  hurtPlayer(dir: THREE.Vector3, damage: number): void;
  onPhase(phase: number): void;
  /** L'épée passe (fauchage) ou s'abat (coup) ; `hit` : le joueur était dedans. */
  onSweep(hit: boolean): void;
  onSlam(hit: boolean): void;
};

type State = 'walk' | 'sweepWindup' | 'sweeping' | 'slamWindup' | 'slamming' | 'roar';

/**
 * Guts (boss optionnel d'un cimetière, issue #19). Son corps est un zombie de la horde ; ce contrôleur le pilote. Il
 * marche vers le joueur. De près, il fauche tout un arc devant lui (marqué au sol) ; de plus loin, il abat son épée en
 * ligne (bande marquée). À mi-vie, le Berserker : il crie, s'embrase de rouge, va plus vite, enchaîne trois fauchages
 * sans pause et n'encaisse plus que la moitié des dégâts.
 */
export class Guts implements Boss {
  readonly kind = 'guts' as const;
  readonly name = G.name;
  readonly phaseAt = G.phase2.below;
  readonly music = G.music;
  readonly scale = 1;
  phase = 1;
  anim: GutsAnim = 'idle';
  animTime = 0;
  /** Lueur rouge du Berserker (0 à 1). */
  glow = 0;
  arc: SweepArc | null = null;
  lane: SlamLane | null = null;
  private state: State = 'walk';
  private timer = 0;
  private sweepCooldown: number = G.sweep.cooldown * 0.5;
  private slamCooldown: number = G.slam.cooldown * 0.5;
  private sweepsLeft = 0;
  private struck = false;
  private readonly up = new THREE.Vector3();
  private readonly want = new THREE.Vector3();

  constructor(readonly zombie: Zombie, private readonly hooks: GutsHooks) {
    zombie.size = G.bodyScale;
  }

  private set(anim: GutsAnim) {
    if (this.anim === anim) return;
    this.anim = anim;
    this.animTime = 0;
  }

  /** Direction au sol de `from` vers `to`. */
  private toward(from: THREE.Vector3, to: THREE.Vector3, out: THREE.Vector3) {
    const up = this.up.copy(from).normalize();
    out.subVectors(to, from).addScaledVector(up, -out.dot(up));
    if (out.lengthSq() < 1e-6) out.copy(this.zombie.facing);
    return out.normalize();
  }

  update(dt: number) {
    const z = this.zombie;
    this.animTime += dt;
    z.knockVel.set(0, 0, 0);
    z.stagger = 0;
    if (this.phase === 2) this.glow = Math.min(1, this.glow + dt / G.phase2.pause);
    if (z.dead) { this.set('death'); this.arc = null; this.lane = null; this.glow = Math.max(0, this.glow - dt); return; }
    const p = this.hooks.playerPos();
    const d = z.pos.angleTo(p) * PLANET_RADIUS;
    const SW = G.sweep, SL = G.slam, P2 = G.phase2;
    const rage = this.phase === 2;
    this.sweepCooldown -= dt;
    this.slamCooldown -= dt;
    z.walkSpeed = 0;

    // Le Berserker : entre deux coups, il crie, puis son armure encaisse la moitié des coups
    if (this.phase === 1 && z.hp <= z.maxHp * P2.below && this.state === 'walk') {
      this.phase = 2;
      this.state = 'roar';
      this.timer = P2.pause;
      z.armor = P2.armor;
      this.hooks.onPhase(2);
    }

    switch (this.state) {
      case 'roar':
        this.set('roar');
        z.turnToward(p, dt);
        if ((this.timer -= dt) <= 0) this.state = 'walk';
        return;
      case 'sweepWindup': {
        const a = this.arc!;
        const wind = this.sweepsLeft < (rage ? P2.sweeps : 1) ? P2.rewindup : SW.windup;
        this.timer += dt;
        a.t = Math.min(1, this.timer / wind);
        if (a.t < SW.track) { z.turnToward(p, dt * 4); this.toward(z.pos, p, a.dir); a.at.copy(z.pos); z.facing.copy(a.dir); }
        this.set('idle');
        if (this.timer >= wind) { this.state = 'sweeping'; this.timer = 0; this.struck = false; this.set('sweep'); this.animTime = 0; }
        return;
      }
      case 'sweeping': {
        const a = this.arc!;
        this.set('sweep');
        this.timer += dt;
        if (!this.struck && this.timer >= SW.hitAt) {
          this.struck = true;
          const hit = this.inArc(a, p);
          if (hit) this.hooks.hurtPlayer(this.toward(a.at, p, this.want).clone(), SW.damage);
          this.hooks.onSweep(hit);
          // Le Berserker enchaîne : le fauchage suivant se prépare tout de suite
          if (--this.sweepsLeft > 0) { this.startSweep(p); return; }
        }
        if (this.timer >= SW.duration) {
          this.arc = null;
          this.sweepCooldown = SW.cooldown;
          this.state = 'walk';
        }
        return;
      }
      case 'slamWindup': {
        const l = this.lane!;
        this.timer += dt;
        l.t = Math.min(1, this.timer / SL.windup);
        if (l.t < SL.track) { z.turnToward(p, dt * 4); this.toward(z.pos, p, l.dir); l.from.copy(z.pos); z.facing.copy(l.dir); }
        this.set('idle');
        if (this.timer >= SL.windup) { this.state = 'slamming'; this.timer = 0; this.struck = false; }
        return;
      }
      case 'slamming': {
        const l = this.lane!;
        this.set('slam');
        this.timer += dt;
        if (!this.struck && this.timer >= SL.hitAt) {
          this.struck = true;
          const hit = this.inLane(l, p);
          if (hit) this.hooks.hurtPlayer(l.dir.clone(), SL.damage);
          this.hooks.onSlam(hit);
        }
        if (this.timer >= SL.duration) {
          this.lane = null;
          this.slamCooldown = SL.cooldown;
          this.state = 'walk';
        }
        return;
      }
    }

    // Il marche vers le joueur ; il fauche de près, abat l'épée de plus loin
    z.turnToward(p, dt * 2);
    if (d < SW.range && this.sweepCooldown <= 0) {
      this.sweepsLeft = rage ? P2.sweeps : 1;
      this.startSweep(p);
      return;
    }
    if (d > SL.minDist && d < SL.range && this.slamCooldown <= 0) {
      this.lane = { from: z.pos.clone(), dir: this.toward(z.pos, p, new THREE.Vector3()), length: SL.length, width: SL.width, t: 0 };
      this.state = 'slamWindup';
      this.timer = 0;
      return;
    }
    if (d > SW.range * 0.6) {
      const speed = G.speed * (rage ? P2.speedMul : 1);
      this.toward(z.pos, p, this.want);
      z.pos.addScaledVector(this.want, speed * dt);
      z.walkSpeed = speed;
      this.set('walk');
    } else this.set('idle');
  }

  /** Un fauchage vers le joueur : l'arc devant lui, marqué. */
  private startSweep(p: THREE.Vector3) {
    const z = this.zombie;
    const dir = this.toward(z.pos, p, new THREE.Vector3());
    z.facing.copy(dir);
    this.arc = { at: z.pos.clone(), dir, radius: G.sweep.radius, half: (G.sweep.angle * Math.PI) / 360, t: 0 };
    this.state = 'sweepWindup';
    this.timer = 0;
  }

  /** Le joueur est-il dans l'arc ? (une marge pour son corps) */
  private inArc(a: SweepArc, p: THREE.Vector3) {
    const dist = a.at.angleTo(p) * PLANET_RADIUS;
    if (dist > a.radius + 0.5) return false;
    if (dist < 1.2) return true;
    return this.toward(a.at, p, this.want).angleTo(a.dir) <= a.half;
  }

  /** Le joueur est-il dans la bande ? (sur le plan tangent au départ ; une marge pour son corps) */
  private inLane(l: SlamLane, p: THREE.Vector3) {
    const up = this.up.copy(l.from).normalize();
    const v = this.want.subVectors(p, l.from);
    v.addScaledVector(up, -v.dot(up));
    const along = v.dot(l.dir);
    const across = v.addScaledVector(l.dir, -along).length();
    return along >= -0.5 && along <= l.length && across < l.width / 2 + 0.5;
  }
}
