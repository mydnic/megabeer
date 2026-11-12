import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PORTRAIT as P } from '../config/visual';
import { characterMaterial } from './materials';

/**
 * Portrait d'un perso tiré de son modèle 3D (boutique, et plus tard le choix du perso) : rendu une seule fois, en
 * cel-shading comme en jeu, cadré sur le buste et légèrement de trois quarts, dans une image transparente. Le moteur de
 * rendu utilisé est jetable (libéré juste après).
 */
export async function renderPortrait(url: string, clip = 'idle'): Promise<string> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  const mats = new Map<string, THREE.Material>();
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.MeshStandardMaterial;
    let m = mats.get(src.name);
    if (!m) { m = characterMaterial({ color: src.color, map: src.map ?? null }); mats.set(src.name, m); }
    mesh.material = m;
    mesh.frustumCulled = false;
  });
  // Pose de repos de l'animation d'attente (pas la pose de modélisation, bras en croix)
  const anim = gltf.animations.find((a) => a.name === clip) ?? gltf.animations[0];
  if (anim) { const mixer = new THREE.AnimationMixer(model); mixer.clipAction(anim).play(); mixer.update(P.time); }
  model.rotation.y = P.turn;
  model.updateMatrixWorld(true);

  // Cadrage : le haut du corps (de `from` à la tête), vu un peu d'en dessous de la tête
  const box = new THREE.Box3().setFromObject(model);
  const h = box.max.y - box.min.y;
  const top = box.max.y, bottom = box.min.y + h * P.from;
  const center = new THREE.Vector3((box.min.x + box.max.x) / 2, (top + bottom) / 2, (box.min.z + box.max.z) / 2);
  const camera = new THREE.PerspectiveCamera(P.fov, 1, 0.01, 100);
  const dist = ((top - bottom) / 2) / Math.tan(THREE.MathUtils.degToRad(P.fov / 2)) * P.margin;
  camera.position.set(center.x, center.y + h * P.lift, center.z + dist);
  camera.lookAt(center);

  const scene = new THREE.Scene();
  scene.add(model);
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x5a3a24, P.ambient));
  const sun = new THREE.DirectionalLight(0xfff0d8, P.sun);
  sun.position.set(2, 3, 4);
  scene.add(sun);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(P.size, P.size);
  renderer.setClearColor(0x000000, 0);
  renderer.render(scene, camera);
  const url2 = renderer.domElement.toDataURL('image/png');
  renderer.dispose();
  renderer.forceContextLoss();
  return url2;
}
