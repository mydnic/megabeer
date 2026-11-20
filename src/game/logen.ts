import * as THREE from 'three';
import { LOGEN as L } from '../config/bosses';
import { PLANET_RADIUS } from '../config/world';
import type { Zombie } from '../enemies/zombie';
import type { Boss } from './boss';

/** Ce que joue le modèle (clips de tools/blender/kaykit.py, variante logen). */
export type LogenAnim = 'idle' | 'walk' | 'run' | 'spin' | 'roar' | 'death';

/** La bande d'une charge : départ, direction (au sol), longueur et largeur (m) ; `t` : préparation (0 à 1). */
export type ChargeLane = { from: THREE.Vector3; dir: THREE.Vector3; length: number; width: number; t: number };
/** Le cercle d'un tourbillon : centre, rayon (m) ; `t` : préparation (0 à 1, 1 : il tourne). */
export type SpinRing = { at: THREE.Vector3; radius: number; t: number };

/** Ce dont Logen a besoin du jeu. */
export type LogenHooks = {
  playerPos(): THREE.Vector3;
  hurtPlayer(dir: THREE.Vector3, damage: number): void;
  onPhase(phase: number): void;
  /** Il part en charge ; il commence à tourner. */
  onCharge(): void;
  onSpin(): void;
};

type State = 'walk' | 'chargeWindup' | 'charging' | 'tired' | 'spinWindup' | 'spinning' | 'roar';

/**
 * Logen Neuf-Doigts (boss optionnel d'un cimetière, issue #19). Son corps est un zombie de la horde ; ce contrôleur le
 * pilote. Il marche vers le joueur. De loin, il charge : la bande devant lui est marquée, puis il fonce tout droit et
 * percute le joueur resté dedans, et s'arrête essoufflé. De près, il frappe en tourbillon : le cercle autour de lui est
 * marqué, puis il tourne épée tendue. À mi-vie (« le Sanguinaire »), il crie, va plus vite, ne s'essouffle plus et
 * enchaîne deux charges.
 */
export class Logen implements Boss {
  readonly kind = 'logen' as const;
  readonly name = L.name;
  readonly phaseAt = L.phase2.below;
  readonly music = L.music;
  readonly scale = 1;
  phase = 1;
  anim: LogenAnim = 'idle';
  animTime = 0;
  /** Rotation sur lui-même pendant le tourbillon (rad, lue par l'affichage). */
  turn = 0;
  /** La charge préparée ou en cours, le tourbillon préparé ou en cours (null : aucun). */
  lane: ChargeLane | null = null;
  ring: SpinRing | null = null;
  private state: State = 'walk';
  private timer = 0;
  private chargeCooldown: number = L.charge.cooldown * 0.5;
  private spinCooldown: number = L.spin.cooldown * 0.5;
  private chargesLeft = 0;
  private travelled = 0;
  private hit = false;
  private readonly up = new THREE.Vector3();
  private readonly want = new THREE.Vector3();

  constructor(readonly zombie: Zombie, private readonly hooks: LogenHooks) {
    zombie.size = L.bodyScale;
  }

