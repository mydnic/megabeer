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
  /** Un coffre gratuit (un petit fût cadeau) apparaît près de lui toutes les `freeChestEvery` s. */
  freeChestEvery?: number;
  /** Chaque esquive donne un court sprint : vitesse multipliée par `speedMul` pendant `duration` s (la Serveuse). */
  dodgeSprint?: { speedMul: number; duration: number };
  /** Cartes proposées à chaque level-up (le Barman : 4 ; sinon LEVEL_UP_SCREEN.cards). */
  levelUpCards?: number;
  /** Cumuls de poison gagnés à chaque battement dans une flaque (le Futur Marié : 2, le poison monte deux fois plus vite). */
  poisonStacks?: number;
  /** Contrôle d'alcoolémie : un ennemi qui le touche au contact est figé `duration` s, au plus une fois toutes les `cooldown` s (pas les boss). */
  contactStun?: { duration: number; cooldown: number };
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
  pereNoel: {
    name: 'Le Père Noël', pitch: 'Un cadeau près de lui toutes les 2 min. Costaud mais lent. Bière de Noël.', weapon: 'biereNoel', model: 'pere_noel',
    stats: [{ stat: 'maxHp', value: 25 }, { stat: 'moveSpeed', value: -0.08 }],
    freeChestEvery: 120,
  },
  cop: {
    name: 'Le Cop', pitch: "Contrôle d'alcoolémie : qui le touche reste figé un instant. Très costaud, lent. Rot sonique.", weapon: 'rot', model: 'cop',
    stats: [{ stat: 'maxHp', value: 40 }, { stat: 'moveSpeed', value: -0.12 }],
    contactStun: { duration: 0.5, cooldown: 3 },
  },
  futurMarie: {
    name: 'Le Futur Marié', pitch: "Enterrement de vie de garçon : son poison monte deux fois plus vite. Rapide mais fragile. Flaque de vomi.", weapon: 'vomi', model: 'marie',
    stats: [{ stat: 'maxHp', value: -15 }, { stat: 'moveSpeed', value: 0.1 }, { stat: 'pickupRange', value: 1 }],
    poisonStacks: 2,
  },
  barman: {
    name: 'Le Barman', pitch: 'Robot barman misanthrope, il connaît la carte : 4 choix à chaque level-up au lieu de 3. Moins de dégâts. Tireuse à bière.', weapon: 'tireuse', model: 'barman',
    stats: [{ stat: 'damage', value: -0.1 }],
    levelUpCards: 4,
  },
  serveuse: {
    name: 'La Serveuse', pitch: 'Sur patins : +10 % esquive, et chaque esquive lui donne un coup de vitesse. Fragile. Plateau de serveur.', weapon: 'plateau', model: 'serveuse',
    stats: [{ stat: 'dodge', value: 0.1 }, { stat: 'maxHp', value: -10 }, { stat: 'attackSpeed', value: 0.1 }],
    dodgeSprint: { speedMul: 1.5, duration: 1.2 },
  },
} as const satisfies Record<string, CharacterDef>;

export type CharacterId = keyof typeof CHARACTERS;

/** Maps jouables (une seule pour l'instant ; l'id est celui de game/mechanics). */
export const MAPS = {
  abbaye: { name: "L'Abbaye", pitch: 'Cloître, moines zombies et cloches qui sonnent le débarquement.' },
} as const;
