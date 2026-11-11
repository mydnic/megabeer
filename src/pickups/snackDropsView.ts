import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SNACK_DROPS as S } from '../config/bins';
import { characterMaterial, LAYER_CHARACTER } from '../render/materials';
import type { XpDrop } from './xpDrops';

const urls = import.meta.glob('../assets/models/frites.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/**
 * Rendu des snacks au sol : le cornet de frites (Kenney Food Kit), debout, qui tourne doucement ; un
 * dessin pour les frites et un pour le cornet.
 */
export async function createSnackDropsView(scene: THREE.Scene) {
  const gltf = await new GLTFLoader().loadAsync(Object.values(urls)[0]);
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  // Ramené à une hauteur de 1, centré sur son milieu (la lévitation le porte)
  const k = 1 / (box.max.y - box.min.y);
  const norm = new THREE.Matrix4().makeScale(k, k, k)
    .multiply(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2));
  const fries = characterMaterial({ color: S.fries, emissive: S.fries, emissiveIntensity: 0.15 });
  const cone = characterMaterial({ color: S.cone });
  const meshes: THREE.InstancedMesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry.clone().applyMatrix4(norm.clone().multiply(m.matrixWorld));
    const mesh = new THREE.InstancedMesh(g, (m.material as THREE.Material).name.startsWith('Frites') ? fries : cone, S.max);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.layers.set(LAYER_CHARACTER);
    mesh.count = 0;
    scene.add(mesh);
    meshes.push(mesh);
  });

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), spin = new THREE.Quaternion(), s = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0), up = new THREE.Vector3();
  return {
    sync(drops: readonly XpDrop[]) {
      const n = Math.min(drops.length, S.max);
      for (let i = 0; i < n; i++) {
        const d = drops[i];
        up.copy(d.pos).normalize();
        q.setFromUnitVectors(Y, up).multiply(spin.setFromAxisAngle(Y, d.age * S.spin * Math.PI * 2 + d.phase));
        // Sort de la poubelle en grossissant
        m.compose(d.pos, q, s.setScalar(S.radius * Math.min(1, d.age * 5)));
        for (const mesh of meshes) mesh.setMatrixAt(i, m);
      }
      for (const mesh of meshes) { mesh.count = n; mesh.instanceMatrix.needsUpdate = true; }
    },
  };
}
