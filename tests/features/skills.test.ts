import { describe, expect, it } from 'vitest';
import { PLAYER_STATS } from '../../src/config/player';
import { SKILL_LINES, SKILL_PRICES } from '../../src/config/skills';
import { emptyProfile, mergeProfiles, readProfile } from '../../src/meta/profile';
import { runUnlocks } from '../../src/meta/shop';
import { buySkill, skillBonuses, tiersOf } from '../../src/meta/skills';
import { createTestGame } from '../support/testGame';

const rich = (tunas = 100_000) => ({ ...emptyProfile(), tunas });

describe('Le skill tree', () => {
  it('des catégories, chacune une ligne de paliers', () => {
    expect(SKILL_LINES.length).toBeGreaterThanOrEqual(5);
    for (const l of SKILL_LINES) expect(l.tiers.length).toBeGreaterThan(1);
  });

  it('les paliers s achètent dans l ordre, au prix de leur rang', () => {
    const line = SKILL_LINES[0];
    let p = rich(1000);
    p = buySkill(p, line.id, 1)!;
    expect(tiersOf(p, line.id)).toBe(1);
    expect(p.tunas).toBe(1000 - SKILL_PRICES[0]);
    p = buySkill(p, line.id, 2)!;
    expect(tiersOf(p, line.id)).toBe(2);
    expect(p.tunas).toBe(1000 - SKILL_PRICES[0] - SKILL_PRICES[1]);
  });

  it('impossible sans assez de TUNAS, au-delà du dernier palier, ou sur une ligne inconnue', () => {
    const line = SKILL_LINES[0];
    expect(buySkill(rich(SKILL_PRICES[0] - 1), line.id, 1)).toBeNull();
    let p = rich();
    for (let i = 0; i < line.tiers.length; i++) p = buySkill(p, line.id, i)!;
    expect(buySkill(p, line.id, 9)).toBeNull();
    expect(buySkill(rich(), 'nimportequoi', 1)).toBeNull();
  });

  it('gardé dans la sauvegarde, et réuni à la première connexion', () => {
    const [a, b] = SKILL_LINES;
    const p = buySkill(rich(), a.id, 1)!;
    expect(tiersOf(readProfile(JSON.parse(JSON.stringify(p))), a.id)).toBe(1);
    const m = mergeProfiles(p, buySkill(rich(), b.id, 1)!, 2);
    expect(tiersOf(m, a.id) + tiersOf(m, b.id)).toBe(2);
  });

  it('la ligne Cartes débloque Relancer, Bannir, Passer pour la run', () => {
    const cartes = SKILL_LINES.find((l) => l.id === 'cartes')!;
    let p = rich();
    expect(runUnlocks(p).options).toEqual({ reroll: 0, banish: 0, skip: 0 });
    for (let i = 0; i < cartes.tiers.length; i++) p = buySkill(p, 'cartes', i)!;
    const o = runUnlocks(p).options;
    expect(o.reroll).toBeGreaterThanOrEqual(1);
    expect(o.banish).toBeGreaterThanOrEqual(1);
    expect(o.skip).toBeGreaterThanOrEqual(1);
  });

  it('en run, les bonus de stat valent dès le départ', () => {
    const carrure = SKILL_LINES.find((l) => l.id === 'carrure')!;
    const force = SKILL_LINES.find((l) => l.id === 'force')!;
    let p = rich();
    p = buySkill(buySkill(p, 'carrure', 1)!, 'carrure', 2)!;
    p = buySkill(p, 'force', 3)!;
    const hp = skillBonuses(p).stats.filter((s) => s.stat === 'maxHp').reduce((a, s) => a + s.value, 0);
    const t = createTestGame();
    t.game.unlocks = runUnlocks(p);
    t.startRunAndLand();
    expect(hp).toBe(2 * ('stat' in carrure.tiers[0].effect ? carrure.tiers[0].effect.value : 0));
    expect(t.game.health.max).toBe(PLAYER_STATS.maxHp + hp);
    expect(t.game.health.hp).toBe(t.game.health.max);
    expect(t.game.stats.damage).toBeCloseTo(1 + ('stat' in force.tiers[0].effect ? force.tiers[0].effect.value : 0));
    // Et la run suivante repart des mêmes bonus, sans les cumuler
    t.game.abandon();
    t.startRunAndLand();
    expect(t.game.health.max).toBe(PLAYER_STATS.maxHp + hp);
  });
});
