import * as THREE from 'three';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PLANET, PLANET_RADIUS } from '../config/world';
import { litMaterial } from '../render/materials';
import { TERRAIN_PALETTE } from '../config/visual';
import { ABBEY_DIR, DECOR_LAYOUT } from '../config/decor';

const R = PLANET_RADIUS;
const perlin = new ImprovedNoise();
/** Décalage du bruit propre à la seed de la planète : un autre décalage = un autre relief. */
const off = new THREE.Vector3();
const noise = { noise: (x: number, y: number, z: number) => perlin.noise(x + off.x, y + off.y, z + off.z) };
const { relief } = PLANET;

/**
 * Couverture d'herbe (0 = terre battue, 1 = pré) pour une direction unitaire. Partagée par la couleur
 * du sol et par l'herbe dense : les clairières de terre coïncident avec l'absence de brins.
 */
export function meadowAt(d: THREE.Vector3): number {
  const k = R * 0.03, k2 = R * 0.11;
  const n = noise.noise(d.x * k + 100, d.y * k, d.z * k) + 0.35 * noise.noise(d.x * k2, d.y * k2 + 40, d.z * k2);
  return THREE.MathUtils.smoothstep(n, -0.5, -0.25);
}

const FLAT_IN = DECOR_LAYOUT.abbeyRadius / R, FLAT_OUT = (DECOR_LAYOUT.abbeyRadius + DECOR_LAYOUT.abbeyBlend) / R;

/** Petit générateur pseudo-aléatoire reproductible. */
export function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296);
}

/** Sites des abbayes de la planète en cours (le premier est l'abbaye principale). */
export const abbeySites: { dir: THREE.Vector3; height: number }[] = [];

/**
 * Change de planète : relief décalé selon la seed, puis sites des abbayes recalculés. À appeler
 * avant buildTerrain et la génération du décor. Même seed = même planète.
 */
export function setTerrainSeed(seed: number) {
  const r = seededRandom(seed ^ 0x5eed);
  // ImprovedNoise se répète tous les 256 : un décalage dans [0, 256) donne un relief différent
  off.set(r() * 256, r() * 256, r() * 256);
  abbeySites.length = 0;
  abbeySites.push(...computeAbbeySites(r));
}

/**
 * Sites des abbayes : la principale tirée au hasard parmi les terrains bas et plats, puis les autres
 * le plus loin possible les unes des autres.
 */
function computeAbbeySites(r: () => number): { dir: THREE.Vector3; height: number }[] {
  const L = DECOR_LAYOUT;
  const sites: THREE.Vector3[] = [];
  // Candidats régulièrement répartis (spirale de Fibonacci), notés sur la platitude de l'enclos
  const cands: THREE.Vector3[] = [];
  const N = 1500, ga = Math.PI * (3 - Math.sqrt(5));
  const t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N, rr = Math.sqrt(1 - y * y);
    const d = new THREE.Vector3(Math.cos(ga * i) * rr, y, Math.sin(ga * i) * rr);
    const h0 = rawHeight(d);
    if (h0 > 10) continue;
    t1.set(0, 1, 0).cross(d);
    if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0);
    t1.normalize();
    t2.crossVectors(d, t1);
    let flat = true;
    for (let k = 0; k < 12 && flat; k++) {
      const a = (k / 12) * Math.PI * 2;
      for (const dist of [L.abbeyRadius * 0.5, L.abbeyRadius]) {
        p.copy(d).multiplyScalar(R).addScaledVector(t1, Math.cos(a) * dist).addScaledVector(t2, Math.sin(a) * dist).normalize();
        if (Math.abs(rawHeight(p) - h0) > L.abbeyMaxRelief) { flat = false; break; }
      }
    }
    if (flat) cands.push(d);
  }
  // Abbaye principale : un site plat au hasard (repli : la direction par défaut)
  sites.push(cands.length ? cands[Math.floor(r() * cands.length)] : new THREE.Vector3(...ABBEY_DIR).normalize());
  // Le plus loin possible des sites déjà retenus
  while (sites.length < L.abbeyCount) {
    let best: THREE.Vector3 | null = null, bestGap = (L.abbeyMinGap / R);
    for (const c of cands) {
      const gap = Math.min(...sites.map((s) => s.angleTo(c)));
      if (gap > bestGap) { bestGap = gap; best = c; }
    }
    if (!best) break;
    sites.push(best);
  }
  return sites.map((dir) => ({ dir, height: rawHeight(dir) }));
}
const COS_OUT = Math.cos(FLAT_OUT);

/** Hauteur du relief (au-dessus du rayon de base) pour une direction unitaire. */
export function heightAt(d: THREE.Vector3): number {
  const h = rawHeight(d);
  // Enclos des abbayes : terrain aplani, raccordé en douceur au relief
  for (const s of abbeySites) {
    const c = d.dot(s.dir);
    if (c < COS_OUT) continue;
    const w = 1 - THREE.MathUtils.smoothstep(Math.acos(Math.min(1, c)), FLAT_IN, FLAT_OUT);
    return h + (s.height - h) * w;
  }
  return h;
}

function rawHeight(d: THREE.Vector3): number {
  const n1 = noise.noise(d.x * 2.1 + 11, d.y * 2.1, d.z * 2.1);
  const n2 = noise.noise(d.x * 6.3, d.y * 6.3 + 23, d.z * 6.3);
  const n3 = noise.noise(d.x * 17 + 5, d.y * 17, d.z * 17 - 7);
  const base = n1 * relief.hills + n2 * relief.bumps + n3 * relief.detail;
  // Chaînes de montagnes : bruit "ridged" avec une valeur absolue adoucie (crêtes lisses)
  const rn = noise.noise(d.x * 2.6 + 41, d.y * 2.6, d.z * 2.6 - 13);
  const ridge = 1 - Math.sqrt(rn * rn + 0.004);
  const mask = THREE.MathUtils.smoothstep(noise.noise(d.x * 1.3 - 7, d.y * 1.3 + 3, d.z * 1.3), -0.05, 0.35);
  return base + Math.pow(ridge, 4) * relief.mountains * mask;
}

