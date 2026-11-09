import * as THREE from 'three';
import { SPAWN } from '../config/spawn';
import { ENEMIES, type EnemyDef, type EnemyId } from '../config/enemies';
import { ZOMBIE_ATTACK, ZOMBIE_HURT as H, ZOMBIE_MODELS, ZOMBIE_MOVE, ZOMBIE_VISUAL as V, type ZombieModel } from '../config/zombies';

export type ZombieState = 'idle' | 'walk' | 'attack' | 'hit' | 'death';
export const ZOMBIE_STATES = Object.keys(V.clips) as ZombieState[];
/** Animations jouées une seule fois (elles restent sur leur dernière image). */
const ONCE: ZombieState[] = ['hit', 'death'];

/** Une animation pré-calculée : première ligne dans la texture, nombre d'images, durée (s). */
export type BakedClip = { start: number; frames: number; duration: number };

/**
 * Ce dont la simulation a besoin d'un modèle : la durée de ses animations (le coup porte à un moment
 * de l'attaque, le corps reste couché le temps de la mort) et sa taille. Les tests en fournissent
 * des fausses ; le jeu les lit dans les modèles (zombieLibrary.ts).
 */
export type ZombieTimings = { scale: number; clips: Record<ZombieState, BakedClip> };
/**
 * Un zombie : état de simulation et d'animation. Son rendu est fait par la foule (horde), qui lit
 * `animRows()` pour la carte graphique.
 */
export class Zombie {
  /** Position (pieds) et direction du regard, dans le repère du monde. */
  readonly pos = new THREE.Vector3();
  readonly facing = new THREE.Vector3();
  state: ZombieState = 'idle';
  /** Multiplicateur de vitesse propre à ce zombie (ils ne marchent pas tous pareil). */
  readonly speedMul = 1 + (Math.random() * 2 - 1) * ZOMBIE_MOVE.speedJitter;
  /** Contournement d'obstacle en cours : temps restant et côté. */
  detour = 0;
  detourSide = 1;
  /** Vitesse réelle au dernier pas (cale la cadence de l'animation de marche). */
  walkSpeed = 0;
  /** Vrai pendant la frame où le coup arrive (le bras touche la cible). */
  hitNow = false;
  /** Vrai quand le coup en cours est allé au bout de son animation (il peut changer d'état). */
  attackDone = true;
  /** Temps passé dans l'état courant (évite les allers-retours marche / arrêt). */
  stateTime = 0;
  /** Points de vie ; à 0, il meurt (animation, puis le corps s'enfonce dans le sol). */
  hp: number;
  /** Recul subi (tangent), qui s'amortit. */
  readonly knockVel = new THREE.Vector3();
  /** Flash blanc restant (0 à 1). */
  flash = 0;
  /** Temps restant de réaction au coup (n'avance ni ne frappe). */
  stagger = 0;
  /** Mort : temps écoulé depuis la mort, et enfoncement actuel dans le sol (m). */
  deadTime = -1;
  sink = 0;
  /** Brique Tireur : temps avant le prochain lancer (s), et lancer en cours (le geste d'attaque lâche la bouteille). */
  throwTimer = 0;
  throwing = false;
  /** Brique Kamikaze : mèche allumée (s restantes, -1 : éteinte). */
  fuse = -1;
  /** Brique Chargeur : phase (élan, charge, sonné), temps restant de la phase, délai avant la suivante (s). */
  charge: 'none' | 'windup' | 'charge' | 'recover' = 'none';
  chargeTimer = 0;
  chargeCooldown = 0;
  /** Ligne de la charge : départ et direction (tangente au sol), distance restante (m), joueur déjà renversé. */
  readonly chargeFrom = new THREE.Vector3();
  readonly chargeDir = new THREE.Vector3();
  chargeLeft = 0;
  chargeHit = false;
  /** Son tonneau : dans les bras, qui roule devant lui, posé au bout de la ligne, ou éclaté. */
  barrel: 'held' | 'rolling' | 'resting' | 'broken' = 'held';
  /** Position du tonneau hors des bras (au sol), et distance qu'il a roulé (m). */
  readonly barrelPos = new THREE.Vector3();
  barrelTravel = 0;
  /** Sortie de terre en cours (s restantes) : il émerge du sol, immobile, sans frapper. */
  rise = 0;
  /** Vrai quand le corps a fini de s'enfoncer : la horde le retire. */
  gone = false;
  get dead() { return this.deadTime >= 0; }
  private animSpeed = 1 + (Math.random() * 2 - 1) * V.animJitter;
  /** Temps dans l'animation courante, et dans la précédente (fondu). */
  private time = Math.random() * 3;
  private prevState: ZombieState = 'idle';
  private prevTime = 0;
  private fade = 1;
  private up = new THREE.Vector3();
  private tmp = new THREE.Vector3();

  /**
   * `kind` : durées d'animation de son modèle ; `emptyKind` : celles du modèle mains vides
   * (chargeur sans tonneau dans les bras).
   */
  constructor(private readonly baseKind: ZombieTimings, readonly enemy: EnemyId, private readonly emptyKind?: ZombieTimings) {
    this.hp = ENEMIES[enemy].hp;
    const T = (ENEMIES[enemy] as EnemyDef).thrower;
    if (T) this.throwTimer = Math.random() * T.firstDelay;
  }

  /** Disparaît d'un coup, sans animation de mort ni corps (un kamikaze qui explose). */
  vanish() {
    if (this.deadTime < 0) this.deadTime = 0;
    this.fuse = -1;
    this.gone = true;
  }

