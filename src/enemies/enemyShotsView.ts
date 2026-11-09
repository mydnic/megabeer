import * as THREE from 'three';
import { THROWN_BOTTLE_LOOK as L } from '../config/enemies';
import { createGroundMarks, type GroundMark } from '../fx/groundMarks';
import { createBottleView } from '../weapons/bottleView';
import type { EnemyShot } from './enemyShots';

/**
 * Rendu des projectiles ennemis : la bouteille vide en vol, et sa marque au sol au point d'impact
 * (un anneau rouge qui se remplit à mesure que la bouteille approche).
 */
export async function createEnemyShotsView(scene: THREE.Scene) {
  const bottles = await createBottleView(scene, L);
  const marks = createGroundMarks(scene, L);
  const list: GroundMark[] = [];

  return {
    sync(shots: readonly EnemyShot[]) {
      bottles.sync(shots);
      list.length = 0;
      for (const s of shots) list.push({ at: s.to, radius: s.radius, t: s.t });
      marks.sync(list);
    },
  };
}
