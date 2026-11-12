// TUNAS (GDD section 14) : la monnaie permanente, gardée d'une run à l'autre (mort ou abandon) et dépensée dans la
// boutique. Présentés au sol comme des liasses de billets (choix de l'utilisateur le 2026-11-12).
// Valeurs de départ : une run moyenne de 10 min doit rapporter environ 100 TUNAS (à recaler sur de vraies runs ; les
// coûts de la boutique sont comptés en runs moyennes, GDD section 14).

export const TUNAS = {
  /** Chance qu'un ennemi tué lâche une liasse, en plus de son XP ou de sa capsule. */
  dropChance: 0.015,
  /** TUNAS dans une liasse d'ennemi ordinaire. */
  value: 1,
  /** Un élite tué lâche une grosse liasse. */
  elite: 5,
  /** Un boss tué lâche une liasse de cette valeur. */
  boss: { sonneur: 15, abbe: 25 },
  /** Bonus de fin de run, à la mort seulement (pas à l'abandon) : TUNAS par minute survécue. */
  endBonusPerMinute: 3,
} as const;

/** Liasses au sol : même vol que les gouttes d'XP et les capsules (lévitation, aspiration par la Portée d'attraction). */
export const TUNA_DROPS = {
  /** Taille de la liasse ordinaire (m, longueur) ; une liasse qui vaut plus est plus grosse (jusqu'à x`maxScale`). */
  size: 0.75,
  maxScale: 2.2,
  /** Rayon de ramassage de la liasse (m). */
  radius: 0.25,
  /** Inclinaison (rad) pour voir le dessus. */
  tilt: 0.55,
  hover: 0.7,
  bob: 0.1,
  bobSpeed: 2.6,
  startSpeed: 6,
  attract: 45,
  maxSpeed: 30,
  collectDist: 0.7,
  /** Rotation sur elle-même (tours par seconde). */
  spin: 0.5,
  /** Couleurs, par matériau du modèle : billets (Green_Tone1, Green_Tone2) et bande de papier (Wrap). */
  colors: { Green_Tone1: 0x2f8a3e, Green_Tone2: 0x1d5e2a, Wrap: 0xd42a3a } as Record<string, number>,
  /** Lueur propre (pour rester visible la nuit sur l'herbe). */
  emissive: 0x3fbf55,
  glow: 0.45,
  max: 300,
} as const;
