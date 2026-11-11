import * as THREE from 'three';
import { CAMERA } from './config/world';
import { Game } from './game/game';
import { createPlanet } from './app/planet';
import { wireMusic, wireSounds } from './app/sounds';
import { wireEffects } from './app/effects';
import { wireScreens } from './app/screens';
import { wireRunLog } from './app/runLogging';
import { loadZombieLibrary } from './enemies/zombieLibrary';
import { createHordeView } from './enemies/hordeView';
import { createXpDropsView } from './pickups/xpDropsView';
import { createCoinDropsView } from './pickups/coinDropsView';
import { createBottleView } from './weapons/bottleView';
import { createEnemyShotsView } from './enemies/enemyShotsView';
import { createShards } from './fx/shards';
import { createFoamShieldView } from './fx/foamShieldView';
import { createRingWaveView } from './fx/ringWaveView';
import { createSprites } from './fx/sprites';
import { createVfx } from './fx/vfx';
import { BARREL_SHARDS, TIN_SHARDS, EARTH_CLODS, GUEUZE_BURST, ASH_BURST, EMBERS, FOAM_POP, ICE_SHARDS, GIFT_SPARKS, SHIELD_SPARKS, STOUT_SPLASH, VFX, WINE_BURST } from './config/fx';
import { CANETTE_LOOK, FUT_LOOK, GUEUZE_LOOK, STOUT_LOOK } from './config/weapons';
import type { WeaponId } from './weapons/weapon';
import { createKamikazeView } from './enemies/kamikazeView';
import { createProtectorView } from './enemies/protectorView';
import { createDazedView } from './enemies/dazedView';
import { createPumpsView } from './world/pumpsView';
import { createChestsView } from './world/chestsView';
import { createBinsView } from './world/binsView';
import { createLastCallView } from './world/lastCallView';
import { createBellDropsView } from './pickups/bellDropsView';
import { createSnackDropsView } from './pickups/snackDropsView';
import { createDamageNumbers } from './ui/damageNumbers';
import { createRunLog } from './dev/runLog';
import { BuveurVisual } from './player/buveurVisual';
import { CameraRig } from './player/cameraRig';
import { PintProp } from './player/pintProp';
import { Pipeline } from './render/pipeline';
import { createAdaptiveResolution } from './render/adaptiveResolution';
import { createSky } from './world/sky';
import { createClouds } from './world/clouds';
import { heightAt } from './world/terrain';
import { AudioEngine } from './audio/audio';
import { createAmbience } from './audio/ambience';
import { createMusic } from './audio/music';
import { initInput, readInput } from './core/input';

/*
 * Assemblage : le noyau du jeu (src/game, sans écran) d'un côté, l'affichage, les sons et
 * l'interface de l'autre, branchés sur ses événements (src/app). Ici : création des objets et boucle.
 */

// --- Rendu
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.info.autoReset = false; // compte toutes les passes de la frame
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CAMERA.fov, innerWidth / innerHeight, 0.1, 1200);
const pipeline = new Pipeline(renderer, scene, camera);
pipeline.setSize(innerWidth, innerHeight);
// La résolution de la scène baisse seule si la carte graphique ne suit pas
const adaptive = createAdaptiveResolution(renderer, () => pipeline.setSize(innerWidth, innerHeight));
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  pipeline.setSize(innerWidth, innerHeight);
});

// --- Monde : une nouvelle planète à chaque run, ciel et nuages
const planet = await createPlanet(scene);
const sky = createSky(scene);
const clouds = createClouds(scene);

// --- Noyau du jeu
const zombieLib = await loadZombieLibrary();
const game = new Game({ zombieKinds: zombieLib, collider: planet.decor.collider });

