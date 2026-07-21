import * as THREE from 'three';
import { scene } from './scene.js';
import { player } from './player.js';
import { state } from './state.js';
import { requestUpgrade } from './upgrades.js';
import { toonMaterial } from './textures.js';
import { getTerrainHeight } from './terrain.js';
import { playPickup } from './audio.js';

// Shared across every orb — one geometry/material for the whole run instead of a
// fresh pair per spawn (they never differ per-instance, no reason not to reuse).
const orbGeo = new THREE.IcosahedronGeometry(0.35, 0);
const orbMat = toonMaterial({ color: 0x55ccff, emissive: 0x113344 });

const ORB_HOVER = 0.9;

export function spawnOrb(x, z, val) {
  const mesh = new THREE.Mesh(orbGeo, orbMat);
  mesh.position.set(x, getTerrainHeight(x, z) + ORB_HOVER, z);
  scene.add(mesh);
  state.xpOrbs.push({ x, z, val, r: 0.4, mesh });
}

export function gainXp(n) {
  player.xp += n;
  while (player.xp >= player.xpNext) {
    player.xp -= player.xpNext;
    player.level++;
    player.xpNext = Math.floor(player.xpNext * 1.25 + 5);
    requestUpgrade();
  }
}

export function updateOrbs(dt) {
  for (const o of state.xpOrbs) {
    o.mesh.rotation.y += dt * 3;
    const d = Math.hypot(player.x - o.x, player.z - o.z);
    if (d < player.pickupRange) {
      const speed = 18;
      o.x += (player.x - o.x) / d * speed * dt;
      o.z += (player.z - o.z) / d * speed * dt;
    }
    o.mesh.position.set(o.x, getTerrainHeight(o.x, o.z) + ORB_HOVER, o.z);
    if (d < player.r + o.r || d < 0.5) {
      o.collected = true;
      scene.remove(o.mesh);
      playPickup();
      gainXp(o.val);
    }
  }
  state.xpOrbs = state.xpOrbs.filter(o => !o.collected);
}

// Used by resetRun.js to end a run without a full page reload.
export function clearOrbs() {
  for (const o of state.xpOrbs) scene.remove(o.mesh);
  state.xpOrbs = [];
}
