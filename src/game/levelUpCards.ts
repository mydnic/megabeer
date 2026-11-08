import { LUCK, RARITIES, type UpgradeDef } from '../config/upgrades';
import type { Weapon } from '../weapons/weapon';

/** Une carte de level-up : une amélioration d'une arme équipée, avec sa rareté. */
export type Card = { weapon: Weapon; upgrade: UpgradeDef; tier: number };

/** Tire un tier de rareté selon la LUCK (les tiers hauts gagnent du poids, plafonné). */
export function rollTier(luck: number) {
  const l = Math.max(0, Math.min(LUCK.cap, luck));
  const w = RARITIES.map((r, n) => r.weight * (1 + LUCK.perPoint * l * n));
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) return i; }
  return 0;
}

/** Tire `n` cartes différentes parmi les améliorations des armes équipées, chacune avec sa rareté. */
export function rollCards(n: number, luck: number, weapons: readonly Weapon[]): Card[] {
  const cards: Card[] = [];
  const used = new Set<string>();
  const all = weapons.flatMap((weapon) => weapon.upgrades.map((upgrade) => ({ weapon, upgrade })));
  for (let i = 0; i < n; i++) {
    const tier = rollTier(luck);
    const pool = all.filter((c) => !used.has(`${c.weapon.id}:${c.upgrade.id}`) && (c.upgrade.minTier ?? 0) <= tier);
    if (!pool.length) break;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    used.add(`${pick.weapon.id}:${pick.upgrade.id}`);
    cards.push({ ...pick, tier });
  }
  return cards;
}

/** Valeur de l'effet d'une carte (multipliée par son tier, sauf effets fixes). */
export function cardValue(c: Card) {
  return c.upgrade.fixed ? c.upgrade.value : c.upgrade.value * RARITIES[c.tier].mult;
}

/** Texte de l'effet, ex. "+30 % dégâts", "+1 projectile en plus", "+0,3 multiplicateur critique". */
export function cardText(c: Card) {
  const v = cardValue(c);
  const k = c.upgrade.kind;
  if (k === 'percent' || k === 'points') return `+${Math.round(v * 100)} % ${c.upgrade.label}`;
  return `+${String(Math.round(v * 100) / 100).replace('.', ',')} ${c.upgrade.label}`;
}

/** Applique une carte à son arme (améliorations additives, l'arme monte d'un niveau). */
export function applyCard(c: Card) {
  c.weapon.mods.level++;
  c.weapon.mods[c.upgrade.id] = (c.weapon.mods[c.upgrade.id] ?? 0) + cardValue(c);
}
