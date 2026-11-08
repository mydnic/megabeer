// HUD de run (GDD section 16) : chrono, kills, armes. Les PV sont dans player.ts (HEALTH_HUD).

/** Emplacements d'armes : 4 armes maximum (GDD section 6). */
export const WEAPON_HUD = { slots: 4 } as const;

export const RUN_HUD = {
  /** Fermeture du bar (GDD section 12) : passé ce temps (s), le chrono passe en rouge. */
  closingTime: 600,
  /** Durée mini entre deux animations du compteur de kills (s), pour qu'il ne tremble pas en continu. */
  killPopGap: 0.12,
} as const;
