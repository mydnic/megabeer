import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { COIN_DROPS as C } from '../config/coins';
import { characterMaterial, LAYER_CHARACTER } from '../render/materials';
import type { XpDrop } from './xpDrops';

const urls = import.meta.glob('../assets/models/capsule.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/**
 * Capsule couronne : le modèle « Bottlecap » (Poly by Google), ramené à un rayon de 1 et posé sur son
 * centre ; ses faces du dessus prennent la couleur imprimée (rouge), la jupe crantée la couleur dorée.
 */
async function capsuleGeometry() {
  const gltf = await new GLTFLoader().loadAsync(Object.values(urls)[0]);
  let src: THREE.BufferGeometry | null = null;
  gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && !src) src = (o as THREE.Mesh).geometry; });
  const geo = src!.clone().toNonIndexed();
  geo.deleteAttribute('uv');
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const r = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2;
  geo.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -(bb.min.z + bb.max.z) / 2).scale(1 / r, 1 / r, 1 / r);
  geo.computeVertexNormals();
  // Dessus : faces tournées vers le haut, dans la moitié haute de la capsule
  const pos = geo.attributes.position, nrm = geo.attributes.normal;
  const top = new THREE.Color(C.top), skirt = new THREE.Color(C.color), col: number[] = [];
  for (let t = 0; t < pos.count; t += 3) {
    let ny = 0, y = 0;
    for (let k = 0; k < 3; k++) { ny += nrm.getY(t + k) / 3; y += pos.getY(t + k) / 3; }
    const c = ny > C.topNormal && y > 0 ? top : skirt;
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

/** Rendu des capsules (Pièces) au sol : penchées pour montrer leur dessus imprimé, elles tournent ; un seul dessin pour toutes. */
export async function createCoinDropsView(scene: THREE.Scene) {
  const mat = characterMaterial({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: C.glow, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(await capsuleGeometry(), mat, C.max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.layers.set(LAYER_CHARACTER); // contour comme les persos : lisible sur l'herbe
  mesh.count = 0;
  scene.add(mesh);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), spin = new THREE.Quaternion(), s = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0), up = new THREE.Vector3();
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), C.tilt);

  return {
    sync(drops: readonly XpDrop[]) {
      drops.forEach((d, i) => {
        // Penchée vers l'extérieur, elle tourne autour de la verticale locale ; apparaît en grossissant
        up.copy(d.pos).normalize();
        q.setFromUnitVectors(Y, up).multiply(spin.setFromAxisAngle(Y, d.age * C.spin * Math.PI * 2 + d.phase)).multiply(tilt);
        const k = C.radius * Math.min(1, d.age * 6);
        mesh.setMatrixAt(i, m.compose(d.pos, q, s.setScalar(k)));
      });
      mesh.count = drops.length;
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
