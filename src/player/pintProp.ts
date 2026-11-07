import * as THREE from 'three';
import { DEATH } from '../config/buveur';
import { PLAYER_PHYSICS } from '../config/world';
import { characterMaterial, LAYER_CHARACTER } from '../render/materials';

/**
 * La pinte qui échappe au Buveur à sa mort : un vrai objet lancé, qui tourne, rebondit sur le sol
 * de la planète et finit couchée. Même forme et mêmes couleurs que la pinte du modèle.
 */
export class PintProp {
  readonly root = new THREE.Group();
  private vel = new THREE.Vector3();
  private spin = new THREE.Vector3();
  private bounces = 0;
  private settled = false;
  private up = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private q = new THREE.Quaternion();
  /** Appelé à chaque rebond avec la vitesse d'impact (éclaboussure, son). */
  onImpact?: (pos: THREE.Vector3, speed: number) => void;

  constructor(scene: THREE.Scene, colors: { verre: THREE.Color; biere: THREE.Color; mousse: THREE.Color },
    private support: (p: THREE.Vector3, feetR: number) => number) {
    const mk = (c: THREE.Color, geo: THREE.BufferGeometry) => {
      const m = new THREE.Mesh(geo, characterMaterial({ color: c }));
      m.castShadow = true;
      m.layers.set(LAYER_CHARACTER);
      this.root.add(m);
    };
    // Origine au centre de la pinte (axe Y)
    mk(colors.verre, new THREE.CylinderGeometry(0.082, 0.068, 0.24, 14).translate(0, 0, 0));
    mk(colors.biere, new THREE.CylinderGeometry(0.085, 0.072, 0.19, 14).translate(0, -0.015, 0));
    mk(colors.mousse, new THREE.SphereGeometry(0.09, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 1).translate(0, 0.12, 0));
    this.root.visible = false;
    scene.add(this.root);
  }

  /** Reprend les couleurs exactes du modèle (connues une fois le Buveur chargé). */
  setColors(verre: THREE.Color, biere: THREE.Color, mousse: THREE.Color) {
    const [a, b, c] = this.root.children as THREE.Mesh[];
    (a.material as THREE.MeshToonMaterial).color.copy(verre);
    (b.material as THREE.MeshToonMaterial).color.copy(biere);
    (c.material as THREE.MeshToonMaterial).color.copy(mousse);
  }

  /** Lance la pinte depuis une position et une orientation, avec une vitesse et une rotation. */
  launch(pos: THREE.Vector3, quat: THREE.Quaternion, vel: THREE.Vector3, spin: THREE.Vector3) {
    this.root.position.copy(pos);
    this.root.quaternion.copy(quat);
    this.vel.copy(vel);
    this.spin.copy(spin);
    this.bounces = 0;
    this.settled = false;
    this.root.visible = true;
  }

  hide() { this.root.visible = false; }

  update(dt: number) {
    if (!this.root.visible || this.settled) return;
    const p = this.root.position;
    const up = this.up.copy(p).normalize();
    this.vel.addScaledVector(up, -PLAYER_PHYSICS.gravity * dt);
    p.addScaledVector(this.vel, dt);
    // Rotation libre
    const w = this.spin.length();
    if (w > 1e-4) this.root.quaternion.premultiply(this.q.setFromAxisAngle(this.tmp.copy(this.spin).divideScalar(w), w * dt));
    // Sol : la pinte couchée a un rayon d'environ 8 cm
    const ground = this.support(p, p.length()) + DEATH.pint.radius;
    if (p.length() < ground) {
      p.setLength(ground);
      up.copy(p).normalize();
      const vr = this.vel.dot(up);
      if (vr < 0) {
        if (-vr > 1) this.onImpact?.(p, -vr);
        this.bounces++;
        this.vel.addScaledVector(up, -vr * (1 + DEATH.pint.bounce));
        // Frottement au sol
        const vt = this.tmp.copy(this.vel).addScaledVector(up, -this.vel.dot(up));
        this.vel.addScaledVector(vt, -(1 - DEATH.pint.friction));
        this.spin.multiplyScalar(DEATH.pint.spinKeep);
      }
      // Presque immobile : elle se couche sur le côté et ne bouge plus
      if (this.vel.length() < 0.6 && this.bounces > 1) {
        const axis = this.tmp.set(0, 1, 0).applyQuaternion(this.root.quaternion);
        axis.addScaledVector(up, -axis.dot(up));
        if (axis.lengthSq() < 1e-4) axis.set(1, 0, 0).addScaledVector(up, -up.x);
        axis.normalize();
        // Repère couché : axe de la pinte le long du sol, son flanc (X local) vers le ciel
        const side = new THREE.Vector3().crossVectors(up, axis);
        this.root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(up.clone(), axis, side));
        this.settled = true;
      }
    }
  }
}
