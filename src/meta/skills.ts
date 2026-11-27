// Le skill tree, pur : paliers achetés, achat dans l'ordre, et ce que la run en reçoit. Testé tel quel.

import type { ItemStatId } from '../config/items';
import type { CardOptionId } from '../config/shop';
import { PERK_IDS, SKILL_LINES, SKILL_PRICES, type PerkId, type SkillLine } from '../config/skills';
import type { Profile } from './profile';

/** Paliers achetés dans une ligne (0 à tous). */
export const tiersOf = (p: Profile, line: string) => Math.max(0, Math.floor(p.skills[line] ?? 0));

/** Prix du palier `i` (0 = le premier) d'une ligne : ses prix propres, sinon `SKILL_PRICES`. */
export function tierPrice(line: SkillLine, i: number) {
  const prices = line.prices ?? SKILL_PRICES;
  return prices[Math.min(i, prices.length - 1)];
}

/** Une ligne s'achète-t-elle ? Celles marquées `requiresAll` attendent que toutes les autres soient complètes. */
export function lineOpen(p: Profile, line: SkillLine) {
  return !line.requiresAll || SKILL_LINES.every((l) => l.requiresAll || tiersOf(p, l.id) >= l.tiers.length);
}

/** Prix du prochain palier d'une ligne, ou null si la ligne est complète. */
export function nextPrice(p: Profile, line: SkillLine) {
  const n = tiersOf(p, line.id);
  return n < line.tiers.length ? tierPrice(line, n) : null;
}

/** Achète le palier suivant d'une ligne (jamais un palier plus loin). Null si la ligne est complète, fermée, inconnue, ou trop chère. */
export function buySkill(p: Profile, lineId: string, now: number): Profile | null {
  const line = SKILL_LINES.find((l) => l.id === lineId);
  if (!line || !lineOpen(p, line)) return null;
  const price = nextPrice(p, line);
  if (price === null || p.tunas < price) return null;
  return { ...p, tunas: p.tunas - price, skills: { ...p.skills, [lineId]: tiersOf(p, lineId) + 1 }, updatedAt: now };
}

/**
 * Ce que la run reçoit des paliers achetés : des bonus de stat, des utilisations d'options de cartes, des bonus de
 * mécanique, et `wallet` : la part de bonus de toutes les stats que donne le portefeuille (0,25 = +25 %).
 */
export function skillBonuses(p: Profile) {
  const stats: { stat: ItemStatId; value: number }[] = [];
  const options: Record<CardOptionId, number> = { reroll: 0, banish: 0, skip: 0 };
  const perks = Object.fromEntries(PERK_IDS.map((id) => [id, 0])) as Record<PerkId, number>;
  let perTuna = 0;
  for (const line of SKILL_LINES) {
    for (const tier of line.tiers.slice(0, tiersOf(p, line.id))) {
      const e = tier.effect;
      if ('stat' in e) stats.push({ stat: e.stat, value: e.value });
      else if ('perk' in e) perks[e.perk] += e.value;
      else if ('wallet' in e) perTuna += e.wallet;
      else options[e.option] += e.uses;
    }
  }
  return { stats, options, perks, wallet: perTuna * Math.max(0, p.tunas) };
}
