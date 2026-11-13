// Le skill tree, pur : paliers achetés, achat dans l'ordre, et ce que la run en reçoit. Testé tel quel.

import type { ItemStatId } from '../config/items';
import type { CardOptionId } from '../config/shop';
import { SKILL_LINES, SKILL_PRICES, type SkillLine } from '../config/skills';
import type { Profile } from './profile';

/** Paliers achetés dans une ligne (0 à tous). */
export const tiersOf = (p: Profile, line: string) => Math.max(0, Math.floor(p.skills[line] ?? 0));

/** Prix du prochain palier d'une ligne, ou null si la ligne est complète. */
export function nextPrice(p: Profile, line: SkillLine) {
  const n = tiersOf(p, line.id);
  return n < line.tiers.length ? SKILL_PRICES[Math.min(n, SKILL_PRICES.length - 1)] : null;
}

/** Achète le palier suivant d'une ligne (jamais un palier plus loin). Null si la ligne est complète, inconnue, ou trop chère. */
export function buySkill(p: Profile, lineId: string, now: number): Profile | null {
  const line = SKILL_LINES.find((l) => l.id === lineId);
  if (!line) return null;
  const price = nextPrice(p, line);
  if (price === null || p.tunas < price) return null;
  return { ...p, tunas: p.tunas - price, skills: { ...p.skills, [lineId]: tiersOf(p, lineId) + 1 }, updatedAt: now };
}

/** Ce que la run reçoit des paliers achetés : des bonus de stat, et des utilisations d'options de cartes. */
export function skillBonuses(p: Profile) {
  const stats: { stat: ItemStatId; value: number }[] = [];
  const options: Record<CardOptionId, number> = { reroll: 0, banish: 0, skip: 0 };
  for (const line of SKILL_LINES) {
    for (const tier of line.tiers.slice(0, tiersOf(p, line.id))) {
      if ('stat' in tier.effect) stats.push({ stat: tier.effect.stat, value: tier.effect.value });
      else options[tier.effect.option] += tier.effect.uses;
    }
  }
  return { stats, options };
}
