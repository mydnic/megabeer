import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ZOMBIE_MODELS, ZOMBIE_MOVE, ZOMBIE_VISUAL as V, type ZombieModel } from '../config/zombies';
import { characterMaterial, LAYER_CHARACTER } from '../render/materials';

const urls = import.meta.glob('../assets/quaternius-zombies/*.gltf', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

type Template = { scene: THREE.Object3D; clips: THREE.AnimationClip[]; scale: number };
export type ZombieState = 'idle' | 'walk' | 'attack' | 'hit';

/**
 * Charge les modèles de zombie une fois : matériaux passés en cel-shading (texture atlas gardée),
 * couche des objets contourés, taille normalisée.
 */
export async function loadZombieLibrary() {
  const lib = {} as Record<ZombieModel, Template>;
  const loader = new GLTFLoader();
  await Promise.all((Object.keys(ZOMBIE_MODELS) as ZombieModel[]).map(async (id) => {
    const def = ZOMBIE_MODELS[id];
    const url = Object.entries(urls).find(([p]) => p.endsWith('/' + def.file))?.[1];
    if (!url) throw new Error(`Modèle de zombie introuvable : ${def.file}`);
    const gltf = await loader.loadAsync(url);
    const mats = new Map<THREE.Material, THREE.Material>();
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as THREE.MeshStandardMaterial;
      let m = mats.get(src);
      if (!m) {
        m = characterMaterial({ map: src.map, color: src.color, side: src.side });
        mats.set(src, m);
      }
      mesh.material = m;
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      mesh.layers.set(LAYER_CHARACTER);
      mesh.frustumCulled = false; // la sphère englobante ne suit pas les os
    });
    const box = new THREE.Box3().setFromObject(gltf.scene);
    lib[id] = { scene: gltf.scene, clips: gltf.animations, scale: def.height / (box.max.y - box.min.y) };
  }));
  return lib;
}
export type ZombieLibrary = Awaited<ReturnType<typeof loadZombieLibrary>>;

/** Un zombie animé, posé sur la planète (position et orientation données par la simulation). */
export class Zombie {
  readonly root = new THREE.Group();
  /** Position (pieds) et direction du regard, dans le repère du monde. */
  readonly pos = new THREE.Vector3();
  readonly facing = new THREE.Vector3();
  state: ZombieState = 'idle';
  /** Multiplicateur de vitesse propre à ce zombie (ils ne marchent pas tous pareil). */
  readonly speedMul = 1 + (Math.random() * 2 - 1) * ZOMBIE_MOVE.speedJitter;
  /** Contournement d'obstacle en cours : temps restant et côté. */
  detour = 0;
  detourSide = 1;
  /** Vitesse réelle au dernier pas (cale la cadence de l'animation de marche). */
  walkSpeed = 0;
  private animSpeed = 1;
  private mixer: THREE.AnimationMixer;
  private actions = {} as Record<ZombieState, THREE.AnimationAction>;
  private current?: ZombieState;
  private basis = new THREE.Matrix4();
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();

  constructor(scene: THREE.Scene, lib: ZombieLibrary, readonly model: ZombieModel) {
    const t = lib[model];
    const body = cloneSkinned(t.scene);
    body.scale.setScalar(t.scale);
    this.root.add(body);
    scene.add(this.root);
    this.mixer = new THREE.AnimationMixer(body);
    const speed = this.animSpeed = 1 + (Math.random() * 2 - 1) * V.animJitter;
    for (const state of Object.keys(V.clips) as ZombieState[]) {
      const clip = V.clips[state].map((n) => t.clips.find((c) => c.name === n)).find(Boolean);
      if (!clip) throw new Error(`Animation ${state} manquante pour le zombie ${model}`);
      const a = this.mixer.clipAction(clip);
      a.timeScale = speed;
      if (state === 'hit') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      this.actions[state] = a;
    }
    this.mixer.update(Math.random() * 2); // départ décalé
    this.play('idle');
  }

  play(state: ZombieState) {
    if (this.current === state) return;
    const next = this.actions[state];
    next.reset().play();
    if (this.current) this.actions[this.current].crossFadeTo(next, V.fade, false);
    this.current = state;
    this.state = state;
  }

  /** Tourne progressivement vers une cible, dans le plan tangent. */
  turnToward(target: THREE.Vector3, dt: number) {
    const up = this.up.copy(this.pos).normalize();
    const want = this.right.subVectors(target, this.pos);
    want.addScaledVector(up, -want.dot(up));
    if (want.lengthSq() < 1e-6) return;
    want.normalize();
    const k = 1 - Math.exp(-V.turnRate * dt);
    this.facing.lerp(want, k).addScaledVector(up, -this.facing.dot(up)).normalize();
  }

  update(dt: number) {
    // Cadence des pas calée sur la vitesse réelle : les pieds ne patinent pas
    if (this.state === 'walk') this.actions.walk.timeScale = Math.max(0.3, this.walkSpeed / ZOMBIE_MOVE.walkAnimAt);
    else this.actions.walk.timeScale = this.animSpeed;
    this.mixer.update(dt);
    const up = this.up.copy(this.pos).normalize();
    this.right.crossVectors(up, this.facing).normalize();
    this.root.position.copy(this.pos);
    this.root.quaternion.setFromRotationMatrix(this.basis.makeBasis(this.right, up, this.facing));
  }
}
