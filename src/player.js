import * as THREE from 'three';
import { scene } from './scene.js';
import { toonMaterial } from './textures.js';
import { mouse, gamepadMove, gamepadJump } from './input.js';
import { CHARACTERS, DEFAULT_CHARACTER_ID } from './config/characters.js';

const GRAVITY = 28;
const JUMP_FORCE = 9;
const TURN_SPEED = 14; // higher = snappier; still smoothed, not instant

// Shortest-path angle interpolation (handles the ±π wraparound) — without this,
// player.facing jumping straight to Math.atan2() each frame made the character
// mesh instantly teleport-rotate on any direction change (very visible strafing
// with an analog stick, since it holds a steady off-axis input instead of a
// quick keyboard tap).
function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export const player = {
  x: 0, y: 0, z: 0, vy: 0, grounded: true,
  r: 0.8, facing: 0, hp: 100, maxHp: 100,
  level: 1, xp: 0, xpNext: 10,
  speed: 9, dmg: 10, atkSpeed: 1.0, projSpeed: 26, projCount: 1, pickupRange: 5,
  invuln: 0,
  unlockedWeapons: new Set(),
  weaponTimers: {},
};

export const playerMesh = new THREE.Group();
export const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.6, 1.0, 4, 8),
  toonMaterial({ color: 0x44ccff })
);
body.position.y = 1.1;
body.castShadow = true;
body.receiveShadow = true;
const nose = new THREE.Mesh(
  new THREE.ConeGeometry(0.25, 0.6, 8),
  toonMaterial({ color: 0x2288aa })
);
nose.rotation.x = Math.PI / 2;
nose.position.set(0, 1.1, 0.7);
nose.castShadow = true;
playerMesh.add(body, nose);
scene.add(playerMesh);

let activeColor = 0x44ccff;

// Called once the character/map select screen confirms a pick, before a run starts.
// Resets every run-scoped stat — safe to call again on replay without a page reload.
export function initPlayer(characterId) {
  const character = CHARACTERS[characterId] || CHARACTERS[DEFAULT_CHARACTER_ID];
  const base = character.baseStats;

  Object.assign(player, {
    x: 0, y: 0, z: 0, vy: 0, grounded: true, facing: 0,
    hp: base.hp, maxHp: base.hp,
    level: 1, xp: 0, xpNext: 10,
    speed: base.speed, dmg: base.dmg, atkSpeed: base.atkSpeed,
    projSpeed: base.projSpeed, projCount: base.projCount, pickupRange: base.pickupRange,
    invuln: 0,
    unlockedWeapons: new Set([character.startWeapon]),
    weaponTimers: {},
  });

  activeColor = character.color;
  body.material.color.setHex(activeColor);
  playerMesh.position.set(0, 0, 0);
}

export function updatePlayer(dt, keys) {
  let mx = 0, mz = 0;
  if (keys['w'] || keys['z'] || keys['arrowup']) mz -= 1;
  if (keys['s'] || keys['arrowdown']) mz += 1;
  if (keys['a'] || keys['q'] || keys['arrowleft']) mx -= 1;
  if (keys['d'] || keys['arrowright']) mx += 1;
  mx += gamepadMove.x;
  mz += gamepadMove.z;
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    const speedMul = Math.min(len, 1); // preserves analog stick tilt; keyboard len is always >=1
    const forwardInput = -mz / len, strafeInput = mx / len;
    const fx = -Math.sin(mouse.yaw), fz = -Math.cos(mouse.yaw);
    const rx = Math.cos(mouse.yaw), rz = -Math.sin(mouse.yaw);
    const wx = fx * forwardInput + rx * strafeInput;
    const wz = fz * forwardInput + rz * strafeInput;
    player.x += wx * player.speed * speedMul * dt;
    player.z += wz * player.speed * speedMul * dt;
    player.facing = lerpAngle(player.facing, Math.atan2(wx, wz), Math.min(1, TURN_SPEED * dt));
  }

  if ((keys[' '] || gamepadJump.pressed) && player.grounded) {
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
  body.material.color.setHex(player.invuln > 0 ? 0xffffff : activeColor);
}
