import * as THREE from 'three';

const up0 = new THREE.Vector3(), right0 = new THREE.Vector3(), fwd = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3();
const pF = new THREE.Vector3(), pB = new THREE.Vector3(), pR = new THREE.Vector3(), pL = new THREE.Vector3(), basis = new THREE.Matrix4();

/**
 * Pose d'un véhicule sur le relief : au lieu de rester à plat (perpendiculaire au rayon de la planète), il épouse le
 * sol sous ses quatre coins. `pos` : son centre ; `facing` : son capot (tangent) ; `halfLength`, `halfWidth` : demi-
 * longueur et demi-largeur où le sol est relu (m) ; `groundAt(p, feetR)` : rayon du sol sous `p`. Écrit dans `outPos` le
 * centre posé sur le sol (à la hauteur moyenne des quatre appuis) et dans `outQuat` l'orientation (x à droite, y en haut, z vers le capot).
 */
export function groundPose(pos: THREE.Vector3, facing: THREE.Vector3, halfLength: number, halfWidth: number,
  groundAt: (p: THREE.Vector3, feetR: number) => number, outPos: THREE.Vector3, outQuat: THREE.Quaternion) {
  up0.copy(pos).normalize();
  right0.crossVectors(up0, facing).normalize();
  const feet = pos.length() + 0.6;
  const onGround = (p: THREE.Vector3) => p.setLength(groundAt(p, feet));
  onGround(pF.copy(pos).addScaledVector(facing, halfLength));
  onGround(pB.copy(pos).addScaledVector(facing, -halfLength));
  onGround(pR.copy(pos).addScaledVector(right0, halfWidth));
  onGround(pL.copy(pos).addScaledVector(right0, -halfWidth));
  fwd.subVectors(pF, pB).normalize();
  side.subVectors(pR, pL).normalize();
  up.crossVectors(fwd, side).normalize();
  // Repère orthonormé : le capot garde la pente avant-arrière, la droite se recale
  side.crossVectors(up, fwd).normalize();
  outQuat.setFromRotationMatrix(basis.makeBasis(side, up, fwd));
  // Centre à la hauteur moyenne des quatre appuis, à l'aplomb de `pos`
  outPos.copy(up0).multiplyScalar((pF.length() + pB.length() + pR.length() + pL.length()) / 4);
}
