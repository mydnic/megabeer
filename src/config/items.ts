// Objets passifs (GDD section 7) : ils ne sortent que des coffres. Chaque objet a une rareté qui
// multiplie son effet (RARITIES : x1 à x4), sauf `fixed`. Premier lot : les objets du GDD dont
// l'effet est une stat déjà en jeu ; les autres arrivent un par un.
import type { StatId } from './pumps';

export type ItemDef = {
  name: string;
  /** Stat touchée (mêmes stats que les bonus de pompe), effet en Commun. */
  stat: StatId;
  value: number;
  fixed?: boolean;
  /** Rareté minimum pour qu'il sorte (index dans RARITIES). */
  minRarity?: number;
};

export const ITEMS = {
  biereForte: { name: 'Bière plus forte', stat: 'damage', value: 0.08 },
  tourneeRapide: { name: 'Tournée rapide', stat: 'attackSpeed', value: 0.08 },
  ventreABiere: { name: 'Ventre à bière', stat: 'maxHp', value: 15 },
  godasses: { name: 'Godasses de bar', stat: 'moveSpeed', value: 0.06 },
  // +20 % de la portée de base (5 m)
  aimantCapsules: { name: 'Aimant à capsules', stat: 'pickupRange', value: 1 },
  ticketTournee: { name: 'Ticket de tournée', stat: 'xpGain', value: 0.1 },
  trefle: { name: 'Trèfle de comptoir', stat: 'luck', value: 5 },
  deuxMains: { name: 'Deux mains', stat: 'extraProjectiles', value: 1, fixed: true, minRarity: 2 },
} as const satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;
