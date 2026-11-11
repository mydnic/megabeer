import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LAST_CALL_LOOK as L } from '../config/lastCall';
import type { CallBell } from '../game/lastCall';
import { characterMaterial, LAYER_CHARACTER, LAYER_SKY } from '../render/materials';

const urls = import.meta.glob('../assets/models/cloche.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** Ce qui représente une grande cloche : la potence, la cloche qui se balance, le faisceau. */
type BellMesh = { root: THREE.Group; bell: THREE.Object3D; rest: THREE.Quaternion; beam: THREE.Mesh; rungAt: number };

/**
 * Rendu des grandes cloches du Dernier service (`tools/blender/cloche.py --potence`) : une cloche en laiton
 * sous une potence de bois, plantée dans un socle de pierre, et un faisceau doré visible de loin tant qu'elle
 * n'a pas sonné. Sonnée, la cloche se balance puis s'apaise ; son faisceau s'éteint.
 */
export async function createLastCallView(scene: THREE.Scene) {
  const gltf = await new GLTFLoader().loadAsync(Object.values(urls)[0]);
  const template = gltf.scene;
  template.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(template);
  const scale = L.height / (box.max.y - box.min.y);
  // Le socle centré sous le poteau (l'origine du modèle), posé au sol
  template.position.set(0, -box.min.y, 0);

  const mats: Record<string, THREE.Material> = {
    Laiton: characterMaterial({ color: L.brass, emissive: L.brass, emissiveIntensity: 0.12 }),
    Bois: characterMaterial({ color: L.wood }),
    Pierre: characterMaterial({ color: L.stone }),
  };
  const beamGeo = new THREE.CylinderGeometry(L.beamRadius, L.beamRadius, L.beamHeight, 16, 1, true).translate(0, L.beamHeight / 2, 0);
  const meshes: BellMesh[] = [];
  const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), up = new THREE.Vector3();
  const swing = new THREE.Quaternion();

  function build(): BellMesh {
    const root = new THREE.Group();
    const model = template.clone(true);
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.material = mats[(m.material as THREE.Material).name.split('.')[0]] ?? mats.Bois;
      m.castShadow = true;
      m.layers.set(LAYER_CHARACTER);
    });
    const holder = new THREE.Group();
    holder.add(model);
    holder.scale.setScalar(scale);
    root.add(holder);
    const bell = model.getObjectByName('cloche')!;
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
      color: L.beamColor, transparent: true, opacity: L.beamOpacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    beam.layers.set(LAYER_SKY);
    root.add(beam);
    scene.add(root);
    return { root, bell, rest: bell.quaternion.clone(), beam, rungAt: -1 };
  }

  const clock = new THREE.Clock();
  return {
    /** Recopie les cloches (position, sonnée ou non). */
    sync(bells: readonly CallBell[]) {
      const t = clock.getElapsedTime();
      bells.forEach((b, i) => {
        const m = meshes[i] ?? (meshes[i] = build());
        m.root.visible = true;
        up.copy(b.pos).normalize();
        m.root.position.copy(b.pos);
        m.root.quaternion.setFromUnitVectors(Y, up);
        m.beam.visible = !b.rung;
        if (!b.rung) { m.rungAt = -1; m.bell.quaternion.copy(m.rest); return; }
        if (m.rungAt < 0) m.rungAt = t;
        // Sonnée : elle se balance de moins en moins
        const age = t - m.rungAt;
        const k = Math.max(0, 1 - age / L.swingTime);
        swing.setFromAxisAngle(X, L.swing * k * k * Math.sin(age * L.swingRate * Math.PI * 2));
        m.bell.quaternion.copy(m.rest).multiply(swing);
      });
      for (let i = bells.length; i < meshes.length; i++) meshes[i].root.visible = false;
    },
  };
}
