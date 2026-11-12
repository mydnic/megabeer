import * as THREE from 'three';
import { DIFFICULTIES, type DifficultyId } from '../config/spawn';
import { ENEMIES, ROSTERS, type EnemyId } from '../config/enemies';
import { ZOMBIE_ATTACK, type ZombieModel } from '../config/zombies';
import { ARRIVAL } from '../config/player';
import { DEATH } from '../config/buveur';
import { LEVEL_UP_SCREEN, RARITIES } from '../config/upgrades';
import type { InputState } from '../core/input';
import { createHorde } from '../enemies/horde';
import type { Zombie, ZombieTimings } from '../enemies/zombie';
import { createXpDrops } from '../pickups/xpDrops';
import { COIN_DROPS, COINS } from '../config/coins';
import { createEnemyShots, type EnemyShot } from '../enemies/enemyShots';
import { PLANET_RADIUS } from '../config/world';
import { PlayerController } from '../player/controller';
import { Health } from '../player/health';
import { Progression } from '../player/progression';
import type { DecorCollider } from '../world/decor/collider';
import type { ThrowRig, Weapon, WeaponContext, WeaponId } from '../weapons/weapon';
import { Emitter } from './emitter';
import { applyCard, rollCards, type Card } from './levelUpCards';
import { WEAPON_FACTORIES } from '../weapons/registry';
import { SYNERGIES } from '../config/weapons';
import { activeSynergies, synergiesCompletedBy, type SynergyId } from './synergies';
import { Pumps, rollStatCards, type Pump } from './pumps';
import { Chests, rollItemCards, type Chest } from './chests';
import { CHEST_TRAP, CHESTS } from '../config/chests';
import { Bins, type Bin } from './bins';
import { LastCall, bellDropChance, type CallBell } from './lastCall';
import { BELL_DROPS, LAST_CALL } from '../config/lastCall';
import { Tournees, TOURNEE_IDS, rollTournee, tourneeDropChance } from './tournees';
import { TOURNEE_FX, TOURNEES, type TourneeId } from '../config/tournees';
import { ELITES } from '../config/elites';
import { ABBE, FRERE_SONNEUR, PATRON_DOOR } from '../config/bosses';
import { FrereSonneur } from './frereSonneur';
import { Abbe, type WinePuddle } from './abbe';
import type { Boss } from './boss';
import { PatronDoor } from './patronDoor';
import { BINS, SNACK, SNACK_DROPS } from '../config/bins';
import { ITEMS, ITEM_EFFECTS, ITEM_STAT_CAPS, type ItemDef, type ItemId, type ItemStatId } from '../config/items';
import { ItemEffects } from './itemEffects';
import { rollTier } from './levelUpCards';
import { PUMPS } from '../config/pumps';
import { BASE_SPEED } from '../config/world';
import { PLAYER_STATS } from '../config/player';
import { Loadout } from './loadout';
import { PlayerStats } from './playerStats';
import { SpawnDirector, spawnCurveAt } from './spawnDirector';
import { MAP_MECHANICS, type MapId, type MapMechanic } from './mechanics/mechanic';

export type Phase = 'home' | 'run' | 'dead';
export type Spawn = { dir: THREE.Vector3; facing: THREE.Vector3 };
export type RunEnd = 'mort' | 'abandon' | 'victoire';
/** Ce que lâche une poubelle cassée. */
export type BinLoot = 'xp' | 'coins' | 'snack';

