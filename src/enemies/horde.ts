import * as THREE from 'three';
import { ZOMBIE_VISUAL as V, type ZombieModel } from '../config/zombies';
import { PLANET_RADIUS } from '../config/world';
import { heightAt } from '../world/terrain';
import { Zombie, type ZombieLibrary } from './zombie';

/** Rayon du sol (relief ou dessus de décor) sous un point. */
export type SupportFn = (p: THREE.Vector3, feetR: number) => number;

/**
 * Ensemble des zombies en jeu. Checkpoint 1 : ils restent sur place, se tournent vers le joueur
 * quand il approche et frappent à portée (la poursuite arrive au checkpoint 2).
 */
export function createHorde(scene: THREE.Scene, lib: ZombieLibrary, support: SupportFn) {
  const zombies: Zombie[] = [];
  const tmp = new THREE.Vector3();

  /** Pose un zombie sur le sol, à la direction donnée, regardant vers `facing`. */
  function spawn(model: ZombieModel, dir: THREE.Vector3, facing: THREE.Vector3) {
    const z = new Zombie(scene, lib, model);
    // Sonde un peu au-dessus du relief : trouve aussi le dessus du décor (dalles, marches)
    z.pos.copy(dir).normalize();
    z.pos.setLength(PLANET_RADIUS + heightAt(z.pos) + 2.5);
    z.pos.setLength(support(z.pos, z.pos.length()));
    z.facing.copy(facing).addScaledVector(z.pos.clone().normalize(), -facing.dot(z.pos.clone().normalize())).normalize();
    zombies.push(z);
    return z;
  }

  return {
    zombies,
    spawn,
    update(dt: number, playerPos: THREE.Vector3) {
      for (const z of zombies) {
        const d = tmp.subVectors(playerPos, z.pos).length();
        if (d < V.noticeRange) z.turnToward(playerPos, dt);
        z.play(d < V.attackRange ? 'attack' : 'idle');
        z.update(dt);
      }
    },
  };
}
