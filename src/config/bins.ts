// Poubelles et snacks (GDD section 10, exploration). Une poubelle se casse d'un coup, au contact du
// joueur ou d'une arme, et lâche de l'XP, des capsules ou, rarement, un snack qui soigne. Valeurs de
// départ, à caler en jouant.

export const BINS = {
  /** Poubelles posées sur la planète à chaque run. */
  count: 150,
  /** Distance mini au départ, entre poubelles, aux coffres et aux pompes (m, au sol), essais de placement. */
  minFromSpawn: 10,
  minSpacing: 7,
  minFromChest: 3,
  minFromPump: 6,
  placementTries: 6000,
  /** Sol assez plat : écart de hauteur maxi (m) à `flatRadius` m autour (pas de poubelle sur une falaise). */
  maxBump: 0.4,
  flatRadius: 1.0,
  /** Le joueur la casse quand le milieu de son corps passe à moins de `touch` m du centre de la poubelle. */
  touch: 1.1,
  /** Hauteur de la poubelle (m) et rayon autour de son centre où un projectile la casse. */
  height: 0.95,
  hitRadius: 0.75,
  /** Ce qu'elle lâche : poids de chaque butin (tirés au sort, la somme n'a pas besoin de faire 1). */
  loot: { xp: 0.55, coins: 0.4, snack: 0.05 },
  /** XP : gouttes lâchées et valeur de chacune. */
  xp: { drops: 3, value: 2 },
  /** Capsules lâchées (au hasard entre min et max). */
  coins: { min: 2, max: 4 },
} as const;

/** Apparence (world/binsView.ts) : poubelle de rue « Trashcan » de Poly by Google, couvercle à part. */
export const BIN_LOOK = {
  /** Diamètre de la poubelle (m). */
  width: 0.7,
  body: 0x8d9499,
  lid: 0x6f777d,
  /** Cassée : le couvercle s'envole (vitesse vers le haut, m/s, rotation, tours/s) puis tout s'enfonce. */
  lidUp: 6,
  lidSide: 2.5,
  lidSpin: 2.2,
  /** Le corps se couche (s), reste au sol puis s'enfonce (s, m). */
  tipTime: 0.25,
  stay: 1.2,
  sinkTime: 0.8,
  sinkDepth: 1.2,
} as const;

/**
 * Snack de soin (GDD section 10, « Apéro / snacks », issue #6) : pour l'instant un seul, le cornet de
 * frites. Ramassé comme l'XP (aimanté par le Ramassage).
 */
export const SNACK = {
  name: 'Cornet de frites',
  /** PV rendus. */
  heal: 20,
} as const;

/** Snacks au sol : même vol que les gouttes d'XP (lévitation, aspiration). */
export const SNACK_DROPS = {
  /** Hauteur du cornet (m). */
  radius: 0.8,
  hover: 0.7,
  bob: 0.1,
  bobSpeed: 2,
  startSpeed: 5,
  attract: 40,
  maxSpeed: 26,
  collectDist: 0.8,
  /** Rotation sur lui-même (tours par seconde) et couleurs. */
  spin: 0.5,
  fries: 0xf2c94c,
  cone: 0xd23a2a,
  max: 60,
} as const;
