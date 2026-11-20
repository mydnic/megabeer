import * as THREE from 'three';
import { SAURON as S } from '../config/bosses';
import { PLANET_RADIUS } from '../config/world';
import type { Zombie } from '../enemies/zombie';
import type { Boss } from './boss';
import type { BossWave } from './frereSonneur';
import type { SweepArc } from './guts';

/** Ce que joue le modèle (clips de tools/blender/sauron.py). */
export type SauronAnim = 'idle' | 'walk' | 'sweep' | 'slam' | 'roar' | 'death';

/** Le point d'impact de la masse : centre, rayon (m) ; `t` : préparation (0 à 1). */
export type MaceImpact = { at: THREE.Vector3; radius: number; t: number };

/** Le regard de l'Oeil : le disque au sol (centre, rayon m) qui traque le joueur. */
export type EyeGaze = { at: THREE.Vector3; radius: number };

/** Ce dont Sauron a besoin du jeu. */
export type SauronHooks = {
  playerPos(): THREE.Vector3;
  /** Hauteur du joueur au-dessus du sol (m, 0 : au sol). */
  playerHeight(): number;
  hurtPlayer(dir: THREE.Vector3, damage: number): void;
  /** Le joueur part au loin dans la direction `dir` (la masse l'a balayé). */
  throwPlayer(dir: THREE.Vector3): void;
  onPhase(phase: number): void;
  /** La masse balaie l'arc ; `hit` : le joueur était dedans. */
  onSweep(hit: boolean): void;
  /** La masse s'abat au point `at` ; `hit` : le joueur était dessous. */
  onSlam(at: THREE.Vector3, hit: boolean): void;
  /** Une onde part de `at`. */
  onWave(at: THREE.Vector3): void;
  /** Le regard de l'Oeil brûle le joueur. */
  onGaze(at: THREE.Vector3): void;
};

type State = 'walk' | 'sweepWindup' | 'sweeping' | 'slamWindup' | 'slamming' | 'roar';

/**
 * Sauron (boss de la Montagne du Destin, issue #20). Son corps est un zombie de la horde ; ce contrôleur le pilote. Il
 * ne quitte pas le cratère et marche vers le joueur. De près, il balaie tout un arc de sa masse (marqué au sol) et
 * projette le joueur au loin ; de plus loin, il abat sa masse devant lui (point d'impact marqué) : une onde de choc
 * en part, à sauter. À mi-vie, l'Oeil : il lève le bras vers le ciel, l'Oeil s'allume au-dessus du cratère et son
 * regard traque le joueur ; y rester brûle. Il va alors un peu plus vite et chaque masse abattue lance deux ondes.
 */
export class Sauron implements Boss {
  readonly kind = 'sauron' as const;
  readonly name = S.name;
  readonly phaseAt = S.phase2.below;
  readonly music = S.music;
  readonly scale = 1;
  phase = 1;
  anim: SauronAnim = 'idle';
  animTime = 0;
  arc: SweepArc | null = null;
  impact: MaceImpact | null = null;
  readonly waves: BossWave[] = [];
  /** Le regard de l'Oeil (null : l'Oeil est éteint, phase 1). */
  gaze: EyeGaze | null = null;
  private state: State = 'walk';
  private timer = 0;
  private sweepCooldown: number = S.sweep.cooldown * 0.5;
  private slamCooldown: number = S.slam.cooldown * 0.5;
  private struck = false;
  /** Ondes encore à lancer après une masse abattue (temps restant avant chacune). */
  private pending: number[] = [];
  private pendingAt = new THREE.Vector3();
  private burn = 0;
  private readonly up = new THREE.Vector3();
  private readonly want = new THREE.Vector3();
  private readonly axis = new THREE.Vector3();

  /** `center` : le centre du cratère (direction) ; il n'en sort pas. */
  constructor(readonly zombie: Zombie, private readonly hooks: SauronHooks, private readonly center: THREE.Vector3) {
    zombie.size = S.bodyScale;
  }

