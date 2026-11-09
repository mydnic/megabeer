import type * as THREE from 'three';
import type { Zombie } from '../enemies/zombie';
import type { PlayerStats, StatLine } from '../game/playerStats';
import type { UpgradeDef } from '../config/upgrades';

/** Identifiant d'arme (une entrée de src/weapons/registry.ts). */
export type WeaponId = 'canette' | 'stout' | 'fut' | 'gueuze';

/** Améliorations d'une arme gagnées en run : un champ par id de carte, plus son niveau. */
export type WeaponMods = { level: number } & Record<string, number>;

/**
 * Geste de lancer du perso : l'arme demande l'animation et lit la position de la main au moment du
 * lâcher. Le jeu branche l'animation du Buveur ; sans elle (tests), la main est devant le torse.
 */
export interface ThrowRig {
  gesture(rate: number): void;
  handPos(out: THREE.Vector3): THREE.Vector3;
}

/** Ce qu'une arme peut lire et déclencher dans le jeu (elle ne connaît rien d'autre). */
export interface WeaponContext {
  zombies(): readonly Zombie[];
  playerPos(): THREE.Vector3;
  stats: PlayerStats;
  rig: ThrowRig;
  /** Rayon du sol sous un point. */
  groundAt(p: THREE.Vector3): number;
  /**
   * Un projectile touche un zombie : le jeu applique les dégâts et annonce le coup. `knock` multiplie
   * le recul normal d'un coup (armes lourdes).
   */
  hitZombie(weapon: Weapon, z: Zombie, damage: number, crit: boolean, impact: THREE.Vector3, vel: THREE.Vector3, knock?: number): void;
  /** Le décor (arbre, mur...) occupe-t-il ce point, à `margin` m près ? */
  blocked(p: THREE.Vector3, margin: number): boolean;
  /** Une arme explose en `pos` dans un rayon `radius` (pour l'affichage et les sons ; elle applique ses dégâts elle-même). */
  explode(weapon: Weapon, pos: THREE.Vector3, radius: number): void;
  /** Un projectile s'écrase au sol. */
  hitGround(weapon: Weapon, pos: THREE.Vector3, vel: THREE.Vector3): void;
}

/** Un projectile en vol (lu par l'affichage pour dessiner la bouteille). */
export type Projectile = {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  /** Verticale au lancer et axe de rotation : l'affichage en déduit l'orientation. */
  up0: THREE.Vector3;
  spinAxis: THREE.Vector3;
  /** Tours par seconde. */
  spinRate: number;
  gravity: number;
  age: number;
  /** Échelle (stat Taille). */
  size: number;
  active: boolean;
};

/**
 * Une arme équipée. Ajouter une arme = un fichier qui implémente cette interface + une entrée dans
 * le registre et la config ; le reste du jeu (cartes, HUD, pause) passe par elle.
 */
export interface Weapon {
  readonly id: WeaponId;
  readonly name: string;
  /** Cartes de level-up possibles pour cette arme. */
  readonly upgrades: readonly UpgradeDef[];
  readonly mods: WeaponMods;
  readonly projectiles: readonly Projectile[];
  /** Attaque (appelée en run, quand le joueur peut agir). */
  update(dt: number): void;
  /** Fait voler les projectiles (même après la mort du joueur). */
  updateProjectiles(dt: number): void;
  /** Revient à l'état de départ (nouvelle run). */
  reset(): void;
  /** Stats effectives pour l'écran de pause. */
  stats(): StatLine[];
}
