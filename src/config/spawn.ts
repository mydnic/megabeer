// Apparition des ennemis et montée en difficulté sur la run de 10 min (GDD sections 11 et 12).
// Valeurs de départ, à caler avec le journal de run.

/**
 * Courbe de la run, point par point (entre deux points : interpolation linéaire, après le
 * dernier : on reste dessus).
 * - `alive` : zombies debout visés autour du joueur ; dès qu'il en manque, il en arrive.
 * - `perSecond` : arrivées maxi par seconde (une horde décimée se reforme à ce rythme).
 * - `hpMul` : PV d'un zombie qui apparaît à ce moment, en multiple de ses PV de base.
 */
export const SPAWN_CURVE = [
  { t: 0, alive: 6, perSecond: 1.5, hpMul: 1 },
  { t: 60, alive: 18, perSecond: 2, hpMul: 1.2 },
  { t: 180, alive: 45, perSecond: 3, hpMul: 1.6 },
  { t: 300, alive: 80, perSecond: 4.5, hpMul: 2.3 },
  { t: 480, alive: 140, perSecond: 6, hpMul: 3.4 },
  { t: 600, alive: 200, perSecond: 8, hpMul: 4.5 },
  // Après la fermeture (10:00) : la pression continue de monter, en attendant les videurs
  { t: 900, alive: 320, perSecond: 12, hpMul: 8 },
] as const;

/** Où et comment ils arrivent. */
export const SPAWN = {
  /** Anneau d'apparition autour du joueur (m, distance au sol). L'arme porte à 18 m. */
  minDist: 30,
  maxDist: 38,
  /** Part des arrivées placées devant le joueur quand il court (sinon : tout autour), et ouverture de ce cône (rad). */
  aheadShare: 0.6,
  aheadSpread: 1.1,
  /** Essais pour trouver un point libre (hors du décor) avant de renoncer pour cette image. */
  tries: 8,
  /** Marge autour du corps pour le test du décor (m). */
  clearance: 0.6,
  /** Zombie distancé au-delà de cette distance (m) : il ressort de terre sur l'anneau, devant le joueur. */
  recycleDist: 60,
  /** Sortie de terre : durée (s) pendant laquelle il émerge du sol, immobile, et profondeur de départ (m). */
  riseTime: 0.9,
  riseDepth: 1.8,
} as const;

/** Difficultés (GDD section 12) : multiplicateurs sur les ennemis. Seule Sobre est jouable pour l'instant. */
export const DIFFICULTIES = {
  sobre: { label: 'Sobre', hp: 1, count: 1, damage: 1 },
  pompette: { label: 'Pompette', hp: 1.5, count: 1.25, damage: 1.1 },
  bourre: { label: 'Bourré', hp: 2.5, count: 1.5, damage: 1.25 },
} as const;

export type DifficultyId = keyof typeof DIFFICULTIES;
