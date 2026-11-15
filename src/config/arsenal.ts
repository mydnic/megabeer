// Armes du roster V1 ajoutées après les cinq premières (GDD section 6) : une entrée de réglages par arme, son
// apparence et ses cartes d'amélioration. Les cinq premières vivent dans config/weapons.ts et config/upgrades.ts.

import type { UpgradeDef } from './upgrades';

const DMG: UpgradeDef = { id: 'damage', label: 'dégâts', value: 0.15, kind: 'percent' };
const CRIT: UpgradeDef = { id: 'critChance', label: 'chances de critique', value: 0.04, kind: 'points' };
const CRITM: UpgradeDef = { id: 'critMult', label: 'multiplicateur critique', value: 0.15, kind: 'mult' };

/**
 * Bière de Noël (n° 9) : des bouteilles tournent sans arrêt autour du joueur et frappent les zombies qu'elles
 * traversent (chaque zombie au plus une fois toutes les `rehit` s par bouteille). Défense rapprochée.
 */
export const BIERE_NOEL = {
  damage: 9,
  critChance: 0.05,
  critMult: 2,
  /** Rayon de l'orbite (m, multiplié par la Taille), hauteur des bouteilles (m), tours par seconde (x Vitesse d'attaque). */
  radius: 2.3,
  height: 1.0,
  turnsPerSecond: 0.55,
  /** Rayon de contact d'une bouteille et corps d'un zombie (m). */
  hitRadius: 0.35,
  zombieRadius: 0.4,
  /** Un même zombie n'est frappé qu'une fois toutes les `rehit` s par bouteille. */
  rehit: 0.6,
  /** Recul (fois le recul normal). */
  knock: 1.2,
  /** Nombre de bouteilles au départ. */
  count: 2,
} as const;

export const BIERE_NOEL_LOOK = {
  file: 'bouteille_stout.glb',
  length: 0.55,
  /** Verre vert sapin, étiquette rouge, capsule dorée. */
  colors: { Verre: 0x1f5a2c, Etiquette: 0xc8102e, Bouchon: 0xe8b33a } as Record<string, number>,
} as const;

export const BIERE_NOEL_SOUND = { sample: 'impactGlass_light', volume: 0.35, pitch: 1.2, gap: 0.06 } as const;

export const BIERE_NOEL_UPGRADES: readonly UpgradeDef[] = [
  DMG,
  { id: 'rate', label: 'vitesse de rotation', value: 0.12, kind: 'percent' },
  { id: 'projectiles', label: 'bouteille en plus', value: 1, kind: 'flat', whole: true },
  { id: 'size', label: "rayon de l'orbite", value: 0.10, kind: 'percent' },
  CRIT, CRITM,
];

