import { PUMP_TIERS } from '../config/pumps';
import { SYNERGIES } from '../config/weapons';
import { SYNERGY_BANNER } from '../config/hud';
import { AUDIO } from '../config/audio';
import type { AudioEngine } from '../audio/audio';
import type { InputState } from '../core/input';
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
import { BOSS_HUD } from '../config/hud';
import { PATRON_DOOR } from '../config/bosses';
import { CLOSING } from '../config/closing';
import { createVictoryScreen } from '../ui/victoryScreen';
import { createPadNav } from '../ui/padNav';
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
export function wireScreens(game: Game, d: { planet: Planet; canvas: HTMLCanvasElement; audio: AudioEngine }) {
  const { planet, audio } = d;
  const lockCursor = () => d.canvas.requestPointerLock?.()?.catch?.(() => {});

  // --- Options (volumes gardés dans le navigateur)
  const settings = loadSettings();
  for (const ch of ['music', 'fx', 'ui'] as const) audio.setUserVolume(ch, settings.volume[ch]);
  const options = createOptionsPanel(settings, (ch, v) => audio.setUserVolume(ch, v), () => saveSettings(settings));

  // --- HUD de run
  const healthHud = createHealthHud(game.health);
  const alcoholHud = createAlcoholHud(game.progression);
  const pumpGauge = createPumpGauge();
  const minimap = createMinimap();
  const chestPrompt = createChestPrompt(capsuleIcon());
  const bellPrompt = createChestPrompt(null, LAST_CALL_TEXT.prompt);
  const doorPrompt = createChestPrompt(null, PATRON_DOOR.prompt);
  const chestReveal = createChestReveal();
  const runHud = createRunHud();
  const banner = createEventBanner();
  const weaponHud = createWeaponHud();
  const itemHud = createItemHud();
  const tourneeHud = createTourneeHud();
  const bossBar = createBossBar();
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
  const levelUp = createLevelUpScreen((card) => game.pickCard(card), () => audio.play(AUDIO.cards.hover, AUDIO.cards.hoverVolume, jitter(0.05), 0, 'ui'));
  const deathBanner = createDeathBanner(() => game.goHome());
  const pause = createPauseMenu({
    resume: () => game.resume(),
    options: () => options.show(() => pause.focus()),
    quit: () => game.abandon(),
    stats: () => pauseStats(game),
  });

  // Jouer : nouvelle planète (sauf la toute première, déjà prête), puis le Buveur tombe du ciel
  let starting = false;
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
    game.startRun(planet.decor.randomSpawn());
    starting = false;
  }
  const home = createHomeScreen(() => void play(), () => options.show(() => home.focus()));
  const padNav = createPadNav();

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
  game.events.on('freeChestSpawned', () => { banner.show('Coffre gratuit !', 'Le Bonnet du Père Noël en a posé un près de toi'); banner.hideAfter(2.5); });
  game.events.on('lastCallRung', () => { banner.show(LAST_CALL_TEXT.banner, LAST_CALL_TEXT.sub); banner.pulse(); banner.hideAfter(2.5); });
  game.events.on('tourneeTaken', ({ id }) => { const T = TOURNEES[id]; banner.show(`${T.name} !`, T.text); banner.pulse(); banner.hideAfter(2); });
  // Boss : sa barre de vie, un bandeau à son arrivée et quand il passe en phase 2
  const BOSS_TEXT = {
    sonneur: { come: 'Saute par-dessus les ondes de sa cloche', rage: ['Il est furieux !', 'Plus rapide, et deux ondes à chaque coup'], fall: 'Un coffre légendaire t\'attend' },
    abbe: { come: 'Ne reste pas dans son vin de messe', rage: ['Il a bu le calice !', 'Il devient géant'], fall: '' },
  } as const;
  game.events.on('bossSpawned', ({ boss }) => {
    bossBar.show(boss.name, boss.phaseAt);
    banner.show(`${boss.name} !`, BOSS_TEXT[boss.kind].come);
    banner.pulse();
    banner.hideAfter(3);
  });
  game.events.on('bossPhase', ({ boss }) => { const [t, sub] = BOSS_TEXT[boss.kind].rage; banner.show(t, sub); banner.pulse(); banner.hideAfter(2.5); });
  game.events.on('bossKilled', ({ boss }) => {
    bossBar.hide();
    if (boss.kind === 'abbe') return;
    banner.show(`${boss.name} est tombé !`, BOSS_TEXT[boss.kind].fall);
    banner.pulse();
    banner.hideAfter(3);
  });
  game.events.on('closingStarted', () => { banner.show(CLOSING.banner.title, CLOSING.banner.sub); banner.pulse(); banner.hideAfter(4); });
  game.events.on('doorBusy', () => { banner.show('Pas maintenant', PATRON_DOOR.busy); banner.hideAfter(1.8); });
  game.events.on('doorOpened', () => { banner.show('Le patron arrive...', 'La porte s\'ouvre'); banner.pulse(); banner.hideAfter(2); });
  // Victoire : l'écran de victoire, retour à l'accueil par son bouton (ou Espace)
  const victory = createVictoryScreen(() => game.goHome());
  game.events.on('victory', ({ survived, kills }) => { banner.clear(); victory.show(survived, kills); });
  game.events.on('home', () => victory.hide());
  game.events.on('home', () => bossBar.hide());
  game.events.on('died', () => bossBar.hide());
  game.events.on('died', () => banner.clear());
  game.events.on('home', () => banner.clear());
  game.events.on('levelUpOffered', ({ level, cards }) => levelUp.show(level, cards));
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
    /** Chaque image : HUD, écran de mort, manette et Espace dans les menus. */
    update(realDt: number, input: InputState) {
      levelUp.input(input.moveX, input.jumpPressed || input.actionPressed);
      // Menus à la manette : celui du premier plan (Options, puis pause, puis accueil) ; B revient en arrière
      const menu = options.open ? options.root : pause.open ? pause.root : game.phase === 'home' && home.visible && !starting ? home.root : null;
      const back = options.open ? options.close : pause.open ? () => game.resume() : undefined;
      const usedA = padNav.update(realDt, input, menu, back);
      // Start de la manette : pause, ou reprise
      if (input.pausePressed && game.phase === 'run') {
        if (!game.menuPaused) game.pause();
        else if (!options.open) game.resume();
      }
      healthHud.update(realDt);
      alcoholHud.update();
      if (game.phase === 'run' && !game.frozen) pumpGauge.update(game.pumps.focus, game.pumps.filling);
      else pumpGauge.hide();
      const pl = game.player;
      minimap.update(realDt, pl.pos, pl.facing, pl.camFwd, game.pumps.list, game.chests.list, game.lastCall.list, game.horde.zombies, game.door.open ? null : game.door.pos, game.closing.reapers);
      const chest = game.phase === 'run' && !game.frozen ? game.chests.focus : null;
      chestPrompt.update(chest ? game.chests.priceOf(chest) : null, game.coins);
      bellPrompt.update(!chest && game.phase === 'run' && !game.frozen && game.lastCall.focus ? 0 : null, game.coins);
      doorPrompt.update(!chest && !game.lastCall.focus && game.phase === 'run' && !game.frozen && game.door.focus ? 0 : null, game.coins);
      runHud.update(game.runTime, game.kills, game.coins);
      weaponHud.update(slots());
      itemHud.update(game.items);
      tourneeHud.update((id) => game.tournees.left(id));
      const boss = game.boss;
      if (boss) bossBar.update(boss.zombie.hp / boss.zombie.maxHp, boss.phase);
      tourneeHud.setOffset(boss ? BOSS_HUD.pushDown : 0);
      if (game.phase === 'dead') deathBanner.update(game.deadTime, game.runTime, game.kills);
      // Espace ou bouton A : Continuer sur le bilan de mort et la victoire (l'accueil passe par la navigation des menus)
      if (input.jumpPressed && !usedA) {
        if (game.phase === 'dead' && deathBanner.ready) game.goHome();
        else if (game.won && victory.shown) game.goHome();
      }
    },
  };
}

/** Stats de la pause : le joueur, puis un bloc par emplacement d'arme (null = libre). */
function pauseStats(game: Game): PauseStats {
  const h = game.health;
  const player = {
    title: 'Le Buveur',
    rows: [['PV', `${Math.ceil(h.hp)} / ${h.max}`, ''] as [string, string, string], ...game.stats.lines().map(toRow)],
  };
  const active = game.activeSynergies().map((s) => SYNERGIES[s]);
  const weapons = Array.from({ length: game.loadout.max }, (_, i) => {
    const w = game.loadout.weapons[i];
    if (!w) return null;
    const syn = active.find((S) => (S.weapons as readonly string[]).includes(w.id));
    return { title: w.name, icon: weaponIcon(w.id, ''), level: w.mods.level, rows: w.stats().map(toRow), synergy: syn && { name: syn.name, color: syn.color } };
  });
  const synergies = active.map((S) => ({ name: S.name, color: S.color, icons: S.weapons.map((id) => weaponIcon(id, '')), details: S.details }));
  return { player, weapons, synergies };
}
