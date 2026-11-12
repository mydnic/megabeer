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
  /** Plusieurs bulles prêtes (une par Mousse épaisse) : chacune plus large de `layerGap` m, au plus `maxLayers` visibles. */
  layerGap: 0.22, maxLayers: 5,
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
/** Poubelle cassée : éclats de tôle grise et papiers qui volent. */
export const TIN_SHARDS = {
  max: 200,
  perBurst: 12,
  size: 0.14,
  speed: 5,
  forward: 0,
  upward: 5,
  spin: 20,
  life: 1.1,
  color: 0x9aa1a6,
  glow: 0.1,
} as const satisfies ShardLook;

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

/** Particules face à la caméra (fx/sprites.ts) : réserve de particules lumineuses et de bouffées de fumée. */
export const SPRITE_FX = { maxLights: 1600, maxSmoke: 600, smokeOpacity: 0.6 } as const;

/** Look d'une explosion : éclair, braises, fumée (claire et sombre), nombre de braises et de bouffées. */
export type ExplosionLook = { flash: number; ember: number; smoke: number; smokeDark: number; embers: number; puffs: number };

/**
 * Recettes d'effets visuels (fx/vfx.ts). Tailles en mètres, durées en secondes ; `intensity` au-dessus
 * de 1 déborde dans le bloom.
 */
export const VFX = {
  /** Éclat d'un coup qui porte, et coup critique (étoile, anneau, étincelles). */
  hit: { color: 0xfff1c4, size: 1.2, life: 0.12, intensity: 1.0 },
  crit: { color: 0xffa23a, size: 2.8, life: 0.24, intensity: 2.4, sparks: 7 },
  /** Ennemi tué : bouffées de fumée claire à `height` m du sol, petit éclair. */
  kill: { smoke: 0xcfc8ae, flash: 0xfff4dc, puffs: 3, height: 0.9 },
  /** Écran chargé : part de la réserve de particules à partir de laquelle les recettes ne lancent presque plus rien. */
  crowd: 0.35,
  /** Poussière soulevée (atterrissage, fût qui éclate, projectile au sol). */
  dust: { color: 0xcdbf9a },
  /** Traînée des projectiles du joueur : couleur par arme (absente : pas de traînée). */
  trail: { size: 0.42, life: 0.17, intensity: 0.55, maxLoad: 0.3, colors: { stout: 0xd8a070, gueuze: 0xff7a9a } as Record<string, number> },
  /** Colonne de lumière (niveau gagné, coffre, pompe, Happy hour) : rayon, hauteur, durée, opacité, étincelles, réserve. */
  beam: { radius: 1.1, height: 9, life: 1.1, opacity: 0.85, sparkles: 14, max: 6 },
  /** Explosions. */
  gueuze: { flash: 0xffc0d0, ember: 0xff5a7a, smoke: 0xf2a0b4, smokeDark: 0xa8405e, embers: 14, puffs: 9 } as ExplosionLook,
  wine: { flash: 0xffd0c0, ember: 0xd23b4a, smoke: 0x9a3a4e, smokeDark: 0x5a1e2e, embers: 16, puffs: 11 } as ExplosionLook,
  ash: { flash: 0xffd28a, ember: 0xff7a2a, smoke: 0x8a8580, smokeDark: 0x4a4644, embers: 10, puffs: 5 } as ExplosionLook,
  glass: { flash: 0xe8fff0, ember: 0xbfe6c8, smoke: 0xd8dccc, smokeDark: 0xa8ac9c, embers: 6, puffs: 4 } as ExplosionLook,
  /** Coffre piégé : éclair rouge, braises, fumée sombre. */
  trap: { flash: 0xffb0a0, ember: 0xff3322, smoke: 0x6a5a58, smokeDark: 0x3a2a2a, embers: 18, puffs: 9 } as ExplosionLook,
  /** Couleurs : niveau gagné, soin, coup reçu, gel, mousse, invocation, capsules, gouttes d'XP. */
  colors: { level: 0xffd45a, hurt: 0xff4a3a, ice: 0xa8e4ff, foam: 0xfff4dc, summon: 0x8a5ac8, coin: 0xff6a5a, xp: 0xffd45a, happy: 0xffc93a, snack: 0xf2c94c, bin: 0xd8d2c0 },
  /** Scintillement des cloches au sol (étoiles par seconde, x4). */
  twinkleRate: 9,
  /** Étincelles quand le joueur ramasse de l'XP ou des capsules : écart mini entre deux (s). */
  pickupGap: 0.07,
} as const;

/** Chiffres de dégâts flottants. */
export const DAMAGE_NUMBERS = {
  enabled: true,
  max: 80,
  /** Durée (s), montée (m), écart horizontal aléatoire (px). */
  life: 0.7,
  rise: 1.1,
  jitter: 18,
  /** Gonflement à l'apparition (normal, critique) et inclinaison de départ au hasard (degrés). */
  pop: 1.45,
  critPop: 2,
  tilt: 14,
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


