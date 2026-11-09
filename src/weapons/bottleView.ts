import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CANETTE_LOOK } from '../config/weapons';
import { characterMaterial, LAYER_CHARACTER } from '../render/materials';
import type { Projectile } from './weapon';

const urls = import.meta.glob(['../assets/quaternius-food-pack/*.glb', '../assets/models/bouteille_*.glb', '../assets/models/canette.glb', '../assets/models/fut.glb'], { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/**
 * Rendu des bouteilles en vol : un modèle par projectile actif (réserve réutilisée), orienté selon
 * la verticale au lancer puis tourné sur lui-même au fil du vol. Sert aussi aux bouteilles des ennemis.
 */
/** Apparence d'une bouteille : modèle, longueur en jeu (m), couleur par matériau du modèle. */
export type BottleLook = { file: string; length: number; colors: Record<string, number> };

export async function createBottleView(scene: THREE.Scene, L: BottleLook = CANETTE_LOOK) {
  const url = Object.entries(urls).find(([p]) => p.endsWith('/' + L.file))?.[1];
  if (!url) throw new Error(`Modèle de bouteille introuvable : ${L.file}`);
  const gltf = await new GLTFLoader().loadAsync(url);
  const template = gltf.scene;
  // Cel-shading et couleurs de l'arme
  const mats = new Map<string, THREE.Material>();
  template.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.MeshStandardMaterial;
    let m = mats.get(src.name);
    if (!m) {
      const c = L.colors[src.name];
      m = characterMaterial({ color: c !== undefined ? new THREE.Color(c) : src.color });
      mats.set(src.name, m);
    }
    mesh.material = m;
    mesh.castShadow = true;
    mesh.layers.set(LAYER_CHARACTER);
  });
  // Recentrée sur son milieu, mise à la longueur voulue (axe Y = axe de la bouteille)
  const box = new THREE.Box3().setFromObject(template);
  const center = box.getCenter(new THREE.Vector3());
  template.position.sub(center);
  const holder = new THREE.Group();
  holder.add(template);
  const baseScale = L.length / (box.max.y - box.min.y);

  const meshes: THREE.Object3D[] = [];
  const Y = new THREE.Vector3(0, 1, 0);
  const spin = new THREE.Quaternion();

  return {
    /** Recopie la position et l'orientation de chaque projectile. */
    sync(projectiles: readonly Projectile[]) {
      projectiles.forEach((b, i) => {
        let mesh = meshes[i];
        if (!mesh) {
          mesh = holder.clone();
          scene.add(mesh);
          meshes.push(mesh);
        }
        mesh.visible = b.active;
        if (!b.active) return;
        mesh.position.copy(b.pos);
        mesh.scale.setScalar(baseScale * b.size);
        mesh.quaternion.setFromUnitVectors(Y, b.up0).premultiply(spin.setFromAxisAngle(b.spinAxis, b.spinRate * Math.PI * 2 * b.age));
      });
      for (let i = projectiles.length; i < meshes.length; i++) meshes[i].visible = false;
    },
  };
}
