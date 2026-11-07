// Cartes de level-up (GDD sections 6, 8 et 9) : uniquement des armes, rareté sur 5 tiers.

/** Les 5 tiers de rareté : nom, couleur, multiplicateur d'effet, poids de tirage à LUCK 0. */
export const RARITIES = [
  { id: 'commun', name: 'Commun', color: '#f2ece0', mult: 1, weight: 60 },
  { id: 'peuCommun', name: 'Peu commun', color: '#5fd16a', mult: 1.5, weight: 25 },
  { id: 'rare', name: 'Rare', color: '#4aa8ff', mult: 2, weight: 10 },
  { id: 'dingue', name: 'Dingue', color: '#b86bff', mult: 3, weight: 4 },
  { id: 'legendaire', name: 'Légendaire', color: '#ffc93a', mult: 4, weight: 1 },
] as const;

export const LUCK = {
  /** Chaque point de LUCK ajoute perPoint x n au multiplicateur de poids du tier n (n = 0 pour Commun). */
  perPoint: 0.1,
  /** Plafond de LUCK pris en compte. */
  cap: 30,
} as const;

/**
 * Améliorations de la Blonde. `value` = effet en Commun (multiplié par le tier, sauf `fixed`).
 * `minTier` : rareté minimum pour que la carte existe (index dans RARITIES).
 */
export const BLONDE_UPGRADES = [
  { id: 'damage', label: 'dégâts', value: 0.15, kind: 'percent' },
  { id: 'rate', label: 'cadence', value: 0.10, kind: 'percent' },
  { id: 'projectiles', label: 'bouteille en plus', value: 1, kind: 'flat', fixed: true, minTier: 2 },
  { id: 'speed', label: 'vitesse des bouteilles', value: 0.10, kind: 'percent' },
  { id: 'range', label: 'portée', value: 0.10, kind: 'percent' },
] as const;

/** Écran de level-up. */
export const LEVEL_UP_SCREEN = {
  cards: 3,
  /** Délai avant que les cartes acceptent un choix (s, évite un clic involontaire). */
  inputDelay: 0.35,
} as const;
