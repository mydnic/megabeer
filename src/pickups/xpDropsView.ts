import * as THREE from 'three';
import { XP_DROPS as X } from '../config/xp';
import { LAYER_CHARACTER } from '../render/materials';
import type { XpDrop } from './xpDrops';

/**
 * Rendu des gouttes de bière : en forme de goutte (ventre rond, pointe vers le ciel), dorées, elles
 * pulsent, se balancent et s'étirent quand elles filent vers le joueur ; un seul dessin pour toutes.
 */
export function createXpDropsView(scene: THREE.Scene) {
  // Profil de goutte tourné autour de son axe (rayon 1, pointe en haut)
  const profile = [[0, -1], [0.55, -0.86], [0.9, -0.45], [1, 0.05], [0.86, 0.55], [0.55, 1.05], [0.24, 1.5], [0, 1.85]].map(([x, y]) => new THREE.Vector2(x, y - 0.25));
  const geo = new THREE.LatheGeometry(profile, 14);
  const mat = new THREE.MeshToonMaterial({ color: X.color, emissive: X.color, emissiveIntensity: X.glow });
  const mesh = new THREE.InstancedMesh(geo, mat, X.max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.layers.set(LAYER_CHARACTER); // contour comme les persos : lisible sur l'herbe
  mesh.count = 0;
  scene.add(mesh);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0), up = new THREE.Vector3(), tilt = new THREE.Quaternion(), axis = new THREE.Vector3(1, 0, 0);

  return {
    sync(drops: readonly XpDrop[]) {
      drops.forEach((d, i) => {
        // Légère pulsation, apparition en grossissant
        // Apparaît en bondissant, puis pulse ; debout sur la verticale locale, elle se balance doucement
        const a = Math.min(1, d.age * 5), pop = a < 1 ? a * (1 + 0.6 * Math.sin(a * Math.PI)) : 1;
        const k = d.size * pop * (1 + Math.sin(d.age * 5 + d.phase) * 0.07);
        q.setFromUnitVectors(Y, up.copy(d.pos).normalize()).multiply(tilt.setFromAxisAngle(axis, Math.sin(d.age * 2.3 + d.phase) * 0.28));
        // Aspirée : elle s'étire
        const stretch = d.flying ? 1.5 : 1 + Math.sin(d.age * 5 + d.phase) * 0.08;
        mesh.setMatrixAt(i, m.compose(d.pos, q, s.set(k / Math.sqrt(stretch), k * stretch, k / Math.sqrt(stretch))));
      });
      mesh.count = drops.length;
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
