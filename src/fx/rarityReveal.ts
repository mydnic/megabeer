import * as THREE from 'three';
import { CHEST_REVEAL as R } from '../config/fx';
import { RARITIES } from '../config/upgrades';
import { LAYER_SKY } from '../render/materials';

type Bubble = { pos: THREE.Vector3; vel: THREE.Vector3; size: number; age: number; max: number };

/**
 * Révélation de la rareté d'un coffre : colonne de lumière et fontaine de mousse de la couleur de
 * la rareté. Avance en temps réel (le jeu est figé pendant la révélation). Sur la couche du ciel :
 * hors occlusion ambiante (sinon carrés noirs), mais le halo lumineux les prend.
 */
export function createRarityReveal(scene: THREE.Scene) {
  const colGeo = new THREE.CylinderGeometry(R.columnRadius, R.columnRadius * 1.4, 1, 20, 1, true).translate(0, 0.5, 0);
  const colMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const column = new THREE.Mesh(colGeo, colMat);
  column.layers.set(LAYER_SKY);
  column.visible = false;
  scene.add(column);

  const maxBubbles = R.foam + R.foamPerRarity * (RARITIES.length - 1);
  const foamMat = new THREE.MeshBasicMaterial();
  const foam = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), foamMat, maxBubbles);
  foam.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  foam.frustumCulled = false;
  foam.layers.set(LAYER_SKY);
  foam.count = 0;
  scene.add(foam);

  const bubbles: Bubble[] = [];
  const up = new THREE.Vector3(), side = new THREE.Vector3(), side2 = new THREE.Vector3();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  let age = Infinity, total = 0, height = 0;

  return {
    /** Lance la révélation au coffre (pieds en `at`) pour `duration` s, à la couleur de `rarity`. */
    play(at: THREE.Vector3, rarity: number, duration: number) {
      const color = new THREE.Color(RARITIES[rarity].color);
      up.copy(at).normalize();
      side.set(1, 0, 0).cross(up).normalize();
      side2.crossVectors(up, side);
      column.position.copy(at);
      column.quaternion.setFromUnitVectors(Y, up);
      colMat.color.copy(color);
      foamMat.color.copy(color).lerp(new THREE.Color(0xffffff), 0.35);
      height = R.columnHeight + R.columnPerRarity * rarity;
      age = 0;
      total = duration + R.fadeOut;
      column.visible = true;
      bubbles.length = 0;
      const n = R.foam + R.foamPerRarity * rarity;
      const from = at.clone().addScaledVector(up, R.from);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, k = Math.random();
        const vel = up.clone().multiplyScalar(R.foamUp * (0.6 + Math.random() * 0.7) * (1 + rarity * 0.12))
          .addScaledVector(side, Math.cos(a) * R.foamSpread * k).addScaledVector(side2, Math.sin(a) * R.foamSpread * k);
        bubbles.push({ pos: from.clone(), vel, size: R.foamSize * (0.5 + Math.random()), age: -Math.random() * 0.25, max: R.foamLife * (0.7 + Math.random() * 0.5) });
      }
    },
    /** Chaque image, en temps réel. */
    update(realDt: number) {
      if (age < total) {
        age += realDt;
        const grow = Math.min(1, age / R.rise);
        const fade = Math.min(1, Math.max(0, (total - age) / R.fadeOut));
        column.scale.set(1, Math.max(0.01, height * (1 - (1 - grow) ** 3)), 1);
        colMat.opacity = R.columnOpacity * fade * (0.85 + 0.15 * Math.sin(age * 20));
        if (age >= total) column.visible = false;
      }
      let n = 0;
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.age += realDt;
        if (b.age >= b.max) { bubbles.splice(i, 1); continue; }
        if (b.age < 0) continue;
        up.copy(b.pos).normalize();
        b.vel.addScaledVector(up, -R.foamGravity * realDt);
        b.pos.addScaledVector(b.vel, realDt);
        const k = b.size * Math.min(1, (b.max - b.age) / (b.max * 0.4));
        foam.setMatrixAt(n++, m.compose(b.pos, q, s.setScalar(k)));
      }
      foam.count = n;
      foam.instanceMatrix.needsUpdate = true;
    },
    clear() { bubbles.length = 0; foam.count = 0; column.visible = false; age = Infinity; },
  };
}
