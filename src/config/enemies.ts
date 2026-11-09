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
  /** Brique Chargeur : à portée, il marque une ligne au sol, prend son élan, puis fonce en ligne droite. */
  charger?: ChargerDef;
};

/**
 * Brique Chargeur (GDD section 11) : il s'arrête, marque au sol la ligne de sa charge (droit sur le
 * joueur), prend son élan, puis fonce en ligne droite sans dévier. On l'esquive en sortant de la
 * ligne. Après la charge il reste sonné, puis attend avant d'en relancer une.
 */
export type ChargerDef = {
  /** Distance au joueur (m) à partir de laquelle il prend son élan. */
  range: number;
  /** Durée de l'élan, ligne marquée au sol (s) : le temps qu'a le joueur pour en sortir. */
  windup: number;
  /** Longueur (m) et largeur (m) de la charge, vitesse (m/s). */
  length: number;
  width: number;
  speed: number;
  /** PV retirés au joueur renversé. */
  damage: number;
  /** Sonné après la charge (s), puis délai avant la suivante (s). */
  recover: number;
  cooldown: number;
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
  /** Chargeur : fonce en ligne droite, tonneau en avant comme un bélier. */
  tonnelier: {
    name: 'Frère tonnelier', model: 'moine_tonnelier', hp: 22, speed: 2.4, damage: 8, xp: 5,
    charger: { range: 10, windup: 1.0, length: 14, width: 1.6, speed: 15, damage: 18, recover: 1.4, cooldown: 4 },
  },
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

/** Frère tonnelier (brique Chargeur) : la ligne de sa charge marquée au sol. */
export const CHARGER_LOOK = {
  markColor: 0xff3a1e,
  markOpacity: 0.55,
  /** Largeur des bords de la ligne (m). */
  edge: 0.12,
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
  ],
} as const satisfies Record<string, readonly RosterEntry[]>;
