import { createCanette } from './canette';
import { createFut } from './fut';
import { createGueuze } from './gueuze';
import { createStout } from './stout';
import { createTabouret } from './tabouret';
import { createBiereNoel } from './biereNoel';
import { createDecapsuleur } from './decapsuleur';
import { createFlaqueBiere } from './flaqueBiere';
import { createKriek } from './kriek';
import { createTriple } from './triple';
import { createIpa } from './ipa';
import { createSousBock } from './sousBock';
import { createFlechettes } from './flechettes';
import type { Weapon, WeaponContext, WeaponId } from './weapon';

/** Toutes les armes du jeu : ajouter une arme = ajouter son créateur ici. */
export const WEAPON_FACTORIES: Record<WeaponId, (ctx: WeaponContext) => Weapon> = {
  canette: createCanette,
  stout: createStout,
  fut: createFut,
  gueuze: createGueuze,
  tabouret: createTabouret,
  biereNoel: createBiereNoel,
  decapsuleur: createDecapsuleur,
  flaqueBiere: createFlaqueBiere,
  kriek: createKriek,
  triple: createTriple,
  ipa: createIpa,
  sousBock: createSousBock,
  flechettes: createFlechettes,
};
