import * as THREE from 'three';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';
import { PLANET_RADIUS as R } from '../../config/world';
import { DECOR_LAYOUT as D, type DecorModelId } from '../../config/decor';
import { abbeySites, heightAt, slopeGradient } from '../terrain';

/** Un élément posé : modèle et transformation locale -> monde (le y local suit la verticale). */
export type Placement = { id: DecorModelId; matrix: THREE.Matrix4 };

const Y = new THREE.Vector3(0, 1, 0);

/** Petit générateur pseudo-aléatoire reproductible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296);
}

/**
 * Repère local posé sur la planète : origine au sol à la direction `dir`, y = verticale,
 * rotation `yaw` autour de la verticale (alignée sur le repère `frame` d'un amas).
 */
function placeAt(dir: THREE.Vector3, yaw: number, frameQ: THREE.Quaternion | null, sink = 0.05): THREE.Matrix4 {
  const up = dir.clone().normalize();
  const q = new THREE.Quaternion();
  if (frameQ) {
    // Orientation de l'amas, recalée sur la verticale locale (la courbure tourne un peu la verticale)
    const fUp = Y.clone().applyQuaternion(frameQ);
    q.setFromUnitVectors(fUp, up).multiply(frameQ);
  } else {
    q.setFromUnitVectors(Y, up);
  }
  q.multiply(new THREE.Quaternion().setFromAxisAngle(Y, yaw));
  const p = up.clone().multiplyScalar(R + heightAt(up) - sink);
  return new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1));
}

/** Repère tangent d'un amas centré en `c` (vecteurs unitaires e1, e2 du plan, quaternion). */
function clusterFrame(c: THREE.Vector3, yaw: number) {
  const q = new THREE.Quaternion().setFromUnitVectors(Y, c).multiply(new THREE.Quaternion().setFromAxisAngle(Y, yaw));
  const e1 = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const e2 = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  return { q, e1, e2, at: (x: number, z: number) => c.clone().multiplyScalar(R).addScaledVector(e1, x).addScaledVector(e2, z).normalize() };
}

function suitable(d: THREE.Vector3) {
  if (heightAt(d) > D.maxAltitude) return false;
  const t1 = new THREE.Vector3().crossVectors(d, Y);
  if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0);
  t1.normalize();
  const t2 = new THREE.Vector3().crossVectors(d, t1);
  return slopeGradient(d, t1, t2, new THREE.Vector3()).length() < D.maxSlope;
}

const pick = <T>(r: () => number, list: readonly T[]) => list[Math.floor(r() * list.length)];

/** Génère tout le décor de la planète Abbaye (reproductible : même graine, même planète). */
/**
 * Point de départ d'une run tiré au hasard : terrain praticable, et `isClear(dir)` (rien du décor
 * autour). Regard dans une direction au hasard. Null si rien n'est trouvé (très improbable).
 */
export function randomSpawn(isClear: (dir: THREE.Vector3) => boolean) {
  for (let i = 0; i < 400; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const dir = new THREE.Vector3(s * Math.cos(a), u, s * Math.sin(a));
    if (!suitable(dir) || !isClear(dir)) continue;
    const t1 = new THREE.Vector3().crossVectors(dir, Y);
    if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0);
    t1.normalize();
    const t2 = new THREE.Vector3().crossVectors(dir, t1);
    const yaw = Math.random() * Math.PI * 2;
    return { dir, facing: t1.multiplyScalar(Math.cos(yaw)).addScaledVector(t2, Math.sin(yaw)).normalize() };
  }
  return null;
}

