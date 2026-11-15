import type * as THREE from 'three';
import type { Zombie } from '../enemies/zombie';
import type { PlayerStats, StatLine } from '../game/playerStats';
import type { UpgradeDef } from '../config/upgrades';
import type { SynergyId } from '../game/synergies';

/** Identifiant d'arme (une entrée de src/weapons/registry.ts). */
export type WeaponId = 'canette' | 'stout' | 'fut' | 'gueuze' | 'tabouret' | 'biereNoel' | 'decapsuleur' | 'flaqueBiere' | 'kriek' | 'triple' | 'ipa' | 'sousBock' | 'flechettes' | 'bouchons' | 'petanque' | 'bac' | 'vomi' | 'weizen' | 'tireuse' | 'corne' | 'rot' | 'odeur' | 'plateau' | 'des421';

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
  /**
   * Zombies debout près de `p` : remplit `out` avec des candidats (ceux dont la case de la grille touche
   * la sphère de rayon `r`) et le renvoie. À filtrer par la distance exacte. Bien plus rapide que de
   * parcourir `zombies()` pour un projectile en vol.
   */
  zombiesNear(p: THREE.Vector3, r: number, out: Zombie[]): Zombie[];
  playerPos(): THREE.Vector3;
  /** Où regarde le joueur (direction de sa course), dans le plan du sol. */
  playerFacing(): THREE.Vector3;
  /** XP ramassée depuis le début de la run (le Rot sonique se charge avec). */
  xpGathered(): number;
  /** La synergie `id` est-elle active (toutes ses armes équipées) ? */
  synergy(id: SynergyId): boolean;
  /** Zones au sol d'une autre arme équipée (flaques : la synergie Glissade du Fût les lit). */
  zonesOf(id: WeaponId): readonly Zone[];
  /** Déclenche une autre arme équipée tout de suite (synergie Service musclé : le tabouret tourne). */
  trigger(id: WeaponId): void;
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
  /** Pas dessiné (éclats d'un bac de bière : seule leur traînée se voit). */
  hidden?: boolean;
};

/** Une zone posée au sol par une arme (flaque...) : centre, rayon (m), âge et durée de vie (s). */
export type Zone = { pos: THREE.Vector3; radius: number; age: number; life: number; active: boolean };

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
  /** Zones au sol à dessiner (armes à flaques). */
  readonly zones?: readonly Zone[];
  /** Attaque (appelée en run, quand le joueur peut agir). */
  update(dt: number): void;
  /** Fait voler les projectiles (même après la mort du joueur). */
  updateProjectiles(dt: number): void;
  /** Un coup arrive sur le joueur (de `from`, ou null) : vrai si l'arme le bloque (Plateau de serveur). */
  absorbHit?(from: Zombie | null): boolean;
  /** Attaque tout de suite, hors de son rythme (déclenchée par une synergie). */
  trigger?(): void;
  /** Revient à l'état de départ (nouvelle run). */
  reset(): void;
  /** Stats effectives pour l'écran de pause. */
  stats(): StatLine[];
}
