import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CANETTE_LOOK } from '../config/weapons';
import { characterMaterial, LAYER_CHARACTER } from '../render/materials';
import type { Projectile } from './weapon';

const urls = import.meta.glob(['../assets/quaternius-food-pack/*.glb', '../assets/models/bouteille_*.glb', '../assets/models/canette.glb', '../assets/models/fut.glb', '../assets/models/tabouret.glb'], { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** Apparence d'une bouteille : modèle, longueur en jeu (m), couleur par matériau du modèle. */
export type BottleLook = { file: string; length: number; colors: Record<string, number> };

/** Nombre de projectiles prévus au départ ; la place double quand elle manque. */
const INITIAL = 64;

/**
 * Rendu des bouteilles en vol : un dessin instancié par pièce du modèle, quel que soit le nombre de
 * projectiles (des centaines en fin de partie ne coûtent pas plus d'appels de dessin qu'un seul).
 * Chaque instance est orientée selon la verticale au lancer puis tournée sur elle-même au fil du vol.
 * Sert aussi aux bouteilles des ennemis.
 */
export async function createBottleView(scene: THREE.Scene, L: BottleLook = CANETTE_LOOK) {
  const url = Object.entries(urls).find(([p]) => p.endsWith('/' + L.file))?.[1];
  if (!url) throw new Error(`Modèle de bouteille introuvable : ${L.file}`);
  const gltf = await new GLTFLoader().loadAsync(url);
  const template = gltf.scene;
  // Recentrée sur son milieu, mise à la longueur voulue (axe Y = axe de la bouteille)
  template.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(template);
  const center = box.getCenter(new THREE.Vector3());
  const baseScale = L.length / (box.max.y - box.min.y);
  const recenter = new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z);

  // Une pièce par maillage du modèle : géométrie ramenée dans le repère de la bouteille, cel-shading et couleurs de l'arme
  const mats = new Map<string, THREE.Material>();
  const parts: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
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
    const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(recenter);
    // Un modèle sans normales (le tabouret) rendrait des valeurs invalides qui noircissent toute l'image dans les
    // passes plein écran : on les calcule
    if (!geo.attributes.normal) geo.computeVertexNormals();
    parts.push({ geo, mat: m });
  });

  let capacity = INITIAL;
  let meshes: THREE.InstancedMesh[] = [];
  function build() {
    for (const m of meshes) { scene.remove(m); m.dispose(); }
    meshes = parts.map((p) => {
      const m = new THREE.InstancedMesh(p.geo, p.mat, capacity);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.castShadow = true;
      m.frustumCulled = false; // les instances sont partout autour du joueur
      m.layers.set(LAYER_CHARACTER);
      m.count = 0;
      scene.add(m);
      return m;
    });
  }
  build();

  const Y = new THREE.Vector3(0, 1, 0);
  const spin = new THREE.Quaternion(), q = new THREE.Quaternion(), s = new THREE.Vector3(), mat4 = new THREE.Matrix4();

  return {
    /** Recopie la position et l'orientation de chaque projectile actif. */
    sync(projectiles: readonly Projectile[]) {
      let n = 0;
      for (const b of projectiles) if (b.active) n++;
      if (n > capacity) { while (capacity < n) capacity *= 2; build(); }
      let i = 0;
      for (const b of projectiles) {
        if (!b.active) continue;
        q.setFromUnitVectors(Y, b.up0).premultiply(spin.setFromAxisAngle(b.spinAxis, b.spinRate * Math.PI * 2 * b.age));
        mat4.compose(b.pos, q, s.setScalar(baseScale * b.size));
        for (const m of meshes) m.setMatrixAt(i, mat4);
        i++;
      }
      for (const m of meshes) {
        m.count = n;
        m.instanceMatrix.clearUpdateRanges();
        m.instanceMatrix.addUpdateRange(0, n * 16);
        m.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
