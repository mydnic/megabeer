// Ennemis (GDD section 11) : chaque type est une fiche de config, et chaque map a son roster (un
// nouveau type par minute, les anciens restent). Valeurs de départ, calées avec le journal de run.

import type { ZombieModel } from './zombies';

export type EnemyDef = {
  /** Nom affiché (journal, panneau DEV). */
  name: string;
  /** Modèle 3D (zombies.ts). */
  model: ZombieModel;
  /** Points de vie de base (multipliés par la courbe de la run et la difficulté). */
  hp: number;
  /** Vitesse de déplacement (m/s ; le joueur va à 9 m/s). */
  speed: number;
  /** PV retirés au joueur par coup. */
  damage: number;
  /** Valeur de la goutte de bière lâchée à la mort. */
  xp: number;
  /** Brique Tireur : il s'arrête à distance et lance des projectiles en cloche (au contact, il frappe). */
  thrower?: ThrowerDef;
  /** Brique Kamikaze : il fonce, allume sa mèche au contact et explose ; tué, il explose sur place. */
  kamikaze?: KamikazeDef;
  /** Brique Fantôme : il traverse le décor, et devient intouchable par moments. */
  ghost?: GhostDef;
  /** Brique Protecteur : les ennemis autour de lui prennent moins de dégâts. */
  protector?: ProtectorDef;
  /** Brique Invocateur : à portée, il s'arrête et fait sortir d'autres ennemis de terre autour de lui. */
  summoner?: SummonerDef;
  /** Brique Diviseur : tué, il se sépare en plusieurs petits ennemis. */
  splitter?: SplitterDef;
};

/**
 * Brique Diviseur (GDD section 11) : quand le joueur le tue, d'autres ennemis (plus petits) sortent
 * de son corps et repartent à l'attaque. Les petits ne se divisent pas à leur tour.
 */
export type SplitterDef = {
  /** Ennemi qui sort de son corps (identifiant de ENEMIES) et nombre. */
  enemy: string;
  count: number;
  /** Rayon du cercle où ils apparaissent, autour du corps (m). */
  radius: number;
};

/**
 * Brique Invocateur (GDD section 11) : quand le joueur est à portée, il s'arrête, fait son geste
 * (sans bouger, sans frapper), puis des ennemis sortent de terre en cercle autour de lui. Il
 * recommence après un délai. Au contact, il frappe comme les autres.
 */
export type SummonerDef = {
  /** Ennemi invoqué (identifiant de ENEMIES) et nombre par invocation. */
  enemy: string;
  count: number;
  /** Distance au joueur (m) sous laquelle il invoque. */
  range: number;
  /** Délai avant la première invocation (s), puis entre deux invocations (s). */
  firstDelay: number;
  cooldown: number;
  /** Durée du geste (s) avant que les invoqués sortent de terre. */
  cast: number;
  /** Rayon du cercle où ils sortent, autour de lui (m). */
  radius: number;
};

/**
 * Brique Protecteur (GDD section 11) : les ennemis à portée de son halo encaissent une part réduite
 * des dégâts. Lui-même n'est pas protégé par son propre halo, et plusieurs halos ne se cumulent pas.
 */
export type ProtectorDef = {
  /** Rayon du halo (m, au sol) et part des dégâts retirée aux ennemis dedans (0 à 1). */
  radius: number;
  reduction: number;
};

/**
 * Brique Fantôme (GDD section 11) : il passe à travers les murs et le décor, et il est intouchable
 * une partie du temps (les coups le traversent), à intervalles réguliers propres à chacun. Il peut
 * frapper même intouchable.
 */
export type GhostDef = {
  /** Période (s) et durée intouchable dans chaque période (s). */
  every: number;
  intangible: number;
};

/**
 * Brique Kamikaze (GDD section 11) : explose au contact ou à sa mort. Au contact, la mèche laisse au
 * joueur le temps de sortir de la zone, marquée au sol. Il ne frappe pas : ses seuls dégâts sont
 * l'explosion. Mort par la mèche, il disparaît sans lâcher de bière ; tué, il explose aussitôt.
 */
