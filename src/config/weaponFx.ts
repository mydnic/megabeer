// Ce que chaque arme montre et fait entendre (GDD section 6), réuni en une table : ajouter une arme = y ajouter
// sa ligne (TypeScript l'exige). Lue par main.ts (rendu des projectiles), app/effects.ts (impacts), app/sounds.ts
// (son au coup) et app/runLogging.ts (réglages notés dans le journal de run).

import type { WeaponId } from '../weapons/weapon';
import { BIERE_NOEL, BIERE_NOEL_LOOK, BIERE_NOEL_SOUND, DECAPSULEUR, DECAPSULEUR_LOOK, DECAPSULEUR_SOUND } from './arsenal';
import { CANETTE_LOOK, FUT, FUT_LOOK, FUT_SOUND, GUEUZE, GUEUZE_LOOK, STOUT_IMPACT, STOUT_LOOK, TABOURET, TABOURET_LOOK, TABOURET_SOUND, WEAPONS } from './weapons';

/** Modèle d'un projectile en vol : fichier, longueur en jeu (m), couleur par nom de matériau du modèle. */
export type WeaponLook = { file: string; length: number; colors: Record<string, number>; fit?: 'axis' | 'max' };
/** Un son : échantillon (audio/), volume, hauteur ; `gap` : écart minimal entre deux (s), pour les armes qui touchent en masse. */
export type WeaponSound = { sample: string; volume: number; pitch: number; gap?: number };

export type WeaponFx = {
  /** Modèle des projectiles (absent : l'arme n'a pas de projectile à dessiner, ou les dessine elle-même). */
  look?: WeaponLook;
  /** Sur un zombie touché : giclée de bière blonde (nombre de gouttes), éclats de verre, gerbe de bière brune. */
  impact: { splash?: number; glass?: boolean; stout?: boolean };
  /** Son au coup sur un zombie. */
  hitSound?: WeaponSound;
  /** Réglages de l'arme, notés dans le journal de run. */
  settings: object;
};

export const WEAPON_FX: Record<WeaponId, WeaponFx> = {
  canette: { look: CANETTE_LOOK, impact: { splash: 14 }, settings: WEAPONS.canette },
  stout: { look: STOUT_LOOK, impact: { glass: true, stout: true }, hitSound: STOUT_IMPACT, settings: WEAPONS.stout },
  fut: { look: FUT_LOOK, impact: {}, hitSound: FUT_SOUND.crush, settings: FUT },
  gueuze: { look: GUEUZE_LOOK, impact: {}, settings: GUEUZE },
  tabouret: { look: TABOURET_LOOK, impact: {}, hitSound: { ...TABOURET_SOUND.hit, gap: TABOURET_SOUND.hitGap }, settings: TABOURET },
  biereNoel: { look: BIERE_NOEL_LOOK, impact: { splash: 6 }, hitSound: BIERE_NOEL_SOUND, settings: BIERE_NOEL },
  decapsuleur: { look: DECAPSULEUR_LOOK, impact: { splash: 4 }, hitSound: DECAPSULEUR_SOUND, settings: DECAPSULEUR },
};
