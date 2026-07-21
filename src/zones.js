import { simplex2 } from './noise.js';

// Coarse biome noise, decorrelated from terrain.js's mountain octave via a
// different seed. Wide ZONE_SCALE (140 units, ~7 chunks) so each zone spans
// many chunks — that's what makes decor read as a grouped forest/ruin cluster
// instead of one-per-chunk randomness with no larger structure.
const ZONE_SCALE = 140;

export function zoneAt(x, z) {
  const n = simplex2(x / ZONE_SCALE, z / ZONE_SCALE, 7);
  if (n < -0.35) return 'forest';
  if (n < 0.05) return 'open';
  if (n < 0.4) return 'ruins';
  return 'graveyard';
}
