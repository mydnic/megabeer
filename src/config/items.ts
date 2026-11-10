// Objets passifs (GDD section 7) : ils ne sortent que des coffres. Chaque objet a une rareté qui
// multiplie son effet (RARITIES : x1 à x4), sauf `fixed`. Deux sortes : les objets à stat (même stat
// que les bonus de pompe) et les objets à effet spécial (un déclencheur et un effet, réglés dans
// ITEM_EFFECTS). Les copies d'un même objet s'additionnent.
import type { StatId } from './pumps';

/** Effets spéciaux des objets (un par objet pour l'instant). */
export type EffectId = 'explodeOnKill' | 'foamShield' | 'happyHour' | 'healOnXp';

export type ItemDef = {
  name: string;
  /** Objet à stat : la stat touchée. */
  stat?: StatId;
  /** Objet à effet spécial : l'effet (sa valeur `value` est expliquée dans ITEM_EFFECTS). */
  effect?: EffectId;
  /** Effet en Commun. */
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
  // Effets spéciaux
  cendrier: { name: 'Cendrier', effect: 'explodeOnKill', value: 0.05 },
  mousseEpaisse: { name: 'Mousse épaisse', effect: 'foamShield', value: 0.05 },
  happyHour: { name: 'Happy hour', effect: 'happyHour', value: 8 },
  cacahuetes: { name: 'Sachet de cacahuètes', effect: 'healOnXp', value: 0.2 },
} as const satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;

/**
 * Réglages des effets spéciaux. La `value` de chaque objet (multipliée par la rareté, copies
 * additionnées) est :
 * - explodeOnKill (Cendrier) : chance qu'un ennemi tué explose (plafonnée à `maxChance`) ; l'explosion
 *   blesse les ennemis dans `radius` m de `damage` (suit les PV des ennemis au fil de la run et la stat
 *   Dégâts), jamais le joueur ; un ennemi tué par l'explosion peut exploser à son tour.
 * - foamShield (Mousse épaisse) : recharges du bouclier par seconde (0,05 = 1 toutes les 20 s) ; le
 *   bouclier absorbe un coup entier, une charge à la fois.
 * - happyHour : durée (s) de la vitesse d'attaque multipliée par `rate`, toutes les `every` s.
 * - healOnXp (Sachet de cacahuètes) : PV soignés par goutte d'XP ramassée.
 */
export const ITEM_EFFECTS = {
  explodeOnKill: { radius: 3.5, damage: 30, maxChance: 0.5 },
  happyHour: { every: 60, rate: 2 },
} as const;
