// Mode Super Saiyan (GDD section 10, issue #7) : l'objet Sang Saiyan (Légendaire, un seul par run, débloqué par un
// succès) active la jauge de colère. Elle se remplit en tuant et en prenant des coups, par paliers exponentiels ; à la
// touche de transformation (F, Y à la manette), le joueur se transforme au plus haut palier atteint pendant `duration`
// s, puis la jauge retombe à 0. Elle ne se remplit pas pendant la transformation.

import type { ItemStatId } from './items';

/** Un palier : son nom, ses bonus de stat pendant la transformation, ses effets à part, sa couleur d'aura. */
export type SaiyanTier = {
  id: string; name: string;
  /** Bonus de stat (s'ajoutent pendant la transformation, retirés à la fin). */
  stats: Partial<Record<ItemStatId, number>>;
  /** Kaioken : PV perdus par seconde (jamais sous 1 PV : ce coût ne tue pas). */
  hpDrain?: number;
  /** SSJ2 : un éclair frappe l'ennemi le plus proche à moins de `range` m toutes les `every` s (`damage` x la montée des PV des ennemis). */
  lightning?: { every: number; range: number; damage: number };
  /** Ultra Instinct : esquive toutes les attaques, sauf celles des boss. */
  dodgeAll?: boolean;
  /** Couleurs : aura, et cheveux (absent : ceux du perso). */
  aura: number; hair?: number;
  /** Coiffure posée sur la tête (src/assets/models/cheveux_<style>.glb) ; absente : ses cheveux à lui (Kaioken). */
  hairStyle?: 'ssj' | 'ssj3';
};

export const SAIYAN = {
  /** Points de jauge : par ennemi tué, par élite, par boss, par PV perdu. */
  points: { kill: 1, elite: 5, boss: 50, perHpLost: 2 },
  /** Points à atteindre pour chaque palier (x3 à chaque fois). */
  thresholds: [100, 300, 900, 2700, 8100, 24300],
  /** Durée de la transformation (s). */
  duration: 60,
  tiers: [
    { id: 'kaioken', name: 'Kaioken', stats: { damage: 0.25, moveSpeed: 0.15 }, hpDrain: 1, aura: 0xff3a2a },
    { id: 'ssj', name: 'Super Saiyan', stats: { damage: 0.5, attackSpeed: 0.2, moveSpeed: 0.2 }, aura: 0xffd23a, hair: 0xffd23a, hairStyle: 'ssj' },
    { id: 'ssj2', name: 'Super Saiyan 2', stats: { damage: 0.75, attackSpeed: 0.3 }, lightning: { every: 0.5, range: 10, damage: 35 }, aura: 0xffe25a, hair: 0xffd23a, hairStyle: 'ssj' },
    { id: 'ssj3', name: 'Super Saiyan 3', stats: { damage: 1, attackSpeed: 0.4, size: 0.5 }, aura: 0xffd23a, hair: 0xffc81a, hairStyle: 'ssj3' },
    { id: 'ssj4', name: 'Super Saiyan 4', stats: { damage: 1.5, attackSpeed: 0.5, extraProjectiles: 2, lifeSteal: 0.1 }, aura: 0xff2a3a, hair: 0x2a2224, hairStyle: 'ssj3' },
    { id: 'ui', name: 'Ultra Instinct', stats: { damage: 2, moveSpeed: 0.5 }, dodgeAll: true, aura: 0xdfe8ff, hair: 0xd8e2f2, hairStyle: 'ssj' },
  ] as readonly SaiyanTier[],
} as const;

/**
 * Rendu. Aura (flamme face à la caméra) : largeur et hauteur (m), marge du cadre autour (x : les langues de feu y
 * montent sans être coupées), part d'opacité de la flamme de devant, recul de celle
 * de derrière et avance de celle de devant (m), apparition et extinction (s), coup de grandeur à la transformation (x en
 * plus, durée s). Éclair : couleur, points le long du trait.
 */
export const SAIYAN_LOOK = {
  aura: { width: 3.4, height: 3.9, margin: [1.25, 1.45] as const, front: 0.45, backOffset: 0.35, frontOffset: 0.55, fadeIn: 0.25, fadeOut: 0.6, burstScale: 0.6, burstTime: 0.45 },
  lightning: { color: 0xbfe8ff, points: 10 },
  /** Cheveux : taille (x la hauteur de la tête du perso), remontée au-dessus du centre de la tête (même unité), pousse (s). */
  hair: { scale: 1.15, lift: 0.18, growTime: 0.35 },
} as const;
