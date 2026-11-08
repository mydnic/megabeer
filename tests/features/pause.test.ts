import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../src/config/xp';
import { createTestGame } from '../support/testGame';

describe('La pause', () => {
  it('fige le monde : chrono, zombies et Buveur', () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.play(0.5);
    expect(t.game.pause()).toBe(true);
    const time = t.game.runTime;
    const z = t.game.horde.zombies[0];
    const zPos = z.pos.clone(), pPos = t.game.player.pos.clone();
    t.play(2, { moveY: 1 });
    expect(t.game.runTime).toBe(time);
    // (à l'arrondi près : le recollage au sol peut bouger d'un milliardième de millimètre)
    expect(z.pos.distanceTo(zPos)).toBeLessThan(1e-6);
    expect(t.game.player.pos.distanceTo(pPos)).toBeLessThan(1e-6);
  });

  it('reprend là où on en était', () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.game.pause();
    t.game.resume();
    t.play(1);
    expect(t.game.runTime).toBeGreaterThan(0.9);
  });

  it("ne s'ouvre ni à l'accueil, ni pendant le choix des cartes, ni après la mort", () => {
    const t = createTestGame();
    expect(t.game.pause()).toBe(false);
    t.startRunAndLand();
    t.game.addXp(LEVELS.first);
    t.play(1 / 60);
    expect(t.game.offer).not.toBeNull();
    expect(t.game.pause()).toBe(false);
    t.game.pickCard(t.game.offer![0]);
    t.game.health.damage(1000);
    t.play(1 / 60);
    expect(t.game.phase).toBe('dead');
    expect(t.game.pause()).toBe(false);
  });
});
