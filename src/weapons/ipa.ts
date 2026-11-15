import { IPA, IPA_UPGRADES } from '../config/arsenal';
import { WEAPON_INFO } from '../config/weapons';
import { createBottleWeapon } from './bottleWeapon';
import type { WeaponContext } from './weapon';

/** IPA (GDD section 6, n° 6) : bouteille qui met le feu, le zombie touché brûle quelques secondes. */
export const createIpa = (ctx: WeaponContext) => createBottleWeapon(ctx, 'ipa', WEAPON_INFO.ipa.name, IPA_UPGRADES, IPA);
