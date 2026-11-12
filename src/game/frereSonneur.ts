import * as THREE from 'three';
import { FRERE_SONNEUR as F } from '../config/bosses';
import { PLANET_RADIUS } from '../config/world';
import type { Zombie } from '../enemies/zombie';

/** Ce que joue le modèle du boss (clips de tools/blender/sonneur.py). */
export type BossAnim = 'idle' | 'walk' | 'strike' | 'push' | 'roar' | 'death';

/** Une onde qui part de la cloche ; `radius` grandit, `hit` : elle a déjà touché le joueur. */
export type BossWave = { at: THREE.Vector3; radius: number; hit: boolean };

/**
 * La cloche géante : ses pieds (le bord de la lèvre posé au sol), si elle roule (direction au sol, distance faite,
 * angle de roulis), et le temps depuis son dernier coup (l'affichage la fait vibrer).
 */
export type BossBell = {
  pos: THREE.Vector3;
  rolling: boolean;
  dir: THREE.Vector3;
  rolled: number;
  spin: number;
  /** Elle a déjà blessé le joueur pendant cette roulade. */
  hit: boolean;
  /** Temps depuis le dernier coup de maillet (s ; grand : elle ne sonne pas). */
  rungAgo: number;
};

/** Ce dont le boss a besoin du jeu (il ne connaît rien d'autre). */
export type BossHooks = {
  /** Pieds du joueur, et sa hauteur au-dessus du sol (m, 0 : au sol). */
  playerPos(): THREE.Vector3;
  playerHeight(): number;
  /** Le joueur encaisse `damage`, repoussé dans la direction `dir`. */
  hurtPlayer(dir: THREE.Vector3, damage: number): void;
  /** Rayon du sol sous un point. */
  groundAt(p: THREE.Vector3): number;
  /** Le décor occupe-t-il ce point, à `margin` m près ? */
  blocked(p: THREE.Vector3, margin: number): boolean;
  /** La cloche sonne : une onde part de `at`. */
  onWave(at: THREE.Vector3): void;
  /** Il pousse la cloche : elle part rouler. */
  onPush(): void;
  /** La cloche s'arrête. */
  onBellStop(): void;
  /** Passage en phase 2. */
  onPhase(phase: number): void;
};

type State = 'toBell' | 'ring' | 'pause' | 'push' | 'roar';

/**
 * Le Frère Sonneur (boss de 5:00 de l'Abbaye, GDD section 11). Son corps est un zombie de la horde (les armes le
 * visent, il encaisse et meurt comme les autres) ; ce contrôleur le pilote à la place de la horde. Il va se placer
 * derrière sa cloche géante (du côté opposé au joueur), la sonne à coups de maillet (chaque coup lance une onde en
 * anneau qu'il faut sauter), puis la pousse : elle roule vers le joueur et le blesse si elle le touche. Il retourne
 * alors la chercher. Sous la moitié de ses PV, il rugit puis passe en phase 2 (plus vite, cloche plus rapide, deux
 * ondes par coup).
 */
export class FrereSonneur {
  phase = 1;
  /** Animation en cours et son temps (s), lus par l'affichage. */
  anim: BossAnim = 'idle';
  animTime = 0;
  readonly waves: BossWave[] = [];
  readonly bell: BossBell;
  private state: State = 'toBell';
  private stateTime = 0;
  private rings = 0;
  /** Ondes encore à lancer pendant ce coup (temps restant avant chacune). */
  private pending: number[] = [];
  private hitDone = false;
  private pushed = false;
  private readonly up = new THREE.Vector3();
  private readonly want = new THREE.Vector3();
  private readonly spot = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();

  constructor(readonly zombie: Zombie, private readonly hooks: BossHooks) {
    zombie.size = F.bodyScale;
    // Sa cloche est posée devant lui
    const at = zombie.pos.clone().addScaledVector(zombie.facing, F.bell.standOff);
    at.setLength(hooks.groundAt(at));
    this.bell = { pos: at, rolling: false, dir: new THREE.Vector3(), rolled: 0, spin: 0, hit: false, rungAgo: 99 };
  }

  private go(state: State, anim: BossAnim) {
    this.state = state;
    this.stateTime = 0;
    if (this.anim !== anim || anim === 'strike') { this.anim = anim; this.animTime = 0; }
  }

