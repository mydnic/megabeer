// HUD de run (GDD section 16) : chrono, kills, armes. Les PV sont dans player.ts (HEALTH_HUD).

/** Chargement d'une nouvelle planète : temps de calcul par image (ms) avant de rafraîchir la barre. */
export const LOADING = { frameBudgetMs: 25 } as const;

/** Emplacements d'armes : 4 armes maximum (GDD section 6). */
export const WEAPON_HUD = { slots: 4 } as const;

/** Jauge de la pompe à bière : message quand le joueur sort de la zone (la pinte se vide). */
export const PUMP_GAUGE = { outHint: 'Reviens près de la pompe !' } as const;

/**
 * Mini-carte (en bas à droite) : diamètre (px), rayon montré autour du joueur (m), finesse et
 * fréquence de l'image du relief, hauteur où le relief devient roche (m) et fondu (m), taille des
 * points de pompe et de la flèche du joueur (px), nombre de pompes pleines hors du disque montrées
 * en flèche au bord, couleurs.
 */
export const MINIMAP = {
  size: 170,
  range: 80,
  terrainResolution: 56,
  terrainHz: 8,
  rockFrom: 14,
  rockBlend: 10,
  pumpDot: 6,
  playerArrow: 9,
  edgeArrows: 3,
  colors: { low: 0x3d6b2e, high: 0x9ccc5a, rock: 0x8a8478, usedPump: 0x5a5550, player: 0xfff4dc },
} as const;

/** Bandeau « Synergie : ... ! » quand une synergie s'active : durée d'affichage (s). */
export const SYNERGY_BANNER = { duration: 3.5 } as const;

export const RUN_HUD = {
  /** Fermeture du bar (GDD section 12) : passé ce temps (s), le chrono passe en rouge. */
  closingTime: 600,
  /** Durée mini entre deux animations du compteur de kills (s), pour qu'il ne tremble pas en continu. */
  killPopGap: 0.12,
} as const;
