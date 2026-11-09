import * as THREE from 'three';
import { CHARGER_LOOK } from '../config/enemies';
import { createGroundLines, type GroundLine } from '../fx/groundMarks';
import type { Zombie } from './zombie';

/**
 * Rendu de la brique Chargeur : pendant l'élan, la ligne de la charge est marquée au sol et se
 * remplit jusqu'au départ ; elle reste affichée pendant la charge.
 */
export function createChargerView(scene: THREE.Scene) {
  const lines = createGroundLines(scene, CHARGER_LOOK);
  const list: GroundLine[] = [];

  return {
    sync(zombies: readonly Zombie[]) {
      list.length = 0;
      for (const z of zombies) {
        const C = z.def.charger;
        if (!C || z.dead || (z.charge !== 'windup' && z.charge !== 'charge')) continue;
        const t = z.charge === 'windup' ? 1 - z.chargeTimer / C.windup : 1;
        list.push({ from: z.chargeFrom, dir: z.chargeDir, length: C.length, width: C.width, t });
      }
      lines.sync(list);
    },
  };
}
