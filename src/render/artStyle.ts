import type * as THREE from 'three';
import { ART_STYLES, type ArtStyleId } from '../config/artStyles';
import { colorTerrain } from '../world/terrain';
import type { Pipeline } from './pipeline';
import { CHAR_GRADIENT, RIM, setToonRamp } from './toon';

type Targets = { pipeline: Pipeline; sky: { applyStyle: (s: (typeof ART_STYLES)[ArtStyleId]) => void }; terrain: THREE.Mesh; clouds: THREE.Object3D };

/** Applique une direction artistique complète : rampe toon, liseré, lumière, ciel, terrain, post-traitement. */
export function applyArtStyle(id: ArtStyleId, t: Targets) {
  const s = ART_STYLES[id];
  setToonRamp(s.toon.steps, s.toon.smooth);
  setToonRamp(s.character.steps, s.character.smooth, CHAR_GRADIENT);
  t.clouds.visible = s.clouds;
  RIM.uRimColor.value.set(s.rim.color);
  RIM.uRimStrength.value = s.rim.strength;
  RIM.uRimThreshold.value = s.rim.threshold;
  t.pipeline.applyStyle(s);
  t.sky.applyStyle(s);
  colorTerrain(t.terrain, s.terrain);
  return s;
}
