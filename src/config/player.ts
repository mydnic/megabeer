// Statistiques du joueur (GDD section 4). Valeurs du Buveur, perso de référence.

export const PLAYER_STATS = {
  /** Points de vie max. */
  maxHp: 100,
  /** Invulnérabilité après un coup reçu (s) : quatre zombies qui frappent ensemble ne font qu'un coup. */
  invulnTime: 0.5,
} as const;

/** Barre de PV et alerte de PV bas. */
export const HEALTH_HUD = {
  /** La barre « fantôme » (PV perdus) reste figée puis rattrape la vraie valeur. */
  trailDelay: 0.35,
  trailSpeed: 0.9, // fraction de la barre par seconde
  /** Sous ce ratio de PV, le bord de l'écran rougit et pulse. */
  lowRatio: 0.3,
  /** Opacité maxi du bord rouge (à 0 PV) et vitesse de pulsation (battements par seconde). */
  vignetteMax: 0.75,
  pulseRate: 1.6,
} as const;
