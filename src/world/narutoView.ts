import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { NARUTO, NARUTO_LOOK as L } from '../config/naruto';
import type { Naruto } from '../game/naruto';
import { characterMaterial, LAYER_CHARACTER } from '../render/materials';
import { withNormals } from '../render/meshPrep';

const urls = import.meta.glob('../assets/models/*.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const url = Object.entries(urls).find(([k]) => k.endsWith(`/${NARUTO.file}`))?.[1];

/**
 * Naruto à l'écran : le modèle en cel-shading comme les personnages, sa course bras en arrière quand il file, son repos
 * quand il souffle. Caché hors run et une fois attrapé (la fumée, c'est `app/effects.ts`).
 */
export async function createNarutoView(scene: THREE.Scene) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  let mixer: THREE.AnimationMixer | null = null;
  let idle: THREE.AnimationAction | null = null, run: THREE.AnimationAction | null = null;
  if (url) {
    const gltf = await new GLTFLoader().loadAsync(url);
    const model = gltf.scene;
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry = withNormals(m.geometry);
      const src = m.material as THREE.MeshStandardMaterial;
      m.material = characterMaterial({ color: src.color, map: src.map ?? null, alphaTest: src.alphaTest || (src.transparent ? 0.5 : 0), side: src.side });
      m.castShadow = true;
      m.layers.set(LAYER_CHARACTER);
      m.frustumCulled = false;
    });
    root.add(model);
    mixer = new THREE.AnimationMixer(model);
    const clip = (name: string) => gltf.animations.find((a) => a.name === name);
    const i = clip('idle'), r = clip('run');
    if (i) { idle = mixer.clipAction(i); idle.play(); }
    if (r) { run = mixer.clipAction(r); run.setEffectiveWeight(0); run.play(); }
  }

  const up = new THREE.Vector3(), right = new THREE.Vector3(), basis = new THREE.Matrix4();
  let moving = false;
  return {
    /** Chaque image : Naruto à sa place, en course ou au repos. */
    sync(naruto: Naruto, inRun: boolean, dt: number) {
      const on = inRun && !!naruto.pos && naruto.state !== 'gone';
      root.visible = on;
      if (!on) return;
      up.copy(naruto.pos!).normalize();
      right.crossVectors(up, naruto.facing).normalize();
      root.position.copy(naruto.pos!);
      root.quaternion.setFromRotationMatrix(basis.makeBasis(right, up, naruto.facing));
      const now = naruto.speed > 0.5;
      if (now !== moving) {
        moving = now;
        run?.setEffectiveWeight(moving ? 1 : 0);
        idle?.setEffectiveWeight(moving ? 0 : 1);
      }
      run?.setEffectiveTimeScale(L.runRate * naruto.speed / NARUTO.speed || L.runRate);
      mixer?.update(dt);
    },
  };
}
