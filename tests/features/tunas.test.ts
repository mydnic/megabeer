import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../../src/config/spawn';
import { TUNAS } from '../../src/config/tunas';
import { XP_DROPS } from '../../src/config/xp';
import { createTestGame } from '../support/testGame';

/** Une run au sol, sans zombies ni tirs. */
function arena(tunas: 'never' | 'always' | 'real' = 'never') {
  const t = createTestGame(1, { tunas });
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  return t;
}

/** Tue un zombie posé devant le Buveur. */
function kill(t: ReturnType<typeof arena>, dist = 12) {
  const z = t.game.spawnZombie('zombie', t.inFront(dist), t.game.player.facing.clone())!;
  t.game.hitZombie(z, z.hp + 1, false, z.pos, t.game.player.facing.clone());
}

describe('Les TUNAS (liasses de billets)', () => {
  it('un ennemi tué lâche parfois une liasse, en plus de son XP', () => {
    const t = arena('always');
    kill(t);
    expect(t.game.tunaDrops.drops).toHaveLength(1);
    expect(t.game.tunaDrops.drops[0].value).toBe(TUNAS.value);
    expect(t.game.xp.drops).toHaveLength(1);
  });

  it('à la vraie chance de la config, à peu près', () => {
    const t = arena('real');
    const n = 2000;
    for (let i = 0; i < n; i++) kill(t, 12 + (i % 10));
    const got = t.game.tunaDrops.drops.length;
    expect(got).toBeGreaterThan(n * TUNAS.dropChance * 0.4);
    expect(got).toBeLessThan(n * TUNAS.dropChance * 2);
  });

  it('un élite lâche toujours une grosse liasse', () => {
    const t = arena('never');
    const z = t.game.spawnElite('zombie', t.inFront(10), t.game.player.facing)!;
    t.game.hitZombie(z, z.hp + 1, false, z.pos, t.game.player.facing.clone());
    expect(t.game.tunaDrops.drops.map((d) => d.value)).toEqual([TUNAS.elite]);
  });

  it('un boss tué lâche sa liasse', () => {
    const t = arena('never');
    const boss = t.game.spawnBoss(t.inFront(12))!;
    t.game.hitZombie(boss.zombie, 1e6, false, boss.zombie.pos, t.game.player.facing.clone());
    expect(t.game.tunaDrops.drops.map((d) => d.value)).toContain(TUNAS.boss.sonneur);
  });

  it('ramassées, elles s ajoutent aux TUNAS de la run, multipliées par la difficulté', () => {
    const t = arena('never');
    t.game.difficulty = 'bourre';
    t.game.tunaDrops.drop(t.inFront(XP_DROPS.pickupRange * 0.5), 4);
    t.play(1.5);
    expect(t.game.tunaDrops.drops).toHaveLength(0);
    expect(t.game.tunas).toBeCloseTo(4 * DIFFICULTIES.bourre.tunas);
    expect(t.events('tunasCollected')).toHaveLength(1);
  });

  it('à la mort : les TUNAS ramassés, plus un bonus pour le temps tenu', () => {
    const t = arena('never');
    t.game.tunas = 7;
    t.game.runTime = 300;
    t.game.health.damage(t.game.health.max);
    t.play(1 / 60);
    expect(t.game.phase).toBe('dead');
    const end = t.events('runEnded').at(-1)!;
    const bonus = Math.floor((end.survived / 60) * TUNAS.endBonusPerMinute);
    expect(end.reason).toBe('mort');
    expect(end.tunasBonus).toBe(bonus);
    expect(end.tunas).toBe(7 + bonus);
  });

  it('à l abandon : il garde ce qu il a ramassé, sans le bonus de fin', () => {
    const t = arena('never');
    t.game.tunas = 12;
    t.game.runTime = 300;
    t.game.abandon();
    const end = t.events('runEnded').at(-1)!;
    expect(end.reason).toBe('abandon');
    expect(end.difficulty).toBe('sobre');
    expect(end.abbe).toBe(false);
    expect(end.tunas).toBe(12);
    expect(end.tunasBonus).toBe(0);
  });

  it('une nouvelle run repart de zéro', () => {
    const t = arena('always');
    kill(t);
    t.game.tunas = 5;
    t.game.abandon();
    expect(t.game.tunas).toBe(0);
    expect(t.game.tunaDrops.drops).toHaveLength(0);
  });
});
