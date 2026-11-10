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

/** Gerbe de bière brune quand une Stout éclate sur un zombie. */
export const STOUT_SPLASH = {
  max: 600,
  perBurst: 40,
  size: 0.1,
  speed: 5.5,
  forward: 1.5,
  upward: 4,
  spin: 0,
  life: 0.9,
  color: 0x2a1a10,
  glow: 0.15,
  shape: 'drop',
} as const satisfies ShardLook;

/** Explosion de la Gueuze : gerbe de bière framboise tout autour. */
export const GUEUZE_BURST = {
  max: 1500,
  perBurst: 120,
  size: 0.11,
  speed: 9,
  forward: 0,
  upward: 7,
  spin: 0,
  life: 1.1,
  color: 0xd6305e,
  glow: 0.5,
  shape: 'drop',
} as const satisfies ShardLook;

/** Cendrier : un ennemi tué explose en nuage de cendres grises... */
export const ASH_BURST = {
  max: 1200, perBurst: 70, size: 0.13, speed: 6, forward: 0, upward: 4, spin: 6, life: 1.0,
  color: 0x6e6a66, glow: 0.05, shape: 'drop',
} as const satisfies ShardLook;

/** ...et en braises orange qui retombent. */
export const EMBERS = {
  max: 600, perBurst: 26, size: 0.05, speed: 7, forward: 0, upward: 6, spin: 0, life: 1.2,
  color: 0xff7a2a, glow: 1.2, shape: 'drop',
} as const satisfies ShardLook;

/** Mousse épaisse : la bulle qui éclate quand elle absorbe un coup. */
export const FOAM_POP = {
  max: 400, perBurst: 60, size: 0.1, speed: 5, forward: 0, upward: 3, spin: 0, life: 0.7,
  color: 0xfff4dc, glow: 0.4, shape: 'drop',
} as const satisfies ShardLook;

/**
 * Bulle du bouclier de mousse autour du Buveur : rayon (m), hauteur de son centre au-dessus des
 * pieds, couleur, opacité du bord (`rim` : plus grand = bord plus fin), temps pour gonfler (s),
 * respiration (rad/s, amplitude).
 */
export const FOAM_SHIELD_LOOK = {
  radius: 1.25, height: 1.0, color: 0xfff4dc, opacity: 0.6, rim: 2.5, growTime: 0.35, breathe: 3, breatheAmount: 0.03,
} as const;

/** Glaçons, Sifflet : éclats de glace quand un ennemi gèle. */
export const ICE_SHARDS = {
  max: 600, perBurst: 10, size: 0.09, speed: 3.5, forward: 0, upward: 3, spin: 12, life: 0.7,
  color: 0xbfe6ff, glow: 0.8,
} as const satisfies ShardLook;

/** Coffre gratuit du Bonnet : pluie d'étincelles dorées à son arrivée. */
export const GIFT_SPARKS = {
  max: 200, perBurst: 40, size: 0.07, speed: 5, forward: 0, upward: 6, spin: 0, life: 1.0,
  color: 0xffc93a, glow: 1.2, shape: 'drop',
} as const satisfies ShardLook;

/**
 * Ondes au sol (Sifflet, Juke-box, Seconde tournée) : épaisseur de l'anneau (part du rayon), opacité,
 * durée (s), hauteur au-dessus du sol (m), couleur de chaque onde.
 */
export const RING_WAVE = {
  thickness: 0.12, opacity: 0.8, life: 0.55, lift: 0.15,
  colors: { whistle: 0xffffff, shockwave: 0xffc93a, revive: 0xfff4dc },
} as const;

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

/** Mottes de terre projetées quand un squelette du Prieur sort du sol. */
export const EARTH_CLODS = {
  max: 300,
  perBurst: 10,
  size: 0.12,
  speed: 3,
  forward: 0,
  upward: 4.5,
  spin: 12,
  life: 0.9,
  color: 0x4a3524,
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


