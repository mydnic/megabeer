import * as THREE from 'three';
import { PROTECTOR_LOOK } from '../config/enemies';
import { createGroundMarks, type GroundMark } from '../fx/groundMarks';
import type { Zombie } from './zombie';

/** Rendu de la brique Protecteur : le halo de chaque protecteur, un cercle doré au sol. */
export function createProtectorView(scene: THREE.Scene) {
  const marks = createGroundMarks(scene, PROTECTOR_LOOK);
  const list: GroundMark[] = [];

  return {
    sync(zombies: readonly Zombie[]) {
      list.length = 0;
      for (const z of zombies) {
        const P = z.def.protector;
        if (P && !z.dead) list.push({ at: z.pos, radius: P.radius, t: 0 });
      }
      marks.sync(list);
    },
  };
}