export const groundRadius = (d: THREE.Vector3) => R + heightAt(d);

const gTmp = new THREE.Vector3();
/** Gradient du relief dans le plan tangent (hauteur par unité de distance) le long de deux axes. */
export function slopeGradient(up: THREE.Vector3, ax: THREE.Vector3, ay: THREE.Vector3, out: THREE.Vector3) {
  const e = 0.6, h0 = heightAt(up);
  const hx = heightAt(gTmp.copy(up).addScaledVector(ax, e / R).normalize());
  const hy = heightAt(gTmp.copy(up).addScaledVector(ay, e / R).normalize());
  return out.copy(ax).multiplyScalar((hx - h0) / e).addScaledVector(ay, (hy - h0) / e);
}

// Palette du sol (DA : couleurs franches et chaudes, lisibles sous le cel-shading)

/** Icosphère unité aux sommets partagés, calculée une fois et recopiée à chaque planète. */
let unitSphere: THREE.BufferGeometry | null = null;

/**
 * Construit le maillage de la planète en cours (relief + couleurs), par petits morceaux : chaque
 * `yield` donne l'avancement (0 à 1) et laisse l'appelant rendre la main à l'écran (barre de
 * chargement). buildTerrain() fait tout d'un coup.
 */
export function* buildTerrainSteps(): Generator<number, THREE.Mesh> {
  if (!unitSphere) {
    let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, PLANET.detail);
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    unitSphere = mergeVertices(g); // sommets partagés : normales lisses pour le cel-shading
    yield 0.05;
  }
  const geo = unitSphere.clone();
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const heights = new Float32Array(pos.count);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const h = heightAt(v);
    heights[i] = h;
    v.multiplyScalar(R + h);
    pos.setXYZ(i, v.x, v.y, v.z);
    if ((i & 4095) === 4095) yield 0.05 + 0.5 * (i / pos.count);
  }
  geo.computeVertexNormals();
  yield 0.6;

  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
  geo.userData.heights = heights;

  const mesh = new THREE.Mesh(geo, litMaterial({ vertexColors: true, roughness: 0.95 }));
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'terrain';
  for (const k of colorTerrainSteps(mesh, TERRAIN_PALETTE)) yield 0.6 + 0.4 * k;
  return mesh;
}

export function buildTerrain(): THREE.Mesh {
  const g = buildTerrainSteps();
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
  }
}

type TerrainPalette = { grassLow: number; grassHigh: number; dirt: number; path: number; rock: number; snow: number; variation: number };

/**
 * Couleur selon l'altitude et la pente (roche sur les flancs raides), plus des taches de variation
 * (herbe plus claire / plus sombre, un peu plus jaune) pour casser l'aplat.
 */
export function colorTerrain(mesh: THREE.Mesh, p: TerrainPalette) {
  for (const _ of colorTerrainSteps(mesh, p)) { /* tout d'un coup */ }
}

/** colorTerrain par morceaux : chaque `yield` donne l'avancement (0 à 1). */
function* colorTerrainSteps(mesh: THREE.Mesh, p: TerrainPalette): Generator<number, void> {
  const geo = mesh.geometry;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const col = geo.attributes.color as THREE.BufferAttribute;
  const heights = geo.userData.heights as Float32Array;
  const pal = {
    grassLow: new THREE.Color(p.grassLow), grassHigh: new THREE.Color(p.grassHigh), dirt: new THREE.Color(p.dirt),
    rock: new THREE.Color(p.rock), snow: new THREE.Color(p.snow), dry: new THREE.Color(p.grassHigh).lerp(new THREE.Color(0xd8c060), 0.5),
    path: new THREE.Color(p.path),
  };
  const c = new THREE.Color(), n = new THREE.Vector3(), v = new THREE.Vector3(), vn = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nrm, i);
    vn.copy(v).normalize();
    const steep = 1 - n.dot(vn); // 0 = plat
    const h = heights[i];
    c.copy(pal.grassLow).lerp(pal.grassHigh, THREE.MathUtils.smoothstep(h, -8, 10));
    if (p.variation > 0) {
      const big = noise.noise(v.x * 0.045, v.y * 0.045, v.z * 0.045);
      const small = noise.noise(v.x * 0.21 + 50, v.y * 0.21, v.z * 0.21);
      c.lerp(pal.dry, THREE.MathUtils.clamp(big * 2.2, 0, 1) * p.variation * 3);
      c.multiplyScalar(1 + small * p.variation * 1.6);
    }
    // Clairières de terre battue
    c.lerp(pal.path, (1 - meadowAt(vn)) * 0.9);
    c.lerp(pal.dirt, THREE.MathUtils.smoothstep(steep, 0.12, 0.2) * 0.8);
    c.lerp(pal.rock, THREE.MathUtils.smoothstep(steep, 0.2, 0.3));
    c.lerp(pal.rock, THREE.MathUtils.smoothstep(h, 14, 18));
    c.lerp(pal.snow, THREE.MathUtils.smoothstep(h, 24, 26) * (1 - THREE.MathUtils.smoothstep(steep, 0.35, 0.5)));
    col.setXYZ(i, c.r, c.g, c.b);
    if ((i & 4095) === 4095) yield i / pos.count;
  }
  col.needsUpdate = true;
}