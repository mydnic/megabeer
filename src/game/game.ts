import * as THREE from 'three';
import { PLANET_RADIUS } from '../config/world';
import { ZOMBIE_ATTACK, type ZombieModel } from '../config/zombies';
import { ARRIVAL } from '../config/player';
import { DEATH } from '../config/buveur';
import { XP_DROPS } from '../config/xp';
import { LEVEL_UP_SCREEN } from '../config/upgrades';
import type { InputState } from '../core/input';
import { createHorde } from '../enemies/horde';
import type { Zombie, ZombieTimings } from '../enemies/zombie';
import { createXpDrops } from '../pickups/xpDrops';
import { PlayerController } from '../player/controller';
import { Health } from '../player/health';
import { Progression } from '../player/progression';
import type { DecorCollider } from '../world/decor/collider';
import type { ThrowRig, Weapon, WeaponContext, WeaponId } from '../weapons/weapon';
import { Emitter } from './emitter';
import { applyCard, rollCards, type Card } from './levelUpCards';
import { Loadout } from './loadout';
import { PlayerStats } from './playerStats';

export type Phase = 'home' | 'run' | 'dead';
export type Spawn = { dir: THREE.Vector3; facing: THREE.Vector3 };
export type RunEnd = 'mort' | 'abandon';

/** Tout ce que le noyau annonce. L'affichage, les sons, le HUD et le journal de run s'y abonnent. */
export type GameEvents = {
  /** Début de run : le joueur tombe du ciel vers `landing` (point au sol). */
  runStarted: { spawn: Spawn; landing: THREE.Vector3 };
  landed: { pos: THREE.Vector3 };
  zombieSpawned: { zombie: Zombie };
  /** Un zombie frappe le joueur ; `blocked` : ignoré (invulnérabilité ou godmode). */
  playerHurt: { zombie: Zombie; dir: THREE.Vector3; damage: number; hp: number; blocked: boolean };
  /** Un zombie encaisse un coup (arme null : coup sans arme, ex. outils de dev). */
  zombieHit: { weapon: Weapon | null; zombie: Zombie; damage: number; crit: boolean; killed: boolean; hpAfter: number; impact: THREE.Vector3; dir: THREE.Vector3 };
  projectileHitGround: { weapon: Weapon; pos: THREE.Vector3; vel: THREE.Vector3 };
  xpCollected: { amount: number };
  levelGained: { level: number };
  /** Cartes proposées ; `first` : premier écran d'une série (les suivantes s'enchaînent). */
  levelUpOffered: { level: number; cards: Card[]; first: boolean };
  cardPicked: { card: Card };
  paused: Record<string, never>;
  resumed: Record<string, never>;
  died: Record<string, never>;
  runEnded: { reason: RunEnd; survived: number; kills: number };
  /** Retour à l'accueil : tout est remis à zéro. */
  home: Record<string, never>;
  /** Fin d'un pas de jeu en run (le joueur a atterri), avec la durée de jeu écoulée. */
  tick: { dt: number };
};

export type GameDeps = {
  /** Durées d'animation des zombies (le coup porte à un moment de l'attaque). */
  zombieKinds: Record<ZombieModel, ZombieTimings>;
  /** Collisions du décor de la planète (vides dans les tests). */
  collider: DecorCollider;
  /** Arme de départ du perso. */
  startingWeapon?: WeaponId;
};

/** Aucune entrée : joueur immobile (accueil, mort, pause, chute d'arrivée). */
export const NO_INPUT: InputState = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, mouseDX: 0, mouseDY: 0, zoom: 0, jump: false, jumpPressed: false };

/** Pas de la physique du joueur (s). */
const STEP = 1 / 120;

/**
 * Le jeu, sans écran : phases (accueil, run, mort), arrivée du joueur, combat, XP, level-up et
 * pause. Il avance par `step(dt, input)` et annonce tout dans `events`. Aucune dépendance au
 * navigateur ni au rendu : il tourne tel quel dans les tests.
 */
export class Game {
  readonly events = new Emitter<GameEvents>();
  readonly player: PlayerController;
  readonly health = new Health();
  readonly progression = new Progression();
  readonly stats = new PlayerStats();
  readonly horde: ReturnType<typeof createHorde>;
  readonly xp: ReturnType<typeof createXpDrops>;
  readonly loadout: Loadout;
  /** Triches des outils de dev (toujours faux en jeu normal). */
  readonly cheats = { god: false };

  phase: Phase = 'home';
  /** Chute d'arrivée en cours : ni contrôle, ni tirs, ni chrono. */
  arriving = false;
  /** Menu pause ouvert. */
  menuPaused = false;
  /** Cartes de level-up proposées (null : pas d'écran de level-up). */
  offer: Card[] | null = null;
  /** Durée de la run (s de jeu, sans la chute d'arrivée ni les pauses), et zombies tués. */
  runTime = 0;
  kills = 0;
  /** Temps réel écoulé depuis la mort (-1 : vivant). */
  deadTime = -1;
  /** Ralenti des outils de dev (1 en jeu). */
  devTimeScale = 1;

