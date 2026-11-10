import * as THREE from 'three';
import { COIN_DROPS as C } from '../config/coins';
import { characterMaterial, LAYER_CHARACTER } from '../render/materials';
import type { XpDrop } from './xpDrops';

/**
 * Capsule couronne (modèle des vraies capsules de bière) : dessus plat imprimé (rouge, anneau blanc),
 * épaule arrondie, puis jupe dorée qui s'évase et finit en crans (21 sur une vraie capsule). Faite
 * de bandes de couleur franche (couleurs par sommet), rayon 1, posée sur y = 0.
 */
function capsuleGeometry() {
  const n = C.teeth * 2, h = C.height;
  const pos: number[] = [], col: number[] = [];
  const top = new THREE.Color(C.top), print = new THREE.Color(C.print), skirt = new THREE.Color(C.color);
  const at = (r: number, a: number, y: number) => [Math.cos(a) * r, y, Math.sin(a) * r];
  // Une bande entre deux cercles (r0, y0) -> (r1, y1) ; `crimp` : le bord extérieur alterne creux et bosses
  const band = (r0: number, y0: number, r1: number, y1: number, c: THREE.Color, crimp = false) => {
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      const o0 = crimp && k % 2 ? r1 * C.crimp : r1, o1 = crimp && (k + 1) % 2 ? r1 * C.crimp : r1;
      const v = [at(r0, a0, y0), at(o0, a0, y1), at(o1, a1, y1), at(r0, a0, y0), at(o1, a1, y1), at(r0, a1, y0)];
      for (const q of v) { pos.push(...q); col.push(c.r, c.g, c.b); }
    }
  };
  band(0, h, 0.42, h, top);
  band(0.42, h, 0.55, h, print);
  band(0.55, h, 0.72, h, top);
  band(0.72, h, 0.86, h * 0.75, skirt);
  band(0.86, h * 0.75, 1, 0, skirt, true);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo.translate(0, -h / 2, 0);
}

/** Rendu des capsules (Pièces) au sol : penchées pour montrer leur dessus imprimé, elles tournent ; un seul dessin pour toutes. */
export function createCoinDropsView(scene: THREE.Scene) {
  const mat = characterMaterial({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: C.glow, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(capsuleGeometry(), mat, C.max);
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
