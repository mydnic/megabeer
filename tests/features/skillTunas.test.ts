import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_STAT_CAPS } from '../../src/config/items';
import { SKILL_LINES, WALLET_BONUS } from '../../src/config/skills';
import { emptyProfile, type Profile } from '../../src/meta/profile';
import { runUnlocks } from '../../src/meta/shop';
import { buySkill, skillBonuses, tierPrice, tiersOf } from '../../src/meta/skills';
import { createTestGame } from '../support/testGame';

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seeded(4)); });
afterEach(() => { vi.restoreAllMocks(); });

const line = SKILL_LINES.find((l) => l.id === 'tunas')!;
const others = SKILL_LINES.filter((l) => l !== line);
const walletTier = line.tiers.findIndex((t) => 'wallet' in t.effect);
const perTuna = (line.tiers[walletTier].effect as { wallet: number }).wallet;

/** Un profil qui a fini toutes les autres lignes, puis `n` paliers de la ligne TUNAS, avec `wallet` TUNAS en poche à la fin. */
function profile(n: number, wallet = 0): Profile {
  let p: Profile = { ...emptyProfile(), tunas: 10_000_000 };
  for (const l of others) for (let i = 0; i < l.tiers.length; i++) p = buySkill(p, l.id, i)!;
  for (let i = 0; i < n; i++) p = buySkill(p, line.id, i)!;
  return { ...p, tunas: wallet };
}

/** Une run avec ce que donne le profil `p`. */
function run(p: Profile) {
  const t = createTestGame();
  t.game.unlocks = runUnlocks(p);
  t.startRunAndLand();
  t.noSpawns();
  return t;
}

describe('Skill tree : la ligne TUNAS', () => {
  it('s achète comme les autres lignes, dès le départ, à ses propres prix', () => {
    const p = buySkill({ ...emptyProfile(), tunas: 10_000_000 }, line.id, 1)!;
    expect(tiersOf(p, line.id)).toBe(1);
    expect(p.tunas).toBe(10_000_000 - tierPrice(line, 0));
    expect(buySkill({ ...emptyProfile(), tunas: tierPrice(line, 0) - 1 }, line.id, 1)).toBeNull();
  });

  it('chaque palier de gain fait gagner plus de TUNAS en jeu', () => {
    const plain = run(profile(0));
    plain.game.tunaDrops.drop(plain.game.player.pos.clone(), 100);
    plain.play(2);
    const n = walletTier;
    const gain = (skillBonuses(profile(n)).perks as Record<string, number>).tunaGain;
    expect(gain).toBeGreaterThan(0);
    const t = run(profile(n));
    t.game.tunaDrops.drop(t.game.player.pos.clone(), 100);
    t.play(2);
    expect(plain.game.tunas).toBeGreaterThan(0);
    expect(t.game.tunas).toBeCloseTo(plain.game.tunas * (1 + gain));
  });

  it('le dernier palier : chaque TUNAS en poche au départ ajoute un bonus à toutes les stats, sans plafond', () => {
    const before = run(profile(walletTier, 50_000));
    const base = { stats: { ...before.game.stats }, hp: before.game.health.max };
    const wallet = 50_000;
    const part = wallet * perTuna;
    const t = run(profile(walletTier + 1, wallet));
    const s = t.game.stats as unknown as Record<string, number>;
    const b = base.stats as unknown as Record<string, number>;
    expect(s.damage).toBeCloseTo(b.damage * (1 + part));
    expect(s.attackSpeed).toBeCloseTo(b.attackSpeed * (1 + part));
    expect(s.moveSpeed).toBeCloseTo(b.moveSpeed * (1 + part));
    expect(t.game.health.max).toBe(base.hp + Math.floor(base.hp * part));
    const per = WALLET_BONUS.luck as { per: number };
    expect(s.luck).toBeCloseTo(b.luck + part * per.per);
    const proj = WALLET_BONUS.extraProjectiles as { per: number };
    expect(s.extraProjectiles).toBe(b.extraProjectiles + Math.floor(part * proj.per));
    // Les plafonds tiennent toujours
    expect(t.game.stats.dodgeChance).toBeLessThanOrEqual(ITEM_STAT_CAPS.dodge);
  });

  it('chaque stat a sa règle, et sans TUNAS en poche le dernier palier ne donne rien', () => {
    for (const r of Object.values(WALLET_BONUS)) expect('mul' in r || r.per > 0).toBe(true);
    const empty = run(profile(walletTier + 1, 0));
    const plain = run(profile(walletTier, 0));
    expect(empty.game.stats.damage).toBeCloseTo(plain.game.stats.damage);
    expect(empty.game.health.max).toBe(plain.game.health.max);
  });
});
