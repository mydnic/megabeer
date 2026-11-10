// Pièces (GDD section 10) : la monnaie de la run, perdue à la fin. Elles servent à ouvrir les coffres.
// Présentées comme des capsules de bière dorées. Valeurs de départ, à caler en jouant.

export const COINS = {
  /** Chance qu'un ennemi tué lâche une capsule À LA PLACE de sa goutte d'XP (demande de l'utilisateur). */
  dropChance: 0.08,
  /** Pièces que vaut une capsule. */
  value: 1,
} as const;

/**
 * Capsules au sol : même vol que les gouttes d'XP (lévitation, aspiration par la Portée d'attraction).
 * Modèle « Bottlecap » (Poly by Google) : dessus rouge (rien à voir avec l'or de l'XP), jupe dorée
 * crantée ; penchées, elles tournent pour montrer leur dessus.
 */
export const COIN_DROPS = {
  /** Rayon de la capsule (m). */
  radius: 0.26,
  /** Inclinaison (rad) pour voir le dessus ; couleur du dessus, et pente mini d'une face pour en faire partie. */
  tilt: 0.75,
  top: 0xd42a2a,
  topNormal: 0.6,
  /** Lévitation et aspiration : comme les gouttes d'XP (xp.ts). */
  hover: 0.7,
  bob: 0.1,
  bobSpeed: 2.6,
  startSpeed: 6,
  attract: 45,
  maxSpeed: 30,
  collectDist: 0.7,
  /** Rotation sur elle-même (tours par seconde), couleur de la jupe (dorée), lueur. */
  spin: 0.8,
  color: 0xffd23a,
  glow: 0.12,
  max: 600,
} as const;
