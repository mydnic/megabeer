import * as THREE from 'three';
import { VADOR as V } from '../config/bosses';
import { PLANET_RADIUS } from '../config/world';
import type { Zombie } from '../enemies/zombie';
import type { Boss } from './boss';

/** Ce que joue le modèle (clips de tools/blender/vador.py). */
export type VadorAnim = 'idle' | 'walk' | 'strike' | 'cast' | 'death';

/** Un coup de sabre annoncé : la zone marquée au sol (centre, rayon), et sa progression (0 à 1 : le coup part). */
export type SaberMark = { at: THREE.Vector3; radius: number; t: number };

/**
 * Le sabre lancé (phase 2) : où il est (au sol, l'affichage le lève), où il va (`target` à l'aller), s'il revient ;
 * s'il a déjà blessé le joueur à l'aller, au retour.
 */
export type ThrownSaber = { pos: THREE.Vector3; target: THREE.Vector3; back: boolean; hitOut: boolean; hitBack: boolean };

/** Ce dont Vador a besoin du jeu. */
export type VadorHooks = {
  playerPos(): THREE.Vector3;
  hurtPlayer(dir: THREE.Vector3, damage: number): void;
  /** Le sabre frappe : la zone `at` (rayon `radius`) ; `hit` : le joueur y était. */
  onStrike(at: THREE.Vector3, radius: number, hit: boolean): void;
  /** Phase 2 ; le sabre part de sa main, il y revient. */
  onPhase(phase: number): void;
  onThrow(): void;
  onCatch(): void;
};

/**
 * Dark Vador (boss optionnel d'un cimetière, issue #19). Son corps est un zombie de la horde (les armes le visent) ; ce
 * contrôleur le pilote. Il marche lentement vers le joueur ; de près, il lève son sabre : la zone devant lui est marquée
 * au sol, puis le coup part et blesse le joueur resté dedans. À mi-vie (phase 2), il lance aussi son sabre, qui file vers
 * le joueur en tournant puis revient dans sa main.
 */
export class Vador implements Boss {
  readonly kind = 'vador' as const;
  readonly name = V.name;
  readonly phaseAt = V.phase2.below;
  readonly music = V.music;
  readonly scale = 1;
  phase = 1;
  anim: VadorAnim = 'idle';
  animTime = 0;
  /** Le coup en préparation ou en cours (null : aucun). */
  mark: SaberMark | null = null;
  /** Le sabre en vol (null : dans sa main). */
  thrown: ThrownSaber | null = null;
  private throwCooldown: number = V.phase2.throw.every * 0.5;
  private pause = 0;
  private cooldown: number = V.strike.cooldown * 0.5;
  /** Temps de préparation (s, sabre levé, la zone se remplit), puis temps dans le geste. */
  private windup = 0;
  private struck = false;
  private readonly up = new THREE.Vector3();
  private readonly want = new THREE.Vector3();

  constructor(readonly zombie: Zombie, private readonly hooks: VadorHooks) {
    zombie.size = V.bodyScale;
  }

  private set(anim: VadorAnim) {
    if (this.anim === anim) return;
    this.anim = anim;
    this.animTime = 0;
  }

