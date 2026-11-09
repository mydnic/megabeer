// HUD de run (GDD section 16) : chrono, kills, armes. Les PV sont dans player.ts (HEALTH_HUD).

/** Chargement d'une nouvelle planète : temps de calcul par image (ms) avant de rafraîchir la barre. */
export const LOADING = { frameBudgetMs: 25 } as const;

/** Emplacements d'armes : 4 armes maximum (GDD section 6). */
export const WEAPON_HUD = { slots: 4 } as const;

/** Bandeau « Synergie : ... ! » quand une synergie s'active : durée d'affichage (s). */
export const SYNERGY_BANNER = { duration: 3.5 } as const;

export const RUN_HUD = {
  /** Fermeture du bar (GDD section 12) : passé ce temps (s), le chrono passe en rouge. */
  closingTime: 600,
  /** Durée mini entre deux animations du compteur de kills (s), pour qu'il ne tremble pas en continu. */
  killPopGap: 0.12,
} as const;
