// Ambiances jour / nuit. Directions des astres fixes dans le monde : un soleil d'un côté de la planète,
// une lune de l'autre (GDD section 13).
export const LIGHTING = {
  sunDir: [1, 0.35, 0.2] as const,
  /** Le soleil et la lune tournent lentement autour de la planète (étoiles comprises). */
  orbit: { periodSeconds: 600, axis: [0.15, 1, -0.25] as const },
  sunIntensity: 2.4,
  moonIntensity: 1.1,
  day: {
    zenith: 0x4f93e0, horizon: 0xbfe0ff,
    hemiSky: 0xcfe3ff, hemiGround: 0x5a4a30, hemiIntensity: 1.25,
    sunColor: 0xfff1d6,
  },
  night: {
    zenith: 0x060c22, horizon: 0x1d2c5c,
    hemiSky: 0x4a62a8, hemiGround: 0x141826, hemiIntensity: 0.9,
    moonColor: 0xa9c2ff,
  },
  dusk: { glow: 0xff8a4c },
  fog: { near: 70, far: 230 },
  shadowMapSize: 4096,
  shadowExtent: 40,
} as const;
