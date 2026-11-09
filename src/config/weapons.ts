// Armes (GDD section 6). Chaque arme est une entrée de config ; les chiffres se calent en jouant.

export const WEAPONS = {
  /** Canette : canette de bière lancée vers le zombie le plus proche (arme de départ du Buveur). */
  canette: {
    /** Temps entre deux lancers (s). */
    cooldown: 1.0,
    damage: 16,
    /** Coup critique : chance de base (0 à 1) et multiplicateur de dégâts de base (GDD : x2). */
    critChance: 0.05,
    critMult: 2,
    /** Portée de détection de la cible (m). */
    range: 18,
    /** Vitesse horizontale de la bouteille (m/s) et gravité propre (m/s², plus faible que le joueur : cloche douce). */
    speed: 17,
    gravity: 14,
    /** Rotation de la bouteille en vol (tours par seconde). */
    spinRate: 2.2,
    /** Rayon de contact de la bouteille (m), multiplié par la Taille comme le modèle. */
    radius: 0.15,
    /** Corps d'un zombie pour les impacts : hauteur et rayon (m). La bouteille s'écrase sur le premier touché. */
    zombieHeight: 1.8,
    zombieRadius: 0.4,
    /** Geste : durée à vitesse normale (s) et accélération maxi quand la cadence monte. */
    gestureDuration: 0.6,
    maxGestureRate: 4,
    /** Écart entre les bouteilles d'une même volée (s), resserré quand la cadence monte. */
    volleyGap: 0.07,
    /** Délai entre le début du geste et le lâcher (s), aligné sur l'animation « throw ». */
    releaseDelay: 0.22,
    /** Hauteur visée sur le zombie (m au-dessus de ses pieds). */
    aimHeight: 1.1,
    /** Durée de vie maxi d'une bouteille (s). */
    life: 3,
    /** Recul donné au zombie touché (multiplie le recul normal d'un coup). */
    knock: 1,
    /** Zombies traversés avant de s'écraser (0 : s'écrase sur le premier). */
    pierce: 0,
  },
  /** Stout : bouteille noire, lourde et lente ; gros dégâts, gros recul, traverse un zombie (GDD section 6, n° 2). */
  stout: {
    cooldown: 1.3,
    damage: 30,
    critChance: 0.05,
    critMult: 2,
    range: 16,
    speed: 13,
    gravity: 13,
    spinRate: 1.3,
    radius: 0.2,
    zombieHeight: 1.8,
    zombieRadius: 0.4,
    gestureDuration: 0.6,
    maxGestureRate: 4,
    volleyGap: 0.09,
    releaseDelay: 0.22,
    aimHeight: 1.1,
    life: 3,
    knock: 3,
    pierce: 1,
  },
} as const;

export type BottleWeaponId = keyof typeof WEAPONS;

/** Apparence de la bouteille de Stout (KayKit Dungeon, découpée par tools/blender/props.py). */
export const STOUT_LOOK = {
  file: 'bouteille_stout.glb',
  length: 0.4,
  /** Verre noir, étiquette crème, bouchon de liège. */
  colors: { Verre: 0x1c130d, Etiquette: 0xeadcbc, Bouchon: 0xb08a5a } as Record<string, number>,
} as const;

/** Impact de la Stout : gerbe de bière brune et choc sourd en plus du verre. */
export const STOUT_IMPACT = {
  sample: 'impactPunch_heavy',
  volume: 0.55,
  pitch: 0.8,
} as const;

/**
 * Synergies (GDD section 6) : actives quand toutes les armes de `weapons` sont équipées.
 * Black and Tan : un zombie touché par la Stout (`marker`) est sonné `duration` s ; pendant ce temps,
 * la Canette (`boosted`) lui fait `mult` fois ses dégâts. Sonné ne l'arrête pas : c'est une marque.
 */
export const SYNERGIES = {
  blackAndTan: { name: 'Black and Tan', weapons: ['canette', 'stout'], marker: 'stout', boosted: 'canette', duration: 2, mult: 2 },
} as const satisfies Record<string, { name: string; weapons: readonly BottleWeaponId[]; marker: BottleWeaponId; boosted: BottleWeaponId; duration: number; mult: number }>;

/** Signe au-dessus d'un zombie sonné (Black and Tan) : bulles de mousse qui tournent autour de la tête. */
export const DAZED_LOOK = {
  /** Nombre de bulles, rayon du cercle (m), hauteur au-dessus de la tête (m), taille d'une bulle (m), tours par seconde. */
  count: 3,
  radius: 0.45,
  aboveHead: 0.3,
  size: 0.34,
  spin: 1.2,
  /** Mousse crème cerclée de brun stout. */
  fill: '#f2e3c4',
  stroke: '#3a2416',
} as const;

/** Nom de chaque arme, et sa présentation sur la carte « Nouvelle arme » du level-up. */
export const WEAPON_INFO = {
  canette: { name: 'Canette', pitch: 'Canette lancée sur le zombie le plus proche' },
  stout: { name: 'Stout', pitch: 'Lourde et lente : gros dégâts, gros recul, traverse un zombie' },
} as const satisfies Record<BottleWeaponId, { name: string; pitch: string }>;

/** Apparence de la Canette (canette de soda Kenney, découpée par tools/blender/props.py). */
export const CANETTE_LOOK = {
  file: 'canette.glb',
  /** Hauteur de la canette en jeu (m, un peu exagérée pour se lire en vol). */
  length: 0.3,
  /** Couleurs : métal argenté, corps rouge comme l'icône. */
  colors: { Metal: 0xc8ccd2, Corps: 0xc8102e } as Record<string, number>,
} as const;

/** Impact de la Canette : un tintement de fer-blanc (pas de verre). */
export const CANETTE_IMPACT = {
  sample: 'impactTin_medium',
  volume: 0.4,
  pitch: 1.1,
} as const;
