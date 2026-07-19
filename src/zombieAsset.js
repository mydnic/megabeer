import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

import modelUrl from './assets/kenney-animated-characters-survivors/Model/characterMedium.fbx?url';
import runUrl from './assets/kenney-animated-characters-survivors/Animations/run.fbx?url';
import zombieATexUrl from './assets/kenney-animated-characters-survivors/Skins/zombieA.png';
import zombieCTexUrl from './assets/kenney-animated-characters-survivors/Skins/zombieC.png';

// Kenney's rig is authored roughly human-scale (~meters). Our zombie tiers are
// tuned by ENEMY_TYPES[].r (see src/config/enemies.js); this constant maps r=1 to
// a visual height in world units, matched to look right next to the player capsule.
const HEIGHT_PER_R = 2.2;
// Kenney FBX characters face -Z by default; our facing math (Math.atan2(dx,dz))
// expects +Z forward, so the mesh needs a 180° yaw correction.
const ROTATION_OFFSET = Math.PI;

const loader = new FBXLoader();
const texLoader = new THREE.TextureLoader();

function loadFBX(url) {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

let template = null;
let runClip = null;
const skinTextures = {};

export const zombieAsset = { ready: false, naturalHeight: 2 };

async function init() {
  const [modelObj, runObj, texA, texC] = await Promise.all([
    loadFBX(modelUrl),
    loadFBX(runUrl),
    texLoader.loadAsync(zombieATexUrl),
    texLoader.loadAsync(zombieCTexUrl),
  ]);

  template = modelObj;
  // run.fbx bundles two clips: a 2-keyframe "Targeting Pose" reference (index 0,
  // basically a T-pose) and the real "Run" cycle (17 keyframes, ~0.67s). Picking
  // index 0 blindly freezes zombies in a T-pose — match by name instead.
  runClip = runObj.animations.find(c => /run/i.test(c.name)) || runObj.animations[0];

  for (const tex of [texA, texC]) {
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  skinTextures.zombieA = texA;
  skinTextures.zombieC = texC;

  const box = new THREE.Box3().setFromObject(template);
  zombieAsset.naturalHeight = Math.max(0.1, box.max.y - box.min.y);
  zombieAsset.ready = true;
}

init();

export function cloneZombie(skinId, tint, r) {
  const root = new THREE.Group();
  const mesh = cloneSkeleton(template);
  mesh.rotation.y = ROTATION_OFFSET;
  root.add(mesh);

  const map = skinTextures[skinId] || skinTextures.zombieA;
  const mats = [];
  mesh.traverse(child => {
    if (child.isMesh) {
      const mat = new THREE.MeshStandardMaterial({ map, color: tint ?? 0xffffff });
      child.material = mat;
      mats.push(mat);
    }
  });
  root.userData.mats = mats;

  const scale = (r * HEIGHT_PER_R) / zombieAsset.naturalHeight;
  root.scale.setScalar(scale);

  const mixer = new THREE.AnimationMixer(mesh);
  mixer.clipAction(runClip).play();
  root.userData.mixer = mixer;

  return root;
}
