import { BAC, BAC_UPGRADES } from '../config/arsenal';
import { WEAPON_INFO } from '../config/weapons';
import { createBottleWeapon } from './bottleWeapon';
import type { WeaponContext } from './weapon';

/** Bac de bière (GDD section 6, n° 23) : le bac éclate à l'impact en bouteilles dans toutes les directions. */
export const createBac = (ctx: WeaponContext) => createBottleWeapon(ctx, 'bac', WEAPON_INFO.bac.name, BAC_UPGRADES, BAC);
