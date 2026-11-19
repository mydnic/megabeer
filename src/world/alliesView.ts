import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ALLIES, ALLY_LOOK as L, type AllyId } from '../config/allies';
import type { Allies } from '../game/allies';
import { characterMaterial, LAYER_CHARACTER, LAYER_SKY } from '../render/materials';
import { withNormals } from '../render/meshPrep';

const urls = import.meta.glob('../assets/models/*.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** Un allié affiché : son modèle, son mixeur et ses clips (repos, pouvoir), sa colonne de lumière quand il attend. */
type Shown = { root: THREE.Group; mixer: THREE.AnimationMixer | null; idle: THREE.AnimationAction | null; power: THREE.AnimationAction | null; beam: THREE.Mesh };

/**
 * Les alliés (issue #18) : chacun à sa place, en cel-shading comme les personnages. Il attend dans son abbaye sous une
 * colonne de lumière (pour le trouver) ; il suit le joueur en sautillant ; il joue son geste de pouvoir quand il l'use.
 */
export async function createAlliesView(scene: THREE.Scene) {
  const kinds = Object.keys(ALLIES) as AllyId[];
  const shown = new Map<AllyId, Shown>();
  const beamGeo = new THREE.CylinderGeometry(L.beamRadius * 0.6, L.beamRadius, L.beamHeight, 16, 1, true).translate(0, L.beamHeight / 2, 0);
  for (const kind of kinds) {
    const D = ALLIES[kind];
    const url = Object.entries(urls).find(([k]) => k.endsWith(`/${D.file}`))?.[1];
    if (!url) continue;
    const gltf = await new GLTFLoader().loadAsync(url);
    const model = gltf.scene;
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry = withNormals(m.geometry);
      const src = m.material as THREE.MeshStandardMaterial;
      m.material = characterMaterial({ color: src.color, map: src.map ?? null });
      m.castShadow = true;
      m.layers.set(LAYER_CHARACTER);
      m.frustumCulled = false;
    });
    const root = new THREE.Group();
    root.add(model);
    root.visible = false;
    scene.add(root);
    let mixer: THREE.AnimationMixer | null = null, idle: THREE.AnimationAction | null = null, power: THREE.AnimationAction | null = null;
    if (gltf.animations.length) {
      mixer = new THREE.AnimationMixer(model);
      const i = gltf.animations.find((a) => a.name === 'idle'), p = gltf.animations.find((a) => a.name === 'staff');
      if (i) { idle = mixer.clipAction(i); idle.play(); }
      if (p) { power = mixer.clipAction(p); power.setLoop(THREE.LoopOnce, 1); power.clampWhenFinished = false; }
      mixer.addEventListener('finished', () => { power?.fadeOut(0.15); idle?.reset().fadeIn(0.15).play(); });
    }
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: L.beamColor, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.layers.set(LAYER_SKY);
    beam.visible = false;
    scene.add(beam);
    shown.set(kind, { root, mixer, idle, power, beam });
  }

  const up = new THREE.Vector3(), right = new THREE.Vector3(), basis = new THREE.Matrix4();
  let t = 0;
  return {
    /** Un allié use de son pouvoir : il joue son geste. */
    power(kind: AllyId) {
      const s = shown.get(kind);
      if (!s?.power) return;
      s.idle?.fadeOut(0.1);
      s.power.reset().setEffectiveTimeScale(L.powerRate).fadeIn(0.1).play();
    },
    /** Chaque image : chaque allié à sa place (caché hors run ou une fois parti). */
    sync(allies: Allies, inRun: boolean, dt: number) {
      t += dt;
      for (const [kind, s] of shown) {
        const a = inRun ? allies.list.find((x) => x.kind === kind) : undefined;
        const on = !!a && a.state !== 'gone';
        s.root.visible = on;
        s.beam.visible = on && a!.state === 'waiting';
        if (!on || !a) continue;
        up.copy(a.pos).normalize();
        right.crossVectors(up, a.facing).normalize();
        s.root.position.copy(a.pos);
        // En marche, il sautille un peu ; à l'arrêt, il respire
        const hop = a.speed > 0.5 ? Math.abs(Math.sin(t * L.hopRate)) * L.hop : Math.sin(t * 2) * 0.01;
        s.root.position.addScaledVector(up, hop);
        s.root.quaternion.setFromRotationMatrix(basis.makeBasis(right, up, a.facing));
        s.mixer?.update(dt);
        if (s.beam.visible) {
          s.beam.position.copy(a.pos);
          s.beam.quaternion.copy(s.root.quaternion);
          (s.beam.material as THREE.MeshBasicMaterial).opacity = 0.22 + 0.08 * Math.sin(t * 3);
        }
      }
    },
  };
}
