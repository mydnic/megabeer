// Ambiances jour / nuit. Un soleil d'un côté de la planète, une lune de l'autre (GDD section 13),
// qui tournent lentement autour d'elle. Valeurs pensées pour le rendu cinéma (tone mapping ACES).
export const LIGHTING = {
  sunDir: [1, 0.35, 0.2] as const,
  /** Le soleil et la lune tournent lentement autour de la planète (étoiles comprises). */
  orbit: { periodSeconds: 600, axis: [0.15, 1, -0.25] as const },
  sunIntensity: 3.6,
  moonIntensity: 1.2,
  day: {
    // Ciel légèrement voilé, horizon chaud (lumière de fin d'après-midi)
    zenith: 0x5f97d6, horizon: 0xf1d4ac,
    // L'ambiance du ciel est bleutée : les ombres tirent vers le bleu, le soleil reste doré
    hemiSky: 0xa9c4ec, hemiGround: 0x6e5a3e, hemiIntensity: 1.15,
    sunColor: 0xffd9a6,
  },
  night: {
    zenith: 0x050a1e, horizon: 0x1a2a55,
    hemiSky: 0x3d55a0, hemiGround: 0x101422, hemiIntensity: 0.75,
    moonColor: 0x9db8ff,
  },
  dusk: { glow: 0xff8040 },
  /** Brume : le lointain se fond dans la couleur de l'horizon. */
  fog: { near: 45, far: 210 },
} as const;
