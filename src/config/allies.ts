// Alliés (issue #18) : un dans chaque abbaye (quatre abbayes, quatre alliés ; on en ajoutera une avec un nouvel allié).
// Le joueur le touche, il le rejoint et le suit `followTime` s en usant de son pouvoir à sa cadence, puis s'en va. Un
// seul passage par allié et par run. Pouvoirs validés par l'utilisateur le 2026-11-19.

/**
 * Pouvoir d'un allié, toutes les `every` s. Les dégâts suivent la courbe de PV des ennemis (comme le canon du tank).
 * - `petrify` (Gandalf) : les ennemis (pas les boss) à moins de `radius` m sont pétrifiés `duration` s (immobiles).
 * - `kienzan` (Krilin) : il soigne le joueur de `heal` PV/s tant qu'il le suit ; il lance un disque vers l'ennemi le plus
 *   proche (à moins de `range` m), qui file en ligne droite à `speed` m/s sur `reach` m et tranche tout ce qu'il touche
 *   (à `width` m de sa trajectoire, `damage` par ennemi, une fois chacun).
 * - `push` (Yoda) : les ennemis à moins de `radius` m sont repoussés (recul x`knock`) et sonnés `stun` s (pas les boss).
 * - `tnt` (Steve) : il pose un bloc qui explose `fuse` s plus tard : `damage` aux ennemis à moins de `radius` m, recul
 *   x`knock`. Le joueur n'est pas touché.
 */
export type AllyPower =
  | { kind: 'petrify'; every: number; radius: number; duration: number }
  | { kind: 'kienzan'; every: number; heal: number; range: number; speed: number; reach: number; width: number; damage: number }
  | { kind: 'push'; every: number; radius: number; knock: number; stun: number }
  | { kind: 'tnt'; every: number; fuse: number; radius: number; damage: number; knock: number };

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
  krilin: {
    name: 'Krilin', file: 'krilin.glb', height: 1.45,
    power: { kind: 'kienzan', every: 5, heal: 3, range: 22, speed: 24, reach: 30, width: 1.1, damage: 60 }, shout: 'Kienzan !',
  },
  yoda: { name: 'Yoda', file: 'yoda.glb', height: 0.95, power: { kind: 'push', every: 5, radius: 7, knock: 4, stun: 1.5 }, shout: 'Que la Force soit avec toi.' },
  steve: { name: 'Steve', file: 'steve.glb', height: 1.85, power: { kind: 'tnt', every: 6, fuse: 2, radius: 5, damage: 120, knock: 3 }, shout: 'Tsssss...' },
} as const satisfies Record<string, AllyDef>;

export type AllyId = keyof typeof ALLIES;

/**
 * Règles : durée de compagnie (s), portée pour le rejoindre (m) ; il suit à `followDistance` m derrière le joueur, à
 * `followSide` m sur le côté (plusieurs : un de chaque côté, puis un rang `rowGap` m plus loin), à `speed` x la vitesse du joueur au plus (et jamais moins de `minSpeed` m/s) ; trop loin
 * (`catchUp` m), il réapparaît à côté. Placement dans l'abbaye : un point libre à moins de `searchRadius` m de son centre.
 */
export const ALLY_RULES = {
  followTime: 60, joinRange: 2.6, followDistance: 2.4, followSide: 1.3, rowGap: 1.6, speed: 1.25, minSpeed: 6, catchUp: 30, searchRadius: 14,
} as const;

/**
 * Rendu : colonne de lumière au-dessus d'un allié qui attend (hauteur, rayon m, couleur) ; sautillement en marche
 * (hauteur m, cadence rad/s) ; vitesse du geste de pouvoir (x).
 */
export const ALLY_LOOK = { beamHeight: 10, beamRadius: 0.9, beamColor: 0xe8f0ff, hop: 0.08, hopRate: 9, powerRate: 1.4 } as const;

/**
 * Kienzan : disque de lumière (rayon m, épaisseur, couleur, hauteur de vol m, rotation rad/s). TNT : bloc (modèle), il
 * clignote en blanc de plus en plus vite avant d'exploser (`blink` : cadence au début et à la fin, rad/s), gonfle de
 * `swell` à la fin. Soin de Krilin : une lueur verte sur le joueur toutes les `healPulse` s.
 */
export const ALLY_FX = {
  disc: { radius: 0.75, thickness: 0.06, color: 0xfff27a, height: 1.2, spin: 30 },
  tnt: { file: 'tnt.glb', blink: [6, 30], swell: 0.15 },
  healPulse: 1, healColor: 0x7dff9a,
} as const;
