import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TUNA_DROPS as T, TUNAS } from '../config/tunas';
import { characterMaterial, LAYER_CHARACTER } from '../render/materials';
import type { XpDrop } from './xpDrops';

const urls = import.meta.glob('../assets/models/liasse.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/**
 * Géométrie d'une ou plusieurs liasses du modèle « Cash Stack » (J-Toastie) : chaque pièce est posée à sa place, sa
 * couleur de matériau (celle de TUNA_DROPS.colors, sinon celle du modèle) passée en couleur de sommets (un seul dessin), le
 * tout centré et ramené à une longueur de 1.
 */
function cashGeometry(root: THREE.Object3D, keep: (name: string) => boolean) {
  const geos: THREE.BufferGeometry[] = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !keep(mesh.parent?.name || mesh.name)) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', src.getAttribute('position'));
    g.setAttribute('normal', src.getAttribute('normal'));
    const colors = new Float32Array(src.getAttribute('position').count * 3);
    // Une couleur par groupe de faces (un matériau par groupe)
    const groups = mesh.geometry.groups.length ? mesh.geometry.groups : [{ start: 0, count: colors.length / 3, materialIndex: 0 }];
    for (const grp of groups) {
      const src = mats[grp.materialIndex ?? 0] as THREE.MeshStandardMaterial;
      const hex = T.colors[src.name];
      const c = hex !== undefined ? new THREE.Color(hex) : src.color ?? new THREE.Color(1, 1, 1);
      for (let i = grp.start; i < grp.start + grp.count; i++) c.toArray(colors, i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.applyMatrix4(mesh.matrixWorld);
    geos.push(g);
  });
  const geo = mergeGeometries(geos)!;
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const size = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
  geo.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -(bb.min.z + bb.max.z) / 2).scale(1 / size, 1 / size, 1 / size);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Rendu des liasses de TUNAS au sol : une liasse pour un ennemi ordinaire, la pile entière pour un élite ou un boss
 * (plus grosse quand elle vaut plus) ; penchées, elles tournent. Un dessin par forme pour toutes les liasses.
 */
export async function createTunaDropsView(scene: THREE.Scene) {
  const gltf = await new GLTFLoader().loadAsync(Object.values(urls)[0]);
  const mat = characterMaterial({ vertexColors: true, emissive: T.emissive, emissiveIntensity: T.glow });
  const make = (geo: THREE.BufferGeometry) => {
    const mesh = new THREE.InstancedMesh(geo, mat, T.max);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.layers.set(LAYER_CHARACTER); // contour : lisible sur l'herbe
    mesh.count = 0;
    scene.add(mesh);
    return mesh;
  };
  const single = make(cashGeometry(gltf.scene, (n) => n === 'Cash'));
  const stack = make(cashGeometry(gltf.scene, () => true));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), spin = new THREE.Quaternion(), s = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0), up = new THREE.Vector3();
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), T.tilt);

  return {
    sync(drops: readonly XpDrop[]) {
      let a = 0, b = 0;
      for (const d of drops) {
        const big = d.value > TUNAS.value;
        up.copy(d.pos).normalize();
        q.setFromUnitVectors(Y, up).multiply(spin.setFromAxisAngle(Y, d.age * T.spin * Math.PI * 2 + d.phase)).multiply(tilt);
        const k = T.size * Math.min(T.maxScale, 1 + Math.log2(d.value) * 0.3) * Math.min(1, d.age * 6);
        m.compose(d.pos, q, s.setScalar(k));
        if (big) stack.setMatrixAt(b++, m); else single.setMatrixAt(a++, m);
      }
      single.count = a; stack.count = b;
      single.instanceMatrix.needsUpdate = true;
      stack.instanceMatrix.needsUpdate = true;
    },
  };
}
