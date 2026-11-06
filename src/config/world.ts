// Réglages du monde. Toutes les valeurs de jeu vivent dans la config (GDD section 19).

/** Vitesse de déplacement de base du joueur, en unités par seconde. */
export const BASE_SPEED = 9;

export const PLANET = {
  /** Temps pour faire le tour de la planète en ligne droite à la vitesse de base (GDD : environ 2 min). */
  lapSeconds: 120,
  /** Subdivisions de l'icosphère du terrain (200 = arêtes d'environ 1 unité). */
  detail: 200,
  /** Au-delà de cette pente, on ne peut plus monter : il faut contourner. */
  maxSlopeDeg: 60,
  relief: {
    hills: 9,          // amplitude des grandes collines
    bumps: 3.5,        // bosses moyennes
    detail: 0.8,       // petit détail
    mountains: 46,     // hauteur des chaînes de montagnes
  },
} as const;

/** Rayon déduit du temps de tour : circonférence = vitesse x temps. */
export const PLANET_RADIUS = (BASE_SPEED * PLANET.lapSeconds) / (2 * Math.PI);

export const PLAYER_PHYSICS = {
  gravity: 32,
  jumpSpeed: 11,
  radius: 0.5,
  /** Temps pour atteindre la vitesse max, et pour s'arrêter. */
  accelTime: 0.12,
  decelTime: 0.1,
  /** Vitesse de rotation du modèle vers la direction de déplacement. */
  turnRate: 14, stepHeight: 0.25,
} as const;

export const CAMERA = {
  distance: 16, distanceMin: 6, distanceMax: 40,
  pitch: 0.5, pitchMin: -0.85, pitchMax: 1.35,
  /**
   * Quand le sol (ou un relief) se trouve entre le perso et la caméra, elle glisse vers le perso le
   * long de son axe : il reste toujours au centre, et en regardant vers le ciel elle finit au ras du sol.
   */
  groundClearance: 0.35,
  minDistanceToPlayer: 1.0,
  /** Vitesse à laquelle la caméra repart en arrière une fois l'obstacle passé. */
  unblockSharpness: 6,
  fov: 55,
  targetHeight: 1.6,
  mouseSensitivity: 0.0025,
  stickSensitivity: 2.6,
  /** Lissage du suivi (plus haut = plus réactif). */
  followSharpness: 14,
} as const;
