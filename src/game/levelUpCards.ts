import type { ItemCard } from './chests';
import { LUCK, RARITIES, rarityValue, type UpgradeDef } from '../config/upgrades';
import type { Weapon, WeaponId } from '../weapons/weapon';
import type { SynergyId } from './synergies';
import { STAT_BONUSES, type PumpTier, type StatId } from '../config/pumps';
import { ITEMS, ITEM_EFFECTS, type ItemDef } from '../config/items';
import type { StatLine } from './playerStats';

/** Amélioration d'une arme équipée, avec sa rareté. */
export type UpgradeCard = { kind: 'upgrade'; weapon: Weapon; upgrade: UpgradeDef; tier: number };
/** Nouvelle arme à équiper (une place libre dans l'arsenal), et les synergies qu'elle activerait. */
export type NewWeaponCard = { kind: 'weapon'; weaponId: WeaponId; synergies: SynergyId[] };
/** Bonus de stat d'une pompe à bière : sa rareté (index dans RARITIES), sa valeur (déjà multipliée), la qualité de la pompe. */
export type StatCard = { kind: 'stat'; stat: StatId; value: number; rarity: number; tier: PumpTier };
/** Une carte proposée : level-up (amélioration, nouvelle arme) ou pompe (bonus de stat). */
export type Card = UpgradeCard | NewWeaponCard | StatCard | ItemCard;

/** Tire un tier de rareté selon la LUCK (les tiers hauts gagnent du poids, plafonné). */
export function rollTier(luck: number) {
  const l = Math.max(0, Math.min(LUCK.cap, luck));
  const w = RARITIES.map((r, n) => r.weight * (1 + LUCK.perPoint * l * n));
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) return i; }
  return 0;
}

const pickOne = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

/** Une amélioration au hasard pour cette arme, à une rareté qui la permet. */
function upgradeCard(weapon: Weapon, luck: number): UpgradeCard | null {
  const tier = rollTier(luck);
  return weapon.upgrades.length ? { kind: 'upgrade', weapon, upgrade: pickOne(weapon.upgrades), tier } : null;
}

/**
 * Tire jusqu'à `n` cartes, chacune pour une arme différente (GDD section 8) : une amélioration au
 * hasard d'une arme équipée, ou une nouvelle arme parmi `available` (débloquées, pas encore
 * équipées ; vide quand l'arsenal est plein). Tant qu'il y a moins de `guaranteeBelow` armes
 * équipées, une des cartes est toujours une nouvelle arme. Moins de choix possibles = moins de cartes.
 */
export function rollCards(n: number, luck: number, equipped: readonly Weapon[], available: readonly WeaponId[], guaranteeBelow = 3): Card[] {
  const cards: Card[] = [];
  const news = [...available];
  const take = (id: WeaponId) => { news.splice(news.indexOf(id), 1); cards.push({ kind: 'weapon', weaponId: id, synergies: [] }); };
  if (equipped.length < guaranteeBelow && news.length && n > 0) take(pickOne(news));
  // Le reste : armes équipées et autres nouvelles armes, mélangées, une carte par arme
  const pool: (Weapon | WeaponId)[] = [...equipped, ...news];
  while (cards.length < n && pool.length) {
    const c = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    if (typeof c === 'string') take(c);
    else { const card = upgradeCard(c, luck); if (card) cards.push(card); }
  }
  // La nouvelle arme garantie n'est pas toujours la première carte
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return cards;
}

/** Valeur de l'effet d'une amélioration (multipliée par son tier, arrondie pour une stat entière). */
export function cardValue(c: UpgradeCard) {
  return rarityValue(c.upgrade.value, c.tier, c.upgrade.whole);
}

/** Texte de l'effet, ex. "+30 % dégâts", "+1 projectile en plus", "+0,3 multiplicateur critique". */
export function cardText(c: UpgradeCard) {
  const v = cardValue(c);
  const k = c.upgrade.kind;
  if (k === 'percent' || k === 'points') return `+${Math.round(v * 100)} % ${c.upgrade.label}`;
  return `+${String(Math.round(v * 100) / 100).replace('.', ',')} ${c.upgrade.label}`;
}

/** Texte d'un bonus de stat (pompe), ex. "+16 % dégâts", "+30 PV max", "+1 m ramassage". */
export function statCardText(c: StatCard) {
  const def = STAT_BONUSES.find((b) => b.id === c.stat)!;
  const num = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',');
  if (def.kind === 'percent') return `+${Math.round(c.value * 100)} % ${def.label}`;
  if (def.kind === 'meters') return `+${num(c.value)} m ${def.label}`;
  return `+${num(c.value)} ${def.label}`;
}

/** Effet d'une carte d'objet, en clair (sa valeur à la rareté tirée). */
export function itemCardText(c: ItemCard) {
  const def: ItemDef = ITEMS[c.item];
  const values: Record<string, number> = {};
  for (const [k, v] of Object.entries(def.stats ?? {})) values[k] = v * c.mult;
  const v = (def.value ?? 0) * c.mult;
  values.v = v;
  // Période (s) : bouclier de mousse (recharges par seconde), coffre du Bonnet
  if (def.effect === 'foamShield') values.every = Math.round(1 / v);
  if (def.effect === 'freeChest') values.every = Math.round(ITEM_EFFECTS.freeChest.every / v);
  const num = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
  return def.text.replace(/\{(\w+)(%?)\}/g, (_, k: string, pct: string) => (pct ? `${num(values[k] * 100)} %` : num(values[k])));
}

/**
 * La stat de l'arme que la carte change, avant et après (ex. Projectiles 1 puis 2), sans toucher à l'arme ; `before`
 * null : la stat n'existait pas encore (premier zombie traversé). Null si la carte ne change aucune stat affichée.
 */
export function cardStatChange(c: UpgradeCard): { before: StatLine | null; after: StatLine } | null {
  const m = c.weapon.mods, id = c.upgrade.id, old = m[id];
  const before = c.weapon.stats();
  m[id] = (old ?? 0) + cardValue(c);
  const after = c.weapon.stats();
  if (old === undefined) delete m[id]; else m[id] = old;
  for (const a of after) {
    const b = before.find((l) => l.label === a.label);
    if (!b) return { before: null, after: a };
    if (Math.abs(b.value - a.value) > 1e-9) return { before: b, after: a };
  }
  return null;
}

/** Applique une amélioration à son arme (améliorations additives, l'arme monte d'un niveau). */
export function applyCard(c: UpgradeCard) {
  c.weapon.mods.level++;
  c.weapon.mods[c.upgrade.id] = (c.weapon.mods[c.upgrade.id] ?? 0) + cardValue(c);
}
