// XP présentée comme de l'alcool (GDD section 9) : gouttes de bière, alcoolémie, degrés.

/** Gouttes de bière lâchées par les zombies. */
export const XP_DROPS = {
  /** XP lâchée par un zombie de base. */
  perZombie: 2,
  /** Rayon de la goutte (m) pour 1 XP ; elle grossit avec sa valeur (racine cubique). */
  radius: 0.13,
  /** Lévitation : hauteur au-dessus du sol (m), amplitude et vitesse du flottement. */
  hover: 0.6,
  bob: 0.12,
  bobSpeed: 2.2,
  /** Ramassage de base (stat Ramassage, m) : au-delà la goutte attend, en deçà elle file vers le joueur. */
  pickupRange: 5,
  /** Attraction : accélération (m/s²) et vitesse maxi (m/s). Ramassée sous `collectDist` (m). */
  attract: 60,
  maxSpeed: 22,
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
