import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import colormapUrl from '../../assets/kenney-graveyard-kit/Models/GLB format/Textures/colormap.png?url';
import abbeyUrl from '../../assets/models/abbaye.glb?url';
import signUrl from '../../assets/models/mortehan.glb?url';
import { DECOR_MODELS, type DecorModelId } from '../../config/decor';
import { decorMaterial } from '../../render/materials';
import { computeGridShape, type GridShape } from './gridShape';

const kenneyUrls = import.meta.glob('../../assets/kenney-graveyard-kit/Models/GLB format/*.glb', {
  query: '?url', import: 'default', eager: true,
}) as Record<string, string>;

/** Un modèle prêt à poser : géométrie fusionnée (déjà à l'échelle), matériau, forme de collision. */
export type DecorModel = { id: DecorModelId; geometry: THREE.BufferGeometry; material: THREE.Material; shape: GridShape };

/**
 * Charge les modèles de décor (kit Kenney cimetière, abbaye maison, sapin procédural), les fusionne
 * en une géométrie par modèle et calcule leur forme de collision depuis leur géométrie réelle.
 */
export async function loadDecorLibrary(): Promise<Map<DecorModelId, DecorModel>> {
  const manager = new THREE.LoadingManager();
  // Les GLB Kenney référencent une texture externe : on la redirige vers l'asset importé par Vite
  manager.setURLModifier((url) => (url.endsWith('colormap.png') ? colormapUrl : url));
  const loader = new GLTFLoader(manager);

  const atlas = await new THREE.TextureLoader().loadAsync(colormapUrl);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.flipY = false;
  // Cel-shading sur tous les objets (paliers nets), comme le perso
  const kenneyMat = decorMaterial({ map: atlas });
  const vertexMat = decorMaterial({ vertexColors: true });

  const lib = new Map<DecorModelId, DecorModel>();
  // Panneau MORTEHAN : un seul fichier, une lettre par objet
  const signScene = loader.loadAsync(signUrl).then((g) => g.scene);
  const entries = Object.entries(DECOR_MODELS) as [DecorModelId, (typeof DECOR_MODELS)[DecorModelId]][];
  await Promise.all(entries.map(async ([id, def]) => {
    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;
    if (def.source === 'kenney') {
      const url = Object.entries(kenneyUrls).find(([p]) => p.endsWith(`/${def.file}.glb`))?.[1];
      if (!url) throw new Error(`Modèle Kenney introuvable : ${def.file}`);
      geometry = mergeScene((await loader.loadAsync(url)).scene, def.scale, false);
      // Les pièces Kenney sont calées sur le bord de leur case : on les recentre (pose plus simple)
      geometry.computeBoundingBox();
      const bb = geometry.boundingBox!;
      geometry.translate(-(bb.min.x + bb.max.x) / 2, 0, -(bb.min.z + bb.max.z) / 2);
      material = kenneyMat;
    } else if (def.source === 'sign') {
      const part = (await signScene).getObjectByName(def.part!);
      if (!part) throw new Error(`Lettre introuvable dans mortehan.glb : ${def.part}`);
      geometry = mergeScene(part, def.scale, true);
      material = vertexMat;
    } else if (def.source === 'abbey') {
      geometry = mergeScene((await loader.loadAsync(abbeyUrl)).scene, def.scale, true);
      material = vertexMat;
    } else {
      geometry = pineGeometry();
      material = vertexMat;
    }
    lib.set(id, { id, geometry, material, shape: computeGridShape(geometry, def.cell) });
  }));
  return lib;
}

/**
 * Fusionne tous les maillages d'une scène glTF en une géométrie (transformations appliquées).
 * colorsFromMaterials : la couleur de chaque matériau devient une couleur de sommet (un seul
 * matériau à vertexColors pour tout le modèle, donc un seul appel de rendu).
 */
function mergeScene(scene: THREE.Object3D, scale: number, colorsFromMaterials: boolean): THREE.BufferGeometry {
  scene.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  const s = new THREE.Matrix4().makeScale(scale, scale, scale);
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    let g = mesh.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(s, mesh.matrixWorld));
    if (g.index) g = g.toNonIndexed();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (colorsFromMaterials) {
      g.deleteAttribute('uv');
      const c = (mesh.material as THREE.MeshStandardMaterial).color ?? new THREE.Color(1, 1, 1);
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    parts.push(g);
  });
  const merged = mergeGeometries(parts);
  if (!merged) throw new Error('Fusion de géométrie impossible');
  return merged;
}

/** Sapin en étages (3 cônes) sur un tronc, couleurs par sommet. Bas des branches à 2,7 m : on passe dessous. */
function pineGeometry(): THREE.BufferGeometry {
  const parts: [THREE.BufferGeometry, number][] = [
    [new THREE.CylinderGeometry(0.22, 0.32, 3.1, 8).translate(0, 1.55, 0), 0x6b4428],
    [new THREE.ConeGeometry(1.7, 2.2, 9).translate(0, 3.8, 0), 0x4f8a35],
    [new THREE.ConeGeometry(1.35, 1.9, 9).translate(0, 4.9, 0), 0x4f8a35],
    [new THREE.ConeGeometry(0.95, 1.7, 9).translate(0, 5.9, 0), 0x4f8a35],
  ];
  const c = new THREE.Color();
  const geos = parts.map(([g0, hex]) => {
    const g = g0.toNonIndexed();
    g.deleteAttribute('uv');
    c.set(hex);
    const col = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < g.attributes.position.count; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
  return mergeGeometries(geos)!;
}
