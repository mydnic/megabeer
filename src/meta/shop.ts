// La boutique (GDD section 14), pure : ce qui est à vendre, ce qui est débloqué, et l'achat. Testée telle quelle.

import { ITEMS, type ItemDef, type ItemId } from '../config/items';
import { CARD_OPTIONS, ITEM_PRICES, SHOP_CHARACTERS, STARTING_CHARACTERS, STARTING_ITEMS, STARTING_WEAPONS, WEAPON_PRICE, type CardOptionId } from '../config/shop';
import { WEAPON_FACTORIES } from '../weapons/registry';
import type { WeaponId } from '../weapons/weapon';
import type { Profile } from './profile';
import { skillBonuses } from './skills';
import type { ItemStatId } from '../config/items';

/** Un article : un perso (`character:<id>`), une arme (`weapon:<id>`) ou un objet (`item:<id>`). */
export type ShopEntry =
  | { key: string; kind: 'character'; character: string; name: string; pitch: string; price: number }
  | { key: string; kind: 'weapon'; weapon: WeaponId; price: number }
  | { key: string; kind: 'item'; item: ItemId; rarity: number; price: number };

const itemKey = (id: ItemId) => `item:${id}`;
const weaponKey = (id: WeaponId) => `weapon:${id}`;

/** Tout le catalogue : les persos, les armes, puis les objets par rareté (ceux donnés au départ compris, déjà débloqués). */
export function catalog(): ShopEntry[] {
  const characters = SHOP_CHARACTERS.map((c): ShopEntry => ({ key: `character:${c.id}`, kind: 'character', character: c.id, name: c.name, pitch: c.pitch, price: c.price }));
  const weapons = (Object.keys(WEAPON_FACTORIES) as WeaponId[])
    .map((weapon): ShopEntry => ({ key: weaponKey(weapon), kind: 'weapon', weapon, price: WEAPON_PRICE }));
  const items = (Object.keys(ITEMS) as ItemId[])
    .map((item): ShopEntry => { const rarity = (ITEMS[item] as ItemDef).rarity; return { key: itemKey(item), kind: 'item', item, rarity, price: ITEM_PRICES[rarity] }; })
    .sort((a, b) => (a.kind === 'item' && b.kind === 'item' ? a.rarity - b.rarity : 0));
  return [...characters, ...weapons, ...items];
}

/** L'article est-il débloqué (acheté, ou donné au départ) ? */
export function owned(p: Profile, key: string) {
  if (isStarting(key)) return true;
  return p.unlocks.includes(key);
}

/** Donné au départ (pas à acheter). */
export function isStarting(key: string) {
  if (key.startsWith('character:')) return STARTING_CHARACTERS.includes(key.slice(10));
  if (key.startsWith('item:')) return STARTING_ITEMS.includes(key.slice(5) as ItemId);
  if (key.startsWith('weapon:')) return STARTING_WEAPONS.includes(key.slice(7) as WeaponId);
  return false;
}

/** Achète un article : le prix est retiré des TUNAS. Null si déjà débloqué, inconnu, ou pas assez de TUNAS. */
export function buy(p: Profile, key: string, now: number): Profile | null {
  const entry = catalog().find((e) => e.key === key);
  if (!entry || owned(p, key) || p.tunas < entry.price) return null;
  return { ...p, tunas: p.tunas - entry.price, unlocks: [...p.unlocks, key], updatedAt: now };
}

/**
 * Ce que la run peut utiliser : les armes qui sortent au level-up, les objets qui sortent des coffres (boutique), les
 * utilisations des options de cartes et les bonus de stat du début de run (skill tree).
 */
export type RunUnlocks = { weapons: ReadonlySet<WeaponId>; items: ReadonlySet<ItemId>; options: Record<CardOptionId, number>; bonuses: readonly { stat: ItemStatId; value: number }[] };

export function runUnlocks(p: Profile): RunUnlocks {
  const weapons = new Set((Object.keys(WEAPON_FACTORIES) as WeaponId[]).filter((id) => owned(p, weaponKey(id))));
  const items = new Set((Object.keys(ITEMS) as ItemId[]).filter((id) => owned(p, itemKey(id))));
  const skills = skillBonuses(p);
  const options = {} as Record<CardOptionId, number>;
  for (const o of Object.keys(CARD_OPTIONS) as CardOptionId[]) options[o] = skills.options[o];
  return { weapons, items, options, bonuses: skills.stats };
}
