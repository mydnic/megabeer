// Effets visuels (GDD section 15, « juice »).

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
} as const;

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
} as const;
