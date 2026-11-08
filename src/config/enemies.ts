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
};

export const ENEMIES = {
  /** Marcheur : avance vers le joueur, dégâts au contact. */
  zombie: { name: 'Zombie', model: 'basic', hp: 9, speed: 2.8, damage: 8, xp: 2 },
  /** Coureur : rapide et fragile, il rattrape le joueur. */
  novice: { name: 'Novice zombie', model: 'ribcage', hp: 5, speed: 5.2, damage: 6, xp: 3 },
} as const satisfies Record<string, EnemyDef>;

export type EnemyId = keyof typeof ENEMIES;

/** Une entrée de roster : l'ennemi arrive à partir de `from` s de run, avec un poids de tirage. */
export type RosterEntry = { enemy: EnemyId; from: number; weight: number };

/** Roster de chaque map (GDD section 11). */
export const ROSTERS = {
  abbaye: [
    { enemy: 'zombie', from: 0, weight: 1 },
    { enemy: 'novice', from: 60, weight: 1 },
  ],
} as const satisfies Record<string, readonly RosterEntry[]>;
