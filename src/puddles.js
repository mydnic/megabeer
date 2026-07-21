import * as THREE from 'three';
import { scene } from './scene.js';
import { state } from './state.js';
import { dist2 } from './util.js';
import { toonMaterial } from './textures.js';
import { getTerrainHeight } from './terrain.js';

export function spawnPuddle(x, z, dmgPerTick, radius, duration, color = 0xcc8811) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 0.05, 20),
    toonMaterial({ color, transparent: true, opacity: 0.55 })
  );
  mesh.position.set(x, getTerrainHeight(x, z) + 0.03, z);
  scene.add(mesh);
  state.puddles.push({ x, z, radius, dmgPerTick, life: duration, tickTimer: 0, mesh });
}

export function updatePuddles(dt) {
  for (const p of state.puddles) {
    p.life -= dt;
    p.tickTimer -= dt;
    if (p.tickTimer <= 0) {
      p.tickTimer = 0.4;
      for (const e of state.enemies) {
        if (dist2(p.x, p.z, e.x, e.z) < p.radius * p.radius) {
          e.hp -= p.dmgPerTick;
          e.hitFlash = 0.15;
        }
      }
    }
  }
  const expired = state.puddles.filter(p => p.life <= 0);
  for (const p of expired) {
    scene.remove(p.mesh);
    // Radius/color vary per puddle (beer vs vomit, different weapons), so unlike
    // orbs/bottles/hp-bars these can't just share one geometry/material — dispose
    // them for real instead.
    p.mesh.geometry.dispose();
    p.mesh.material.dispose();
  }
  state.puddles = state.puddles.filter(p => p.life > 0);
}

// Used by resetRun.js to end a run without a full page reload.
export function clearPuddles() {
  for (const p of state.puddles) {
    scene.remove(p.mesh);
    p.mesh.geometry.dispose();
    p.mesh.material.dispose();
  }
  state.puddles = [];
}