  private acc = 0;
  private readonly weaponCtx: WeaponContext;
  private readonly tmp = new THREE.Vector3();
  private readonly chest = new THREE.Vector3();

  constructor(deps: GameDeps) {
    const player = new PlayerController(new THREE.Vector3(0, 1, 0));
    player.decor = deps.collider;
    this.player = player;
    const groundAt = (p: THREE.Vector3) => player.supportAt(p, p.length());
    this.horde = createHorde(deps.zombieKinds, player, deps.collider);
    this.horde.onHit = (z, dir) => this.hurtPlayer(z, dir);
    this.horde.onSpawn = (zombie) => this.events.emit('zombieSpawned', { zombie });
    this.xp = createXpDrops(groundAt);
    const self = this;
    this.weaponCtx = {
      zombies: () => this.horde.zombies,
      playerPos: () => player.pos,
      stats: this.stats,
      rig: defaultRig(player),
      groundAt,
      hitZombie: (weapon, z, damage, crit, impact, vel) => { self.hitZombie(z, damage, crit, impact, vel, weapon); },
      hitGround: (weapon, pos, vel) => this.events.emit('projectileHitGround', { weapon, pos, vel }),
    };
    this.loadout = new Loadout(this.weaponCtx, deps.startingWeapon ?? 'blonde');
  }

  /** Branche le geste de lancer du perso affiché (sinon : main devant le torse). */
  setThrowRig(rig: ThrowRig) { this.weaponCtx.rig = rig; }

  /** Le monde est figé (menu pause ou choix de carte). */
  get frozen() { return this.menuPaused || this.offer !== null; }

  // ------------------------------------------------------------------ cycle de la run

  /** Nouvelle run : le joueur tombe du ciel au point de départ. */
  startRun(spawn: Spawn) {
    if (this.phase !== 'home') return;
    this.resetRun();
    this.phase = 'run';
    this.player.reset(spawn.dir, spawn.facing);
    const landing = this.player.pos.clone();
    this.player.drop(ARRIVAL.height, ARRIVAL.speed);
    this.arriving = true;
    this.events.emit('runStarted', { spawn, landing });
  }

  /** Abandon depuis la pause : la run est perdue, retour à l'accueil. */
  abandon() {
    if (this.phase !== 'run') return;
    this.events.emit('runEnded', { reason: 'abandon', survived: this.runTime, kills: this.kills });
    this.goHome();
  }

  /** Retour à l'accueil (après la mort ou l'abandon) : tout est remis à zéro. */
  goHome() {
    this.phase = 'home';
    this.resetRun();
    this.events.emit('home', {});
  }

  pause() {
    if (this.phase !== 'run' || this.frozen) return false;
    this.menuPaused = true;
    this.events.emit('paused', {});
    return true;
  }

  resume() {
    if (!this.menuPaused) return;
    this.menuPaused = false;
    this.events.emit('resumed', {});
  }

  /** Choisit une des cartes proposées ; la suivante s'enchaîne s'il reste des degrés à choisir. */
  pickCard(card: Card) {
    if (!this.offer?.includes(card)) return;
    applyCard(card);
    this.progression.pending--;
    this.offer = null;
    this.events.emit('cardPicked', { card });
    if (this.progression.pending > 0) this.offerCards(false);
  }

  // ------------------------------------------------------------------ boucle

  /** Avance le jeu de `realDt` secondes réelles ; renvoie la durée de jeu écoulée (0 si figé). */
  step(realDt: number, input: InputState = NO_INPUT) {
    if (this.deadTime >= 0) this.deadTime += realDt;
    const frozen = this.frozen;
    const dt = frozen ? 0 : realDt * this.timeScale() * this.devTimeScale;
    const move = this.phase === 'run' && !frozen && !this.arriving ? input : NO_INPUT;
    if (this.phase === 'run' && !frozen && this.progression.pending > 0) this.offerCards(true);

    const p = this.player;
    p.feed(move);
    this.acc += dt;
    while (this.acc >= STEP) { p.step(STEP, move); this.acc -= STEP; }
    p.interpolate(this.acc / STEP);
    if (this.arriving && p.onGround) this.land();

    this.horde.update(dt);
    this.health.update(dt);
    if (this.phase === 'run' && this.health.dead) this.die();
    if (this.phase === 'run' && !this.arriving) {
      this.runTime += dt;
      this.loadout.update(dt);
      this.events.emit('tick', { dt });
    }
    this.loadout.updateProjectiles(dt);
    this.chest.copy(p.renderPos).addScaledVector(p.upDir, 1.0);
    this.xp.update(dt, this.chest, this.phase === 'run' ? this.stats.pickupRange : 0, (v) => this.collectXp(v * this.stats.xpGain));
    return dt;
  }

