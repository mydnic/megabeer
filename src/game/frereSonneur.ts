import * as THREE from 'three';
import { FRERE_SONNEUR as F } from '../config/bosses';
import { PLANET_RADIUS } from '../config/world';
import type { Zombie } from '../enemies/zombie';

/** Ce que joue le modèle du boss (clips de tools/blender/sonneur.py). */
export type BossAnim = 'idle' | 'walk' | 'strike' | 'roar' | 'death';

/** Une onde qui part du point d'impact du maillet ; `radius` grandit, `hit` : elle a déjà touché le joueur. */
export type BossWave = { at: THREE.Vector3; radius: number; hit: boolean };

/** Ce dont le boss a besoin du jeu (il ne connaît rien d'autre). */
export type BossHooks = {
  /** Pieds du joueur, et sa hauteur au-dessus du sol (m, 0 : au sol). */
  playerPos(): THREE.Vector3;
  playerHeight(): number;
  /** Le joueur encaisse `damage`, repoussé dans la direction `dir`. */
  hurtPlayer(dir: THREE.Vector3, damage: number): void;
  /** Le maillet touche le sol en `at` (onde lancée). */
  onWave(at: THREE.Vector3): void;
  /** Passage en phase 2. */
  onPhase(phase: number): void;
};

/**
 * Le Frère Sonneur (boss de 5:00 de l'Abbaye). Son corps est un zombie de la horde (les armes le visent, il
 * encaisse et meurt comme les autres) ; ce contrôleur le pilote à la place de la horde : il marche vers le joueur,
 * s'arrête à portée pour abattre son maillet, et chaque coup lance une onde en anneau qu'il faut sauter. Sous
 * la moitié de ses PV, il rugit puis passe en phase 2 (plus vite, plus souvent, deux ondes).
 */
export class FrereSonneur {
  phase = 1;
  /** Animation en cours et son temps (s), lus par l'affichage. */
  anim: BossAnim = 'idle';
  animTime = 0;
  readonly waves: BossWave[] = [];
  private cooldown: number = F.strike.cooldown * 0.5;
  /** Ondes encore à lancer pendant ce coup (temps restant avant chacune). */
  private pending: number[] = [];
  private hitDone = false;
  private readonly up = new THREE.Vector3();
  private readonly want = new THREE.Vector3();

  constructor(readonly zombie: Zombie, private readonly hooks: BossHooks) {
    zombie.size = F.bodyScale;
  }

  private set(anim: BossAnim) {
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
    this.updateWaves(dt);
    if (z.dead) { this.set('death'); this.waves.length = 0; return; }
    // Phase 2 : il rugit sur place
    if (this.phase === 1 && z.hp <= z.maxHp * F.phase2.below) {
      this.phase = 2;
      this.set('roar');
      this.hooks.onPhase(2);
    }
    if (z.rise > 0) { if (this.anim !== 'roar') this.set('idle'); return; }
    if (this.anim === 'roar' && this.animTime < F.phase2.roar) return;

    const p = this.hooks.playerPos();
    const d = z.pos.angleTo(p) * PLANET_RADIUS;
    const S = F.strike;
    if (this.anim === 'strike') {
      z.turnToward(p, dt * 0.3);
      // Le maillet touche le sol : coup sous le maillet, puis les ondes
      if (!this.hitDone && this.animTime >= S.hitAt) {
        this.hitDone = true;
        const at = this.impact();
        if (p.angleTo(at) * PLANET_RADIUS < S.radius) this.hooks.hurtPlayer(this.away(p, at), S.damage);
        this.launch(at);
        this.pending = this.phase === 2 ? [F.phase2.delay] : [];
      }
      for (let i = this.pending.length - 1; i >= 0; i--) {
        if ((this.pending[i] -= dt) <= 0) { this.pending.splice(i, 1); this.launch(this.impact()); }
      }
      if (this.animTime >= S.duration) { this.set('idle'); this.cooldown = S.cooldown * (this.phase === 2 ? F.phase2.cooldownMul : 1); }
      return;
    }
    this.cooldown -= dt;
    if (d < S.range && this.cooldown <= 0) {
      this.set('strike');
      this.hitDone = false;
      return;
    }
    // Marche vers le joueur (le sol et le décor : la horde le repose comme les autres)
    z.turnToward(p, dt);
    const speed = F.speed * (this.phase === 2 ? F.phase2.speedMul : 1);
    if (d > S.range * 0.6) {
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

  /** Point d'impact du maillet : devant lui. */
  private impact() {
    const z = this.zombie;
    return z.pos.clone().addScaledVector(z.facing, F.strike.reach);
  }

  private launch(at: THREE.Vector3) {
    this.waves.push({ at, radius: 0, hit: false });
    this.hooks.onWave(at);
  }

  /** Direction (au sol) de `from` vers le joueur. */
  private away(p: THREE.Vector3, from: THREE.Vector3) {
    const up = this.up.copy(p).normalize();
    const dir = p.clone().sub(from);
    dir.addScaledVector(up, -dir.dot(up));
    if (dir.lengthSq() < 1e-6) dir.copy(this.zombie.facing);
    return dir.normalize();
  }

  /** Les ondes grandissent ; le joueur au sol dans le front de l'onde encaisse (une fois par onde). */
  private updateWaves(dt: number) {
    const W = F.wave;
    const p = this.hooks.playerPos();
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.radius += W.speed * dt;
      if (w.radius > W.maxRadius) { this.waves.splice(i, 1); continue; }
      if (w.hit) continue;
      const d = p.angleTo(w.at) * PLANET_RADIUS;
      if (Math.abs(d - w.radius) < W.width / 2 && this.hooks.playerHeight() < W.clear) {
        w.hit = true;
        this.hooks.hurtPlayer(this.away(p, w.at), W.damage);
      }
    }
  }
}