  update(dt: number) {
    const z = this.zombie;
    this.animTime += dt;
    this.stateTime += dt;
    this.bell.rungAgo += dt;
    // Il ne recule ni ne flanche sous les coups
    z.knockVel.set(0, 0, 0);
    z.stagger = 0;
    this.updateWaves(dt);
    this.updateBell(dt);
    if (z.dead) { this.anim = 'death'; this.waves.length = 0; return; }

    // Phase 2 : il rugit sur place
    if (this.phase === 1 && z.hp <= z.maxHp * F.phase2.below) {
      this.phase = 2;
      this.go('roar', 'roar');
      this.hooks.onPhase(2);
    }
    if (z.rise > 0) return;
    const S = F.strike, B = F.bell;
    switch (this.state) {
      case 'roar':
        if (this.stateTime >= F.phase2.roar) this.go('toBell', 'walk');
        return;
      case 'ring':
        z.turnToward(this.bell.pos, dt);
        if (!this.hitDone && this.stateTime >= S.hitAt) {
          this.hitDone = true;
          this.ring();
          this.pending = this.phase === 2 ? [F.phase2.delay] : [];
        }
        for (let i = this.pending.length - 1; i >= 0; i--) if ((this.pending[i] -= dt) <= 0) { this.pending.splice(i, 1); this.ring(); }
        if (this.stateTime >= S.duration && !this.pending.length) {
          this.rings++;
          this.go('pause', 'idle');
        }
        return;
      case 'pause':
        z.turnToward(this.bell.pos, dt);
        if (this.stateTime >= S.gap) this.atBell();
        return;
      case 'push':
        z.turnToward(this.bell.pos, dt);
        if (!this.pushed && this.stateTime >= B.pushAt) this.push();
        if (this.stateTime >= B.push) { this.rings = 0; this.go('toBell', 'walk'); }
        return;
      case 'toBell': {
        if (this.bell.rolling) { z.walkSpeed = 0; this.anim = 'idle'; return; }
        // Sa place : derrière la cloche, du côté opposé au joueur
        const p = this.hooks.playerPos();
        this.up.copy(this.bell.pos).normalize();
        this.want.copy(this.bell.pos).sub(p).addScaledVector(this.up, -this.bell.pos.clone().sub(p).dot(this.up));
        if (this.want.lengthSq() < 1e-6) this.want.copy(z.facing).negate();
        this.spot.copy(this.bell.pos).addScaledVector(this.want.normalize(), B.standOff);
        const d = z.pos.distanceTo(this.spot);
        if (d < B.arrive) { this.atBell(); return; }
        z.turnToward(this.spot, dt * 2);
        const speed = F.speed * (this.phase === 2 ? F.phase2.speedMul : 1);
        this.up.copy(z.pos).normalize();
        this.want.copy(z.facing).addScaledVector(this.up, -z.facing.dot(this.up)).normalize();
        z.pos.addScaledVector(this.want, Math.min(d, speed * dt));
        z.walkSpeed = speed;
        if (this.anim !== 'walk') { this.anim = 'walk'; this.animTime = 0; }
        return;
      }
    }
  }

  /** Arrivé derrière sa cloche : il la sonne, ou la pousse s'il l'a assez sonnée. */
  private atBell() {
    this.zombie.walkSpeed = 0;
    if (this.rings < F.strike.rings) { this.hitDone = false; this.go('ring', 'strike'); }
    else { this.pushed = false; this.go('push', 'push'); }
  }

  private ring() {
    this.bell.rungAgo = 0;
    const at = this.bell.pos.clone();
    this.waves.push({ at, radius: 0, hit: false });
    this.hooks.onWave(at);
  }

  /** La cloche part rouler dans la direction où il regarde (vers le joueur). */
  private push() {
    const b = this.bell;
    this.up.copy(b.pos).normalize();
    b.dir.copy(b.pos).sub(this.zombie.pos).addScaledVector(this.up, -b.pos.clone().sub(this.zombie.pos).dot(this.up)).normalize();
    this.pushed = true;
    b.rolling = true;
    b.rolled = 0;
    b.hit = false;
    this.hooks.onPush();
  }

  /** La cloche qui roule : elle suit le sol, s'arrête au bout de sa course ou contre le décor, et blesse le joueur qu'elle touche. */
  private updateBell(dt: number) {
    const b = this.bell, B = F.bell;
    if (!b.rolling) return;
    const step = B.rollSpeed * (this.phase === 2 ? F.phase2.rollMul : 1) * dt;
    this.up.copy(b.pos).normalize();
    // Le décor devant elle (à hauteur de son axe couché) l'arrête
    this.tmp.copy(b.pos).addScaledVector(this.up, B.radius).addScaledVector(b.dir, B.radius + step);
    if (b.rolled + step > B.rollDist || this.hooks.blocked(this.tmp, 0.2)) {
      b.rolling = false;
      this.hooks.onBellStop();
      return;
    }
    b.pos.addScaledVector(b.dir, step);
    b.pos.setLength(this.hooks.groundAt(b.pos));
    // Direction recalée dans le plan du sol (on tourne autour de la planète)
    this.up.copy(b.pos).normalize();
    b.dir.addScaledVector(this.up, -b.dir.dot(this.up)).normalize();
    b.rolled += step;
    b.spin += step / B.radius;
    if (this.zombie.dead || b.hit) return;
    const p = this.hooks.playerPos();
    if (p.angleTo(b.pos) * PLANET_RADIUS < B.radius + 0.5 && this.hooks.playerHeight() < B.radius * 1.4) {
      b.hit = true;
      this.hooks.hurtPlayer(this.away(p, b.pos), B.damage);
    }
  }

  /** Direction (au sol) de `from` vers le joueur. */
  private away(p: THREE.Vector3, from: THREE.Vector3) {
    const up = this.up.copy(p).normalize();
    const dir = p.clone().sub(from);
    dir.addScaledVector(up, -dir.dot(up));
    if (dir.lengthSq() < 1e-6) dir.copy(this.bell.dir);
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
