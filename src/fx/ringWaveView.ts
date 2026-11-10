import * as THREE from 'three';
import { RING_WAVE as L } from '../config/fx';
import { LAYER_SKY } from '../render/materials';

/**
 * Ondes au sol (Sifflet d'arbitre, Juke-box, Seconde tournée) : un anneau lumineux posé à plat sous
 * le joueur, qui s'élargit jusqu'au rayon de l'effet en s'effaçant.
 */
export function createRingWaveView(scene: THREE.Scene) {
  type Ring = { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; age: number; radius: number };
  const rings: Ring[] = [];
  const geo = new THREE.RingGeometry(1 - L.thickness, 1, 64).rotateX(-Math.PI / 2);
  const Y = new THREE.Vector3(0, 1, 0);

  return {
    /** Lance une onde de couleur `color` autour de `at` (pieds), jusqu'à `radius` m. */
    spawn(at: THREE.Vector3, radius: number, color: number) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: L.opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.layers.set(LAYER_SKY);
      const up = at.clone().normalize();
      mesh.position.copy(at).addScaledVector(up, L.lift);
      mesh.quaternion.setFromUnitVectors(Y, up);
      scene.add(mesh);
      rings.push({ mesh, mat, age: 0, radius });
    },
    update(dt: number) {
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.age += dt;
        const k = Math.min(1, r.age / L.life);
        r.mesh.scale.setScalar(Math.max(0.01, r.radius * (1 - (1 - k) ** 3)));
        r.mat.opacity = L.opacity * (1 - k);
        if (k >= 1) { scene.remove(r.mesh); r.mat.dispose(); rings.splice(i, 1); }
      }
    },
  };
}
