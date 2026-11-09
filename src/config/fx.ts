// Effets visuels (GDD section 15, « juice »).

/** Une gerbe de morceaux projetés (fx/shards.ts). */
export type ShardLook = {
  /** Nombre maxi de morceaux en même temps, et par gerbe. */
  max: number;
  perBurst: number;
  /** Taille d'un morceau (m), vitesse de la gerbe (m/s), poussée vers l'avant et vers le haut. */
  size: number;
  speed: number;
  forward: number;
  upward: number;
  /** Rotation (rad/s), durée de vie (s). */
  spin: number;
  life: number;
  /** Couleur, et part lumineuse (pour qu'il scintille). */
  color: number;
  glow: number;
  /** Forme : éclat plat (par défaut) ou goutte. */
  shape?: 'shard' | 'drop';
};

/** Éclats de verre quand une bouteille se brise. */
export const GLASS_SHARDS = {
  max: 600,
  perBurst: 9,
  /** Taille d'un éclat (m), vitesse de la gerbe (m/s), poussée vers l'avant et vers le haut. */
  size: 0.06,
  speed: 4.5,
  forward: 2.5,
  upward: 3.5,
  /** Rotation (rad/s), durée de vie (s). */
  spin: 30,
  life: 0.9,
  /** Verre ambré, légèrement lumineux pour qu'il scintille. */
  color: 0xe08a2a,
  glow: 0.9,
} as const satisfies ShardLook;

/** Gerbe de vin quand un Pèlerin gonflé explose : grosses gouttes rouge sombre jetées en l'air. */
export const WINE_BURST = {
  max: 1200,
  perBurst: 110,
  size: 0.12,
  speed: 8.5,
  forward: 0,
  upward: 8,
  spin: 0,
  life: 1.3,
  color: 0xb0122e,
  glow: 0.6,
  shape: 'drop',
} as const satisfies ShardLook;

/** Éclats du tonneau qui vole en morceaux. */
export const BARREL_SHARDS = {
  max: 300,
  perBurst: 16,
  size: 0.16,
  speed: 6,
  forward: 0,
  upward: 5,
  spin: 18,
  life: 1.3,
  color: 0x6b4426,
  glow: 0,
} as const satisfies ShardLook;

/** Chiffres de dégâts flottants. */
export const DAMAGE_NUMBERS = {
  enabled: true,
  max: 80,
  /** Durée (s), montée (m), écart horizontal aléatoire (px). */
  life: 0.7,
  rise: 1.1,
  jitter: 18,
  /** Couleur normale et taille de police (px). */
  color: '#fff6dc',
  size: 24,
  /** Coup critique (GDD : critiques en gros) : couleur, taille relative, suffixe. */
  critColor: '#ffc93a',
  critScale: 1.6,
  critSuffix: ' !',
} as const;

/** Étincelles dorées d'un coup amorti par le halo d'un porte-reliques. */
export const SHIELD_SPARKS = {
  max: 400,
  perBurst: 8,
  size: 0.05,
  speed: 3.5,
  forward: -1.5,
  upward: 3,
  spin: 20,
  life: 0.5,
  color: 0xffd35a,
  glow: 1.4,
} as const satisfies ShardLook;

