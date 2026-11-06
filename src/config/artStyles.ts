// Direction artistique du rendu. 'origine' : le cel-shading d'origine. 'anime' : test façon jeux
// Dragon Ball 3D (les tests Cartoon chaud / BD / aquarelle / Valheim du 2026-11-06 ont été écartés).
// Aucune dépendance three.js : couleurs en hexadécimal, valeurs brutes.

export type ArtStyle = {
  label: string;
  /** Rampe du cel-shading du décor (0-255, de l'ombre à la lumière). smooth : dégradé au lieu de paliers. */
  toon: { steps: number[]; smooth: boolean };
  /** Personnages : leur propre rampe, et l'épaisseur de leur contour (multiple du contour du décor). */
  character: { steps: number[]; smooth: boolean; outlineScale: number };
  /** Couche de gros nuages ronds autour de la planète. */
  clouds: boolean;
  /** Lumière de jour. L'ambiance (hemiSky) colore les ombres. */
  day: {
    sunColor: number; sunIntensity: number;
    hemiSky: number; hemiGround: number; hemiIntensity: number;
    zenith: number; horizon: number;
  };
  terrain: { grassLow: number; grassHigh: number; dirt: number; rock: number; snow: number; variation: number };
  outline: {
    thickness: number; color: number;
    /** 0 : couleur fixe. 1 : couleur de l'objet assombrie (contour « teinté »). */
    tint: number; darken: number;
    fadeStart: number; fadeEnd: number;
  };
  /** Liseré de lumière sur la silhouette des personnages. */
  rim: { strength: number; color: number; threshold: number };
  grade: {
    saturation: number; contrast: number; gain: [number, number, number];
    vignette: number;
  };
};

export const ART_STYLES = {
  origine: {
    label: 'Cel-shading',
    toon: { steps: [90, 175, 255], smooth: false },
    character: { steps: [90, 175, 255], smooth: false, outlineScale: 1 },
    clouds: false,
    day: {
      sunColor: 0xfff1d6, sunIntensity: 2.4,
      hemiSky: 0xcfe3ff, hemiGround: 0x5a4a30, hemiIntensity: 1.25,
      zenith: 0x4f93e0, horizon: 0xbfe0ff,
    },
    terrain: { grassLow: 0x3f7d3a, grassHigh: 0x7cb246, dirt: 0x8a6a44, rock: 0x857a70, snow: 0xf2f5f8, variation: 0 },
    outline: { thickness: 1.6, color: 0x1c1410, tint: 0, darken: 0, fadeStart: 90, fadeEnd: 200 },
    rim: { strength: 0, color: 0xffffff, threshold: 0.6 },
    grade: { saturation: 1, contrast: 1, gain: [1, 1, 1], vignette: 0 },
  },
  anime: {
    label: 'Anime (Dragon Ball 3D)',
    // Décor : ombrage doux, presque peint. Personnages : 2 tons au bord franc, ombres bleutées.
    toon: { steps: [150, 205, 255], smooth: true },
    character: { steps: [105, 255], smooth: false, outlineScale: 3.5 },
    clouds: true,
    day: {
      sunColor: 0xfff6e6, sunIntensity: 2.6,
      hemiSky: 0x8aa0ff, hemiGround: 0x4d5a3a, hemiIntensity: 1.3,
      zenith: 0x1f6fe6, horizon: 0xa9dcff,
    },
    terrain: { grassLow: 0x3fa53a, grassHigh: 0x8fd14f, dirt: 0xb98a52, rock: 0xa39380, snow: 0xffffff, variation: 0.12 },
    outline: { thickness: 1.1, color: 0x16110e, tint: 0.7, darken: 0.35, fadeStart: 60, fadeEnd: 160 },
    rim: { strength: 0, color: 0xffffff, threshold: 0.68 },
    grade: { saturation: 1.12, contrast: 1.05, gain: [1, 1, 1.02], vignette: 0.15 },
  },
} satisfies Record<string, ArtStyle>;

export type ArtStyleId = keyof typeof ART_STYLES;
export const DEFAULT_ART_STYLE: ArtStyleId = 'origine';
