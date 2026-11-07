// Armes (GDD section 6). Chaque arme est une entrée de config ; les chiffres se calent en jouant.

export const WEAPONS = {
  /** Blonde : bouteille lancée vers le zombie le plus proche (arme de départ du Buveur). */
  blonde: {
    /** Temps entre deux lancers (s). */
    cooldown: 1.0,
    damage: 16,
    /** Portée de détection de la cible (m). */
    range: 18,
    /** Nombre de zombies traversés en plus du premier (perçage). */
    pierce: 1,
    /** Vitesse horizontale de la bouteille (m/s) et gravité propre (m/s², plus faible que le joueur : cloche douce). */
    speed: 17,
    gravity: 14,
    /** Rotation de la bouteille en vol (tours par seconde). */
    spinRate: 2.2,
    /** Rayon de contact de la bouteille (m). */
    radius: 0.35,
    /** Délai entre le début du geste et le lâcher (s), aligné sur l'animation « throw ». */
    releaseDelay: 0.22,
    /** Hauteur visée sur le zombie (m au-dessus de ses pieds). */
    aimHeight: 1.1,
    /** Durée de vie maxi d'une bouteille (s). */
    life: 3,
  },
} as const;

/** Apparence de la bouteille de Blonde (modèle Quaternius recoloré). */
export const BOTTLE_LOOK = {
  file: 'Bottle.glb',
  /** Longueur de la bouteille en jeu (m). */
  length: 0.42,
  /** Couleurs : verre ambré, capsule, étiquette dorée de Blonde. */
  colors: { DarkGreen: 0x8a4512, BottleCap: 0xd8b14a, LightBrown: 0xf2d27a } as Record<string, number>,
} as const;
