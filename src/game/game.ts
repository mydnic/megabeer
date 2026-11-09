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
    };
    this.loadout = new Loadout(this.weaponCtx, deps.startingWeapon ?? 'canette');
    this.mechanic = MAP_MECHANICS[deps.map ?? 'abbaye'](this);
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
    if (card.kind === 'weapon') this.equip(card.weaponId);
    else applyCard(card);
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
    this.shots.update(dt, (s) => this.shotLanded(s));
    this.health.update(dt);
    if (this.phase === 'run' && this.health.dead) this.die();
    if (this.phase === 'run' && !this.arriving) {
      this.runTime += dt;
      if (!frozen) {
        this.director.update(dt, this.runTime, this.mods.count);
        this.mechanic.update(dt);
      }
      this.loadout.update(dt);
      this.events.emit('tick', { dt });
    }
    this.loadout.updateProjectiles(dt);
    this.chest.copy(p.renderPos).addScaledVector(p.upDir, 1.0);
    this.xp.update(dt, this.chest, this.phase === 'run' ? this.stats.pickupRange : 0, (v) => this.collectXp(v * this.stats.xpGain));
    return dt;
  }

  // ------------------------------------------------------------------ combat et XP

  /** Multiplicateurs de la difficulté choisie. */
  get mods() { return DIFFICULTIES[this.difficulty]; }

  /**
   * Fait apparaître un zombie au sol à la direction `at`, tourné vers `facing`. Plus la run avance,
   * plus il a de PV (courbe de la run et difficulté).
   */
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
      this.xp.drop(z.pos, z.def.xp);
    }
    for (const S of synergies) if (!killed && weapon?.id === S.marker) z.dazed = S.duration;
    this.events.emit('zombieHit', { weapon, zombie: z, damage, crit, killed, hpAfter: z.hp, impact: impact.clone(), dir, shielded: shield > 0, combo });
    // Un kamikaze tué explose sur place
    if (killed && z.def.kamikaze) this.explode(z, true);
    // Un diviseur tué se sépare en petits
    if (killed && z.def.splitter) this.split(z);
    return killed;
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
    const damage = baseDamage * this.mods.damage;
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
    this.runTime = 0;
    this.kills = 0;
    this.acc = 0;
    this.health.reset();
    this.progression.reset();
    this.stats.reset();
    this.loadout.reset();
    this.horde.clear();
    this.horde.setPassive(false);
    this.director.reset();
    this.mechanic?.reset();
    this.xp.clear();
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
