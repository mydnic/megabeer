import { STOUT_UPGRADES } from '../config/upgrades';
import { createBottleWeapon } from './bottleWeapon';
import type { WeaponContext } from './weapon';

/** La Stout : bouteille noire, lourde et lente ; gros dégâts, gros recul, traverse un zombie. */
export const createStout = (ctx: WeaponContext) => createBottleWeapon(ctx, 'stout', 'Stout', STOUT_UPGRADES);