export type KamikazeDef = {
  /** Distance au joueur (m) à laquelle il s'arrête et allume la mèche. */
  trigger: number;
  /** Durée de la mèche (s) : le temps qu'a le joueur pour sortir de la zone. */
  fuse: number;
  /** Rayon de l'explosion (m) et PV retirés au joueur dedans. */
  radius: number;
  damage: number;
};

/**
 * Brique Tireur (GDD section 11) : projectile lent, lancé en cloche vers l'endroit où se trouve le
 * joueur au lâcher. Le point d'impact est marqué au sol pendant le vol : on l'esquive en bougeant.
 */
export type ThrowerDef = {
  /** Il s'arrête de marcher dès qu'il est à cette distance du joueur (m). */
  range: number;
  /** Temps entre deux lancers (s), et délai maxi avant le premier (tiré au hasard). */
  cooldown: number;
  firstDelay: number;
  /** Durée du vol (s) : le temps qu'a le joueur pour sortir de la marque. Hauteur de la cloche (m). */
  flightTime: number;
  arc: number;
  /** Rayon de l'éclatement au sol (m) et PV retirés au joueur dedans. */
  radius: number;
  damage: number;
};

export const ENEMIES = {
  /** Marcheur : avance vers le joueur, dégâts au contact. */
  zombie: { name: 'Zombie', model: 'basic', hp: 9, speed: 2.8, damage: 8, xp: 2 },
  /** Coureur : rapide et fragile, il rattrape le joueur. */
  novice: { name: 'Novice zombie', model: 'ribcage', hp: 5, speed: 5.2, damage: 6, xp: 3 },
  /** Tireur : bouteilles vides lancées en cloche, impact marqué au sol. */
  lanceur: {
    name: 'Moine lanceur', model: 'moine', hp: 14, speed: 2.4, damage: 5, xp: 4,
    thrower: { range: 15, cooldown: 3.2, firstDelay: 1.5, flightTime: 1.3, arc: 5, radius: 1.6, damage: 10 },
  },
  /** Kamikaze : fonce, et explose en gerbe de vin (son tonneau). */
  pelerin: {
    name: 'Pèlerin gonflé', model: 'moine_pelerin', hp: 10, speed: 3.6, damage: 0, xp: 4,
    kamikaze: { trigger: 2.2, fuse: 0.9, radius: 3.2, damage: 22 },
  },
  /** Marcheur lourd : il pousse devant lui un gros tonneau qui roule (c'est son modèle), coups au contact. */
  tonnelier: { name: 'Frère tonnelier', model: 'moine_tonnelier', hp: 22, speed: 2.2, damage: 10, xp: 5 },
  /** Fantôme : traverse les murs, intouchable 1 s sur 3. */
  fantome: { name: 'Fantôme du cloître', model: 'fantome', hp: 12, speed: 3, damage: 8, xp: 5, ghost: { every: 3, intangible: 1 } },
  /** Protecteur : ses voisins prennent 50 % de dégâts en moins. */
  reliques: { name: 'Moine porte-reliques', model: 'porte_reliques', hp: 18, speed: 2.6, damage: 6, xp: 6, protector: { radius: 6, reduction: 0.5 } },
  /** Marcheur : s'approche et frappe au corps à corps. */
  gargouille: { name: 'Gargouille', model: 'gargouille', hp: 20, speed: 2.8, damage: 8, xp: 6 },
  /** Invocateur : fait sortir des squelettes de terre autour de lui. */
  prieur: {
    name: 'Prieur', model: 'prieur', hp: 28, speed: 2.4, damage: 8, xp: 8,
    summoner: { enemy: 'squelette', count: 3, range: 14, firstDelay: 3, cooldown: 8, cast: 0.9, radius: 2 },
  },
  /** Invoqué par le Prieur (hors roster) : fragile, rapide, rapporte peu (pas de bière à farmer). */
  squelette: { name: 'Squelette', model: 'squelette', hp: 5, speed: 3.4, damage: 5, xp: 1 },
  /** Tank + diviseur : lent, beaucoup de PV ; tué, il se divise en 3 moinillons. */
  cellerier: {
    name: 'Frère cellérier', model: 'chubby', hp: 60, speed: 1.8, damage: 14, xp: 10,
    splitter: { enemy: 'moinillon', count: 3, radius: 1.2 },
  },
  /** Sorti du Frère cellérier à sa mort (hors roster) : petit, rapide, fragile. */
  moinillon: { name: 'Moinillon', model: 'chubby_petit', hp: 6, speed: 3.8, damage: 4, xp: 1 },
} as const satisfies Record<string, EnemyDef>;

