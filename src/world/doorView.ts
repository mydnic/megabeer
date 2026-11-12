import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import colormapUrl from '../assets/kenney-castle-kit/Models/GLB format/Textures/colormap.png?url';
import archUrl from '../assets/kenney-castle-kit/Models/GLB format/wall-doorway.glb?url';
import gateUrl from '../assets/kenney-castle-kit/Models/GLB format/gate.glb?url';
import bannerUrl from '../assets/kenney-castle-kit/Models/GLB format/flag-banner-short.glb?url';
import { DOOR_LOOK as L } from '../config/bosses';
import type { PatronDoor } from '../game/patronDoor';
import { decorMaterial, LAYER_CHARACTER, LAYER_SKY } from '../render/materials';

/**
 * Rendu de la Porte du patron, en pièces du Castle Kit Kenney (choix de l'utilisateur) : l'arche, la porte de bois
 * dans l'ouverture, deux longues bannières de part et d'autre, et un faisceau rouge visible de loin tant qu'elle
 * est fermée. Ouverte, la porte s'enfonce dans le sol.
 */
export async function createDoorView(scene: THREE.Scene) {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => (url.endsWith('colormap.png') ? colormapUrl : url));
  const loader = new GLTFLoader(manager);
  const atlas = await new THREE.TextureLoader().loadAsync(colormapUrl);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.flipY = false;
  const mat = decorMaterial({ map: atlas });

  /** Une pièce du kit, recentrée en x et z, pieds à y = 0, à l'échelle du jeu. */
  async function piece(url: string) {
    const g = (await loader.loadAsync(url)).scene;
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    g.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.material = mat;
      m.castShadow = true;
      m.receiveShadow = true;
      m.layers.set(LAYER_CHARACTER);
    });
    // Les pièces du kit ont leur face avant sur l'axe X : un quart de tour la met face à la direction de la porte (Z)
    const turn = new THREE.Group();
    turn.add(g);
    turn.rotation.y = -Math.PI / 2;
    const holder = new THREE.Group();
    holder.add(turn);
    holder.scale.setScalar(L.scale);
    const s = box.getSize(new THREE.Vector3()).multiplyScalar(L.scale);
    // Taille une fois tournée : largeur en x, hauteur en y, épaisseur en z
    const size = new THREE.Vector3(s.z, s.y, s.x);
    return { holder, size };
  }

  const root = new THREE.Group();
  const arch = await piece(archUrl);
  const gate = await piece(gateUrl);
  root.add(arch.holder, gate.holder);
  // Bannières : plaquées contre l'arche, de chaque côté de l'ouverture, côté face
  for (const sx of [-1, 1]) {
    const b = await piece(bannerUrl);
    b.holder.position.set(sx * arch.size.x * 0.36, arch.size.y * 0.3, arch.size.z / 2 + 0.05);
    root.add(b.holder);
  }
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(L.beamRadius, L.beamRadius, L.beamHeight, 16, 1, true).translate(0, L.beamHeight / 2, 0),
    new THREE.MeshBasicMaterial({ color: L.beamColor, transparent: true, opacity: L.beamOpacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  );
  beam.layers.set(LAYER_SKY);
  root.add(beam);
  root.visible = false;
  scene.add(root);

  const up = new THREE.Vector3(), side = new THREE.Vector3(), fwd = new THREE.Vector3(), basis = new THREE.Matrix4();
  let openAt = -1, time = 0;

  return {
    /** Recopie la porte ; `dt` : temps de jeu écoulé (0 : figé). */
    sync(door: PatronDoor, dt: number) {
      time += dt;
      if (!door.pos) { root.visible = false; openAt = -1; return; }
      root.visible = true;
      up.copy(door.pos).normalize();
      side.crossVectors(up, door.facing).normalize();
      fwd.crossVectors(side, up);
      basis.makeBasis(side, up, fwd);
      root.quaternion.setFromRotationMatrix(basis);
      root.position.copy(door.pos);
      beam.visible = !door.open;
      if (!door.open) { openAt = -1; gate.holder.position.y = 0; return; }
      if (openAt < 0) openAt = time;
      const k = Math.min(1, (time - openAt) / L.openTime);
      gate.holder.position.y = -gate.size.y * (1 - (1 - k) * (1 - k));
    },
  };
}
