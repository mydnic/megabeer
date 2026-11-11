// HUD de run (GDD section 16) : chrono, kills, armes. Les PV sont dans player.ts (HEALTH_HUD).

/** Chargement d'une nouvelle planète : temps de calcul par image (ms) avant de rafraîchir la barre. */
export const LOADING = { frameBudgetMs: 25 } as const;

/** Emplacements d'armes : 4 armes maximum (GDD section 6). */
export const WEAPON_HUD = { slots: 4 } as const;

/** Objets de coffre, sous les armes : hauteur depuis le haut (px), taille d'une case, écart, cases par rangée. */
export const ITEM_HUD = { top: 124, size: 36, gap: 10, perRow: 6 } as const;
/** Tournées du bar en cours, sous le chrono : position (px), taille des pastilles, et sous combien de secondes elles battent. */
export const TOURNEE_HUD = { top: 132, size: 46, gap: 12, lowAt: 3 } as const;

/**
 * Rappel près d'un coffre fermé : hauteur au-dessus du bas de l'écran (px), durée du tremblement
 * quand il manque des capsules (s).
 */
export const CHEST_HUD = { bottom: 210, shake: 0.4 } as const;

/**
 * Ouverture d'un coffre façon lootbox (ui/chestReveal.ts) : la roulette des couleurs s'arrête à
 * `stopAt` de la durée ; changements de couleur (plus par rareté) qui ralentissent selon `slowDown`
 * (plus grand : freinage plus marqué) ; le couvercle saute `burstDelay` s après ; étincelles (plus
 * par rareté) ; dès `bigFrom` (Dingue), l'écran tremble ; fondu de sortie (s).
 */
export const CHEST_OPENING = {
  stopAt: 0.62,
  spins: 12,
  spinsPerRarity: 3,
  slowDown: 1.9,
  burstDelay: 0.12,
  sparks: 18,
  sparksPerRarity: 12,
  bigFrom: 3,
  fadeOut: 0.18,
} as const;

/** Jauge de la pompe à bière : message quand le joueur sort de la zone (la pinte se vide). */
export const PUMP_GAUGE = { outHint: 'Reviens près de la pompe !' } as const;

/**
 * Mini-carte (en bas à droite) : diamètre (px), rayon montré autour du joueur (m), finesse et
 * fréquence de l'image du relief, hauteur où le relief devient roche (m) et fondu (m), taille des
 * points de pompe et de la flèche du joueur (px), couleurs.
 */
export const MINIMAP = {
  size: 170,
  range: 80,
  terrainResolution: 56,
  terrainHz: 8,
  /** L'image du relief déborde du disque de ce facteur : ses bords restent cachés quand elle tourne et glisse. */
  terrainMargin: 1.25,
  rockFrom: 14,
  rockBlend: 10,
  pumpDot: 6,
  playerArrow: 9,
  /** Côté du carré d'un coffre (px). */
  chestSize: 7,
  colors: { low: 0x3d6b2e, high: 0x9ccc5a, rock: 0x8a8478, player: 0xfff4dc, chest: 0xb07038, bell: 0xffd45a },
  /** Cloches du Dernier service : rayon du point (px), toujours affichées (au bord quand elles sont loin). */
  bellDot: 7,
} as const;

/** Bandeau « Synergie : ... ! » quand une synergie s'active : durée d'affichage (s). */
export const SYNERGY_BANNER = { duration: 3.5 } as const;

export const RUN_HUD = {
  /** Fermeture du bar (GDD section 12) : passé ce temps (s), le chrono passe en rouge. */
  closingTime: 600,
  /** Durée mini entre deux animations du compteur de kills (s), pour qu'il ne tremble pas en continu. */
  killPopGap: 0.12,
} as const;
