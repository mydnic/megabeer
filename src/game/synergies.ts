import { SYNERGIES } from '../config/weapons';
import type { WeaponId } from '../weapons/weapon';

/** Identifiant d'une synergie (une entrée de SYNERGIES, config/weapons.ts). */
export type SynergyId = keyof typeof SYNERGIES;

const ALL = Object.keys(SYNERGIES) as SynergyId[];

/** Synergies actives : toutes leurs armes sont équipées. */
export function activeSynergies(has: (id: WeaponId) => boolean): SynergyId[] {
  return ALL.filter((s) => SYNERGIES[s].weapons.every(has));
}

/** Synergies qu'équiper `id` activerait (toutes ses autres armes sont déjà là). */
export function synergiesCompletedBy(id: WeaponId, has: (id: WeaponId) => boolean): SynergyId[] {
  return ALL.filter((s) => {
    const w: readonly WeaponId[] = SYNERGIES[s].weapons;
    return w.includes(id) && !has(id) && w.every((x) => x === id || has(x));
  });
}
