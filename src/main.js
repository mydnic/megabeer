import * as THREE from 'three';
import { scene, camera, renderer, grid, resize } from './scene.js';
import { keys, mouse } from './input.js';
import { state } from './state.js';
import { player, updatePlayer, playerMesh } from './player.js';
import { spawnEnemy, nearestEnemy, updateEnemies, removeDeadEnemies } from './enemies.js';
import { updateBullets, handleBulletEnemyCollisions } from './projectiles.js';
import { updateWeapons } from './weapons.js';
import { updatePuddles } from './puddles.js';
import { spawnOrb, updateOrbs } from './xp.js';
import { maybeDropTunas, updateTunasDrops } from './tunas.js';
import { updateHud, endGame } from './hud.js';
import { updateMap, resolveCollisions } from './mapgen.js';
import { initMenu } from './menu.js';

resize();
updateMap(0, 0);
initMenu(() => { state.started = true; });

if (import.meta.env.DEV) {
  const { initDevPanel } = await import('./devpanel.js');
  initDevPanel();
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.started && !state.paused) update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function update(dt) {
  state.gameTime += dt;
  if (state.gameTime >= 300) { endGame(true); return; }

  updatePlayer(dt, keys);
  resolveCollisions(player);
  playerMesh.position.x = player.x;
  playerMesh.position.z = player.z;

  state.spawnTimer -= dt;
  const spawnRate = Math.max(0.15, 1.1 - state.gameTime * 0.01);
  if (state.spawnTimer <= 0) {
    state.spawnTimer = spawnRate;
    const burst = 1 + Math.floor(state.gameTime / 60);
    for (let i = 0; i < burst; i++) spawnEnemy();
  }

  updateWeapons(dt, state.gameTime);
  updateBullets(dt);
  updateEnemies(dt);
  handleBulletEnemyCollisions();
  updatePuddles(dt);

  removeDeadEnemies(e => {
    state.killCount++;
    spawnOrb(e.x, e.z, e.xp);
    maybeDropTunas(e.x, e.z);
  });

  updateOrbs(dt);
  updateTunasDrops(dt);
  updateHud();

  if (player.hp <= 0) { endGame(false); return; }

  grid.position.x = Math.round(player.x / 10) * 10;
  grid.position.z = Math.round(player.z / 10) * 10;
  updateMap(player.x, player.z);

  const camDist = 16;
  const cx = player.x + Math.sin(mouse.yaw) * camDist * Math.cos(mouse.pitch);
  const cz = player.z + Math.cos(mouse.yaw) * camDist * Math.cos(mouse.pitch);
  const cy = player.y + camDist * Math.sin(mouse.pitch) + 2;
  camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.18);
  camera.lookAt(player.x, player.y + 1, player.z);
}

requestAnimationFrame(loop);
