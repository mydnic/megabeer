import * as THREE from 'three';
import { CHARACTER_LOOK, SURFACE } from '../config/visual';

/** Matériau éclairé standard du décor (lisse, mat). */
export function litMaterial(params: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ roughness: SURFACE.roughness, metalness: SURFACE.metalness, ...params });
}

/** Rampe du cel-shading des personnages (paliers nets). */
const CHAR_RAMP = (() => {
  const steps = CHARACTER_LOOK.toonSteps;
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  const t = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();

/**
 * Matériau des personnages : cel-shading (paliers nets) dans le décor éclairé. Les aplats cachent
 * les jointures du modèle low-poly, le contour (passe dédiée) détache le perso du décor.
 */
export function characterMaterial(params: THREE.MeshToonMaterialParameters = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ gradientMap: CHAR_RAMP, ...params });
}

/** Matériau des objets du décor : même cel-shading que les personnages (le sol reste lisse). */
export const decorMaterial = characterMaterial;

/**
 * Couche du ciel (dôme, astres, étoiles, nuages) : visible dans le rendu, exclue des passes
 * d'occlusion ambiante et de profondeur de champ (qui ne doivent voir que le monde).
 */
export const LAYER_SKY = 1;
/** Couche des objets contourés : personnages et décor (passe CharacterOutlinePass). Le sol n'y est pas. */
export const LAYER_CHARACTER = 2;
