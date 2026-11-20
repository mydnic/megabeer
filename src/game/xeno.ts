import * as THREE from 'three';
import { XENO as X } from '../config/bosses';
import { PLANET_RADIUS } from '../config/world';
import type { Zombie } from '../enemies/zombie';
import type { Boss } from './boss';

/** Ce que joue le modèle (clips de tools/blender/xeno.py). */
export type XenoAnim = 'idle' | 'walk' | 'crouch' | 'leap' | 'tail' | 'roar' | 'death';

/** Le point de chute d'un bond : centre, rayon (m) ; `t` : préparation (0 à 1, 1 : il saute). */
export type PounceMark = { at: THREE.Vector3; radius: number; t: number };
/** La bande d'un coup de queue : départ, direction (au sol), longueur et largeur (m) ; `t` : préparation (0 à 1). */
export type TailLane = { from: THREE.Vector3; dir: THREE.Vector3; length: number; width: number; t: number };
/** Une flaque de sang acide (phase 2) : centre, rayon (m), âge (s), temps avant la prochaine morsure (s). */
export type AcidPool = { at: THREE.Vector3; radius: number; t: number; tick: number };

/** Ce dont le Xénomorphe a besoin du jeu. */
export type XenoHooks = {
  playerPos(): THREE.Vector3;
  /** Hauteur du joueur au-dessus du sol (m) : en sautant, il passe au-dessus de l'acide. */
  playerHeight(): number;
  hurtPlayer(dir: THREE.Vector3, damage: number): void;
  onPhase(phase: number): void;
  /** Il saute ; il retombe (`hit` : le joueur était dans le disque) ; sa queue frappe. */
  onLeap(): void;
  onLand(at: THREE.Vector3, radius: number, hit: boolean): void;
  onTail(hit: boolean): void;
};

type State = 'walk' | 'pounceWindup' | 'leaping' | 'recover' | 'tailWindup' | 'tailStrike' | 'roar';

/**
 * Le Xénomorphe (boss optionnel d'un cimetière, issue #19). Son corps est un zombie de la horde ; ce contrôleur le
 * pilote. Il court vers le joueur à quatre pattes. De loin, il se ramasse et bondit : le point de chute est marqué au
 * sol, il retombe dessus. De près, sa queue passe par-dessus son dos et pique devant lui (bande marquée). À mi-vie, il
 * hurle, court plus vite, enchaîne deux bonds et laisse à chaque atterrissage une flaque de sang acide.
 */
export class Xeno implements Boss {
  readonly kind = 'xeno' as const;
  readonly name = X.name;
  readonly phaseAt = X.phase2.below;
  readonly music = X.music;
  readonly scale = 1;
  phase = 1;
  anim: XenoAnim = 'idle';
  animTime = 0;
  /** Hauteur du bond (m, lue par l'affichage). */
  air = 0;
  mark: PounceMark | null = null;
  lane: TailLane | null = null;
  readonly pools: AcidPool[] = [];
  private state: State = 'walk';
  private timer = 0;
  private pounceCooldown: number = X.pounce.cooldown * 0.5;
  private tailCooldown: number = X.tail.cooldown * 0.5;
  private poundsLeft = 0;
  private struck = false;
  private readonly from = new THREE.Vector3();
  private readonly axis = new THREE.Vector3();
  private angle = 0;
  private readonly up = new THREE.Vector3();
  private readonly want = new THREE.Vector3();

  constructor(readonly zombie: Zombie, private readonly hooks: XenoHooks) {
    zombie.size = X.bodyScale;
  }

