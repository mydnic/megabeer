// Persos jouables (GDD section 5) : arme de départ, passif, stats, modèle. Choisis sur l'écran avant la partie.
// Ajouter un perso : une entrée ici (son modèle généré par tools/blender/buveur.py --variant), son déblocage dans
// config/shop.ts (SHOP_CHARACTERS) ou par un succès (config/achievements.ts, `unlocks`).

import type { ItemStatId } from './items';
import type { WeaponId } from '../weapons/weapon';

export type CharacterDef = {
  name: string;
  /** Ce qu'il fait, en une ligne (écran de choix). */
  pitch: string;
  weapon: WeaponId;
  /** Modèle 3D (src/assets/models/<model>.glb). */
  model: string;
  /** Bonus de stat au début de chaque run (s'ajoutent à ceux du skill tree). */
  stats: readonly { stat: ItemStatId; value: number }[];
  /** Insensible au recul : les coups des ennemis ne le repoussent pas. */
  knockImmune?: boolean;
};

export const CHARACTERS = {
  buveur: {
    name: 'Le Buveur', pitch: 'Pinte à la main, il lance des canettes. Équilibré.', weapon: 'canette', model: 'buveur', stats: [],
  },
  videur: {
    name: 'Le Videur', pitch: '+3 armure, insensible au recul, costaud mais lent. Tabouret de bar.', weapon: 'tabouret', model: 'videur',
    stats: [{ stat: 'armor', value: 3 }, { stat: 'maxHp', value: 30 }, { stat: 'moveSpeed', value: -0.1 }],
    knockImmune: true,
  },
} as const satisfies Record<string, CharacterDef>;

export type CharacterId = keyof typeof CHARACTERS;

/** Maps jouables (une seule pour l'instant ; l'id est celui de game/mechanics). */
export const MAPS = {
  abbaye: { name: "L'Abbaye", pitch: 'Cloître, moines zombies et cloches qui sonnent le débarquement.' },
} as const;
