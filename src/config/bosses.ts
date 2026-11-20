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
  /** Les pièces `glow_*` des modèles (sabre laser) : leur couleur x`glowBoost`, sans éclairage. */
  glowBoost: 2.5,
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
  /** Coffre gratuit laissé à sa mort (rang dans RARITIES, 4 : Légendaire) ; la run continue jusqu'à la fermeture. */
  chestRarity: 4,
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
 * est loin, demande de l'utilisateur le 2026-11-12) et signalée par un faisceau rouge. À la touche d'action, elle s'ouvre et l'Abbé en sort. Une seule fois, même
 * si d'autres boss sont debout.
 */
export const PATRON_DOOR = {
  minFromSpawn: 140,
  minFromChest: 10,
  minFromPump: 12,
  /** Rayon (m) sans décor autour d'elle ; si aucune place n'est trouvée, on réessaie avec des écarts divisés par deux. */
  clearRadius: 5,
  /** Sol presque plat : à `flatRadius` m autour d'elle (et à mi-chemin), le relief ne s'écarte pas de plus de `maxBump` m. */
  flatRadius: 9,
  maxBump: 0.8,
  placementTries: 4000,
  /** Portée de la touche d'action (m, au sol). */
  interactRange: 7,
  /** L'Abbé sort à `spawnAhead` m devant la porte. */
  spawnAhead: 13,
  prompt: 'Appeler le patron',
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

/**
 * Les boss optionnels (issue #19) : chacun attend devant le portail d'un cimetière, loin du départ, sous une colonne
 * de lumière. Le joueur va le voir et le défie à la touche d'action : il est fort, mais rapporte beaucoup d'XP, un
 * coffre gratuit et des TUNAS. On peut en défier plusieurs à la fois.
 */
export const GRAVE_BOSSES = {
  /** Les boss posés à chaque run, dans cet ordre (un cimetière chacun). */
  kinds: ['vador'] as const,
  /** Pas dans un cimetière à moins de `minFromSpawn` m du départ ; portée de la touche d'action (m). */
  minFromSpawn: 80,
  interactRange: 6,
  /** Point libre cherché jusqu'à `searchRadius` m du portail (un sapin peut le gêner). */
  searchRadius: 8,
  /** Colonne de lumière au-dessus d'un boss qui attend (rendu). */
  beamColor: 0xff2a1a,
  beamRadius: 1.4,
  beamHeight: 60,
  beamOpacity: 0.26,
} as const;

/**
 * Dark Vador (boss optionnel, issue #19) : il marche lentement vers le joueur et, de près, frappe de son sabre laser
 * devant lui. Avant le coup, la zone touchée est marquée au sol (`windup` s) : il faut en sortir. Valeurs de départ.
 */
export const VADOR = {
  name: 'Dark Vador',
  prompt: 'Défier Dark Vador',
  /** Points de vie (multipliés par la difficulté), vitesse de marche (m/s), XP à sa mort. */
  hp: 4000,
  speed: 2.2,
  xp: 250,
  /** Hauteur du modèle (m) ; corps plus large qu'un zombie (multiplie le rayon du corps). */
  height: 3.4,
  bodyScale: 2.0,
  /**
   * Coup de sabre : à moins de `range` m du joueur, au plus toutes les `cooldown` s. La zone (un disque de `radius` m,
   * à `ahead` m devant lui) est marquée `windup` s avant ; pendant la première part `track` de ce temps, il se tourne
   * encore vers le joueur et la zone le suit, puis elle se fige. Le coup part (`hitAt` s après le début du geste, qui
   * dure `duration` s) et blesse le joueur resté dedans.
   */
  strike: { range: 6, cooldown: 1.0, windup: 0.55, track: 0.5, ahead: 2.8, radius: 3.0, hitAt: 0.45, duration: 1.5, damage: 35 },
  /**
   * Phase 2 sous `below` de ses PV : il s'arrête `pause` s (furieux), puis marche un peu plus vite et lance son sabre
   * quand le joueur est à plus de `minDist` m, `every` s après l'avoir rattrapé : la lame tourne à plat à `height` m du
   * sol, file vers là où le joueur sera (sa course prolongée de `lead` x le temps de vol) jusqu'à `range` m à `speed`
   * m/s, tourne sur place `hold` s en glissant vers le joueur à `drift` m/s, puis revient dans sa main. Elle blesse le joueur qu'elle traverse
   * (rayon `radius` m), une fois à l'aller et une fois au retour. Le geste dure `windup` s avant le lâcher. Sans sabre
   * en main, il ne frappe pas.
   */
  phase2: {
    below: 0.5, pause: 1.0, speedMul: 1.2,
    throw: { every: 1.2, minDist: 4, windup: 0.5, range: 18, speed: 20, lead: 1, hold: 1, drift: 4, radius: 1.4, height: 1.5, damage: 25 },
  },
  /** Coffre gratuit laissé à sa mort (rang dans RARITIES, 4 : Légendaire). */
  chestRarity: 4,
  music: 'vador',
  /** Durée des animations (s), fixées par tools/blender/vador.py. */
  clips: { idle: 1.67, walk: 1.33, strike: 1.5, cast: 0.5, hit: 0.33, death: 2.38 },
} as const;

/** Marque au sol du coup de sabre de Vador. */
export const VADOR_LOOK = {
  strike: { markColor: 0xff2a1a, markOpacity: 0.6, markRing: 0.1 },
  /**
   * Sabre lancé : longueur (m), épaisseur (x, il doit se lire de loin), vitesse de rotation (rad/s), couleur de la
   * lame (x`glow`, lumineuse), opacité du disque de flou qui tourne avec lui.
   */
  thrown: { length: 2.4, thick: 2.5, spin: 22, blade: 0xff1a10, glow: 2.5, hilt: 0x8a8a94, blur: 0.35 },
} as const;
