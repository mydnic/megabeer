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

type Clip = 'idle' | 'run' | 'jump' | 'fall' | 'land' | 'death';

/** Sol sous un pied, pour le son des pas. */
export type Surface = 'grass' | 'dirt' | 'stone' | 'snow';
/** Événements sonores du perso (branchés sur le moteur audio par main). */
export type BuveurSound =
  | { type: 'step'; surface: Surface; side: -1 | 1 }
  | { type: 'jump' }
  | { type: 'land'; speed: number; surface: Surface };

/** Un modèle de perso prêt à jouer (le Buveur, le Videur...) : sa scène, ses animations, ses os utiles. */
type Rig = {
  scene: THREE.Object3D; mixer: THREE.AnimationMixer; ik: FootIK; actions: Record<Clip, THREE.AnimationAction>;
  throwAction: THREE.AnimationAction; hand?: THREE.Object3D; pintOffset: THREE.Vector3; pintBone?: THREE.Object3D;
  handL?: THREE.Object3D; materials: THREE.MeshToonMaterial[]; hasPint: boolean;
};

/**
 * Modèle animé du perso joué : charge les GLB des persos (générés par tools/blender/buveur.py, mêmes os et mêmes
 * animations), passe leurs matériaux en toon, choisit l'animation selon l'état du contrôleur et ajoute l'écrasement /
 * étirement et l'inclinaison par code. `use(id)` change de perso (un seul modèle visible).
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
  private pintBone?: THREE.Object3D;
  private handL?: THREE.Object3D;
  private throwAction?: THREE.AnimationAction;
  /** Mort : animation de chute jouée jusqu'au bout, plus d'IK, d'éclaboussures ni de pas. */
  dead = false;
  private flashTime = 0;
  private flashDuration = 0.2;
  private flashColor = new THREE.Color();
  /** Reçoit les événements sonores (pas, saut, réception). */
  onSound?: (e: BuveurSound) => void;

  private rigs = new Map<string, Rig>();
  private using = '';
  /** Le perso joué tient une pinte (le Buveur) : éclaboussures de bière, pinte lancée à la mort. */
  hasPint = true;

  constructor(scene: THREE.Scene) {
    this.root.add(this.lean);
    this.lean.add(this.squashGroup);
    scene.add(this.root);
    this.splash = new BeerSplash(scene);
  }

  /** Charge le modèle d'un perso (`id`), sans l'afficher ; le premier chargé est affiché d'office. */
  async load(id = 'buveur', url: string = buveurUrl) {
    const gltf = await new GLTFLoader().loadAsync(url);
    const materials: THREE.MeshToonMaterial[] = [];
    const mats = new Map<string, THREE.Material>();
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as THREE.MeshStandardMaterial;
      let m = mats.get(src.name);
      if (!m) { m = characterMaterial({ color: src.color }); m.name = src.name; mats.set(src.name, m); materials.push(m as THREE.MeshToonMaterial); }
      mesh.material = m;
      mesh.castShadow = true;
      // Pas d'ombre reçue : la carte d'ombre est trop grossière pour un perso de 1,9 m (taches au dos)
      mesh.receiveShadow = false;
      mesh.layers.set(LAYER_CHARACTER);
      mesh.frustumCulled = false; // la sphère englobante ne suit pas les os
    });
    gltf.scene.visible = false;
    this.squashGroup.add(gltf.scene);
    const ik = new FootIK(gltf.scene, this.root);
    // Haut de la pinte exprimé dans le repère de l'os de la main (pose de repos)
    const hand = gltf.scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName('hand.R'));
    const pintOffset = new THREE.Vector3();
    if (hand) {
      gltf.scene.updateMatrixWorld(true);
      pintOffset.set(...BEER_SPLASH.pintTop).applyMatrix4(gltf.scene.matrixWorld).applyMatrix4(hand.matrixWorld.clone().invert());
    }
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const actions = {} as Record<Clip, THREE.AnimationAction>;
    for (const name of ['idle', 'run', 'jump', 'fall', 'land', 'death'] as Clip[]) {
      const clip = gltf.animations.find((a) => a.name === name);
      if (!clip) throw new Error(`Animation manquante dans ${id} : ${name}`);
      const action = mixer.clipAction(clip);
      if (name === 'jump' || name === 'land' || name === 'death') { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; }
      actions[name] = action;
    }
    // Lancer : clip additif (seul l'écart à sa pose de départ s'ajoute à la course ou à l'attente)
    const throwClip = gltf.animations.find((a) => a.name === 'throw');
    if (!throwClip) throw new Error(`Animation manquante dans ${id} : throw`);
    THREE.AnimationUtils.makeClipAdditive(throwClip);
    const throwAction = mixer.clipAction(throwClip);
    throwAction.blendMode = THREE.AdditiveAnimationBlendMode;
    throwAction.setLoop(THREE.LoopOnce, 1);
    throwAction.clampWhenFinished = false;
    this.rigs.set(id, {
      scene: gltf.scene, mixer, ik, actions, throwAction, hand, pintOffset, materials,
      pintBone: gltf.scene.getObjectByName('pint'), handL: gltf.scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName('hand.L')),
      hasPint: materials.some((m) => m.name === 'verre'),
    });
    if (!this.using) this.use(id);
  }

  /** Affiche le perso `id` (déjà chargé) à la place du précédent. */
  use(id: string) {
    const r = this.rigs.get(id);
    if (!r || id === this.using) return;
    const prev = this.rigs.get(this.using);
    if (prev) { prev.scene.visible = false; prev.mixer.stopAllAction(); }
    this.using = id;
    r.scene.visible = true;
    this.mixer = r.mixer; this.ik = r.ik; this.actions = r.actions; this.throwAction = r.throwAction;
    this.hand = r.hand; this.pintOffset = r.pintOffset; this.pintBone = r.pintBone; this.handL = r.handL;
    this.materials = r.materials; this.hasPint = r.hasPint;
    this.current = undefined;
    this.play('idle', 0);
  }

  /** Mort : animation de chute, la pinte du modèle disparaît. Renvoie la position et l'orientation de la pinte. */
  die(outPos: THREE.Vector3, outQuat: THREE.Quaternion) {
    this.dead = true;
    this.throwAction?.stop();
    this.play('death', 0.08);
    this.kick(-0.15);
    if (this.pintBone) {
      this.root.updateMatrixWorld(true);
      // Centre de la pinte : 12 cm au-dessus de la base de l'os
      this.pintBone.getWorldQuaternion(outQuat);
      outPos.set(0, 0.12, 0).applyQuaternion(outQuat).add(this.pintBone.getWorldPosition(this.tmp));
    }
  }

  /**
   * Geste de lancer de la main gauche, à la vitesse `rate`. Un geste encore dans sa phase d'armé
   * n'est pas relancé (à haute cadence, le bras enchaîne sans repartir de zéro à chaque bouteille).
   */
  throwGesture(rate: number) {
    const a = this.throwAction;
    if (!a || this.dead) return;
    a.timeScale = rate;
    const armed = a.isRunning() && a.time < a.getClip().duration * 0.3;
    if (!armed) a.reset().play();
  }

  /** Position actuelle de la main gauche (monde), d'où partent les bouteilles. */
  leftHandPos(out: THREE.Vector3) {
    this.root.updateMatrixWorld(true);
    if (this.handL) return this.handL.getWorldPosition(out);
    return out.copy(this.root.position).addScaledVector(this.tmp.copy(this.root.position).normalize(), 1.6);
  }

  /** Remet le Buveur debout (nouvelle run). */
  revive() {
    this.dead = false;
    this.pintBone?.scale.setScalar(1);
    this.play('idle', 0);
  }

  /** Gerbe de mousse à un endroit (pinte qui touche le sol). */
  splashAt(pos: THREE.Vector3, count: number) {
    this.splash.emit(pos, this.baseVel.set(0, 0, 0), this.tmp.copy(pos).normalize(), count, [1.5, 3.5], 1.6);
  }

  /** Couleur d'un matériau du modèle (pour la pinte lancée). */
  color(name: string) {
    return this.materials.find((m) => m.name === name)?.color ?? new THREE.Color(1, 1, 1);
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

    if (this.dead) {
      this.mixer.update(dt);
      this.pintBone?.scale.setScalar(0);
      const S = V.squash;
      this.squashVel += (-S.stiffness * this.squash - S.damping * this.squashVel) * dt;
      this.squash += this.squashVel * dt;
      const sy = 1 + this.squash, sxz = 1 / Math.sqrt(Math.max(0.3, sy));
      this.squashGroup.scale.set(sxz, sy, sxz);
      this.lean.rotation.set(0, 0, 0);
      this.splash.update(dt);
      return;
    }

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
    if (this.hand && this.hasPint) {
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
