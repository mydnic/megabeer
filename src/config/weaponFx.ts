// Ce que chaque arme montre et fait entendre (GDD section 6), réuni en une table : ajouter une arme = y ajouter
// sa ligne (TypeScript l'exige). Lue par main.ts (rendu des projectiles), app/effects.ts (impacts), app/sounds.ts
// (son au coup) et app/runLogging.ts (réglages notés dans le journal de run).

import type { WeaponId } from '../weapons/weapon';
import type { ZoneLook } from '../fx/zoneView';
import { BIERE_NOEL, BIERE_NOEL_LOOK, BIERE_NOEL_SOUND, DECAPSULEUR, DECAPSULEUR_LOOK, DECAPSULEUR_SOUND, FLAQUE_BIERE, FLAQUE_BIERE_ZONE, FLAQUE_BIERE_SOUND, KRIEK, KRIEK_LOOK, BOTTLE_SOUNDS, TRIPLE, TRIPLE_LOOK, IPA, IPA_LOOK, SOUS_BOCK, SOUS_BOCK_LOOK, FLECHETTES, FLECHETTES_LOOK, BOUCHONS, BOUCHONS_LOOK, MORE_SOUNDS, PETANQUE, PETANQUE_LOOK, BAC, BAC_LOOK, VOMI, VOMI_LOOK, VOMI_ZONE, WEIZEN, WEIZEN_ZONE, ZONE_SOUNDS, TIREUSE, CORNE, ROT, ODEUR, ODEUR_ZONE, PLATEAU, PLATEAU_LOOK, DES_421, DES_421_LOOK } from './arsenal';
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
  /**
   * Explosion de l'arme (ctx.explode) : gerbe rose de la Gueuze (par défaut), bière et verre (Bac), ou onde au sol de
   * la couleur donnée (Rot, Corne de brume) ; son de l'explosion (sinon celui de la Gueuze).
   */
  blast?: { style: 'gueuze' | 'glass' | 'ring'; color?: number; sound?: WeaponSound };
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
  bac: { look: BAC_LOOK, impact: { splash: 16, glass: true }, blast: { style: 'glass', sound: { sample: 'impactGlass_heavy', volume: 0.6, pitch: 0.9 } }, hitSound: MORE_SOUNDS.bac, settings: BAC },
  vomi: { look: VOMI_LOOK, zone: VOMI_ZONE, impact: {}, ground: {}, hitSound: MORE_SOUNDS.vomi, settings: VOMI },
  weizen: { zone: WEIZEN_ZONE, impact: {}, hitSound: ZONE_SOUNDS.weizen, settings: WEIZEN },
  tireuse: { impact: { splash: 4 }, hitSound: ZONE_SOUNDS.tireuse, settings: TIREUSE },
  corne: { impact: {}, blast: { style: 'ring', color: 0xd8f0ff, sound: { sample: 'impactSoft_heavy', volume: 0.6, pitch: 0.45 } }, hitSound: ZONE_SOUNDS.corne, settings: CORNE },
  rot: { impact: {}, blast: { style: 'ring', color: 0xb8f070, sound: { sample: 'impactPunch_heavy', volume: 0.7, pitch: 0.5 } }, hitSound: ZONE_SOUNDS.rot, settings: ROT },
  odeur: { zone: ODEUR_ZONE, impact: {}, hitSound: ZONE_SOUNDS.odeur, settings: ODEUR },
  plateau: { look: PLATEAU_LOOK, impact: {}, blast: { style: 'ring', color: 0xe8ecf2, sound: { sample: 'impactPlate_heavy', volume: 0.6, pitch: 1.0 } }, settings: PLATEAU },
  des421: { look: DES_421_LOOK, impact: {}, ground: {}, blast: { style: 'gueuze', sound: { sample: 'impactBell_heavy', volume: 0.6, pitch: 1.2 } }, hitSound: { sample: 'impactWood_light', volume: 0.4, pitch: 1.6, gap: 0.03 }, settings: DES_421 },
};
