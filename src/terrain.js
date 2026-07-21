import * as THREE from 'three';
import { toonMaterial } from './textures.js';
import { simplex2 } from './noise.js';

// Real walkable 3D terrain, two layered octaves: a coarse simplex-noise one
// (MOUNTAIN_SPACING/AMPLITUDE) shapes actual mountain massifs — real Perlin-
// family gradient noise, so ridges/peaks look organic and rolling rather than
// grid-aligned like plain lattice interpolation — plus a fine hash-lattice one
// (DETAIL_SPACING/AMPLITUDE, matches the mesh's own vertex spacing) for rocky
// ruggedness on top. Both are pure functions of world x/z — continuous across
// chunk boundaries with no seams — and the fine grid is sampled with the *same*
// triangle interpolation the mesh itself uses, so getTerrainHeight(x, z)
// exactly matches the ground under a player's feet — no floating, no clipping.
const DETAIL_SPACING = 5;
const DETAIL_AMPLITUDE = 1.8;
// 90 was too broad — a valley-to-peak transition spans half that (45 units),
// wider than one typical view, so any single vantage point looked almost
// uniformly-elevated/monotone. 55 fits valley→peak variety inside normal view
// distance.
const MOUNTAIN_SPACING = 55;
const MOUNTAIN_AMPLITUDE = 26;
export const TERRAIN_COLOR = 0x5c5a4a;

function hash(seed, ix, iz) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 2246822519) ^ 0x27d4eb2f;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (((h % 1000) + 1000) % 1000) / 1000;
}

// Total height at a fine-grid (DETAIL_SPACING) integer coordinate: mountain
// massif (simplex noise, [-1,1] rescaled to [0,1]) + rocky detail. Called only
// at the exact vertices buildTerrainChunk() generates, so summing octaves here
// is safe — getTerrainHeight below just linearly interpolates between these
// same corner values, matching the mesh's own flat-shaded triangles exactly
// regardless of how jagged the sum is.
function cornerHeight(ix, iz) {
  const wx = ix * DETAIL_SPACING, wz = iz * DETAIL_SPACING;
  const raw = simplex2(wx / MOUNTAIN_SPACING, wz / MOUNTAIN_SPACING) * 0.5 + 0.5; // 0..1
  // Simplex noise averages ~0.5 almost everywhere, so without reshaping, most of
  // the map sits at half amplitude — a uniformly elevated plateau, not distinct
  // mountains. Raising to a power > 1 pushes the bulk of the range down toward 0
  // (open plains/valleys) while only strong noise peaks reach near 1, so
  // mountains read as actual rising features instead of the whole world tilting
  // up together.
  const mountain = Math.pow(raw, 2.4) * MOUNTAIN_AMPLITUDE;
  const detail = hash(2, ix, iz) * DETAIL_AMPLITUDE;
  return mountain + detail;
}

// Each fine lattice cell is split into 2 triangles along the (0,0)-(1,1)
// diagonal — matching exactly how buildTerrainChunk() indexes its geometry
// below, so a height query and the rendered flat-shaded facet always agree.
export function getTerrainHeight(x, z) {
  const gx = x / DETAIL_SPACING, gz = z / DETAIL_SPACING;
  const ix = Math.floor(gx), iz = Math.floor(gz);
  const p = gx - ix, q = gz - iz;
  const h00 = cornerHeight(ix, iz);
  const h10 = cornerHeight(ix + 1, iz);
  const h01 = cornerHeight(ix, iz + 1);
  const h11 = cornerHeight(ix + 1, iz + 1);
  if (p + q <= 1) return h00 + (h10 - h00) * p + (h01 - h00) * q;
  return h11 + (h01 - h11) * (1 - p) + (h10 - h11) * (1 - q);
}

