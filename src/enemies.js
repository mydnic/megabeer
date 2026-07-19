import * as THREE from 'three';
import { scene, camera } from './scene.js';
import { player } from './player.js';
import { state } from './state.js';
import { dist2 } from './util.js';
import { toonMaterial } from './textures.js';
import { ENEMY_TYPES, ENEMY_TIER_SECONDS } from './config/enemies.js';

const torsoGeo = new THREE.BoxGeometry(1.0, 1.2, 0.6);
const headGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
const limbGeo = new THREE.CylinderGeometry(0.14, 0.11, 1.0, 6);
limbGeo.translate(0, -0.5, 0);
const legGeo = new THREE.CylinderGeometry(0.17, 0.13, 1.05, 6);
legGeo.translate(0, -0.5, 0);

function makeZombieMesh(k) {
  const mat = toonMaterial({ color: k.color });
  const g = new THREE.Group();

  const torso = new THREE.Mesh(torsoGeo, mat);
  torso.position.y = 1.3;

  const head = new THREE.Mesh(headGeo, mat);
  head.position.y = 2.15;

  const armL = new THREE.Mesh(limbGeo, mat);
  armL.position.set(-0.62, 1.8, 0);
  armL.rotation.x = -1.1;
  const armR = new THREE.Mesh(limbGeo, mat);
  armR.position.set(0.62, 1.8, 0);
  armR.rotation.x = -1.1;

  const legL = new THREE.Mesh(legGeo, mat);
  legL.position.set(-0.26, 0.85, 0);
  const legR = new THREE.Mesh(legGeo, mat);
  legR.position.set(0.26, 0.85, 0);

  g.add(torso, head, armL, armR, legL, legR);
  g.scale.setScalar(k.r);
  g.userData.mat = mat;
  g.userData.limbs = { armL, armR, legL, legR };
  return g;
}

function makeHpBar() {
  const g = new THREE.Group();
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14), new THREE.MeshBasicMaterial({ color: 0xee3333 }));
  fill.position.z = 0.001;
  g.add(back, fill);
  g.userData.fill = fill;
  return g;
}

export function spawnEnemy() {
  const angle = Math.random() * Math.PI * 2;
  const dist = 40 + Math.random() * 8;
  const x = player.x + Math.cos(angle) * dist;
  const z = player.z + Math.sin(angle) * dist;
  const tier = Math.min(ENEMY_TYPES.length - 1, Math.floor(state.gameTime / ENEMY_TIER_SECONDS));
  const k = ENEMY_TYPES[Math.min(ENEMY_TYPES.length - 1, Math.floor(Math.random() * (tier + 1)))];
  const scale = 1 + state.gameTime / 90;

  const mesh = makeZombieMesh(k);
  mesh.position.set(x, 0, z);
  const barHeight = k.r * 2.6 + 0.4;
  const hpBar = makeHpBar();
  hpBar.position.set(x, barHeight, z);
  scene.add(mesh, hpBar);

  state.enemies.push({
    x, z, r: k.r, hp: k.hp * scale, maxHp: k.hp * scale,
    speed: k.speed, dmg: k.dmg, xp: k.xp, mesh, hpBar, barHeight, hitFlash: 0,
    walkPhase: Math.random() * 10,
  });
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

    e.walkPhase += dt * e.speed * 2.2;
    const swing = Math.sin(e.walkPhase) * 0.5;
    const { armL, armR, legL, legR } = e.mesh.userData.limbs;
    armL.rotation.x = -1.1 + swing;
    armR.rotation.x = -1.1 - swing;
    legL.rotation.x = -swing * 0.8;
    legR.rotation.x = swing * 0.8;

    if (e.hitFlash > 0) {
      e.hitFlash -= dt;
      e.mesh.userData.mat.emissive.setHex(0xff3333);
      e.mesh.userData.mat.emissiveIntensity = e.hitFlash * 4;
    } else {
      e.mesh.userData.mat.emissiveIntensity = 0;
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
