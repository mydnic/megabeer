// Statistiques du joueur (GDD section 4). Valeurs du Buveur, perso de référence.

export const PLAYER_STATS = {
  /** Points de vie max. */
  maxHp: 100,
  /** Invulnérabilité après un coup reçu (s) : quatre zombies qui frappent ensemble ne font qu'un coup. */
  invulnTime: 0.5,
  /** Multiplicateur global de cadence des armes (stat Vitesse d'attaque). */
  attackSpeed: 1,
  /** Projectiles en plus pour les armes à projectiles (stat Nombre de projectiles). */
  extraProjectiles: 0,
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
  /** Soin d'au moins ce nombre de PV d'un coup : éclat vert sur la barre. */
  healFlash: 3,
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
  /** Apparition du bilan et du bouton Rejouer (s après la mort, temps réel). */
  endDelay: 2.6,
  /** L'image se désature et s'assombrit (saturation et vignette visées, durée en s). */
  saturation: 0.25,
  vignette: 0.55,
  colorFade: 1.6,
  /** Musique baissée à cette fraction de son volume. */
  musicDuck: 0.3,
} as const;

/**
 * Arrivée en run : le Buveur tombe du ciel dans le cadre, la caméra déjà posée sur le point
 * d'atterrissage. Hauteur de départ (m) et vitesse de chute initiale (m/s) ; à l'impact :
 * tremblement (force, amplitude, amortissement) et gerbe de bière (nombre de gouttes).
 * Les zombies de départ apparaissent à l'atterrissage.
 */
export const ARRIVAL = {
  height: 26,
  speed: 6,
  shake: { amount: 0.8, amplitude: 0.45, decay: 1.6 },
  splash: 46,
} as const;
