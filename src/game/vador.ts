import * as THREE from 'three';
import { VADOR as V } from '../config/bosses';
import { PLANET_RADIUS } from '../config/world';
import type { Zombie } from '../enemies/zombie';
import type { Boss } from './boss';

/** Ce que joue le modèle (clips de tools/blender/vador.py). */
export type VadorAnim = 'idle' | 'walk' | 'strike' | 'death';

/** Un coup de sabre annoncé : la zone marquée au sol (centre, rayon), et sa progression (0 à 1 : le coup part). */
export type SaberMark = { at: THREE.Vector3; radius: number; t: number };

/** Ce dont Vador a besoin du jeu. */
export type VadorHooks = {
  playerPos(): THREE.Vector3;
  hurtPlayer(dir: THREE.Vector3, damage: number): void;
  /** Le sabre frappe : la zone `at` (rayon `radius`) ; `hit` : le joueur y était. */
  onStrike(at: THREE.Vector3, radius: number, hit: boolean): void;
};

/**
 * Dark Vador (boss optionnel d'un cimetière, issue #19). Son corps est un zombie de la horde (les armes le visent) ; ce
 * contrôleur le pilote. Il marche lentement vers le joueur ; de près, il lève son sabre : la zone devant lui est marquée
 * au sol, puis le coup part et blesse le joueur resté dedans.
 */
export class Vador implements Boss {
  readonly kind = 'vador' as const;
  readonly name = V.name;
  readonly phaseAt = 0.5;
  readonly music = V.music;
  readonly scale = 1;
  phase = 1;
  anim: VadorAnim = 'idle';
  animTime = 0;
  /** Le coup en préparation ou en cours (null : aucun). */
  mark: SaberMark | null = null;
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
    if (z.dead) { this.set('death'); this.mark = null; return; }
    const p = this.hooks.playerPos();
    const d = z.pos.angleTo(p) * PLANET_RADIUS;
    const S = V.strike;

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
    z.turnToward(p, dt);
    if (d < S.range && this.cooldown <= 0) {
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
      z.pos.addScaledVector(this.want, V.speed * dt);
      z.walkSpeed = V.speed;
      this.set('walk');
    } else {
      z.walkSpeed = 0;
      this.set('idle');
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
