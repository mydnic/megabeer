import * as THREE from 'three';
import { RADIO_LOOK as L } from '../config/radio';
import type { Radio } from '../game/radio';
import { characterMaterial, LAYER_CHARACTER } from '../render/materials';

/**
 * Le poste de radio (un ghetto-blaster : caisse, deux haut-parleurs, poignée, antenne), en cel-shading comme les objets du
 * décor. Allumé, il saute en rythme et ses haut-parleurs pompent ; cassé, il se couche, noirci.
 */
export function createRadioView(scene: THREE.Scene) {
  const C = L.colors;
  const root = new THREE.Group();
  const box = new THREE.Group();
  root.add(box);
  const mat = (c: number) => characterMaterial({ color: c });
  const body = mat(C.body), front = mat(C.front), cone = mat(C.speaker), dark = mat(C.handle), metal = mat(C.antenna);
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.layers.set(LAYER_CHARACTER);
    box.add(mesh);
    return mesh;
  };
  const W = L.width, H = L.height, D = L.depth;
  add(new THREE.BoxGeometry(W, H, D), body, 0, H / 2, 0);
  add(new THREE.BoxGeometry(W * 0.94, H * 0.8, 0.02), front, 0, H / 2, D / 2 + 0.005);
  const speakers: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const s = add(new THREE.CylinderGeometry(H * 0.3, H * 0.3, 0.05, 20).rotateX(Math.PI / 2), cone, sx * W * 0.28, H * 0.48, D / 2 + 0.02);
    add(new THREE.CylinderGeometry(H * 0.1, H * 0.1, 0.06, 12).rotateX(Math.PI / 2), dark, sx * W * 0.28, H * 0.48, D / 2 + 0.04);
    speakers.push(s);
  }
  add(new THREE.BoxGeometry(W * 0.16, H * 0.16, 0.03), metal, 0, H * 0.72, D / 2 + 0.02);
  add(new THREE.TorusGeometry(W * 0.32, 0.03, 8, 20, Math.PI), dark, 0, H, 0);
  add(new THREE.CylinderGeometry(0.012, 0.012, H * 1.4, 6), metal, W * 0.4, H + H * 0.7, 0).rotation.z = -0.3;
  root.visible = false;
  scene.add(root);

  const up = new THREE.Vector3(), right = new THREE.Vector3(), basis = new THREE.Matrix4();
  let t = 0;
  return {
    /** Chaque image : la radio de la run (cachée hors run ou si elle n'est pas posée). */
    sync(radio: Radio, inRun: boolean, dt: number) {
      t += dt;
      root.visible = inRun && !!radio.pos;
      if (!root.visible || !radio.pos) return;
      up.copy(radio.pos).normalize();
      right.crossVectors(up, radio.facing).normalize();
      root.position.copy(radio.pos);
      root.quaternion.setFromRotationMatrix(basis.makeBasis(right, up, radio.facing));
      const playing = radio.state === 'playing';
      // Allumée : petits sauts en rythme, haut-parleurs qui pompent
      const beat = playing ? Math.abs(Math.sin(t * Math.PI * 2)) : 0;
      box.position.y = beat * 0.06;
      box.rotation.set(0, 0, playing ? Math.sin(t * Math.PI * 2) * 0.05 : 0);
      for (const s of speakers) s.scale.setScalar(1 + beat * 0.15);
      // Cassée : couchée sur le flanc, noircie
      if (radio.state === 'broken') { box.rotation.set(0, 0, 1.4); box.position.y = 0.1; body.color.set(0x3a2a26); }
      else body.color.set(C.body);
    },
  };
}
