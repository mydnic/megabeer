import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ZOMBIE_HURT as H, ZOMBIE_MODELS, ZOMBIE_VISUAL as V, type ZombieModel } from '../config/zombies';
import { characterMaterial } from '../render/materials';
import { patchVat, vatUniforms } from '../render/vat';
import { ZOMBIE_STATES as STATES, type BakedClip, type ZombieState, type ZombieTimings } from './zombie';

const urls = import.meta.glob('../assets/quaternius-zombies/*.gltf', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** Un modèle de zombie prêt pour la foule : géométrie fusionnée, matériaux, animations pré-calculées. */
export type ZombieKind = ZombieTimings & {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  depthMaterial: THREE.Material;
};
/**
 * Charge les 4 modèles et pré-calcule leurs animations dans une seule texture (voir render/vat.ts) :
 * pour chaque image, la matrice de chaque os (os animé x inverse de liaison), dans le repère du modèle.
 */
type ModelDef = { clips?: Partial<Record<ZombieState, readonly string[]>> };

export async function loadZombieLibrary() {
  const loader = new GLTFLoader();
  const ids = Object.keys(ZOMBIE_MODELS) as ZombieModel[];
  const fps = V.bakeFps;
  const baked = await Promise.all(ids.map(async (id) => {
    const def = ZOMBIE_MODELS[id];
    const url = Object.entries(urls).find(([p]) => p.endsWith('/' + def.file))?.[1];
    if (!url) throw new Error(`Modèle de zombie introuvable : ${def.file}`);
    const gltf = await loader.loadAsync(url);
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const scale = def.height / (box.max.y - box.min.y);

    // Os utilisés (un emplacement par couple os / inverse de liaison) et géométrie dans le repère du modèle
    const slots: { bone: THREE.Bone; inverse: THREE.Matrix4 }[] = [];
    const geos: THREE.BufferGeometry[] = [];
    let srcMat: THREE.MeshStandardMaterial | undefined;
    root.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      srcMat ??= mesh.material as THREE.MeshStandardMaterial;
      const sk = mesh.skeleton;
      const map = sk.bones.map((bone, i) => {
        const inv = sk.boneInverses[i];
        let s = slots.findIndex((x) => x.bone === bone && x.inverse.equals(inv));
        if (s < 0) { s = slots.length; slots.push({ bone, inverse: inv.clone() }); }
        return s;
      });
      const g = mesh.geometry.clone();
      g.applyMatrix4(mesh.bindMatrix);
      const si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight');
      const idx = new Float32Array(si.count * 4);
      for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) idx[i * 4 + k] = map[si.getComponent(i, k)];
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', g.getAttribute('position'));
      out.setAttribute('normal', g.getAttribute('normal'));
      out.setAttribute('uv', g.getAttribute('uv'));
      out.setAttribute('aSkinIndex', new THREE.Float32BufferAttribute(idx, 4));
      out.setAttribute('aSkinWeight', new THREE.Float32BufferAttribute(Array.from({ length: sw.count * 4 }, (_, j) => sw.getComponent(Math.floor(j / 4), j % 4)), 4));
      if (g.index) out.setIndex(g.index);
      geos.push(out);
    });
    if (!geos.length || !srcMat) throw new Error(`Pas de maillage animé dans ${def.file}`);
    const geometry = geos.length > 1 ? mergeGeometries(geos)! : geos[0];

    // Images de chaque animation
    const rootInv = root.matrixWorld.clone().invert();
    const mixer = new THREE.AnimationMixer(root);
    const m = new THREE.Matrix4();
    const clipRows = {} as Record<ZombieState, { rows: Float32Array[]; duration: number }>;
    for (const state of STATES) {
      // Clips propres au modèle (ex. le Novice court au lieu de marcher), sinon ceux de tous les zombies
      const names: readonly string[] = (def as ModelDef).clips?.[state] ?? V.clips[state];
      const clip = names.map((n) => gltf.animations.find((c) => c.name === n)).find(Boolean);
      if (!clip) throw new Error(`Animation ${state} manquante pour le zombie ${id}`);
      const action = mixer.clipAction(clip);
      action.play();
      const frames = Math.max(1, Math.round(clip.duration * fps));
      const rows: Float32Array[] = [];
      for (let f = 0; f < frames; f++) {
        mixer.setTime(f / fps);
        root.updateMatrixWorld(true);
        const row = new Float32Array(slots.length * 12);
        slots.forEach((s, b) => {
          m.multiplyMatrices(s.bone.matrixWorld, s.inverse).premultiply(rootInv);
          const e = m.elements; // colonnes
          // 3 texels : lignes 0, 1, 2 de la matrice (x, y, z, translation)
          row.set([e[0], e[4], e[8], e[12], e[1], e[5], e[9], e[13], e[2], e[6], e[10], e[14]], b * 12);
        });
        rows.push(row);
      }
      action.stop();
      clipRows[state] = { rows, duration: clip.duration };
    }
    mixer.uncacheRoot(root);
    return { id, geometry, srcMat, scale, bones: slots.length, clipRows };
  }));

  // Texture commune : une ligne par image, 3 texels par os
  const width = Math.max(...baked.map((b) => b.bones)) * 3;
  const height = baked.reduce((n, b) => n + STATES.reduce((k, s) => k + b.clipRows[s].rows.length, 0), 0);
  const data = new Float32Array(width * height * 4);
  const lib = {} as Record<ZombieModel, ZombieKind>;
  let y = 0;
  for (const b of baked) {
    const clips = {} as Record<ZombieState, BakedClip>;
    for (const s of STATES) {
      const c = b.clipRows[s];
      clips[s] = { start: y, frames: c.rows.length, duration: c.duration };
      for (const row of c.rows) { data.set(row, y * width * 4); y++; }
    }
    const material = characterMaterial({ map: b.srcMat.map, color: b.srcMat.color, side: b.srcMat.side });
    patchVat(material, 'zombie', H.flashIntensity);
    const depthMaterial = new THREE.MeshDepthMaterial();
    patchVat(depthMaterial, 'zombie-depth');
    lib[b.id] = { geometry: b.geometry, material, depthMaterial, scale: b.scale, clips };
  }
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  vatUniforms.vatTex.value = tex;
  return lib;
}
export type ZombieLibrary = Awaited<ReturnType<typeof loadZombieLibrary>>;
