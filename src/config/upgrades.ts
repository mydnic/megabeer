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
 * Une carte d'amélioration d'arme. `id` = champ des améliorations de l'arme qu'elle augmente.
 * `kind` : percent et points -> « +15 % », flat -> « +1 », mult -> « +0,15 ».
 */
export type UpgradeDef = {
  id: string;
  label: string;
  value: number;
  kind: 'percent' | 'points' | 'flat' | 'mult';
  /** Effet fixe : non multiplié par la rareté. */
  fixed?: boolean;
  /** Rareté minimum pour que la carte existe (index dans RARITIES). */
  minTier?: number;
};

/**
 * Améliorations de la Canette. `value` = effet en Commun (multiplié par le tier, sauf `fixed`).
 * `minTier` : rareté minimum pour que la carte existe (index dans RARITIES).
 * Affichage selon `kind` : percent et points -> « +15 % », flat -> « +1 », mult -> « +0,15 ».
 * (points : points de pourcentage ajoutés, ex. chances de critique 5 % -> 9 %).
 */
export const CANETTE_UPGRADES: readonly UpgradeDef[] = [
  { id: 'damage', label: 'dégâts', value: 0.15, kind: 'percent' },
  { id: 'rate', label: "vitesse d'attaque", value: 0.10, kind: 'percent' },
  { id: 'projectiles', label: 'projectile en plus', value: 1, kind: 'flat', fixed: true, minTier: 2 },
  { id: 'speed', label: 'vitesse des projectiles', value: 0.10, kind: 'percent' },
  { id: 'range', label: 'portée', value: 0.10, kind: 'percent' },
  { id: 'critChance', label: 'chances de critique', value: 0.04, kind: 'points' },
  { id: 'critMult', label: 'multiplicateur critique', value: 0.15, kind: 'mult' },
  { id: 'size', label: 'taille', value: 0.10, kind: 'percent' },
];

/** Améliorations de la Stout : comme la Canette, plus le recul et le perçage (pas de vitesse). */
export const STOUT_UPGRADES: readonly UpgradeDef[] = [
  { id: 'damage', label: 'dégâts', value: 0.15, kind: 'percent' },
  { id: 'rate', label: "vitesse d'attaque", value: 0.10, kind: 'percent' },
  { id: 'knock', label: 'recul', value: 0.20, kind: 'percent' },
  { id: 'projectiles', label: 'projectile en plus', value: 1, kind: 'flat', fixed: true, minTier: 2 },
  { id: 'pierce', label: 'zombie traversé', value: 1, kind: 'flat', fixed: true, minTier: 2 },
  { id: 'range', label: 'portée', value: 0.10, kind: 'percent' },
  { id: 'critChance', label: 'chances de critique', value: 0.04, kind: 'points' },
  { id: 'critMult', label: 'multiplicateur critique', value: 0.15, kind: 'mult' },
  { id: 'size', label: 'taille', value: 0.10, kind: 'percent' },
];

/** Améliorations du Fût qui roule : dégâts, cadence, taille du tonneau, course plus longue, recul, fûts en plus. */
export const FUT_UPGRADES: readonly UpgradeDef[] = [
  { id: 'damage', label: 'dégâts', value: 0.15, kind: 'percent' },
  { id: 'rate', label: "vitesse d'attaque", value: 0.10, kind: 'percent' },
  { id: 'size', label: 'taille du fût', value: 0.15, kind: 'percent' },
  { id: 'duration', label: 'distance parcourue', value: 0.15, kind: 'percent' },
  { id: 'knock', label: 'recul', value: 0.20, kind: 'percent' },
  { id: 'projectiles', label: 'fût en plus', value: 1, kind: 'flat', fixed: true, minTier: 2 },
  { id: 'critChance', label: 'chances de critique', value: 0.04, kind: 'points' },
  { id: 'critMult', label: 'multiplicateur critique', value: 0.15, kind: 'mult' },
];

/** Améliorations de la Gueuze : dégâts, cadence, rayon d'explosion, gueuzes en plus (sur d'autres groupes), critiques. */
export const GUEUZE_UPGRADES: readonly UpgradeDef[] = [
  { id: 'damage', label: 'dégâts', value: 0.15, kind: 'percent' },
  { id: 'rate', label: "vitesse d'attaque", value: 0.10, kind: 'percent' },
  { id: 'radius', label: "rayon d'explosion", value: 0.12, kind: 'percent' },
  { id: 'projectiles', label: 'gueuze en plus', value: 1, kind: 'flat', fixed: true, minTier: 2 },
  { id: 'critChance', label: 'chances de critique', value: 0.04, kind: 'points' },
  { id: 'critMult', label: 'multiplicateur critique', value: 0.15, kind: 'mult' },
];

/** Écran de level-up. */
export const LEVEL_UP_SCREEN = {
  cards: 3,
  /** Tant que le joueur a moins de ce nombre d'armes, une des cartes est toujours une nouvelle arme. */
  newWeaponBelow: 3,
  /** Couleur du cadre de la carte « Nouvelle arme » (les autres ont la couleur de leur rareté). */
  newWeaponColor: '#ff8a3a',
  /** Délai avant que les cartes acceptent un choix (s, évite un clic involontaire). */
  inputDelay: 0.35,
  /** Durée de l'entrée des cartes (s) : la carte choisie se soulève ensuite. */
  introTime: 0.55,
  /** Durée de la sortie (s) : la carte prise s'envole, les autres retombent, le jeu a déjà repris. */
  outTime: 0.36,
  /**
   * Cartes d'un coffre : elles jaillissent de la bouche du coffre (`mouth` : hauteur dans le coffre,
   * 0 = haut), l'une après l'autre (`stagger`), en tournoyant (`spin` degrés au départ).
   */
  fromChest: { delay: 0.18, stagger: 0.12, duration: 0.55, mouth: 0.45, spin: 25 },
} as const;
