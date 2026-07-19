import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

import kenneyModelUrl from './assets/kenney-animated-characters-survivors/Model/characterMedium.fbx?url';
import kenneyRunUrl from './assets/kenney-animated-characters-survivors/Animations/run.fbx?url';
import zombieATexUrl from './assets/kenney-animated-characters-survivors/Skins/zombieA.png';
import zombieCTexUrl from './assets/kenney-animated-characters-survivors/Skins/zombieC.png';

import quatBasicUrl from './assets/quaternius-zombies/Zombie_Basic.gltf?url';
import quatChubbyUrl from './assets/quaternius-zombies/Zombie_Chubby.gltf?url';
import quatArmUrl from './assets/quaternius-zombies/Zombie_Arm.gltf?url';
import quatRibcageUrl from './assets/quaternius-zombies/Zombie_Ribcage.gltf?url';

// Multiple model "rigs" from different packs (Kenney FBX, Quaternius glTF), unified
// behind one clone API so config/enemies.js can mix and match by `model` id.
// r maps to visual height via HEIGHT_PER_R, independent of each rig's native scale.
const HEIGHT_PER_R = 2.2;

const fbxLoader = new FBXLoader();
const gltfLoader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();

function loadFBX(url) {
  return new Promise((resolve, reject) => fbxLoader.load(url, resolve, undefined, reject));
}

const rigs = {}; // rigId -> { object, clip, naturalHeight, rotationOffset }
const skinTextures = {}; // kenney only: skinId -> texture

async function loadKenneyRig() {
  const [modelObj, runObj, texA, texC] = await Promise.all([
    loadFBX(kenneyModelUrl),
    loadFBX(kenneyRunUrl),
    texLoader.loadAsync(zombieATexUrl),
    texLoader.loadAsync(zombieCTexUrl),
  ]);
  // run.fbx bundles two clips: a 2-keyframe "Targeting Pose" reference (T-pose)
  // and the real "Run" cycle — pick by name, not index (see asset-fetch skill).
  const clip = runObj.animations.find(c => /run/i.test(c.name)) || runObj.animations[0];
  for (const tex of [texA, texC]) {
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  const box = new THREE.Box3().setFromObject(modelObj);
  rigs.kenney = {
    object: modelObj, clip,
    naturalHeight: Math.max(0.1, box.max.y - box.min.y),
    rotationOffset: Math.PI, // Kenney FBX characters face -Z; our facing math expects +Z
  };
  skinTextures.zombieA = texA;
  skinTextures.zombieC = texC;
}

async function loadQuaterniusRig(id, url) {
  const gltf = await gltfLoader.loadAsync(url);
  const clip = gltf.animations.find(c => /run/i.test(c.name)) || gltf.animations[0];
  const box = new THREE.Box3().setFromObject(gltf.scene);
  rigs[id] = {
    object: gltf.scene, clip,
    naturalHeight: Math.max(0.1, box.max.y - box.min.y),
    rotationOffset: 0,
  };
}

// variant id (used as ENEMY_TYPES[].model) -> which rig + optional Kenney skin swap
const VARIANTS = {
  kenney_zombieA: { rig: 'kenney', skin: 'zombieA' },
  kenney_zombieC: { rig: 'kenney', skin: 'zombieC' },
  quat_basic: { rig: 'quat_basic' },
  quat_chubby: { rig: 'quat_chubby' },
  quat_arm: { rig: 'quat_arm' },
  quat_ribcage: { rig: 'quat_ribcage' },
};

export const enemyModels = { ready: false };

async function init() {
  await Promise.all([
    loadKenneyRig(),
    loadQuaterniusRig('quat_basic', quatBasicUrl),
    loadQuaterniusRig('quat_chubby', quatChubbyUrl),
    loadQuaterniusRig('quat_arm', quatArmUrl),
    loadQuaterniusRig('quat_ribcage', quatRibcageUrl),
  ]);
  enemyModels.ready = true;
}

init();

export function cloneEnemyModel(variantId, tint, r) {
  const variant = VARIANTS[variantId];
  const rig = rigs[variant.rig];
  const root = new THREE.Group();
  const mesh = cloneSkeleton(rig.object);
  mesh.rotation.y = rig.rotationOffset;
  root.add(mesh);

  const map = variant.skin ? skinTextures[variant.skin] : null;
  const mats = [];
  mesh.traverse(child => {
    if (child.isMesh) {
      const mat = map
        ? new THREE.MeshStandardMaterial({ map, color: tint ?? 0xffffff })
        : (child.material ? child.material.clone() : new THREE.MeshStandardMaterial());
      if (!map && tint) mat.color.setHex(tint);
      child.material = mat;
      child.castShadow = true;
      child.receiveShadow = true;
      mats.push(mat);
    }
  });
  root.userData.mats = mats;

  const scale = (r * HEIGHT_PER_R) / rig.naturalHeight;
  root.scale.setScalar(scale);

  const mixer = new THREE.AnimationMixer(mesh);
  mixer.clipAction(rig.clip).play();
  root.userData.mixer = mixer;

  return root;
}
