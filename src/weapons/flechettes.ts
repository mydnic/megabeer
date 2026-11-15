import { FLECHETTES, FLECHETTES_UPGRADES } from '../config/arsenal';
import { WEAPON_INFO } from '../config/weapons';
import { createBottleWeapon } from './bottleWeapon';
import type { WeaponContext } from './weapon';

/** Fléchettes (GDD section 6, n° 19) : tir tendu sur le zombie le plus solide à portée, souvent critique. */
export const createFlechettes = (ctx: WeaponContext) => createBottleWeapon(ctx, 'flechettes', WEAPON_INFO.flechettes.name, FLECHETTES_UPGRADES, FLECHETTES);
