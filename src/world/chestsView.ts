import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CHEST_LOOK as L, CHEST_TRAP as T, CHESTS } from '../config/chests';
import type { Chest } from '../game/chests';
import { characterMaterial, LAYER_CHARACTER } from '../render/materials';

const urls = import.meta.glob('../assets/models/coffre.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** Une pièce du coffre dessinée pour tous : sa géométrie et, pour le couvercle, sa charnière. */
type Part = { mesh: THREE.InstancedMesh; lid: boolean };

/**
 * Rendu des coffres : le coffre du KayKit Dungeon (bois, ferrures), un seul dessin par pièce pour la
 * centaine de coffres. Le couvercle pivote sur sa charnière à l'ouverture. Un coffre piégé se trahit :
 * de temps en temps, son couvercle tressaute et le coffre rougit.
 */
export async function createChestsView(scene: THREE.Scene) {
  const gltf = await new GLTFLoader().loadAsync(Object.values(urls)[0]);
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const scale = L.width / (box.max.x - box.min.x);
  // Repère du coffre : centré, pieds à y = 0, à l'échelle
  const toChest = new THREE.Matrix4().makeScale(scale, scale, scale)
    .multiply(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2));
  const lidNode = root.getObjectByName('chest_lid')!;
  const hinge = toChest.clone().multiply(lidNode.matrixWorld); // charnière dans le repère du coffre
  const lidInv = lidNode.matrixWorld.clone().invert();

  const wood = characterMaterial({ color: L.wood });
  const iron = characterMaterial({ color: L.iron });
  const parts: Part[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    let lid = false;
    for (let p: THREE.Object3D | null = m; p; p = p.parent) if (p === lidNode) lid = true;
    // Géométrie dans le repère du coffre (corps) ou de la charnière (couvercle)
    const g = m.geometry.clone().applyMatrix4(lid ? lidInv.clone().multiply(m.matrixWorld) : toChest.clone().multiply(m.matrixWorld));
    const mat = (m.material as THREE.Material).name.startsWith('Ferrure') ? iron : wood;
    const mesh = new THREE.InstancedMesh(g, mat, CHESTS.count + CHESTS.extraMax);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.layers.set(LAYER_CHARACTER);
    mesh.count = 0;
    // Teinte par coffre (blanche : couleur normale ; rouge : le piège qui se trahit)
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array((CHESTS.count + CHESTS.extraMax) * 3).fill(1), 3);
    scene.add(mesh);
    parts.push({ mesh, lid });
  });

  const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
  const place = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3();
  const lidM = new THREE.Matrix4(), turn = new THREE.Matrix4();
  const tint = new THREE.Color(), WHITE = new THREE.Color(1, 1, 1), RED = new THREE.Color(T.glow);
  // Moment où chaque coffre a été vu ouvert (animation du couvercle)
  const openedAt = new Map<Chest, number>();
  const clock = new THREE.Clock();

  return {
    /** Recopie les coffres (position, ouvert ou non). */
    sync(chests: readonly Chest[]) {
      const t = clock.getElapsedTime();
      if (chests.length === 0) openedAt.clear();
      chests.forEach((c, i) => {
        q.setFromUnitVectors(Y, up.copy(c.pos).normalize());
        place.compose(c.pos, q, one);
        let k = 0;
        if (c.opened) {
          if (!openedAt.has(c)) openedAt.set(c, t);
          k = Math.min(1, (t - openedAt.get(c)!) / L.lidTime);
          k = 1 - (1 - k) * (1 - k);
        }
        let angle = L.lidOpen * k, glow = 0;
        if (c.trapped && !c.opened) {
          // Chaque coffre piégé à son rythme : le couvercle tressaute, le coffre rougit, puis plus rien
          const phase = (t + i * 0.73) % T.every;
          if (phase < T.shakeTime) {
            const fade = 1 - phase / T.shakeTime;
            angle = -T.shake * Math.abs(Math.sin(phase * 38)) * fade;
            glow = fade;
          }
        }
        turn.makeRotationAxis(X, angle);
        lidM.copy(place).multiply(hinge).multiply(turn);
        tint.copy(WHITE).lerp(RED, glow * 0.7);
        for (const p of parts) { p.mesh.setMatrixAt(i, p.lid ? lidM : place); p.mesh.setColorAt(i, tint); }
      });
      for (const p of parts) {
        p.mesh.count = chests.length;
        p.mesh.instanceMatrix.needsUpdate = true;
        p.mesh.instanceColor!.needsUpdate = true;
      }
    },
  };
}
