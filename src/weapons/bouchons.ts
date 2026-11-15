import { BOUCHONS, BOUCHONS_UPGRADES } from '../config/arsenal';
import { WEAPON_INFO } from '../config/weapons';
import { createBottleWeapon } from './bottleWeapon';
import type { WeaponContext } from './weapon';

/** Bouchons de champagne (GDD section 6, n° 17) : une rafale de bouchons en éventail. */
export const createBouchons = (ctx: WeaponContext) => createBottleWeapon(ctx, 'bouchons', WEAPON_INFO.bouchons.name, BOUCHONS_UPGRADES, BOUCHONS);
