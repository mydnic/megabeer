/**
 * La Montagne du Destin (issue #20) : un volcan posé à chaque run sur la planète, loin des abbayes. On grimpe ses
 * flancs ; au sommet, un cratère creux, bordé d'un anneau de lave à sauter, où Sauron attend (checkpoint 2).
 * Distances en m le long du sol depuis le centre du cratère, hauteurs en m au-dessus du sol de départ.
 */
export const DOOM_MOUNTAIN = {
  /** Pied de la montagne, crête du cratère, bord du fond plat ; hauteur de la crête ; profondeur du cratère. */
  baseRadius: 78,
  rimRadius: 22,
  floorRadius: 12,
  height: 34,
  depth: 8,
  /** Galbe des flancs (1 : cône droit ; plus : flancs creusés, pente plus douce au pied). */
  flankCurve: 1.5,
  /** Rugosité des flancs (m) : la roche n'est pas lisse. */
  roughness: 1.4,
  /** Loin des abbayes (m, du centre au bord de leur enclos). */
  minFromAbbeys: 150,
  /** Tirée au hasard parmi cette part des sites possibles, les plus plats (une plaine autour de son pied). */
  flattest: 0.15,
  /**
   * Anneau de lave au fond du cratère, entre `inner` et `outer` m du centre (il faut le sauter pour entrer dans
   * l'arène) : le joueur au sol dedans perd `damage` PV toutes les `tick` s.
   */
  lava: { inner: 9.6, outer: 11.8, damage: 6, tick: 0.4 },
  /** Couleurs du sol (basalte des flancs, fond du cratère). */
  rock: 0x3a302c,
  floor: 0x2a1a16,
  /** Rendu de la lave (couleur lumineuse) et de la lueur visible de loin (colonne rouge au-dessus du cratère). */
  lavaColor: 0xff4a10,
  lavaGlow: 2.2,
  /** La colonne part `above` m au-dessus de la crête (elle ne voile pas l'arène). */
  beam: { color: 0xff3a10, radius: 7, height: 70, opacity: 0.16, above: 3 },
} as const;
