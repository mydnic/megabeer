import { SOUS_BOCK, SOUS_BOCK_UPGRADES } from '../config/arsenal';
import { WEAPON_INFO } from '../config/weapons';
import { createBottleWeapon } from './bottleWeapon';
import type { WeaponContext } from './weapon';

/** Dessous de verre (GDD section 6, n° 11) : lancé à plat comme un frisbee, il file droit et traverse plusieurs zombies. */
export const createSousBock = (ctx: WeaponContext) => createBottleWeapon(ctx, 'sousBock', WEAPON_INFO.sousBock.name, SOUS_BOCK_UPGRADES, SOUS_BOCK);
