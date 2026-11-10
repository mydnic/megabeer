// Pièces (GDD section 10) : la monnaie de la run, perdue à la fin. Elles servent à ouvrir les coffres.
// Présentées comme des capsules de bière dorées. Valeurs de départ, à caler en jouant.

export const COINS = {
  /** Chance qu'un ennemi tué lâche une capsule À LA PLACE de sa goutte d'XP (demande de l'utilisateur). */
  dropChance: 0.08,
  /** Pièces que vaut une capsule. */
  value: 1,
} as const;

/**
 * Capsules au sol : même vol que les gouttes d'XP (lévitation, aspiration par la Portée d'attraction),
 * mais plates et dorées, debout, qui tournent sur elles-mêmes pour ne pas les confondre avec l'XP.
 */
export const COIN_DROPS = {
  /** Rayon de la capsule (m), épaisseur (m), nombre de crans de la jupe. */
  radius: 0.22,
  thickness: 0.07,
  teeth: 21,
  /** Lévitation et aspiration : comme les gouttes d'XP (xp.ts). */
  hover: 0.7,
  bob: 0.1,
  bobSpeed: 2.6,
  startSpeed: 6,
  attract: 45,
  maxSpeed: 30,
  collectDist: 0.7,
  /** Rotation sur elle-même (tours par seconde), couleur et lueur. */
  spin: 0.8,
  color: 0xffd23a,
  glow: 0.35,
  max: 600,
} as const;
