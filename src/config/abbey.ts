// Mécanique propre à l'Abbaye (GDD section 13) : les cloches et le débarquement.

export const BELLS = {
  /** Une sonnerie toutes les `every` secondes de run (la première à 2:00). */
  every: 120,
  /** Les cloches sonnent `warn` secondes avant le débarquement, en `tolls` coups réguliers. */
  warn: 4.5,
  tolls: 3,
  /** Zombies du débarquement (multiplié par la difficulté). */
  count: 100,
  /** Cercle autour du joueur où ils sortent de terre (m, distance au sol) : un mur qui se resserre. */
  minDist: 18,
  maxDist: 26,
  /** Tremblement de caméra au débarquement (0 à 1), amplitude (m), amortissement. */
  shake: { amount: 0.5, amplitude: 0.25, decay: 1.6 },
} as const;

/** Son de cloche (synthétisé) : hauteur du coup (Hz), volumes des coups d'alerte et du dernier coup. */
export const BELL_SOUND = {
  pitch: 196,
  tollVolume: 0.5,
  landingVolume: 0.75,
  /** Le dernier coup (débarquement) est plus grave : multiplicateur de hauteur. */
  landingPitch: 0.75,
  /** Durée de la réverbération d'église (s). */
  reverb: 3.2,
} as const;
