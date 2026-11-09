import { LUCK, RARITIES, type UpgradeDef } from '../config/upgrades';
import type { Weapon, WeaponId } from '../weapons/weapon';
import type { SynergyId } from './synergies';

/** Amélioration d'une arme équipée, avec sa rareté. */
export type UpgradeCard = { kind: 'upgrade'; weapon: Weapon; upgrade: UpgradeDef; tier: number };
/** Nouvelle arme à équiper (une place libre dans l'arsenal), et les synergies qu'elle activerait. */
export type NewWeaponCard = { kind: 'weapon'; weaponId: WeaponId; synergies: SynergyId[] };
/** Une carte de level-up. */
export type Card = UpgradeCard | NewWeaponCard;

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
  const ok = weapon.upgrades.filter((u) => (u.minTier ?? 0) <= tier);
  return ok.length ? { kind: 'upgrade', weapon, upgrade: pickOne(ok), tier } : null;
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

/** Valeur de l'effet d'une amélioration (multipliée par son tier, sauf effets fixes). */
export function cardValue(c: UpgradeCard) {
  return c.upgrade.fixed ? c.upgrade.value : c.upgrade.value * RARITIES[c.tier].mult;
}

/** Texte de l'effet, ex. "+30 % dégâts", "+1 projectile en plus", "+0,3 multiplicateur critique". */
export function cardText(c: UpgradeCard) {
  const v = cardValue(c);
  const k = c.upgrade.kind;
  if (k === 'percent' || k === 'points') return `+${Math.round(v * 100)} % ${c.upgrade.label}`;
  return `+${String(Math.round(v * 100) / 100).replace('.', ',')} ${c.upgrade.label}`;
}

/** Applique une amélioration à son arme (améliorations additives, l'arme monte d'un niveau). */
export function applyCard(c: UpgradeCard) {
  c.weapon.mods.level++;
  c.weapon.mods[c.upgrade.id] = (c.weapon.mods[c.upgrade.id] ?? 0) + cardValue(c);
}
