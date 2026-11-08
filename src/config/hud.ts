// HUD de run (GDD section 16) : chrono, kills. Les PV sont dans player.ts (HEALTH_HUD).

export const RUN_HUD = {
  /** Fermeture du bar (GDD section 12) : passé ce temps (s), le chrono passe en rouge. */
  closingTime: 600,
  /** Durée mini entre deux animations du compteur de kills (s), pour qu'il ne tremble pas en continu. */
  killPopGap: 0.12,
} as const;