/** Tout ce que le noyau annonce. L'affichage, les sons, le HUD et le journal de run s'y abonnent. */
export type GameEvents = {
  /** Début de run : le joueur tombe du ciel vers `landing` (point au sol). */
  runStarted: { spawn: Spawn; landing: THREE.Vector3 };
  landed: { pos: THREE.Vector3 };
  zombieSpawned: { zombie: Zombie };
  /** Le joueur encaisse un coup (d'un zombie, ou null : un piège) ; `blocked` : ignoré (invulnérabilité ou godmode). */
  playerHurt: { zombie: Zombie | null; dir: THREE.Vector3; damage: number; hp: number; blocked: boolean };
  /** Un zombie encaisse un coup (arme null : coup sans arme, ex. outils de dev). */
  /** `combo` : dégâts multipliés par une synergie (une canette sur un zombie sonné par la Stout). */
  zombieHit: { weapon: Weapon | null; zombie: Zombie; damage: number; crit: boolean; killed: boolean; hpAfter: number; impact: THREE.Vector3; dir: THREE.Vector3; shielded: boolean; combo: boolean };
  projectileHitGround: { weapon: Weapon; pos: THREE.Vector3; vel: THREE.Vector3 };
  xpCollected: { amount: number };
  /** Capsules ramassées : `amount` gagnées, `total` en poche. */
  coinsCollected: { amount: number; total: number };
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
  /** Un ennemi tireur lâche un projectile (son point d'impact au sol est `shot.to`). */
  enemyThrow: { shot: EnemyShot };
  /** Un projectile ennemi touche le sol ; `hit` : le joueur était dans la zone. */
  enemyShotLanded: { shot: EnemyShot; hit: boolean };
  /** Un kamikaze allume sa mèche : il explosera dans `fuse` s, dans un rayon `radius` autour de `at`. */
  kamikazeArmed: { zombie: Zombie; at: THREE.Vector3; radius: number; fuse: number };
  /** Un kamikaze explose à `at` ; `killed` : tué par le joueur (sinon, au bout de sa mèche) ; `hit` : le joueur était dans la zone. */
  enemyExploded: { zombie: Zombie; at: THREE.Vector3; radius: number; killed: boolean; hit: boolean };
  /** Un invocateur commence son geste : ses invoqués sortiront de terre à la fin. */
  summonCast: { zombie: Zombie };
  /** Les invoqués de `zombie` sortent de terre autour de lui. */
  summoned: { zombie: Zombie; skeletons: Zombie[] };
  /** Une arme du joueur explose en `pos` (la Gueuze) ; elle ne blesse jamais le joueur. */
  weaponExploded: { weapon: Weapon; pos: THREE.Vector3; radius: number };
  /** Une pompe à bière est pleine : le jeu se fige et propose ses bonus de stat. */
  pumpFilled: { pump: Pump; cards: Card[] };
  /** Un bonus de stat est appliqué (pompe à bière, objet). */
  statGained: { stat: ItemStatId; value: number };
  /** Coffre payé : sa rareté se révèle pendant `duration` s (jeu figé), avant l'écran de choix. */
  chestRevealing: { chest: Chest; rarity: number; duration: number };
  /** Coffre ouvert (payé `price`) : sa rareté et les objets proposés. */
  chestOpened: { chest: Chest; price: number; rarity: number; cards: Card[] };
  /**
   * Coffre piégé payé : il explose en `at` (rayon `radius`, `hit` : le joueur était dedans) et libère
   * des ennemis (`zombies`). Pas d'objet.
   */
  chestTrapped: { chest: Chest; price: number; at: THREE.Vector3; radius: number; hit: boolean; zombies: Zombie[] };
  /** Une poubelle se casse (`by` : le joueur au contact ou une arme) et lâche son butin. */
  binBroken: { bin: Bin; by: 'player' | 'weapon'; loot: BinLoot };
  /**
   * Dernier service : une cloche sonne (`source` : une grande cloche de la planète, ou une clochette
   * ramassée) ; `pulled` gouttes et capsules partent vers le Buveur.
   */
  lastCallRung: { source: 'bell' | 'drop'; at: THREE.Vector3; bell: CallBell | null; pulled: number };
  /** Un boss arrive (il sort de terre). */
  bossSpawned: { boss: Boss };
  /** Le boss frappe sa cloche (il est en `at`) : une onde part. */
  bossWave: { boss: FrereSonneur; at: THREE.Vector3 };
  /** Le boss change de phase (il rugit). */
  bossPhase: { boss: Boss; phase: number };
  /** Un boss est tué : le Frère Sonneur laisse un coffre gratuit de haute rareté ; l'Abbé, c'est la victoire. */
  bossKilled: { boss: Boss; chest: Chest | null };
  /** L'Abbé répand son vin : des flaques sont posées. */
  winePoured: { boss: Abbe; puddles: readonly WinePuddle[] };
  /** La Porte du patron s'ouvre : le boss final en sort. */
  doorOpened: { at: THREE.Vector3 };
  /** Touche d'action devant la porte alors qu'un boss est déjà là. */
  doorBusy: Record<string, never>;
  /** Le boss final est tombé : la run est gagnée (le jeu se fige sur l'écran de victoire). */
  victory: { survived: number; kills: number };
  /** Un élite arrive dans la horde. */
  eliteSpawned: { zombie: Zombie };
  /** Un élite est tué : il laisse un coffre gratuit (null s'il n'y avait plus de place). */
  eliteKilled: { zombie: Zombie; chest: Chest | null };
  /** Tournée du bar ramassée (`duration` : 0 si son effet est immédiat). */
  tourneeTaken: { id: TourneeId; duration: number };
  /** Fin d'une tournée qui durait. */
  tourneeEnded: { id: TourneeId };
  /** Le joueur ramasse un snack : `heal` PV rendus, `hp` après. */
  snackEaten: { heal: number; hp: number };
  /** Touche d'action sur un coffre sans assez de capsules. */
  chestDenied: { chest: Chest; price: number; coins: number };
  /** Objet pris dans un coffre. */
  itemGained: { item: ItemId; rarity: number; mult: number };
  /** Glaçons ou Sifflet : un ennemi gèle (ou est étourdi) `time` s. */
  zombieFrozen: { zombie: Zombie; time: number };
  /** Démarche de pochtron : le joueur esquive le coup de `zombie` (null : un piège). */
  playerDodged: { zombie: Zombie | null };
  /** Sifflet d'arbitre : les ennemis à moins de `radius` m de `at` sont étourdis. */
  whistleBlown: { at: THREE.Vector3; radius: number };
  /** Juke-box (niveau gagné) ou Seconde tournée : une onde repousse les ennemis autour de `at`. */
  shockwave: { at: THREE.Vector3; radius: number };
  /** Seconde tournée : le joueur revient à la vie avec `hp` PV. */
  revived: { hp: number };
  /** Bonnet du Père Noël : un coffre gratuit apparaît. */
  freeChestSpawned: { chest: Chest };
  /** Cendrier : un ennemi tué explose en `at` (blesse les ennemis dans `radius`, jamais le joueur). */
  itemExploded: { zombie: Zombie; at: THREE.Vector3; radius: number };
  /** Mousse épaisse : le bouclier est prêt. */
  foamShieldUp: Record<string, never>;
  /** Mousse épaisse : le bouclier absorbe un coup de `zombie` (null : un piège). */
  foamShieldPopped: { zombie: Zombie | null };
  /** Happy hour : vitesse d'attaque multipliée pendant `duration` s. */
  happyHourStarted: { duration: number };
  happyHourEnded: Record<string, never>;
  /** Une synergie s'active : toutes ses armes sont maintenant équipées. */
  synergyActivated: { id: SynergyId };
  /** Un diviseur tué se sépare : `children` sortent de son corps. */
  enemySplit: { zombie: Zombie; children: Zombie[] };
  /** Abbaye : un coup de cloche de volée, après le grand coup du débarquement. */
  bellToll: { index: number };
  /** Abbaye, toutes les 2 min : les cloches sonnent et, pendant `duration` s, des zombies de type `model` sortent de terre en masse autour du joueur. */
  bellsLanding: { duration: number; enemy: EnemyId };
  /** Fin du débarquement, `count` zombies sont sortis de terre. */
  bellsSurgeEnded: { count: number };
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
  /** Map jouée (sa mécanique propre). */
  map?: MapId;
  /** Tirage « cet ennemi tué lâche une capsule au lieu de l'XP » (par défaut : la chance de la config). */
  rollCoin?: () => boolean;
  /** Hasard des effets d'objets et du butin des poubelles (0 à 1, par défaut Math.random). */
  random?: () => number;
  /** Tirage « cet ennemi tué lâche une clochette » (par défaut : la chance de la config et la Chance du joueur). */
  rollBell?: () => boolean;
  /** Tirage « cet ennemi tué lâche une tournée » : laquelle, ou null (par défaut : chance de la config et Chance du joueur). */
  rollTournee?: () => TourneeId | null;
  /** Poubelles posées par run (par défaut celles de la config ; 0 dans la plupart des tests). */
  binCount?: number;
  /** Chance qu'un coffre soit piégé (par défaut celle de la config). */
  trapChance?: number;
};

