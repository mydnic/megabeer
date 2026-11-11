import { describe, expect, it } from 'vitest';
import { ELITES } from '../../src/config/elites';
import { ENEMIES } from '../../src/config/enemies';
import { PLANET_RADIUS } from '../../src/config/world';
import { createTestGame } from '../support/testGame';

/** Une run au sol, calme : pas de zombies, Canette désarmée. */
function arena() {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  return t;
}

describe('Les élites', () => {
  it('à partir de leur heure, un élite arrive dans la horde à intervalles réguliers', () => {
    const t = arena();
    t.game.director.enabled = true;
    // Immortel : la horde arrive pour de bon et la Canette est désarmée
    t.game.cheats.god = true;
    t.game.runTime = ELITES.from - 1;
    t.play(2);
    expect(t.events('eliteSpawned')).toHaveLength(1);
    const z = t.events('eliteSpawned')[0].zombie;
    expect(z.elite).toBe(true);
    t.play(ELITES.every + 0.5);
    expect(t.events('eliteSpawned')).toHaveLength(2);
  });

  it('pas d\'élite avant leur heure', () => {
    const t = arena();
    t.game.director.enabled = true;
    t.play(5);
    expect(t.events('eliteSpawned')).toHaveLength(0);
  });

  it('un élite est un ennemi normal en deux fois plus grand, plus de PV', () => {
    const t = arena();
    const normal = t.game.spawnZombie('zombie', t.inFront(10), t.game.player.facing)!;
    const elite = t.game.spawnElite('zombie', t.inFront(10, 4), t.game.player.facing)!;
    expect(elite.elite).toBe(true);
    expect(elite.size).toBe(ELITES.sizeMul);
    expect(elite.hp).toBeCloseTo(normal.hp * ELITES.hpMul, 0);
    expect(normal.elite).toBe(false);
    expect(normal.size).toBe(1);
  });

  it('il frappe plus fort qu\'un ennemi normal', () => {
    const t = arena();
    t.game.spawnElite('zombie', t.inFront(1.5), t.game.player.facing.clone().negate());
    expect(t.playUntil(() => t.events('playerHurt').some((e) => !e.blocked), 5)).toBe(true);
    const hit = t.events('playerHurt').find((e) => !e.blocked)!;
    expect(hit.damage).toBeCloseTo(ENEMIES.zombie.damage * t.game.mods.damage * ELITES.damageMul);
  });

  it('tué, il laisse un coffre gratuit là où il est tombé ; un ennemi normal, non', () => {
    const t = arena();
    const chests = t.game.chests.list.length;
    const normal = t.game.spawnZombie('zombie', t.inFront(6), t.game.player.facing)!;
    t.game.hitZombie(normal, 9999, false, normal.pos, t.game.player.facing);
    expect(t.game.chests.list.length).toBe(chests);
    const elite = t.game.spawnElite('zombie', t.inFront(8), t.game.player.facing)!;
    const at = elite.pos.clone();
    t.game.hitZombie(elite, 9999, false, elite.pos, t.game.player.facing);
    expect(t.game.chests.list.length).toBe(chests + 1);
    const chest = t.game.chests.list.at(-1)!;
    expect(chest.free).toBe(true);
    expect(chest.trapped).toBeFalsy();
    expect(chest.pos.angleTo(at) * PLANET_RADIUS).toBeLessThan(4);
    expect(t.events('eliteKilled')).toHaveLength(1);
    expect(t.events('eliteKilled')[0].chest).toBe(chest);
  });
});