export type EnemyId = keyof typeof ENEMIES;

/** Bouteille vide lancée par les moines : verre vert, sans étiquette dorée (couleurs par matériau du modèle). */
export const THROWN_BOTTLE_LOOK = {
  file: 'Bottle.glb',
  length: 0.42,
  colors: { DarkGreen: 0x2f6b2a, BottleCap: 0x5a5a52, LightBrown: 0x3d7a34 } as Record<string, number>,
  /** Marque au sol : couleur, opacité, épaisseur de l'anneau (part du rayon). */
  markColor: 0xff3a1e,
  markOpacity: 0.55,
  markRing: 0.14,
} as const;

/** Pèlerin gonflé (brique Kamikaze) : marque de la zone pendant la mèche, gonflement, explosion. */
export const KAMIKAZE_LOOK = {
  /** Marque au sol (même langage que les bouteilles : rouge = danger). */
  markColor: 0xff3a1e,
  markOpacity: 0.55,
  markRing: 0.1,
  /** Gonflement du corps à la fin de la mèche (part de sa taille). */
  swell: 0.3,
  /** Hauteur de la gerbe au-dessus du sol (m, le tonneau). */
  burstHeight: 1.0,
  /** Secousse de caméra quand ça explose près du joueur (s'atténue avec la distance, nulle à `shakeDist` m). */
  shake: 0.5,
  shakeAmplitude: 0.35,
  shakeDecay: 2.2,
  shakeDist: 14,
} as const;

/**
 * Buffs entre ennemis (règle de lisibilité, pas de zone au sol : illisible dans une horde) : celui qui
 * donne le buff a une lueur qui brille au-dessus de sa tête, ceux qui le reçoivent ont le corps qui luit.
 * Ici, le halo du Moine porte-reliques (brique Protecteur).
 */
export const PROTECTOR_LOOK = {
  /** Couleur de la lueur (au-dessus de la tête et sur le corps des protégés). */
  color: 0xffc94a,
  /** Étoile au-dessus de la tête : hauteur au-dessus des pieds (m), taille (m), rotation (rad/s), scintillement (part de la taille). */
  haloHeight: 2.25,
  haloSize: 1.1,
  spin: 0.6,
  twinkleSize: 0.25,
  /** Corps des protégés : liseré de lumière sur les contours (intensité, finesse), battement (par s, part de l'intensité). */
  bodyGlow: 0.9,
  rimPower: 2.5,
  bodyPulse: 1.5,
  bodyPulseAmount: 0.25,
} as const;

/** Une entrée de roster : l'ennemi arrive à partir de `from` s de run, avec un poids de tirage. */
export type RosterEntry = { enemy: EnemyId; from: number; weight: number };

/** Roster de chaque map (GDD section 11). */
export const ROSTERS = {
  abbaye: [
    { enemy: 'zombie', from: 0, weight: 1 },
    { enemy: 'novice', from: 60, weight: 1 },
    { enemy: 'lanceur', from: 120, weight: 1 },
    { enemy: 'pelerin', from: 180, weight: 1 },
    { enemy: 'tonnelier', from: 240, weight: 1 },
    { enemy: 'fantome', from: 300, weight: 1 },
    { enemy: 'reliques', from: 360, weight: 1 },
    { enemy: 'gargouille', from: 420, weight: 1 },
    { enemy: 'prieur', from: 480, weight: 1 },
    { enemy: 'cellerier', from: 540, weight: 1 },
  ],
} as const satisfies Record<string, readonly RosterEntry[]>;
