// Boutique (GDD section 14) : ce qu'on débloque avec les TUNAS, entre les runs. Choix de l'utilisateur le 2026-11-12 :
// la boutique vend les persos, les armes (pour qu'elles sortent au level-up) et les objets (pour qu'ils sortent des
// coffres) ; tout le reste (dont Relancer / Bannir / Passer) passe par le skill tree. Ajouter un perso, une arme ou un
// objet à vendre : il suffit de le déclarer ici (pas dans les listes de départ) avec son prix. Prix en TUNAS, à caler sur la run moyenne
// (environ 100 TUNAS).

import type { ItemId } from './items';
import type { WeaponId } from '../weapons/weapon';

/** Persos de la boutique et leur prix (les autres persos du GDD section 5 arriveront ici). */
export const SHOP_CHARACTERS: readonly { id: string; name: string; pitch: string; price: number }[] = [
  { id: 'buveur', name: 'Le Buveur', pitch: 'Pinte à la main, il lance des canettes', price: 0 },
  { id: 'videur', name: 'Le Videur', pitch: '+3 armure, insensible au recul, Tabouret de bar', price: 0 },
];

/** Persos disponibles dès le départ. */
export const STARTING_CHARACTERS: readonly string[] = ['buveur'];

/** Armes disponibles dès le départ (le pool de départ du GDD contient les 4 armes faites). */
export const STARTING_WEAPONS: readonly WeaponId[] = ['canette', 'stout', 'fut', 'gueuze'];

/** Prix d'une arme (environ une run moyenne, GDD section 14). */
export const WEAPON_PRICE = 100;

/** Objets disponibles dès le départ, 3 par rareté (un coffre propose 3 objets différents de sa rareté). */
export const STARTING_ITEMS: readonly ItemId[] = [
  // Commun
  'tourneeRapide', 'biereForte', 'ventreABiere',
  // Peu commun
  'bretelles', 'aimantCapsules', 'ticketTournee',
  // Rare
  'glacons', 'seauAGlace', 'cacahuetes',
  // Dingue
  'lastOrder', 'gueuleDeBois', 'sifflet',
  // Légendaire
  'mousseEpaisse', 'cendrier', 'happyHour',
];

/** Prix d'un objet selon sa rareté (index dans RARITIES : Commun à Légendaire). */
export const ITEM_PRICES = [30, 40, 60, 80, 120] as const;

/**
 * Options sous les cartes de level-up (GDD section 9). Elles se débloqueront dans le skill tree (choix de l'utilisateur) :
 * en attendant, aucune utilisation par run. Le jeu sait déjà les appliquer (game.ts : rerollCards, banishCard, skipCards).
 */
export const CARD_OPTIONS = {
  reroll: { name: 'Relancer', text: 'Tirer 3 nouvelles cartes' },
  banish: { name: 'Bannir', text: 'Retirer une carte du tirage pour le reste de la run' },
  skip: { name: 'Passer', text: 'Ne rien prendre, sans compensation' },
} as const;

export type CardOptionId = keyof typeof CARD_OPTIONS;
