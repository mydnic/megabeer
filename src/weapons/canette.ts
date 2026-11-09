import { CANETTE_UPGRADES } from '../config/upgrades';
import { createBottleWeapon } from './bottleWeapon';
import type { WeaponContext } from './weapon';

/** La Canette : canette de bière en métal, rapide, qui s'écrase sur le premier zombie touché (arme de départ du Buveur). */
export const createCanette = (ctx: WeaponContext) => createBottleWeapon(ctx, 'canette', 'Canette', CANETTE_UPGRADES);
