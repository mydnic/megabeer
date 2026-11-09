import { BLONDE_UPGRADES } from '../config/upgrades';
import { createBottleWeapon } from './bottleWeapon';
import type { WeaponContext } from './weapon';

/** La Blonde : bouteille rapide qui s'écrase sur le premier zombie touché (arme de départ du Buveur). */
export const createBlonde = (ctx: WeaponContext) => createBottleWeapon(ctx, 'blonde', 'Blonde', BLONDE_UPGRADES);
