import { STOUT_UPGRADES } from '../config/upgrades';
import { WEAPON_INFO } from '../config/weapons';
import { createBottleWeapon } from './bottleWeapon';
import type { WeaponContext } from './weapon';

/** La Stout : bouteille noire, lourde et lente ; gros dégâts, gros recul, traverse un zombie. */
export const createStout = (ctx: WeaponContext) => createBottleWeapon(ctx, 'stout', WEAPON_INFO.stout.name, STOUT_UPGRADES);