export function layoutAbbeyPlanet(seed: number): { placements: Placement[]; spawn: { dir: THREE.Vector3; facing: THREE.Vector3 } } {
  const r = rng(seed);
  const out: Placement[] = [];
  const add = (id: DecorModelId, m: THREE.Matrix4) => out.push({ id, matrix: m });

  // ---------------------------------------------------------------- les abbayes
  // Repère d'une abbaye (glTF) : façade vers +z, parvis jusqu'à z = 32, clocher côté -x, cloître côté +x
  const fronts: ((x: number, z: number) => THREE.Vector3)[] = [];
  abbeySites.forEach((site, n) => {
    const abbey = clusterFrame(site.dir, n === 0 ? 0.6 : r() * Math.PI * 2);
    add('abbey', placeAt(site.dir, 0, abbey.q, 0));
    const A = (x: number, z: number) => abbey.at(x, z);
    fronts.push(A);
    // Allée de réverbères le long du parvis
    for (const z of [16, 23, 30]) {
      add('lightpost', placeAt(A(-3.4, z), Math.PI / 2, abbey.q));
      add('lightpost', placeAt(A(3.4, z), -Math.PI / 2, abbey.q));
    }
    // Cimetière de l'abbaye, à gauche du clocher, avec grille et lanternes
    graveyard(r, A, abbey.q, -27, 4, 4 + Math.floor(r() * 2), 5 + Math.floor(r() * 2), add, true);
    // Quelques sapins autour de l'enclos
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = 30 + r() * 10;
      const tx = Math.cos(a) * d, tz = Math.sin(a) * d;
      if (Math.abs(tx) < 7 && tz > 8) continue; // l'allée du parvis reste dégagée
      const dir = A(tx, tz);
      if (suitable(dir)) add('pine', placeAt(dir, r() * 6.28, null, 0.1));
    }
  });

  // ---------------------------------------------------------------- amas : ruines et cimetières
  const noise = new ImprovedNoise();
  const nOff = r() * 256; // forêts placées différemment selon la seed
  const centers: THREE.Vector3[] = [];
  const awayFromAbbey = (d: THREE.Vector3, m: number) => abbeySites.every((s) => d.angleTo(s.dir) * R > D.abbeyRadius + D.abbeyBlend + m);
  const freeFrom = (d: THREE.Vector3, m: number) => centers.every((c) => c.angleTo(d) * R > m);
  const randomDir = () => {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    return new THREE.Vector3(s * Math.cos(a), u, s * Math.sin(a));
  };
  for (const [kind, count] of [['ruin', D.ruinClusters], ['graveyard', D.graveyardClusters]] as const) {
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 60; tries++) {
      const c = randomDir();
      if (!awayFromAbbey(c, 15) || !freeFrom(c, 40) || !suitable(c)) continue;
      // Il faut un terrain à peu près plat sur toute l'emprise
      const f = clusterFrame(c, r() * Math.PI * 2);
      if (![[-9, -9], [9, -9], [-9, 9], [9, 9]].every(([x, z]) => Math.abs(heightAt(f.at(x, z)) - heightAt(c)) < 1.6)) continue;
      centers.push(c);
      placed++;
      if (kind === 'ruin') ruin(r, f.at, f.q, add);
      else graveyard(r, f.at, f.q, 0, 0, 3 + Math.floor(r() * 3), 4 + Math.floor(r() * 3), add, false);
    }
  }

  // ---------------------------------------------------------------- forêts et terrain ouvert
  const grid = new Map<string, THREE.Vector3[]>();
  const key = (v: THREE.Vector3) => `${Math.floor(v.x * R / 6)},${Math.floor(v.y * R / 6)},${Math.floor(v.z * R / 6)}`;
  const tooClose = (d: THREE.Vector3, m: number) => {
    const p = d.clone().multiplyScalar(R);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const k = `${Math.floor(p.x / 6) + dx},${Math.floor(p.y / 6) + dy},${Math.floor(p.z / 6) + dz}`;
      for (const o of grid.get(k) ?? []) if (o.distanceTo(p) < m) return true;
    }
    return false;
  };
  for (let i = 0; i < D.scatterCandidates; i++) {
    const d = randomDir();
    if (!awayFromAbbey(d, 4) || !freeFrom(d, 16) || !suitable(d)) continue;
    const forest = noise.noise(d.x * 3.2 + 9 + nOff, d.y * 3.2, d.z * 3.2 - 4) > 0.08;
    const roll = r();
    let id: DecorModelId | null = null;
    if (forest) {
      if (roll < 0.8) id = 'pine';
      else if (roll < 0.9) id = 'pineCrooked';
      else id = pick(r, ['trunk', 'trunkLong', 'rocks', 'rocksTall'] as const);
    } else if (roll < 0.16) {
      id = pick(r, ['rocks', 'rocks', 'rocksTall', 'trunk', 'pine', 'pine', 'pineCrooked', 'debris'] as const);
    }
    if (!id) continue;
    const spacing = id === 'pine' || id === 'pineCrooked' ? 3.6 : 2.6;
    if (tooClose(d, spacing)) continue;
    const p = d.clone().multiplyScalar(R);
    const k = key(d);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k)!.push(p);
    add(id, placeAt(d, r() * Math.PI * 2, null, id === 'pine' ? 0.1 : 0.15));
  }

  // Départ : sur le parvis de l'abbaye principale, face à la porte
  const A = fronts[0];
  const spawnDir = A(0, 27);
  const facing = A(0, 10).multiplyScalar(R).sub(spawnDir.clone().multiplyScalar(R));
  facing.addScaledVector(spawnDir, -facing.dot(spawnDir)).normalize();
  return { placements: out, spawn: { dir: spawnDir, facing } };
}

type Add = (id: DecorModelId, m: THREE.Matrix4) => void;
type At = (x: number, z: number) => THREE.Vector3;

