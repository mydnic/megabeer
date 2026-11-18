import { afterEach, describe, expect, it, vi } from 'vitest';
import { DES_421 } from '../../src/config/arsenal';
import { catalog } from '../../src/meta/shop';
import type { Zombie } from '../../src/enemies/zombie';
import { createTestGame } from '../support/testGame';

afterEach(() => { vi.restoreAllMocks(); });

/** Hasard piloté : les valeurs de `queue` d'abord (les faces des dés), puis un hasard fixe. */
const queue: number[] = [];
function rig() {
  let s = 7;
  vi.spyOn(Math, 'random').mockImplementation(() => queue.length ? queue.shift()! : ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32));
}

function arena() {
  rig();
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  const w = t.game.loadout.add('des421')!;
  w.mods.critChance = -1;
  return { t, w };
}
function dummy(t: ReturnType<typeof createTestGame>, dist: number, side = 0): Zombie {
  const z = t.game.spawnZombie('zombie', t.inFront(dist, side), t.game.player.facing.clone().negate())!;
  z.hp = 1e6;
  z.frozen = 1e6;
  return z;
}

describe('Le 421', () => {
  it('lance tous ses dés à la fois (deux au départ)', () => {
    const { t, w } = arena();
    dummy(t, 7);
    t.playUntil(() => w.projectiles.filter((p) => p.active).length >= DES_421.count!, 3);
    expect(w.projectiles.filter((p) => p.active).length).toBe(DES_421.count);
  });

  it('chaque dé frappe selon sa face : un 6 fait six fois les dégâts d un 1', () => {
    const { t, w } = arena();
    const z = dummy(t, 6);
    queue.push(0.99, 0.99, 0.99); // trois 6
    t.playUntil(() => t.events('zombieHit').some((e) => e.weapon === w), 4);
    const six = t.events('zombieHit').find((e) => e.weapon === w)!.damage;
    expect(six).toBeCloseTo(DES_421.damage * 6 / 3.5);
    expect(z).toBeDefined();
  });

  it('4, 2 et 1 dans la même volée : jackpot, le 4 explose sur les zombies autour', () => {
    const { t, w } = arena();
    dummy(t, 6);
    const near = dummy(t, 6, 1.5);
    w.mods.projectiles = 1; // le troisième dé (carte « dé en plus »)
    queue.push(0.55, 0.2, 0.01); // faces 4, 2, 1
    t.play(3);
    expect(t.events('weaponExploded').filter((e) => e.weapon === w).length).toBe(1);
    const big = t.events('zombieHit').filter((e) => e.weapon === w && e.zombie === near && e.damage >= DES_421.damage * DES_421.dice!.jackpotDamage * 0.99);
    expect(big.length).toBe(1);
  });

  it('se débloque en boutique', () => {
    expect(catalog().some((e) => e.key === 'weapon:des421')).toBe(true);
  });
});
