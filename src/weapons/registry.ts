import { createCanette } from './canette';
import { createFut } from './fut';
import { createGueuze } from './gueuze';
import { createStout } from './stout';
import { createTabouret } from './tabouret';
import { createSabre } from './sabre';
import { createBiereNoel } from './biereNoel';
import { createDecapsuleur } from './decapsuleur';
import { createFlaqueBiere } from './flaqueBiere';
import { createKriek } from './kriek';
import { createTriple } from './triple';
import { createIpa } from './ipa';
import { createSousBock } from './sousBock';
import { createFlechettes } from './flechettes';
import { createBouchons } from './bouchons';
import { createPetanque } from './petanque';
import { createBac } from './bac';
import { createVomi } from './vomi';
import { createWeizen } from './weizen';
import { createTireuse } from './tireuse';
import { createCorne } from './corne';
import { createRot } from './rot';
import { createOdeur } from './odeur';
import { createPlateau } from './plateau';
import { createDes421 } from './des421';
import type { Weapon, WeaponContext, WeaponId } from './weapon';

/** Toutes les armes du jeu : ajouter une arme = ajouter son créateur ici. */
export const WEAPON_FACTORIES: Record<WeaponId, (ctx: WeaponContext) => Weapon> = {
  canette: createCanette,
  stout: createStout,
  fut: createFut,
  gueuze: createGueuze,
  tabouret: createTabouret,
  sabre: createSabre,
  biereNoel: createBiereNoel,
  decapsuleur: createDecapsuleur,
  flaqueBiere: createFlaqueBiere,
  kriek: createKriek,
  triple: createTriple,
  ipa: createIpa,
  sousBock: createSousBock,
  flechettes: createFlechettes,
  bouchons: createBouchons,
  petanque: createPetanque,
  bac: createBac,
  vomi: createVomi,
  weizen: createWeizen,
  tireuse: createTireuse,
  corne: createCorne,
  rot: createRot,
  odeur: createOdeur,
  plateau: createPlateau,
  des421: createDes421,
};
