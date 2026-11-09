import * as THREE from 'three';
import { kamikazeSwell } from './kamikazeView';
import { ZOMBIE_MODELS, ZOMBIE_VISUAL as V, type ZombieModel } from '../config/zombies';
import { LAYER_CHARACTER } from '../render/materials';
import type { Zombie } from './zombie';
import type { ZombieLibrary } from './zombieLibrary';

/**
 * Rendu de la horde : un seul dessin par modèle (instances animées par la carte graphique, voir
 * render/vat.ts). Recopie à chaque image l'état des zombies de la simulation. Aucune limite de nombre :
 * la place réservée sur la carte graphique s'agrandit quand il le faut.
 */
export function createHordeView(scene: THREE.Scene, lib: ZombieLibrary) {
  /** Une foule par modèle : un dessin instancié, dont la capacité double quand elle est pleine. */
  const makeCrowd = (model: ZombieModel, capacity: number) => {
    const k = lib[model];
    const mesh = new THREE.InstancedMesh(k.geometry, k.material, capacity);
    const anim = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    anim.setUsage(THREE.DynamicDrawUsage);
    k.geometry.setAttribute('aAnim', anim);
    // Opacité propre à chaque instance (fantômes)
    const fade = k.fade ? new THREE.InstancedBufferAttribute(new Float32Array(capacity).fill(1), 1) : null;
    if (fade) { fade.setUsage(THREE.DynamicDrawUsage); k.geometry.setAttribute('aFade', fade); }
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.customDepthMaterial = k.depthMaterial;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false; // les instances couvrent toute la planète
    mesh.layers.set(LAYER_CHARACTER);
    mesh.count = 0;
    scene.add(mesh);
    return { model, mesh, anim, fade, capacity };
  };
  const crowds = (Object.keys(lib) as ZombieModel[]).map((model) => makeCrowd(model, V.initialPerModel));
  const byModel = new Map(crowds.map((c) => [c.model, c]));
  const counts = new Map<ZombieModel, number>();

  /** Agrandit les foules trop petites pour le nombre de zombies de ce modèle. */
  function fit(zombies: readonly Zombie[]) {
    counts.clear();
    for (const z of zombies) counts.set(z.model, (counts.get(z.model) ?? 0) + 1);
    crowds.forEach((c, idx) => {
      const n = counts.get(c.model) ?? 0;
      if (n <= c.capacity) return;
      let capacity = c.capacity;
      while (capacity < n) capacity *= 2;
      scene.remove(c.mesh);
      c.mesh.dispose();
      const bigger = makeCrowd(c.model, capacity);
      crowds[idx] = bigger;
      byModel.set(c.model, bigger);
    });
  }
  /** Les modèles qui flottent (fantôme) : hauteur au-dessus du sol, avec une ondulation propre à chacun. */
  const clock = new THREE.Clock();
  function hover(z: Zombie) {
    const m = ZOMBIE_MODELS[z.model] as { hover?: number; bob?: number; bobSpeed?: number };
    if (!m.hover) return 0;
    return m.hover + (m.bob ?? 0) * Math.sin(clock.getElapsedTime() * (m.bobSpeed ?? 1) + z.speedMul * 40);
  }
  /** Opacité d'une instance translucide : presque effacée quand le fantôme est intouchable. */
  const fades = new WeakMap<Zombie, number>();
  function fadeOf(z: Zombie) {
    const t = (ZOMBIE_MODELS[z.model] as { translucent?: { opacity: number; intangible: number } }).translucent;
    if (!t) return 1;
    const want = z.intangible ? t.intangible / t.opacity : 1;
    // Fondu doux entre les deux états
    const f = THREE.MathUtils.lerp(fades.get(z) ?? want, want, 0.2);
    fades.set(z, f);
    return f;
  }

  const basis = new THREE.Matrix4();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const scaleV = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  return {
    /** Instances : matrice (repère local, taille du modèle) et lignes d'animation de chaque zombie. */
    sync(zombies: readonly Zombie[]) {
      fit(zombies);
      for (const c of crowds) c.mesh.count = 0;
      for (const z of zombies) {
        if (z.gone) continue; // un kamikaze qui vient d'exploser
        const c = byModel.get(z.model)!;
        const i = c.mesh.count++;
        up.copy(z.pos).normalize();
        right.crossVectors(up, z.facing).normalize();
        tmp.copy(z.pos).addScaledVector(up, -z.sink + hover(z));
        basis.makeBasis(right, up, z.facing).scale(scaleV.setScalar(z.kind.scale * kamikazeSwell(z))).setPosition(tmp);
        c.mesh.setMatrixAt(i, basis);
        z.animRows(c.anim.array as Float32Array, i * 4);
        if (c.fade) c.fade.setX(i, fadeOf(z));
      }
      for (const c of crowds) {
        c.mesh.instanceMatrix.clearUpdateRanges();
        c.mesh.instanceMatrix.addUpdateRange(0, c.mesh.count * 16);
        c.mesh.instanceMatrix.needsUpdate = true;
        c.anim.clearUpdateRanges();
        c.anim.addUpdateRange(0, c.mesh.count * 4);
        c.anim.needsUpdate = true;
        if (c.fade) { c.fade.clearUpdateRanges(); c.fade.addUpdateRange(0, c.mesh.count); c.fade.needsUpdate = true; }
      }
    },
  };
}
