import * as THREE from 'three';
import { DIFFICULTIES, type DifficultyId } from '../config/spawn';
import { ENEMIES, ROSTERS, type EnemyId } from '../config/enemies';
import { ZOMBIE_ATTACK, type ZombieModel } from '../config/zombies';
import { ARRIVAL } from '../config/player';
import { DEATH } from '../config/buveur';
import { LEVEL_UP_SCREEN } from '../config/upgrades';
import type { InputState } from '../core/input';
import { createHorde } from '../enemies/horde';
import type { Zombie, ZombieTimings } from '../enemies/zombie';
import { createXpDrops } from '../pickups/xpDrops';
import { COIN_DROPS, COINS } from '../config/coins';
import { TUNA_DROPS, TUNAS } from '../config/tunas';
import type { CardOptionId } from '../config/shop';
import { AchievementTracker } from './achievements';
import { CHARACTERS, type CharacterDef, type CharacterId } from '../config/characters';
import type { RunUnlocks } from '../meta/shop';
import { createEnemyShots, type EnemyShot } from '../enemies/enemyShots';
import { PLANET_RADIUS } from '../config/world';
import { heightAt } from '../world/terrain';
import { PlayerController } from '../player/controller';
import { Health } from '../player/health';
import { Progression } from '../player/progression';
import type { DecorCollider } from '../world/decor/collider';
import type { ThrowRig, Weapon, WeaponContext, WeaponId } from '../weapons/weapon';
import { Emitter } from './emitter';
import { applyCard, cardKey, rollCards, type Card, applyEvolution, readyToEvolve } from './levelUpCards';
import { WEAPON_FACTORIES } from '../weapons/registry';
import { SYNERGIES, type SynergyDef } from '../config/weapons';
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
import { ABBE, FRERE_SONNEUR, LOGEN, PATRON_DOOR, VADOR, XENO, GUTS, SAURON } from '../config/bosses';
import { FrereSonneur } from './frereSonneur';
import { Abbe, type WinePuddle } from './abbe';
import type { Boss, BossKind } from './boss';
import { Vador } from './vador';
import { Logen } from './logen';
import { Xeno } from './xeno';
import { Guts } from './guts';
import { Sauron } from './sauron';
import { GraveBosses, type GraveBoss } from './graveBosses';
import { DoomMountain } from './doomMountain';
import { DOOM_MOUNTAIN } from '../config/doom';
import type { GraveSite } from '../world/decor/layout';
import { PatronDoor } from './patronDoor';
import { Closing, type Reaper } from './closing';
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
import { Vehicles, type ParkedVehicle } from './vehicles';
import { Saiyan } from './saiyan';
import { Radio } from './radio';
import { Naruto } from './naruto';
import { NARUTO } from '../config/naruto';
import { Allies, type Ally } from './allies';
import { ALLIES, ALLY_FX, type AllyId, type AllyPower } from '../config/allies';
import { RADIO } from '../config/radio';
import { WALLET_BONUS, type PerkId, type WalletRule } from '../config/skills';
import { SAIYAN } from '../config/saiyan';
import { VEHICLE_SPAWN, VEHICLES, type VehicleId } from '../config/vehicles';
import { MAP_MECHANICS, type MapId, type MapMechanic } from './mechanics/mechanic';

