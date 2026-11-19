// Alliés (issue #18) : chacun attend dans une abbaye (pas celle de l'arrivée). Le joueur le touche, il le rejoint et le
// suit `followTime` s en usant de son pouvoir à sa cadence, puis s'en va. Un seul passage par allié et par run.
// Pouvoirs validés par l'utilisateur le 2026-11-19 (Gandalf d'abord ; Krilin, Yoda et Steve ensuite).

/** Pouvoir d'un allié. `petrify` (Gandalf) : toutes les `every` s, les ennemis (pas les boss) à moins de `radius` m sont
 * pétrifiés `duration` s (immobiles, comme gelés). */
export type AllyPower = { kind: 'petrify'; every: number; radius: number; duration: number };

export type AllyDef = {
  name: string;
  /** Modèle (src/assets/models/<file>) et sa taille (m). */
  file: string; height: number;
  power: AllyPower;
  /** Ce qu'il lance à l'écran quand il use de son pouvoir. */
  shout: string;
};

export const ALLIES = {
  gandalf: { name: 'Gandalf', file: 'gandalf.glb', height: 2.0, power: { kind: 'petrify', every: 6, radius: 6, duration: 3 }, shout: 'Vous ne passerez pas !' },
} as const satisfies Record<string, AllyDef>;

export type AllyId = keyof typeof ALLIES;

/**
 * Règles : durée de compagnie (s), portée pour le rejoindre (m) ; il suit à `followDistance` m derrière le joueur, à
 * `followSide` m sur le côté, à `speed` x la vitesse du joueur au plus (et jamais moins de `minSpeed` m/s) ; trop loin
 * (`catchUp` m), il réapparaît à côté. Placement dans l'abbaye : un point libre à moins de `searchRadius` m de son centre.
 */
export const ALLY_RULES = {
  followTime: 60, joinRange: 2.6, followDistance: 2.4, followSide: 1.3, speed: 1.25, minSpeed: 6, catchUp: 30, searchRadius: 14,
} as const;

/**
 * Rendu : colonne de lumière au-dessus d'un allié qui attend (hauteur, rayon m, couleur) ; sautillement en marche
 * (hauteur m, cadence rad/s) ; vitesse du geste de pouvoir (x).
 */
export const ALLY_LOOK = { beamHeight: 10, beamRadius: 0.9, beamColor: 0xe8f0ff, hop: 0.08, hopRate: 9, powerRate: 1.4 } as const;
