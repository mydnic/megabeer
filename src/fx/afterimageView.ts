import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { SAIYAN_LOOK } from '../config/saiyan';
import { LAYER_SKY } from '../render/materials';

/**
 * Une copie du perso : son squelette (dans l'ordre du modèle), ses matières (et leur couleur d'origine), le modèle
 * qu'elle double, son âge (s), son côté (1 à droite, -1 à gauche), son rang (0 : collée au perso, 1 : un peu plus loin).
 */
type Ghost = {
  root: THREE.Object3D; bones: THREE.Object3D[]; materials: { m: THREE.MeshToonMaterial; base: THREE.Color }[];
  model: THREE.Object3D | null; src: THREE.Object3D[]; age: number; dir: number; rank: number; live: boolean;
};

/**
 * Images rémanentes de l'Ultra Instinct : à chaque esquive, le perso « vibre » un instant. Des copies translucides le
 * suivent, collées à lui, dans sa pose de chaque image, et tremblent très vite d'un côté et de l'autre, comme s'il
 * esquivait à une vitesse folle ; elles s'effacent en un éclair. Copies faites une fois par modèle, puis réutilisées.
 */
export function createAfterimageView(scene: THREE.Scene) {
  const L = SAIYAN_LOOK.afterimage;
  const pools = new Map<THREE.Object3D, Ghost[]>();
  const tint = new THREE.Color();
  const tmpM = new THREE.Matrix4(), off = new THREE.Vector3(), up = new THREE.Vector3(), side = new THREE.Vector3(), fwd = new THREE.Vector3();
  const feet = new THREE.Vector3(), facing = new THREE.Vector3();

  const ghostsOf = (model: THREE.Object3D) => {
    let pool = pools.get(model);
    if (pool) return pool;
    pool = [];
    for (let i = 0; i < L.count; i++) {
      const root = cloneSkinned(model);
      // Les couleurs du perso, translucides, teintées à chaque esquive
      const materials: Ghost['materials'] = [];
      const made = new Map<THREE.Material, THREE.MeshToonMaterial>();
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          const src = m.material as THREE.MeshToonMaterial;
          let c = made.get(src);
          if (!c) {
            c = src.clone();
            c.transparent = true; c.opacity = 0; c.depthWrite = false;
            made.set(src, c);
            materials.push({ m: c, base: src.color.clone() });
          }
          m.material = c; m.castShadow = false; m.frustumCulled = false;
          // Dessinées après l'aura (qui les noyait dans sa lueur)
          m.renderOrder = 5;
        }
        o.layers.set(LAYER_SKY);
      });
      root.matrixAutoUpdate = false;
      root.visible = false;
      scene.add(root);
      const bones: THREE.Object3D[] = [];
      root.traverse((o) => bones.push(o));
      pool.push({ root, bones, materials, model: null, src: [], age: 0, dir: i % 2 === 0 ? 1 : -1, rank: Math.floor(i / 2), live: false });
    }
    pools.set(model, pool);
    return pool;
  };

  let shake = 0;
  return {
    /**
     * Le tremblement du perso lui-même à cette image (m, sur le côté ; 0 hors esquive) : le rendu l'ajoute à sa position.
     */
    shake(out: THREE.Vector3) {
      return out.copy(side).multiplyScalar(shake);
    },
    /** Une esquive : les copies du perso `model` se mettent à vibrer autour de lui, teintées de `color`. */
    spawn(model: THREE.Object3D, color: number) {
      const src: THREE.Object3D[] = [];
      model.traverse((o) => src.push(o));
      for (const g of ghostsOf(model)) {
        g.model = model;
        g.src = src;
        g.age = 0;
        g.live = true;
        g.root.visible = true;
        for (const { m, base } of g.materials) m.color.copy(base).lerp(tint.set(L.color ?? color), L.tint);
      }
    },
    /** Chaque image : les copies reprennent la pose du perso, tremblent autour de lui et s'effacent. `feet`, `dir` : le joueur. */
    update(dt: number, playerFeet: THREE.Vector3, playerFacing: THREE.Vector3) {
      feet.copy(playerFeet);
      facing.copy(playerFacing);
      up.copy(feet).normalize();
      side.crossVectors(up, facing).normalize();
      fwd.copy(facing);
      shake = 0;
      for (const pool of pools.values()) {
        for (const g of pool) {
          if (!g.live || !g.model) continue;
          g.age += dt;
          const k = g.age / L.life;
          if (k >= 1) { g.live = false; g.root.visible = false; continue; }
          if (g.rank === 0 && g.dir === 1) shake = (Math.random() * 2 - 1) * L.selfJitter * (1 - k);
          // Pose du perso à cette image
          for (let i = 0; i < g.src.length && i < g.bones.length; i++) {
            g.bones[i].position.copy(g.src[i].position);
            g.bones[i].quaternion.copy(g.src[i].quaternion);
            g.bones[i].scale.copy(g.src[i].scale);
          }
          // Tremblement : un écart au hasard à chaque image, de son côté, qui se resserre en s'effaçant
          const reach = (L.offset * (1 + g.rank) * (0.65 + 0.35 * Math.random())) * (1 - 0.4 * k);
          off.copy(side).multiplyScalar(g.dir * reach).addScaledVector(fwd, (Math.random() - 0.5) * L.jitter);
          g.model.updateWorldMatrix(true, false);
          g.root.matrix.copy(tmpM.makeTranslation(off.x, off.y, off.z).multiply(g.model.matrixWorld));
          g.root.matrixWorldNeedsUpdate = true;
          // Elles scintillent en s'effaçant ; le second rang est plus pâle
          const a = L.opacity * (1 - k) * (0.6 + 0.4 * Math.random()) * (g.rank ? 0.55 : 1);
          for (const { m } of g.materials) m.opacity = a;
        }
      }
    },
  };
}
