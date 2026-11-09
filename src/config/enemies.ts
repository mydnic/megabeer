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

/** Une entrée de roster : l'ennemi arrive à partir de `from` s de run, avec un poids de tirage. */
export type RosterEntry = { enemy: EnemyId; from: number; weight: number };

/** Roster de chaque map (GDD section 11). */
export const ROSTERS = {
  abbaye: [
    { enemy: 'zombie', from: 0, weight: 1 },
    { enemy: 'novice', from: 60, weight: 1 },
    { enemy: 'lanceur', from: 120, weight: 1 },
  ],
} as const satisfies Record<string, readonly RosterEntry[]>;
