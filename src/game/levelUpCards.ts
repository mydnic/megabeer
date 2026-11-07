import { BLONDE_UPGRADES, LUCK, RARITIES } from '../config/upgrades';

export type Upgrade = (typeof BLONDE_UPGRADES)[number];
export type Card = { weapon: 'blonde'; upgrade: Upgrade; tier: number };

/** Tire un tier de rareté selon la LUCK (les tiers hauts gagnent du poids, plafonné). */
export function rollTier(luck: number) {
  const l = Math.max(0, Math.min(LUCK.cap, luck));
  const w = RARITIES.map((r, n) => r.weight * (1 + LUCK.perPoint * l * n));
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) return i; }
  return 0;
}

/** Tire `n` cartes d'améliorations différentes, chacune avec sa rareté. */
export function rollCards(n: number, luck: number): Card[] {
  const cards: Card[] = [];
  const used = new Set<string>();
  for (let i = 0; i < n; i++) {
    const tier = rollTier(luck);
    const pool = BLONDE_UPGRADES.filter((u) => !used.has(u.id) && ('minTier' in u ? u.minTier : 0) <= tier);
    if (!pool.length) break;
    const upgrade = pool[Math.floor(Math.random() * pool.length)];
    used.add(upgrade.id);
    cards.push({ weapon: 'blonde', upgrade, tier });
  }
  return cards;
}

/** Valeur de l'effet d'une carte (multipliée par son tier, sauf effets fixes). */
export function cardValue(c: Card) {
  const fixed = 'fixed' in c.upgrade && c.upgrade.fixed;
  return fixed ? c.upgrade.value : c.upgrade.value * RARITIES[c.tier].mult;
}

/** Texte de l'effet, ex. « +30 % dégâts », « +1 bouteille en plus ». */
export function cardText(c: Card) {
  const v = cardValue(c);
  return c.upgrade.kind === 'percent' ? `+${Math.round(v * 100)} % ${c.upgrade.label}` : `+${v} ${c.upgrade.label}`;
}

/** Applique une carte aux améliorations de l'arme. */
export function applyCard(c: Card, mods: { level: number; damage: number; rate: number; projectiles: number; speed: number; range: number }) {
  const v = cardValue(c);
  mods.level++;
  switch (c.upgrade.id) {
    case 'damage': mods.damage += v; break;
    case 'rate': mods.rate += v; break;
    case 'projectiles': mods.projectiles += v; break;
    case 'speed': mods.speed += v; break;
    case 'range': mods.range += v; break;
  }
}
