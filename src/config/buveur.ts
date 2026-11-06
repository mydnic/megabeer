// Rendu et animation du Buveur (aucun import three.js ici).

export const BUVEUR_VISUAL = {
  /** Vitesse de lecture du cycle de course à la vitesse de base (1 = 0,6 s par cycle). */
  runRateAtBaseSpeed: 1.35,
  /** En dessous de cette vitesse (m/s) on joue l'idle. */
  idleBelow: 0.6,
  /** Durées de fondu entre animations (s). */
  fade: { idleRun: 0.18, toAir: 0.08, land: 0.05, fromLand: 0.2 },
  /** Durée pendant laquelle la réception domine avant de rendre la main (s). */
  landHold: 0.22,
  /** Écrasement / étirement (ressort amorti sur l'échelle verticale, volume conservé). */
  squash: {
    jumpStretch: 0.22,
    landPerSpeed: 0.022, // écrasement par m/s de vitesse de chute
    landMax: 0.32,
    stiffness: 260,
    damping: 14,
  },
  /** Inclinaison dans la direction de l'accélération et dans les virages (radians). */
  lean: { forwardPerAccel: 0.012, sidePerTurn: 0.09, max: 0.3, sharpness: 10 },
} as const;

/** Calage des jambes sur le relief (m). */
export const FOOT_IK = {
  /** Écart de hauteur max corrigé entre le sol sous un pied et le sol sous le perso. */
  maxDelta: 0.45,
  /** Descente max du bassin pour que le pied le plus bas touche. */
  maxDrop: 0.4,
  /** Au-delà de cette hauteur, le pied levé ne s'incline plus selon la pente. */
  contactHeight: 0.12,
  /** Pente max suivie par le pied (tangente, 1 = 45 degrés). */
  maxFootSlope: 0.9,
  /** Réactivité du bassin et de l'activation (plus haut = plus sec). */
  sharpness: 18,
} as const;

/** Petit gimmick autour de la mousse : flocons qui sautent de la pinte (course, saut, réception). */
export const BEER_SPLASH = {
  beerColor: 0xf0a020,
  foamColor: 0xfff6e2,
  /** Surtout de la mousse, de rares gouttes de bière. */
  foamRatio: 0.85,
  dropSize: 0.014,
  foamSize: 0.02,
  /** Durée de vie courte : les flocons disparaissent près du verre, avant le sol. */
  dropLife: 0.4,
  gravity: 9,
  drag: 2.5,
  maxDrops: 60,
  /** Course : à chaque appui (2 par cycle), avec cette probabilité. */
  run: { chance: 0.4, count: [1, 2] as const, upSpeed: [0.4, 0.9] as const, spread: 0.3, inherit: 0.85 },
  /** Saut. */
  jump: { count: 4, upSpeed: [0.8, 1.4] as const, spread: 0.4, inherit: 0.9 },
  /** Réception : proportionnelle à la vitesse de chute. */
  land: { countPerSpeed: 0.3, max: 5, upSpeed: [0.5, 1.0] as const, spread: 0.5, inherit: 0.6 },
  /** Haut de la pinte, dans le repère du modèle (glTF, mètres). */
  pintTop: [-0.31, 1.2, 0.39] as const,
} as const;
