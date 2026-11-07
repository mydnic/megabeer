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

/** Bandeau de mort (façon « YOU DIED » / « WASTED ») et ambiance qui retombe. */
export const DEATH_BANNER = {
  /** Affiché en majuscules (la mise en forme s'en charge). */
  text: 'Coma éthylique',
  /** Apparition après la mort (s, temps réel), durée du fondu, texte qui se resserre. */
  delay: 1.3,
  fadeIn: 0.8,
  scaleFrom: 1.18,
  settle: 0.9,
  /** L'image se désature et s'assombrit (saturation et vignette visées, durée en s). */
  saturation: 0.25,
  vignette: 0.55,
  colorFade: 1.6,
  /** Musique baissée à cette fraction de son volume. */
  musicDuck: 0.3,
} as const;
