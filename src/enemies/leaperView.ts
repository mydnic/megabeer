import * as THREE from 'three';
import { LEAPER_LOOK } from '../config/enemies';
import { createGroundMarks, type GroundMark } from '../fx/groundMarks';
import type { Zombie } from './zombie';

/**
 * Rendu de la brique Sauteur : dès qu'il se ramasse, la zone où il va retomber est marquée au sol,
 * et se remplit jusqu'à l'atterrissage (un danger pour le joueur : même langage que les bouteilles).
 */
export function createLeaperView(scene: THREE.Scene) {
  const marks = createGroundMarks(scene, LEAPER_LOOK);
  const list: GroundMark[] = [];

  return {
    sync(zombies: readonly Zombie[]) {
      list.length = 0;
      for (const z of zombies) {
        const J = z.def.leaper;
        if (!J || z.dead || (z.leap !== 'windup' && z.leap !== 'flight')) continue;
        const left = z.leap === 'windup' ? z.leapTimer + J.flight : z.leapTimer;
        list.push({ at: z.leapTo, radius: J.radius, t: 1 - left / (J.windup + J.flight) });
      }
      marks.sync(list);
    },
  };
}
