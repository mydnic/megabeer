import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FLECHETTES, IPA, KRIEK, SOUS_BOCK, TRIPLE } from '../../src/config/arsenal';
import { catalog } from '../../src/meta/shop';
import type { Zombie } from '../../src/enemies/zombie';
import type { WeaponId } from '../../src/weapons/weapon';
import { createTestGame } from '../support/testGame';

/** Une run au sol sans zombies avec la seule arme `id` (la Canette désarmée), sans critique. */
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
function dummy(t: ReturnType<typeof createTestGame>, dist: number, side = 0, hp = 1e6): Zombie {
  const z = t.game.spawnZombie('zombie', t.inFront(dist, side), t.game.player.facing.clone().negate())!;
  z.hp = hp;
  z.frozen = 1e6;
  return z;
}
const hitsOn = (t: ReturnType<typeof createTestGame>, w: object, z: Zombie) => t.events('zombieHit').filter((e) => e.weapon === w && e.zombie === z);

describe('Les armes à bouteilles du roster', () => {
  it('Kriek : l éclaboussure touche et ralentit un zombie voisin de la cible', () => {
    const { t, w } = arena('kriek');
    const a = dummy(t, 6);
    const b = dummy(t, 6, 1.2);
    t.playUntil(() => hitsOn(t, w, a).length + hitsOn(t, w, b).length >= 2, 5);
    expect(hitsOn(t, w, a).length + hitsOn(t, w, b).length).toBeGreaterThanOrEqual(2);
    expect(Math.min(a.slowMul, b.slowMul)).toBeCloseTo(1 - KRIEK.slow!);
  });

  it('Triple : une bouteille rebondit sur trois zombies de suite', () => {
    const { t, w } = arena('triple');
    w.mods.rate = 0.01; // une seule bouteille dans le test
    const zs = [dummy(t, 6), dummy(t, 9), dummy(t, 12)];
    t.play(4);
    for (const z of zs) expect(hitsOn(t, w, z).length).toBe(1);
    expect(TRIPLE.bounces).toBe(2);
  });

  it('IPA : le zombie touché brûle et reprend des coups après l impact', () => {
    const { t, w } = arena('ipa');
    w.mods.rate = 0.01;
    const z = dummy(t, 6);
    t.playUntil(() => hitsOn(t, w, z).length > 0, 5);
    const first = hitsOn(t, w, z).length;
    t.play(IPA.burnTime! - 0.5);
    expect(hitsOn(t, w, z).length).toBeGreaterThan(first + 2);
  });

  it('Dessous de verre : il file droit et traverse plusieurs zombies alignés', () => {
    const { t, w } = arena('sousBock');
    w.mods.rate = 0.01;
    const zs = [dummy(t, 4), dummy(t, 6), dummy(t, 8), dummy(t, 10)];
    t.play(3);
    const touched = zs.filter((z) => hitsOn(t, w, z).length > 0).length;
    expect(touched).toBeGreaterThanOrEqual(Math.min(zs.length, SOUS_BOCK.pierce + 1));
  });

  it('Fléchettes : elles visent le zombie le plus solide, pas le plus proche', () => {
    const { t, w } = arena('flechettes');
    const near = dummy(t, 5, 0, 50);
    const big = dummy(t, 12, 2, 5000);
    t.playUntil(() => t.events('zombieHit').some((e) => e.weapon === w), 5);
    expect(hitsOn(t, w, big).length).toBe(1);
    expect(hitsOn(t, w, near).length).toBe(0);
    expect(FLECHETTES.aim).toBe('strong');
  });

  it('toutes se débloquent en boutique', () => {
    for (const id of ['kriek', 'triple', 'ipa', 'sousBock', 'flechettes']) expect(catalog().some((e) => e.key === `weapon:${id}`)).toBe(true);
  });
});