  update(dt: number) {
    const z = this.zombie;
    this.animTime += dt;
    // Il ne recule ni ne flanche sous les coups
    z.knockVel.set(0, 0, 0);
    z.stagger = 0;
    if (z.dead) { this.set('death'); this.mark = null; this.thrown = null; return; }
    const p = this.hooks.playerPos();
    const d = z.pos.angleTo(p) * PLANET_RADIUS;
    const S = V.strike, P2 = V.phase2, TH = P2.throw;
    this.updateSaber(dt, p);

    // Phase 2 : il s'arrête un instant, furieux
    if (this.phase === 1 && z.hp <= z.maxHp * P2.below && !this.mark && this.anim !== 'cast') {
      this.phase = 2;
      this.pause = P2.pause;
      this.hooks.onPhase(2);
    }
    if (this.pause > 0) { this.pause -= dt; z.walkSpeed = 0; this.set('idle'); z.turnToward(p, dt); return; }

    // Le lancer : le geste, puis le sabre part vers le joueur
    if (this.anim === 'cast') {
      z.walkSpeed = 0;
      z.turnToward(p, dt * 2);
      if (this.animTime >= TH.windup) {
        this.up.copy(z.pos).normalize();
        const dir = p.clone().sub(z.pos);
        dir.addScaledVector(this.up, -dir.dot(this.up));
        const far = Math.min(TH.range, Math.max(d + 3, TH.range * 0.6));
        dir.setLength(far);
        this.thrown = { pos: z.pos.clone(), target: z.pos.clone().add(dir), back: false, hitOut: false, hitBack: false };
        this.throwCooldown = TH.every;
        this.hooks.onThrow();
        this.set('idle');
      }
      return;
    }

    if (this.mark) {
      // Sabre levé : la zone devant lui se remplit ; il ne tourne plus (on peut en sortir)
      z.walkSpeed = 0;
      if (this.windup < S.windup) {
        this.windup += dt;
        this.mark.t = Math.min(1, this.windup / S.windup);
        if (this.windup >= S.windup) this.set('strike');
        else this.set('idle');
        return;
      }
      if (!this.struck && this.animTime >= S.hitAt) {
        this.struck = true;
        const m = this.mark;
        const hit = p.angleTo(m.at) * PLANET_RADIUS < m.radius;
        if (hit) this.hooks.hurtPlayer(this.away(p, z.pos), S.damage);
        this.hooks.onStrike(m.at.clone(), m.radius, hit);
      }
      if (this.animTime >= S.duration) {
        this.mark = null;
        this.cooldown = S.cooldown;
        this.set('idle');
      }
      return;
    }

    this.cooldown -= dt;
    if (this.phase === 2 && !this.thrown) this.throwCooldown -= dt;
    z.turnToward(p, dt);
    if (this.phase === 2 && !this.thrown && this.throwCooldown <= 0 && d > TH.minDist) {
      z.walkSpeed = 0;
      this.set('cast');
      return;
    }
    // Sans sabre en main, il ne frappe pas
    if (d < S.range && this.cooldown <= 0 && !this.thrown) {
      // Il lève son sabre : la zone de son coup, devant lui
      this.up.copy(z.pos).normalize();
      this.want.copy(z.facing).addScaledVector(this.up, -z.facing.dot(this.up)).normalize();
      this.mark = { at: z.pos.clone().addScaledVector(this.want, S.ahead), radius: S.radius, t: 0 };
      this.windup = 0;
      this.struck = false;
      z.walkSpeed = 0;
      this.set('idle');
      return;
    }
    // Marche vers le joueur (la horde le repose sur le sol et le décor comme les autres)
    if (d > S.range * 0.5) {
      this.up.copy(z.pos).normalize();
      this.want.copy(z.facing).addScaledVector(this.up, -z.facing.dot(this.up)).normalize();
      const speed = V.speed * (this.phase === 2 ? P2.speedMul : 1);
      z.pos.addScaledVector(this.want, speed * dt);
      z.walkSpeed = speed;
      this.set('walk');
    } else {
      z.walkSpeed = 0;
      this.set('idle');
    }
  }

  /** Le sabre en vol : vers sa cible, puis retour vers Vador ; il blesse le joueur qu'il traverse (une fois par sens). */
  private updateSaber(dt: number, p: THREE.Vector3) {
    const s = this.thrown;
    if (!s) return;
    const TH = V.phase2.throw;
    const to = s.back ? this.zombie.pos : s.target;
    const step = this.want.subVectors(to, s.pos);
    const left = step.length();
    if (left <= TH.speed * dt) {
      s.pos.copy(to);
      if (s.back) { this.thrown = null; this.hooks.onCatch(); return; }
      s.back = true;
    } else {
      s.pos.addScaledVector(step, (TH.speed * dt) / left);
      // Il suit le sol (la planète est ronde)
      s.pos.setLength(this.zombie.pos.length());
    }
    if (p.angleTo(s.pos) * PLANET_RADIUS < TH.radius && !(s.back ? s.hitBack : s.hitOut)) {
      if (s.back) s.hitBack = true; else s.hitOut = true;
      this.hooks.hurtPlayer(this.away(p, s.pos), TH.damage);
    }
  }

  /** Direction (au sol) de `from` vers le joueur. */
  private away(p: THREE.Vector3, from: THREE.Vector3) {
    const up = this.up.copy(p).normalize();
    const dir = p.clone().sub(from);
    dir.addScaledVector(up, -dir.dot(up));
    if (dir.lengthSq() < 1e-6) dir.copy(this.zombie.facing);
    return dir.normalize();
  }
}
