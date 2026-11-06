import * as THREE from 'three';
import { CAMERA } from './config/world';
import { initInput, readInput } from './core/input';
import { BuveurVisual } from './player/buveurVisual';
import { CameraRig } from './player/cameraRig';
import { PlayerController } from './player/controller';
import { Pipeline } from './render/pipeline';
import { createSky } from './world/sky';
import { createClouds } from './world/clouds';
import { buildTerrain, heightAt } from './world/terrain';
import { createDecor } from './world/decor';

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

// --- Monde
const terrain = buildTerrain();
scene.add(terrain);
const sky = createSky(scene);

const clouds = createClouds(scene);

// --- Joueur
// Décor de l'Abbaye (modèles, collisions, lanternes) ; le joueur part du parvis, face à la porte
const decor = await createDecor(scene);
const player = new PlayerController(decor.spawn.dir);
player.decor = decor.collider;
player.facing.copy(decor.spawn.facing);
player.camFwd.copy(decor.spawn.facing);
player.interpolate(1);
const buveur = new BuveurVisual(scene);
buveur.load().catch((e) => console.error(e));
const rig = new CameraRig(camera);
initInput(renderer.domElement);

// --- Debug (F3)
const debugEl = document.getElementById('debug')!;
let debugOn = import.meta.env.DEV;
addEventListener('keydown', (e) => { if (e.code === 'F3') { debugOn = !debugOn; e.preventDefault(); } });
let fpsAcc = 0, fpsN = 0, fps = 0;

// --- Boucle : physique à pas fixe, rendu à chaque frame
const STEP = 1 / 120;
let acc = 0, last = performance.now();
const focusPoint = new THREE.Vector3();

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  renderer.info.reset();
  const input = readInput();
  player.feed(input);
  acc += dt;
  while (acc >= STEP) { player.step(STEP, input); acc -= STEP; }
  player.interpolate(acc / STEP);

  const up = player.upDir;
  buveur.update(dt, player);

  rig.update(dt, input, player);
  sky.update(dt, player.renderPos, camera);
  clouds.update(dt);
  decor.update(dt, player.renderPos, 1 - sky.day);
  // Mise au point de la profondeur de champ sur le perso
  pipeline.focusDistance = camera.position.distanceTo(focusPoint.copy(player.renderPos).addScaledVector(player.upDir, 1.1));
  pipeline.render();

  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  debugEl.style.display = debugOn ? 'block' : 'none';
  if (debugOn) {
    debugEl.textContent = [
      `FPS ${fps.toFixed(0)}   triangles ${renderer.info.render.triangles.toLocaleString('fr')}`,
      `Altitude ${heightAt(up).toFixed(1)}   au sol ${player.onGround ? 'oui' : 'non'}`,
      'ZQSD bouger, Espace sauter, souris caméra (clic), molette zoom, F3 masquer',
    ].join('\n');
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) Object.assign(window, { __game: { player, rig, camera, buveur, sky, heightAt, THREE, pipeline, renderer, decor, scene } });
