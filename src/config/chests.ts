// Coffres (GDD section 10, les « fûts » payants devenus des coffres : choix de l'utilisateur le
// 2026-11-10). Payés en Pièces (capsules), prix croissant ; la rareté se révèle à l'ouverture, puis
// le joueur choisit 1 objet parmi 3 de cette rareté. Valeurs de départ, à caler en jouant.

export const CHESTS = {
  /** Coffres posés sur la planète à chaque run (« une bonne centaine », demande de l'utilisateur). */
  count: 100,
  /** Coffres gratuits en plus (Bonnet du Père Noël), au plus. */
  extraMax: 40,
  /** Distance mini au départ, entre coffres et aux pompes (m, au sol), essais de placement. */
  minFromSpawn: 12,
  minSpacing: 10,
  minFromPump: 8,
  placementTries: 5000,
  /** Portée de la touche d'action (m, au sol, depuis le centre du coffre). */
  interactRange: 2.6,
  /** Prix du premier coffre (capsules), et ce que chaque coffre ouvert ajoute au suivant. */
  basePrice: 5,
  priceStep: 3,
  /** Objets proposés à l'ouverture. */
  choices: 3,
  /**
   * Ouverture façon lootbox (s, temps réel) : le jeu est figé, l'animation se joue, puis l'écran de
   * choix. Plus la rareté est haute, plus le suspense dure (`revealPerRarity` par rareté).
   */
  revealTime: 2.2,
  revealPerRarity: 0.35,
  /**
   * Encombrement du coffre (m) : le joueur et les zombies butent dessus. Mesuré sur coffre.glb
   * (1,6 x 1,25 x 1,3 m, couvercle fermé) mis à la largeur CHEST_LOOK.width.
   */
  body: { halfX: 0.65, halfZ: 0.51, height: 1.05 },
  /** Sol assez plat sous le coffre : écart de hauteur maxi (m) à `flatRadius` m autour. */
  maxBump: 0.3,
  flatRadius: 1.2,
} as const;

/** Apparence (world/chestsView.ts) : coffre du KayKit Dungeon, couvercle qui s'ouvre. */
export const CHEST_LOOK = {
  /** Largeur du coffre (m). */
  width: 1.3,
  wood: 0x8a5230,
  iron: 0x6a6e75,
  /** Ouverture du couvercle (rad, autour de sa charnière) et sa durée (s). */
  lidOpen: -1.9,
  lidTime: 0.35,
} as const;

/** Rappel à l'écran près d'un coffre fermé. */
export const CHEST_PROMPT = {
  open: 'Ouvrir le coffre',
  key: 'E',
  pad: 'X',
} as const;
