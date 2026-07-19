import * as THREE from 'three';
import { scene } from './scene.js';
import { stoneMaterial, woodMaterial, toonMaterial } from './textures.js';

const CHUNK_SIZE = 20;
const VIEW_RADIUS = 3;

const stoneMat = stoneMaterial(1, 3);
const darkStoneMat = stoneMaterial(2, 1);
const wallWoodMat = woodMaterial(2, 1);
const trunkMat = woodMaterial(1, 2);
const leafMat = toonMaterial({ color: 0x3f5a2e });
const leafMat2 = toonMaterial({ color: 0x4d6b38 });

const SPAWN_CLEAR_RADIUS = 16;

function hash(cx, cz) {
  let h = (cx * 374761393 + cz * 668265263) ^ 0x5bd1e995;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return ((h % 1000) + 1000) % 1000 / 1000;
}
function rand(cx, cz, salt) { return hash(cx * 3 + salt, cz * 7 + salt * 13); }

function pillar(x, z, colliders) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 4.5, 8), stoneMat);
  shaft.position.y = 2.25;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.4, 1.3), stoneMat);
  cap.position.y = 4.7;
  g.add(shaft, cap);
  g.position.set(x, 0, z);
  colliders.push({ x, z, r: 0.65 });
  return g;
}

function wallSegment(x, z, rotY, colliders) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 0.7), darkStoneMat);
  wall.position.set(x, 1.6, z);
  wall.rotation.y = rotY;
  for (const off of [-2.4, -1.2, 0, 1.2, 2.4]) {
    colliders.push({
      x: x + off * Math.cos(rotY),
      z: z - off * Math.sin(rotY),
      r: 0.55,
    });
  }
  return wall;
}

function arch(x, z, rotY, colliders) {
  const g = new THREE.Group();
  const l = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 4, 8), stoneMat);
  l.position.set(-1.6, 2, 0);
  const r = l.clone(); r.position.x = 1.6;
  const top = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 0.9), stoneMat);
  top.position.set(0, 4, 0);
  g.add(l, r, top);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  for (const off of [-1.6, 1.6]) {
    colliders.push({
      x: x + off * Math.cos(rotY),
      z: z - off * Math.sin(rotY),
      r: 0.45,
    });
  }
  return g;
}

function rubble(x, z) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const s = 0.5 + rand(x + i, z + i, 5) * 0.6;
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), darkStoneMat);
    m.position.set((rand(x, z, i) - 0.5) * 2, s / 2, (rand(z, x, i) - 0.5) * 2);
    m.rotation.y = rand(x, i, z) * Math.PI;
    g.add(m);
  }
  g.position.set(x, 0, z);
  return g;
}

function tree(x, z, colliders) {
  const g = new THREE.Group();
  const h = 2.6 + rand(x, z, 8) * 1.8;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, h, 7), trunkMat);
  trunk.position.y = h / 2;
  const leafMats = [leafMat, leafMat2];
  const leaves = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.1 + rand(z, x, 9) * 0.4, 0),
    leafMats[Math.floor(rand(x, z, 10) * 2)]
  );
  leaves.position.y = h + 0.6;
  leaves.rotation.y = rand(x, z, 11) * Math.PI;
  g.add(trunk, leaves);
  g.position.set(x, 0, z);
  colliders.push({ x, z, r: 0.4 });
  return g;
}

function barrel(x, z, colliders) {
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.1, 10), wallWoodMat);
  b.position.set(x, 0.55, z);
  colliders.push({ x, z, r: 0.65 });
  return b;
}

const chunks = new Map();
let colliders = [];
function key(cx, cz) { return cx + ',' + cz; }

function generateChunk(cx, cz) {
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

  if (r0 < 0.18) {
    group.add(wallSegment(originX + CHUNK_SIZE / 2, originZ + rand(cx, cz, 2) * CHUNK_SIZE, rand(cx, cz, 3) * Math.PI, chunkColliders));
  } else if (r0 < 0.32) {
    group.add(pillar(originX + rand(cx, cz, 2) * CHUNK_SIZE, originZ + rand(cx, cz, 4) * CHUNK_SIZE, chunkColliders));
  } else if (r0 < 0.4) {
    group.add(arch(originX + CHUNK_SIZE / 2, originZ + CHUNK_SIZE / 2, rand(cx, cz, 3) * Math.PI, chunkColliders));
  } else if (r0 < 0.55) {
    group.add(rubble(originX + rand(cx, cz, 2) * CHUNK_SIZE, originZ + rand(cx, cz, 4) * CHUNK_SIZE));
  } else if (r0 < 0.62) {
    group.add(barrel(originX + rand(cx, cz, 2) * CHUNK_SIZE, originZ + rand(cx, cz, 4) * CHUNK_SIZE, chunkColliders));
  } else if (r0 < 0.85) {
    group.add(tree(originX + rand(cx, cz, 2) * CHUNK_SIZE, originZ + rand(cx, cz, 4) * CHUNK_SIZE, chunkColliders));
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
