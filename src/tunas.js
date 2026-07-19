import * as THREE from 'three';
import { scene } from './scene.js';
import { player } from './player.js';
import { state } from './state.js';
import { toonMaterial } from './textures.js';
import { addTunas } from './meta.js';
import { ECONOMY } from './config/economy.js';

const coinGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.07, 14);
const coinMat = toonMaterial({ color: 0xffcc33, emissive: 0x664400 });

export function spawnTunasDrop(x, z, amount) {
  const mesh = new THREE.Mesh(coinGeo, coinMat);
  mesh.position.set(x, 0.5, z);
  scene.add(mesh);
  state.tunasDrops.push({ x, z, amount, r: 0.35, mesh });
}

// Single entry point for enemy-kill TUNAS income — see src/config/economy.js
// for the pacing formula. Call this instead of spawnTunasDrop() directly on kill.
export function maybeDropTunas(x, z) {
  if (Math.random() < ECONOMY.tunasDropChance) {
    spawnTunasDrop(x, z, ECONOMY.tunasDropAmount);
  }
}

export function updateTunasDrops(dt) {
  for (const t of state.tunasDrops) {
    t.mesh.rotation.y += dt * 4;
    const d = Math.hypot(player.x - t.x, player.z - t.z);
    if (d < player.pickupRange) {
      const speed = 18;
      t.x += (player.x - t.x) / d * speed * dt;
      t.z += (player.z - t.z) / d * speed * dt;
    }
    t.mesh.position.x = t.x;
    t.mesh.position.z = t.z;
    if (d < player.r + t.r || d < 0.5) {
      t.collected = true;
      scene.remove(t.mesh);
      addTunas(t.amount);
      state.tunasEarnedThisRun += t.amount;
    }
  }
  state.tunasDrops = state.tunasDrops.filter(t => !t.collected);
}

// Used by resetRun.js to end a run without a full page reload.
export function clearTunasDrops() {
  for (const t of state.tunasDrops) scene.remove(t.mesh);
  state.tunasDrops = [];
}
