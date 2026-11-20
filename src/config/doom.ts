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
  /** Couleur des éclats quand la lave brûle le joueur ; lueur visible de loin (colonne rouge au-dessus du cratère). */
  lavaColor: 0xff4a10,
  /**
   * La colonne part `above` m au-dessus de la crête (elle ne voile pas l'arène) ; elle s'allume sur la première part
   * `fadeIn` de sa hauteur et se dissout dans le ciel à partir de `fadeOut` (parts de la hauteur).
   */
  beam: { color: 0xff3a10, radius: 7, height: 90, opacity: 0.2, above: 3, fadeIn: 0.12, fadeOut: 0.35 },
  /**
   * Lave du cratère (shader) : croûte sombre, lave en fusion, fissures incandescentes ; `glow` multiplie les couleurs
   * (au-delà de 1, le bloom la fait rayonner) ; taille du motif (m).
   */
  look: { crust: 0x160604, molten: 0xe8380a, hot: 0xffc040, glow: 1.9, scale: 2.2 },
  /**
   * Coulées de lave sur les flancs (décor, sans dégâts) : `count` coulées partent de la crête et descendent la pente,
   * presque droites (`wiggle`), jusqu'à `reach` x le rayon du pied ; largeur de `top` m en haut, finissant en pointe
   * (`bottom` m), posées `lift` m au-dessus du sol, `across` points en travers (elles épousent le relief) tous les `step` m. `look` : couleur unie, bords (`edge`) et coeur (`core`), x`glow` ; elle pulse
   * (`pulse` : amplitude, `speed` rad/s).
   */
  veins: {
    count: 7, step: 0.5, across: 4, top: 2.4, bottom: 0.25, wiggle: 0.12, reach: 0.82, lift: 0.08,
    look: { edge: 0xff3a08, core: 0xffb030, glow: 1.6, pulse: 0.25, speed: 2.0 },
  },
} as const;
