// Sons du Buveur et ambiances (aucune dépendance three.js). Volumes de 0 à 1.

export const AUDIO = {
  master: 0.8,
  sfx: 0.9,
  ambience: 0.55,
  /** Pas : volume, variation de hauteur (+-), et hauteur selon le sol. */
  footsteps: {
    volume: 0.45,
    pitchJitter: 0.08,
    /** Sol -> son Kenney et hauteur de lecture. */
    surfaces: {
      grass: { sample: 'footstep_grass', rate: 1.0 },
      dirt: { sample: 'footstep_grass', rate: 0.82 },
      stone: { sample: 'footstep_concrete', rate: 1.0 },
      snow: { sample: 'footstep_snow', rate: 1.0 },
    },
  },
  jump: { volume: 0.35 },
  land: { volume: 0.55, perSpeed: 0.05, max: 1 },
  /** Tintement de la pinte au saut et à la réception. */
  clink: { volume: 0.12, chance: 0.6 },
  /** Glouglou de la mousse qui déborde (synthétisé). */
  foam: { volume: 0.18 },
  /** Ambiances synthétisées : vent permanent, oiseaux le jour, grillons et chouette la nuit. */
  wind: { volume: 0.22 },
  birds: { volume: 0.12, everyMin: 0.8, everyMax: 3.5 },
  crickets: { volume: 0.05, count: 4 },
  owl: { volume: 0.14, everyMin: 14, everyMax: 32 },
} as const;
