import { DES_421, DES_421_UPGRADES } from '../config/arsenal';
import { WEAPON_INFO } from '../config/weapons';
import { createBottleWeapon } from './bottleWeapon';
import type { WeaponContext } from './weapon';

/** Le 421 (GDD section 6, n° 10) : trois dés de comptoir ; chaque 6 aiguise les critiques, 4-2-1 fait exploser le 4. */
export const createDes421 = (ctx: WeaponContext) => createBottleWeapon(ctx, 'des421', WEAPON_INFO.des421.name, DES_421_UPGRADES, DES_421);