  // ------------------------------------------------------------------ combat et XP

  /** Fait apparaître un zombie au sol à la direction `at`, tourné vers `facing`. */
  spawnZombie(model: ZombieModel, at: THREE.Vector3, facing: THREE.Vector3) {
    return this.horde.spawn(model, at, facing);
  }

  /**
   * Un zombie encaisse un coup (venant de la vitesse `vel`, ramenée dans le plan du sol : il recule
   * dans ce sens). Mort : +1 kill et une goutte de bière. Renvoie true s'il meurt.
   */
  hitZombie(z: Zombie, damage: number, crit: boolean, impact: THREE.Vector3, vel: THREE.Vector3, weapon: Weapon | null = null) {
    const up = this.tmp.copy(z.pos).normalize();
    const dir = vel.clone().addScaledVector(up, -vel.dot(up)).normalize();
    const killed = z.damage(damage, dir);
    if (killed) {
      this.kills++;
      this.xp.drop(z.pos, XP_DROPS.perZombie);
    }
    this.events.emit('zombieHit', { weapon, zombie: z, damage, crit, killed, hpAfter: z.hp, impact: impact.clone(), dir });
    return killed;
  }

  /** Ajoute de l'XP (déjà multipliée par le gain) : les degrés gagnés ouvrent le level-up. */
  addXp(amount: number) {
    const gained = this.progression.add(amount);
    for (let i = 0; i < gained; i++) this.events.emit('levelGained', { level: this.progression.level - gained + 1 + i });
  }

  // ------------------------------------------------------------------ interne

  private collectXp(amount: number) {
    this.events.emit('xpCollected', { amount });
    this.addXp(amount);
  }

  private hurtPlayer(z: Zombie, dir: THREE.Vector3) {
    const damage = ZOMBIE_ATTACK.damage;
    // Invulnérable juste après un coup : ni dégâts ni recul (pas d'enchaînement de coups)
    const took = !this.cheats.god && this.health.damage(damage);
    this.events.emit('playerHurt', { zombie: z, dir, damage, hp: this.health.hp, blocked: !took });
    if (!took) return;
    this.player.knock(dir, ZOMBIE_ATTACK.knockSpeed, ZOMBIE_ATTACK.knockLift, ZOMBIE_ATTACK.knockDecay);
  }

  private offerCards(first: boolean) {
    const cards = rollCards(LEVEL_UP_SCREEN.cards, this.stats.luck, this.loadout.weapons);
    if (!cards.length) { this.progression.pending = 0; return; }
    this.offer = cards;
    const level = this.progression.level - this.progression.pending + 1;
    this.events.emit('levelUpOffered', { level, cards, first });
  }

  /** Atterrissage : les zombies de départ arrivent (provisoire, en attendant le spawn des vagues). */
  private land() {
    this.arriving = false;
    this.spawnStartZombies();
    this.events.emit('landed', { pos: this.player.pos.clone() });
  }

  private spawnStartZombies() {
    const p = this.player;
    const up = p.pos.clone().normalize();
    const fwd = p.facing.clone();
    const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
    const models: ZombieModel[] = ['basic', 'chubby', 'arm', 'ribcage'];
    models.forEach((m, i) => {
      const at = up.clone().multiplyScalar(PLANET_RADIUS).addScaledVector(fwd, 7 + (i % 2) * 1.5).addScaledVector(right, (i - 1.5) * 1.6);
      this.spawnZombie(m, at, fwd.clone().negate());
    });
  }

  private die() {
    this.phase = 'dead';
    this.deadTime = 0;
    this.horde.setPassive(true);
    this.events.emit('died', {});
    this.events.emit('runEnded', { reason: 'mort', survived: this.runTime, kills: this.kills });
  }

  /** Vitesse du temps : ralenti juste après la mort, puis retour progressif. */
  private timeScale() {
    if (this.deadTime < 0) return 1;
    const S = DEATH.slowMo;
    if (this.deadTime < S.hold) return S.scale;
    return THREE.MathUtils.lerp(S.scale, 1, Math.min(1, (this.deadTime - S.hold) / S.ramp));
  }

  private resetRun() {
    this.deadTime = -1;
    this.arriving = false;
    this.menuPaused = false;
    this.offer = null;
    this.runTime = 0;
    this.kills = 0;
    this.acc = 0;
    this.health.reset();
    this.progression.reset();
    this.stats.reset();
    this.loadout.reset();
    this.horde.clear();
    this.horde.setPassive(false);
    this.xp.clear();
  }
}

/** Geste par défaut (sans animation) : la bouteille part d'une main devant le torse. */
function defaultRig(player: PlayerController): ThrowRig {
  const up = new THREE.Vector3();
  return {
    gesture() {},
    handPos(out) {
      up.copy(player.pos).normalize();
      return out.copy(player.pos).addScaledVector(up, 1.3).addScaledVector(player.facing, 0.3);
    },
  };
}
