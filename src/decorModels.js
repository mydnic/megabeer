import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toonMaterial } from './textures.js';

// Curated subset of Kenney Castle Kit (structural) + Graveyard Kit (atmosphere) —
// see the asset-fetch skill for where these came from and how to fetch more.
// Both kits ship ~80-90 models each; this is a hand-picked slice matching the
// abbey/graveyard-at-night theme, not the whole catalog. Add a key + import to
// pull in another model.
import wallUrl from './assets/kenney-castle-kit/Models/GLB format/wall.glb?url';
import wallRuinedUrl from './assets/kenney-graveyard-kit/Models/GLB format/stone-wall-damaged.glb?url';
import pillarUrl from './assets/kenney-castle-kit/Models/GLB format/wall-pillar.glb?url';
import pillarLargeUrl from './assets/kenney-graveyard-kit/Models/GLB format/pillar-large.glb?url';
import archUrl from './assets/kenney-castle-kit/Models/GLB format/wall-doorway.glb?url';
import treeCastleUrl from './assets/kenney-castle-kit/Models/GLB format/tree-large.glb?url';
import pineCrookedUrl from './assets/kenney-graveyard-kit/Models/GLB format/pine-crooked.glb?url';
import rocksUrl from './assets/kenney-graveyard-kit/Models/GLB format/rocks.glb?url';
import rocksCastleUrl from './assets/kenney-castle-kit/Models/GLB format/rocks-large.glb?url';
import graveBevelUrl from './assets/kenney-graveyard-kit/Models/GLB format/gravestone-bevel.glb?url';
import graveBrokenUrl from './assets/kenney-graveyard-kit/Models/GLB format/gravestone-broken.glb?url';
import graveCrossUrl from './assets/kenney-graveyard-kit/Models/GLB format/gravestone-cross.glb?url';
import cryptUrl from './assets/kenney-graveyard-kit/Models/GLB format/crypt-small.glb?url';
// Weapon projectile props (Quaternius, CC0, via Poly Pizza) — same loader, same
// toon-material treatment, just consumed by weapons.js instead of mapgen.js.
import beerBottleUrl from './assets/quaternius-food-pack/Bottle.glb?url';
import kegBarrelUrl from './assets/quaternius-props/barrel.glb?url';

const MODEL_URLS = {
  wall: wallUrl,
  wallRuined: wallRuinedUrl,
  pillar: pillarUrl,
  pillarLarge: pillarLargeUrl,
  arch: archUrl,
  treeCastle: treeCastleUrl,
  pineCrooked: pineCrookedUrl,
  rocks: rocksUrl,
  rocksCastle: rocksCastleUrl,
  graveBevel: graveBevelUrl,
  graveBroken: graveBrokenUrl,
  graveCross: graveCrossUrl,
  crypt: cryptUrl,
  beerBottle: beerBottleUrl,
  kegBarrel: kegBarrelUrl,
};

const loader = new GLTFLoader();
const rigs = {}; // key -> { template, height, sizeX, sizeZ }

export const decorModels = { ready: false };

async function init() {
  const entries = Object.entries(MODEL_URLS);
  await Promise.all(entries.map(async ([key, url]) => {
    const gltf = await loader.loadAsync(url);
    const template = gltf.scene;
    template.traverse(c => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
        // Kenney's GLBs ship MeshStandardMaterial (PBR) — under our low-ambient
        // scene lighting (calibrated for MeshToonMaterial's stepped gradient
        // response, see scene.js) that reads as near-black instead of the flat
        // cel-shaded look everything else in the game has. Swap in a toon
        // material reusing the same baked texture, drop the PBR-only properties.
        c.material = toonMaterial({ map: c.material.map, color: c.material.color });
      }
    });
    const box = new THREE.Box3().setFromObject(template);
    rigs[key] = {
      template,
      height: Math.max(0.1, box.max.y - box.min.y),
      sizeX: Math.max(0.1, box.max.x - box.min.x),
      sizeZ: Math.max(0.1, box.max.z - box.min.z),
    };
  }));
  decorModels.ready = true;
}

init();

// Static (non-animated) props: Object3D.clone() shares geometry/material by
// default across every instance of a template — cheap, and safe to never
// dispose since chunk unload just removes the group, the shared resources stay
// alive for other chunks still using the same model.
// Returns the scaled sizeX/sizeZ too, so callers can size wall-shaped colliders
// (long thin footprint) differently from compact ones (single circle).
// Pass `tint` to recolor an instance (e.g. per beer-type projectile color) — this
// clones the material too (normally shared across every instance of a template),
// since mutating a shared material's color would recolor every other instance
// using it. Omit tint for decor, where sharing is what we want.
export function cloneDecorModel(key, targetHeight, tint) {
  const rig = rigs[key];
  const scale = targetHeight / rig.height;
  const mesh = rig.template.clone(true);
  if (tint !== undefined) {
    mesh.traverse(c => {
      if (c.isMesh) {
        c.material = c.material.clone();
        c.material.color.setHex(tint);
      }
    });
  }
  mesh.scale.setScalar(scale);
  const sizeX = rig.sizeX * scale, sizeZ = rig.sizeZ * scale;
  return {
    mesh,
    sizeX,
    sizeZ,
    radius: Math.max(sizeX, sizeZ) / 2,
  };
}
