// Mécanique propre à l'Abbaye (GDD section 13) : les cloches et le débarquement (30 s d'arrivées en masse).

export const BELLS = {
  /** Toutes les `every` secondes de run (la première à 2:00 pile), les cloches sonnent et le débarquement démarre aussitôt. */
  every: 120,
  /** Après le grand coup du débarquement, `tolls` coups de volée tous les `tollGap` s. */
  tolls: 2,
  tollGap: 1.5,
  /**
   * Débarquement : pendant `duration` s, un seul type d'ennemi sort de terre en continu et en masse
   * tout autour du joueur, `perSecond` par seconde (multiplié par la difficulté).
   */
  duration: 30,
  perSecond: 8,
  /** Anneau autour du joueur où ils sortent de terre (m, distance au sol). */
  minDist: 18,
  maxDist: 26,
  /** Tremblement de caméra au débarquement (0 à 1), amplitude (m), amortissement. */
  shake: { amount: 0.5, amplitude: 0.25, decay: 1.6 },
} as const;

/** Son de cloche (synthétisé) : hauteur du coup (Hz), volumes du grand coup et des coups de volée. */
export const BELL_SOUND = {
  pitch: 196,
  tollVolume: 0.5,
  landingVolume: 0.75,
  /** Le grand coup (débarquement) est plus grave : multiplicateur de hauteur. */
  landingPitch: 0.75,
  /** Durée de la réverbération d'église (s). */
  reverb: 3.2,
} as const;
