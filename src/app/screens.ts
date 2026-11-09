import { SYNERGIES } from '../config/weapons';
import { SYNERGY_BANNER } from '../config/hud';
import { AUDIO } from '../config/audio';
import type { AudioEngine } from '../audio/audio';
import type { InputState } from '../core/input';
import { loadSettings, saveSettings } from '../core/settings';
import type { Game } from '../game/game';
import { createAlcoholHud } from '../ui/alcoholHud';
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
  const runHud = createRunHud();
  const banner = createEventBanner();
  const weaponHud = createWeaponHud();
  const setHud = (v: boolean) => {
    healthHud.setVisible(v);
    alcoholHud.setVisible(v);
    runHud.setVisible(v);
    weaponHud.setVisible(v);
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
  game.events.on('died', () => banner.clear());
  game.events.on('home', () => banner.clear());
  game.events.on('levelUpOffered', ({ level, cards }) => levelUp.show(level, cards));
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
      levelUp.input(input.moveX, input.jumpPressed);
      healthHud.update(realDt);
      alcoholHud.update();
      runHud.update(game.runTime, game.kills);
      weaponHud.update(slots());
      if (game.phase === 'dead') deathBanner.update(game.deadTime, game.runTime, game.kills);
      // Espace ou bouton A : Jouer sur l'accueil, Continuer sur le bilan de mort
      if (input.jumpPressed) {
        if (game.phase === 'home' && !options.open) void play();
        else if (game.phase === 'dead' && deathBanner.ready) game.goHome();
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
