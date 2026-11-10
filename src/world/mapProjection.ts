import * as THREE from 'three';
import { PLANET_RADIUS } from '../config/world';

const d = new THREE.Vector3();

/**
 * Place un point du monde sur une carte vue du dessus, centrée sur `center` et tournée pour que le
 * haut soit `fwd` (unitaire, tangent au sol). Renvoie x (m, à droite), y (m, devant) et la distance
 * au sol (m, le long de la planète). `up` : verticale au centre (unitaire), `right` = fwd x up.
 */
export function toMapCoords(up: THREE.Vector3, fwd: THREE.Vector3, right: THREE.Vector3, p: THREE.Vector3) {
  const ang = up.angleTo(p);
  d.copy(p).addScaledVector(up, -p.dot(up));
  const l = d.length();
  const dist = ang * PLANET_RADIUS;
  if (l < 1e-6) return { x: 0, y: 0, dist };
  return { x: (d.dot(right) / l) * dist, y: (d.dot(fwd) / l) * dist, dist };
}
