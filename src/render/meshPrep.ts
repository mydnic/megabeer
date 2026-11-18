import * as THREE from 'three';

/**
 * Géométrie sans normales (le bus scolaire en est livré ainsi) : sans elles l'éclairage calcule des valeurs invalides,
 * que les passes d'effets étalent en un grand carré noir à l'écran. On les calcule ici, à facettes (chaque face garde
 * son ton, comme le reste du low-poly). Renvoie la géométrie prête (la même si elle avait déjà ses normales).
 */
export function withNormals(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  if (geometry.attributes.normal) return geometry;
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  flat.computeVertexNormals();
  return flat;
}
