import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CHARGER_LOOK as L } from '../config/enemies';
import { createGroundLines, type GroundLine } from '../fx/groundMarks';
import { characterMaterial, LAYER_CHARACTER } from '../render/materials';
import type { Zombie } from './zombie';

const urls = import.meta.glob('../assets/models/tonneau.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/**
 * Rendu de la brique Chargeur : pendant l'élan, la ligne de la charge est marquée au sol et se
 * remplit jusqu'au départ (elle reste affichée pendant la charge) ; pendant la charge, le tonneau
 * roule devant le moine, puis reste posé au bout de la ligne jusqu'à ce qu'il le ramasse.
 */
export async function createChargerView(scene: THREE.Scene) {
  const lines = createGroundLines(scene, L);
  const list: GroundLine[] = [];

  // Le tonneau : axe en Y dans le modèle, cel-shading comme les personnages
  const url = Object.values(urls)[0];
  if (!url) throw new Error(`Modèle introuvable : ${L.barrelFile}`);
  const template = (await new GLTFLoader().loadAsync(url)).scene;
  template.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.MeshStandardMaterial;
    mesh.material = characterMaterial({ map: src.map, color: src.color });
    mesh.castShadow = true;
    mesh.layers.set(LAYER_CHARACTER);
  });
  const barrels: THREE.Object3D[] = [];
  const Y = new THREE.Vector3(0, 1, 0), up = new THREE.Vector3(), axis = new THREE.Vector3();
  const roll = new THREE.Quaternion();

  return {
    sync(zombies: readonly Zombie[]) {
      list.length = 0;
      let n = 0;
      for (const z of zombies) {
        const C = z.def.charger;
        if (!C || z.dead) continue;
        if (z.charge === 'windup' || z.charge === 'charge') {
          const t = z.charge === 'windup' ? 1 - z.chargeTimer / C.windup : 1;
          list.push({ from: z.chargeFrom, dir: z.chargeDir, length: C.length, width: C.width, t });
        }
        if (z.barrel !== 'rolling' && z.barrel !== 'resting') continue;
        let b = barrels[n];
        if (!b) {
          b = template.clone();
          scene.add(b);
          barrels.push(b);
        }
        b.visible = true;
        n++;
        // Couché en travers de la ligne, il tourne sur son axe à mesure qu'il roule
        up.copy(z.barrelPos).normalize();
        axis.crossVectors(up, z.chargeDir).normalize();
        b.position.copy(z.barrelPos).addScaledVector(up, L.barrelRadius);
        b.quaternion.setFromUnitVectors(Y, axis).premultiply(roll.setFromAxisAngle(axis, z.barrelTravel / L.barrelRadius));
      }
      for (let i = n; i < barrels.length; i++) barrels[i].visible = false;
      lines.sync(list);
    },
  };
}
