// Décor de la planète Abbaye : modèles retenus, échelles et densités (aucune dépendance three.js).

/** Échelle du kit Kenney cimetière (pensé en cases de 1 unité, un mur fait 0,73 de haut). */
const K = 2.4;

type Def = { source: 'kenney' | 'abbey' | 'pine'; file?: string; scale: number; cell: number };
const kenney = (file: string, scale = K, cell = 0.15): Def => ({ source: 'kenney', file, scale, cell });

export const DECOR_MODELS = {
  abbey: { source: 'abbey', scale: 1, cell: 0.25 } as Def,
  pine: { source: 'pine', scale: 1, cell: 0.15 } as Def,
  pineCrooked: kenney('pine-crooked', 2.6),
  // Tombes et croix
  graveBevel: kenney('gravestone-bevel'),
  graveBroken: kenney('gravestone-broken'),
  graveCross: kenney('gravestone-cross'),
  graveCrossLarge: kenney('gravestone-cross-large'),
  graveDecorative: kenney('gravestone-decorative'),
  graveRoof: kenney('gravestone-roof'),
  graveRound: kenney('gravestone-round'),
  graveWide: kenney('gravestone-wide'),
  graveDebris: kenney('gravestone-debris'),
  cross: kenney('cross'),
  crossWood: kenney('cross-wood'),
  crossColumn: kenney('cross-column'),
  graveMound: kenney('grave'),
  graveBorder: kenney('grave-border'),
  cryptSmall: kenney('crypt-small', K, 0.2),
  cryptLarge: kenney('crypt-large', K, 0.2),
  coffin: kenney('coffin-old'),
  // Murs, piliers, ruines
  wall: kenney('stone-wall'),
  wallDamaged: kenney('stone-wall-damaged'),
  wallColumn: kenney('stone-wall-column'),
  pillarLarge: kenney('pillar-large'),
  pillarSquare: kenney('pillar-square'),
  pillarObelisk: kenney('pillar-obelisk'),
  columnLarge: kenney('column-large'),
  altar: kenney('altar-stone'),
  debris: kenney('debris'),
  debrisWood: kenney('debris-wood'),
  // Grilles
  ironFence: kenney('iron-fence'),
  ironFenceDamaged: kenney('iron-fence-damaged'),
  ironFenceGate: kenney('iron-fence-border-gate'),
  // Lumières (éclairent la nuit)
  lantern: kenney('lantern-candle'),
  lanternGlass: kenney('lantern-glass'),
  lightpost: kenney('lightpost-single'),
  lightpostDouble: kenney('lightpost-double'),
  fireBasket: kenney('fire-basket', 2.8),
  candles: kenney('candle-multiple'),
  // Nature et divers
  rocks: kenney('rocks', 2.6),
  rocksTall: kenney('rocks-tall', 2.6),
  trunk: kenney('trunk'),
  trunkLong: kenney('trunk-long'),
  bench: kenney('bench'),
  benchDamaged: kenney('bench-damaged'),
  hayBale: kenney('hay-bale'),
  urn: kenney('urn-round'),
  shovelDirt: kenney('shovel-dirt'),
} as const;

export type DecorModelId = keyof typeof DECOR_MODELS;

/** Modèles qui portent une lumière la nuit, et la hauteur de la flamme (m). */
export const LIGHT_SOURCES: Partial<Record<DecorModelId, number>> = {
  lantern: 0.6, lanternGlass: 0.6, lightpost: 2.7, lightpostDouble: 2.7, fireBasket: 0.6, candles: 0.3,
};

/** Direction (depuis le centre de la planète) de l'abbaye, point de départ du joueur. */
export const ABBEY_DIR = [0.545, 0.743, 0.354] as const;

export const DECOR_LAYOUT = {
  seed: 20261106,
  /** Rayon de l'enclos de l'abbaye (terrain aplani, pas de décor aléatoire). */
  abbeyRadius: 34,
  abbeyBlend: 18,
  /** Pas de décor au-dessus de cette altitude ni sur les pentes plus raides (tangente). */
  maxAltitude: 13,
  maxSlope: 0.45,
  /** Points tirés au hasard sur la planète pour le décor isolé (forêts, rochers). */
  scatterCandidates: 14000,
  /** Nombre d'amas de ruines et de cimetières répartis sur la planète. */
  ruinClusters: 26,
  graveyardClusters: 16,
} as const;

/** Lumières des lanternes la nuit : un petit nombre de vraies lumières, sur les plus proches. */
export const DECOR_LIGHTS = {
  count: 6,
  color: 0xffa64a,
  intensity: 9,
  distance: 11,
  /** Au-delà de cette distance au joueur, une lanterne n'a pas de vraie lumière. */
  range: 40,
} as const;
