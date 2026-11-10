import { describe, expect, it } from 'vitest';
import { COINS } from '../../src/config/coins';
import { XP_DROPS } from '../../src/config/xp';
import { createTestGame } from '../support/testGame';

/** Une run au sol, sans zombies ni tirs. */
function arena(coins: 'never' | 'always' | 'real') {
  const t = createTestGame(1, { coins });
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

describe('Les Pièces (capsules dorées)', () => {
  it("un ennemi tué lâche parfois une capsule à la place de sa goutte d'XP", () => {
    const t = arena('always');
    kill(t);
    expect(t.game.coinDrops.drops).toHaveLength(1);
    expect(t.game.xp.drops).toHaveLength(0);
  });

  it("c'est l'un ou l'autre, jamais les deux, à peu près à la chance prévue", () => {
    const t = arena('real');
    const n = 600;
    for (let i = 0; i < n; i++) kill(t, 12 + (i % 10));
    const coins = t.game.coinDrops.drops.length, xp = t.game.xp.drops.length;
    expect(coins + xp).toBe(n);
    // Chance réelle : large marge pour ne pas dépendre du hasard
    expect(coins).toBeGreaterThan(n * COINS.dropChance * 0.4);
    expect(coins).toBeLessThan(n * COINS.dropChance * 2);
  });

  it('elles filent vers le Buveur à portée et remplissent sa poche', () => {
    const t = arena('never');
    expect(t.game.coins).toBe(0);
    t.game.coinDrops.drop(t.inFront(XP_DROPS.pickupRange * 0.5), COINS.value);
    t.play(1.5);
    expect(t.game.coinDrops.drops).toHaveLength(0);
    expect(t.game.coins).toBe(COINS.value);
    expect(t.events('coinsCollected').at(-1)?.total).toBe(COINS.value);
  });

  it('elles attendent au sol hors de portée', () => {
    const t = arena('never');
    t.game.coinDrops.drop(t.inFront(XP_DROPS.pickupRange * 3), COINS.value);
    t.play(1.5);
    expect(t.game.coinDrops.drops).toHaveLength(1);
    expect(t.game.coins).toBe(0);
  });

  it('la poche se vide à la fin de la run', () => {
    const t = arena('never');
    t.game.coinDrops.drop(t.inFront(1), COINS.value);
    t.play(1);
    expect(t.game.coins).toBeGreaterThan(0);
    t.game.abandon();
    expect(t.game.coins).toBe(0);
    expect(t.game.coinDrops.drops).toHaveLength(0);
  });
});
