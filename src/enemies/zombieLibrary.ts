import { ELITES } from '../config/elites';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ZOMBIE_HURT as H, ZOMBIE_MODELS, ZOMBIE_VISUAL as V, type ZombieModel } from '../config/zombies';
import kenneyColormap from '../assets/kenney-graveyard-kit/Models/GLB format/Textures/colormap.png?url';
import { PROTECTOR_LOOK } from '../config/enemies';
import { characterMaterial } from '../render/materials';
import { patchVat, vatUniforms } from '../render/vat';
import { ZOMBIE_STATES as STATES, type BakedClip, type ZombieState, type ZombieTimings } from './zombie';

// Zombies Quaternius d'origine, le Moine préparé par tools/blender/monk.py, personnages Kenney du cimetière
const urls = import.meta.glob([
  '../assets/quaternius-zombies/*.gltf', '../assets/models/moine*.glb', '../assets/models/porte_reliques.glb', '../assets/models/gargouille.glb', '../assets/models/prieur.glb', '../assets/models/squelette.glb',
  '../assets/kenney-graveyard-kit/Models/GLB format/character-*.glb',
], { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** Un modèle de zombie prêt pour la foule : géométrie fusionnée, matériaux, animations pré-calculées. */
export type ZombieKind = ZombieTimings & {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  depthMaterial: THREE.Material;
  /** Translucide (fantôme) : chaque instance a sa propre opacité (attribut aFade). */
  fade: boolean;
};
/**
 * Charge les modèles et pré-calcule leurs animations dans une seule texture (voir render/vat.ts) :
 * pour chaque image, la matrice de chaque os (os animé x inverse de liaison), dans le repère du modèle.
 */
type ModelDef = { clips?: Partial<Record<ZombieState, readonly string[]>>; translucent?: { opacity: number } };

export async function loadZombieLibrary() {
  // Les modèles Kenney vont chercher leur texture à côté d'eux : on leur donne la bonne adresse
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((u) => (u.endsWith('colormap.png') ? kenneyColormap : u));
  const loader = new GLTFLoader(manager);
  // Les modèles dessinés à part (boss) ne passent pas par la foule
  const ids = (Object.keys(ZOMBIE_MODELS) as ZombieModel[]).filter((id) => !(ZOMBIE_MODELS[id] as { separate?: boolean }).separate);
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
    const rootInvRest = root.matrixWorld.clone().invert();
    root.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isMesh) return;
      srcMat ??= mesh.material as THREE.MeshStandardMaterial;
      if (!mesh.isSkinnedMesh) {
        // Pièce rigide animée (personnages Kenney) : elle sert d'os à elle seule
        const s = slots.length;
        slots.push({ bone: mesh as unknown as THREE.Bone, inverse: mesh.matrixWorld.clone().invert().multiply(root.matrixWorld) });
        const g = mesh.geometry.clone();
        g.applyMatrix4(rootInvRest.clone().multiply(mesh.matrixWorld));
        const n = g.getAttribute('position').count;
        const out = new THREE.BufferGeometry();
        out.setAttribute('position', g.getAttribute('position'));
        out.setAttribute('normal', g.getAttribute('normal'));
        out.setAttribute('uv', g.getAttribute('uv'));
        out.setAttribute('aSkinIndex', new THREE.Float32BufferAttribute(Array.from({ length: n * 4 }, (_, j) => (j % 4 === 0 ? s : 0)), 4));
        out.setAttribute('aSkinWeight', new THREE.Float32BufferAttribute(Array.from({ length: n * 4 }, (_, j) => (j % 4 === 0 ? 1 : 0)), 4));
        if (g.index) out.setIndex(g.index);
        geos.push(out);
        return;
      }
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
      const find = (list: readonly string[]) => list.map((n) => gltf.animations.find((c) => c.name === n)).find(Boolean);
      // Le geste d'invocation est facultatif : sans lui, le modèle reprend son attaque
      const clip = find(names) ?? (state === 'cast' ? find((def as ModelDef).clips?.attack ?? V.clips.attack) : undefined);
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
    const translucent = (ZOMBIE_MODELS[b.id] as ModelDef).translucent;
    const material = characterMaterial({
      map: b.srcMat.map, color: b.srcMat.color, side: b.srcMat.side,
      ...(translucent ? { transparent: true, opacity: translucent.opacity, depthWrite: false } : {}),
    });
    patchVat(material, translucent ? 'zombie-fade-glow' : 'zombie-glow', H.flashIntensity, !!translucent, new THREE.Color(PROTECTOR_LOOK.color), PROTECTOR_LOOK.rimPower, new THREE.Color(ELITES.color));
    const depthMaterial = new THREE.MeshDepthMaterial();
    patchVat(depthMaterial, 'zombie-depth');
    lib[b.id] = { geometry: b.geometry, material, depthMaterial, scale: b.scale, clips, fade: !!translucent };
  }
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  vatUniforms.vatTex.value = tex;
  return lib;
}
export type ZombieLibrary = Awaited<ReturnType<typeof loadZombieLibrary>>;
