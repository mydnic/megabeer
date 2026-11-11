// « Dernier service » (GDD section 10, la Cloche du bar) : quelques grandes cloches posées sur la planète,
// et une clochette que les ennemis lâchent rarement. Sonnée, toute l'XP et toutes les capsules de la planète
// roulent vers le Buveur (les snacks restent où ils sont). Valeurs de départ, à caler en jouant.

export const LAST_CALL = {
  /** Grandes cloches posées par run, loin du départ, espacées, hors du décor et des autres objets. */
  count: 4,
  minFromSpawn: 40,
  minSpacing: 150,
  minFromChest: 5,
  minFromPump: 9,
  placementTries: 6000,
  /** Portée de la touche d'action (m, au sol, depuis le pied de la cloche). */
  interactRange: 2.6,
  /** Encombrement du socle (m) : le joueur et les zombies butent dessus. */
  body: { halfX: 0.48, halfZ: 0.48, height: 2.7 },
  /**
   * Clochette lâchée par un ennemi tué (en plus de son XP) : chance de base, et ce que chaque point de
   * Chance du joueur y ajoute (en part de la chance de base).
   */
  dropChance: 0.0025,
  dropLuck: 0.15,
  /**
   * Aspiration : les gouttes et capsules glissent le long du sol vers le Buveur, de plus en plus vite
   * (vitesse de départ, accélération, vitesse maxi, m/s), puis l'aspiration normale prend le relais.
   */
  pullStart: 8,
  pullAccel: 70,
  pullMax: 110,
} as const;

/** Textes (bandeau, rappel près d'une cloche). */
export const LAST_CALL_TEXT = {
  banner: 'Dernière tournée !',
  sub: 'Toute la bière et les capsules arrivent',
  prompt: 'Sonner la cloche',
} as const;

/** Apparence : cloche en laiton sous sa potence, faisceau de lumière au-dessus (visible de loin). */
export const LAST_CALL_LOOK = {
  /** Hauteur de la potence (m). */
  height: 3.2,
  brass: 0xe0a83a,
  wood: 0x7a4a26,
  stone: 0x8d8780,
  beamColor: 0xffd45a,
  beamRadius: 0.6,
  beamHeight: 40,
  beamOpacity: 0.22,
  /** Sonnée : la cloche se balance (angle maxi, rad, durée, s, oscillations par s). */
  swing: 0.7,
  swingTime: 2.5,
  swingRate: 1.6,
} as const;

/** Clochette au sol : même vol que les gouttes d'XP, elle tinte et brille pour se faire voir. */
export const BELL_DROPS = {
  /** Hauteur de la clochette (m). */
  radius: 0.6,
  hover: 0.8,
  bob: 0.14,
  bobSpeed: 2.4,
  startSpeed: 6,
  attract: 45,
  maxSpeed: 30,
  collectDist: 0.8,
  /** Balancement (rad) et sa vitesse (par s). */
  sway: 0.35,
  swaySpeed: 5,
  max: 10,
} as const;
