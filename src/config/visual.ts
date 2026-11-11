// Rendu mixte : décor façon « maquette éclairée » (référence : Escape from Duckov : matériaux lisses,
// lumière dorée, ombres douces, occlusion ambiante, halo, profondeur de champ, étalonnage chaud),
// personnages en cel-shading avec contour.
// Aucune dépendance three.js : valeurs brutes, couleurs en hexadécimal.

export const RENDER = {
  /** Exposition du rendu cinéma (tone mapping ACES). */
  exposure: 1.0,
  /** Occlusion ambiante (assombrit les recoins et le contact entre objets), en mètres. */
  ao: { radius: 1.2, distanceExponent: 1.4, thickness: 1.5, scale: 1.2, samples: 16, intensity: 1.0 },
  /** Halo autour des zones très lumineuses (soleil, reflets, futurs effets). */
  bloom: { strength: 0.32, radius: 0.55, threshold: 0.85 },
  /** Profondeur de champ calée sur le perso : le lointain et le tout proche se floutent. */
  dof: {
    aperture: 0.00008, maxBlur: 0.0035,
    /** Flou plein jusqu'à cette distance caméra -> perso (m), puis il diminue (vue dézoomée). */
    fullUntil: 8, minScale: 0.2,
  },
  /** Étalonnage (appliqué avant le tone mapping). */
  grade: { saturation: 1.12, contrast: 1.06, lift: [0.004, 0.006, 0.014] as const, gain: [1.05, 1.0, 0.93] as const, vignette: 0.32 },
  /** Ombres : taille de la carte, zone couverte autour du joueur, flou des bords. */
  /**
   * Résolution adaptative (render/adaptiveResolution.ts) : sous `lowFps` images par seconde en moyenne sur `window` s,
   * si le calcul du jeu prend moins de `cpuShare` de l'image (donc la carte graphique sature), la résolution de la
   * scène baisse de `step`, jusqu'à `minScale` ; au-dessus de `highFps` pendant `calmWindows` fenêtres, elle
   * remonte d'un cran. `cooldown` : temps d'attente après un changement (s).
   */
  adaptive: { enabled: true, window: 1, lowFps: 45, highFps: 57, cpuShare: 0.6, step: 0.1, minScale: 0.6, cooldown: 2, calmWindows: 5 },
  /** `minIntensity` : sous cette intensité, l'astre ne recalcule plus ses ombres (invisibles de toute façon). */
  shadow: { mapSize: 4096, extent: 40, softness: 3.5, bias: -0.0004, normalBias: 0.05, minIntensity: 0.02 },
} as const;

/** Matériau par défaut du décor : plastique mat (aspect « maquette »). */
export const SURFACE = { roughness: 0.82, metalness: 0 } as const;

/** Personnages : cel-shading et contour net, d'épaisseur fixe à l'écran. */
export const CHARACTER_LOOK = {
  /** Paliers d'ombrage (0-255, de l'ombre à la lumière). */
  toonSteps: [105, 190, 255],
  outline: {
    /** Demi-épaisseur du trait de silhouette, en pixels à 1080p, caméra proche. */
    radius: 1.5,
    /** Le trait garde sa pleine épaisseur jusqu'à cette distance caméra (m), puis s'affine. */
    fullUntil: 6,
    minScale: 0.25,
    color: 0x1a120c,
    /** Plis intérieurs (bras devant le bide, visage) : trait fin, opacité. */
    creaseOpacity: 0.75,
    creaseThreshold: 0.35,
    depthThreshold: 0.03,
  },
} as const;

/** Couleurs du terrain (variation : taches d'herbe plus claire / plus sèche). */
export const TERRAIN_PALETTE = {
  grassLow: 0x4f8a34, grassHigh: 0x8db84a, dirt: 0xa57548, path: 0x8e7556, rock: 0x8b8178, snow: 0xf4f1ea, variation: 0.14,
} as const;
