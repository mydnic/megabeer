import { PETANQUE, PETANQUE_UPGRADES } from '../config/arsenal';
import { WEAPON_INFO } from '../config/weapons';
import { createBottleWeapon } from './bottleWeapon';
import type { WeaponContext } from './weapon';

/** Boules de pétanque (GDD section 6, n° 21) : lancées en cloche, elles rebondissent au sol et roulent dans la horde. */
export const createPetanque = (ctx: WeaponContext) => createBottleWeapon(ctx, 'petanque', WEAPON_INFO.petanque.name, PETANQUE_UPGRADES, PETANQUE);
