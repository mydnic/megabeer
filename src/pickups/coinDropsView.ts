import * as THREE from 'three';
import { COIN_DROPS as C } from '../config/coins';
import { characterMaterial, LAYER_CHARACTER } from '../render/materials';
import type { XpDrop } from './xpDrops';

/**
 * Capsule de bière : disque plat dont la jupe est crantée (crans alternés plus ou moins loin du
 * centre), dessus légèrement bombé. Couchée de côté (debout), elle tourne autour de la verticale.
 */
function capsuleGeometry() {
  const n = C.teeth * 2;
  const geo = new THREE.CylinderGeometry(1, 1, C.thickness / C.radius, n, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.5) continue; // centres des disques
    const a = Math.atan2(z, x);
    const k = Math.round((a / (Math.PI * 2)) * n);
    const s = k % 2 === 0 ? 1 : 0.86;
    pos.setXYZ(i, x * s, pos.getY(i), z * s);
  }
  geo.computeVertexNormals();
  return geo.rotateX(Math.PI / 2);
}

/** Rendu des capsules (Pièces) au sol : dorées, debout, qui tournent ; un seul dessin pour toutes. */
export function createCoinDropsView(scene: THREE.Scene) {
  const mat = characterMaterial({ color: C.color, emissive: C.color, emissiveIntensity: C.glow });
  const mesh = new THREE.InstancedMesh(capsuleGeometry(), mat, C.max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.layers.set(LAYER_CHARACTER); // contour comme les persos : lisible sur l'herbe
  mesh.count = 0;
  scene.add(mesh);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), spin = new THREE.Quaternion(), s = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0), up = new THREE.Vector3();

  return {
    sync(drops: readonly XpDrop[]) {
      drops.forEach((d, i) => {
        // Debout sur la verticale locale, tourne sur elle-même ; apparaît en grossissant
        up.copy(d.pos).normalize();
        q.setFromUnitVectors(Y, up).multiply(spin.setFromAxisAngle(Y, d.age * C.spin * Math.PI * 2 + d.phase));
        const k = C.radius * Math.min(1, d.age * 6);
        mesh.setMatrixAt(i, m.compose(d.pos, q, s.setScalar(k)));
      });
      mesh.count = drops.length;
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
