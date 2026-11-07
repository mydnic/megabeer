import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ZOMBIE_ATTACK, ZOMBIE_MODELS, ZOMBIE_MOVE, ZOMBIE_VISUAL as V, type ZombieModel } from '../config/zombies';
import { characterMaterial } from '../render/materials';
import { patchVat, vatUniforms } from '../render/vat';

const urls = import.meta.glob('../assets/quaternius-zombies/*.gltf', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

export type ZombieState = 'idle' | 'walk' | 'attack' | 'hit';
const STATES = Object.keys(V.clips) as ZombieState[];

/** Une animation pré-calculée : première ligne dans la texture, nombre d'images, durée (s). */
type BakedClip = { start: number; frames: number; duration: number };

/** Un modèle de zombie prêt pour la foule : géométrie fusionnée, matériaux, animations pré-calculées. */
export type ZombieKind = {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  depthMaterial: THREE.Material;
  scale: number;
  clips: Record<ZombieState, BakedClip>;
};

/**
 * Charge les 4 modèles et pré-calcule leurs animations dans une seule texture (voir render/vat.ts) :
 * pour chaque image, la matrice de chaque os (os animé x inverse de liaison), dans le repère du modèle.
 */
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
      const clip = V.clips[state].map((n) => gltf.animations.find((c) => c.name === n)).find(Boolean);
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
    patchVat(material, 'zombie');
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

/**
 * Un zombie : état de simulation et d'animation. Son rendu est fait par la foule (horde), qui lit
 * `animRows()` pour la carte graphique.
 */
export class Zombie {
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
  /** Vrai pendant la frame où le coup arrive (le bras touche la cible). */
  hitNow = false;
  /** Vrai quand le coup en cours est allé au bout de son animation (il peut changer d'état). */
  attackDone = true;
  /** Temps passé dans l'état courant (évite les allers-retours marche / arrêt). */
  stateTime = 0;
  private animSpeed = 1 + (Math.random() * 2 - 1) * V.animJitter;
  /** Temps dans l'animation courante, et dans la précédente (fondu). */
  private time = Math.random() * 3;
  private prevState: ZombieState = 'idle';
  private prevTime = 0;
  private fade = 1;
  private up = new THREE.Vector3();
  private tmp = new THREE.Vector3();

  constructor(readonly kind: ZombieKind, readonly model: ZombieModel) {}

  play(state: ZombieState) {
    if (this.state === state) return;
    this.prevState = this.state;
    this.prevTime = this.time;
    this.fade = 0;
    this.state = state;
    this.time = 0;
    this.stateTime = 0;
    if (state === 'attack') this.attackDone = false;
  }

  /** Tourne progressivement vers une cible, dans le plan tangent. */
  turnToward(target: THREE.Vector3, dt: number) {
    const up = this.up.copy(this.pos).normalize();
    const want = this.tmp.subVectors(target, this.pos);
    want.addScaledVector(up, -want.dot(up));
    if (want.lengthSq() < 1e-6) return;
    want.normalize();
    const k = 1 - Math.exp(-V.turnRate * dt);
    this.facing.lerp(want, k).addScaledVector(up, -this.facing.dot(up)).normalize();
  }

  update(dt: number) {
    // Cadence des pas calée sur la vitesse réelle : les pieds ne patinent pas
    const rate = this.state === 'walk' ? Math.max(0.3, this.walkSpeed / ZOMBIE_MOVE.walkAnimAt) : this.animSpeed;
    const c = this.kind.clips[this.state];
    const before = (this.time % c.duration) / c.duration;
    this.time += dt * rate;
    this.prevTime += dt * this.animSpeed;
    this.fade = Math.min(1, this.fade + dt / V.fade);
    this.stateTime += dt;
    // Moment du coup : passage de la phase de l'attaque sur hitAt ; fin de cycle = coup terminé
    this.hitNow = false;
    if (this.state === 'attack') {
      const after = (this.time % c.duration) / c.duration;
      const h = ZOMBIE_ATTACK.hitAt;
      const wrapped = after < before;
      if ((before < h && after >= h) || (wrapped && (after >= h || before < h))) this.hitNow = true;
      if (wrapped) this.attackDone = true;
    }
  }

  private row(state: ZombieState, t: number) {
    const c = this.kind.clips[state];
    return c.start + (Math.floor((t / c.duration) * c.frames) % c.frames);
  }

  /** (ligne A, ligne B, mélange) pour le shader : fondu de l'animation précédente vers la courante. */
  animRows(out: Float32Array, o: number) {
    const cur = this.row(this.state, this.time);
    if (this.fade >= 1) { out[o] = cur; out[o + 1] = cur; out[o + 2] = 0; }
    else { out[o] = this.row(this.prevState, this.prevTime); out[o + 1] = cur; out[o + 2] = this.fade; }
    out[o + 3] = 0;
  }
}