  private set(anim: SauronAnim) {
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
    if (z.dead) {
      this.set('death');
      this.arc = null; this.impact = null; this.gaze = null;
      this.waves.length = 0; this.pending.length = 0;
      return;
    }
    const p = this.hooks.playerPos();
    this.updateWaves(dt, p);
    this.updateGaze(dt, p);
    const d = z.pos.angleTo(p) * PLANET_RADIUS;
    const SW = S.sweep, SL = S.slam, P2 = S.phase2;
    this.sweepCooldown -= dt;
    this.slamCooldown -= dt;
    z.walkSpeed = 0;

    // L'Oeil : entre deux coups, il lève le bras vers le ciel ; le regard part de lui
    if (this.phase === 1 && z.hp <= z.maxHp * P2.below && this.state === 'walk') {
      this.phase = 2;
      this.state = 'roar';
      this.timer = P2.pause;
      this.hooks.onPhase(2);
    }

    switch (this.state) {
      case 'roar':
        this.set('roar');
        z.turnToward(p, dt);
        if ((this.timer -= dt) <= 0) {
          this.state = 'walk';
          this.gaze = { at: z.pos.clone(), radius: P2.eye.radius };
        }
        this.keepInArena();
        return;
      case 'sweepWindup': {
        const a = this.arc!;
        this.timer += dt;
        a.t = Math.min(1, this.timer / SW.windup);
        if (a.t < SW.track) { z.turnToward(p, dt * 4); this.toward(z.pos, p, a.dir); a.at.copy(z.pos); z.facing.copy(a.dir); }
        this.set('idle');
        if (this.timer >= SW.windup) { this.state = 'sweeping'; this.timer = 0; this.struck = false; this.set('sweep'); }
        return;
      }
      case 'sweeping': {
        const a = this.arc!;
        this.set('sweep');
        this.timer += dt;
        if (!this.struck && this.timer >= SW.hitAt) {
          this.struck = true;
          const hit = this.inArc(a, p);
          if (hit) {
            const dir = this.toward(a.at, p, this.want).clone();
            this.hooks.hurtPlayer(dir, SW.damage);
            this.hooks.throwPlayer(dir);
          }
          this.hooks.onSweep(hit);
        }
        if (this.timer >= SW.duration) {
          this.arc = null;
          this.sweepCooldown = SW.cooldown;
          this.state = 'walk';
        }
        return;
      }
      case 'slamWindup': {
        const m = this.impact!;
        this.timer += dt;
        m.t = Math.min(1, this.timer / SL.windup);
        if (m.t < SL.track) {
          z.turnToward(p, dt * 4);
          z.facing.copy(this.toward(z.pos, p, this.want));
          this.ahead(Math.min(SL.reach, d), m.at);
        }
        this.set('idle');
        if (this.timer >= SL.windup) { this.state = 'slamming'; this.timer = 0; this.struck = false; }
        return;
      }
      case 'slamming': {
        const m = this.impact!;
        this.set('slam');
        this.timer += dt;
        if (!this.struck && this.timer >= SL.hitAt) {
          this.struck = true;
          const hit = m.at.angleTo(p) * PLANET_RADIUS < m.radius + 0.5;
          if (hit) this.hooks.hurtPlayer(this.toward(m.at, p, this.want).clone(), SL.damage);
          this.hooks.onSlam(m.at.clone(), hit);
          // L'onde part du point d'impact (en phase 2, d'autres suivent)
          this.pendingAt.copy(m.at);
          this.pending = this.phase === 2 ? Array.from({ length: P2.waves }, (_, i) => i * P2.gap) : [0];
          this.impact = null;
        }
        if (this.timer >= SL.duration) {
          this.impact = null;
          this.slamCooldown = SL.cooldown;
          this.state = 'walk';
        }
        return;
      }
    }

    // Il marche vers le joueur (sans sortir du cratère) ; il balaie de près, abat sa masse de plus loin
    z.turnToward(p, dt * 2);
    if (d < SW.range && this.sweepCooldown <= 0) {
      const dir = this.toward(z.pos, p, new THREE.Vector3());
      z.facing.copy(dir);
      this.arc = { at: z.pos.clone(), dir, radius: SW.radius, half: (SW.angle * Math.PI) / 360, t: 0 };
      this.state = 'sweepWindup';
      this.timer = 0;
      return;
    }
    if (d > SL.minDist && d < SL.range && this.slamCooldown <= 0) {
      z.facing.copy(this.toward(z.pos, p, this.want));
      this.impact = { at: this.ahead(Math.min(SL.reach, d), new THREE.Vector3()), radius: SL.radius, t: 0 };
      this.state = 'slamWindup';
      this.timer = 0;
      return;
    }
    if (d > SW.range * 0.6) {
      const speed = S.speed * (this.phase === 2 ? P2.speedMul : 1);
      this.toward(z.pos, p, this.want);
      z.pos.addScaledVector(this.want, speed * dt);
      z.walkSpeed = speed;
      this.set('walk');
    } else this.set('idle');
    this.keepInArena();
  }