/** Cimetière : rangées de tombes, grille en fer avec portail, lanternes, crypte au fond. */
function graveyard(r: () => number, at: At, q: THREE.Quaternion, cx: number, cz: number, rows: number, cols: number, add: Add, big: boolean) {
  const SX = 2.6, SZ = 3.2, F = 2.4; // espacements, longueur d'un élément de grille
  const w = cols * SX, d = rows * SZ;
  const graves = ['graveBevel', 'graveCross', 'graveCrossLarge', 'graveDecorative', 'graveRoof', 'graveRound', 'graveWide', 'graveBroken', 'cross', 'crossWood'] as const;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (r() < 0.12) continue;
      const x = cx - w / 2 + SX * (j + 0.5) + (r() - 0.5) * 0.4;
      const z = cz - d / 2 + SZ * (i + 0.5) + (r() - 0.5) * 0.3;
      const tilt = (r() - 0.5) * 0.25;
      add(pick(r, graves), placeAt(at(x, z - 0.6), tilt, q));
      if (r() < 0.55) add(r() < 0.5 ? 'graveMound' : 'graveBorder', placeAt(at(x, z + 0.6), 0, q, 0.02));
      else if (r() < 0.15) add('graveDebris', placeAt(at(x, z + 0.5), r() * 6, q));
    }
  }
  // Grille : un élément tous les 2,4 m sur le pourtour, un portail au milieu de l'avant
  const hx = w / 2 + 1.0, hz = d / 2 + 1.2;
  const nx = Math.round((hx * 2) / F), nz = Math.round((hz * 2) / F);
  for (let k = 0; k < nx; k++) {
    const x = cx - hx + F * (k + 0.5) * ((hx * 2) / (nx * F));
    const front = k === Math.floor(nx / 2);
    add(front ? 'ironFenceGate' : r() < 0.15 ? 'ironFenceDamaged' : 'ironFence', placeAt(at(x, cz + hz), 0, q));
    if (r() > 0.1) add(r() < 0.15 ? 'ironFenceDamaged' : 'ironFence', placeAt(at(x, cz - hz), Math.PI, q));
  }
  for (let k = 0; k < nz; k++) {
    const z = cz - hz + F * (k + 0.5) * ((hz * 2) / (nz * F));
    if (r() > 0.08) add('ironFence', placeAt(at(cx - hx, z), Math.PI / 2, q));
    if (r() > 0.08) add('ironFence', placeAt(at(cx + hx, z), -Math.PI / 2, q));
  }
  // Lanternes aux coins de l'avant, crypte au fond
  add('lanternGlass', placeAt(at(cx - hx + 0.8, cz + hz - 0.8), 0, q));
  add('lanternGlass', placeAt(at(cx + hx - 0.8, cz + hz - 0.8), 0, q));
  if (big || r() < 0.6) add(big ? 'cryptLarge' : 'cryptSmall', placeAt(at(cx, cz - hz + (big ? 3.4 : 2.4)), Math.PI, q));
  if (big) {
    add('crossColumn', placeAt(at(cx - w / 2 - 0.2, cz - hz + 2), 0, q));
    add('candles', placeAt(at(cx + 1.6, cz - hz + 2.0), 0, q));
  }
  // Sapins autour
  for (let k = 0; k < (big ? 5 : 3); k++) {
    const a = r() * Math.PI * 2;
    add('pine', placeAt(at(cx + Math.cos(a) * (hx + 3 + r() * 3), cz + Math.sin(a) * (hz + 3 + r() * 3)), r() * 6, null, 0.1));
  }
}

/** Ruine : fondations rectangulaires de murs de pierre (pans manquants ou abîmés), piliers, gravats. */
function ruin(r: () => number, at: At, q: THREE.Quaternion, add: Add) {
  const F = 2.4;
  const nx = 3 + Math.floor(r() * 3), nz = 2 + Math.floor(r() * 3);
  const hx = (nx * F) / 2, hz = (nz * F) / 2;
  const wallPiece = () => { const t = r(); return t < 0.55 ? 'wall' : t < 0.8 ? 'wallDamaged' : null; };
  for (let k = 0; k < nx; k++) {
    const x = -hx + F * (k + 0.5);
    for (const [z, yaw] of [[-hz, Math.PI], [hz, 0]] as const) {
      const id = wallPiece();
      if (id) add(id, placeAt(at(x, z), yaw, q));
    }
  }
  for (let k = 0; k < nz; k++) {
    const z = -hz + F * (k + 0.5);
    for (const [x, yaw] of [[-hx, Math.PI / 2], [hx, -Math.PI / 2]] as const) {
      const id = wallPiece();
      if (id) add(id, placeAt(at(x, z), yaw, q));
    }
  }
  for (const [x, z] of [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]]) {
    if (r() < 0.75) add(r() < 0.5 ? 'pillarSquare' : 'columnLarge', placeAt(at(x, z), 0, q));
  }
  // Intérieur : colonnade, autel, gravats, braséro
  if (nx >= 4 && r() < 0.6) {
    for (let k = 1; k < nx; k++) if (r() < 0.7) add('columnLarge', placeAt(at(-hx + F * k, 0), 0, q));
  }
  if (r() < 0.35) add('altar', placeAt(at(0, -hz + 1.4), 0, q));
  for (let k = 0; k < 3 + Math.floor(r() * 3); k++) {
    add(pick(r, ['debris', 'debris', 'debrisWood', 'graveDebris'] as const), placeAt(at((r() - 0.5) * hx * 1.6, (r() - 0.5) * hz * 1.6), r() * 6, q));
  }
  if (r() < 0.4) add('fireBasket', placeAt(at((r() - 0.5) * hx, (r() - 0.5) * hz), 0, q));
  if (r() < 0.3) add(pick(r, ['bench', 'benchDamaged', 'urn', 'shovelDirt', 'hayBale'] as const), placeAt(at((r() - 0.5) * hx, (r() - 0.5) * hz), r() * 6, q));
}
