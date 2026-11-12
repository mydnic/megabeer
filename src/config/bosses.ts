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

/**
 * L'Abbé, boss final de l'Abbaye (GDD section 11), appelé par la Porte du patron. Il marche vers le joueur et, à
 * portée, répand le vin de son calice : des flaques marquées au sol autour du joueur, qui brûlent quand elles
 * s'allument. Sous la moitié de ses PV, il boit son calice et devient géant. Le tuer, c'est gagner la run.
 * Version « simple » choisie par l'utilisateur le 2026-11-12 (pas d'invocation). Puissance fixe.
 */
export const ABBE = {
  name: "L'Abbé",
  /** Points de vie (multipliés par la difficulté), vitesse (m/s), XP à sa mort. */
  hp: 4000,
  speed: 2.0,
  xp: 150,
  /** Hauteur du modèle (m), largeur du corps (multiplie le rayon d'un zombie). */
  height: 10,
  bodyScale: 4.4,
  /** Vin répandu : à moins de `range` m, au plus toutes les `cooldown` s ; geste de `duration` s, le vin part à `pourAt` s. */
  cast: {
    range: 22,
    cooldown: 4,
    duration: 1.6,
    pourAt: 0.87,
    /** Flaques par geste, posées autour du joueur (une sur lui, les autres à moins de `spread` m). */
    puddles: 3,
    spread: 8,
    /** Marquée `arm` s avant de brûler, puis brûle `life` s ; rayon (m), dégâts toutes les `tick` s au joueur dedans. */
    arm: 1.1,
    life: 6,
    radius: 4.6,
    tick: 0.5,
    damage: 7,
  },
  /** Phase 2 : il boit son calice (`roar` s, il ne bouge pas) et grandit jusqu'à `grow` fois sa taille en `growTime` s. */
  phase2: {
    below: 0.5,
    roar: 1.5,
    grow: 1.6,
    growTime: 1.0,
    speedMul: 1.3,
    cooldownMul: 0.7,
    puddles: 5,
    damageMul: 1.3,
  },
  music: 'abbe',
  /** Durée des animations (s), fixées par tools/blender/abbe.py. */
  clips: { idle: 2, walk: 1.4, cast: 1.6, hit: 0.4, roar: 1.5, death: 2 },
} as const;

/**
 * La Porte du patron (GDD section 12) : posée loin du départ, toujours sur la mini-carte (flèche au bord quand elle
 * est loin, demande de l'utilisateur le 2026-11-12) et signalée par un faisceau rouge. À la touche d'action, elle s'ouvre et l'Abbé en sort. Une seule fois, et pas
 * pendant qu'un autre boss est debout.
 */
export const PATRON_DOOR = {
  minFromSpawn: 140,
  minFromChest: 10,
  minFromPump: 12,
  /** Rayon (m) sans décor autour d'elle ; si aucune place n'est trouvée, on réessaie avec des écarts divisés par deux. */
  clearRadius: 5,
  placementTries: 4000,
  /** Portée de la touche d'action (m, au sol). */
  interactRange: 7,
  /** L'Abbé sort à `spawnAhead` m devant la porte. */
  spawnAhead: 13,
  prompt: 'Appeler le patron',
  busy: 'Un boss est déjà là',
} as const;

/** Apparence de la porte (world/doorView.ts) : pièces du Castle Kit Kenney, faisceau rouge. */
export const DOOR_LOOK = {
  /** Échelle des pièces du kit (1 : leur taille d'origine, une case de 1 m). */
  scale: 10.5,
  beamColor: 0xff3a2a,
  beamRadius: 1.6,
  beamHeight: 60,
  beamOpacity: 0.28,
  /** Ouverture : la porte s'enfonce dans le sol (m) en `openTime` s. */
  openTime: 1.2,
} as const;

/** Flaques de vin de l'Abbé (marques au sol) : marquées, puis brûlantes. */
export const WINE_LOOK = {
  arming: { markColor: 0xb0203a, markOpacity: 0.55, markRing: 0.12 },
  burning: { markColor: 0x6a0a1e, markOpacity: 0.85, markRing: 0.18 },
} as const;
