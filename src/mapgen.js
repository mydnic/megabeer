import * as THREE from 'three';
import { scene } from './scene.js';
import { decorModels, cloneDecorModel } from './decorModels.js';

const CHUNK_SIZE = 20;
const VIEW_RADIUS = 3;

const SPAWN_CLEAR_RADIUS = 16;

function hash(cx, cz) {
  let h = (cx * 374761393 + cz * 668265263) ^ 0x5bd1e995;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return ((h % 1000) + 1000) % 1000 / 1000;
}
function rand(cx, cz, salt) { return hash(cx * 3 + salt, cz * 7 + salt * 13); }

// Long thin props (walls) need coverage along their length, not one big circle —
// sample a handful of points spaced along the local X axis instead.
function wallColliders(x, z, rotY, sizeX, colliders, count = 5) {
  const half = sizeX / 2;
  const spacing = sizeX / (count - 1);
  const r = Math.max(0.35, spacing * 0.46);
  for (let i = 0; i < count; i++) {
    const off = -half + spacing * i;
    colliders.push({
      x: x + off * Math.cos(rotY),
      z: z - off * Math.sin(rotY),
      r,
    });
  }
}

function spawnWall(x, z, rotY, colliders, ruined) {
  const { mesh, sizeX } = cloneDecorModel(ruined ? 'wallRuined' : 'wall', ruined ? 2.6 : 3.2);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = rotY;
  wallColliders(x, z, rotY, sizeX, colliders);
  return mesh;
}

function spawnPillar(x, z, colliders, large) {
  const { mesh, radius } = cloneDecorModel(large ? 'pillarLarge' : 'pillar', large ? 4.4 : 5.0);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = rand(x, z, 6) * Math.PI * 2;
  colliders.push({ x, z, r: radius * 0.7 });
  return mesh;
}

function spawnArch(x, z, rotY, colliders) {
  const { mesh, sizeX } = cloneDecorModel('arch', 4.6);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = rotY;
  // Only block at the two posts — the gap in between stays walkable (a doorway).
  const half = sizeX / 2;
  for (const off of [-half * 0.75, half * 0.75]) {
    colliders.push({
      x: x + off * Math.cos(rotY),
      z: z - off * Math.sin(rotY),
      r: 0.45,
    });
  }
  return mesh;
}

function spawnRocks(x, z) {
  const key = rand(x, z, 7) < 0.5 ? 'rocks' : 'rocksCastle';
  const { mesh } = cloneDecorModel(key, 0.9 + rand(z, x, 12) * 0.6);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = rand(x, z, 13) * Math.PI * 2;
  return mesh; // decorative, no collider (walkable through, matches old rubble)
}

function spawnGrave(x, z, colliders) {
  const keys = ['graveBevel', 'graveBroken', 'graveCross'];
  const key = keys[Math.floor(rand(x, z, 14) * keys.length)];
  const { mesh, radius } = cloneDecorModel(key, 1.0 + rand(z, x, 15) * 0.4);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = rand(x, z, 16) * Math.PI * 2;
  colliders.push({ x, z, r: radius * 0.6 });
  return mesh;
}

function spawnCrypt(x, z, colliders) {
  const { mesh, radius } = cloneDecorModel('crypt', 3.6);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = rand(x, z, 17) * Math.PI * 2;
  colliders.push({ x, z, r: radius * 0.75 });
  return mesh;
}

function spawnTree(x, z, colliders) {
  const key = rand(x, z, 8) < 0.5 ? 'treeCastle' : 'pineCrooked';
  const { mesh, radius } = cloneDecorModel(key, 3.0 + rand(z, x, 9) * 2.2);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = rand(x, z, 10) * Math.PI * 2;
  colliders.push({ x, z, r: Math.min(0.5, radius * 0.4) });
  return mesh;
}

function spawnBarrel(x, z, colliders) {
  const { mesh, radius } = cloneDecorModel('kegBarrel', 1.1);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = rand(x, z, 22) * Math.PI * 2;
  colliders.push({ x, z, r: radius * 0.8 });
  return mesh;
}

const chunks = new Map();
let colliders = [];
function key(cx, cz) { return cx + ',' + cz; }

function generateChunk(cx, cz) {
  if (!decorModels.ready) return; // retried automatically next frame by updateMap()

  const group = new THREE.Group();
  const originX = cx * CHUNK_SIZE, originZ = cz * CHUNK_SIZE;
  const centerX = originX + CHUNK_SIZE / 2, centerZ = originZ + CHUNK_SIZE / 2;
  const r0 = rand(cx, cz, 1);
  const chunkColliders = [];

  if (Math.hypot(centerX, centerZ) < SPAWN_CLEAR_RADIUS) {
    scene.add(group);
    chunks.set(key(cx, cz), group);
    return;
  }

  const px = originX + rand(cx, cz, 2) * CHUNK_SIZE;
  const pz = originZ + rand(cx, cz, 4) * CHUNK_SIZE;
  const rotY = rand(cx, cz, 3) * Math.PI;
  const ruined = rand(cx, cz, 20) < 0.4;

  if (r0 < 0.16) {
    group.add(spawnWall(originX + CHUNK_SIZE / 2, pz, rotY, chunkColliders, ruined));
  } else if (r0 < 0.30) {
    group.add(spawnPillar(px, pz, chunkColliders, rand(cx, cz, 21) < 0.5));
  } else if (r0 < 0.38) {
    group.add(spawnArch(originX + CHUNK_SIZE / 2, originZ + CHUNK_SIZE / 2, rotY, chunkColliders));
  } else if (r0 < 0.51) {
    group.add(spawnRocks(px, pz));
  } else if (r0 < 0.58) {
    group.add(spawnBarrel(px, pz, chunkColliders));
  } else if (r0 < 0.78) {
    group.add(spawnTree(px, pz, chunkColliders));
  } else if (r0 < 0.90) {
    group.add(spawnGrave(px, pz, chunkColliders));
  } else if (r0 < 0.95) {
    group.add(spawnCrypt(px, pz, chunkColliders));
  }

  scene.add(group);
  const k = key(cx, cz);
  chunks.set(k, group);
  for (const c of chunkColliders) c.chunkKey = k;
  colliders.push(...chunkColliders);
}

export function updateMap(px, pz) {
  const pcx = Math.floor(px / CHUNK_SIZE), pcz = Math.floor(pz / CHUNK_SIZE);
  const wanted = new Set();
  for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
    for (let dz = -VIEW_RADIUS; dz <= VIEW_RADIUS; dz++) {
      const cx = pcx + dx, cz = pcz + dz;
      const k = key(cx, cz);
      wanted.add(k);
      if (!chunks.has(k)) generateChunk(cx, cz);
    }
  }
  for (const [k, group] of chunks) {
    if (!wanted.has(k)) {
      scene.remove(group);
      chunks.delete(k);
      colliders = colliders.filter(c => c.chunkKey !== k);
    }
  }
}

export function resolveCollisions(entity) {
  for (const c of colliders) {
    const dx = entity.x - c.x, dz = entity.z - c.z;
    const d = Math.hypot(dx, dz);
    const min = entity.r + c.r;
    if (d > 0.0001 && d < min) {
      const overlap = min - d;
      entity.x += dx / d * overlap;
      entity.z += dz / d * overlap;
    }
  }
}