  private set(anim: LogenAnim) {
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
    if (z.dead) { this.set('death'); this.lane = null; this.ring = null; this.turn = 0; return; }
    const p = this.hooks.playerPos();
    const d = z.pos.angleTo(p) * PLANET_RADIUS;
    const C = L.charge, S = L.spin, P2 = L.phase2;
    const rage = this.phase === 2;
    this.chargeCooldown -= dt;
    this.spinCooldown -= dt;
    z.walkSpeed = 0;

    // Le Sanguinaire : entre deux attaques, il crie
    if (this.phase === 1 && z.hp <= z.maxHp * P2.below && (this.state === 'walk' || this.state === 'tired')) {
      this.phase = 2;
      this.state = 'roar';
      this.timer = P2.pause;
      this.hooks.onPhase(2);
    }

    switch (this.state) {
      case 'roar':
        this.set('roar');
        z.turnToward(p, dt);
        if ((this.timer -= dt) <= 0) this.state = 'walk';
        return;
      case 'tired':
        this.set('idle');
        if ((this.timer -= dt) <= 0) this.state = 'walk';
        return;
      case 'chargeWindup': {
        // En garde, la bande marquée ; elle suit encore un peu le joueur au début
        const lane = this.lane!;
        const wind = this.chargesLeft < (rage ? P2.charges : 1) - 1 ? P2.rewindup : C.windup;
        this.timer += dt;
        lane.t = Math.min(1, this.timer / wind);
        if (lane.t < 0.4) { z.turnToward(p, dt * 3); this.toward(z.pos, p, lane.dir); lane.from.copy(z.pos); }
        this.set('idle');
        if (this.timer >= wind) {
          this.state = 'charging';
          this.travelled = 0;
          this.hit = false;
          this.hooks.onCharge();
        }
        return;
      }
      case 'charging': {
        const lane = this.lane!;
        this.set('run');
        const step = C.speed * dt;
        // Tout droit sur la sphère : la direction reste tangente au sol là où il est
        this.up.copy(z.pos).normalize();
        lane.dir.addScaledVector(this.up, -lane.dir.dot(this.up)).normalize();
        z.pos.addScaledVector(lane.dir, step);
        z.facing.copy(lane.dir);
        z.walkSpeed = C.speed;
        this.travelled += step;
        if (!this.hit && d < C.width / 2 + 0.6) {
          this.hit = true;
          this.hooks.hurtPlayer(lane.dir.clone(), C.damage);
        }
        if (this.travelled >= lane.length) {
          this.chargesLeft--;
          if (this.chargesLeft > 0) this.startCharge(p);
          else {
            this.lane = null;
            this.chargeCooldown = C.cooldown;
            this.state = rage ? 'walk' : 'tired';
            this.timer = C.tired;
          }
        }
        return;
      }
      case 'spinWindup': {
        const ring = this.ring!;
        this.timer += dt;
        ring.at.copy(z.pos);
        ring.t = Math.min(1, this.timer / S.windup);
        this.set('idle');
        if (this.timer >= S.windup) {
          this.state = 'spinning';
          this.timer = 0;
          this.hit = false;
          this.hooks.onSpin();
        }
        return;
      }
      case 'spinning': {
        const ring = this.ring!;
        this.set('spin');
        this.timer += dt;
        this.turn += S.turns * Math.PI * 2 * dt;
        ring.at.copy(z.pos);
        if (!this.hit && d < ring.radius) {
          this.hit = true;
          this.hooks.hurtPlayer(this.toward(z.pos, p, this.want).clone(), S.damage);
        }
        if (this.timer >= S.duration) {
          this.ring = null;
          this.turn = 0;
          this.spinCooldown = S.cooldown;
          this.state = 'walk';
        }
        return;
      }
    }

    // Il marche vers le joueur ; il charge de loin, tourbillonne de près
    z.turnToward(p, dt);
    if (d < S.range && this.spinCooldown <= 0) {
      this.state = 'spinWindup';
      this.timer = 0;
      this.ring = { at: z.pos.clone(), radius: S.radius, t: 0 };
      return;
    }
    if (d > C.minDist && d < C.range && this.chargeCooldown <= 0) {
      this.chargesLeft = rage ? P2.charges : 1;
      this.startCharge(p);
      return;
    }
    if (d > S.range * 0.6) {
      const speed = L.speed * (rage ? P2.speedMul : 1);
      this.toward(z.pos, p, this.want);
      z.pos.addScaledVector(this.want, speed * dt);
      z.walkSpeed = speed;
      this.set('walk');
    } else this.set('idle');
  }

  /** Une charge vers le joueur : la bande marquée devant lui. */
  private startCharge(p: THREE.Vector3) {
    const z = this.zombie;
    const dir = this.toward(z.pos, p, new THREE.Vector3());
    z.facing.copy(dir);
    this.lane = { from: z.pos.clone(), dir, length: L.charge.length, width: L.charge.width, t: 0 };
    this.state = 'chargeWindup';
    this.timer = 0;
  }
}
