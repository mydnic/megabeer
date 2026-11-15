import { KRIEK, KRIEK_UPGRADES } from '../config/arsenal';
import { WEAPON_INFO } from '../config/weapons';
import { createBottleWeapon } from './bottleWeapon';
import type { WeaponContext } from './weapon';

/** Kriek (GDD section 6, n° 4) : bouteille de bière à la cerise qui éclabousse à l'impact, dégâts autour et zombies ralentis. */
export const createKriek = (ctx: WeaponContext) => createBottleWeapon(ctx, 'kriek', WEAPON_INFO.kriek.name, KRIEK_UPGRADES, KRIEK);
