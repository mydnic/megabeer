// Ce que chaque arme montre et fait entendre (GDD section 6), réuni en une table : ajouter une arme = y ajouter
// sa ligne (TypeScript l'exige). Lue par main.ts (rendu des projectiles), app/effects.ts (impacts), app/sounds.ts
// (son au coup) et app/runLogging.ts (réglages notés dans le journal de run).

import type { WeaponId } from '../weapons/weapon';
import type { ZoneLook } from '../fx/zoneView';
import { BIERE_NOEL, BIERE_NOEL_LOOK, BIERE_NOEL_SOUND, DECAPSULEUR, DECAPSULEUR_LOOK, DECAPSULEUR_SOUND, FLAQUE_BIERE, FLAQUE_BIERE_ZONE, FLAQUE_BIERE_SOUND, KRIEK, KRIEK_LOOK, BOTTLE_SOUNDS, TRIPLE, TRIPLE_LOOK, IPA, IPA_LOOK, SOUS_BOCK, SOUS_BOCK_LOOK, FLECHETTES, FLECHETTES_LOOK, BOUCHONS, BOUCHONS_LOOK, MORE_SOUNDS, PETANQUE, PETANQUE_LOOK, BAC, BAC_LOOK, VOMI, VOMI_LOOK, VOMI_ZONE } from './arsenal';
import { CANETTE_LOOK, FUT, FUT_LOOK, FUT_SOUND, GUEUZE, GUEUZE_LOOK, STOUT_IMPACT, STOUT_LOOK, TABOURET, TABOURET_LOOK, TABOURET_SOUND, WEAPONS } from './weapons';

/** Modèle d'un projectile en vol : fichier, longueur en jeu (m), couleur par nom de matériau du modèle. */
export type WeaponLook = { file: string; length: number; colors: Record<string, number>; fit?: 'axis' | 'max' };
/** Un son : échantillon (audio/), volume, hauteur ; `gap` : écart minimal entre deux (s), pour les armes qui touchent en masse. */
export type WeaponSound = { sample: string; volume: number; pitch: number; gap?: number };

export type WeaponFx = {
  /** Modèle des projectiles (absent : l'arme n'a pas de projectile à dessiner, ou les dessine elle-même). */
  look?: WeaponLook;
  /** Zones au sol de l'arme (flaques) : leur apparence. */
  zone?: ZoneLook;
  /** Sur un zombie touché : giclée de bière blonde (nombre de gouttes), éclats de verre, gerbe de bière brune. */
  impact: { splash?: number; glass?: boolean; stout?: boolean };
  /** Au sol (projectile qui retombe sans toucher) : giclée de bière, éclats de verre ; absent : giclée et verre. */
  ground?: { splash?: number; glass?: boolean };
  /** Son au coup sur un zombie. */
  hitSound?: WeaponSound;
  /** Réglages de l'arme, notés dans le journal de run. */
  settings: object;
};

export const WEAPON_FX: Record<WeaponId, WeaponFx> = {
  canette: { look: CANETTE_LOOK, impact: { splash: 14 }, ground: { splash: 10 }, settings: WEAPONS.canette },
  stout: { look: STOUT_LOOK, impact: { glass: true, stout: true }, hitSound: STOUT_IMPACT, settings: WEAPONS.stout },
  fut: { look: FUT_LOOK, impact: {}, hitSound: FUT_SOUND.crush, settings: FUT },
  gueuze: { look: GUEUZE_LOOK, impact: {}, settings: GUEUZE },
  tabouret: { look: TABOURET_LOOK, impact: {}, hitSound: { ...TABOURET_SOUND.hit, gap: TABOURET_SOUND.hitGap }, settings: TABOURET },
  biereNoel: { look: BIERE_NOEL_LOOK, impact: { splash: 6 }, hitSound: BIERE_NOEL_SOUND, settings: BIERE_NOEL },
  decapsuleur: { look: DECAPSULEUR_LOOK, impact: { splash: 4 }, hitSound: DECAPSULEUR_SOUND, settings: DECAPSULEUR },
  flaqueBiere: { zone: FLAQUE_BIERE_ZONE, impact: { splash: 8 }, hitSound: FLAQUE_BIERE_SOUND, settings: FLAQUE_BIERE },
  kriek: { look: KRIEK_LOOK, impact: { glass: true }, hitSound: BOTTLE_SOUNDS.kriek, settings: KRIEK },
  triple: { look: TRIPLE_LOOK, impact: { splash: 10, glass: true }, hitSound: BOTTLE_SOUNDS.triple, settings: TRIPLE },
  ipa: { look: IPA_LOOK, impact: { glass: true }, hitSound: BOTTLE_SOUNDS.ipa, settings: IPA },
  sousBock: { look: SOUS_BOCK_LOOK, impact: {}, ground: {}, hitSound: BOTTLE_SOUNDS.sousBock, settings: SOUS_BOCK },
  flechettes: { look: FLECHETTES_LOOK, impact: {}, ground: {}, hitSound: BOTTLE_SOUNDS.flechettes, settings: FLECHETTES },
  bouchons: { look: BOUCHONS_LOOK, impact: {}, ground: {}, hitSound: MORE_SOUNDS.bouchons, settings: BOUCHONS },
  petanque: { look: PETANQUE_LOOK, impact: {}, ground: {}, hitSound: MORE_SOUNDS.petanque, settings: PETANQUE },
  bac: { look: BAC_LOOK, impact: { splash: 16, glass: true }, hitSound: MORE_SOUNDS.bac, settings: BAC },
  vomi: { look: VOMI_LOOK, zone: VOMI_ZONE, impact: {}, ground: {}, hitSound: MORE_SOUNDS.vomi, settings: VOMI },
};