// MeshToonMaterial has no `flatShading` property (unlike MeshStandardMaterial
// etc) — passing it in the constructor is silently a no-op (Material.setValues
// only assigns keys that already exist on the instance). Real flat-shaded facets
// need non-shared per-triangle vertices instead, see toNonIndexed() below.
// vertexColors on: base color becomes a white multiplier so the per-vertex
// height/slope colors computed in buildTerrainChunk() show through unmixed.
const terrainMaterial = toonMaterial({ color: 0xffffff, vertexColors: true });

// Height/slope → color banding, low→high: mossy valley, bare rock, pale summit.
// Each is [r,g,b] 0-1. Blended by height (smoothstepped between bands) and then
// darkened toward CLIFF_COLOR on steep faces so cliff faces read distinctly from
// gentle grassy slopes regardless of elevation.
const BAND_LOW = [0.20, 0.34, 0.13];
const BAND_MID = [0.42, 0.38, 0.28];
const BAND_HIGH = [0.64, 0.63, 0.59];
const CLIFF_COLOR = [0.20, 0.19, 0.17];
const BAND_LOW_MAX = 6;   // height where low→mid blend starts
const BAND_HIGH_MIN = 20; // height where mid→high blend finishes

function smoothstep(t) { return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t); }
function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

function terrainColor(height, normalY) {
  const lowMidT = smoothstep(height / BAND_LOW_MAX);
  const midHighT = smoothstep((height - BAND_LOW_MAX) / (BAND_HIGH_MIN - BAND_LOW_MAX));
  let c = lerp3(lerp3(BAND_LOW, BAND_MID, lowMidT), BAND_HIGH, midHighT);
  // normalY is 1 on a flat facet, ~0 on a vertical cliff face.
  const steepness = smoothstep((1 - normalY - 0.3) / 0.5);
  return lerp3(c, CLIFF_COLOR, steepness);
}

// One mesh per chunk, vertices in world space (mesh itself stays at origin) —
// same pattern chunk decor groups already use. N quads per side, split into the
// same 2 triangles as getTerrainHeight() above.
export function buildTerrainChunk(chunkSize, originX, originZ) {
  const n = chunkSize / DETAIL_SPACING;
  const rows = n + 1;
  const positions = new Float32Array(rows * rows * 3);
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const wx = originX + i * DETAIL_SPACING;
      const wz = originZ + j * DETAIL_SPACING;
      const idx = (j * rows + i) * 3;
      positions[idx] = wx;
      positions[idx + 1] = getTerrainHeight(wx, wz);
      positions[idx + 2] = wz;
    }
  }
  const indices = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * rows + i, b = j * rows + (i + 1), c = (j + 1) * rows + (i + 1), d = (j + 1) * rows + i;
      // Winding must produce a +Y-facing normal (a,d,b) not (a,b,d) — with x=i/z=j
      // this axis order was backwards, so every face pointed down and got culled
      // by the material's default FrontSide, rendering nothing from above.
      indices.push(a, d, b, b, d, c);
    }
  }
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  indexed.setIndex(indices);
  // De-share vertices per triangle so each facet gets its own normal instead of
  // a smoothed average with its neighbors — this is what actually makes the
  // "carrés avec pentes droites" low-poly look (and the slopes) visible; smooth
  // per-vertex normals on a chaotic heightfield wash out almost flat-looking.
  const geometry = indexed.toNonIndexed();
  geometry.computeVertexNormals();

  const posAttr = geometry.attributes.position, normAttr = geometry.attributes.normal;
  const colors = new Float32Array(posAttr.count * 3);
  for (let i = 0; i < posAttr.count; i++) {
    const [r, g, b] = terrainColor(posAttr.getY(i), normAttr.getY(i));
    colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mesh = new THREE.Mesh(geometry, terrainMaterial);
  mesh.receiveShadow = true;
  // Mountains casting shadows onto their own lower slopes/neighboring valleys
  // is the single biggest depth-readability cue for real elevation — a flat
  // plane never needed this, real terrain does.
  mesh.castShadow = true;
  return mesh;
}
