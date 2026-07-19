import * as THREE from 'three';
import { scene, camera } from './scene.js';
import { player } from './player.js';
import { state } from './state.js';
import { dist2 } from './util.js';
import { ENEMY_TYPES } from './config/enemies.js';
import { enemyModels, cloneEnemyModel } from './enemyModels.js';

function makeHpBar() {
  const g = new THREE.Group();
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14), new THREE.MeshBasicMaterial({ color: 0xee3333 }));
  fill.position.z = 0.001;
  g.add(back, fill);
  g.userData.fill = fill;
  return g;
}

function spawnKind(k, distance) {
  if (!enemyModels.ready) return;

  const angle = Math.random() * Math.PI * 2;
  const dist = distance + Math.random() * (distance * 0.2);
  const x = player.x + Math.cos(angle) * dist;
  const z = player.z + Math.sin(angle) * dist;
  const scale = 1 + state.gameTime / 90;

  const mesh = cloneEnemyModel(k.model, k.color, k.r);
  mesh.position.set(x, 0, z);
  const barHeight = k.r * 2.6 + 0.4;
  const hpBar = makeHpBar();
  hpBar.position.set(x, barHeight, z);
  scene.add(mesh, hpBar);

  state.enemies.push({
    x, z, r: k.r, hp: k.hp * scale, maxHp: k.hp * scale,
    speed: k.speed, dmg: k.dmg, xp: k.xp, mesh, hpBar, barHeight, hitFlash: 0,
    mixer: mesh.userData.mixer,
  });
}

export function spawnEnemy() {
  const unlocked = ENEMY_TYPES.filter(t => t.unlockAt <= state.gameTime);
  const k = unlocked[Math.floor(Math.random() * unlocked.length)];
  spawnKind(k, 40);
}

// Dev-panel only: spawn a specific enemy type close to the player for inspection.
export function spawnEnemyById(id, distance = 6) {
  const k = ENEMY_TYPES.find(t => t.id === id);
  if (k) spawnKind(k, distance);
}

export function nearestEnemy() {
  let best = null, bd = Infinity;
  for (const e of state.enemies) {
    const d = dist2(player.x, player.z, e.x, e.z);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

export function updateEnemies(dt) {
  for (const e of state.enemies) {
    const dx = player.x - e.x, dz = player.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    e.x += dx / d * e.speed * dt;
    e.z += dz / d * e.speed * dt;
    e.mesh.position.x = e.x;
    e.mesh.position.z = e.z;
    e.mesh.rotation.y = Math.atan2(dx, dz);
    e.hpBar.position.set(e.x, e.barHeight, e.z);
    e.hpBar.quaternion.copy(camera.quaternion);
    e.hpBar.userData.fill.scale.x = Math.max(0, e.hp / e.maxHp);

    e.mixer.update(dt * (e.speed / 2.8));

    if (e.hitFlash > 0) {
      e.hitFlash -= dt;
      for (const mat of e.mesh.userData.mats) {
        mat.emissive.setHex(0xff3333);
        mat.emissiveIntensity = e.hitFlash * 4;
      }
    } else {
      for (const mat of e.mesh.userData.mats) mat.emissiveIntensity = 0;
    }

    if (d < e.r + player.r && player.invuln <= 0) {
      if (!state.godmode) player.hp -= e.dmg;
      player.invuln = 0.5;
    }
  }
}

export function removeDeadEnemies(onDeath) {
  const dead = state.enemies.filter(e => e.hp <= 0);
  for (const e of dead) {
    scene.remove(e.mesh, e.hpBar);
    onDeath(e);
  }
  state.enemies = state.enemies.filter(e => e.hp > 0);
}
