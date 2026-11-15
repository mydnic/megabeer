import { VOMI, VOMI_UPGRADES } from '../config/arsenal';
import { WEAPON_INFO } from '../config/weapons';
import { createBottleWeapon } from './bottleWeapon';
import type { WeaponContext } from './weapon';

/** Flaque de vomi (GDD section 6, n° 3) : lancée sur le plus gros groupe, flaque de poison qui se cumule. */
export const createVomi = (ctx: WeaponContext) => createBottleWeapon(ctx, 'vomi', WEAPON_INFO.vomi.name, VOMI_UPGRADES, VOMI);
