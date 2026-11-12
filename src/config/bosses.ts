// Boss (GDD section 11). Abbaye : le Frère Sonneur arrive tout seul à 5:00 avec sa cloche géante. Il la sonne à coups de
// maillet : une onde part en anneau, il faut la sauter ; puis il la pousse et elle roule vers le joueur. À mi-vie, il rugit et passe en phase 2 (plus vite, ondes doublées). Tué, il
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
  /** Sonnerie : il frappe sa cloche d'un coup de maillet (durée du geste, moment où le maillet touche, s). */
  strike: {
    duration: 1.6,
    hitAt: 1.0,
    /** Coups de cloche avant de la pousser, et pause entre deux coups (s). */
    rings: 2,
    gap: 0.6,
  },
  /**
   * La cloche géante (tools/blender/cloche_geante.py) : il se place derrière elle (à `standOff` m, du côté opposé au
   * joueur) pour la sonner, puis la pousse : elle se couche et roule vers le joueur sur `rollDist` m (s'arrête contre
   * le décor). Elle blesse le joueur qu'elle touche (une fois par roulade), puis il retourne la chercher.
   */
  bell: {
    height: 2.6,
    /** Rayon de la lèvre (m) : son encombrement debout, et son rayon quand elle roule couchée. */
    radius: 1.25,
    standOff: 2.7,
    /** Arrivé à sa place quand il est à moins de `arrive` m. */
    arrive: 0.9,
    /** Geste de la poussée (s) : la cloche part à `pushAt` s. */
    push: 1.0,
    pushAt: 0.5,
    rollSpeed: 11,
    rollDist: 20,
    damage: 25,
  },
  /** Onde : anneau qui part du point d'impact. On la saute (pieds à plus de `clear` m du sol au passage). */
  wave: {
    speed: 10,
    maxRadius: 22,
    width: 1.1,
    clear: 0.45,
    damage: 18,
  },
  /** Phase 2 sous cette part de PV : rugissement (s, il ne bouge pas), puis plus rapide, cloche plus rapide, deux ondes par coup. */
  phase2: {
    below: 0.5,
    roar: 1.5,
    speedMul: 1.35,
    rollMul: 1.3,
    /** Seconde onde, `delay` s après la première. */
    delay: 0.45,
  },
  /** Coffre gratuit laissé à sa mort : rareté forcée (rang dans RARITIES, 4 : Légendaire). */
  chestRarity: 4,
  /** Musique (dossier de `music/boss/`, sinon `default`). */
  music: 'sonneur',
  /** Durée des animations (s), fixées par tools/blender/sonneur.py. */
  clips: { idle: 2, walk: 1.2, strike: 1.6, push: 1, hit: 0.4, roar: 1.5, death: 2 },
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
  /** Cloche géante : couleurs par matériau du modèle. */
  bellColors: { Bronze: 0xc48a3a, BronzeFonce: 0x6e4418, Patine: 0x4f9a7c, Fer: 0x4a4e56 } as Record<string, number>,
  /** Sonnée : elle tremble (angle maxi, rad), le battant se balance (rad), le tout s'apaise en `ringTime` s. */
  ringShake: 0.05,
  clapperSwing: 0.5,
  ringTime: 1.2,
  /** Elle se couche pour rouler et se redresse à l'arrêt (s). */
  tipTime: 0.25,
  standTime: 0.35,
} as const;