  /** Le point à `dist` m devant lui (au sol, sur sa sphère). */
  private ahead(dist: number, out: THREE.Vector3) {
    const z = this.zombie;
    this.axis.crossVectors(z.pos, z.facing).normalize();
    return out.copy(z.pos).applyAxisAngle(this.axis, dist / z.pos.length());
  }

  /** Il ne sort pas du cratère : ramené à `arena` m du centre au plus. */
  private keepInArena() {
    const z = this.zombie;
    const r = z.pos.length();
    const dir = this.up.copy(z.pos).normalize();
    const angle = dir.angleTo(this.center);
    const max = S.arena / PLANET_RADIUS;
    if (angle <= max) return;
    this.axis.crossVectors(this.center, dir).normalize();
    z.pos.copy(this.center).normalize().applyAxisAngle(this.axis, max).multiplyScalar(r);
  }

  /** Le joueur est-il dans l'arc ? (une marge pour son corps) */
  private inArc(a: SweepArc, p: THREE.Vector3) {
    const dist = a.at.angleTo(p) * PLANET_RADIUS;
    if (dist > a.radius + 0.5) return false;
    if (dist < 1.2) return true;
    return this.toward(a.at, p, this.want).angleTo(a.dir) <= a.half;
  }

  /** Les ondes partent à leur heure, puis grandissent ; le joueur au sol dans le front de l'onde encaisse (une fois par onde). */
  private updateWaves(dt: number, p: THREE.Vector3) {
    const W = S.wave;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      if ((this.pending[i] -= dt) > 0) continue;
      this.pending.splice(i, 1);
      const at = this.pendingAt.clone();
      this.waves.push({ at, radius: 0, hit: false });
      this.hooks.onWave(at);
    }
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.radius += W.speed * dt;
      if (w.radius > W.maxRadius) { this.waves.splice(i, 1); continue; }
      if (w.hit) continue;
      const d = p.angleTo(w.at) * PLANET_RADIUS;
      if (Math.abs(d - w.radius) < W.width / 2 && this.hooks.playerHeight() < W.clear) {
        w.hit = true;
        this.hooks.hurtPlayer(this.toward(w.at, p, this.want).clone(), W.damage);
      }
    }
  }

  /** Le regard de l'Oeil glisse vers le joueur ; le joueur au sol dedans brûle à chaque `tick`. */
  private updateGaze(dt: number, p: THREE.Vector3) {
    const g = this.gaze;
    if (!g) return;
    const E = S.phase2.eye;
    const d = g.at.angleTo(p) * PLANET_RADIUS;
    if (d > 1e-3) {
      const step = Math.min(d, E.speed * dt);
      this.axis.crossVectors(g.at, p).normalize();
      g.at.applyAxisAngle(this.axis, step / g.at.length());
    }
    this.burn = Math.max(0, this.burn - dt);
    if (d < g.radius && this.hooks.playerHeight() < S.wave.clear && this.burn <= 0) {
      this.burn = E.tick;
      this.hooks.hurtPlayer(this.toward(g.at, p, this.want).clone(), E.damage);
      this.hooks.onGaze(p.clone());
    }
  }
}
