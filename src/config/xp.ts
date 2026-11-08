// XP présentée comme de l'alcool (GDD section 9) : gouttes de bière, alcoolémie, degrés.

/** Gouttes de bière lâchées par les zombies (leur valeur est propre à chaque ennemi, enemies.ts). */
export const XP_DROPS = {
  /** Rayon de la goutte (m) pour 1 XP ; elle grossit avec sa valeur (racine cubique). */
  radius: 0.13,
  /** Lévitation : hauteur au-dessus du sol (m), amplitude et vitesse du flottement. */
  hover: 0.6,
  bob: 0.12,
  bobSpeed: 2.2,
  /** Ramassage de base (stat Ramassage, m) : au-delà la goutte attend, en deçà elle file vers le joueur. */
  pickupRange: 5,
  /** Aspiration en ligne droite : vitesse de départ et accélération (m/s, m/s²), vitesse maxi. Ramassée sous `collectDist` (m). */
  startSpeed: 6,
  attract: 45,
  maxSpeed: 30,
  collectDist: 0.7,
  /** Couleur de la bière (dorée) et lueur. */
  color: 0xffb21e,
  glow: 0.55,
  max: 1500,
} as const;

/** Courbe de niveaux (proto) : 10 XP au départ, puis x1,25 + 5 à chaque degré. */
export const LEVELS = {
  first: 10,
  mult: 1.25,
  add: 5,
} as const;
