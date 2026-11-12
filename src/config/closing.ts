// La fermeture du bar (GDD section 12) : à 10:00, dans tous les cas, la Mort vient chercher le Buveur.
// Version choisie par l'utilisateur le 2026-11-12 : la Mort (« Stylized Death », Fab) à la place des videurs.
// Valeurs de départ, à caler en jouant.

/**
 * Les Morts de la fermeture : intouchables (les armes ne les visent pas), elles flottent au-dessus du sol, traversent le
 * décor et poursuivent le Buveur ; un coup de faux le tue. Une nouvelle arrive toutes les `every` s, et toutes
 * accélèrent avec le temps : il faut abattre l'Abbé avant d'être rattrapé.
 */
export const CLOSING = {
  /** Heure de la fermeture (s de run). */
  at: 600,
  /** Une Mort de plus toutes les `every` s (la première à la fermeture), `max` en même temps. */
  every: 40,
  max: 8,
  /** Elle sort de terre à `spawnDist` m du joueur (au sol), et met `rise` s à en sortir (immobile). */
  spawnDist: 30,
  rise: 2.5,
  /** Vitesse (m/s ; le Buveur va à 9 m/s) : `speed` à la fermeture, + `speedPerMinute` par minute, au plus `maxSpeed`. */
  speed: 6,
  speedPerMinute: 0.8,
  maxSpeed: 11,
  /** Hauteur du flottement au-dessus du sol (m). */
  hover: 0.4,
  /** Coup de faux : déclenché à moins de `reach` m, il frappe à `hitAt` s du geste (de `duration` s) qui touche jusqu'à `hitReach` m. */
  reach: 2.4,
  hitReach: 3.4,
  duration: 1.6,
  hitAt: 0.75,
  /** Dégâts du coup de faux (avant les réductions du joueur) : de quoi tuer. */
  damage: 999,
  /** Hauteur du modèle (m). */
  height: 3.4,
  banner: { title: 'Fermeture !', sub: 'La Mort vient te chercher. Abats l\'Abbé avant qu\'elle ne t\'attrape' },
} as const;

/** Rendu (world/reaperView.ts). */
export const REAPER_LOOK = {
  /** Lueur des yeux et des reflets (couleur du modèle d'origine dans Unreal). */
  emissive: 0x1793ff,
  emissiveIntensity: 1.6,
  /** Durée des animations (s), fixées par le modèle (tools/blender/mort.py). */
  clips: { idle: 1, walk: 1, attack: 2, spawn: 2.567, roar: 3.367 },
  /** Vitesse de marche de l'animation (m/s), pour caler la cadence. */
  walkSpeed: 4,
  /** Flottement : amplitude (m) et vitesse (rad/s). */
  bob: 0.18,
  bobSpeed: 2.4,
  /** Modèle de repli (Grim Reaper de Falibu) : quart de tour pour qu'il regarde devant lui. */
  fallbackTurn: -Math.PI / 2,
} as const;