  private set(anim: XenoAnim) {
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
    this.updatePools(dt);
    z.airborne = this.state === 'leaping';
    if (z.dead) { this.set('death'); this.mark = null; this.lane = null; this.air = 0; return; }
    const p = this.hooks.playerPos();
    const d = z.pos.angleTo(p) * PLANET_RADIUS;
    const PO = X.pounce, T = X.tail, P2 = X.phase2;
    const rage = this.phase === 2;
    this.pounceCooldown -= dt;
    this.tailCooldown -= dt;
    z.walkSpeed = 0;

    // Phase 2 : entre deux attaques, il se cabre et hurle
    if (this.phase === 1 && z.hp <= z.maxHp * P2.below && (this.state === 'walk' || this.state === 'recover')) {
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
      case 'recover':
        this.set('idle');
        if ((this.timer -= dt) <= 0) this.state = 'walk';
        return;
      case 'pounceWindup': {
        // Ramassé, le point de chute marqué ; il suit le joueur au début, puis se fige
        const m = this.mark!;
        const wind = this.poundsLeft < (rage ? P2.pounces : 1) ? P2.rewindup : PO.windup;
        this.timer += dt;
        m.t = Math.min(1, this.timer / wind);
        if (m.t < PO.track) { m.at.copy(p); z.turnToward(p, dt * 4); }
        this.set('crouch');
        if (this.timer >= wind) {
          // Il saute : un arc de grand cercle de là où il est jusqu'au point de chute
          this.state = 'leaping';
          this.timer = 0;
          this.from.copy(z.pos);
          this.axis.crossVectors(z.pos, m.at);
          this.angle = z.pos.angleTo(m.at);
          if (this.axis.lengthSq() < 1e-10) this.axis.crossVectors(z.pos, z.facing);
          this.axis.normalize();
          this.toward(z.pos, m.at, z.facing);
          this.hooks.onLeap();
        }
        return;
      }
      case 'leaping': {
        const m = this.mark!;
        this.set('leap');
        this.timer += dt;
        const u = Math.min(1, this.timer / PO.flight);
        z.pos.copy(this.from).applyAxisAngle(this.axis, this.angle * u);
        this.air = PO.arc * 4 * u * (1 - u);
        z.walkSpeed = (this.angle * PLANET_RADIUS) / PO.flight;
        if (u >= 1) {
          this.air = 0;
          const hit = p.angleTo(m.at) * PLANET_RADIUS < m.radius;
          if (hit) this.hooks.hurtPlayer(this.toward(m.at, p, this.want).clone(), PO.damage);
          this.hooks.onLand(m.at.clone(), m.radius, hit);
          if (rage) this.pools.push({ at: m.at.clone(), radius: P2.acid.radius, t: 0, tick: 0 });
          this.mark = null;
          this.poundsLeft--;
          if (this.poundsLeft > 0) this.startPounce(p);
          else {
            this.pounceCooldown = PO.cooldown;
            this.state = 'recover';
            this.timer = PO.recover;
          }
        }
        return;
      }
      case 'tailWindup': {
        const l = this.lane!;
        this.timer += dt;
        l.t = Math.min(1, this.timer / T.windup);
        if (l.t < T.track) { z.turnToward(p, dt * 4); this.toward(z.pos, p, l.dir); l.from.copy(z.pos); z.facing.copy(l.dir); }
        this.set('crouch');
        if (this.timer >= T.windup) { this.state = 'tailStrike'; this.timer = 0; this.struck = false; }
        return;
      }
      case 'tailStrike': {
        const l = this.lane!;
        this.set('tail');
        this.timer += dt;
        if (!this.struck && this.timer >= T.hitAt) {
          this.struck = true;
          const hit = this.inLane(l, p);
          if (hit) this.hooks.hurtPlayer(l.dir.clone(), T.damage);
          this.hooks.onTail(hit);
        }
        if (this.timer >= T.duration) {
          this.lane = null;
          this.tailCooldown = T.cooldown;
          this.state = 'walk';
        }
        return;
      }
    }

    // Il court vers le joueur ; il bondit de loin, pique de la queue de près
    z.turnToward(p, dt * 2);
    if (d < T.range && this.tailCooldown <= 0) {
      const dir = this.toward(z.pos, p, new THREE.Vector3());
      this.lane = { from: z.pos.clone(), dir, length: T.length, width: T.width, t: 0 };
      this.state = 'tailWindup';
      this.timer = 0;
      return;
    }
    if (d > PO.minDist && d < PO.range && this.pounceCooldown <= 0) {
      this.poundsLeft = rage ? P2.pounces : 1;
      this.startPounce(p);
      return;
    }
    if (d > X.keep) {
      const speed = X.speed * (rage ? P2.speedMul : 1);
      this.toward(z.pos, p, this.want);
      z.pos.addScaledVector(this.want, speed * dt);
      z.walkSpeed = speed;
      this.set('walk');
    } else this.set('idle');
  }

  /** Un bond vers le joueur : le point de chute marqué sous lui. */
  private startPounce(p: THREE.Vector3) {
    this.mark = { at: p.clone(), radius: X.pounce.radius, t: 0 };
    this.state = 'pounceWindup';
    this.timer = 0;
  }

  /** Le joueur est-il dans la bande ? (sur le plan tangent au départ ; une marge pour son corps) */
  private inLane(l: TailLane, p: THREE.Vector3) {
    const up = this.up.copy(l.from).normalize();
    const v = this.want.subVectors(p, l.from);
    v.addScaledVector(up, -v.dot(up));
    const along = v.dot(l.dir);
    const across = v.addScaledVector(l.dir, -along).length();
    return along >= -0.5 && along <= l.length && across < l.width / 2 + 0.5;
  }

  /** Flaques d'acide : elles rongent le joueur au sol dedans, puis sèchent. */
  private updatePools(dt: number) {
    const A = X.phase2.acid;
    const p = this.hooks.playerPos();
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const w = this.pools[i];
      w.t += dt;
      if (w.t > A.life) { this.pools.splice(i, 1); continue; }
      w.tick -= dt;
      if (w.tick > 0) continue;
      if (p.angleTo(w.at) * PLANET_RADIUS < w.radius && this.hooks.playerHeight() < 0.5) {
        w.tick = A.tick;
        this.hooks.hurtPlayer(this.toward(w.at, p, this.want).clone(), A.damage);
      }
    }
  }
}
