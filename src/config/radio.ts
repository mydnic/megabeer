// Radio planquée (issue #16) : une radio cachée quelque part sur la planète. Le joueur l'allume (touche d'action) : elle
// joue la radio mydnic et attire tous les ennemis (pas les boss), qui la frappent jusqu'à la détruire. De quoi souffler,
// ou regrouper la horde pour la faucher.

export const RADIO = {
  /** Flux joué quand elle est allumée. */
  stream: 'https://radio.mydnic.be/radio.mp3',
  /** PV de la radio (les coups des ennemis, comme sur le joueur). */
  hp: 400,
  /** Placement : à plus de `minFromSpawn` m de l'arrivée et `minFromOthers` m des coffres, pompes, cloches, véhicule ; sol plat. */
  minFromSpawn: 45, minFromOthers: 6, flatRadius: 1.5, maxBump: 0.5, tries: 400,
  /** On l'allume à moins de `interactRange` m ; les ennemis la frappent à moins de `reach` m (x leur taille). */
  interactRange: 2.4, reach: 2.2,
} as const;

/**
 * Rendu et son : taille du poste (m), couleurs ; le son est plein à moins de `fullAt` m et s'éteint à `silentAt` m ;
 * volume au plus près (0 à 1) ; notes de musique émises par seconde quand elle joue.
 */
export const RADIO_LOOK = {
  width: 0.9, height: 0.55, depth: 0.3,
  colors: { body: 0xc8402a, front: 0x2a2224, speaker: 0x8a8478, handle: 0x2a2224, antenna: 0xd8dde4 },
  fullAt: 8, silentAt: 60, volume: 0.9, notesPerSecond: 3,
} as const;
