import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import buveurUrl from '../assets/models/buveur.glb?url';
import { BASE_SPEED } from '../config/world';
import { BEER_SPLASH, BUVEUR_VISUAL as V } from '../config/buveur';
import { characterMaterial, LAYER_CHARACTER } from '../render/materials';
import { FootIK } from './footIK';
import { heightAt, meadowAt } from '../world/terrain';
import { BeerSplash } from './beerSplash';
import type { PlayerController } from './controller';

type Clip = 'idle' | 'run' | 'jump' | 'fall' | 'land';

/** Sol sous un pied, pour le son des pas. */
export type Surface = 'grass' | 'dirt' | 'stone' | 'snow';
/** Événements sonores du perso (branchés sur le moteur audio par main). */
export type BuveurSound =
  | { type: 'step'; surface: Surface; side: -1 | 1 }
  | { type: 'jump' }
  | { type: 'land'; speed: number; surface: Surface };

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
  private splash: BeerSplash;
  /** Os de la main droite et position du haut de la pinte dans son repère. */
  private hand?: THREE.Object3D;
  private pintOffset = new THREE.Vector3();
  private pintPos = new THREE.Vector3();
  private runPhase = 0;
  private baseVel = new THREE.Vector3();
  /** Pied levé assez haut depuis le dernier appui (prêt à faire un bruit de pas). */
  private armed = [false, false];
  private materials: THREE.MeshToonMaterial[] = [];
  private flashTime = 0;
  private flashDuration = 0.2;
  private flashColor = new THREE.Color();
  /** Reçoit les événements sonores (pas, saut, réception). */
  onSound?: (e: BuveurSound) => void;

  constructor(scene: THREE.Scene) {
    this.root.add(this.lean);
    this.lean.add(this.squashGroup);
    scene.add(this.root);
    this.splash = new BeerSplash(scene);
  }

  async load() {
    const gltf = await new GLTFLoader().loadAsync(buveurUrl);
    const mats = new Map<string, THREE.Material>();
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as THREE.MeshStandardMaterial;
      let m = mats.get(src.name);
      if (!m) { m = characterMaterial({ color: src.color }); m.name = src.name; mats.set(src.name, m); this.materials.push(m as THREE.MeshToonMaterial); }
      mesh.material = m;
      mesh.castShadow = true;
      // Pas d'ombre reçue : la carte d'ombre est trop grossière pour un perso de 1,9 m (taches au dos)
      mesh.receiveShadow = false;
      mesh.layers.set(LAYER_CHARACTER);
      mesh.frustumCulled = false; // la sphère englobante ne suit pas les os
    });
    this.squashGroup.add(gltf.scene);
    this.ik = new FootIK(gltf.scene, this.root);
    // Haut de la pinte exprimé dans le repère de l'os de la main (pose de repos)
    this.hand = gltf.scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName('hand.R'));
    if (this.hand) {
      gltf.scene.updateMatrixWorld(true);
      this.pintOffset.set(...BEER_SPLASH.pintTop).applyMatrix4(gltf.scene.matrixWorld)
        .applyMatrix4(this.hand.matrixWorld.clone().invert());
    }
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
    this.updateFlash(dt);

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
    this.ik?.restoreAnimatedPose();
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

    // --- Éclaboussures de bière
    this.updateSplash(dt, player, up, ev);

    // --- Sons : pas (quand un pied se pose), saut, réception
    this.updateSounds(player, ev);
  }

  private surfaceUnder(p: THREE.Vector3, onDecor: boolean): Surface {
    if (onDecor) return 'stone';
    const d = this.tmp.copy(p).normalize();
    if (heightAt(d) > 22) return 'snow';
    return meadowAt(d) < 0.5 ? 'dirt' : 'grass';
  }

  private updateSounds(player: PlayerController, ev: PlayerController['events']) {
    if (!this.onSound || !this.ik) return;
    if (ev.jumped) this.onSound({ type: 'jump' });
    if (ev.landed) {
      const leg = this.ik.legs[0];
      this.onSound({ type: 'land', speed: ev.landSpeed, surface: this.surfaceUnder(player.pos, leg.onObstacle) });
    }
    const moving = player.onGround && player.velocity.length() > 1;
    this.ik.legs.forEach((leg, i) => {
      // Un pas : le pied a été levé (armé) puis vient de toucher le sol
      if (leg.lift > 0.08) this.armed[i] = true;
      else if (this.armed[i] && leg.lift < 0.03) {
        this.armed[i] = false;
        if (moving) {
          const p = leg.foot.getWorldPosition(this.pintPos.clone());
          this.onSound!({ type: 'step', surface: this.surfaceUnder(p, leg.onObstacle), side: i === 0 ? -1 : 1 });
        }
      }
    });
  }

  private updateSplash(dt: number, player: PlayerController, up: THREE.Vector3, ev: PlayerController['events']) {
    const B = BEER_SPLASH;
    if (this.hand) {
      this.hand.updateWorldMatrix(true, false);
      this.pintPos.copy(this.pintOffset).applyMatrix4(this.hand.matrixWorld);
      const rand = (r: readonly [number, number]) => Math.round(r[0] + Math.random() * (r[1] - r[0]));
      // Course : la bière déborde quand le corps redescend sur un appui (2 fois par cycle)
      if (this.current === 'run' && player.onGround) {
        const a = this.actions.run;
        const phase = (a.time / a.getClip().duration) % 1;
        const crossed = (p: number) => (this.runPhase < p && phase >= p) || (this.runPhase > phase && (phase >= p || this.runPhase < p));
        if ((crossed(0.25) || crossed(0.75)) && Math.random() < B.run.chance) {
          this.splash.emit(this.pintPos, this.baseVel.copy(player.velocity).multiplyScalar(B.run.inherit), up,
            rand(B.run.count), [...B.run.upSpeed], B.run.spread);
        }
        this.runPhase = phase;
      }
      if (ev.jumped) {
        this.splash.emit(this.pintPos, this.baseVel.copy(player.velocity).multiplyScalar(B.jump.inherit), up,
          B.jump.count, [...B.jump.upSpeed], B.jump.spread);
      }
      if (ev.landed) {
        const n = Math.min(B.land.max, Math.round(ev.landSpeed * B.land.countPerSpeed));
        if (n > 0) this.splash.emit(this.pintPos, this.baseVel.copy(player.velocity).multiplyScalar(B.land.inherit), up,
          n, [...B.land.upSpeed], B.land.spread);
      }
    }
    this.splash.update(dt);
  }

  /** Coup reçu : flash de couleur sur tout le corps et écrasement. */
  hurt(color: number, duration: number) {
    this.flashColor.set(color);
    this.flashTime = this.flashDuration = duration;
    this.kick(-0.12);
  }

  private updateFlash(dt: number) {
    if (this.flashTime <= 0 && this.flashDuration === 0) return;
    this.flashTime = Math.max(0, this.flashTime - dt);
    const k = this.flashDuration > 0 ? this.flashTime / this.flashDuration : 0;
    for (const m of this.materials) m.emissive.copy(this.flashColor).multiplyScalar(k * k);
    if (this.flashTime === 0) this.flashDuration = 0;
  }

  private kick(amount: number) {
    this.squash = amount;
    this.squashVel = 0;
  }
}