// --- Affichage de ce que simule le noyau
const buveur = new BuveurVisual(scene);
buveur.load().catch((e) => console.error(e));
game.setThrowRig({ gesture: (rate) => buveur.throwGesture(rate), handPos: (out) => buveur.leftHandPos(out) });
const hordeView = createHordeView(scene, zombieLib);
const xpView = createXpDropsView(scene);
const coinView = await createCoinDropsView(scene);
// Une vue de bouteilles par arme (chaque arme a sa bouteille)
const bottleViews: Record<WeaponId, Awaited<ReturnType<typeof createBottleView>>> = {
  canette: await createBottleView(scene, CANETTE_LOOK),
  stout: await createBottleView(scene, STOUT_LOOK),
  fut: await createBottleView(scene, FUT_LOOK),
  gueuze: await createBottleView(scene, GUEUZE_LOOK),
};
const enemyShotsView = await createEnemyShotsView(scene);
const groundAt = (p: THREE.Vector3) => game.player.supportAt(p, p.length());
const shards = createShards(scene, groundAt);
const wine = createShards(scene, groundAt, WINE_BURST);
const wood = createShards(scene, groundAt, BARREL_SHARDS);
const kamikazeView = createKamikazeView(scene);
const protectorView = createProtectorView(scene);
const dazedView = createDazedView(scene);
const pumpsView = await createPumpsView(scene);
const chestsView = await createChestsView(scene);
const binsView = await createBinsView(scene);
const lastCallView = await createLastCallView(scene);
const bellView = await createBellDropsView(scene);
const snackView = await createSnackDropsView(scene);
const sparks = createShards(scene, groundAt, SHIELD_SPARKS);
const earth = createShards(scene, groundAt, EARTH_CLODS);
const stoutSplash = createShards(scene, groundAt, STOUT_SPLASH);
const gueuzeBurst = createShards(scene, groundAt, GUEUZE_BURST);
const ash = createShards(scene, groundAt, ASH_BURST);
const embers = createShards(scene, groundAt, EMBERS);
const foam = createShards(scene, groundAt, FOAM_POP);
const ice = createShards(scene, groundAt, ICE_SHARDS);
const tin = createShards(scene, groundAt, TIN_SHARDS);
const gift = createShards(scene, groundAt, GIFT_SPARKS);
const rings = createRingWaveView(scene);
const sprites = createSprites(scene);
const vfx = createVfx(scene, sprites);
const foamShield = createFoamShieldView(scene);
const damageNumbers = createDamageNumbers(camera);
const pint = new PintProp(scene, { verre: new THREE.Color(), biere: new THREE.Color(), mousse: new THREE.Color() }, (p, r) => game.player.supportAt(p, r));
const rig = new CameraRig(camera);
initInput(renderer.domElement);

// --- Sons (démarrent au premier clic ou à la première touche)
const audio = new AudioEngine();
const ambience = createAmbience(audio);
const music = createMusic(audio);
wireSounds(game, audio, buveur);
wireMusic(game, audio, music, 'abbaye');

// --- Effets, interface, journal de run
const effects = wireEffects(game, { buveur, rig, pint, pipeline, audio, shards, wine, wood, sparks, earth, stoutSplash, gueuzeBurst, ash, embers, foam, ice, gift, tin, rings, sprites, vfx, damageNumbers });
const screens = wireScreens(game, { planet, canvas: renderer.domElement, audio });
const runLog = createRunLog();
let fps = 0;
wireRunLog(game, runLog, () => ({ seed: planet.seed, fps }));
game.events.on('home', () => adaptive.reset());

// --- Debug (F3)
const debugEl = document.getElementById('debug')!;
let debugOn = import.meta.env.DEV;
addEventListener('keydown', (e) => { if (e.code === 'F3') { debugOn = !debugOn; e.preventDefault(); } });
let fpsAcc = 0, fpsN = 0;

// --- Boucle : le noyau avance, puis l'affichage recopie son état
let last = performance.now();
const focusPoint = new THREE.Vector3();
const projectiles = (id: WeaponId) => game.loadout.weapons.filter((w) => w.id === id).flatMap((w) => w.projectiles);

/**
 * Temps passé dans chaque partie d'une image (ms, lissé), affiché par F3 : noyau (simulation), interface,
 * vues (recopie de l'état vers la carte graphique), effets (particules), monde (caméra, ciel, décor), rendu.
 */
const cost = { noyau: 0, interface: 0, vues: 0, effets: 0, monde: 0, rendu: 0 };
let mark = 0;
const lap = (k: keyof typeof cost) => { const t = performance.now(); cost[k] += (t - mark - cost[k]) * 0.05; mark = t; };

