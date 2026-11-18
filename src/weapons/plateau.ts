import { PLATEAU, PLATEAU_UPGRADES } from '../config/arsenal';
import { WEAPON_INFO } from '../config/weapons';
import { createBottleWeapon } from './bottleWeapon';
import type { WeaponContext } from './weapon';

/**
 * Plateau de serveur (GDD section 6, n° 16), arme de la Serveuse : lancé à plat comme un frisbee sur le zombie le plus
 * proche, il ricoche de zombie en zombie et arrête au passage les bouteilles ennemies qu'il frôle.
 */
export const createPlateau = (ctx: WeaponContext) => createBottleWeapon(ctx, 'plateau', WEAPON_INFO.plateau.name, PLATEAU_UPGRADES, PLATEAU);
