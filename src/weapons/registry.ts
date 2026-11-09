import { createBlonde } from './blonde';
import { createStout } from './stout';
import type { Weapon, WeaponContext, WeaponId } from './weapon';

/** Toutes les armes du jeu : ajouter une arme = ajouter son créateur ici. */
export const WEAPON_FACTORIES: Record<WeaponId, (ctx: WeaponContext) => Weapon> = {
  blonde: createBlonde,
  stout: createStout,
};
