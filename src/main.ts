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
import { BARREL_SHARDS, EARTH_CLODS, GUEUZE_BURST, SHIELD_SPARKS, STOUT_SPLASH, WINE_BURST } from './config/fx';
import { CANETTE_LOOK, FUT_LOOK, GUEUZE_LOOK, STOUT_LOOK } from './config/weapons';
import type { WeaponId } from './weapons/weapon';
import { createKamikazeView } from './enemies/kamikazeView';
import { createProtectorView } from './enemies/protectorView';
import { createDazedView } from './enemies/dazedView';
import { createPumpsView } from './world/pumpsView';
import { createChestsView } from './world/chestsView';
import { createDamageNumbers } from './ui/damageNumbers';
import { createRunLog } from './dev/runLog';
import { BuveurVisual } from './player/buveurVisual';
import { CameraRig } from './player/cameraRig';
import { PintProp } from './player/pintProp';
import { Pipeline } from './render/pipeline';
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
const sparks = createShards(scene, groundAt, SHIELD_SPARKS);
const earth = createShards(scene, groundAt, EARTH_CLODS);
const stoutSplash = createShards(scene, groundAt, STOUT_SPLASH);
const gueuzeBurst = createShards(scene, groundAt, GUEUZE_BURST);
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
const effects = wireEffects(game, { buveur, rig, pint, pipeline, audio, shards, wine, wood, sparks, earth, stoutSplash, gueuzeBurst, damageNumbers });
const screens = wireScreens(game, { planet, canvas: renderer.domElement, audio });
const runLog = createRunLog();
let fps = 0;
wireRunLog(game, runLog, () => ({ seed: planet.seed, fps }));

// --- Debug (F3)
const debugEl = document.getElementById('debug')!;
let debugOn = import.meta.env.DEV;
addEventListener('keydown', (e) => { if (e.code === 'F3') { debugOn = !debugOn; e.preventDefault(); } });
let fpsAcc = 0, fpsN = 0;

// --- Boucle : le noyau avance, puis l'affichage recopie son état
let last = performance.now();
const focusPoint = new THREE.Vector3();
const projectiles = (id: WeaponId) => game.loadout.weapons.filter((w) => w.id === id).flatMap((w) => w.projectiles);

function frame(now: number) {
  const realDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  renderer.info.reset();
  const input = readInput();
  const dt = game.step(realDt, input);
  screens.update(realDt, input);

  const player = game.player;
  buveur.update(dt, player);
  hordeView.sync(game.horde.zombies);
  xpView.sync(game.xp.drops);
  coinView.sync(game.coinDrops.drops);
  for (const id of Object.keys(bottleViews) as WeaponId[]) bottleViews[id].sync(projectiles(id));
  enemyShotsView.sync(game.shots.shots);
  kamikazeView.sync(game.horde.zombies);
  protectorView.sync(game.horde.zombies);
  dazedView.sync(game.horde.zombies);
  pumpsView.sync(game.pumps.list, game.pumps.filling ? game.pumps.focus : null);
  chestsView.sync(game.chests.list);
  shards.update(dt);
  wine.update(dt);
  wood.update(dt);
  sparks.update(dt);
  earth.update(dt);
  stoutSplash.update(dt);
  gueuzeBurst.update(dt);
  damageNumbers.update(realDt);
  pint.update(dt);
  effects.update();

  rig.update(realDt, input, player);
  sky.update(dt, player.renderPos, camera);
  clouds.update(dt);
  planet.decor.update(dt, player.renderPos, 1 - sky.day);
  ambience.update(sky.day, game.phase !== 'home');
  // Mise au point de la profondeur de champ sur le perso
  pipeline.focusDistance = camera.position.distanceTo(focusPoint.copy(player.renderPos).addScaledVector(player.upDir, 1.1));
  // Accueil : écran séparé, le monde n'est pas rendu
  if (game.phase !== 'home') pipeline.render();

  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  debugEl.style.display = debugOn ? 'block' : 'none';
  if (debugOn) {
    debugEl.textContent = [
      `FPS ${fps.toFixed(0)}   triangles ${renderer.info.render.triangles.toLocaleString('fr')}`,
      `Altitude ${heightAt(player.upDir).toFixed(1)}   au sol ${player.onGround ? 'oui' : 'non'}`,
      'ZQSD bouger, Espace sauter, souris caméra (clic), molette zoom, F3 masquer',
    ].join('\n');
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) {
  Object.assign(window, { __game: { game, player: game.player, rig, camera, buveur, sky, heightAt, THREE, pipeline, renderer, planet, decor: planet.decor, scene, music, horde: game.horde, health: game.health, progression: game.progression, playerStats: game.stats, canette: game.loadout.weapons[0], setTimeScale: (k: number) => { game.devTimeScale = k; } } });
  const { wireDevTools } = await import('./app/devTools');
  await wireDevTools(game, { music, runLog, seed: () => planet.seed });
}