/** Aucune entrée : joueur immobile (accueil, mort, pause, chute d'arrivée). */
export const NO_INPUT: InputState = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, mouseDX: 0, mouseDY: 0, zoom: 0, jump: false, jumpPressed: false, action: false, actionPressed: false };

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
  /** Pompes à bière de la run (exploration). */
  readonly pumps: Pumps;
  readonly chests: Chests;
  /** Poubelles de la run (exploration). */
  readonly bins = new Bins();
  /** Grandes cloches du Dernier service, et clochettes au sol. */
  readonly lastCall: LastCall;
  readonly bellDrops: ReturnType<typeof createXpDrops>;
  private rollBell: () => boolean;
  /** Boss en cours (null : aucun) ; `bossDone` : le boss de mi-run est déjà venu. */
  boss: Boss | null = null;
  /** La Porte du patron de la run ; `won` : le boss final est tombé (jeu figé sur la victoire). */
  readonly door: PatronDoor;
  won = false;
  private bossDone = false;
  /** Tournées du bar (bonus lâchés par les ennemis). */
  readonly tournees: Tournees;
  private rollTournee: () => TourneeId | null;
  private readonly ended: TourneeId[] = [];
  /** Snacks au sol (soin). */
  readonly snackDrops: ReturnType<typeof createXpDrops>;
  private readonly binCount: number;
  private readonly trapChance: number;
  private readonly binsHit: Bin[] = [];
  /** Objets pris pendant la run (dans l'ordre). */
  readonly items: { item: ItemId; rarity: number }[] = [];
  /** Effets spéciaux des objets pris (Cendrier, Mousse épaisse...). */
  readonly effects = new ItemEffects();
  private random: () => number;
  readonly xp: ReturnType<typeof createXpDrops>;
  /** Capsules (Pièces) au sol. */
  readonly coinDrops: ReturnType<typeof createXpDrops>;
  /** Pièces en poche (monnaie de la run, perdue à la fin). */
  coins = 0;
  /** Fraction de capsule gagnée en plus (Porte-monnaie), pas encore entière. */
  private coinFrac = 0;
  private rollCoin: () => boolean;
  /** Projectiles des ennemis tireurs en vol. */
  readonly shots = createEnemyShots();
  readonly loadout: Loadout;
  /** Arrivée des zombies et montée en difficulté au fil de la run. */
  readonly director: SpawnDirector;
  /** Mécanique propre à la map (Abbaye : les cloches). */
  readonly mechanic: MapMechanic;
  /** Triches des outils de dev (toujours faux en jeu normal). */
  readonly cheats = { god: false };
  /** Zombies proches du joueur (réserve réutilisée par les effets d'objets). */
  private readonly around: Zombie[] = [];

  phase: Phase = 'home';
  /** Difficulté de la run (Sobre / Pompette / Bourré). */
  difficulty: DifficultyId = 'sobre';
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
  private readonly groundAt: (p: THREE.Vector3) => number;
  private readonly weaponCtx: WeaponContext;
  private readonly tmp = new THREE.Vector3();
  private readonly chest = new THREE.Vector3();

  constructor(deps: GameDeps) {
    const player = new PlayerController(new THREE.Vector3(0, 1, 0));
    player.decor = deps.collider;
    this.player = player;
    const groundAt = (p: THREE.Vector3) => player.supportAt(p, p.length());
    this.groundAt = groundAt;
    // Le boss est dessiné à part : ses durées d'animation viennent de sa config
    const C = FRERE_SONNEUR.clips;
    const clip = (duration: number) => ({ start: 0, frames: 1, duration });
    const AC = ABBE.clips;
    const kinds = {
      ...deps.zombieKinds,
      sonneur: deps.zombieKinds.sonneur ?? { scale: 1, clips: { idle: clip(C.idle), walk: clip(C.walk), attack: clip(C.strike), hit: clip(C.hit), death: clip(C.death), cast: clip(C.roar) } },
      abbe: deps.zombieKinds.abbe ?? { scale: 1, clips: { idle: clip(AC.idle), walk: clip(AC.walk), attack: clip(AC.cast), hit: clip(AC.hit), death: clip(AC.death), cast: clip(AC.roar) } },
    };
    this.horde = createHorde(kinds, player, deps.collider);
    this.pumps = new Pumps(deps.collider);
    this.chests = new Chests(deps.collider);
    this.door = new PatronDoor(deps.collider);
    this.horde.onHit = (z, dir) => this.hurtPlayer(z, dir, this.damageOf(z, z.def.damage));
    this.horde.onThrow = (z) => this.throwFrom(z);
    this.horde.onArm = (z) => {
      const K = z.def.kamikaze!;
      this.events.emit('kamikazeArmed', { zombie: z, at: z.pos.clone(), radius: K.radius, fuse: K.fuse });
    };
    this.horde.onExplode = (z) => this.explode(z, false);
    this.horde.onCast = (zombie) => this.events.emit('summonCast', { zombie });
    this.horde.onSummon = (z) => this.summonAround(z);
    this.horde.onSpawn = (zombie) => this.events.emit('zombieSpawned', { zombie });
    this.xp = createXpDrops(groundAt);
    this.coinDrops = createXpDrops(groundAt, COIN_DROPS);
    this.snackDrops = createXpDrops(groundAt, SNACK_DROPS);
    this.bellDrops = createXpDrops(groundAt, BELL_DROPS);
    this.lastCall = new LastCall(deps.collider);
    this.tournees = new Tournees(groundAt);
    this.rollTournee = deps.rollTournee ?? (() => (Math.random() < tourneeDropChance(this.stats.luck) ? rollTournee(Math.random()) : null));
    this.rollBell = deps.rollBell ?? (() => Math.random() < bellDropChance(this.stats.luck));
    this.binCount = deps.binCount ?? BINS.count;
    this.trapChance = deps.trapChance ?? CHEST_TRAP.chance;
    this.rollCoin = deps.rollCoin ?? (() => Math.random() < COINS.dropChance);
    this.random = deps.random ?? Math.random;
    this.director = new SpawnDirector({
      player, collider: deps.collider, zombies: () => this.horde.zombies,
      roster: ROSTERS[deps.map ?? 'abbaye'],
      spawn: (enemy, at, facing) => {
        const z = this.spawnZombie(enemy, at, facing);
        z?.emerge();
        return z;
      },
      spawnElite: (enemy, at, facing) => {
        const z = this.spawnElite(enemy, at, facing);
        z?.emerge();
        return z;
      },
    });
    const self = this;
    this.weaponCtx = {
      zombies: () => this.horde.zombies,
      zombiesNear: (p, r, out) => this.horde.near(p, r, out),
      playerPos: () => player.pos,
      stats: this.stats,
      rig: defaultRig(player),
      groundAt,
      hitZombie: (weapon, z, damage, crit, impact, vel, knock) => { self.hitZombie(z, damage, crit, impact, vel, weapon, knock); },
      hitGround: (weapon, pos, vel) => {
        const bin = this.bins.at(pos);
        if (bin) this.breakBin(bin, 'weapon');
        this.events.emit('projectileHitGround', { weapon, pos, vel });
      },
      blocked: (p, margin) => deps.collider.occupied(p, margin),
      explode: (weapon, pos, radius) => {
        this.events.emit('weaponExploded', { weapon, pos: pos.clone(), radius });
        for (const bin of this.bins.within(pos, radius, this.binsHit)) this.breakBin(bin, 'weapon');
      },
    };
    this.loadout = new Loadout(this.weaponCtx, deps.startingWeapon ?? 'canette');
    this.mechanic = MAP_MECHANICS[deps.map ?? 'abbaye'](this);
  }

  /** Branche le geste de lancer du perso affiché (sinon : main devant le torse). */
  setThrowRig(rig: ThrowRig) { this.weaponCtx.rig = rig; }

  /** Le monde est figé (menu pause ou choix de carte). */
  get frozen() { return this.menuPaused || this.offer !== null || this.reveal !== null || this.won; }
  /** Coffre en train de révéler sa rareté (temps restant, s). */
  private reveal: { chest: Chest; price: number; rarity: number; cards: Card[]; left: number } | null = null;

  // ------------------------------------------------------------------ cycle de la run

  /** Nouvelle run : le joueur tombe du ciel au point de départ. */
  startRun(spawn: Spawn) {
    if (this.phase !== 'home') return;
    this.resetRun();
    this.phase = 'run';
    this.player.reset(spawn.dir, spawn.facing);
    this.pumps.place(spawn.dir);
    this.chests.place(spawn.dir, this.pumps.list.map((p) => p.pos), this.trapChance);
    this.lastCall.place(spawn.dir, this.chests.list.map((c) => c.pos), this.pumps.list.map((p) => p.pos));
    this.door.place(spawn.dir, [...this.chests.list.map((c) => c.pos), ...this.lastCall.list.map((b) => b.pos)], this.pumps.list.map((p) => p.pos));
    this.bins.place(spawn.dir, [...this.chests.list.map((c) => c.pos), ...this.lastCall.list.map((b) => b.pos)], this.pumps.list.map((p) => p.pos), this.binCount);
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
    this.offer = null;
    if (card.kind === 'stat') this.applyStatBonus(card.stat, card.value);
    else if (card.kind === 'item') this.gainItem(card.item, card.rarity, card.mult);
    else {
      if (card.kind === 'weapon') this.equip(card.weaponId);
      else applyCard(card);
      this.progression.pending--;
    }
    this.events.emit('cardPicked', { card });
    if (this.progression.pending > 0) this.offerCards(false);
  }

  // ------------------------------------------------------------------ boucle

  /** Avance le jeu de `realDt` secondes réelles ; renvoie la durée de jeu écoulée (0 si figé). */
  step(realDt: number, input: InputState = NO_INPUT) {
    if (this.deadTime >= 0) this.deadTime += realDt;
    // Coffre : la révélation se joue en temps réel, puis l'écran de choix s'ouvre
    if (this.reveal && (this.reveal.left -= realDt) <= 0) {
      const { chest, price, rarity, cards } = this.reveal;
      this.reveal = null;
      this.offer = cards;
      this.events.emit('chestOpened', { chest, price, rarity, cards });
    }
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
    this.shots.update(dt, (s) => this.shotLanded(s));
    this.health.update(dt);
    if (this.phase === 'run' && this.health.dead) {
      if (this.effects.revives > 0) this.revive();
      else this.die();
    }
    if (this.phase === 'run' && !this.arriving) {
      this.runTime += dt;
      if (!frozen) {
        this.director.update(dt, this.runTime, this.mods.count);
        // Boss de mi-run : il arrive tout seul à son heure
        if (!this.bossDone && this.runTime >= FRERE_SONNEUR.arriveAt) this.spawnBoss();
        this.boss?.update(dt);
        this.mechanic.update(dt);
        // Pompes à bière : pleine, elle fige le jeu et propose ses bonus
        const full = this.pumps.update(dt, p.pos, this.stats.pumpSpeed);
        if (full) {
          const cards = rollStatCards(full.tier, PUMPS.choices, this.stats.luck);
          this.offer = cards;
          this.events.emit('pumpFilled', { pump: full, cards });
        }
        // Coffres : celui à portée s'ouvre à la touche d'action, s'il y a de quoi payer
        this.chests.update(p.pos);
        this.lastCall.update(p.pos);
        if (input.actionPressed && this.chests.focus && !this.offer) this.openChest(this.chests.focus);
        else if (input.actionPressed && this.lastCall.focus && !this.offer) this.ringBell(this.lastCall.focus);
        this.door.update(p.pos);
        if (input.actionPressed && !this.chests.focus && !this.lastCall.focus && this.door.focus && !this.offer) this.openDoor();
        // Poubelles : le Buveur qui passe dessus la casse
        const bin = this.bins.touching(p.pos);
        if (bin) this.breakBin(bin, 'player');
      }
      if (!frozen) this.updateItemEffects(dt);
      this.loadout.update(dt);
      this.events.emit('tick', { dt });
    }
    this.loadout.updateProjectiles(dt);
    // Poubelles : un projectile qui passe dedans la casse (il continue sa route)
    if (dt > 0 && this.bins.list.length) {
      for (const w of this.loadout.weapons) for (const b of w.projectiles) {
        if (!b.active) continue;
        const bin = this.bins.at(b.pos);
        if (bin) this.breakBin(bin, 'weapon');
      }
    }
    this.chest.copy(p.renderPos).addScaledVector(p.upDir, 1.0);
    this.xp.update(dt, this.chest, this.phase === 'run' ? this.stats.pickupRange : 0, (v) => {
      this.collectXp(v * this.stats.xpGain * this.tournees.xpMul);
      // Sachet de cacahuètes : chaque goutte d'XP soigne un peu
      if (this.effects.healPerXp > 0) this.health.heal(this.effects.healPerXp);
    });
    this.coinDrops.update(dt, this.chest, this.phase === 'run' ? this.stats.pickupRange : 0, (v) => {
      // Porte-monnaie : la part en plus s'accumule, une capsule entière à la fois
      this.coinFrac += v * (this.stats.coinGain - 1);
      const extra = Math.floor(this.coinFrac + 1e-9);
      this.coinFrac -= extra;
      this.coins += v + extra;
      this.events.emit('coinsCollected', { amount: v + extra, total: this.coins });
    });
    this.tournees.drops.update(dt, this.chest, this.phase === 'run' ? this.stats.pickupRange : 0, (v) => this.takeTournee(TOURNEE_IDS[v]));
    this.bellDrops.update(dt, this.chest, this.phase === 'run' ? this.stats.pickupRange : 0, () => this.pullAll('drop', null));
    this.snackDrops.update(dt, this.chest, this.phase === 'run' ? this.stats.pickupRange : 0, (v) => {
      const heal = v * SNACK.heal;
      this.health.heal(heal);
      this.events.emit('snackEaten', { heal, hp: this.health.hp });
    });
    return dt;
  }

  // ------------------------------------------------------------------ combat et XP

  /** Multiplicateurs de la difficulté choisie. */
  get mods() { return DIFFICULTIES[this.difficulty]; }

  /**
   * Fait apparaître un zombie au sol à la direction `at`, tourné vers `facing`. Plus la run avance,
   * plus il a de PV (courbe de la run et difficulté).
   */
  /**
   * Bonus de stat (pompe à bière) : ajouté à la stat du joueur. PV max : la vie monte d'autant ;
   * vitesse : appliquée au déplacement.
   */
  applyStatBonus(stat: ItemStatId, value: number) {
    if (stat === 'maxHp') {
      this.health.max += value;
      this.health.heal(value);
    } else {
      (this.stats as unknown as Record<ItemStatId, number>)[stat] += value;
      if (stat === 'moveSpeed') this.player.speed = BASE_SPEED * this.stats.moveSpeed;
      if (stat === 'jumpHeight') this.player.jumpMul = 1 + this.stats.jumpHeight;
      if (stat === 'chestDiscount') this.chests.discount = this.stats.discount;
    }
    this.events.emit('statGained', { stat, value });
  }

  /**
   * Le joueur prend un objet (carte de coffre, outils de dev) : rangé dans ses objets, sa stat ou son
   * effet s'applique. `value` : effet à cette rareté (par défaut celui de la config).
   */
  gainItem(item: ItemId, rarity: number, mult?: number) {
    const def: ItemDef = ITEMS[item];
    const m = mult ?? (def.fixed ? 1 : RARITIES[rarity].mult);
    this.items.push({ item, rarity });
    for (const [stat, v] of Object.entries(def.stats ?? {}) as [ItemStatId, number][]) this.applyStatBonus(stat, v * m);
    if (def.effect) this.effects.add(def.effect, (def.value ?? 0) * m);
    if (def.effect === 'doubleJump') this.player.airJumps = Math.round(this.effects.power.doubleJump);
    this.events.emit('itemGained', { item, rarity, mult: m });
  }

  /** Paie et ouvre un coffre : la rareté se révèle, le jeu se fige sur 3 objets de cette rareté. */
  private openChest(chest: Chest) {
    // Bon de réduction : parfois gratuit
    const lucky = this.effects.freeChestChance > 0 && this.random() < this.effects.freeChestChance;
    const price = lucky ? 0 : this.chests.priceOf(chest);
    if (this.coins < price) { this.events.emit('chestDenied', { chest, price, coins: this.coins }); return; }
    this.coins -= price;
    chest.opened = true;
    if (!chest.free) this.chests.opened++;
    if (chest.trapped) { this.springTrap(chest, price); return; }
    const rarity = chest.rarity ?? rollTier(this.stats.luck);
    const cards = rollItemCards(rarity, CHESTS.choices);
    const duration = CHESTS.revealTime + CHESTS.revealPerRarity * rarity;
    this.reveal = { chest, price, rarity, cards, left: duration };
    this.events.emit('chestRevealing', { chest, rarity, duration });
  }

  /**
   * Coffre piégé : il explose (le joueur dans le rayon encaisse, repoussé) et des ennemis sortent de terre
   * en cercle autour de lui. Les capsules payées sont perdues.
   */
  private springTrap(chest: Chest, price: number) {
    const T = CHEST_TRAP;
    const at = chest.pos.clone();
    const p = this.player.pos;
    const hit = p.angleTo(at) * PLANET_RADIUS < T.radius;
    if (hit) {
      const dir = p.clone().sub(at);
      const up = this.tmp.copy(p).normalize();
      dir.addScaledVector(up, -dir.dot(up));
      if (dir.lengthSq() < 1e-6) dir.copy(this.player.facing).negate();
      this.hurtPlayer(null, dir.normalize(), T.damage);
    }
    const up = at.clone().normalize();
    const fwd = new THREE.Vector3().crossVectors(up, Math.abs(up.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    const side = new THREE.Vector3().crossVectors(up, fwd);
    const zombies: Zombie[] = [];
    for (let i = 0; i < T.count; i++) {
      const a = (i / T.count) * Math.PI * 2;
      const out = fwd.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a));
      const z = this.spawnZombie(T.enemy as EnemyId, at.clone().addScaledVector(out, T.ring), out);
      if (!z) continue;
      z.emerge();
      zombies.push(z);
    }
    this.events.emit('chestTrapped', { chest, price, at, radius: T.radius, hit, zombies });
  }

  /**
   * Le joueur prend une tournée du bar (ramassée au sol, ou outils de dev) : effet immédiat ou minuterie
   * (reprendre une tournée active relance sa durée sans cumuler).
   */
  takeTournee(id: TourneeId) {
    if (this.phase !== 'run') return;
    const fresh = this.tournees.start(id);
    if (id === 'sousBock' && fresh) this.stats.luck += TOURNEE_FX.sousBock.luck;
    if (id === 'fritesMayo') this.health.heal(TOURNEE_FX.fritesMayo.heal);
    this.events.emit('tourneeTaken', { id, duration: TOURNEES[id].duration });
    if (id === 'generale') {
      const G = TOURNEE_FX.generale;
      const damage = G.damage * this.stats.damage * spawnCurveAt(this.runTime).hpMul * this.mods.hp;
      this.shockwave(G.radius, G.knock, damage);
    } else if (id === 'seau') {
      const S = TOURNEE_FX.seau;
      for (const o of this.horde.near(this.player.pos, S.radius, [])) {
        if (o.targetable && o.pos.distanceTo(this.player.pos) < S.radius) this.freeze(o, S.freeze);
      }
    }
  }

  /** Sonne une grande cloche du Dernier service (une seule fois chacune). */
  private ringBell(bell: CallBell) {
    bell.rung = true;
    this.pullAll('bell', bell);
  }

  /** Dernier service : toute l'XP et toutes les capsules de la planète partent vers le Buveur (pas les snacks). */
  private pullAll(source: 'bell' | 'drop', bell: CallBell | null) {
    const L = LAST_CALL;
    const pulled = this.xp.pullAll(L.pullStart, L.pullAccel, L.pullMax) + this.coinDrops.pullAll(L.pullStart, L.pullAccel, L.pullMax);
    this.events.emit('lastCallRung', { source, at: (bell ? bell.pos : this.player.pos).clone(), bell, pulled });
  }

  /** Casse une poubelle : elle lâche de l'XP, des capsules ou, rarement, un snack. */
  private breakBin(bin: Bin, by: 'player' | 'weapon') {
    if (bin.broken) return;
    bin.broken = true;
    const L = BINS.loot;
    const r = this.random() * (L.xp + L.coins + L.snack);
    const loot: BinLoot = r < L.xp ? 'xp' : r < L.xp + L.coins ? 'coins' : 'snack';
    if (loot === 'xp') for (let i = 0; i < BINS.xp.drops; i++) this.xp.drop(bin.pos, BINS.xp.value);
    else if (loot === 'coins') {
      const n = BINS.coins.min + Math.min(BINS.coins.max - BINS.coins.min, Math.floor(this.random() * (BINS.coins.max - BINS.coins.min + 1)));
      for (let i = 0; i < n; i++) this.coinDrops.drop(bin.pos, COINS.value);
    } else this.snackDrops.drop(bin.pos, 1);
    this.events.emit('binBroken', { bin, by, loot });
  }

  /** Synergies actives (toutes leurs armes équipées). */
  activeSynergies() { return activeSynergies((id) => this.loadout.has(id)); }

  /** Fiches des synergies actives : recalculées seulement quand l'arsenal change (lu à chaque coup). */
  private synergyCache: { n: number; defs: (typeof SYNERGIES)[SynergyId][] } = { n: -1, defs: [] };
  private synergyDefs() {
    const n = this.loadout.version;
    if (this.synergyCache.n !== n) this.synergyCache = { n, defs: this.activeSynergies().map((s) => SYNERGIES[s]) };
    return this.synergyCache.defs;
  }

  /**
   * Équipe une arme (carte de level-up, outils de dev) ; annonce les synergies qu'elle active.
   * Renvoie null si l'arsenal est plein ou si elle est déjà là.
   */
  equip(id: WeaponId) {
    const completes = synergiesCompletedBy(id, (x) => this.loadout.has(x));
    const w = this.loadout.add(id);
    if (w) for (const s of completes) this.events.emit('synergyActivated', { id: s });
    return w;
  }

  /** Fin du geste d'un invocateur : ses invoqués sortent de terre en cercle autour de lui, tournés vers l'extérieur. */
  private summonAround(z: Zombie) {
    const S = z.def.summoner!;
    const up = z.pos.clone().normalize();
    const side = new THREE.Vector3().crossVectors(up, z.facing).normalize();
    const skeletons: Zombie[] = [];
    const start = Math.random() * Math.PI * 2;
    for (let i = 0; i < S.count; i++) {
      const a = start + (i / S.count) * Math.PI * 2;
      const out = z.facing.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a));
      const s = this.spawnZombie(S.enemy as EnemyId, z.pos.clone().addScaledVector(out, S.radius), out);
      if (!s) continue;
      s.emerge();
      skeletons.push(s);
    }
    this.events.emit('summoned', { zombie: z, skeletons });
  }

  /**
   * Fait venir le Frère Sonneur : il sort de terre à `at` (par défaut, à sa distance d'arrivée devant le joueur).
   * Un seul boss à la fois.
   */
  spawnBoss(at?: THREE.Vector3) {
    if (this.boss || this.phase !== 'run' || this.arriving) return null;
    this.bossDone = true;
    const p = this.player;
    const up = p.pos.clone().normalize();
    const where = at ?? up.clone().applyAxisAngle(new THREE.Vector3().crossVectors(up, p.facing).normalize(), FRERE_SONNEUR.spawnDist / PLANET_RADIUS);
    const z = this.spawnZombie('sonneur', where, p.pos.clone().sub(where.clone().setLength(p.pos.length())));
    if (!z) return null;
    z.emerge();
    const boss = new FrereSonneur(z, {
      playerPos: () => this.player.pos,
      playerHeight: () => this.player.pos.length() - this.groundAt(this.player.pos),
      hurtPlayer: (dir, damage) => this.hurtPlayer(z, dir, damage),
      onWave: (wat) => this.events.emit('bossWave', { boss, at: wat.clone() }),
      onPhase: (phase) => this.events.emit('bossPhase', { boss, phase }),
    });
    this.boss = boss;
    this.events.emit('bossSpawned', { boss });
    return boss;
  }

  /** Porte du patron : elle s'ouvre et l'Abbé en sort (pas pendant qu'un autre boss est debout). */
  openDoor() {
    const at = this.door.pos;
    if (!at || this.door.open || this.phase !== 'run') return null;
    if (this.boss) { this.events.emit('doorBusy', {}); return null; }
    this.door.open = true;
    this.events.emit('doorOpened', { at: at.clone() });
    return this.spawnAbbe(at.clone().addScaledVector(this.door.facing, PATRON_DOOR.spawnAhead), this.door.facing.clone());
  }

  /** Fait venir l'Abbé à `at`, tourné vers `facing` (porte du patron, outils de dev). */
  spawnAbbe(at: THREE.Vector3, facing: THREE.Vector3) {
    if (this.boss || this.phase !== 'run' || this.arriving) return null;
    const z = this.spawnZombie('abbe', at, facing);
    if (!z) return null;
    z.emerge();
    const boss: Abbe = new Abbe(z, {
      playerPos: () => this.player.pos,
      playerHeight: () => this.player.pos.length() - this.groundAt(this.player.pos),
      groundAt: (q) => this.groundAt(q),
      hurtPlayer: (dir, damage) => this.hurtPlayer(z, dir, damage),
      random: () => Math.random(),
      onPour: (puddles) => this.events.emit('winePoured', { boss, puddles }),
      onPhase: (phase) => this.events.emit('bossPhase', { boss, phase }),
    });
    this.boss = boss;
    this.events.emit('bossSpawned', { boss });
    return boss;
  }

  /** Fait apparaître un élite : l'ennemi en plus grand, avec plus de PV (et plus de dégâts, `damageOf`). */
  spawnElite(enemy: EnemyId, at: THREE.Vector3, facing: THREE.Vector3) {
    const z = this.spawnZombie(enemy, at, facing);
    if (!z) return z;
    z.elite = true;
    z.size = ELITES.sizeMul;
    z.hp = z.maxHp = Math.round(z.hp * ELITES.hpMul);
    this.events.emit('eliteSpawned', { zombie: z });
    return z;
  }

  /** Dégâts d'un coup de `z` (un élite frappe plus fort). */
  private damageOf(z: Zombie, base: number) { return z.elite ? base * ELITES.damageMul : base; }

  spawnZombie(enemy: EnemyId, at: THREE.Vector3, facing: THREE.Vector3) {
    const z = this.horde.spawn(enemy, at, facing);
    // Un boss a des PV fixes (seule la difficulté compte) ; les autres suivent la courbe de la run
    if (z) z.hp = z.maxHp = Math.round(ENEMIES[enemy].hp * (z.def.boss ? 1 : spawnCurveAt(this.runTime).hpMul) * this.mods.hp);
    return z;
  }

  /**
   * Un zombie encaisse un coup (venant de la vitesse `vel`, ramenée dans le plan du sol : il recule
   * dans ce sens). Mort : +1 kill et une goutte de bière. Renvoie true s'il meurt. Un fantôme
   * intouchable n'encaisse rien.
   */
  hitZombie(z: Zombie, damage: number, crit: boolean, impact: THREE.Vector3, vel: THREE.Vector3, weapon: Weapon | null = null, knock = 1) {
    if (z.intangible) return false; // un fantôme intouchable : le coup le traverse
    // Stat Dégâts du joueur : toutes ses armes ; objets qui visent certains ennemis
    if (weapon) damage *= this.stats.damage * this.itemDamageMul(z) * this.tournees.damageMul;
    knock *= this.stats.knockback;
    const hpBefore = Math.max(0, z.hp);
    // Synergies actives : une arme marque le zombie (sonné), une autre lui fait plus de dégâts pendant ce temps
    const synergies = this.synergyDefs();
    let combo = false;
    for (const S of synergies) if (weapon?.id === S.boosted && z.dazed > 0) { damage *= S.mult; combo = true; }
    // Dans le halo d'un porte-reliques : dégâts réduits
    const shield = this.horde.shieldOf(z);
    damage *= 1 - shield;
    const up = this.tmp.copy(z.pos).normalize();
    const dir = vel.clone().addScaledVector(up, -vel.dot(up)).normalize();
    const killed = z.damage(damage, dir, knock);
    if (killed) {
      this.kills++;
      // Parfois une capsule (Pièces) à la place de la goutte d'XP
      if (this.rollCoin()) this.coinDrops.drop(z.pos, COINS.value);
      else this.xp.drop(z.pos, z.def.xp);
      // Rarement, une clochette du Dernier service en plus
      if (this.rollBell()) this.bellDrops.drop(z.pos, 1);
      // Rarement, une tournée du bar
      const tournee = this.rollTournee();
      if (tournee) this.tournees.drops.drop(z.pos, TOURNEE_IDS.indexOf(tournee));
    }
    for (const S of synergies) if (!killed && weapon?.id === S.marker) z.dazed = S.duration * this.stats.duration;
    if (weapon) this.afterWeaponHit(z, Math.min(damage, hpBefore), killed);
    this.events.emit('zombieHit', { weapon, zombie: z, damage, crit, killed, hpAfter: z.hp, impact: impact.clone(), dir, shielded: shield > 0, combo });
    // Le boss tué laisse un coffre gratuit de haute rareté
    if (killed && z.def.boss && this.boss?.zombie === z) {
      const boss = this.boss;
      this.boss = null;
      if (boss.kind === 'abbe') {
        // Le boss final tombe : la run est gagnée
        this.events.emit('bossKilled', { boss, chest: null });
        this.win();
      } else {
        const chest = this.chests.addFreeAt(z.pos);
        if (chest) chest.rarity = FRERE_SONNEUR.chestRarity;
        this.events.emit('bossKilled', { boss, chest });
      }
    }
    // Un élite tué laisse un coffre gratuit
    if (killed && z.elite) this.events.emit('eliteKilled', { zombie: z, chest: this.chests.addFreeAt(z.pos) });
    // Un kamikaze tué explose sur place
    if (killed && z.def.kamikaze) this.explode(z, true);
    // Un diviseur tué se sépare en petits
    if (killed && z.def.splitter) this.split(z);
    // Cendrier : parfois, l'ennemi tué explose (pas un kamikaze, qui explose déjà)
    if (killed && !z.def.kamikaze && this.effects.explodeChance > 0 && this.random() < this.effects.explodeChance) this.ashExplode(z);
    return killed;
  }

  /**
   * Cendrier : l'ennemi tué explose, les ennemis autour encaissent (dégâts qui suivent les PV des
   * ennemis au fil de la run et la stat Dégâts). Le joueur n'est jamais touché.
   */
  private ashExplode(z: Zombie) {
    const E = ITEM_EFFECTS.explodeOnKill;
    const at = z.pos.clone();
    this.events.emit('itemExploded', { zombie: z, at, radius: E.radius * this.stats.size });
    const damage = E.damage * this.stats.damage * spawnCurveAt(this.runTime).hpMul * this.mods.hp;
    const radius = E.radius * this.stats.size;
    // Copie : un coup peut en déclencher d'autres (explosions en chaîne) qui refont la recherche
    for (const o of this.horde.near(at, radius, [])) {
      if (o === z || !o.targetable || o.pos.distanceTo(at) > radius) continue;
      this.hitZombie(o, damage, false, o.pos, o.pos.clone().sub(at));
    }
  }

  /** Multiplicateur de dégâts des objets sur ce zombie (Gants de videur, Lunettes, Last order). */
  private itemDamageMul(z: Zombie) {
    const P = this.effects.power;
    let mul = 1;
    if (P.closeDamage > 0 && z.pos.distanceTo(this.player.pos) < ITEM_EFFECTS.closeDamage.range) mul += P.closeDamage;
    if (P.eliteDamage > 0 && z.def.hp >= ITEM_EFFECTS.eliteDamage.minHp) mul += P.eliteDamage;
    if (P.lowHpDamage > 0 && this.health.ratio < ITEM_EFFECTS.lowHpDamage.below) mul += P.lowHpDamage;
    return mul;
  }

  /** Après un coup d'arme : vol de vie, ralenti (Seau à glace), gel (Glaçons). */
  private afterWeaponHit(z: Zombie, dealt: number, killed: boolean) {
    if (this.stats.steal > 0 && dealt > 0) this.health.heal(dealt * this.stats.steal);
    if (killed) return;
    const slow = this.effects.slow;
    if (slow > 0) {
      z.slowMul = Math.min(z.slowMul, 1 - slow);
      z.slowTime = ITEM_EFFECTS.slowOnHit.time * this.stats.duration;
    }
    const freeze = this.effects.freezeChance;
    if (freeze > 0 && this.random() < freeze) this.freeze(z, ITEM_EFFECTS.freezeChance.time * this.stats.duration);
  }

  /** Gèle (ou étourdit) un zombie `time` s : il ne bouge plus, ne frappe plus. */
  private freeze(z: Zombie, time: number) {
    if (z.dead) return;
    z.frozen = Math.max(z.frozen, time);
    this.events.emit('zombieFrozen', { zombie: z, time });
  }

  /** Onde autour du joueur : repousse les ennemis à moins de `radius` m (et les blesse de `damage`). */
  private shockwave(radius: number, knock: number, damage = 0) {
    const at = this.player.pos.clone();
    this.events.emit('shockwave', { at, radius });
    for (const o of this.horde.near(at, radius, [])) {
      if (!o.targetable || o.pos.distanceTo(at) > radius) continue;
      const dir = o.pos.clone().sub(at);
      const up = this.tmp.copy(o.pos).normalize();
      dir.addScaledVector(up, -dir.dot(up));
      if (dir.lengthSq() < 1e-6) dir.copy(this.player.facing);
      dir.normalize();
      if (damage > 0) this.hitZombie(o, damage, false, o.pos, dir, null, knock);
      else o.damage(0, dir, knock);
    }
  }

  /** Seconde tournée : le joueur revient avec une part de ses PV, invulnérable un instant, l'onde repousse. */
  private revive() {
    const R = ITEM_EFFECTS.revive;
    this.effects.revives--;
    this.health.hp = Math.max(1, Math.min(this.health.max, this.health.max * ITEMS.secondeTournee.value));
    this.health.invuln = R.invuln;
    this.effects.owed = 0;
    this.events.emit('revived', { hp: this.health.hp });
    this.shockwave(R.radius * this.stats.size, R.knock);
  }

  /** Effets d'objets qui vivent à chaque pas : minuteries, régénération, Écharpe, ardoise. */
  private updateItemEffects(dt: number) {
    const fx = this.effects.update(dt, this.stats.duration);
    // Tournées du bar : celles qui finissent rendent ce qu'elles avaient prêté
    for (const id of this.tournees.update(dt, this.ended)) {
      if (id === 'sousBock') this.stats.luck -= TOURNEE_FX.sousBock.luck;
      this.events.emit('tourneeEnded', { id });
    }
    if (fx.shieldUp) this.events.emit('foamShieldUp', {});
    if (fx.happyStart) this.events.emit('happyHourStarted', { duration: this.effects.happyLeft });
    if (fx.happyEnd) this.events.emit('happyHourEnded', {});
    this.stats.rateMul = this.effects.rateMul;
    this.stats.extraShotChance = this.effects.extraShotChance;
    // Ardoise du bar : la part de la dette qui tombe maintenant
    if (fx.owedNow > 0 && !this.cheats.god) this.health.hp = Math.max(0, this.health.hp - fx.owedNow);
    // Régénération ; Casquette à bière : en plus quand le joueur ne bouge pas
    let regen = this.stats.regen + this.tournees.regen;
    if (this.effects.power.standRegen > 0 && this.player.velocity.length() < ITEM_EFFECTS.standRegen.still) regen += this.effects.power.standRegen;
    if (regen > 0) this.health.heal(regen * dt);
    // Écharpe de supporter : entouré, il court plus vite (et prend l'armure en plus)
    if (this.effects.has('crowdBoost')) {
      const C = ITEM_EFFECTS.crowdBoost;
      let n = 0;
      for (const o of this.horde.near(this.player.pos, C.radius, this.around)) if (o.pos.distanceTo(this.player.pos) < C.radius && ++n >= C.count) break;
      this.effects.crowded = n >= C.count;
    }
    // Vitesse : stat du joueur, Écharpe entouré, Péket
    this.player.speed = BASE_SPEED * this.stats.moveSpeed * (this.effects.crowded ? 1 + this.effects.power.crowdBoost : 1) * this.tournees.speedMul;
    // Sifflet d'arbitre : étourdit les ennemis proches
    if (fx.whistle) {
      const W = ITEM_EFFECTS.whistle, radius = W.radius * this.stats.size;
      this.events.emit('whistleBlown', { at: this.player.pos.clone(), radius });
      for (const o of this.horde.near(this.player.pos, radius, this.around)) {
        if (o.targetable && o.pos.distanceTo(this.player.pos) < radius) this.freeze(o, this.effects.power.whistle * this.stats.duration);
      }
    }
    // Juke-box : une onde de musique blesse et repousse les ennemis proches
    if (fx.music) {
      const M = ITEM_EFFECTS.musicWave;
      const damage = this.effects.power.musicWave * this.stats.damage * spawnCurveAt(this.runTime).hpMul * this.mods.hp;
      this.shockwave(M.radius * this.stats.size, M.knock, damage);
    }
    // Bonnet du Père Noël : un coffre gratuit tombe près du joueur
    if (fx.freeChest) {
      const chest = this.chests.addFree(this.player.pos, this.player.facing, ITEM_EFFECTS.freeChest.dist);
      if (chest) this.events.emit('freeChestSpawned', { chest });
    }
  }

  /** Brique Diviseur : les petits sortent du corps, en cercle, tournés vers l'extérieur. */
  private split(z: Zombie) {
    const D = z.def.splitter!;
    const up = z.pos.clone().normalize();
    const side = new THREE.Vector3().crossVectors(up, z.facing).normalize();
    const children: Zombie[] = [];
    const start = Math.random() * Math.PI * 2;
    for (let i = 0; i < D.count; i++) {
      const a = start + (i / D.count) * Math.PI * 2;
      const out = z.facing.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a));
      const c = this.spawnZombie(D.enemy as EnemyId, z.pos.clone().addScaledVector(out, D.radius), out);
      if (c) children.push(c);
    }
    this.events.emit('enemySplit', { zombie: z, children });
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

  /** Le joueur encaisse un coup de `z` (au contact ou à distance ; null : un piège), venant de la direction `dir`. */
  private hurtPlayer(z: Zombie | null, dir: THREE.Vector3, baseDamage: number) {
    let damage = baseDamage * this.mods.damage;
    // Casque à bière : rien ne passe, l'ennemi au contact rebondit
    if (this.tournees.helmet && !this.health.dead) {
      if (z && !z.dead) {
        const push = z.pos.clone().sub(this.player.pos);
        const up = this.tmp.copy(z.pos).normalize();
        push.addScaledVector(up, -push.dot(up));
        if (push.lengthSq() < 1e-6) push.copy(this.player.facing);
        z.damage(0, push.normalize(), TOURNEE_FX.casque.knock);
      }
      this.events.emit('playerHurt', { zombie: z, dir, damage: 0, hp: this.health.hp, blocked: true });
      return;
    }
    // Mousse épaisse : le bouclier absorbe le coup entier (puis courte invulnérabilité, comme un coup)
    if (!this.cheats.god && this.health.invuln <= 0 && !this.health.dead && this.effects.absorb()) {
      this.health.invuln = PLAYER_STATS.invulnTime;
      this.events.emit('foamShieldPopped', { zombie: z });
      return;
    }
    // Démarche de pochtron : il titube, le coup passe à côté
    if (!this.cheats.god && this.health.invuln <= 0 && !this.health.dead && this.stats.dodgeChance > 0 && this.random() < this.stats.dodgeChance) {
      this.health.invuln = PLAYER_STATS.invulnTime;
      this.events.emit('playerDodged', { zombie: z });
      return;
    }
    // Armure (Gueule de bois, Écharpe entouré) : PV retirés de chaque coup, jamais sous le minimum
    const armor = this.stats.armor + (this.effects.crowded ? ITEM_EFFECTS.crowdBoost.armor : 0);
    if (armor > 0) damage = Math.max(ITEM_STAT_CAPS.minHitDamage, damage - armor);
    // Ardoise du bar : le coup est noté, payé sur quelques secondes
    if (this.effects.has('damageSpread') && !this.cheats.god && this.health.invuln <= 0 && !this.health.dead) {
      this.health.damage(0);
      this.effects.owe(damage);
      this.events.emit('playerHurt', { zombie: z, dir, damage, hp: this.health.hp, blocked: false });
      this.player.knock(dir, ZOMBIE_ATTACK.knockSpeed, ZOMBIE_ATTACK.knockLift, ZOMBIE_ATTACK.knockDecay);
      return;
    }
    // Invulnérable juste après un coup : ni dégâts ni recul (pas d'enchaînement de coups)
    const took = !this.cheats.god && this.health.damage(damage);
    this.events.emit('playerHurt', { zombie: z, dir, damage, hp: this.health.hp, blocked: !took });
    if (!took) return;
    this.player.knock(dir, ZOMBIE_ATTACK.knockSpeed, ZOMBIE_ATTACK.knockLift, ZOMBIE_ATTACK.knockDecay);
  }

  /**
   * Un kamikaze explose là où il est : le joueur dans la zone encaisse, repoussé hors du centre. Il
   * disparaît (pas de corps) ; `killed` : tué par le joueur, sinon sa mèche est arrivée au bout.
   */
  private explode(z: Zombie, killed: boolean) {
    const K = z.def.kamikaze!;
    const at = z.pos.clone();
    const p = this.player.pos;
    const hit = this.phase === 'run' && p.angleTo(at) * PLANET_RADIUS < K.radius;
    if (hit) {
      const dir = p.clone().sub(at);
      const up = this.tmp.copy(p).normalize();
      dir.addScaledVector(up, -dir.dot(up));
      if (dir.lengthSq() < 1e-6) dir.copy(this.player.facing).negate();
      this.hurtPlayer(z, dir.normalize(), this.damageOf(z, K.damage));
    }
    z.vanish();
    this.events.emit('enemyExploded', { zombie: z, at, radius: K.radius, killed, hit });
  }

  /** Un tireur lâche son projectile vers l'endroit où se trouve le joueur (au sol). */
  private throwFrom(z: Zombie) {
    const T = z.def.thrower!;
    const up = this.tmp.copy(z.pos).normalize();
    const from = z.pos.clone().addScaledVector(up, 1.7).addScaledVector(z.facing, 0.3);
    const to = this.player.pos.clone().normalize();
    to.multiplyScalar(this.groundAt(to.clone().multiplyScalar(PLANET_RADIUS + 60)));
    const shot = this.shots.launch(z, from, to, T, this.damageOf(z, T.damage));
    this.events.emit('enemyThrow', { shot });
  }

  /** Impact d'un projectile ennemi : le joueur dans la zone encaisse, repoussé hors du point d'impact. */
  private shotLanded(s: EnemyShot) {
    const p = this.player.pos;
    const hit = this.phase === 'run' && p.angleTo(s.to) * PLANET_RADIUS < s.radius;
    if (hit) {
      const dir = p.clone().sub(s.to);
      const up = this.tmp.copy(p).normalize();
      dir.addScaledVector(up, -dir.dot(up));
      if (dir.lengthSq() < 1e-6) dir.copy(this.player.facing).negate();
      this.hurtPlayer(s.source, dir.normalize(), s.damage);
    }
    this.events.emit('enemyShotLanded', { shot: s, hit });
  }

  private offerCards(first: boolean) {
    // Armes débloquées pas encore équipées (toutes débloquées tant que la boutique TUNAS n'existe pas)
    const available = this.loadout.full ? [] : (Object.keys(WEAPON_FACTORIES) as WeaponId[]).filter((id) => !this.loadout.has(id));
    const cards = rollCards(LEVEL_UP_SCREEN.cards, this.stats.luck, this.loadout.weapons, available, LEVEL_UP_SCREEN.newWeaponBelow);
    if (!cards.length) { this.progression.pending = 0; return; }
    // Une nouvelle arme annonce les synergies qu'elle activerait
    for (const c of cards) if (c.kind === 'weapon') c.synergies = synergiesCompletedBy(c.weaponId, (x) => this.loadout.has(x));
    this.offer = cards;
    const level = this.progression.level - this.progression.pending + 1;
    this.events.emit('levelUpOffered', { level, cards, first });
  }

  /** Atterrissage : la première horde sort de terre autour du joueur. */
  private land() {
    this.arriving = false;
    this.director.start(this.mods.count);
    this.events.emit('landed', { pos: this.player.pos.clone() });
  }

  /** Victoire : le jeu se fige sur l'écran de victoire (retour à l'accueil depuis l'écran). */
  private win() {
    if (this.won) return;
    this.won = true;
    this.events.emit('victory', { survived: this.runTime, kills: this.kills });
    this.events.emit('runEnded', { reason: 'victoire', survived: this.runTime, kills: this.kills });
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
    this.reveal = null;
    this.runTime = 0;
    this.kills = 0;
    this.acc = 0;
    this.health.max = PLAYER_STATS.maxHp;
    this.health.reset();
    this.progression.reset();
    this.stats.reset();
    this.player.speed = BASE_SPEED;
    this.pumps.clear();
    this.chests.clear();
    this.bins.clear();
    this.snackDrops.clear();
    this.lastCall.clear();
    this.bellDrops.clear();
    this.tournees.clear();
    this.boss = null;
    this.bossDone = false;
    this.won = false;
    this.door.clear();
    this.items.length = 0;
    this.effects.reset();
    this.coinFrac = 0;
    this.player.jumpMul = 1;
    this.player.airJumps = 0;
    this.loadout.reset();
    this.horde.clear();
    this.horde.setPassive(false);
    this.director.reset();
    this.mechanic?.reset();
    this.xp.clear();
    this.coinDrops.clear();
    this.coins = 0;
    this.shots.clear();
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
