import * as THREE from 'three';
import { ZOMBIE_VISUAL as V, type ZombieModel } from '../config/zombies';
import { LAYER_CHARACTER } from '../render/materials';
import type { Zombie } from './zombie';
import type { ZombieLibrary } from './zombieLibrary';

/**
 * Rendu de la horde : un seul dessin par modèle (instances animées par la carte graphique, voir
 * render/vat.ts). Recopie à chaque image l'état des zombies de la simulation.
 */
export function createHordeView(scene: THREE.Scene, lib: ZombieLibrary) {
  const crowds = (Object.keys(lib) as ZombieModel[]).map((model) => {
    const k = lib[model];
    const mesh = new THREE.InstancedMesh(k.geometry, k.material, V.maxPerModel);
    const anim = new THREE.InstancedBufferAttribute(new Float32Array(V.maxPerModel * 4), 4);
    anim.setUsage(THREE.DynamicDrawUsage);
    k.geometry.setAttribute('aAnim', anim);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.customDepthMaterial = k.depthMaterial;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false; // les instances couvrent toute la planète
    mesh.layers.set(LAYER_CHARACTER);
    mesh.count = 0;
    scene.add(mesh);
    return { model, mesh, anim };
  });
  const byModel = new Map(crowds.map((c) => [c.model, c]));
  const basis = new THREE.Matrix4();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const scaleV = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  return {
    /** Instances : matrice (repère local, taille du modèle) et lignes d'animation de chaque zombie. */
    sync(zombies: readonly Zombie[]) {
      for (const c of crowds) c.mesh.count = 0;
      for (const z of zombies) {
        const c = byModel.get(z.model)!;
        const i = c.mesh.count++;
        up.copy(z.pos).normalize();
        right.crossVectors(up, z.facing).normalize();
        tmp.copy(z.pos).addScaledVector(up, -z.sink);
        basis.makeBasis(right, up, z.facing).scale(scaleV.setScalar(z.kind.scale)).setPosition(tmp);
        c.mesh.setMatrixAt(i, basis);
        z.animRows(c.anim.array as Float32Array, i * 4);
      }
      for (const c of crowds) {
        c.mesh.instanceMatrix.clearUpdateRanges();
        c.mesh.instanceMatrix.addUpdateRange(0, c.mesh.count * 16);
        c.mesh.instanceMatrix.needsUpdate = true;
        c.anim.clearUpdateRanges();
        c.anim.addUpdateRange(0, c.mesh.count * 4);
        c.anim.needsUpdate = true;
      }
    },
  };
}
