import * as THREE from 'three';
import { SPAWN } from '../config/spawn';
import { ENEMIES, type EnemyDef, type EnemyId } from '../config/enemies';
import { ZOMBIE_ATTACK, ZOMBIE_HURT as H, ZOMBIE_MODELS, ZOMBIE_MOVE, ZOMBIE_VISUAL as V } from '../config/zombies';

export type ZombieState = 'idle' | 'walk' | 'attack' | 'hit' | 'death' | 'cast';
export const ZOMBIE_STATES = Object.keys(V.clips) as ZombieState[];
/** Animations jouées une seule fois (elles restent sur leur dernière image : le bras reste tendu). */
const ONCE: ZombieState[] = ['hit', 'death', 'cast'];

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
  /** Brique Fantôme : horloge de son cycle (s), décalée au hasard pour qu'ils ne clignotent pas ensemble. */
  ghostClock = 0;
  /** Dégâts déjà en route vers lui (projectiles en vol qui le visent) : au-delà de ses PV, les armes visent ailleurs. */
  incoming = 0;
  /** Sonné par une synergie (Black and Tan) : temps restant (s). Il ne l'arrête pas, c'est une marque. */
  dazed = 0;
  /** Ralenti (Seau à glace) : multiplicateur de vitesse et temps restant (s). */
  slowMul = 1;
  slowTime = 0;
  /** Gelé ou étourdi (Glaçons, Sifflet) : temps restant (s) ; il ne bouge ni ne frappe, son animation s'arrête. */
  frozen = 0;
  /** Brique Invocateur : temps avant la prochaine invocation (s), et temps restant du geste en cours (s). */
  summonTimer = 0;
  casting = 0;
  /** Sortie de terre en cours (s restantes) : il émerge du sol, immobile, sans frapper. */
  rise = 0;
  /** Rayon du sol sous ses pieds au dernier sondage (0 : pas encore sondé) ; la horde ne le resonde qu'une image sur deux. */
  groundR = 0;
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

  /** Fiche de l'ennemi (PV, vitesse, dégâts, XP, briques) et modèle 3D affiché. */
  readonly def: EnemyDef;
  readonly model: EnemyDef['model'];

  constructor(readonly kind: ZombieTimings, readonly enemy: EnemyId) {
    this.def = ENEMIES[enemy];
    this.model = this.def.model;
    this.hp = ENEMIES[enemy].hp;
    const T = (ENEMIES[enemy] as EnemyDef).thrower;
    if (T) this.throwTimer = Math.random() * T.firstDelay;
    const G = (ENEMIES[enemy] as EnemyDef).ghost;
    if (G) this.ghostClock = Math.random() * G.every;
    const S = (ENEMIES[enemy] as EnemyDef).summoner;
    if (S) this.summonTimer = S.firstDelay;
  }

  /** Disparaît d'un coup, sans animation de mort ni corps (un kamikaze qui explose). */
  vanish() {
    if (this.deadTime < 0) this.deadTime = 0;
    this.fuse = -1;
    this.gone = true;
  }

  /** Brique Fantôme : intouchable en ce moment (les coups le traversent). */
  get intangible() {
    const G = this.def.ghost;
    return !!G && !this.dead && this.ghostClock % G.every < G.intangible;
  }
  /** Peut être visé et touché par les armes. */
  get targetable() { return !this.dead && !this.intangible; }


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
   * Encaisse un coup venant de la direction dir (tangente, du tireur vers le zombie), avec un recul
   * multiplié par `knock` (armes lourdes). Renvoie true si le coup le tue.
   */
  damage(amount: number, dir: THREE.Vector3, knock = 1) {
    if (this.dead) return false;
    this.hp -= amount;
    this.flash = 1;
    const killed = this.hp <= 0;
    this.knockVel.copy(dir).multiplyScalar(H.knockSpeed * knock * (killed ? H.deathKnock : 1));
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
    this.time += dt * rate * (this.frozen > 0 ? 0 : 1);
    this.prevTime += dt * this.animSpeed;
    this.fade = Math.min(1, this.fade + dt / V.fade);
    this.stateTime += dt;
    this.flash = Math.max(0, this.flash - dt / H.flashTime);
    this.stagger = Math.max(0, this.stagger - dt);
    this.throwTimer = Math.max(0, this.throwTimer - dt);
    this.summonTimer = Math.max(0, this.summonTimer - dt);
    this.dazed = Math.max(0, this.dazed - dt);
    this.frozen = Math.max(0, this.frozen - dt);
    if ((this.slowTime = Math.max(0, this.slowTime - dt)) === 0) this.slowMul = 1;
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
