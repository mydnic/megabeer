import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ENEMIES, ROSTERS } from '../../src/config/enemies';
import { PLANET_RADIUS } from '../../src/config/world';
import { createTestGame } from '../support/testGame';

const FROM = ROSTERS.abbaye.find((e) => e.enemy === 'cellerier')!.from;
const D = ENEMIES.cellerier.splitter;

/** Une arène calme, Canette désarmée, et un Frère cellérier face au joueur à `dist` m. */
function duel(dist: number) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  t.game.cheats.god = true;
  const cellerier = t.game.spawnZombie('cellerier', t.inFront(dist), t.game.player.facing.clone().negate())!;
  return { t, cellerier };
}

/** Coup fatal porté par le joueur. */
function kill(t: ReturnType<typeof createTestGame>, z: { pos: THREE.Vector3; hp: number }) {
  return t.game.hitZombie(z as never, z.hp + 1, false, z.pos.clone(), t.game.player.facing.clone());
}

describe('Le Frère cellérier', () => {
  it("arrive à 9:00 dans le roster de l'Abbaye", () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.game.loadout.weapons[0].mods.range = 0;
    t.game.cheats.god = true;
    t.game.runTime = FROM + 10;
    t.play(40);
    expect(t.events('zombieSpawned').some((e) => e.zombie.enemy === 'cellerier')).toBe(true);
  });

  it("c'est un tank : le plus de PV du roster, plus lent qu'un zombie", () => {
    const others = ROSTERS.abbaye.filter((e) => e.enemy !== 'cellerier').map((e) => ENEMIES[e.enemy].hp);
    expect(ENEMIES.cellerier.hp).toBeGreaterThan(Math.max(...others));
    expect(ENEMIES.cellerier.speed).toBeLessThan(ENEMIES.zombie.speed);
  });

  it('tué, il se divise en 3 moinillons autour de son corps', () => {
    const { t, cellerier } = duel(8);
    expect(kill(t, cellerier)).toBe(true);
    const split = t.events('enemySplit');
    expect(split).toHaveLength(1);
    expect(split[0].zombie).toBe(cellerier);
    expect(split[0].children).toHaveLength(D.count);
    for (const c of split[0].children) {
      expect(c.enemy).toBe(D.enemy);
      expect(c.dead).toBe(false);
      expect(c.pos.angleTo(cellerier.pos) * PLANET_RADIUS).toBeLessThan(D.radius * 1.5);
    }
  });

  it('les moinillons sont petits et fragiles, et ne se divisent pas à leur tour', () => {
    expect(ENEMIES[D.enemy].hp).toBeLessThan(ENEMIES.zombie.hp);
    const { t, cellerier } = duel(8);
    kill(t, cellerier);
    const [child] = t.events('enemySplit')[0].children;
    expect(kill(t, child)).toBe(true);
    expect(t.events('enemySplit')).toHaveLength(1);
  });

  it('les moinillons foncent sur le joueur et le frappent', () => {
    const { t, cellerier } = duel(8);
    t.game.cheats.god = false;
    kill(t, cellerier);
    expect(t.playUntil(() => t.events('playerHurt').some((h) => h.zombie?.enemy === D.enemy && !h.blocked), 10)).toBe(true);
  });
});
