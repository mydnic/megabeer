import { describe, expect, it } from 'vitest';
import { ENEMIES, ROSTERS } from '../../src/config/enemies';
import { createTestGame } from '../support/testGame';

/** Une run au sol, Blonde désarmée et godmode : on observe qui arrive. */
function observe() {
  const t = createTestGame();
  t.startRunAndLand();
  t.game.loadout.weapons[0].mods.range = 0;
  t.game.cheats.god = true;
  return t;
}

/** Types des zombies apparus pendant `seconds` s. */
function arrivals(t: ReturnType<typeof createTestGame>, seconds: number) {
  const before = t.events('zombieSpawned').length;
  t.play(seconds);
  return t.events('zombieSpawned').slice(before).map((e) => e.zombie.enemy);
}

const NOVICE_FROM = ROSTERS.abbaye.find((e) => e.enemy === 'novice')!.from;

describe("Le roster de l'Abbaye", () => {
  it("la première minute, il n'arrive que des Zombies", () => {
    const t = observe();
    const types = arrivals(t, 30);
    expect(types.length).toBeGreaterThan(10);
    expect(new Set(types)).toEqual(new Set(['zombie']));
  });

  it("à partir de 1:00 les Novices arrivent aussi, et les Zombies restent", () => {
    const t = observe();
    t.game.runTime = NOVICE_FROM;
    const types = arrivals(t, 30);
    expect(types).toContain('novice');
    expect(types).toContain('zombie');
  });

  it("le débarquement des cloches est fait d'un type déjà arrivé dans la run", () => {
    const t = observe();
    t.game.runTime = 10;
    t.game.mechanic.trigger();
    t.playUntil(() => t.events('bellsLanding').length > 0, 2);
    expect(t.events('bellsLanding')[0].enemy).toBe('zombie');
  });
});

describe('Chaque ennemi a sa fiche', () => {
  function arena() {
    const t = observe();
    t.noSpawns();
    return t;
  }

  it('le Novice court plus vite que le Zombie : il rattrape le joueur', () => {
    const t = arena();
    const zombie = t.game.spawnZombie('zombie', t.inFront(20, -2), t.game.player.facing.clone().negate())!;
    const novice = t.game.spawnZombie('novice', t.inFront(20, 2), t.game.player.facing.clone().negate())!;
    t.play(2.5);
    const p = t.game.player.pos;
    expect(novice.pos.distanceTo(p)).toBeLessThan(zombie.pos.distanceTo(p) - 3);
    expect(ENEMIES.novice.speed).toBeGreaterThan(ENEMIES.zombie.speed);
  });

  it('le Novice est fragile, et chaque ennemi lâche sa propre quantité de bière', () => {
    const t = arena();
    const novice = t.game.spawnZombie('novice', t.inFront(10), t.game.player.facing.clone())!;
    const zombie = t.game.spawnZombie('zombie', t.inFront(12), t.game.player.facing.clone())!;
    expect(novice.hp).toBe(ENEMIES.novice.hp);
    expect(novice.hp).toBeLessThan(zombie.hp);
    t.game.hitZombie(novice, ENEMIES.novice.hp, false, novice.pos, t.game.player.facing.clone());
    t.game.hitZombie(zombie, ENEMIES.zombie.hp, false, zombie.pos, t.game.player.facing.clone());
    expect(novice.dead && zombie.dead).toBe(true);
    expect(t.game.xp.drops.map((d) => d.value).sort()).toEqual([ENEMIES.novice.xp, ENEMIES.zombie.xp].sort());
  });

  it('chaque ennemi frappe avec ses propres dégâts', () => {
    const t = arena();
    t.game.cheats.god = false;
    t.game.spawnZombie('novice', t.inFront(1.2), t.game.player.facing.clone().negate());
    expect(t.playUntil(() => t.events('playerHurt').some((h) => !h.blocked), 4)).toBe(true);
    expect(t.events('playerHurt').find((h) => !h.blocked)!.damage).toBe(ENEMIES.novice.damage);
  });
});
