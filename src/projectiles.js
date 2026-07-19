import * as THREE from 'three';
import { scene } from './scene.js';
import { player } from './player.js';
import { state } from './state.js';
import { dist2 } from './util.js';

export function fireProjectile(angle, opts) {
  const { geometry, material, dmg, speed, r, pierce = 1, spin = 0, spinAxis = 'y', originY = 1.1, life = 1.4 } = opts;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(player.x, originY, player.z);
  scene.add(mesh);
  state.bullets.push({
    x: player.x, z: player.z,
    vx: Math.sin(angle) * speed, vz: Math.cos(angle) * speed,
    dmg, life, r, mesh, pierce, spin, spinAxis, hit: new Set(),
  });
}

export function updateBullets(dt) {
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.life -= dt;
    b.mesh.position.set(b.x, b.mesh.position.y, b.z);
    if (b.spin) b.mesh.rotation[b.spinAxis] += b.spin * dt;
  }
  removeExpiredBullets();
}

function removeExpiredBullets() {
  for (const b of state.bullets) {
    if (b.life <= 0) scene.remove(b.mesh);
  }
  state.bullets = state.bullets.filter(b => b.life > 0);
}

export function handleBulletEnemyCollisions() {
  for (const b of state.bullets) {
    for (const e of state.enemies) {
      if (e.hp <= 0 || b.hit.has(e)) continue;
      if (dist2(b.x, b.z, e.x, e.z) < (b.r + e.r) * (b.r + e.r)) {
        e.hp -= b.dmg;
        e.hitFlash = 0.15;
        b.hit.add(e);
        b.pierce -= 1;
        if (b.pierce <= 0) b.life = 0;
        break;
      }
    }
  }
  removeExpiredBullets();
}
