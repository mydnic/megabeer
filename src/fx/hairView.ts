import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SAIYAN_LOOK, type SaiyanTier } from '../config/saiyan';
import type { HeadAnchor } from '../player/buveurVisual';
import { characterMaterial, LAYER_CHARACTER } from '../render/materials';

const urls = import.meta.glob('../assets/models/cheveux_*.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** Une coiffure chargée : son groupe (recalé sur le visage de Goku : centre à l'origine, hauteur du visage 1) et sa matière. */
type Hairdo = { group: THREE.Group; material: THREE.MeshToonMaterial };

/**
 * Cheveux du Super Saiyan (tools/blender/cheveux.py) : la coiffure du palier posée sur la tête du perso, à sa taille,
 * qui suit l'os de la tête (elle bouge avec lui), teinte de la couleur du palier. Elle pousse d'un coup à la
 * transformation.
 */
export async function createHairView(scene: THREE.Scene) {
  const H = SAIYAN_LOOK.hair;
  const styles = new Map<string, Hairdo>();
  for (const [path, url] of Object.entries(urls)) {
    const id = path.match(/cheveux_(\w+)\.glb$/)![1];
    const gltf = await new GLTFLoader().loadAsync(url);
    const src = gltf.scene.getObjectByProperty('isMesh', true) as THREE.Mesh;
    const material = characterMaterial({ map: (src.material as THREE.MeshStandardMaterial).map ?? null, side: THREE.DoubleSide });
    const group = new THREE.Group();
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.material = material;
      m.castShadow = true;
      m.layers.set(LAYER_CHARACTER);
      m.frustumCulled = false;
    });
    group.add(gltf.scene);
    group.visible = false;
    scene.add(group);
    styles.set(id, { group, material });
  }

  const q = new THREE.Quaternion(), p = new THREE.Vector3(), up = new THREE.Vector3();
  let shown: Hairdo | null = null, grow = 0;
  return {
    /** Chaque image : le palier en cours (null : pas transformé), la tête du perso affiché (null : rien à coiffer). */
    sync(tier: SaiyanTier | null, head: HeadAnchor | null, visible: boolean, dt: number) {
      const style = tier?.hairStyle && head && visible ? styles.get(tier.hairStyle) ?? null : null;
      if (shown && shown !== style) shown.group.visible = false;
      if (style !== shown) grow = 0;
      shown = style;
      if (!style || !head || !tier) return;
      grow = Math.min(1, grow + dt / H.growTime);
      style.material.color.set(tier.hair ?? 0xffffff);
      head.bone.updateWorldMatrix(true, false);
      head.bone.getWorldQuaternion(q).multiply(head.inBone);
      p.copy(head.centre);
      head.bone.localToWorld(p);
      up.set(0, 1, 0).applyQuaternion(q);
      p.addScaledVector(up, head.size * H.lift);
      const g = style.group;
      g.visible = true;
      g.position.copy(p);
      g.quaternion.copy(q);
      // Pousse d'un coup, avec un léger rebond
      const k = 1 - Math.pow(1 - grow, 3) + Math.sin(grow * Math.PI) * 0.15;
      g.scale.setScalar(head.size * H.scale * k);
    },
  };
}
