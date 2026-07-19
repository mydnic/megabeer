import * as THREE from 'three';
import { scene, camera } from './scene.js';
import { player } from './player.js';
import { state } from './state.js';
import { dist2 } from './util.js';
import { ENEMY_TYPES } from './config/enemies.js';
import { enemyModels, cloneEnemyModel } from './enemyModels.js';
import { resolveCollisions } from './mapgen.js';

// Contact collision only checks x/z, so without this a jump would never actually
// dodge anything — the whole point of "le saut ne sert à rien" (issue #1). Above
// this height, zombie contact damage is skipped: a jump buys a brief dodge window.
const DODGE_HEIGHT = 0.6;

// Shared across every hp bar — geometry/material never vary per-instance (only
// the fill mesh's scale.x does, which is an Object3D property, not the material).
const hpBarGeo = new THREE.PlaneGeometry(1.2, 0.14);
const hpBarBackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
const hpBarFillMat = new THREE.MeshBasicMaterial({ color: 0xee3333 });

function makeHpBar() {
  const g = new THREE.Group();
  const back = new THREE.Mesh(hpBarGeo, hpBarBackMat);
  const fill = new THREE.Mesh(hpBarGeo, hpBarFillMat);
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

// Mutual push-apart so a crowd doesn't collapse into one overlapping blob.
// O(n²) — fine at survivors-like enemy counts; revisit with spatial hashing if
// the roster ever grows into the many-hundreds.
function separateEnemies() {
  const enemies = state.enemies;
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j];
      const dx = a.x - b.x, dz = a.z - b.z;
      const dist = Math.hypot(dx, dz);
      const min = a.r + b.r;
      if (dist > 0.0001 && dist < min) {
        const push = (min - dist) / 2;
        const nx = dx / dist, nz = dz / dist;
        a.x += nx * push; a.z += nz * push;
        b.x -= nx * push; b.z -= nz * push;
      }
    }
  }
}

export function updateEnemies(dt) {
  for (const e of state.enemies) {
    const dx = player.x - e.x, dz = player.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    e.x += dx / d * e.speed * dt;
    e.z += dz / d * e.speed * dt;
  }

  separateEnemies();
  for (const e of state.enemies) resolveCollisions(e);

  for (const e of state.enemies) {
    const dx = player.x - e.x, dz = player.z - e.z;
    const d = Math.hypot(dx, dz) || 1;

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
      if (!state.godmode && player.y < DODGE_HEIGHT) player.hp -= e.dmg;
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

// Used by resetRun.js to end a run without a full page reload.
export function clearEnemies() {
  for (const e of state.enemies) scene.remove(e.mesh, e.hpBar);
  state.enemies = [];
}