export type Phase = 'home' | 'run' | 'dead';
/** Départ d'une run ; `graveyards` : les cimetières de la planète (où attendent les boss optionnels). */
export type Spawn = { dir: THREE.Vector3; facing: THREE.Vector3; graveyards?: readonly GraveSite[] };
export type RunEnd = 'mort' | 'abandon';
/** Ce que lâche une poubelle cassée. */
export type BinLoot = 'xp' | 'coins' | 'tunas' | 'snack';

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
  /** Une liasse ramassée : TUNAS gagnés (difficulté comprise) et total de la run. */
  tunasCollected: { amount: number; total: number };
  levelGained: { level: number };
  /** Cartes proposées ; `first` : premier écran d'une série (les suivantes s'enchaînent). */
  levelUpOffered: { level: number; cards: Card[]; first: boolean };
  /** Bannir : la carte est retirée du tirage pour la run ; `cards` : celles qui restent proposées. */
  cardBanished: { card: Card; cards: Card[] };
  /** Passer : le level-up est refusé (sans compensation). */
  cardsSkipped: Record<string, never>;
  cardPicked: { card: Card };
  /** Une arme a évolué (carte Évolution choisie). */
  weaponEvolved: { weapon: Weapon };
  paused: Record<string, never>;
  resumed: Record<string, never>;
  died: Record<string, never>;
  /** Fin de run : `tunas` gagnés au total (liasses + `tunasBonus`, le bonus de fin, à la mort seulement). */
  runEnded: { reason: RunEnd; survived: number; kills: number; tunas: number; tunasBonus: number; difficulty: DifficultyId; abbe: boolean; achievements: string[]; character: CharacterId };
  /** Un succès tombe pendant la run (une seule fois, s'il n'était pas déjà gagné). */
  achievementUnlocked: { id: string; name: string; tunas: number };
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
  /** Un boss est tué : il laisse un coffre gratuit de haute rareté, et la run continue. */
  bossKilled: { boss: Boss; chest: Chest | null };
  /** L'Abbé répand son vin : des flaques sont posées. */
  winePoured: { boss: Abbe; puddles: readonly WinePuddle[] };
  /** La Porte du patron s'ouvre : le boss final en sort. */
  doorOpened: { at: THREE.Vector3 };
  /** Vador frappe de son sabre la zone `at` (rayon `radius`) ; `hit` : le joueur y était. */
  saberStrike: { boss: Vador; at: THREE.Vector3; radius: number; hit: boolean };
  /** Vador lance son sabre (phase 2) ; le sabre revient dans sa main. */
  saberThrown: { boss: Vador };
  saberCaught: { boss: Vador };
  /** Logen part en charge ; il commence son tourbillon. */
  logenCharge: { boss: Logen };
  logenSpin: { boss: Logen };
  /** Le Xénomorphe bondit ; il retombe (`hit` : sur le joueur) ; sa queue frappe. */
  xenoLeap: { boss: Xeno };
  xenoLand: { boss: Xeno; at: THREE.Vector3; radius: number; hit: boolean };
  xenoTail: { boss: Xeno; hit: boolean };
  /** L'épée de Guts passe (fauchage) ou s'abat (coup) ; `hit` : sur le joueur. */
  gutsSweep: { boss: Guts; hit: boolean };
  gutsSlam: { boss: Guts; hit: boolean };
  /** La masse de Sauron balaie (`hit` : le joueur, projeté au loin) ou s'abat en `at` ; une onde part de `at` ; l'Oeil brûle le joueur. */
  sauronSweep: { boss: Sauron; hit: boolean };
  sauronSlam: { boss: Sauron; at: THREE.Vector3; hit: boolean };
  sauronWave: { boss: Sauron; at: THREE.Vector3 };
  sauronGaze: { boss: Sauron; at: THREE.Vector3 };
  /** Un boss optionnel est défié. */
  graveBossChallenged: { boss: Boss };
  /** La lave du cratère de la Montagne du Destin brûle le joueur. */
  lavaBurn: { at: THREE.Vector3 };
  /** Sauron tombé, l'Anneau unique roule au sol en `at` ; le joueur le ramasse. */
  ringDropped: { at: THREE.Vector3 };
  ringTaken: Record<string, never>;
  /** L'Anneau s'enfile (invisible `duration` s) ; il s'enlève (le joueur réapparaît). */
  ringOn: { duration: number };
  ringOff: Record<string, never>;
  /** 10:00 : la fermeture du bar, la Mort arrive. */
  closingStarted: Record<string, never>;
  /** Une Mort sort de terre ; une Mort lève sa faux. */
  reaperSpawned: { reaper: Reaper };
  reaperSwing: { reaper: Reaper };
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
  itemGained: { item: ItemId; rarity: number };
  /** Glaçons ou Sifflet : un ennemi gèle (ou est étourdi) `time` s. */
  zombieFrozen: { zombie: Zombie; time: number };
  /** Démarche de pochtron : le joueur esquive le coup de `zombie` (null : un piège). */
  playerDodged: { zombie: Zombie | null; instinct: boolean };
  /** Le véhicule de la run est garé sur la planète (au début de la run, ou par le panneau DEV). */
  vehicleSpawned: { vehicle: ParkedVehicle };
  /** Le joueur monte dans un véhicule. */
  vehicleEntered: { kind: VehicleId; pos: THREE.Vector3 };
  /** Le véhicule conduit écrase un ennemi (à `speed` m/s). */
  vehicleCrushed: { zombie: Zombie; pos: THREE.Vector3; killed: boolean; speed: number };
  /** Le véhicule encaisse un coup à la place du joueur. */
  vehicleHit: { damage: number; hp: number; maxHp: number };
  /** Un allié rejoint le joueur (il le suivra `time` s). */
  allyJoined: { kind: AllyId; time: number };
  /** Un allié use de son pouvoir, autour de `pos` (rayon `radius`) ; `targets` : les ennemis touchés. */
  allyPower: { kind: AllyId; pos: THREE.Vector3; radius: number; targets: number };
  /** Un allié s'en va (fin de sa compagnie). */
  allyLeft: { kind: AllyId };
  /** Krilin a soigné le joueur de `amount` PV depuis la dernière fois (une fois par `ALLY_FX.healPulse` s). */
  allyHealed: { amount: number };
  /** Un Kienzan arrive au bout de sa course et s'éteint. */
  kienzanFaded: { pos: THREE.Vector3 };
  /** Steve pose un bloc de TNT, qui explose dans `fuse` s. */
  tntPlaced: { pos: THREE.Vector3; fuse: number };
  /** Un bloc de TNT explose (rayon `radius`). */
  tntExploded: { pos: THREE.Vector3; radius: number };
  /** La radio est allumée : elle joue et attire la horde. */
  radioOn: { pos: THREE.Vector3 };
  /** Un ennemi frappe la radio ; `hp` : ce qui lui reste. */
  radioHit: { hp: number; maxHp: number };
  /** La radio est détruite : la horde revient vers le joueur. */
  radioBroken: { pos: THREE.Vector3 };
  /** Le joueur attrape Naruto : il part en fumée à `at` et laisse un coffre gratuit (null : plus de place). */
  narutoCaught: { at: THREE.Vector3; chest: Chest | null };
  /** Senzu : le joueur en mange une (sous le seuil de PV), il retrouve tous ses PV ; `left` : celles qui restent. */
  senzuEaten: { left: number };
  /** Jauge de colère : un nouveau palier de transformation est atteint (le joueur peut s'y transformer). */
  saiyanTierReached: { tier: number; name: string };
  /** Le joueur se transforme (palier `tier`, pour `duration` s). */
  saiyanTransformed: { tier: number; name: string; duration: number };
  /** La transformation est finie : la jauge retombe à 0. */
  saiyanEnded: { tier: number };
  /** Super Saiyan 2 : un éclair frappe un ennemi. */
  saiyanLightning: { from: THREE.Vector3; to: THREE.Vector3 };
  /** Le tank tire un obus de `from` vers `to` (il arrive en `flight` s). */
  tankFired: { from: THREE.Vector3; to: THREE.Vector3; flight: number };
  /** Un obus du tank explose à `pos` (rayon `radius`). */
  tankShellExploded: { pos: THREE.Vector3; radius: number };
  /** Le joueur descend du véhicule : temps écoulé, véhicule détruit, ou fin de run. */
  vehicleExited: { kind: VehicleId; reason: 'timeout' | 'destroyed' | 'end'; pos: THREE.Vector3 };
  /** Un projectile ennemi est arrêté en vol par une arme (le Plateau), à `pos`. */
  enemyShotBlocked: { pos: THREE.Vector3 };
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
  /** Tirage « cet ennemi tué lâche une liasse de TUNAS » (par défaut : la chance de la config). */
  rollTuna?: () => boolean;
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
export const NO_INPUT: InputState = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, mouseDX: 0, mouseDY: 0, zoom: 0, jump: false, jumpPressed: false, action: false, actionPressed: false, transform: false, transformPressed: false, pausePressed: false, backPressed: false };

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
  /** Les alliés des abbayes (issue #18). */
  readonly allies: Allies;
  /** La radio planquée (issue #16). */
  readonly radio: Radio;
  /** Naruto, qui court sur la planète : on l'attrape pour un coffre légendaire. */
  readonly naruto: Naruto;
  /** Jauge de colère et transformation Super Saiyan (objet Sang Saiyan). */
  readonly saiyan = new Saiyan();
  /** Véhicules écrase-zombies (un garé à la fois, ou celui qu'on conduit). */
  readonly vehicles: Vehicles;
  /** Écrasement : quand chaque ennemi peut de nouveau être écrasé (temps de run). */
  private crushReady = new WeakMap<Zombie, number>();
  /** Poubelles de la run (exploration). */
  readonly bins = new Bins();
  /** Grandes cloches du Dernier service, et clochettes au sol. */
  readonly lastCall: LastCall;
  readonly bellDrops: ReturnType<typeof createXpDrops>;
  private rollBell: () => boolean;
  /**
   * Les boss debout (plusieurs à la fois : on défie autant de boss optionnels qu'on veut, et le Sonneur comme l'Abbé
   * viennent quand même) ; un seul de chaque sorte. `bossDone` : le boss de mi-run est déjà venu.
   */
  readonly bosses: Boss[] = [];
  /** La Porte du patron de la run. */
  readonly door: PatronDoor;
  /** Les boss optionnels qui attendent devant les cimetières. */
  readonly graveBosses: GraveBosses;
  /** La Montagne du Destin (issue #20) : la lave de son cratère. */
  readonly doom = new DoomMountain();
  /** L'Anneau unique lâché par Sauron, au sol en attendant qu'on le ramasse (null : pas d'anneau au sol). */
  ringDrop: THREE.Vector3 | null = null;
  /** Là où les ennemis ont vu le joueur pour la dernière fois (il est invisible : l'Anneau). */
  private readonly lastSeen = new THREE.Vector3();
  /** Ce que les ennemis et les boss visent : le joueur, ou là où il était quand il a enfilé l'Anneau. */
  get seenPos() { return this.effects.invisible ? this.lastSeen : this.player.pos; }
  /** Le joueur est invisible (l'Anneau unique). */
  get invisible() { return this.effects.invisible; }
  /** La fermeture du bar (10:00) : les Morts. */
  readonly closing: Closing;
  bossDone = false;
  /** Succès : suivi pendant la run (`owned` et `lifetimeKills` donnés par la sauvegarde au départ). */
  readonly achievements: AchievementTracker;
  /** Le perso joué ne recule pas sous les coups (le Videur). */
  get knockImmune() { return !!(CHARACTERS[this.character] as { knockImmune?: boolean }).knockImmune; }
  /** Perso joué (choisi avant la run) : arme de départ, passif, stats. */
  character: CharacterId = 'buveur';
  /** L'Abbé (boss final) est tombé pendant cette run : la difficulté suivante s'ouvre. */
  abbeKilled = false;
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
  /** Liasses de TUNAS au sol, et TUNAS ramassés pendant la run (non arrondis : la difficulté les multiplie). */
  readonly tunaDrops: ReturnType<typeof createXpDrops>;
  tunas = 0;
  private rollTuna: () => boolean;
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
  /** D'où vient l'offre en cours : level-up (les options de cartes ne marchent que là), pompe ou coffre. */
  offerKind: 'level' | 'pump' | 'chest' | null = null;
  /**
   * Déblocages de la boutique pour la run (objets qui sortent des coffres, utilisations des options de cartes) ; null : tout
   * est débloqué, sans option de cartes (tests, outils).
   */
  unlocks: RunUnlocks | null = null;
  /** Utilisations restantes de Relancer, Bannir, Passer pendant la run. */
  cardOptions: Record<CardOptionId, number> = { reroll: 0, banish: 0, skip: 0 };
  /** Cartes bannies pour la run (clés de `cardKey`). */
  readonly banned = new Set<string>();
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
      logen: deps.zombieKinds.logen ?? { scale: 1, clips: { idle: clip(LOGEN.clips.idle), walk: clip(LOGEN.clips.walk), attack: clip(LOGEN.clips.run), hit: clip(LOGEN.clips.hit), death: clip(LOGEN.clips.death), cast: clip(LOGEN.clips.roar) } },
      guts: deps.zombieKinds.guts ?? { scale: 1, clips: { idle: clip(GUTS.clips.idle), walk: clip(GUTS.clips.walk), attack: clip(GUTS.clips.sweep), hit: clip(GUTS.clips.hit), death: clip(GUTS.clips.death), cast: clip(GUTS.clips.roar) } },
      sauron: deps.zombieKinds.sauron ?? { scale: 1, clips: { idle: clip(SAURON.clips.idle), walk: clip(SAURON.clips.walk), attack: clip(SAURON.clips.sweep), hit: clip(SAURON.clips.hit), death: clip(SAURON.clips.death), cast: clip(SAURON.clips.roar) } },
      xeno: deps.zombieKinds.xeno ?? { scale: 1, clips: { idle: clip(XENO.clips.idle), walk: clip(XENO.clips.walk), attack: clip(XENO.clips.tail), hit: clip(XENO.clips.hit), death: clip(XENO.clips.death), cast: clip(XENO.clips.roar) } },
      vador: deps.zombieKinds.vador ?? { scale: 1, clips: { idle: clip(VADOR.clips.idle), walk: clip(VADOR.clips.walk), attack: clip(VADOR.clips.strike), hit: clip(VADOR.clips.hit), death: clip(VADOR.clips.death), cast: clip(VADOR.clips.strike) } },
    };
    this.horde = createHorde(kinds, player, deps.collider);
    this.pumps = new Pumps(deps.collider);
    this.chests = new Chests(deps.collider);
    this.vehicles = new Vehicles(deps.collider, () => this.random());
    this.radio = new Radio(deps.collider, () => this.random());
    this.allies = new Allies(deps.collider);
    this.naruto = new Naruto(deps.collider);
    this.door = new PatronDoor(deps.collider);
    this.graveBosses = new GraveBosses(deps.collider, () => this.random());
    this.closing = new Closing({
      playerPos: () => this.seenPos,
      hurtPlayer: (dir, damage) => this.hurtPlayer(null, dir, damage),
      random: () => this.random(),
      onStart: () => this.events.emit('closingStarted', {}),
      onSpawn: (reaper) => this.events.emit('reaperSpawned', { reaper }),
      onSwing: (reaper) => this.events.emit('reaperSwing', { reaper }),
    });
    this.horde.onHitDecoy = (z) => this.hitRadio(this.damageOf(z, z.def.damage));
    this.horde.onHit = (z, dir) => { this.contactStun(z); this.hurtPlayer(z, dir, this.damageOf(z, z.def.damage)); };
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
    this.tunaDrops = createXpDrops(groundAt, TUNA_DROPS);
    this.snackDrops = createXpDrops(groundAt, SNACK_DROPS);
    this.bellDrops = createXpDrops(groundAt, BELL_DROPS);
    this.lastCall = new LastCall(deps.collider);
    this.tournees = new Tournees(groundAt);
    this.rollTournee = deps.rollTournee ?? (() => (Math.random() < tourneeDropChance(this.stats.luck) ? rollTournee(Math.random()) : null));
    this.rollBell = deps.rollBell ?? (() => Math.random() < bellDropChance(this.stats.luck));
    this.binCount = deps.binCount ?? BINS.count;
    this.trapChance = deps.trapChance ?? CHEST_TRAP.chance;
    this.rollCoin = deps.rollCoin ?? (() => Math.random() < COINS.dropChance);
    this.rollTuna = deps.rollTuna ?? (() => Math.random() < TUNAS.dropChance);
    this.achievements = new AchievementTracker({
      runTime: () => this.runTime,
      kills: () => this.kills,
      weapons: () => this.loadout.weapons.length,
      tunas: () => this.tunas,
      difficulty: () => this.difficulty,
      allies: () => this.allies.list.filter((x) => x.state === 'following').map((x) => x.kind),
    }, (a) => this.events.emit('achievementUnlocked', { id: a.id, name: a.name, tunas: a.tunas }));
    this.events.on('eliteKilled', () => this.achievements.elite());
    this.events.on('itemGained', () => this.achievements.item());
    this.events.on('binBroken', () => this.achievements.bin());
    this.events.on('narutoCaught', () => this.achievements.naruto());
    this.events.on('vehicleCrushed', ({ killed }) => { if (killed) this.achievements.crush(); });
    this.events.on('synergyActivated', () => this.achievements.synergy());
    this.events.on('bossKilled', ({ boss }) => this.achievements.boss(boss.kind));
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
      playerFacing: () => player.facing,
      xpGathered: () => this.xpGathered,
      blockShots: (p, r) => this.shots.shots.length ? this.shots.removeNear(p, r, (s) => this.events.emit('enemyShotBlocked', { pos: s.pos.clone() })) : 0,
      poisonStacksPerTick: () => (CHARACTERS[this.character] as { poisonStacks?: number }).poisonStacks ?? 1,
      synergy: (id) => this.hasSynergy(id),
      zonesOf: (id) => this.loadout.weapons.find((w) => w.id === id)?.zones ?? [],
      trigger: (id) => { this.loadout.weapons.find((w) => w.id === id)?.trigger?.(); },
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
  get frozen() { return this.menuPaused || this.offer !== null || this.reveal !== null; }
  /** Coffre en train de révéler sa rareté (temps restant, s). */
  private reveal: { chest: Chest; price: number; rarity: number; cards: Card[]; left: number } | null = null;

  // ------------------------------------------------------------------ cycle de la run

  /** Nouvelle run : le joueur tombe du ciel au point de départ. */
  startRun(spawn: Spawn) {
    if (this.phase !== 'home') return;
    // Le perso choisi : son arme de départ remplace celle de la run précédente
    const C = CHARACTERS[this.character];
    this.loadout.setStarting(C.weapon);
    this.resetRun();
    this.phase = 'run';
    this.player.reset(spawn.dir, spawn.facing);
    for (const b of C.stats) this.applyStatBonus(b.stat, b.value, true);
    // Skill tree : ses bonus de stat valent dès le début de la run, comme ceux de la radio, du Super Saiyan et des véhicules
    for (const b of this.unlocks?.bonuses ?? []) this.applyStatBonus(b.stat, b.value, true);
    // Ligne TUNAS : le portefeuille au départ donne un bonus de toutes les stats, après tous les autres bonus
    this.applyWalletBonus(this.unlocks?.wallet ?? 0);
    this.radio.maxHp = RADIO.hp * (1 + this.perk('radioHp'));
    this.saiyan.extraTime = this.perk('saiyanTime');
    this.vehicles.timeMul = 1 + this.perk('vehicleTime');
    this.vehicles.hpMul = 1 + this.perk('vehicleHp');
    this.pumps.place(spawn.dir);
    this.chests.place(spawn.dir, this.pumps.list.map((p) => p.pos), this.trapChance);
    this.lastCall.place(spawn.dir, this.chests.list.map((c) => c.pos), this.pumps.list.map((p) => p.pos));
    this.door.place(spawn.dir, [...this.chests.list.map((c) => c.pos), ...this.lastCall.list.map((b) => b.pos)], this.pumps.list.map((p) => p.pos));
    // Le véhicule de la run : garé au hasard, loin de l'arrivée, il faut le trouver
    const parked = this.vehicles.place(spawn.dir, [...this.chests.list.map((c) => c.pos), ...this.pumps.list.map((q) => q.pos), ...this.lastCall.list.map((b) => b.pos), ...(this.door.pos ? [this.door.pos] : [])]);
    if (parked) this.events.emit('vehicleSpawned', { vehicle: parked });
    // La radio planquée : loin de l'arrivée, à l'écart du reste
    this.radio.place(spawn.dir, [...this.chests.list.map((c) => c.pos), ...this.pumps.list.map((q) => q.pos), ...this.lastCall.list.map((b) => b.pos), ...(parked ? [parked.pos] : [])]);
    // Les alliés : un par abbaye ; les boss optionnels : chacun devant un cimetière
    this.allies.place();
    // Naruto : il court déjà quelque part, loin de l'arrivée
    this.naruto.place(spawn.dir);
    this.graveBosses.place(spawn.dir, spawn.graveyards, this.doom.dir);
    this.bins.place(spawn.dir, [...this.chests.list.map((c) => c.pos), ...this.lastCall.list.map((b) => b.pos)], this.pumps.list.map((p) => p.pos), this.binCount);
    const landing = this.player.pos.clone();
    this.player.drop(ARRIVAL.height, ARRIVAL.speed);
    this.arriving = true;
    this.events.emit('runStarted', { spawn, landing });
  }

  /** Abandon depuis la pause : la run est perdue, retour à l'accueil. */
  abandon() {
    if (this.phase !== 'run') return;
    this.achievements.check(true);
    this.events.emit('runEnded', { reason: 'abandon', survived: this.runTime, kills: this.kills, tunas: Math.floor(this.tunas + 1e-9), tunasBonus: 0, difficulty: this.difficulty, abbe: this.abbeKilled, achievements: [...this.achievements.gained], character: this.character });
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
    this.offerKind = null;
    if (card.kind === 'stat') this.applyStatBonus(card.stat, card.value);
    else if (card.kind === 'item') this.gainItem(card.item);
    else {
      if (card.kind === 'weapon') this.equip(card.weaponId);
      else if (card.kind === 'evolution') { applyEvolution(card.weapon); this.events.emit('weaponEvolved', { weapon: card.weapon }); }
      else applyCard(card);
      this.progression.pending--;
    }
    this.events.emit('cardPicked', { card });
    if (this.progression.pending > 0) this.offerCards(false);
  }

  /** Relancer (level-up seulement) : de nouvelles cartes à la place des proposées. */
  rerollCards() {
    if (this.offerKind !== 'level' || this.cardOptions.reroll <= 0) return false;
    this.cardOptions.reroll--;
    this.offerCards(false);
    return true;
  }

  /** Bannir (level-up seulement) : la carte disparaît de l'offre et ne sortira plus de la run. */
  banishCard(card: Card) {
    if (this.offerKind !== 'level' || this.cardOptions.banish <= 0 || !this.offer?.includes(card)) return false;
    this.cardOptions.banish--;
    this.banned.add(cardKey(card));
    this.offer = this.offer.filter((c) => c !== card);
    this.events.emit('cardBanished', { card, cards: this.offer });
    if (!this.offer.length) this.endLevelOffer();
    return true;
  }

  /** Passer (level-up seulement) : ne rien prendre, sans compensation. */
  skipCards() {
    if (this.offerKind !== 'level' || this.cardOptions.skip <= 0) return false;
    this.cardOptions.skip--;
    this.events.emit('cardsSkipped', {});
    this.endLevelOffer();
    return true;
  }

  /** Le level-up est clos sans carte prise : le degré suivant s'enchaîne s'il en reste. */
  private endLevelOffer() {
    this.offer = null;
    this.offerKind = null;
    this.progression.pending--;
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
      this.offerKind = 'chest';
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
        for (const b of this.bosses) b.update(dt);
        // Succès qui dépendent du temps, des kills, de l'arsenal ou des TUNAS
        this.achievements.check();
        // Fermeture du bar : à 10:00, la Mort vient chercher le Buveur
        this.closing.update(dt, this.runTime);
        this.mechanic.update(dt);
        // Pompes à bière : pleine, elle fige le jeu et propose ses bonus
        const full = this.pumps.update(dt, p.pos, this.stats.pumpSpeed);
        if (full) {
          const cards = rollStatCards(full.tier, PUMPS.choices, this.stats.luck);
          this.offer = cards;
          this.offerKind = 'pump';
          this.events.emit('pumpFilled', { pump: full, cards });
        }
        // Coffres : celui à portée s'ouvre à la touche d'action, s'il y a de quoi payer
        this.chests.update(p.pos);
        this.lastCall.update(p.pos);
        // Super Saiyan : à la touche, il se transforme au plus haut palier atteint
        if (input.transformPressed && !this.offer) this.transformSaiyan();
        this.updateSaiyan(dt);
        // Alliés : ceux qu'on touche rejoignent le joueur, le suivent et usent de leur pouvoir
        this.allies.update(dt, p.pos, p.facing, p.speed, {
          join: (a) => this.events.emit('allyJoined', { kind: a.kind, time: a.left }),
          power: (a) => this.allyPower(a),
          leave: (a) => this.events.emit('allyLeft', { kind: a.kind }),
        });
        this.updateAllyThings(dt);
        // Naruto : touché, il part en fumée et laisse un coffre légendaire
        if (this.naruto.update(dt, p.pos)) this.catchNaruto();
        // Radio planquée : à portée, la touche d'action l'allume
        this.radio.update(p.pos);
        if (input.actionPressed && this.radio.focus && !this.chests.focus && !this.offer) this.turnRadioOn();
        if (input.actionPressed && this.chests.focus && !this.offer) this.openChest(this.chests.focus);
        else if (input.actionPressed && this.lastCall.focus && !this.offer) this.ringBell(this.lastCall.focus);
        this.door.update(p.pos);
        if (input.actionPressed && !this.chests.focus && !this.lastCall.focus && this.door.focus && !this.offer) this.openDoor();
        // Boss optionnels : à portée, la touche d'action le défie
        this.graveBosses.update(p.pos);
        const challenged = this.graveBosses.focus;
        if (input.actionPressed && challenged && !this.chests.focus && !this.lastCall.focus && !this.door.focus && !this.offer) this.challenge(challenged);
        // Montagne du Destin : la lave du cratère brûle le joueur qui y marche
        if (!this.vehicles.driving && this.doom.update(dt, p.pos, p.pos.length() - this.groundAt(p.pos))) {
          const away = this.tmp.copy(p.pos).normalize().sub(this.doom.dir).normalize();
          this.hurtPlayer(null, away.clone(), DOOM_MOUNTAIN.lava.damage);
          this.events.emit('lavaBurn', { at: p.pos.clone() });
        }
        // L'Anneau unique au sol : on le ramasse en marchant dessus
        if (this.ringDrop && this.ringDrop.angleTo(p.pos) * PLANET_RADIUS < SAURON.ring.pickRange) {
          this.ringDrop = null;
          this.gainItem('anneau');
          this.events.emit('ringTaken', {});
        }
        // Poubelles : le Buveur qui passe dessus la casse
        const bin = this.bins.touching(p.pos);
        if (bin) this.breakBin(bin, 'player');
        // Véhicules : apparition à leur heure, on monte dedans au contact, puis conduite
        const touched = this.vehicles.update(dt, p.pos);
        if (touched) this.enterVehicle(touched);
        if (this.vehicles.driving) this.driveVehicle(dt);
      }
      if (!frozen) this.updateItemEffects(dt);
      if (!frozen) this.updateShells(dt);
      // Au volant, plus aucune arme ne tire (les projectiles déjà partis finissent leur course)
      if (!this.vehicles.driving) this.loadout.update(dt);
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
    this.tunaDrops.update(dt, this.chest, this.phase === 'run' ? this.stats.pickupRange : 0, (v) => {
      const amount = v * this.tunaMul;
      this.tunas += amount;
      this.events.emit('tunasCollected', { amount, total: this.tunas });
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

  /** TUNAS gagnés en jeu : difficulté et ligne TUNAS du skill tree. */
  get tunaMul() { return this.mods.tunas * (1 + this.perk('tunaGain')); }

  /**
   * Fait apparaître un zombie au sol à la direction `at`, tourné vers `facing`. Plus la run avance,
   * plus il a de PV (courbe de la run et difficulté).
   */
  /**
   * Bonus de stat (pompe à bière) : ajouté à la stat du joueur. PV max : la vie monte d'autant ;
   * vitesse : appliquée au déplacement.
   */
  applyStatBonus(stat: ItemStatId, value: number, silent = false) {
    if (stat === 'maxHp') {
      this.health.max += value;
      this.health.heal(value);
    } else {
      (this.stats as unknown as Record<ItemStatId, number>)[stat] += value;
      if (stat === 'moveSpeed') this.player.speed = BASE_SPEED * this.stats.moveSpeed;
      if (stat === 'jumpHeight') this.player.jumpMul = 1 + this.stats.jumpHeight;
      if (stat === 'chestDiscount') this.chests.discount = this.stats.discount;
    }
    if (!silent) this.events.emit('statGained', { stat, value });
  }

  /**
   * Bonus du portefeuille (ligne TUNAS) : une part (0,25 = +25 %) de toutes les stats, appliquée stat par stat selon
   * `WALLET_BONUS` (en proportion de la valeur atteinte, ou une valeur par +100 % pour celles qui partent de 0).
   */
  private applyWalletBonus(part: number) {
    if (!(part > 0)) return;
    const stats = this.stats as unknown as Record<ItemStatId, number>;
    for (const [stat, rule] of Object.entries(WALLET_BONUS) as [ItemStatId, WalletRule][]) {
      const raw = 'per' in rule ? part * rule.per : (stat === 'maxHp' ? this.health.max : stats[stat]) * part;
      const add = rule.whole ? Math.floor(raw) : raw;
      if (add > 0) this.applyStatBonus(stat, add, true);
    }
  }

  /**
   * Le joueur prend un objet (carte de coffre, outils de dev) : rangé dans ses objets, sa stat ou son
   * effet s'applique (sa valeur fixe, sa rareté : celles de la config).
   */
  gainItem(item: ItemId) {
    const def: ItemDef = ITEMS[item];
    const rarity = def.rarity;
    this.items.push({ item, rarity });
    for (const [stat, v] of Object.entries(def.stats ?? {}) as [ItemStatId, number][]) this.applyStatBonus(stat, v);
    if (def.effect) this.effects.add(def.effect, def.value ?? 0);
    if (def.effect === 'doubleJump') this.player.airJumps = Math.round(this.effects.power.doubleJump);
    if (def.effect === 'saiyan') this.saiyan.enabled = true;
    this.events.emit('itemGained', { item, rarity });
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
    const cards = rollItemCards(rarity, CHESTS.choices, this.unlocks?.items, new Set(this.items.map((i) => i.item)));
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

  /** Dernier service : toute l'XP, les capsules et les liasses de la planète partent vers le Buveur (pas les snacks). */
  private pullAll(source: 'bell' | 'drop', bell: CallBell | null) {
    const L = LAST_CALL;
    const pulled = this.xp.pullAll(L.pullStart, L.pullAccel, L.pullMax) + this.coinDrops.pullAll(L.pullStart, L.pullAccel, L.pullMax)
      + this.tunaDrops.pullAll(L.pullStart, L.pullAccel, L.pullMax);
    this.events.emit('lastCallRung', { source, at: (bell ? bell.pos : this.player.pos).clone(), bell, pulled });
  }

  /** Casse une poubelle : elle lâche de l'XP, des capsules, des liasses de TUNAS ou, rarement, un snack. */
  private breakBin(bin: Bin, by: 'player' | 'weapon') {
    if (bin.broken) return;
    bin.broken = true;
    const L = BINS.loot;
    const r = this.random() * (L.xp + L.coins + L.tunas + L.snack);
    const loot: BinLoot = r < L.xp ? 'xp' : r < L.xp + L.coins ? 'coins' : r < L.xp + L.coins + L.tunas ? 'tunas' : 'snack';
    const between = (a: number, b: number) => a + Math.min(b - a, Math.floor(this.random() * (b - a + 1)));
    if (loot === 'xp') for (let i = 0; i < BINS.xp.drops; i++) this.xp.drop(bin.pos, BINS.xp.value);
    else if (loot === 'coins') {
      const n = BINS.coins.min + Math.min(BINS.coins.max - BINS.coins.min, Math.floor(this.random() * (BINS.coins.max - BINS.coins.min + 1)));
      for (let i = 0; i < n; i++) this.coinDrops.drop(bin.pos, COINS.value);
    } else if (loot === 'tunas') {
      for (let i = between(BINS.tunas.min, BINS.tunas.max); i > 0; i--) this.tunaDrops.drop(bin.pos, TUNAS.value);
    } else this.snackDrops.drop(bin.pos, 1);
    this.events.emit('binBroken', { bin, by, loot });
  }

  /** Synergies actives (toutes leurs armes équipées). */
  activeSynergies() { return activeSynergies((id) => this.loadout.has(id)); }

  /** Fiches des synergies actives : recalculées seulement quand l'arsenal change (lu à chaque coup). */
  private synergyCache: { n: number; ids: SynergyId[]; defs: SynergyDef[] } = { n: -1, ids: [], defs: [] };
  private synergyDefs() {
    const n = this.loadout.version;
    if (this.synergyCache.n !== n) {
      const ids = this.activeSynergies();
      this.synergyCache = { n, ids, defs: ids.map((s) => SYNERGIES[s] as SynergyDef) };
    }
    return this.synergyCache.defs;
  }
  /** La synergie `id` est-elle active (toutes ses armes équipées) ? */
  hasSynergy(id: SynergyId) {
    this.synergyDefs();
    return this.synergyCache.ids.includes(id);
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
   * Fait venir le Frère Sonneur : il sort de terre à `at` (par défaut, à sa distance d'arrivée devant le joueur),
   * même si d'autres boss sont debout.
   */
  spawnBoss(at?: THREE.Vector3) {
    if (this.bossUp('sonneur') || this.phase !== 'run' || this.arriving) return null;
    this.bossDone = true;
    const p = this.player;
    const up = p.pos.clone().normalize();
    const where = at ?? up.clone().applyAxisAngle(new THREE.Vector3().crossVectors(up, p.facing).normalize(), FRERE_SONNEUR.spawnDist / PLANET_RADIUS);
    const z = this.spawnZombie('sonneur', where, p.pos.clone().sub(where.clone().setLength(p.pos.length())));
    if (!z) return null;
    z.emerge();
    const boss = new FrereSonneur(z, {
      playerPos: () => this.seenPos,
      playerHeight: () => this.player.pos.length() - this.groundAt(this.player.pos),
      hurtPlayer: (dir, damage) => this.hurtPlayer(z, dir, damage),
      onWave: (wat) => this.events.emit('bossWave', { boss, at: wat.clone() }),
      onPhase: (phase) => this.events.emit('bossPhase', { boss, phase }),
    });
    this.bosses.push(boss);
    this.events.emit('bossSpawned', { boss });
    return boss;
  }

  /** Un boss de la sorte `kind` est-il debout ? */
  bossUp(kind: BossKind) { return this.bosses.some((b) => b.kind === kind); }

  /** Porte du patron : elle s'ouvre et l'Abbé en sort (même si d'autres boss sont debout). */
  openDoor() {
    const at = this.door.pos;
    if (!at || this.door.open || this.phase !== 'run') return null;
    this.door.open = true;
    this.events.emit('doorOpened', { at: at.clone() });
    return this.spawnAbbe(at.clone().addScaledVector(this.door.facing, PATRON_DOOR.spawnAhead), this.door.facing.clone());
  }

  /** Fait venir l'Abbé à `at`, tourné vers `facing` (porte du patron, outils de dev). */
  spawnAbbe(at: THREE.Vector3, facing: THREE.Vector3) {
    if (this.bossUp('abbe') || this.phase !== 'run' || this.arriving) return null;
    const z = this.spawnZombie('abbe', at, facing);
    if (!z) return null;
    z.emerge();
    const boss: Abbe = new Abbe(z, {
      playerPos: () => this.seenPos,
      playerHeight: () => this.player.pos.length() - this.groundAt(this.player.pos),
      groundAt: (q) => this.groundAt(q),
      hurtPlayer: (dir, damage) => this.hurtPlayer(z, dir, damage),
      random: () => Math.random(),
      onPour: (puddles) => this.events.emit('winePoured', { boss, puddles }),
      onPhase: (phase) => this.events.emit('bossPhase', { boss, phase }),
    });
    this.bosses.push(boss);
    this.events.emit('bossSpawned', { boss });
    return boss;
  }

  /** Défie un boss optionnel qui attend : il entre en combat là où il est (même si d'autres boss sont debout). */
  challenge(b: GraveBoss) {
    if (!b.waiting || this.phase !== 'run') return null;
    const boss = this.spawnGraveBoss(b.kind, b.pos, b.facing);
    if (!boss) return null;
    b.waiting = false;
    this.events.emit('graveBossChallenged', { boss });
    return boss;
  }

  /** Fait entrer en combat le boss optionnel `kind` à `at`, tourné vers `facing`. */
  private spawnGraveBoss(kind: BossKind, at: THREE.Vector3, facing: THREE.Vector3) {
    if (this.bossUp(kind) || this.arriving || (kind !== 'vador' && kind !== 'logen' && kind !== 'xeno' && kind !== 'guts' && kind !== 'sauron')) return null;
    const z = this.spawnZombie(kind, at, facing);
    if (!z) return null;
    if (kind === 'sauron') {
      const K = SAURON.sweep.knock;
      const sauron: Sauron = new Sauron(z, {
        playerPos: () => this.seenPos,
        playerHeight: () => this.player.pos.length() - this.groundAt(this.player.pos),
        hurtPlayer: (dir, damage) => this.hurtPlayer(z, dir, damage),
        throwPlayer: (dir) => { if (!this.vehicles.driving && !this.knockImmune) this.player.knock(dir, K.speed, K.lift, K.decay); },
        onPhase: (phase) => this.events.emit('bossPhase', { boss: sauron, phase }),
        onSweep: (hit) => this.events.emit('sauronSweep', { boss: sauron, hit }),
        onSlam: (sat, hit) => this.events.emit('sauronSlam', { boss: sauron, at: sat, hit }),
        onWave: (wat) => this.events.emit('sauronWave', { boss: sauron, at: wat }),
        onGaze: (gat) => this.events.emit('sauronGaze', { boss: sauron, at: gat }),
      }, this.doom.dir);
      this.bosses.push(sauron);
      this.events.emit('bossSpawned', { boss: sauron });
      return sauron;
    }
    if (kind === 'guts') {
      const guts: Guts = new Guts(z, {
        playerPos: () => this.seenPos,
        hurtPlayer: (dir, damage) => this.hurtPlayer(z, dir, damage),
        onPhase: (phase) => this.events.emit('bossPhase', { boss: guts, phase }),
        onSweep: (hit) => this.events.emit('gutsSweep', { boss: guts, hit }),
        onSlam: (hit) => this.events.emit('gutsSlam', { boss: guts, hit }),
      });
      this.bosses.push(guts);
      this.events.emit('bossSpawned', { boss: guts });
      return guts;
    }
    if (kind === 'xeno') {
      const xeno: Xeno = new Xeno(z, {
        playerPos: () => this.seenPos,
        playerHeight: () => this.player.pos.length() - this.groundAt(this.player.pos),
        hurtPlayer: (dir, damage) => this.hurtPlayer(z, dir, damage),
        onPhase: (phase) => this.events.emit('bossPhase', { boss: xeno, phase }),
        onLeap: () => this.events.emit('xenoLeap', { boss: xeno }),
        onLand: (at, radius, hit) => this.events.emit('xenoLand', { boss: xeno, at, radius, hit }),
        onTail: (hit) => this.events.emit('xenoTail', { boss: xeno, hit }),
      });
      this.bosses.push(xeno);
      this.events.emit('bossSpawned', { boss: xeno });
      return xeno;
    }
    if (kind === 'logen') {
      const logen: Logen = new Logen(z, {
        playerPos: () => this.seenPos,
        hurtPlayer: (dir, damage) => this.hurtPlayer(z, dir, damage),
        onPhase: (phase) => this.events.emit('bossPhase', { boss: logen, phase }),
        onCharge: () => this.events.emit('logenCharge', { boss: logen }),
        onSpin: () => this.events.emit('logenSpin', { boss: logen }),
      });
      this.bosses.push(logen);
      this.events.emit('bossSpawned', { boss: logen });
      return logen;
    }
    const boss: Vador = new Vador(z, {
      playerPos: () => this.seenPos,
      hurtPlayer: (dir, damage) => this.hurtPlayer(z, dir, damage),
      onStrike: (sat, radius, hit) => this.events.emit('saberStrike', { boss, at: sat, radius, hit }),
      onPhase: (phase) => this.events.emit('bossPhase', { boss, phase }),
      onThrow: () => this.events.emit('saberThrown', { boss }),
      onCatch: () => this.events.emit('saberCaught', { boss }),
    });
    this.bosses.push(boss);
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
    if (weapon) damage *= this.stats.damage * this.itemDamageMul(z) * this.tournees.damageMul * this.anchorDamageMul();
    knock *= this.stats.knockback;
    const hpBefore = Math.max(0, z.hp);
    // Synergies actives : une arme marque le zombie (sonné), une autre lui fait plus de dégâts pendant ce temps
    const synergies = this.synergyDefs();
    let combo = false;
    for (const S of synergies) if (S.boosted && weapon?.id === S.boosted && z.dazed > 0) { damage *= S.mult ?? 1; combo = true; }
    // Dans le halo d'un porte-reliques : dégâts réduits
    const shield = this.horde.shieldOf(z);
    damage *= 1 - shield;
    damage *= 1 - z.armor;
    const up = this.tmp.copy(z.pos).normalize();
    const dir = vel.clone().addScaledVector(up, -vel.dot(up)).normalize();
    const killed = z.damage(damage, dir, knock);
    if (killed) {
      this.kills++;
      // Jauge de colère : chaque ennemi tué la remplit (bien plus pour un élite ou un boss)
      this.saiyanGain(z.def.boss ? SAIYAN.points.boss : z.elite ? SAIYAN.points.elite : SAIYAN.points.kill);
      // Parfois une capsule (Pièces) à la place de la goutte d'XP
      if (this.rollCoin()) this.coinDrops.drop(z.pos, COINS.value);
      else this.xp.drop(z.pos, z.def.xp);
      // Parfois une liasse de TUNAS en plus ; une grosse pour un élite
      if (z.elite) this.tunaDrops.drop(z.pos, TUNAS.elite);
      else if (this.rollTuna()) this.tunaDrops.drop(z.pos, TUNAS.value);
      // Rarement, une clochette du Dernier service en plus
      if (this.rollBell()) this.bellDrops.drop(z.pos, 1);
      // Rarement, une tournée du bar
      const tournee = this.rollTournee();
      if (tournee) this.tournees.drops.drop(z.pos, TOURNEE_IDS.indexOf(tournee));
    }
    for (const S of synergies) if (S.marker && !killed && weapon?.id === S.marker) z.dazed = (S.duration ?? 0) * this.stats.duration;
    if (weapon) this.afterWeaponHit(z, Math.min(damage, hpBefore), killed);
    this.events.emit('zombieHit', { weapon, zombie: z, damage, crit, killed, hpAfter: z.hp, impact: impact.clone(), dir, shielded: shield > 0, combo });
    // Le boss tué laisse un coffre gratuit de haute rareté, et la run continue (l'Abbé aussi : seule la Mort l'arrête)
    const bi = killed && z.def.boss ? this.bosses.findIndex((b) => b.zombie === z) : -1;
    if (bi >= 0) {
      const boss = this.bosses.splice(bi, 1)[0];
      const chest = this.chests.addFreeAt(z.pos);
      if (chest) chest.rarity = ({ abbe: ABBE, vador: VADOR, logen: LOGEN, xeno: XENO, guts: GUTS, sauron: SAURON, sonneur: FRERE_SONNEUR } as const)[boss.kind].chestRarity;
      if (boss.kind === 'abbe') this.abbeKilled = true;
      // Sauron lâche l'Anneau unique à côté de son coffre
      if (boss.kind === 'sauron' && !this.items.some((i) => i.item === 'anneau')) {
        const side = this.tmp.crossVectors(z.pos, z.facing).normalize();
        this.ringDrop = z.pos.clone().applyAxisAngle(side, SAURON.ring.offset / z.pos.length());
        this.events.emit('ringDropped', { at: this.ringDrop.clone() });
      }
      this.tunaDrops.drop(z.pos, TUNAS.boss[boss.kind]);
      this.events.emit('bossKilled', { boss, chest });
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

  /** Multiplicateur de dégâts des objets sur ce zombie (Gants de videur, Lunettes, Last order, l'Anneau). */
  private itemDamageMul(z: Zombie) {
    const P = this.effects.power;
    let mul = 1;
    if (P.closeDamage > 0 && z.pos.distanceTo(this.player.pos) < ITEM_EFFECTS.closeDamage.range) mul += P.closeDamage;
    if (P.eliteDamage > 0 && z.def.hp >= ITEM_EFFECTS.eliteDamage.minHp) mul += P.eliteDamage;
    if (P.lowHpDamage > 0 && this.health.ratio < ITEM_EFFECTS.lowHpDamage.below) mul += P.lowHpDamage;
    if (this.effects.invisible) mul += ITEM_EFFECTS.ring.damage;
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

  /** Un objet à usage unique (Senzu, Seconde tournée) vient de servir : un exemplaire quitte les objets du joueur. */
  private useUp(item: ItemId) {
    const i = this.items.findIndex((it) => it.item === item);
    if (i >= 0) this.items.splice(i, 1);
  }

  /** Seconde tournée : le joueur revient avec une part de ses PV, invulnérable un instant, l'onde repousse. */
  private revive() {
    const R = ITEM_EFFECTS.revive;
    this.effects.revives--;
    this.useUp('secondeTournee');
    this.health.hp = Math.max(1, Math.min(this.health.max, this.health.max * ITEMS.secondeTournee.value));
    this.health.invuln = R.invuln;
    this.effects.owed = 0;
    this.events.emit('revived', { hp: this.health.hp });
    this.shockwave(R.radius * this.stats.size, R.knock);
  }

  /** Effets d'objets qui vivent à chaque pas : minuteries, régénération, Écharpe, ardoise. */
  private updateItemEffects(dt: number) {
    const fx = this.effects.update(dt, this.stats.duration);
    // Senzu : sous le seuil, il en mange une et retrouve tous ses PV
    if (this.effects.senzus > 0 && !this.health.dead && this.health.hp < this.health.max * ITEM_EFFECTS.senzu.below) {
      this.effects.senzus--;
      this.health.hp = this.health.max;
      this.useUp('senzu');
      this.events.emit('senzuEaten', { left: this.effects.senzus });
    }
    // Tournées du bar : celles qui finissent rendent ce qu'elles avaient prêté
    for (const id of this.tournees.update(dt, this.ended)) {
      if (id === 'sousBock') this.stats.luck -= TOURNEE_FX.sousBock.luck;
      this.events.emit('tourneeEnded', { id });
    }
    if (fx.shieldUp) this.events.emit('foamShieldUp', {});
    if (fx.happyStart) this.events.emit('happyHourStarted', { duration: this.effects.happyLeft });
    if (fx.happyEnd) this.events.emit('happyHourEnded', {});
    // L'Anneau : les ennemis vont là où ils l'ont vu, puis le retrouvent quand il l'enlève
    if (fx.ringOn) {
      this.lastSeen.copy(this.player.pos);
      this.horde.setLost(this.lastSeen);
      this.events.emit('ringOn', { duration: this.effects.ringLeft });
    }
    if (fx.ringOff) {
      this.horde.setLost(null);
      this.events.emit('ringOff', {});
    }
    this.stats.rateMul = this.effects.rateMul;
    this.stats.extraShotChance = this.effects.extraShotChance;
    // Ardoise du bar : la part de la dette qui tombe maintenant
    if (fx.owedNow > 0 && !this.cheats.god) this.health.hp = Math.max(0, this.health.hp - fx.owedNow);
    // Régénération ; Casquette à bière : en plus quand le joueur ne bouge pas
    let regen = this.stats.regen + this.tournees.regen;
    if (this.effects.power.standRegen > 0 && this.player.velocity.length() < ITEM_EFFECTS.standRegen.still) regen += this.effects.power.standRegen;
    // Accoudé (le Pilier de bar) : l'ancrage monte quand il ne bouge pas, retombe dès qu'il bouge
    const anchor = (CHARACTERS[this.character] as { anchor?: CharacterDef['anchor'] }).anchor;
    if (anchor) {
      const still = this.player.velocity.length() < anchor.still;
      this.anchor = THREE.MathUtils.clamp(this.anchor + (still ? dt / anchor.buildTime : -dt / anchor.dropTime), 0, 1);
      regen += this.anchor * anchor.regen;
    }
    if (regen > 0) this.health.heal(regen * dt);
    // Écharpe de supporter : entouré, il court plus vite (et prend l'armure en plus)
    if (this.effects.has('crowdBoost')) {
      const C = ITEM_EFFECTS.crowdBoost;
      let n = 0;
      for (const o of this.horde.near(this.player.pos, C.radius, this.around)) if (o.pos.distanceTo(this.player.pos) < C.radius && ++n >= C.count) break;
      this.effects.crowded = n >= C.count;
    }
    // Vitesse : stat du joueur, Écharpe entouré, Péket
    // Sprint de la Serveuse après une esquive
    this.sprintIn = Math.max(0, this.sprintIn - dt);
    const sprint = this.sprintIn > 0 ? (CHARACTERS[this.character] as { dodgeSprint?: { speedMul: number } }).dodgeSprint?.speedMul ?? 1 : 1;
    this.player.speed = BASE_SPEED * this.stats.moveSpeed * (this.effects.crowded ? 1 + this.effects.power.crowdBoost : 1) * this.tournees.speedMul * sprint;
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
    // Le Père Noël (passif du perso) : un coffre gratuit près de lui à intervalle régulier
    const every = (CHARACTERS[this.character] as { freeChestEvery?: number }).freeChestEvery;
    let gift = false;
    if (every && this.phase === 'run' && (this.giftIn -= dt) <= 0) { this.giftIn += every; gift = true; }
    // Bonnet du Père Noël : un coffre gratuit tombe près du joueur
    if (fx.freeChest || gift) {
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

  /** XP ramassée pendant la run (le Rot sonique se charge avec). */
  xpGathered = 0;
  /** Temps avant le prochain cadeau du Père Noël (s). */
  private giftIn = 0;
  /** Ancrage du Pilier de bar, de 0 (il bouge) à 1 (accoudé depuis assez longtemps). */
  anchor = 0;
  /** Multiplicateur de dégâts de l'ancrage (1 pour les autres persos). */
  anchorDamageMul() {
    const a = (CHARACTERS[this.character] as { anchor?: CharacterDef['anchor'] }).anchor;
    return a ? 1 + this.anchor * a.damage : 1;
  }
  /** Temps restant du sprint de la Serveuse (après une esquive). */
  private sprintIn = 0;
  /** Contrôle d'alcoolémie (le Cop) : quand chaque ennemi peut de nouveau être figé (temps de run). */
  private stunReady = new WeakMap<Zombie, number>();

  /** Le Cop fige l'ennemi qui le touche (pas les boss), au plus une fois toutes les `cooldown` s par ennemi. */
  private contactStun(z: Zombie) {
    const S = (CHARACTERS[this.character] as { contactStun?: { duration: number; cooldown: number } }).contactStun;
    if (!S || z.dead || z.def.boss || (this.stunReady.get(z) ?? -1) > this.runTime) return;
    this.stunReady.set(z, this.runTime + S.cooldown);
    z.frozen = Math.max(z.frozen, S.duration);
  }

  private collectXp(amount: number) {
    this.xpGathered += amount;
    this.events.emit('xpCollected', { amount });
    this.addXp(amount);
  }

  /** Le joueur encaisse un coup de `z` (au contact ou à distance ; null : un piège), venant de la direction `dir`. */
  private hurtPlayer(z: Zombie | null, dir: THREE.Vector3, baseDamage: number) {
    // Invisible (l'Anneau) : rien ne le touche
    if (this.effects.invisible) return;
    let damage = baseDamage * this.mods.damage;
    // Au volant, c'est le véhicule qui encaisse
    if (this.vehicles.driving) { this.hitVehicle(damage); return; }
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
    // Une arme qui bloque le coup (absorbHit), puis courte invulnérabilité, comme un coup
    if (!this.cheats.god && this.health.invuln <= 0 && !this.health.dead && this.loadout.weapons.some((w) => w.absorbHit?.(z))) {
      this.health.invuln = PLAYER_STATS.invulnTime;
      this.events.emit('playerHurt', { zombie: z, dir, damage: 0, hp: this.health.hp, blocked: true });
      return;
    }
    // Mousse épaisse : le bouclier absorbe le coup entier (puis courte invulnérabilité, comme un coup)
    if (!this.cheats.god && this.health.invuln <= 0 && !this.health.dead && this.effects.absorb()) {
      this.health.invuln = PLAYER_STATS.invulnTime;
      this.events.emit('foamShieldPopped', { zombie: z });
      return;
    }
    // Ultra Instinct : rien ne le touche, sauf un boss
    if (!this.cheats.god && this.health.invuln <= 0 && !this.health.dead && this.saiyan.current?.dodgeAll && !z?.def.boss) {
      this.health.invuln = PLAYER_STATS.invulnTime;
      this.events.emit('playerDodged', { zombie: z, instinct: true });
      return;
    }
    // Démarche de pochtron : il titube, le coup passe à côté
    if (!this.cheats.god && this.health.invuln <= 0 && !this.health.dead && this.stats.dodgeChance > 0 && this.random() < this.stats.dodgeChance) {
      this.health.invuln = PLAYER_STATS.invulnTime;
      this.events.emit('playerDodged', { zombie: z, instinct: false });
      const sprint = (CHARACTERS[this.character] as { dodgeSprint?: { duration: number } }).dodgeSprint;
      if (sprint) this.sprintIn = sprint.duration;
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
      if (!this.knockImmune) this.player.knock(dir, ZOMBIE_ATTACK.knockSpeed, ZOMBIE_ATTACK.knockLift, ZOMBIE_ATTACK.knockDecay);
      return;
    }
    // Invulnérable juste après un coup : ni dégâts ni recul (pas d'enchaînement de coups)
    const took = !this.cheats.god && this.health.damage(damage);
    if (took) this.saiyanGain(damage * SAIYAN.points.perHpLost);
    this.events.emit('playerHurt', { zombie: z, dir, damage, hp: this.health.hp, blocked: !took });
    if (!took) return;
    if (!this.knockImmune) this.player.knock(dir, ZOMBIE_ATTACK.knockSpeed, ZOMBIE_ATTACK.knockLift, ZOMBIE_ATTACK.knockDecay);
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
    // Vers la radio si elle joue (leurre), sinon vers le joueur
    const to = (this.horde.decoy ?? this.seenPos).clone().normalize();
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
    // La radio qui joue encaisse aussi les bouteilles qui tombent sur elle
    const r = this.radio.pos;
    if (this.radio.state === 'playing' && r && r.angleTo(s.to) * PLANET_RADIUS < s.radius + RADIO.reach * 0.5) this.hitRadio(s.damage);
    this.events.emit('enemyShotLanded', { shot: s, hit });
  }

  private offerCards(first: boolean) {
    // Armes débloquées en boutique pas encore équipées
    const available = this.loadout.full ? [] : (Object.keys(WEAPON_FACTORIES) as WeaponId[]).filter((id) => !this.loadout.has(id) && (!this.unlocks || this.unlocks.weapons.has(id)));
    const ready = readyToEvolve(this.loadout.weapons, (item) => this.items.some((i) => i.item === item));
    const count = (CHARACTERS[this.character] as { levelUpCards?: number }).levelUpCards ?? LEVEL_UP_SCREEN.cards;
    const cards = rollCards(count, this.stats.luck, this.loadout.weapons, available, LEVEL_UP_SCREEN.newWeaponBelow, (k) => this.banned.has(k), ready);
    if (!cards.length) { this.progression.pending = 0; this.offer = null; this.offerKind = null; return; }
    // Une nouvelle arme annonce les synergies qu'elle activerait
    for (const c of cards) if (c.kind === 'weapon') c.synergies = synergiesCompletedBy(c.weaponId, (x) => this.loadout.has(x));
    this.offer = cards;
    this.offerKind = 'level';
    const level = this.progression.level - this.progression.pending + 1;
    this.events.emit('levelUpOffered', { level, cards, first });
  }

  /**
   * Le pouvoir d'un allié. Gandalf pétrifie les ennemis autour de lui ; Krilin lance un Kienzan vers le plus proche ;
   * Yoda les repousse et les sonne ; Steve pose un bloc de TNT. Les boss ne sont ni pétrifiés ni sonnés.
   */
  private allyPower(a: Ally) {
    const P: AllyPower = ALLIES[a.kind].power;
    let n = 0, radius = 0;
    if (P.kind === 'petrify' || P.kind === 'push') {
      radius = P.radius;
      for (const o of this.horde.near(a.pos, P.radius, this.around)) {
        if (!o.targetable || o.dead || o.pos.distanceTo(a.pos) > P.radius) continue;
        if (P.kind === 'petrify') {
          if (o.def.boss) continue;
          o.frozen = Math.max(o.frozen, P.duration);
        } else {
          const dir = o.pos.clone().sub(a.pos);
          const up = this.tmp.copy(o.pos).normalize();
          dir.addScaledVector(up, -dir.dot(up));
          if (dir.lengthSq() < 1e-6) dir.copy(a.facing);
          o.damage(0, dir.normalize(), P.knock);
          if (!o.def.boss) this.freeze(o, P.stun);
        }
        n++;
      }
    } else if (P.kind === 'kienzan') {
      let best: Zombie | null = null, bestD = P.range;
      for (const o of this.horde.near(a.pos, P.range, this.around)) {
        if (!o.targetable || o.dead) continue;
        const d = o.pos.distanceTo(a.pos);
        if (d < bestD) { bestD = d; best = o; }
      }
      // Personne à portée : il garde son disque pour plus tard
      if (!best) { a.cooldown = 0.5; return; }
      const up = a.pos.clone().normalize();
      const dir = best.pos.clone().sub(a.pos);
      dir.addScaledVector(up, -dir.dot(up)).normalize();
      a.facing.copy(dir);
      this.allies.discs.push({ pos: a.pos.clone(), dir, left: P.reach, hit: new Set() });
      n = 1;
    } else {
      radius = P.radius;
      const at = a.pos.clone().addScaledVector(a.facing, 0.9);
      at.normalize().multiplyScalar(PLANET_RADIUS + heightAt(at.clone().normalize()));
      this.allies.tnts.push({ pos: at, fuse: P.fuse, fuseTime: P.fuse });
      this.events.emit('tntPlaced', { pos: at.clone(), fuse: P.fuse });
    }
    this.events.emit('allyPower', { kind: a.kind, pos: a.pos.clone(), radius, targets: n });
  }

  /** Ce que les alliés ont lancé ou posé : les Kienzan filent et tranchent, les blocs de TNT explosent. Le soin de Krilin. */
  private updateAllyThings(dt: number) {
    const hpMul = spawnCurveAt(this.runTime).hpMul * this.mods.hp;
    // Krilin soigne tant qu'il suit le joueur
    const K = ALLIES.krilin.power;
    if (this.allies.list.some((a) => a.kind === 'krilin' && a.state === 'following') && !this.health.dead) {
      const before = this.health.hp;
      this.health.heal(K.heal * dt);
      this.allyHealed += this.health.hp - before;
      if ((this.allyHealTimer -= dt) <= 0) {
        this.allyHealTimer = ALLY_FX.healPulse;
        this.events.emit('allyHealed', { amount: this.allyHealed });
        this.allyHealed = 0;
      }
    }
    const discs = this.allies.discs;
    for (let i = discs.length - 1; i >= 0; i--) {
      const d = discs[i];
      const step = Math.min(d.left, K.speed * dt);
      d.pos.addScaledVector(d.dir, step);
      const up = this.tmp.copy(d.pos).normalize();
      d.pos.copy(up).multiplyScalar(PLANET_RADIUS + heightAt(up));
      d.dir.addScaledVector(up, -d.dir.dot(up)).normalize();
      d.left -= step;
      for (const o of this.horde.near(d.pos, K.width + 1, this.around)) {
        if (!o.targetable || o.dead || d.hit.has(o) || o.pos.distanceTo(d.pos) > K.width) continue;
        d.hit.add(o);
        this.hitZombie(o, K.damage * hpMul, false, o.pos, d.dir.clone(), null, 0.5);
      }
      if (d.left <= 0) { discs.splice(i, 1); this.events.emit('kienzanFaded', { pos: d.pos.clone() }); }
    }
    const T = ALLIES.steve.power;
    const tnts = this.allies.tnts;
    for (let i = tnts.length - 1; i >= 0; i--) {
      const t = tnts[i];
      if ((t.fuse -= dt) > 0) continue;
      tnts.splice(i, 1);
      for (const o of this.horde.near(t.pos, T.radius, this.around)) {
        if (!o.targetable || o.dead || o.pos.distanceTo(t.pos) > T.radius) continue;
        this.hitZombie(o, T.damage * hpMul, false, o.pos, o.pos.clone().sub(t.pos), null, T.knock);
      }
      this.events.emit('tntExploded', { pos: t.pos.clone(), radius: T.radius });
    }
  }
  /** Soin de Krilin cumulé depuis la dernière lueur, et temps avant la suivante. */
  private allyHealed = 0;
  private allyHealTimer = 0;

  /** Atterrissage : la première horde sort de terre autour du joueur. */

  /** Naruto attrapé : il laisse un coffre gratuit de haute rareté là où il était. */
  private catchNaruto() {
    const at = this.naruto.pos!.clone();
    const chest = this.chests.addFreeAt(at);
    if (chest) chest.rarity = NARUTO.chestRarity;
    this.naruto.clear();
    this.events.emit('narutoCaught', { at, chest });
  }

  /** La radio s'allume : elle devient le leurre de la horde. */
  private turnRadioOn() {
    if (!this.radio.turnOn() || !this.radio.pos) return;
    this.horde.setDecoy(this.radio.pos, RADIO.reach);
    this.events.emit('radioOn', { pos: this.radio.pos.clone() });
  }

  /** Un ennemi frappe la radio ; cassée, la horde revient vers le joueur. */
  private hitRadio(damage: number) {
    if (this.radio.state !== 'playing') return;
    const broke = this.radio.hit(damage);
    this.events.emit('radioHit', { hp: this.radio.hp, maxHp: this.radio.maxHp });
    if (broke) {
      this.horde.setDecoy(null);
      this.events.emit('radioBroken', { pos: this.radio.pos!.clone() });
    }
  }

  /** Bonus de mécanique du skill tree (0 sans palier acheté). */
  private perk(id: PerkId) { return this.unlocks?.perks?.[id] ?? 0; }

  /** Remplit la jauge de colère (plus vite avec la ligne Super Saiyan) ; annonce le palier tout juste atteint. */
  private saiyanGain(points: number) {
    const tier = this.saiyan.gain(points * (1 + this.perk('saiyanGain')));
    if (tier) this.events.emit('saiyanTierReached', { tier, name: SAIYAN.tiers[tier - 1].name });
  }

  /** Transformation au plus haut palier atteint : ses bonus de stat s'appliquent pour la durée. */
  private transformSaiyan() {
    const tier = this.saiyan.transform();
    if (!tier) return;
    const T = SAIYAN.tiers[tier - 1];
    for (const [stat, v] of Object.entries(T.stats) as [ItemStatId, number][]) this.applyStatBonus(stat, v, true);
    this.events.emit('saiyanTransformed', { tier, name: T.name, duration: this.saiyan.duration });
  }

  /** Pendant la transformation : coût du Kaioken, éclairs du SSJ2 ; à la fin, les bonus sont retirés. */
  private updateSaiyan(dt: number) {
    const T = this.saiyan.current;
    if (!T) return;
    // Kaioken : il brûle ses PV, sans jamais tomber sous 1
    if (T.hpDrain && !this.cheats.god) this.health.hp = Math.max(Math.min(this.health.hp, 1), this.health.hp - T.hpDrain * dt);
    // SSJ2 : un éclair sur l'ennemi le plus proche
    if (T.lightning && (this.saiyan.lightningIn -= dt) <= 0) {
      const L = T.lightning;
      let best: Zombie | null = null, bestD = L.range;
      for (const o of this.horde.near(this.player.pos, L.range, this.around)) {
        if (!o.targetable || o.dead) continue;
        const d = o.pos.distanceTo(this.player.pos);
        if (d < bestD) { bestD = d; best = o; }
      }
      if (best) {
        this.saiyan.lightningIn = L.every;
        const from = this.player.pos.clone().addScaledVector(this.player.upDir, 1.4);
        this.events.emit('saiyanLightning', { from, to: best.pos.clone() });
        this.hitZombie(best, L.damage * spawnCurveAt(this.runTime).hpMul * this.mods.hp, false, best.pos, best.pos.clone().sub(this.player.pos), null, 0.5);
      }
    }
    const tier = this.saiyan.tier;
    if (this.saiyan.update(dt)) {
      for (const [stat, v] of Object.entries(T.stats) as [ItemStatId, number][]) this.applyStatBonus(stat, -v, true);
      this.events.emit('saiyanEnded', { tier });
    }
  }

  /** Le joueur monte dans le véhicule garé : il prend sa place, capot devant, et passe en conduite. */
  private enterVehicle(v: ParkedVehicle) {
    const driven = this.vehicles.enter(v);
    this.player.reset(v.pos, v.facing);
    this.player.drive(VEHICLES[driven.kind].car);
    this.events.emit('vehicleEntered', { kind: driven.kind, pos: v.pos.clone() });
  }

  /** Un pas au volant : le temps qui file, et les ennemis écrasés sur le passage. */
  private driveVehicle(dt: number) {
    const v = this.vehicles.driving!;
    v.left -= dt;
    v.hitCooldown = Math.max(0, v.hitCooldown - dt);
    if (v.left <= 0) { this.exitVehicle('timeout'); return; }
    const C = VEHICLES[v.kind].crush;
    const p = this.player;
    this.tankCannon(dt, v);
    const speed = Math.abs(p.carSpeed);
    if (speed < C.minSpeed) return;
    const up = this.tmp.copy(p.pos).normalize();
    const base = (C.damage + C.perSpeed * speed) * spawnCurveAt(this.runTime).hpMul * this.mods.hp * (1 + this.perk('vehicleCrush'));
    for (const o of this.horde.near(p.pos, C.radius, this.around)) {
      if (!o.targetable || o.dead || o.pos.distanceTo(p.pos) > C.radius) continue;
      if ((this.crushReady.get(o) ?? 0) > this.runTime) continue;
      this.crushReady.set(o, this.runTime + C.again);
      // Projeté vers l'avant et sur le côté où il se trouve
      const away = o.pos.clone().sub(p.pos);
      away.addScaledVector(up, -away.dot(up));
      const push = p.velocity.clone().normalize().add(away.normalize()).multiplyScalar(speed);
      const killed = this.hitZombie(o, base * (o.def.boss ? C.bossMul : 1), false, o.pos, push, null, C.knock);
      this.events.emit('vehicleCrushed', { zombie: o, pos: o.pos.clone(), killed, speed });
    }
  }

  /** Canon du tank : un obus sur l'ennemi le plus proche à portée, qui explose à l'arrivée. */
  private tankCannon(dt: number, v: NonNullable<Vehicles['driving']>) {
    const K = (VEHICLES[v.kind] as { cannon?: { every: number; range: number; speed: number; damage: number; radius: number; knock: number } }).cannon;
    if (!K) return;
    v.reload -= dt;
    if (v.reload > 0) return;
    let best: Zombie | null = null, bestD = K.range;
    for (const o of this.horde.near(this.player.pos, K.range, this.around)) {
      if (!o.targetable || o.dead) continue;
      const d = o.pos.distanceTo(this.player.pos);
      if (d < bestD) { bestD = d; best = o; }
    }
    if (!best) return;
    v.reload = K.every;
    const from = this.player.pos.clone().addScaledVector(this.player.upDir, 2.2);
    const to = best.pos.clone();
    v.aim = to.clone();
    const flight = Math.max(0.05, from.distanceTo(to) / K.speed);
    this.vehicles.shells.push({ from, to, left: flight, flight });
    this.events.emit('tankFired', { from: from.clone(), to: to.clone(), flight });
  }

  /** Les obus en vol avancent ; à l'arrivée, ils explosent sur les ennemis autour. */
  private updateShells(dt: number) {
    const shells = this.vehicles.shells;
    for (let i = shells.length - 1; i >= 0; i--) {
      const s = shells[i];
      if ((s.left -= dt) > 0) continue;
      shells.splice(i, 1);
      const K = VEHICLES.tank.cannon;
      const r = K.radius * this.stats.size;
      const damage = K.damage * spawnCurveAt(this.runTime).hpMul * this.mods.hp;
      for (const o of this.horde.near(s.to, r, this.around)) {
        if (!o.targetable || o.dead || o.pos.distanceTo(s.to) > r) continue;
        this.hitZombie(o, damage * (o.def.boss ? VEHICLES.tank.crush.bossMul : 1), false, o.pos, o.pos.clone().sub(s.to), null, K.knock);
      }
      this.events.emit('tankShellExploded', { pos: s.to.clone(), radius: r });
    }
  }

  /** Le véhicule encaisse un coup (un court délai entre deux) ; à 0 PV, il est détruit et le joueur descend. */
  private hitVehicle(damage: number) {
    const v = this.vehicles.driving!;
    if (v.hitCooldown > 0 || this.cheats.god) return;
    v.hp = Math.max(0, v.hp - damage);
    v.hitCooldown = VEHICLE_SPAWN.hitAgain;
    this.events.emit('vehicleHit', { damage, hp: v.hp, maxHp: v.maxHp });
    if (v.hp <= 0) this.exitVehicle('destroyed');
  }

  /** Le joueur descend du véhicule, invulnérable un instant. */
  private exitVehicle(reason: 'timeout' | 'destroyed' | 'end') {
    const v = this.vehicles.driving;
    if (!v) return;
    this.vehicles.exit();
    this.player.drive(null);
    if (reason !== 'end') this.health.invuln = Math.max(this.health.invuln, VEHICLE_SPAWN.exitInvuln);
    this.events.emit('vehicleExited', { kind: v.kind, reason, pos: this.player.pos.clone() });
  }

  private land() {
    this.arriving = false;
    this.director.start(this.mods.count);
    this.events.emit('landed', { pos: this.player.pos.clone() });
  }

  private die() {
    this.exitVehicle('end');
    this.phase = 'dead';
    this.deadTime = 0;
    this.horde.setPassive(true);
    this.events.emit('died', {});
    // Bonus de fin : le temps survécu rapporte des TUNAS (à la mort seulement : abandonner n'est pas une astuce)
    const tunasBonus = Math.floor((this.runTime / 60) * TUNAS.endBonusPerMinute * this.tunaMul + 1e-9);
    this.achievements.check(true);
    this.events.emit('runEnded', { reason: 'mort', survived: this.runTime, kills: this.kills, tunas: Math.floor(this.tunas + 1e-9) + tunasBonus, tunasBonus, difficulty: this.difficulty, abbe: this.abbeKilled, achievements: [...this.achievements.gained], character: this.character });
  }

  /** Vitesse du temps : ralenti juste après la mort, puis retour progressif. */
  private timeScale() {
    if (this.deadTime < 0) return 1;
    const S = DEATH.slowMo;
    if (this.deadTime < S.hold) return S.scale;
    return THREE.MathUtils.lerp(S.scale, 1, Math.min(1, (this.deadTime - S.hold) / S.ramp));
  }

  private resetRun() {
    this.exitVehicle('end');
    this.radio.clear();
    this.allies.clear();
    this.naruto.clear();
    this.horde.setDecoy(null);
    this.saiyan.reset();
    this.vehicles.clear();
    this.crushReady = new WeakMap();
    this.xpGathered = 0;
    this.stunReady = new WeakMap();
    this.sprintIn = 0;
    this.anchor = 0;
    this.giftIn = (CHARACTERS[this.character] as { freeChestEvery?: number }).freeChestEvery ?? 0;
    this.deadTime = -1;
    this.arriving = false;
    this.menuPaused = false;
    this.offer = null;
    this.offerKind = null;
    this.reveal = null;
    this.banned.clear();
    const o = this.unlocks?.options;
    this.cardOptions = { reroll: o?.reroll ?? 0, banish: o?.banish ?? 0, skip: o?.skip ?? 0 };
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
    this.bosses.length = 0;
    this.bossDone = false;
    this.abbeKilled = false;
    this.achievements.reset();
    this.door.clear();
    this.graveBosses.clear();
    this.ringDrop = null;
    this.horde.setLost(null);
    this.closing.clear();
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
    this.tunaDrops.clear();
    this.tunas = 0;
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