  /** Fiche de l'ennemi (PV, vitesse, dégâts, XP, briques). */
  get def(): EnemyDef { return ENEMIES[this.enemy]; }
  /** Le tonneau n'est pas dans ses bras : il est affiché mains vides. */
  private get emptyHanded() { return !!this.def.charger && this.barrel !== 'held'; }
  /** Modèle 3D affiché. */
  get model(): ZombieModel { return this.emptyHanded ? this.def.charger!.emptyModel : ENEMIES[this.enemy].model; }
  /** Durées d'animation du modèle affiché. */
  get kind(): ZombieTimings { return this.emptyHanded && this.emptyKind ? this.emptyKind : this.baseKind; }

  play(state: ZombieState, force = false) {
    if (this.state === state && !force) return;
    if (this.dead && state !== 'death') return; // un mort ne se relève pas
    this.prevState = this.state;
    this.prevTime = this.time;
    this.fade = 0;
    this.state = state;
    this.time = 0;
    this.stateTime = 0;
    if (state === 'attack') this.attackDone = false;
  }

  /** Sort de terre à sa position actuelle (apparition d'une vague). */
  emerge() {
    this.rise = SPAWN.riseTime;
    this.sink = SPAWN.riseDepth;
    this.play('idle', true);
  }

  /**
   * Encaisse un coup venant de la direction dir (tangente, du tireur vers le zombie).
   * Renvoie true si le coup le tue.
   */
  damage(amount: number, dir: THREE.Vector3) {
    if (this.dead) return false;
    this.hp -= amount;
    this.flash = 1;
    const killed = this.hp <= 0;
    this.knockVel.copy(dir).multiplyScalar(H.knockSpeed * (killed ? H.deathKnock : 1));
    if (killed) {
      this.deadTime = 0;
      this.play('death');
    } else {
      this.stagger = H.stagger;
      this.play('hit', true); // relancée même s'il était déjà en train de réagir
    }
    return killed;
  }

  /** Tourne progressivement vers une cible, dans le plan tangent. */
  turnToward(target: THREE.Vector3, dt: number) {
    const up = this.up.copy(this.pos).normalize();
    const want = this.tmp.subVectors(target, this.pos);
    want.addScaledVector(up, -want.dot(up));
    if (want.lengthSq() < 1e-6) return;
    want.normalize();
    // Dos tourné pile à la cible : le mélange des deux directions s'annulerait, il pivote d'abord sur le côté
    if (this.facing.dot(want) < -0.999) this.facing.cross(up).normalize();
    const k = 1 - Math.exp(-V.turnRate * dt);
    this.facing.lerp(want, k).addScaledVector(up, -this.facing.dot(up)).normalize();
  }

  update(dt: number) {
    // Cadence des pas calée sur la vitesse réelle : les pieds ne patinent pas
    const animAt = (ZOMBIE_MODELS[this.model] as { walkAnimAt?: number }).walkAnimAt ?? ZOMBIE_MOVE.walkAnimAt;
    const rate = this.state === 'walk' ? THREE.MathUtils.clamp(this.walkSpeed / animAt, 0.3, V.maxWalkRate) : this.animSpeed;
    const c = this.kind.clips[this.state];
    const before = (this.time % c.duration) / c.duration;
    this.time += dt * rate;
    this.prevTime += dt * this.animSpeed;
    this.fade = Math.min(1, this.fade + dt / V.fade);
    this.stateTime += dt;
    this.flash = Math.max(0, this.flash - dt / H.flashTime);
    this.stagger = Math.max(0, this.stagger - dt);
    this.throwTimer = Math.max(0, this.throwTimer - dt);
    if (this.rise > 0 && !this.dead) {
      this.rise = Math.max(0, this.rise - dt);
      this.sink = (this.rise / SPAWN.riseTime) ** 2 * SPAWN.riseDepth;
    }
    // Mort : couché le temps de l'animation et un peu plus, puis il s'enfonce dans le sol
    if (this.dead) {
      this.deadTime += dt;
      const lie = c.duration + H.corpseTime;
      if (this.deadTime > lie) {
        this.sink = Math.min(1, (this.deadTime - lie) / H.sinkTime) * H.sinkDepth;
        if (this.deadTime > lie + H.sinkTime) this.gone = true;
      }
    }
    // Moment du coup : passage de la phase de l'attaque sur hitAt ; fin de cycle = coup terminé
    this.hitNow = false;
    if (this.state === 'attack') {
      const after = (this.time % c.duration) / c.duration;
      const h = ZOMBIE_ATTACK.hitAt;
      const wrapped = after < before;
      if ((before < h && after >= h) || (wrapped && (after >= h || before < h))) this.hitNow = true;
      if (wrapped) this.attackDone = true;
    }
  }

  private row(state: ZombieState, t: number) {
    const c = this.kind.clips[state];
    const f = Math.floor((t / c.duration) * c.frames);
    return c.start + (ONCE.includes(state) ? Math.min(f, c.frames - 1) : f % c.frames);
  }

  /** (ligne A, ligne B, mélange) pour le shader : fondu de l'animation précédente vers la courante. */
  animRows(out: Float32Array, o: number) {
    const cur = this.row(this.state, this.time);
    if (this.fade >= 1) { out[o] = cur; out[o + 1] = cur; out[o + 2] = 0; }
    else { out[o] = this.row(this.prevState, this.prevTime); out[o + 1] = cur; out[o + 2] = this.fade; }
    out[o + 3] = -this.flash; // négatif ou nul : instance de foule (voir render/vat.ts), valeur = flash blanc
  }
}
