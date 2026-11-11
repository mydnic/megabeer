import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BELL_DROPS as B, LAST_CALL_LOOK as L } from '../config/lastCall';
import { characterMaterial, LAYER_CHARACTER } from '../render/materials';
import type { XpDrop } from './xpDrops';

const urls = import.meta.glob('../assets/models/clochette.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/**
 * Rendu des clochettes du Dernier service au sol (`tools/blender/cloche.py` sans potence) : une clochette en
 * laiton qui flotte et se balance comme si on la secouait ; un dessin par matériau pour toutes.
 */
export async function createBellDropsView(scene: THREE.Scene) {
  const gltf = await new GLTFLoader().loadAsync(Object.values(urls)[0]);
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  // Ramenée à une hauteur de 1, centrée sur son milieu (la lévitation la porte)
  const k = 1 / (box.max.y - box.min.y);
  const norm = new THREE.Matrix4().makeScale(k, k, k)
    .multiply(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2));
  const brass = characterMaterial({ color: L.brass, emissive: L.brass, emissiveIntensity: 0.35 });
  const wood = characterMaterial({ color: L.wood });
  const meshes: THREE.InstancedMesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry.clone().applyMatrix4(norm.clone().multiply(m.matrixWorld));
    const mesh = new THREE.InstancedMesh(g, (m.material as THREE.Material).name.startsWith('Bois') ? wood : brass, B.max);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.layers.set(LAYER_CHARACTER);
    mesh.count = 0;
    scene.add(mesh);
    meshes.push(mesh);
  });

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), tilt = new THREE.Quaternion(), s = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1), up = new THREE.Vector3();
  return {
    sync(drops: readonly XpDrop[]) {
      const n = Math.min(drops.length, B.max);
      for (let i = 0; i < n; i++) {
        const d = drops[i];
        up.copy(d.pos).normalize();
        q.setFromUnitVectors(Y, up).multiply(tilt.setFromAxisAngle(Z, Math.sin(d.age * B.swaySpeed + d.phase) * B.sway));
        m.compose(d.pos, q, s.setScalar(B.radius * Math.min(1, d.age * 5)));
        for (const mesh of meshes) mesh.setMatrixAt(i, m);
      }
      for (const mesh of meshes) { mesh.count = n; mesh.instanceMatrix.needsUpdate = true; }
    },
  };
}
