import { TRIPLE, TRIPLE_UPGRADES } from '../config/arsenal';
import { WEAPON_INFO } from '../config/weapons';
import { createBottleWeapon } from './bottleWeapon';
import type { WeaponContext } from './weapon';

/** Triple (GDD section 6, n° 5) : bouteille qui rebondit d'un zombie au suivant, sur une chaîne de trois. */
export const createTriple = (ctx: WeaponContext) => createBottleWeapon(ctx, 'triple', WEAPON_INFO.triple.name, TRIPLE_UPGRADES, TRIPLE);
