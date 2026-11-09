import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/config/enemies';
import { createTestGame } from '../support/testGame';

describe('Le Frère tonnelier', () => {
  it("arrive à 4:00 dans le roster de l'Abbaye", () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.game.loadout.weapons[0].mods.range = 0;
    t.game.cheats.god = true;
    t.game.runTime = 240 + 10; // après les cloches de 4:00
    t.play(40);
    expect(t.events('zombieSpawned').some((e) => e.zombie.enemy === 'tonnelier')).toBe(true);
  });

  it('il avance vers le joueur en poussant son tonneau, et frappe au contact', () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.noSpawns();
    t.game.loadout.weapons[0].mods.range = 0;
    const monk = t.game.spawnZombie('tonnelier', t.inFront(8), t.game.player.facing.clone().negate())!;
    const before = monk.pos.distanceTo(t.game.player.pos);
    t.play(1);
    expect(monk.pos.distanceTo(t.game.player.pos)).toBeLessThan(before - 1);
    expect(t.playUntil(() => t.events('playerHurt').some((h) => !h.blocked), 8)).toBe(true);
    expect(t.events('playerHurt').find((h) => !h.blocked)!.damage).toBe(ENEMIES.tonnelier.damage);
  });
});
