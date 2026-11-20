import { PUMP_TIERS } from '../config/pumps';
import { ALLIES } from '../config/allies';
import { SYNERGIES } from '../config/weapons';
import { SYNERGY_BANNER } from '../config/hud';
import { AUDIO } from '../config/audio';
import type { AudioEngine } from '../audio/audio';
import { isTouchDevice, type InputState } from '../core/input';
import { loadSettings, saveSettings } from '../core/settings';
import type { Game } from '../game/game';
import { createAlcoholHud } from '../ui/alcoholHud';
import { createPumpGauge } from '../ui/pumpGauge';
import { createMinimap } from '../ui/minimap';
import { createChestPrompt } from '../ui/chestPrompt';
import { LAST_CALL_TEXT } from '../config/lastCall';
import { createChestReveal, revealSchedule } from '../ui/chestReveal';
import { capsuleIcon } from '../ui/icons';
import { RARITIES } from '../config/upgrades';
import { createDeathBanner } from '../ui/deathBanner';
import { createEventBanner } from '../ui/eventBanner';
import { createHealthHud } from '../ui/healthHud';
import { createHomeScreen } from '../ui/homeScreen';
import { weaponIcon } from '../ui/icons';
import { createLevelUpScreen } from '../ui/levelUpScreen';
import { createLoadingScreen } from '../ui/loadingScreen';
import { createOptionsPanel } from '../ui/optionsPanel';
import { createPauseMenu, type PauseStats } from '../ui/pauseMenu';
import { createRunHud } from '../ui/runHud';
import { toRow } from '../ui/statFormat';
import { createWeaponHud, type WeaponSlot } from '../ui/weaponHud';
import { createItemHud } from '../ui/itemHud';
import { createTourneeHud } from '../ui/tourneeHud';
import { createBossBar } from '../ui/bossBar';
import { createVehicleHud } from '../ui/vehicleHud';
import { createSaiyanHud } from '../ui/saiyanHud';
import { isTouchDevice as touchScreen } from '../core/input';
import { VEHICLES } from '../config/vehicles';
import { BOSS_HUD } from '../config/hud';
import { LOGEN, PATRON_DOOR, VADOR, XENO, GUTS } from '../config/bosses';
import { CLOSING } from '../config/closing';
import { createPadNav } from '../ui/padNav';
import { createAccountPanel } from '../ui/accountPanel';
import { ACHIEVEMENTS, ACHIEVEMENT_BANNER } from '../config/achievements';
import { createSetupScreen } from '../ui/setupScreen';
import { EVOLUTIONS, weaponTitle } from '../config/evolutions';
import { wireInstall } from './install';
import { createTouchControls } from '../ui/touchControls';
import { LIGHT_RENDER, shadowsOn } from '../render/quality';
import { createLeaderboardPanel } from '../ui/leaderboardPanel';
import { CHARACTERS, type CharacterId } from '../config/characters';
import { LEADERBOARD } from '../config/hud';
import { achievementFor, owned } from '../meta/shop';
import type { DifficultyId } from '../config/spawn';
import { createShopScreen } from '../ui/shopScreen';
import { renderPortrait } from '../render/portrait';
import buveurUrl from '../assets/models/buveur.glb?url';
import videurUrl from '../assets/models/videur.glb?url';
import pereNoelUrl from '../assets/models/pere_noel.glb?url';
import copUrl from '../assets/models/cop.glb?url';
import marieUrl from '../assets/models/marie.glb?url';
import barmanUrl from '../assets/models/barman.glb?url';
import serveuseUrl from '../assets/models/serveuse.glb?url';
import pilierUrl from '../assets/models/pilier.glb?url';
import { runUnlocks } from '../meta/shop';
import { createProgress } from './progress';
import { TOURNEES } from '../config/tournees';
import { ITEM_EFFECTS } from '../config/items';
import type { WeaponId } from '../weapons/weapon';
import type { Planet } from './planet';
import { jitter } from './sounds';

