// Skill tree (GDD section 14) : la puissance permanente, achetée avec les TUNAS. Choix de l'utilisateur le 2026-11-13 :
// une grille par catégories ; chaque catégorie est une ligne de paliers, à acheter dans l'ordre (il faut le précédent
// pour acheter le suivant). Tout ce qui n'est pas persos, armes et objets (la boutique) passe par ici.
// Prix visés : l'arbre complet vaut environ 45 runs moyennes (GDD), soit environ 4 500 TUNAS.

import type { ItemStatId } from './items';
import type { CardOptionId } from './shop';

/**
 * Bonus des lignes de la radio, du Super Saiyan et des véhicules (demande de l'utilisateur le 2026-11-19), en part du
 * réglage de base (0,4 = +40 %) sauf `saiyanTime` (s en plus).
 */
export type PerkId = 'radioHp' | 'saiyanGain' | 'saiyanTime' | 'vehicleTime' | 'vehicleHp' | 'vehicleCrush';
export const PERK_IDS: readonly PerkId[] = ['radioHp', 'saiyanGain', 'saiyanTime', 'vehicleTime', 'vehicleHp', 'vehicleCrush'];

/** Ce que donne un palier : un bonus de stat au début de chaque run, des utilisations d'une option de cartes, ou un bonus de mécanique. */
export type SkillEffect = { stat: ItemStatId; value: number } | { option: CardOptionId; uses: number } | { perk: PerkId; value: number };

export type SkillTier = { text: string; effect: SkillEffect };
export type SkillLine = { id: string; name: string; color: string; tiers: readonly SkillTier[] };

/** Prix de chaque palier d'une ligne, dans l'ordre (le 1er palier coûte `SKILL_PRICES[0]`). */
export const SKILL_PRICES = [40, 80, 130, 200, 300] as const;

const stat = (s: ItemStatId, value: number, text: string, n = 5): SkillTier[] =>
  Array.from({ length: n }, () => ({ text, effect: { stat: s, value } }));

export const SKILL_LINES: readonly SkillLine[] = [
  { id: 'force', name: 'Force', color: '#e2453a', tiers: stat('damage', 0.05, '+5 % dégâts') },
  { id: 'cadence', name: 'Cadence', color: '#f5a623', tiers: stat('attackSpeed', 0.04, "+4 % vitesse d'attaque") },
  { id: 'carrure', name: 'Carrure', color: '#5fc46a', tiers: stat('maxHp', 10, '+10 PV max') },
  { id: 'jambes', name: 'Jambes', color: '#4aa8ff', tiers: stat('moveSpeed', 0.03, '+3 % vitesse') },
  { id: 'aimant', name: 'Aimant', color: '#b86bff', tiers: stat('pickupRange', 0.5, "+0,5 m de portée d'attraction") },
  {
    id: 'cartes', name: 'Cartes', color: '#ffc93a', tiers: [
      { text: 'Relancer : 3 nouvelles cartes, 1 fois par run', effect: { option: 'reroll', uses: 1 } },
      { text: 'Bannir : retirer une carte pour la run, 1 fois', effect: { option: 'banish', uses: 1 } },
      { text: 'Passer : ne rien prendre, 1 fois par run', effect: { option: 'skip', uses: 1 } },
      { text: '+1 Relancer par run', effect: { option: 'reroll', uses: 1 } },
      { text: '+1 Bannir par run', effect: { option: 'banish', uses: 1 } },
    ],
  },
  {
    id: 'radio', name: 'Radio', color: '#c8402a', tiers: Array.from({ length: 5 }, () => ({ text: '+40 % PV de la radio planquée', effect: { perk: 'radioHp', value: 0.4 } as SkillEffect })),
  },
  {
    id: 'saiyan', name: 'Super Saiyan', color: '#ffd23a', tiers: [
      { text: 'Jauge de colère +15 % plus rapide', effect: { perk: 'saiyanGain', value: 0.15 } },
      { text: 'Transformation +10 s', effect: { perk: 'saiyanTime', value: 10 } },
      { text: 'Jauge de colère +15 % plus rapide', effect: { perk: 'saiyanGain', value: 0.15 } },
      { text: 'Transformation +10 s', effect: { perk: 'saiyanTime', value: 10 } },
      { text: 'Jauge de colère +20 % plus rapide', effect: { perk: 'saiyanGain', value: 0.2 } },
    ],
  },
  {
    id: 'vehicules', name: 'Véhicules', color: '#5fd1ff', tiers: [
      { text: 'Véhicules : +25 % de durée', effect: { perk: 'vehicleTime', value: 0.25 } },
      { text: 'Véhicules : +40 % PV', effect: { perk: 'vehicleHp', value: 0.4 } },
      { text: 'Écrasement : +30 % dégâts', effect: { perk: 'vehicleCrush', value: 0.3 } },
      { text: 'Véhicules : +25 % de durée', effect: { perk: 'vehicleTime', value: 0.25 } },
      { text: 'Véhicules : +40 % PV', effect: { perk: 'vehicleHp', value: 0.4 } },
    ],
  },
];
