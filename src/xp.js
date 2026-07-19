import * as THREE from 'three';
import { scene } from './scene.js';
import { player } from './player.js';
import { state } from './state.js';
import { pickUpgrades } from './upgrades.js';
import { toonMaterial } from './textures.js';

export function spawnOrb(x, z, val) {
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.35, 0),
    toonMaterial({ color: 0x55ccff, emissive: 0x113344 })
  );
  mesh.position.set(x, 0.9, z);
  scene.add(mesh);
  state.xpOrbs.push({ x, z, val, r: 0.4, mesh });
}

export function gainXp(n) {
  player.xp += n;
  while (player.xp >= player.xpNext) {
    player.xp -= player.xpNext;
    player.level++;
    player.xpNext = Math.floor(player.xpNext * 1.25 + 5);
    pickUpgrades();
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
    o.mesh.position.x = o.x;
    o.mesh.position.z = o.z;
    if (d < player.r + o.r || d < 0.5) {
      o.collected = true;
      scene.remove(o.mesh);
      gainXp(o.val);
    }
  }
  state.xpOrbs = state.xpOrbs.filter(o => !o.collected);
}
