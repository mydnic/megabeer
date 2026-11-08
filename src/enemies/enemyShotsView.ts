import * as THREE from 'three';
import { THROWN_BOTTLE_LOOK as L } from '../config/enemies';
import { createBottleView } from '../weapons/bottleView';
import type { EnemyShot } from './enemyShots';

/**
 * Rendu des projectiles ennemis : la bouteille vide en vol, et sa marque au sol au point d'impact
 * (un anneau rouge qui se remplit à mesure que la bouteille approche).
 */
export async function createEnemyShotsView(scene: THREE.Scene) {
  const bottles = await createBottleView(scene, L);
  const material = (opacity: number) => new THREE.MeshBasicMaterial({
    color: L.markColor, transparent: true, opacity, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4, side: THREE.DoubleSide,
  });
  const ringGeo = new THREE.RingGeometry(1 - L.markRing, 1, 48);
  const fillGeo = new THREE.CircleGeometry(1, 48);
  const ringMat = material(L.markOpacity), fillMat = material(L.markOpacity * 0.45);
  const marks: { ring: THREE.Mesh; fill: THREE.Mesh }[] = [];
  const Z = new THREE.Vector3(0, 0, 1), up = new THREE.Vector3();

  return {
    sync(shots: readonly EnemyShot[]) {
      bottles.sync(shots);
      shots.forEach((s, i) => {
        let m = marks[i];
        if (!m) {
          m = { ring: new THREE.Mesh(ringGeo, ringMat), fill: new THREE.Mesh(fillGeo, fillMat) };
          m.ring.renderOrder = m.fill.renderOrder = 2;
          scene.add(m.ring, m.fill);
          marks.push(m);
        }
        up.copy(s.to).normalize();
        for (const mesh of [m.ring, m.fill]) {
          mesh.visible = true;
          mesh.position.copy(s.to).addScaledVector(up, 0.06);
          mesh.quaternion.setFromUnitVectors(Z, up);
        }
        m.ring.scale.setScalar(s.radius);
        m.fill.scale.setScalar(Math.max(0.01, s.radius * s.t));
      });
      for (let i = shots.length; i < marks.length; i++) marks[i].ring.visible = marks[i].fill.visible = false;
    },
  };
}
