import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import buveurUrl from '../assets/models/buveur.glb?url';
import { BASE_SPEED } from '../config/world';
import { BUVEUR_VISUAL as V } from '../config/buveur';
import { LAYER_CHARACTER, toonMaterial } from '../render/toon';
import { FootIK } from './footIK';
import type { PlayerController } from './controller';

type Clip = 'idle' | 'run' | 'jump' | 'fall' | 'land';

/**
 * Modèle animé du Buveur : charge le GLB (généré par tools/blender/buveur.py), passe ses
 * matériaux en toon, choisit l'animation selon l'état du contrôleur et ajoute l'écrasement /
 * étirement et l'inclinaison par code.
 */
export class BuveurVisual {
  /** Placé et orienté sur le joueur chaque frame. */
  readonly root = new THREE.Group();
  private lean = new THREE.Group();
  private squashGroup = new THREE.Group();
  private mixer?: THREE.AnimationMixer;
  private ik?: FootIK;
  private actions = {} as Record<Clip, THREE.AnimationAction>;
  private current?: Clip;
  private landTimer = 0;
  private squash = 0;
  private squashVel = 0;
  private leanFwd = 0;
  private leanSide = 0;
  private prevVel = new THREE.Vector3();
  private prevFacing = new THREE.Vector3();
  private basis = new THREE.Matrix4();
  private right = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private up = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.root.add(this.lean);
    this.lean.add(this.squashGroup);
    scene.add(this.root);
  }

  async load() {
    const gltf = await new GLTFLoader().loadAsync(buveurUrl);
    const mats = new Map<string, THREE.Material>();
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as THREE.MeshStandardMaterial;
      let m = mats.get(src.name);
      if (!m) { m = toonMaterial({ color: src.color }, { character: true }); m.name = src.name; mats.set(src.name, m); }
      mesh.material = m;
      mesh.castShadow = true;
      // Pas d'ombre reçue : la carte d'ombre est trop grossière pour un perso de 1,9 m (taches)
      mesh.receiveShadow = false;
      mesh.frustumCulled = false; // la sphère englobante ne suit pas les os
      mesh.layers.set(LAYER_CHARACTER);
    });
    this.squashGroup.add(gltf.scene);
    this.ik = new FootIK(gltf.scene, this.root);
    this.mixer = new THREE.AnimationMixer(gltf.scene);
    for (const name of ['idle', 'run', 'jump', 'fall', 'land'] as Clip[]) {
      const clip = gltf.animations.find((a) => a.name === name);
      if (!clip) throw new Error(`Animation manquante dans buveur.glb : ${name}`);
      const action = this.mixer.clipAction(clip);
      if (name === 'jump' || name === 'land') { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; }
      this.actions[name] = action;
    }
    this.play('idle', 0);
  }

  private play(name: Clip, fade: number) {
    if (this.current === name) return;
    const next = this.actions[name];
    next.reset().play();
    if (this.current) this.actions[this.current].crossFadeTo(next, fade, false);
    this.current = name;
  }

  update(dt: number, player: PlayerController) {
    const up = this.up.copy(player.renderPos).normalize();
    const facing = player.renderFacing;

    // --- Placement et orientation (état interpolé entre deux pas de physique)
    this.right.crossVectors(up, facing).normalize();
    this.root.position.copy(player.renderPos);
    this.root.quaternion.setFromRotationMatrix(this.basis.makeBasis(this.right, up, facing));
    if (!this.mixer) return;

    // --- Choix de l'animation
    const hSpeed = player.velocity.length();
    const ev = player.events;
    if (ev.jumped) {
      this.play('jump', V.fade.toAir);
      this.kick(V.squash.jumpStretch);
    }
    if (ev.landed) {
      this.kick(-Math.min(V.squash.landMax, ev.landSpeed * V.squash.landPerSpeed));
      this.landTimer = V.landHold;
      this.play('land', V.fade.land);
    }
    this.landTimer = Math.max(0, this.landTimer - dt);
    if (!player.onGround) {
      if (player.vr < 0 && this.current !== 'fall') this.play('fall', 0.25);
    } else if (this.landTimer <= 0 || (hSpeed > V.idleBelow && this.landTimer < V.landHold * 0.5)) {
      this.play(hSpeed > V.idleBelow ? 'run' : 'idle', this.current === 'land' ? V.fade.fromLand : V.fade.idleRun);
    }
    this.actions.run.timeScale = V.runRateAtBaseSpeed * Math.max(0.5, hSpeed / BASE_SPEED);
    this.mixer.update(dt);

    // --- Écrasement / étirement (ressort amorti, volume conservé)
    const S = V.squash;
    this.squashVel += (-S.stiffness * this.squash - S.damping * this.squashVel) * dt;
    this.squash += this.squashVel * dt;
    const sy = 1 + this.squash, sxz = 1 / Math.sqrt(Math.max(0.3, sy));
    this.squashGroup.scale.set(sxz, sy, sxz);

    // --- Inclinaison : vers l'avant quand il accélère, sur le côté quand il tourne
    const L = V.lean;
    const accel = this.tmp.subVectors(player.velocity, this.prevVel).divideScalar(Math.max(dt, 1e-4));
    const fwdAccel = accel.dot(facing);
    let turn = 0;
    if (this.prevFacing.lengthSq() > 0 && dt > 0) {
      const cross = this.tmp.crossVectors(this.prevFacing, facing).dot(up);
      turn = (cross / dt) * Math.min(1, hSpeed / BASE_SPEED);
    }
    const k = 1 - Math.exp(-dt * L.sharpness);
    this.leanFwd += (THREE.MathUtils.clamp(fwdAccel * L.forwardPerAccel, -L.max, L.max) - this.leanFwd) * k;
    this.leanSide += (THREE.MathUtils.clamp(-turn * L.sidePerTurn, -L.max, L.max) - this.leanSide) * k;
    this.lean.rotation.set(this.leanFwd, 0, this.leanSide);
    this.prevVel.copy(player.velocity);
    this.prevFacing.copy(facing);

    // --- Jambes calées sur le relief (après l'animation)
    this.ik?.update(dt, up, facing, this.right, player);
  }

  private kick(amount: number) {
    this.squash = amount;
    this.squashVel = 0;
  }
}