function frame(now: number) {
  const realDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  renderer.info.reset();
  const input = readInput();
  mark = performance.now();
  const dt = game.step(realDt, input);
  lap('noyau');
  screens.update(realDt, input);
  lap('interface');

  const player = game.player;
  buveur.update(dt, player);
  hordeView.sync(game.horde.zombies, camera);
  xpView.sync(game.xp.drops);
  coinView.sync(game.coinDrops.drops);
  for (const id of Object.keys(bottleViews) as WeaponId[]) bottleViews[id].sync(projectiles(id));
  enemyShotsView.sync(game.shots.shots);
  kamikazeView.sync(game.horde.zombies);
  protectorView.sync(game.horde.zombies);
  dazedView.sync(game.horde.zombies);
  pumpsView.sync(game.pumps.list, game.pumps.filling ? game.pumps.focus : null);
  chestsView.sync(game.chests.list);
  binsView.sync(game.bins.list, dt);
  snackView.sync(game.snackDrops.drops);
  lastCallView.sync(game.lastCall.list);
  bellView.sync(game.bellDrops.drops);
  lap('vues');
  shards.update(dt);
  wine.update(dt);
  wood.update(dt);
  sparks.update(dt);
  earth.update(dt);
  stoutSplash.update(dt);
  ash.update(dt);
  embers.update(dt);
  foam.update(dt);
  ice.update(dt);
  gift.update(dt);
  tin.update(dt);
  rings.update(dt);
  // Traînées des projectiles, scintillement des gouttes et des capsules au sol (figés avec le jeu)
  if (dt > 0) {
    for (const id of Object.keys(bottleViews) as WeaponId[]) {
      const color = VFX.trail.colors[id];
      if (color !== undefined) for (const b of projectiles(id)) if (b.active) vfx.trail(b.pos, color, VFX.trail.size * b.size);
    }
    vfx.twinkle(game.xp.drops, VFX.colors.xp, dt, VFX.twinkleRate);
    vfx.twinkle(game.coinDrops.drops, VFX.colors.coin, dt, VFX.twinkleRate * 0.5);
    vfx.twinkle(game.bellDrops.drops, VFX.colors.level, dt, VFX.twinkleRate * 4);
  }
  sprites.update(dt);
  vfx.update(dt);
  foamShield.sync(realDt, game.phase === 'run' ? game.effects.shieldsUp : 0, player.renderPos);
  gueuzeBurst.update(dt);
  damageNumbers.update(realDt);
  pint.update(dt);
  effects.update();
  lap('effets');

  rig.update(realDt, input, player);
  sky.update(dt, player.renderPos, camera);
  clouds.update(dt);
  planet.decor.update(dt, player.renderPos, 1 - sky.day);
  ambience.update(sky.day, game.phase !== 'home');
  // Mise au point de la profondeur de champ sur le perso
  pipeline.focusDistance = camera.position.distanceTo(focusPoint.copy(player.renderPos).addScaledVector(player.upDir, 1.1));
  // Accueil : écran séparé, le monde n'est pas rendu
  lap('monde');
  if (game.phase !== 'home') pipeline.render();
  lap('rendu');
  if (game.phase === 'run') adaptive.update(realDt, cost.noyau + cost.interface + cost.vues + cost.effets + cost.monde + cost.rendu);

  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  debugEl.style.display = debugOn ? 'block' : 'none';
  if (debugOn) {
    debugEl.textContent = [
      `FPS ${fps.toFixed(0)}   triangles ${renderer.info.render.triangles.toLocaleString('fr')}`,
      `Altitude ${heightAt(player.upDir).toFixed(1)}   au sol ${player.onGround ? 'oui' : 'non'}`,
      `ms par image : ${(Object.keys(cost) as (keyof typeof cost)[]).map((k) => `${k} ${cost[k].toFixed(1)}`).join('  ')}   résolution ${Math.round(adaptive.scale * 100)} %`,
      'ZQSD bouger, Espace sauter, souris caméra (clic), molette zoom, F3 masquer',
    ].join('\n');
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) {
  Object.assign(window, { __game: { game, cost, adaptive, vfx, sprites, rings, player: game.player, rig, camera, buveur, sky, heightAt, THREE, pipeline, renderer, planet, decor: planet.decor, scene, music, horde: game.horde, health: game.health, progression: game.progression, playerStats: game.stats, canette: game.loadout.weapons[0], setTimeScale: (k: number) => { game.devTimeScale = k; } } });
  const { wireDevTools } = await import('./app/devTools');
  await wireDevTools(game, { music, runLog, seed: () => planet.seed });
}
