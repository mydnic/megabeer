import * as THREE from 'three';
import { scene } from './scene.js';
import { toonMaterial } from './textures.js';
import { mouse } from './input.js';

const GRAVITY = 28;
const JUMP_FORCE = 9;

export const player = {
  x: 0, y: 0, z: 0, vy: 0, grounded: true,
  r: 0.8, facing: 0, speed: 9, hp: 100, maxHp: 100,
  level: 1, xp: 0, xpNext: 10,
  dmg: 10, atkSpeed: 1.0, projSpeed: 26, projCount: 1, pickupRange: 5,
  invuln: 0,
  unlockedWeapons: new Set(['beer']),
  weaponTimers: {},
};

export const playerMesh = new THREE.Group();
export const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.6, 1.0, 4, 8),
  toonMaterial({ color: 0x44ccff })
);
body.position.y = 1.1;
const nose = new THREE.Mesh(
  new THREE.ConeGeometry(0.25, 0.6, 8),
  toonMaterial({ color: 0x2288aa })
);
nose.rotation.x = Math.PI / 2;
nose.position.set(0, 1.1, 0.7);
playerMesh.add(body, nose);
scene.add(playerMesh);

export function updatePlayer(dt, keys) {
  let mx = 0, mz = 0;
  if (keys['w'] || keys['z'] || keys['arrowup']) mz -= 1;
  if (keys['s'] || keys['arrowdown']) mz += 1;
  if (keys['a'] || keys['q'] || keys['arrowleft']) mx -= 1;
  if (keys['d'] || keys['arrowright']) mx += 1;
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    const forwardInput = -mz / len, strafeInput = mx / len;
    const fx = -Math.sin(mouse.yaw), fz = -Math.cos(mouse.yaw);
    const rx = Math.cos(mouse.yaw), rz = -Math.sin(mouse.yaw);
    const wx = fx * forwardInput + rx * strafeInput;
    const wz = fz * forwardInput + rz * strafeInput;
    player.x += wx * player.speed * dt;
    player.z += wz * player.speed * dt;
    player.facing = Math.atan2(wx, wz);
  }

  if (keys[' '] && player.grounded) {
    player.vy = JUMP_FORCE;
    player.grounded = false;
  }
  player.vy -= GRAVITY * dt;
  player.y += player.vy * dt;
  if (player.y <= 0) {
    player.y = 0;
    player.vy = 0;
    player.grounded = true;
  }

  playerMesh.position.set(player.x, player.y, player.z);
  playerMesh.rotation.y = player.facing;

  if (player.invuln > 0) player.invuln -= dt;
  body.material.color.setHex(player.invuln > 0 ? 0xffffff : 0x44ccff);
}
