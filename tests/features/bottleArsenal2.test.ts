import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BAC, BOUCHONS, VOMI } from '../../src/config/arsenal';
import { catalog } from '../../src/meta/shop';
import type { Zombie } from '../../src/enemies/zombie';
import type { WeaponId } from '../../src/weapons/weapon';
import { createTestGame } from '../support/testGame';

/** Hasard à graine fixe : mêmes cibles et mêmes tirs à chaque passage. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seeded(5)); });
afterEach(() => { vi.restoreAllMocks(); });

function arena(id: WeaponId) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  const w = t.game.loadout.add(id)!;
  w.mods.critChance = -1;
  return { t, w };
}
function dummy(t: ReturnType<typeof createTestGame>, dist: number, side = 0): Zombie {
  const z = t.game.spawnZombie('zombie', t.inFront(dist, side), t.game.player.facing.clone().negate())!;
  z.hp = 1e6;
  z.frozen = 1e6;
  return z;
}
const hitsOn = (t: ReturnType<typeof createTestGame>, w: object, z: Zombie) => t.events('zombieHit').filter((e) => e.weapon === w && e.zombie === z);

describe('Bouchons, pétanque, bac et vomi', () => {
  it('Bouchons : toute la rafale part d un coup, en éventail', () => {
    const { t, w } = arena('bouchons');
    dummy(t, 8);
    t.playUntil(() => w.projectiles.filter((p) => p.active).length >= BOUCHONS.count!, 3);
    const live = w.projectiles.filter((p) => p.active);
    expect(live.length).toBe(BOUCHONS.count);
    t.play(0.25);
    // Écartés : les deux bouchons des bords sont loin l'un de l'autre
    const xs = live.map((p) => p.pos);
    const spread = Math.max(...xs.map((a) => Math.max(...xs.map((b) => a.distanceTo(b)))));
    expect(spread).toBeGreaterThan(1);
  });

  it('Pétanque : la boule rebondit au sol au lieu de se casser', () => {
    const { t, w } = arena('petanque');
    w.mods.rate = 0.01;
    dummy(t, 9, 3);
    t.playUntil(() => w.projectiles.some((p) => p.active), 3);
    let lowest = Infinity;
    t.playUntil(() => {
      const b = w.projectiles.find((p) => p.active);
      if (b) lowest = Math.min(lowest, b.pos.length() - t.game.player.supportAt(b.pos, b.pos.length()));
      return !b;
    }, 4);
    // Elle a touché le sol (au moins une fois) et a duré : plus d'un rebond
    expect(lowest).toBeLessThan(0.3);
    expect(t.events('projectileHitGround').filter((e) => e.weapon === w).length).toBeLessThanOrEqual(1);
  });

  it('Bac de bière : il éclate en bouteilles qui touchent des zombies autour de l impact', () => {
    const { t, w } = arena('bac');
    w.mods.rate = 0.01;
    const center = dummy(t, 7);
    const around = [dummy(t, 9, 0), dummy(t, 7, 2), dummy(t, 7, -2)];
    t.play(3);
    // Le bac touche l'un d'eux, puis ses bouteilles en touchent d'autres
    const touched = [center, ...around].filter((z) => hitsOn(t, w, z).length > 0).length;
    expect(touched).toBeGreaterThanOrEqual(2);
    expect(BAC.fragments).toBeGreaterThan(4);
  });

  it('Vomi : la flaque empoisonne, et le poison fait de plus en plus mal', () => {
    const { t, w } = arena('vomi');
    w.mods.rate = 0.01;
    const z = dummy(t, 7);
    t.playUntil(() => (w.zones ?? []).some((zone) => zone.active), 4);
    t.play(VOMI.pool!.life - 0.5);
    const ticks = hitsOn(t, w, z).filter((e) => e.damage < VOMI.damage * 10).map((e) => e.damage);
    expect(ticks.length).toBeGreaterThan(3);
    expect(ticks[ticks.length - 1]).toBeGreaterThan(ticks[1]);
  });

  it('toutes se débloquent en boutique', () => {
    for (const id of ['bouchons', 'petanque', 'bac', 'vomi']) expect(catalog().some((e) => e.key === `weapon:${id}`)).toBe(true);
  });
});
