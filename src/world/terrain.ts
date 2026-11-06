import * as THREE from 'three';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PLANET, PLANET_RADIUS } from '../config/world';
import { toonMaterial } from '../render/toon';

const R = PLANET_RADIUS;
const noise = new ImprovedNoise();
const { relief } = PLANET;

/** Hauteur du relief (au-dessus du rayon de base) pour une direction unitaire. */
export function heightAt(d: THREE.Vector3): number {
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
const PAL_HEX = { grassLow: 0x3f7d3a, grassHigh: 0x7cb246, dirt: 0x8a6a44, rock: 0x857a70, snow: 0xf2f5f8 };

export function buildTerrain(): THREE.Mesh {
  let geo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, PLANET.detail);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo); // sommets partagés : normales lisses pour le cel-shading
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const heights = new Float32Array(pos.count);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const h = heightAt(v);
    heights[i] = h;
    v.multiplyScalar(R + h);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();

  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
  geo.userData.heights = heights;

  const mesh = new THREE.Mesh(geo, toonMaterial({ vertexColors: true }));
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'terrain';
  colorTerrain(mesh, { ...PAL_HEX, variation: 0.1 });
  return mesh;
}

type TerrainPalette = { grassLow: number; grassHigh: number; dirt: number; rock: number; snow: number; variation: number };

/**
 * Couleur selon l'altitude et la pente (roche sur les flancs raides), plus des taches de variation
 * (herbe plus claire / plus sombre, un peu plus jaune) pour casser l'aplat.
 */
export function colorTerrain(mesh: THREE.Mesh, p: TerrainPalette) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const col = geo.attributes.color as THREE.BufferAttribute;
  const heights = geo.userData.heights as Float32Array;
  const pal = {
    grassLow: new THREE.Color(p.grassLow), grassHigh: new THREE.Color(p.grassHigh), dirt: new THREE.Color(p.dirt),
    rock: new THREE.Color(p.rock), snow: new THREE.Color(p.snow), dry: new THREE.Color(p.grassHigh).lerp(new THREE.Color(0xd8c060), 0.5),
  };
  const c = new THREE.Color(), n = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nrm, i);
    const vn = v.clone().normalize();
    const steep = 1 - n.dot(vn); // 0 = plat
    const h = heights[i];
    c.copy(pal.grassLow).lerp(pal.grassHigh, THREE.MathUtils.smoothstep(h, -8, 10));
    if (p.variation > 0) {
      const big = noise.noise(v.x * 0.045, v.y * 0.045, v.z * 0.045);
      const small = noise.noise(v.x * 0.21 + 50, v.y * 0.21, v.z * 0.21);
      c.lerp(pal.dry, THREE.MathUtils.clamp(big * 2.2, 0, 1) * p.variation * 3);
      c.multiplyScalar(1 + small * p.variation * 1.6);
    }
    c.lerp(pal.dirt, THREE.MathUtils.smoothstep(steep, 0.12, 0.2) * 0.8);
    c.lerp(pal.rock, THREE.MathUtils.smoothstep(steep, 0.2, 0.3));
    c.lerp(pal.rock, THREE.MathUtils.smoothstep(h, 14, 18));
    c.lerp(pal.snow, THREE.MathUtils.smoothstep(h, 24, 26) * (1 - THREE.MathUtils.smoothstep(steep, 0.35, 0.5)));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}
