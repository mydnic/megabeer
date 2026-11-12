import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import fallbackUrl from '../assets/models/mort_repli.glb?url';
import { CLOSING, REAPER_LOOK as L } from '../config/closing';
import type { Reaper } from '../game/closing';
import { characterMaterial, LAYER_CHARACTER } from '../render/materials';

/**
 * Le modèle de la Mort (« Stylized Death » de Gizart, Fab) n'est pas versionné : sa licence n'en permet pas la
 * diffusion en fichier libre, et le dépôt est public. Il est préparé en local par tools/blender/mort.py dans
 * src/assets/private/ (ignoré par git). Sans lui, le Grim Reaper de Falibu (fixe, sans animation) le remplace.
 */
const PRIVATE = import.meta.glob('../assets/private/mort.glb', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

type Instance = { root: THREE.Group; mixer: THREE.AnimationMixer | null; actions: Map<string, THREE.AnimationAction>; current: THREE.AnimationAction | null; shown: string };

/**
 * Rendu des Morts de la fermeture : une copie animée du modèle par Mort (8 au plus), en cel-shading avec sa texture et
 * la lueur bleue de ses yeux, posée et tournée comme la simulation le dit.
 */
export async function createReaperView(scene: THREE.Scene) {
  const url = Object.values(PRIVATE)[0] ?? fallbackUrl;
  const animated = url !== fallbackUrl;
  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  const mats = new Map<THREE.Material, THREE.MeshToonMaterial>();
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.MeshStandardMaterial;
    let m = mats.get(src);
    if (!m) {
      m = characterMaterial({ color: src.map ? 0xffffff : src.color, map: src.map ?? null });
      if (src.emissiveMap) { m.emissiveMap = src.emissiveMap; m.emissive.setHex(L.emissive); m.emissiveIntensity = L.emissiveIntensity; }
      mats.set(src, m);
    }
    mesh.material = m;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.layers.set(LAYER_CHARACTER);
    mesh.frustumCulled = false;
  });
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const scale = CLOSING.height / (box.max.y - box.min.y);
  const lift = -box.min.y * scale;

  const pool: Instance[] = [];
  function instance(i: number) {
    if (pool[i]) return pool[i];
    const copy = animated ? cloneSkinned(model) : model.clone();
    if (!animated) copy.rotation.y = L.fallbackTurn;
    const holder = new THREE.Group();
    holder.scale.setScalar(scale);
    holder.position.y = lift;
    holder.add(copy);
    const root = new THREE.Group();
    root.add(holder);
    scene.add(root);
    const mixer = animated ? new THREE.AnimationMixer(copy) : null;
    const actions = new Map<string, THREE.AnimationAction>();
    if (mixer) for (const clip of gltf.animations) {
      const a = mixer.clipAction(clip);
      if (clip.name === 'spawn') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      actions.set(clip.name, a);
    }
    return (pool[i] = { root, mixer, actions, current: null, shown: '' });
  }

  const up = new THREE.Vector3(), side = new THREE.Vector3(), fwd = new THREE.Vector3(), basis = new THREE.Matrix4();
  let time = 0;

  return {
    /** Recopie les Morts ; `dt` : temps de jeu écoulé (0 : figé). */
    sync(reapers: readonly Reaper[], dt: number) {
      time += dt;
      for (let i = 0; i < Math.max(reapers.length, pool.length); i++) {
        const r = reapers[i];
        if (!r) { if (pool[i]) pool[i].root.visible = false; continue; }
        const it = instance(i);
        it.root.visible = true;
        up.copy(r.pos).normalize();
        side.crossVectors(up, r.facing).normalize();
        fwd.crossVectors(side, up);
        basis.makeBasis(side, up, fwd);
        it.root.quaternion.setFromRotationMatrix(basis);
        it.root.position.copy(r.pos);
        // Elle sort de terre, puis flotte doucement
        const k = r.state === 'rise' ? Math.min(1, r.t / CLOSING.rise) : 1;
        it.root.position.addScaledVector(up, (1 - (1 - k) * (1 - k) - 1) * CLOSING.height + Math.sin(time * L.bobSpeed + i) * L.bob);
        if (it.mixer) {
          if (it.shown !== r.anim) {
            it.shown = r.anim;
            const next = it.actions.get(r.anim);
            if (next) {
              next.reset().setEffectiveWeight(1).play();
              if (it.current) next.crossFadeFrom(it.current, 0.2, false);
              it.current = next;
            }
          }
          if (it.current) it.current.timeScale = r.anim === 'walk' ? Math.max(0.6, r.speed / L.walkSpeed) : 1;
          it.mixer.update(dt);
        } else {
          // Modèle de repli, fixe : il se penche pour frapper
          if (r.state === 'swing') it.root.rotateX(Math.sin(Math.min(1, r.t / CLOSING.duration) * Math.PI) * 0.6);
        }
      }
    },
  };
}
