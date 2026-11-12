import * as THREE from 'three';
import { ABBE as A } from '../config/bosses';
import { PLANET_RADIUS } from '../config/world';
import type { Zombie } from '../enemies/zombie';
import type { Boss } from './boss';

/** Une flaque de vin : centre au sol, âge (s) ; marquée tant que `t < arm`, puis brûle. */
export type WinePuddle = { at: THREE.Vector3; t: number; radius: number; tick: number };

/** Ce dont l'Abbé a besoin du jeu. */
export type AbbeHooks = {
  playerPos(): THREE.Vector3;
  playerHeight(): number;
  groundAt(p: THREE.Vector3): number;
  hurtPlayer(dir: THREE.Vector3, damage: number): void;
  random(): number;
  /** Le vin part du calice : des flaques sont posées. */
  onPour(puddles: readonly WinePuddle[]): void;
  onPhase(phase: number): void;
};

/**
 * L'Abbé (boss final de l'Abbaye, GDD section 11). Il marche vers le joueur et, à portée, répand le vin de son calice :
 * des flaques marquées au sol autour du joueur, qui brûlent quand elles s'allument (dégâts réguliers à qui reste
 * dedans). Sous la moitié de ses PV, il boit son calice et devient géant : plus rapide, plus de flaques, plus fortes.
 */
export class Abbe implements Boss {
  readonly kind = 'abbe' as const;
  readonly name = A.name;
  readonly phaseAt = A.phase2.below;
  readonly music = A.music;
  phase = 1;
  anim = 'idle';
  animTime = 0;
  scale = 1;
  readonly puddles: WinePuddle[] = [];
  private cooldown: number = A.cast.cooldown * 0.5;
  private poured = false;
  private readonly up = new THREE.Vector3();
  private readonly want = new THREE.Vector3();

  constructor(readonly zombie: Zombie, private readonly hooks: AbbeHooks) {
    zombie.size = A.bodyScale;
  }

  private set(anim: string) {
    if (this.anim === anim) return;
    this.anim = anim;
    this.animTime = 0;
  }

  update(dt: number) {
    const z = this.zombie;
    this.animTime += dt;
    z.knockVel.set(0, 0, 0);
    z.stagger = 0;
    this.updatePuddles(dt);
    if (z.dead) { this.set('death'); return; }

    // Phase 2 : il boit son calice et grandit
    if (this.phase === 1 && z.hp <= z.maxHp * A.phase2.below) {
      this.phase = 2;
      this.set('roar');
      this.hooks.onPhase(2);
    }
    if (this.phase === 2 && this.scale < A.phase2.grow) {
      const k = this.anim === 'roar' ? Math.max(0, (this.animTime - A.phase2.roar * 0.4) / A.phase2.growTime) : 1;
      this.scale = Math.min(A.phase2.grow, 1 + (A.phase2.grow - 1) * Math.min(1, k));
      z.size = A.bodyScale * this.scale;
    }
    if (z.rise > 0) { if (this.anim !== 'roar') this.set('idle'); return; }
    if (this.anim === 'roar' && this.animTime < A.phase2.roar) return;

    const p = this.hooks.playerPos();
    const d = z.pos.angleTo(p) * PLANET_RADIUS;
    const C = A.cast;
    if (this.anim === 'cast') {
      z.turnToward(p, dt * 0.5);
      if (!this.poured && this.animTime >= C.pourAt) { this.poured = true; this.pour(p); }
      if (this.animTime >= C.duration) { this.set('idle'); this.cooldown = C.cooldown * (this.phase === 2 ? A.phase2.cooldownMul : 1); }
      return;
    }
    this.cooldown -= dt;
    if (d < C.range && this.cooldown <= 0) { this.set('cast'); this.poured = false; return; }
    z.turnToward(p, dt);
    const speed = A.speed * (this.phase === 2 ? A.phase2.speedMul : 1);
    if (d > 3 * this.scale) {
      this.up.copy(z.pos).normalize();
      this.want.copy(z.facing).addScaledVector(this.up, -z.facing.dot(this.up)).normalize();
      z.pos.addScaledVector(this.want, speed * dt);
      z.walkSpeed = speed;
      this.set('walk');
    } else {
      z.walkSpeed = 0;
      this.set('idle');
    }
  }

  /** Le vin part : une flaque sous le joueur, les autres autour de lui. */
  private pour(p: THREE.Vector3) {
    const C = A.cast;
    const n = this.phase === 2 ? A.phase2.puddles : C.puddles;
    const fresh: WinePuddle[] = [];
    const up = this.up.copy(p).normalize();
    const e1 = new THREE.Vector3().crossVectors(up, Math.abs(up.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    const e2 = new THREE.Vector3().crossVectors(up, e1);
    for (let i = 0; i < n; i++) {
      const a = this.hooks.random() * Math.PI * 2;
      const r = i === 0 ? 0 : C.radius * 1.2 + this.hooks.random() * (C.spread - C.radius * 0.5);
      const at = p.clone().addScaledVector(e1, Math.cos(a) * r).addScaledVector(e2, Math.sin(a) * r);
      at.setLength(this.hooks.groundAt(at));
      const w: WinePuddle = { at, t: 0, radius: C.radius * (this.phase === 2 ? 1.15 : 1), tick: 0 };
      this.puddles.push(w);
      fresh.push(w);
    }
    this.hooks.onPour(fresh);
  }

  /** Flaques : marquées, puis brûlantes (le joueur au sol dedans encaisse à chaque tic), puis séchées. */
  private updatePuddles(dt: number) {
    const C = A.cast;
    const p = this.hooks.playerPos();
    const damage = C.damage * (this.phase === 2 ? A.phase2.damageMul : 1);
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const w = this.puddles[i];
      w.t += dt;
      if (w.t > C.arm + C.life) { this.puddles.splice(i, 1); continue; }
      if (w.t < C.arm || this.zombie.dead) continue;
      w.tick -= dt;
      if (w.tick > 0) continue;
      if (p.angleTo(w.at) * PLANET_RADIUS < w.radius && this.hooks.playerHeight() < 0.5) {
        w.tick = C.tick;
        const dir = p.clone().sub(w.at);
        dir.addScaledVector(this.up.copy(p).normalize(), -dir.dot(this.up));
        this.hooks.hurtPlayer(dir.lengthSq() > 1e-6 ? dir.normalize() : this.zombie.facing.clone(), damage);
      }
    }
  }
}
