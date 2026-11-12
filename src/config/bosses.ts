// Boss (GDD section 11). Abbaye : le Frère Sonneur arrive tout seul à 5:00. Il frappe de son maillet la cloche qu'il
// tient à la main : une onde part en anneau, il faut la sauter (décision de l'utilisateur : rien d'autre). À mi-vie, il rugit et passe en phase 2 (plus vite, ondes doublées). Tué, il
// laisse un coffre légendaire gratuit. Valeurs de départ, à caler en jouant.

export const FRERE_SONNEUR = {
  name: 'Frère Sonneur',
  /** Heure d'arrivée (s de run) et distance au joueur où il sort de terre (m). */
  arriveAt: 300,
  spawnDist: 22,
  /** Points de vie (multipliés par la difficulté), vitesse de marche (m/s), XP à sa mort. */
  hp: 1500,
  speed: 2.4,
  xp: 60,
  /** Hauteur du modèle (m) ; corps plus large qu'un zombie (multiplie le rayon du corps). */
  height: 4.6,
  bodyScale: 2.6,
  /**
   * Coup de cloche : il s'arrête et frappe la cloche qu'il tient quand le joueur est à moins de `range` m, au plus
   * toutes les `cooldown` s (durée du geste, moment où le maillet touche la cloche, s).
   */
  strike: {
    range: 12,
    cooldown: 3.2,
    duration: 1.6,
    hitAt: 1.0,
  },
  /** Onde : anneau qui part de lui. On la saute (pieds à plus de `clear` m du sol au passage). */
  wave: {
    speed: 10,
    maxRadius: 22,
    width: 1.1,
    clear: 0.45,
    damage: 18,
  },
  /** Phase 2 sous cette part de PV : rugissement (s, il ne bouge pas), puis plus rapide, frappe plus souvent, deux ondes par coup. */
  phase2: {
    below: 0.5,
    roar: 1.5,
    speedMul: 1.35,
    cooldownMul: 0.7,
    /** Seconde onde, `delay` s après la première. */
    delay: 0.45,
  },
  /** Coffre gratuit laissé à sa mort : rareté forcée (rang dans RARITIES, 4 : Légendaire). */
  chestRarity: 4,
  /** Musique (dossier de `music/boss/`, sinon `default`). */
  music: 'sonneur',
  /** Durée des animations (s), fixées par tools/blender/sonneur.py. */
  clips: { idle: 2, walk: 1.2, strike: 1.6, hit: 0.4, roar: 1.5, death: 2 },
} as const;

/** Apparence (world/bossView.ts) : couleurs de l'onde, barre de vie. */
export const BOSS_LOOK = {
  waveColor: 0xffb02a,
  waveHeight: 0.55,
  /** Segments de l'anneau (posés un à un sur le relief). */
  waveSegments: 120,
  /** Éclair blanc quand il encaisse un coup (intensité, durée s). */
  flash: 0.6,
  flashTime: 0.12,
} as const;
