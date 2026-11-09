import * as THREE from 'three';
import { KAMIKAZE_LOOK as L } from '../config/enemies';
import { createGroundMarks, type GroundMark } from '../fx/groundMarks';
import type { Zombie } from './zombie';

/**
 * Rendu de la brique Kamikaze : pendant la mèche, la zone de l'explosion est marquée au sol (un
 * anneau qui se remplit jusqu'à l'explosion). Le gonflement du corps est fait par hordeView.
 */
export function createKamikazeView(scene: THREE.Scene) {
  const marks = createGroundMarks(scene, L);
  const list: GroundMark[] = [];

  return {
    sync(zombies: readonly Zombie[]) {
      list.length = 0;
      for (const z of zombies) {
        const K = z.def.kamikaze;
        if (!K || z.fuse < 0 || z.dead) continue;
        list.push({ at: z.pos, radius: K.radius, t: 1 - z.fuse / K.fuse });
      }
      marks.sync(list);
    },
  };
}

/** Facteur de taille d'un kamikaze dont la mèche brûle (1 sinon) : il gonfle jusqu'à l'explosion. */
export function kamikazeSwell(z: Zombie) {
  const K = z.def.kamikaze;
  if (!K || z.fuse < 0) return 1;
  const t = 1 - z.fuse / K.fuse;
  return 1 + L.swell * t * t;
}
