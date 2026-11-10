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
import { CHESTS } from '../config/chests';
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
  /** Touche d'action sur un coffre sans assez de capsules. */
  chestDenied: { chest: Chest; price: number; coins: number };
  /** Objet pris dans un coffre. */
  itemGained: { item: ItemId; rarity: number; mult: number };
  /** Glaçons ou Sifflet : un ennemi gèle (ou est étourdi) `time` s. */
  zombieFrozen: { zombie: Zombie; time: number };
  /** Démarche de pochtron : le joueur esquive le coup de `zombie`. */
  playerDodged: { zombie: Zombie };
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
  /** Mousse épaisse : le bouclier absorbe un coup de `zombie`. */
  foamShieldPopped: { zombie: Zombie };
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
  /** Hasard des effets d'objets (0 à 1, par défaut Math.random). */
  random?: () => number;
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
    this.horde = createHorde(deps.zombieKinds, player, deps.collider);
    this.pumps = new Pumps(deps.collider);
    this.chests = new Chests(deps.collider);
    this.horde.onHit = (z, dir) => this.hurtPlayer(z, dir, z.def.damage);
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
    });
    const self = this;
    this.weaponCtx = {
      zombies: () => this.horde.zombies,
      playerPos: () => player.pos,
      stats: this.stats,
      rig: defaultRig(player),
      groundAt,
      hitZombie: (weapon, z, damage, crit, impact, vel, knock) => { self.hitZombie(z, damage, crit, impact, vel, weapon, knock); },
      hitGround: (weapon, pos, vel) => this.events.emit('projectileHitGround', { weapon, pos, vel }),
      blocked: (p, margin) => deps.collider.occupied(p, margin),
      explode: (weapon, pos, radius) => this.events.emit('weaponExploded', { weapon, pos: pos.clone(), radius }),
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
    this.resetRun();
    this.phase = 'run';
    this.player.reset(spawn.dir, spawn.facing);
    this.pumps.place(spawn.dir);
    this.chests.place(spawn.dir, this.pumps.list.map((p) => p.pos));
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
        if (input.actionPressed && this.chests.focus && !this.offer) this.openChest(this.chests.focus);
      }
      if (!frozen) this.updateItemEffects(dt);
      this.loadout.update(dt);
      this.events.emit('tick', { dt });
    }
    this.loadout.updateProjectiles(dt);
    this.chest.copy(p.renderPos).addScaledVector(p.upDir, 1.0);
    this.xp.update(dt, this.chest, this.phase === 'run' ? this.stats.pickupRange : 0, (v) => {
      this.collectXp(v * this.stats.xpGain);
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
    const rarity = rollTier(this.stats.luck);
    const cards = rollItemCards(rarity, CHESTS.choices);
    const duration = CHESTS.revealTime + CHESTS.revealPerRarity * rarity;
    this.reveal = { chest, price, rarity, cards, left: duration };
    this.events.emit('chestRevealing', { chest, rarity, duration });
  }

  /** Synergies actives (toutes leurs armes équipées). */
  activeSynergies() { return activeSynergies((id) => this.loadout.has(id)); }

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

  spawnZombie(enemy: EnemyId, at: THREE.Vector3, facing: THREE.Vector3) {
    const z = this.horde.spawn(enemy, at, facing);
    if (z) z.hp = Math.round(ENEMIES[enemy].hp * spawnCurveAt(this.runTime).hpMul * this.mods.hp);
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
    if (weapon) damage *= this.stats.damage * this.itemDamageMul(z);
    knock *= this.stats.knockback;
    const hpBefore = Math.max(0, z.hp);
    // Synergies actives : une arme marque le zombie (sonné), une autre lui fait plus de dégâts pendant ce temps
    const synergies = this.activeSynergies().map((s) => SYNERGIES[s]);
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
    }
    for (const S of synergies) if (!killed && weapon?.id === S.marker) z.dazed = S.duration * this.stats.duration;
    if (weapon) this.afterWeaponHit(z, Math.min(damage, hpBefore), killed);
    this.events.emit('zombieHit', { weapon, zombie: z, damage, crit, killed, hpAfter: z.hp, impact: impact.clone(), dir, shielded: shield > 0, combo });
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
    for (const o of this.horde.alive()) {
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
    for (const o of this.horde.alive()) {
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
    if (fx.shieldUp) this.events.emit('foamShieldUp', {});
    if (fx.happyStart) this.events.emit('happyHourStarted', { duration: this.effects.happyLeft });
    if (fx.happyEnd) this.events.emit('happyHourEnded', {});
    this.stats.rateMul = this.effects.rateMul;
    this.stats.extraShotChance = this.effects.extraShotChance;
    // Ardoise du bar : la part de la dette qui tombe maintenant
    if (fx.owedNow > 0 && !this.cheats.god) this.health.hp = Math.max(0, this.health.hp - fx.owedNow);
    // Régénération ; Casquette à bière : en plus quand le joueur ne bouge pas
    let regen = this.stats.regen;
    if (this.effects.power.standRegen > 0 && this.player.velocity.length() < ITEM_EFFECTS.standRegen.still) regen += this.effects.power.standRegen;
    if (regen > 0) this.health.heal(regen * dt);
    // Écharpe de supporter : entouré, il court plus vite (et prend l'armure en plus)
    if (this.effects.has('crowdBoost')) {
      const C = ITEM_EFFECTS.crowdBoost;
      let n = 0;
      for (const o of this.horde.alive()) if (o.pos.distanceTo(this.player.pos) < C.radius && ++n >= C.count) break;
      this.effects.crowded = n >= C.count;
      this.player.speed = BASE_SPEED * this.stats.moveSpeed * (this.effects.crowded ? 1 + this.effects.power.crowdBoost : 1);
    }
    // Sifflet d'arbitre : étourdit les ennemis proches
    if (fx.whistle) {
      const W = ITEM_EFFECTS.whistle, radius = W.radius * this.stats.size;
      this.events.emit('whistleBlown', { at: this.player.pos.clone(), radius });
      for (const o of this.horde.alive()) {
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

  /** Le joueur encaisse un coup de `z` (au contact ou à distance), venant de la direction `dir`. */
  private hurtPlayer(z: Zombie, dir: THREE.Vector3, baseDamage: number) {
    let damage = baseDamage * this.mods.damage;
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
      this.hurtPlayer(z, dir.normalize(), K.damage);
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
    const shot = this.shots.launch(z, from, to, T, T.damage);
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