/**
 * Interface du jeu branchée sur le noyau : accueil (Jouer, Options), chargement de la planète,
 * HUD de run, écran de level-up, pause (Échap), écran de mort. Les écrans ne changent jamais l'état
 * du jeu eux-mêmes : ils appellent le noyau (startRun, pickCard, pause...) et suivent ses événements.
 */
export function wireScreens(game: Game, d: { planet: Planet; canvas: HTMLCanvasElement; audio: AudioEngine; setShadows: (on: boolean) => void }) {
  const { planet, audio } = d;
  // Pas de curseur verrouillé sur écran tactile (il n'y en a pas, et sa perte mettrait en pause)
  const lockCursor = () => { if (!isTouchDevice()) d.canvas.requestPointerLock?.()?.catch?.(() => {}); };

  // --- Options (volumes gardés dans le navigateur)
  const settings = loadSettings();
  for (const ch of ['music', 'fx', 'ui'] as const) audio.setUserVolume(ch, settings.volume[ch]);
  // Graphismes : les ombres changent tout de suite ; la qualité, au prochain chargement (rechargé tout de suite si on est sur l'accueil)
  let qualityChanged = false;
  const options = createOptionsPanel(settings, (ch, v) => audio.setUserVolume(ch, v), () => saveSettings(settings), {
    shadows: (c) => d.setShadows(shadowsOn(c)),
    quality: () => { qualityChanged = true; },
    qualityNow: () => (LIGHT_RENDER ? 'légère' : 'complète'),
  });
  options.root.addEventListener('transitionend', () => {
    if (qualityChanged && !options.open && game.phase === 'home') location.reload();
  });

  // --- HUD de run
  const healthHud = createHealthHud(game.health);
  const alcoholHud = createAlcoholHud(game.progression);
  const pumpGauge = createPumpGauge();
  const minimap = createMinimap();
  const chestPrompt = createChestPrompt(capsuleIcon());
  const bellPrompt = createChestPrompt(null, LAST_CALL_TEXT.prompt);
  const doorPrompt = createChestPrompt(null, PATRON_DOOR.prompt);
  const radioPrompt = createChestPrompt(null, 'Allumer la radio');
  // Un boss optionnel à portée : « Défier ... »
  const gravePrompts = { vador: createChestPrompt(null, VADOR.prompt), logen: createChestPrompt(null, LOGEN.prompt), xeno: createChestPrompt(null, XENO.prompt), guts: createChestPrompt(null, GUTS.prompt) };
  const chestReveal = createChestReveal();
  const runHud = createRunHud();
  const banner = createEventBanner();
  const weaponHud = createWeaponHud();
  const itemHud = createItemHud();
  const tourneeHud = createTourneeHud();
  const bossBar = createBossBar();
  const vehicleHud = createVehicleHud();
  const saiyanHud = createSaiyanHud(() => (touchScreen() ? 'Bouton Saiyan' : 'F (Y à la manette)'));
  // Téléphone ou tablette : joystick et boutons à l'écran pendant la run
  const touchUi = isTouchDevice() ? createTouchControls() : null;
  if (touchUi) document.documentElement.classList.add('is-touch');
  const setHud = (v: boolean) => {
    healthHud.setVisible(v);
    alcoholHud.setVisible(v);
    runHud.setVisible(v);
    weaponHud.setVisible(v);
    itemHud.setVisible(v);
    tourneeHud.setVisible(v);
    minimap.setVisible(v);
  };
  const icons = new Map<WeaponId, string>();
  const slots = (): WeaponSlot[] => {
    const active = game.activeSynergies().map((s) => SYNERGIES[s]);
    return game.loadout.weapons.map((w) => {
      if (!icons.has(w.id)) icons.set(w.id, weaponIcon(w.id, 'wpn-icon'));
      const syn = active.find((S) => (S.weapons as readonly string[]).includes(w.id));
      return { id: w.id, icon: icons.get(w.id)!, level: w.mods.level, synergy: syn?.color };
    });
  };

  // --- Écrans
  const loading = createLoadingScreen();
  const levelUp = createLevelUpScreen((card) => game.pickCard(card), () => audio.play(AUDIO.cards.hover, AUDIO.cards.hoverVolume, jitter(0.05), 0, 'ui'), (o, card) => {
    if (o === 'reroll') game.rerollCards();
    else if (o === 'skip') game.skipCards();
    else if (card) game.banishCard(card);
  });
  const deathBanner = createDeathBanner(() => game.goHome());
  const pause = createPauseMenu({
    resume: () => game.resume(),
    options: () => options.show(() => pause.focus()),
    quit: () => game.abandon(),
    stats: () => pauseStats(game),
  });

  // Jouer : nouvelle planète (sauf la toute première, déjà prête), puis le Buveur tombe du ciel
  let starting = false;
  const chosen = { character: 'buveur' as CharacterId, difficulty: 'sobre' as DifficultyId };
  async function play() {
    if (game.phase !== 'home' || starting) return;
    starting = true;
    home.hide();
    if (!planet.fresh) {
      loading.show();
      await planet.regenerate(loading.progress);
      loading.hide();
    }
    planet.use();
    // Les déblocages de la boutique, le perso et la difficulté choisis valent pour la run qui commence
    game.unlocks = runUnlocks(progress.profile);
    game.difficulty = chosen.difficulty;
    game.character = chosen.character;
    // Succès : ceux déjà gagnés ne retombent pas ; les kills de toujours comptent pour « au total »
    game.achievements.owned = new Set(progress.profile.achievements);
    game.achievements.lifetimeKills = progress.profile.totalKills;
    game.startRun(planet.decor.randomSpawn());
    starting = false;
  }
  // Pourquoi un perso est fermé (null : jouable)
  const lockedBy = (id: CharacterId) => {
    const key = `character:${id}`;
    if (owned(progress.profile, key)) return null;
    const a = achievementFor(key);
    return a ? `Succès ${a.name} : ${a.text}` : 'À débloquer en boutique';
  };
  // Jouer sur l'accueil : l'écran avant partie (perso, map, difficulté), dont le Jouer lance la run
  const setup = createSetupScreen({
    play: (character, d) => { chosen.character = character; chosen.difficulty = d; setup.hide(); void play(); },
    back: () => home.focus(),
    portrait: (id) => portraits.get(id) ?? null,
    pickCharacter: (c) => { progress.character = c; },
    pickDifficulty: (d) => { progress.difficulty = d; },
  });
  // Outils de dev : difficultés ouvertes d'office
  const forced = new Set<DifficultyId>();
  const openSetup = () => setup.show({ lockedBy, character: progress.character, difficulties: [...new Set([...progress.profile.difficulties, ...forced])], difficulty: progress.difficulty });
  const home = createHomeScreen(openSetup, () => options.show(() => home.focus()), () => shop.show('shop', () => home.focus()), () => shop.show('skills', () => home.focus()), () => shop.show('achievements', () => home.focus()));
  // Application installable : bouton « Installer l'appli » quand le navigateur le propose
  wireInstall(home.root);
  const padNav = createPadNav();

  // Compte et progression : invité (navigateur) ou Discord (en ligne) ; chaque run terminée compte
  const progress = createProgress();
  const accountPanel = createAccountPanel(home.root, { login: () => progress.login(), logout: () => void progress.logout(), emailLink: (m, n) => progress.emailLink(m, n) });
  progress.onChange(() => accountPanel.update(progress.online, progress.account, progress.profile, progress.canLogin, progress.canEmail));
  // Classement : top 10 en kills sur une run, relu régulièrement tant que l'accueil est affiché, et après chaque run
  const board = createLeaderboardPanel(home.root);
  const refreshBoard = async () => { if (progress.online) board.update(await progress.leaderboard(), !progress.account); };
  progress.onChange(() => void refreshBoard());
  setInterval(() => { if (game.phase === 'home' && home.visible) void refreshBoard(); }, LEADERBOARD.refreshEvery * 1000);
  // Boutique : persos, armes et objets à débloquer avec les TUNAS
  // Portraits des persos, rendus une fois depuis leur modèle 3D
  const portraits = new Map<string, string>();
  const models: Record<string, string> = { buveur: buveurUrl, videur: videurUrl, pere_noel: pereNoelUrl, cop: copUrl, marie: marieUrl, barman: barmanUrl, serveuse: serveuseUrl, pilier: pilierUrl };
  for (const id of Object.keys(CHARACTERS) as CharacterId[]) {
    void renderPortrait(models[CHARACTERS[id].model]).then((u) => { portraits.set(id, u); shop.refresh(); setup.refresh(); }).catch((e) => console.error('[portrait]', e));
  }
  const shop = createShopScreen({ buy: (k) => progress.buy(k), buySkill: (l) => progress.buySkill(l), profile: () => progress.profile, onClose: () => home.focus(), portrait: (id) => portraits.get(id) ?? null });
  progress.onChange(() => shop.refresh());
  void progress.init();
  // TUNAS de la dernière run, pour le bilan de fin
  const lastRun = { tunas: 0, tunasBonus: 0, achievements: [] as { name: string; tunas: number }[] };
  game.events.on('runEnded', ({ survived, kills, tunas, tunasBonus, difficulty: d, abbe, achievements, character }) => {
    lastRun.achievements = ACHIEVEMENTS.filter((a) => achievements.includes(a.id));
    lastRun.tunas = tunas + lastRun.achievements.reduce((s, a) => s + a.tunas, 0);
    lastRun.tunasBonus = tunasBonus;
    void progress.recordRun({ survived, kills, tunas, difficulty: d, abbe, achievements, character }).then(() => refreshBoard());
  });
  // Un succès tombe : bandeau avec ce qu'il rapporte
  game.events.on('achievementUnlocked', ({ name, tunas }) => { banner.show(`Succès : ${name} !`, `+${tunas} TUNAS`); banner.pulse(); banner.hideAfter(ACHIEVEMENT_BANNER.duration); });

  game.events.on('runStarted', () => { setHud(true); lockCursor(); });
  // Cloches de l'Abbaye : le bandeau reste affiché pendant le débarquement et tremble à chaque coup
  game.events.on('bellToll', () => banner.pulse());
  game.events.on('bellsLanding', ({ duration }) => { banner.show('Les cloches sonnent !', `Débarquement : tiens ${duration} secondes`); banner.pulse(); });
  game.events.on('bellsSurgeEnded', () => banner.hideAfter(2.5, 'Ils ont fini de sortir de terre'));
  // Synergie qui s'active : bandeau avec son nom et ce qu'elle fait
  game.events.on('synergyActivated', ({ id }) => {
    const S = SYNERGIES[id];
    banner.show(`Synergie : ${S.name} !`, S.pitch);
    banner.pulse();
    banner.hideAfter(SYNERGY_BANNER.duration);
  });
  // Happy hour : bandeau le temps qu'elle dure
  game.events.on('happyHourStarted', ({ duration }) => {
    banner.show('Happy hour !', `Vitesse d'attaque x${ITEM_EFFECTS.happyHour.rate} pendant ${Math.round(duration)} s`);
    banner.pulse();
    banner.hideAfter(duration);
  });
  game.events.on('revived', () => { banner.show('Seconde tournée !', 'Tu reviens à la vie'); banner.pulse(); banner.hideAfter(2.5); });
  game.events.on('freeChestSpawned', () => { banner.show('Coffre gratuit !', 'Un cadeau est apparu près de toi'); banner.hideAfter(2.5); });
  game.events.on('lastCallRung', () => { banner.show(LAST_CALL_TEXT.banner, LAST_CALL_TEXT.sub); banner.pulse(); banner.hideAfter(2.5); });
  game.events.on('tourneeTaken', ({ id }) => { const T = TOURNEES[id]; banner.show(`${T.name} !`, T.text); banner.pulse(); banner.hideAfter(2); });
  // Une arme évolue : bandeau avec son nouveau nom
  game.events.on('weaponEvolved', ({ weapon }) => { const E = EVOLUTIONS[weapon.id]; banner.show(`Évolution : ${E.name} !`, E.text); banner.pulse(); banner.hideAfter(3); });
  // Le 421 : le jackpot (4-2-1 dans la même volée) s'annonce
  game.events.on('weaponExploded', ({ weapon }) => { if (weapon.id === 'des421') { banner.show('421 !', 'Jackpot : le 4 explose'); banner.pulse(); banner.hideAfter(1.6); } });
  // Boss : sa barre de vie, un bandeau à son arrivée et quand il passe en phase 2
  const BOSS_TEXT = {
    sonneur: { come: 'Saute par-dessus les ondes de sa cloche', rage: ['Il est furieux !', 'Plus rapide, et deux ondes à chaque coup'], fall: 'Un coffre légendaire t\'attend' },
    abbe: { come: 'Ne reste pas dans son vin de messe', rage: ['Il a bu le calice !', 'Il devient géant'], fall: 'Un coffre légendaire t\'attend. Tiens jusqu\'à la fermeture' },
    logen: { come: 'Écarte-toi de sa charge, recule devant son tourbillon', rage: ['Le Sanguinaire !', 'Il ne se fatigue plus'], fall: "Un coffre légendaire t'attend" },
    guts: { come: "Recule hors de l'arc rouge, écarte-toi de la bande", rage: ['Le Berserker !', 'Trois fauchages, et il encaisse moitié moins'], fall: "Un coffre légendaire t'attend" },
    xeno: { come: "Sors du cercle avant qu'il retombe, et de la bande de sa queue", rage: ['Il hurle !', 'Son sang acide ronge le sol'], fall: "Un coffre légendaire t'attend" },
    vador: { come: 'Sors de la zone rouge avant le coup', rage: ['Il est furieux !', 'Il lance son sabre'], fall: 'Un coffre légendaire t\'attend' },
  } as const;
  game.events.on('bossSpawned', ({ boss }) => {
    bossBar.show(boss, boss.name, boss.phaseAt);
    banner.show(`${boss.name} !`, BOSS_TEXT[boss.kind].come);
    banner.pulse();
    banner.hideAfter(3);
  });
  game.events.on('bossPhase', ({ boss }) => { const [t, sub] = BOSS_TEXT[boss.kind].rage; banner.show(t, sub); banner.pulse(); banner.hideAfter(2.5); });
  game.events.on('bossKilled', ({ boss }) => {
    bossBar.hide(boss);
    banner.show(`${boss.name} est tombé !`, BOSS_TEXT[boss.kind].fall);
    banner.pulse();
    banner.hideAfter(3);
  });
  game.events.on('closingStarted', () => { banner.show(CLOSING.banner.title, CLOSING.banner.sub); banner.pulse(); banner.hideAfter(4); });
  game.events.on('doorOpened', () => { banner.show('Le patron arrive...', 'La porte s\'ouvre'); banner.pulse(); banner.hideAfter(2); });
  game.events.on('vehicleEntered', ({ kind }) => vehicleHud.show(VEHICLES[kind].name));
  game.events.on('allyJoined', ({ kind }) => { banner.show(`${ALLIES[kind].name} te rejoint !`, 'Il te suit une minute'); banner.pulse(); banner.hideAfter(2.2); });
  game.events.on('allyLeft', ({ kind }) => { banner.show(`${ALLIES[kind].name} s'en va`, ''); banner.hideAfter(1.6); });
  // Son cri, au premier usage de son pouvoir (pas à chaque fois)
  const shouted = new Set<string>();
  game.events.on('runStarted', () => shouted.clear());
  game.events.on('allyPower', ({ kind }) => {
    if (shouted.has(kind)) return;
    shouted.add(kind);
    banner.show(ALLIES[kind].shout, ''); banner.pulse(); banner.hideAfter(1.8);
  });
  game.events.on('radioOn', () => { banner.show('Radio mydnic !', 'Toute la horde rapplique sur la radio'); banner.pulse(); banner.hideAfter(2.5); });
  game.events.on('radioBroken', () => { banner.show('La radio est cassée', 'La horde revient vers toi'); banner.hideAfter(2); });
  game.events.on('saiyanTierReached', ({ name }) => { banner.show(`${name} prêt !`, touchScreen() ? 'Bouton Saiyan pour te transformer' : 'F (Y à la manette) pour te transformer'); banner.hideAfter(2.2); });
  game.events.on('saiyanTransformed', ({ name }) => { banner.show(`${name} !`, ''); banner.pulse(); banner.hideAfter(1.8); });
  game.events.on('vehicleExited', ({ reason }) => {
    vehicleHud.hide();
    if (reason === 'destroyed') { banner.show('Épave !', 'Le véhicule a lâché'); banner.hideAfter(1.8); }
  });
  game.events.on('home', () => bossBar.hide());
  game.events.on('died', () => bossBar.hide());
  game.events.on('died', () => banner.clear());
  game.events.on('home', () => banner.clear());
  // Level-up : les cartes, et sous elles Relancer / Bannir / Passer s'il en reste (skill tree)
  let lastLevel = 0;
  game.events.on('levelUpOffered', ({ level, cards }) => { lastLevel = level; levelUp.show(level, cards, undefined, undefined, game.cardOptions); });
  game.events.on('cardBanished', ({ cards }) => { if (cards.length) levelUp.show(lastLevel, cards, undefined, undefined, game.cardOptions); });
  game.events.on('cardsSkipped', () => { if (game.progression.pending === 0) lockCursor(); });
  // Pompe à bière pleine : même écran, titre de la pompe
  game.events.on('pumpFilled', ({ pump, cards }) => levelUp.show(0, cards, `Pompe en ${PUMP_TIERS[pump.tier].name} !`));
  game.events.on('chestOpened', () => chestReveal.finish());
  game.events.on('chestOpened', ({ rarity, cards }) => levelUp.show(0, cards, `Coffre ${RARITIES[rarity].name.toLowerCase()} !`, RARITIES[rarity].color));
  game.events.on('chestDenied', () => chestPrompt.deny());
  // Coffre payé : ouverture façon lootbox, puis l'écran de choix
  game.events.on('chestRevealing', (e) => chestReveal.play(e.rarity, revealSchedule(e)));
  game.events.on('home', () => chestReveal.stop());
  game.events.on('cardPicked', () => { if (game.progression.pending === 0) lockCursor(); });
  game.events.on('playerHurt', ({ blocked }) => { if (!blocked) healthHud.hit(); });
  let pausedAt = 0;
  game.events.on('paused', () => { pause.show(); pausedAt = performance.now(); });
  game.events.on('resumed', () => { options.close(); pause.hide(); lockCursor(); });
  game.events.on('home', () => {
    setHud(false);
    levelUp.hide();
    pause.hide();
    options.close();
    deathBanner.update(-1, 0);
    home.show();
  });

  // Pause : Échap libère le curseur verrouillé (le navigateur ne transmet alors pas la touche)
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) game.pause(); });
  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || e.repeat) return;
    if (!game.menuPaused) game.pause();
    // Ignore l'Échap qui vient d'ouvrir la pause via la perte du curseur
    else if (performance.now() - pausedAt > 300) game.resume();
  });

  // Le jeu s'ouvre sur l'accueil
  setHud(false);
  home.show();

  return {
    get optionsOpen() { return options.open; },
    /** Outils de dev : la progression (TUNAS, difficulté). */
    progress,
    /** Outils de dev : choisir une difficulté, même pas encore débloquée. */
    forceDifficulty(d: DifficultyId) { progress.difficulty = d; forced.add(d); },
    /** Chaque image : HUD, écran de mort, manette et Espace dans les menus. */
    update(realDt: number, input: InputState) {
      levelUp.input(input.moveX, input.jumpPressed || input.actionPressed, input.moveY);
      // Menus à la manette : celui du premier plan (Options, puis pause, puis accueil) ; B revient en arrière
      const menu = options.open ? options.root : shop.open ? shop.root : setup.open ? setup.root : pause.open ? pause.root : game.phase === 'home' && home.visible && !starting ? home.root : null;
      const back = options.open ? options.close : shop.open ? shop.close : setup.open ? setup.close : pause.open ? () => game.resume() : undefined;
      const usedA = padNav.update(realDt, input, menu, back);
      // Start de la manette : pause, ou reprise
      if (input.pausePressed && game.phase === 'run') {
        if (!game.menuPaused) game.pause();
        else if (!options.open) game.resume();
      }
      touchUi?.setVisible(game.phase === 'run' && !game.frozen && !game.menuPaused);
      healthHud.update(realDt);
      alcoholHud.update();
      if (game.phase === 'run' && !game.frozen) pumpGauge.update(game.pumps.focus, game.pumps.filling);
      else pumpGauge.hide();
      const pl = game.player;
      minimap.update(realDt, pl.pos, pl.facing, pl.camFwd, game.pumps.list, game.chests.list, game.lastCall.list, game.horde.zombies, game.door.open ? null : game.door.pos, game.closing.reapers, game.vehicles.parked?.pos ?? null);
      const chest = game.phase === 'run' && !game.frozen ? game.chests.focus : null;
      chestPrompt.update(chest ? game.chests.priceOf(chest) : null, game.coins);
      bellPrompt.update(!chest && game.phase === 'run' && !game.frozen && game.lastCall.focus ? 0 : null, game.coins);
      doorPrompt.update(!chest && !game.lastCall.focus && game.phase === 'run' && !game.frozen && game.door.focus ? 0 : null, game.coins);
      radioPrompt.update(!chest && game.phase === 'run' && !game.frozen && game.radio.focus ? 0 : null, game.coins);
      for (const [kind, prompt] of Object.entries(gravePrompts)) prompt.update(!chest && !game.door.focus && game.phase === 'run' && !game.frozen && game.graveBosses.focus?.kind === kind ? 0 : null, game.coins);
      runHud.update(game.runTime, game.kills, game.coins, Math.floor(game.tunas + 1e-9));
      weaponHud.update(slots());
      itemHud.update(game.items);
      tourneeHud.update((id) => game.tournees.left(id));
      const sj = game.saiyan;
      saiyanHud.update(game.phase === 'run' && sj.enabled, sj.points, sj.reached, sj.tier, sj.left, sj.duration);
      const car = game.vehicles.driving;
      if (car) vehicleHud.update(car.hp / car.maxHp, car.left / car.duration, car.left);
      for (const boss of game.bosses) bossBar.update(boss, boss.zombie.hp / boss.zombie.maxHp, boss.phase);
      tourneeHud.setOffset(bossBar.count * BOSS_HUD.pushDown);
      if (game.phase === 'dead') deathBanner.update(game.deadTime, game.runTime, game.kills, lastRun.tunas, lastRun.tunasBonus, lastRun.achievements);
      // Espace ou bouton A : Continuer sur le bilan de mort (l'accueil passe par la navigation des menus)
      if (input.jumpPressed && !usedA) {
        if (game.phase === 'dead' && deathBanner.ready) game.goHome();
      }
    },
  };
}

/** Stats de la pause : le joueur, puis un bloc par emplacement d'arme (null = libre). */
function pauseStats(game: Game): PauseStats {
  const h = game.health;
  const player = {
    title: CHARACTERS[game.character].name,
    rows: [['PV', `${Math.ceil(h.hp)} / ${h.max}`, ''] as [string, string, string], ...game.stats.lines().map(toRow)],
  };
  const active = game.activeSynergies().map((s) => SYNERGIES[s]);
  const weapons = Array.from({ length: game.loadout.max }, (_, i) => {
    const w = game.loadout.weapons[i];
    if (!w) return null;
    const syn = active.find((S) => (S.weapons as readonly string[]).includes(w.id));
    return { title: weaponTitle(w), icon: weaponIcon(w.id, ''), level: w.mods.level, rows: w.stats().map(toRow), synergy: syn && { name: syn.name, color: syn.color } };
  });
  const synergies = active.map((S) => ({ name: S.name, color: S.color, icons: S.weapons.map((id) => weaponIcon(id, '')), details: S.details }));
  return { player, weapons, synergies };
}
