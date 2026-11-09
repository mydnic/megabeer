// Armes (GDD section 6). Chaque arme est une entrée de config ; les chiffres se calent en jouant.

export const WEAPONS = {
  /** Blonde : bouteille lancée vers le zombie le plus proche (arme de départ du Buveur). */
  blonde: {
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

/** Apparence de la bouteille de Blonde (modèle Quaternius recoloré). */
export const BOTTLE_LOOK = {
  file: 'Bottle.glb',
  /** Longueur de la bouteille en jeu (m). */
  length: 0.42,
  /** Couleurs : verre ambré, capsule, étiquette dorée de Blonde. */
  colors: { DarkGreen: 0x8a4512, BottleCap: 0xd8b14a, LightBrown: 0xf2d27a } as Record<string, number>,
} as const;
