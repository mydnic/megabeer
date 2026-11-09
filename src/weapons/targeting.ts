import type * as THREE from 'three';
import type { Zombie } from '../enemies/zombie';

/**
 * Choix de cible des armes, façon survivors : pas toujours le plus proche (tous les tirs partiraient
 * sur le même zombie, mort avant que les suivants arrivent).
 * - Un zombie qui a déjà assez de dégâts en route pour mourir (`incoming` >= `hp`) n'est plus visé,
 *   tant qu'il reste d'autres cibles.
 * - Parmi les `spread` cibles les plus proches encore vivantes, on en prend une au hasard : les tirs
 *   se dispersent.
 * `exclude` : zombies déjà visés par la même volée.
 */
export function pickTarget(zombies: readonly Zombie[], from: THREE.Vector3, range: number, spread: number, exclude?: ReadonlySet<Zombie>): Zombie | null {
  const near: { z: Zombie; d: number }[] = [];
  for (const z of zombies) {
    if (!z.targetable || exclude?.has(z)) continue;
    const d = z.pos.distanceTo(from);
    if (d < range) near.push({ z, d });
  }
  if (!near.length) return null;
  near.sort((a, b) => a.d - b.d);
  const alive = near.filter((x) => x.z.incoming < x.z.hp);
  const pool = (alive.length ? alive : near).slice(0, Math.max(1, spread));
  return pool[Math.floor(Math.random() * pool.length)].z;
}

/** Y a-t-il au moins un zombie visable à portée ? */
export function anyInRange(zombies: readonly Zombie[], from: THREE.Vector3, range: number) {
  return zombies.some((z) => z.targetable && z.pos.distanceTo(from) < range);
}
