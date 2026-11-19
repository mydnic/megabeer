import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { SAIYAN_LOOK } from '../config/saiyan';
import { LAYER_SKY } from '../render/materials';

/** Une image rémanente : la copie du perso, sa matière, son âge (s), où elle part (décalage par seconde, m). */
type Ghost = { root: THREE.Object3D; bones: THREE.Object3D[]; materials: { m: THREE.MeshToonMaterial; base: THREE.Color }[]; age: number; drift: THREE.Vector3; live: boolean };

/**
 * Images rémanentes de l'Ultra Instinct : à chaque esquive, des copies translucides du perso, figées dans sa pose du
 * moment, restent un instant de part et d'autre de lui et s'effacent en glissant, comme s'il avait esquivé à une vitesse
 * folle. Les copies sont faites une fois par modèle, puis réutilisées.
 */
export function createAfterimageView(scene: THREE.Scene) {
  const L = SAIYAN_LOOK.afterimage;
  const pools = new Map<THREE.Object3D, Ghost[]>();
  const tint = new THREE.Color();
  const tmpM = new THREE.Matrix4(), off = new THREE.Vector3(), up = new THREE.Vector3(), side = new THREE.Vector3();

  const ghostsOf = (model: THREE.Object3D) => {
    let pool = pools.get(model);
    if (pool) return pool;
    pool = [];
    for (let i = 0; i < L.count * 2; i++) {
      const root = cloneSkinned(model);
      // Les couleurs du perso, translucides (teintées de l'aura à chaque esquive)
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
        }
        o.layers.set(LAYER_SKY);
      });
      root.matrixAutoUpdate = false;
      root.visible = false;
      scene.add(root);
      const bones: THREE.Object3D[] = [];
      root.traverse((o) => bones.push(o));
      pool.push({ root, bones, materials, age: 0, drift: new THREE.Vector3(), live: false });
    }
    pools.set(model, pool);
    return pool;
  };

  return {
    /** Une esquive : `L.count` copies du perso `model` (dans sa pose du moment), de part et d'autre, de la couleur `color`. */
    spawn(model: THREE.Object3D, feet: THREE.Vector3, facing: THREE.Vector3, color: number) {
      const pool = ghostsOf(model);
      const src: THREE.Object3D[] = [];
      model.traverse((o) => src.push(o));
      up.copy(feet).normalize();
      side.crossVectors(up, facing).normalize();
      model.updateWorldMatrix(true, false);
      for (let i = 0; i < L.count; i++) {
        const g = pool.find((p) => !p.live);
        if (!g) return;
        // Même pose que le perso au moment de l'esquive
        for (let k = 0; k < src.length && k < g.bones.length; k++) {
          g.bones[k].position.copy(src[k].position);
          g.bones[k].quaternion.copy(src[k].quaternion);
          g.bones[k].scale.copy(src[k].scale);
        }
        const dir = i % 2 === 0 ? 1 : -1, reach = L.offset * (1 + Math.floor(i / 2) * 0.7);
        off.copy(side).multiplyScalar(dir * reach).addScaledVector(facing, -L.back);
        g.root.matrix.copy(tmpM.makeTranslation(off.x, off.y, off.z).multiply(model.matrixWorld));
        g.root.matrixWorldNeedsUpdate = true;
        for (let k = 1; k < g.bones.length; k++) g.bones[k].updateMatrix();
        g.drift.copy(side).multiplyScalar(dir * L.drift);
        for (const { m, base } of g.materials) m.color.copy(base).lerp(tint.set(L.color ?? color), L.tint);
        g.age = 0;
        g.live = true;
        g.root.visible = true;
      }
    },
    /** Chaque image : les copies glissent et s'effacent. */
    update(dt: number) {
      for (const pool of pools.values()) {
        for (const g of pool) {
          if (!g.live) continue;
          g.age += dt;
          const k = g.age / L.life;
          if (k >= 1) { g.live = false; g.root.visible = false; continue; }
          const a = L.opacity * (1 - k) * (1 - k);
          for (const { m } of g.materials) m.opacity = a;
          g.root.matrix.premultiply(tmpM.makeTranslation(g.drift.x * dt, g.drift.y * dt, g.drift.z * dt));
          g.root.matrixWorldNeedsUpdate = true;
        }
      }
    },
  };
}
