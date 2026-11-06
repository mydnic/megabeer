import * as THREE from 'three';
import { FOOT_IK as F } from '../config/buveur';
import { groundRadius, slopeGradient } from '../world/terrain';
import type { PlayerController } from './controller';

type Leg = { thigh: THREE.Object3D; shin: THREE.Object3D; foot: THREE.Object3D; delta: number; onObstacle: boolean };

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
const H = new THREE.Vector3(), K = new THREE.Vector3(), A = new THREE.Vector3(), T = new THREE.Vector3();
const n = new THREE.Vector3(), grad = new THREE.Vector3(), normal = new THREE.Vector3();
const q = new THREE.Quaternion(), qb = new THREE.Quaternion(), qp = new THREE.Quaternion();

/** Applique une rotation exprimée dans le monde à un os (après l'animation). */
function rotateWorld(bone: THREE.Object3D, rot: THREE.Quaternion) {
  bone.getWorldQuaternion(qb);
  bone.parent!.getWorldQuaternion(qp);
  bone.quaternion.copy(qp.invert().multiply(rot).multiply(qb));
  bone.updateMatrixWorld(true);
}

/**
 * Calage des jambes sur le relief : chaque pied garde sa hauteur animée mais au-dessus du sol réel
 * sous lui, le bassin descend pour que la jambe côté pente puisse l'atteindre (IK à deux os), et le
 * pied posé s'incline selon la pente.
 */
export class FootIK {
  private legs: Leg[];
  private drop = 0;
  private weight = 1;
  private ankleRest: number;

  constructor(model: THREE.Object3D, private root: THREE.Object3D) {
    const bone = (name: string) => {
      const o = model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
      if (!o) throw new Error(`Os manquant dans buveur.glb : ${name}`);
      return o;
    };
    this.legs = ['L', 'R'].map((s) => ({ thigh: bone(`thigh.${s}`), shin: bone(`shin.${s}`), foot: bone(`foot.${s}`), delta: 0, onObstacle: false }));
    model.updateMatrixWorld(true);
    this.ankleRest = model.worldToLocal(this.legs[0].foot.getWorldPosition(v1)).y;
  }

  /** À appeler après l'animation et le placement de root. */
  update(dt: number, up: THREE.Vector3, facing: THREE.Vector3, right: THREE.Vector3, player: PlayerController) {
    const grounded = player.onGround;
    const k = 1 - Math.exp(-dt * F.sharpness);
    this.weight += ((grounded ? 1 : 0) - this.weight) * k;
    const w = this.weight;
    this.root.updateMatrixWorld(true);
    const groundRoot = this.root.position.length();

    // 1. Écart entre le sol sous chaque pied et le sol sous le perso
    let lowest = 0;
    for (const leg of this.legs) {
      leg.foot.getWorldPosition(A);
      const support = player.supportAt(A, groundRoot);
      leg.onObstacle = support - groundRadius(v1.copy(A).normalize()) > 0.01;
      leg.delta = THREE.MathUtils.clamp(support - groundRoot, -F.maxDelta, F.maxDelta) * w;
      lowest = Math.min(lowest, leg.delta);
    }

    // 2. Le bassin descend pour que le pied le plus bas touche
    this.drop += (Math.min(F.maxDrop, -lowest) - this.drop) * k;
    if (this.drop > 1e-4) {
      this.root.position.addScaledVector(up, -this.drop);
      this.root.updateMatrixWorld(true);
    }
    if (w < 0.01) return;

    for (const leg of this.legs) {
      leg.thigh.getWorldPosition(H);
      leg.shin.getWorldPosition(K);
      leg.foot.getWorldPosition(A);
      T.copy(A).addScaledVector(up, leg.delta + this.drop);

      // 3. Genou : angle donné par la loi des cosinus pour atteindre la cible
      const l1 = H.distanceTo(K), l2 = K.distanceTo(A);
      const d = THREE.MathUtils.clamp(H.distanceTo(T), Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999);
      const want = Math.acos(THREE.MathUtils.clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
      v2.subVectors(H, K).normalize();
      v3.subVectors(A, K).normalize();
      const now = Math.acos(THREE.MathUtils.clamp(v2.dot(v3), -1, 1));
      n.crossVectors(v2, v3);
      // Jambe tendue : l'axe du genou est l'axe latéral, plié vers l'arrière
      if (n.lengthSq() < 1e-6) n.copy(right).negate(); else n.normalize();
      rotateWorld(leg.shin, q.setFromAxisAngle(n, want - now));

      // 4. Cuisse : aligne hanche -> cheville sur hanche -> cible
      leg.foot.getWorldPosition(A);
      v2.subVectors(A, H).normalize();
      v3.subVectors(T, H).normalize();
      rotateWorld(leg.thigh, q.setFromUnitVectors(v2, v3));

      // 5. Pied posé : suit la pente (atténué quand il est levé)
      leg.foot.getWorldPosition(A);
      const lift = v1.subVectors(A, this.root.position).dot(up) - this.drop - leg.delta - this.ankleRest;
      const contact = 1 - THREE.MathUtils.clamp(lift / F.contactHeight, 0, 1);
      if (contact <= 0 || leg.onObstacle) continue; // sur un obstacle : dessus considéré plat
      slopeGradient(v1.copy(A).normalize(), facing, right, grad);
      grad.clampLength(0, F.maxFootSlope);
      normal.copy(up).sub(grad).normalize();
      q.setFromUnitVectors(up, normal);
      qb.identity().slerp(q, contact * w);
      rotateWorld(leg.foot, qb.clone());
    }
  }
}
