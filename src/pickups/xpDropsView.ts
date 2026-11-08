import * as THREE from 'three';
import { XP_DROPS as X } from '../config/xp';
import { LAYER_CHARACTER } from '../render/materials';
import type { XpDrop } from './xpDrops';

/** Rendu des gouttes de bière : rondes, dorées, légère pulsation, un seul dessin pour toutes. */
export function createXpDropsView(scene: THREE.Scene) {
  const geo = new THREE.SphereGeometry(1, 16, 12);
  const mat = new THREE.MeshToonMaterial({ color: X.color, emissive: X.color, emissiveIntensity: X.glow });
  const mesh = new THREE.InstancedMesh(geo, mat, X.max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.layers.set(LAYER_CHARACTER); // contour comme les persos : lisible sur l'herbe
  mesh.count = 0;
  scene.add(mesh);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();

  return {
    sync(drops: readonly XpDrop[]) {
      drops.forEach((d, i) => {
        // Légère pulsation, apparition en grossissant
        const k = d.size * Math.min(1, d.age * 6) * (1 + Math.sin(d.age * 5 + d.phase) * 0.06);
        mesh.setMatrixAt(i, m.compose(d.pos, q, s.setScalar(k)));
      });
      mesh.count = drops.length;
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
