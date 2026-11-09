import { createCanette } from './canette';
import { createFut } from './fut';
import { createGueuze } from './gueuze';
import { createStout } from './stout';
import type { Weapon, WeaponContext, WeaponId } from './weapon';

/** Toutes les armes du jeu : ajouter une arme = ajouter son créateur ici. */
export const WEAPON_FACTORIES: Record<WeaponId, (ctx: WeaponContext) => Weapon> = {
  canette: createCanette,
  stout: createStout,
  fut: createFut,
  gueuze: createGueuze,
};
