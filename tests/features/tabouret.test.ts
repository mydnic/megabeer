import { describe, expect, it } from 'vitest';
import { TABOURET as T } from '../../src/config/weapons';
import { PLANET_RADIUS } from '../../src/config/world';
import { emptyProfile } from '../../src/meta/profile';
import { buy, catalog, owned } from '../../src/meta/shop';
import type { Zombie } from '../../src/enemies/zombie';
import { createTestGame } from '../support/testGame';

/** Une run au sol sans zombies, le Tabouret équipé ; la Canette désarmée. */
function arena() {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  const stool = t.game.loadout.add('tabouret')!;
  stool.mods.critChance = -T.critChance; // aucun critique
  return { t, stool };
}

/** Un zombie qui ne meurt pas, à `dist` m devant (et `side` m sur le côté). */
function dummy(t: ReturnType<typeof createTestGame>, dist: number, side = 0): Zombie {
  const z = t.game.spawnZombie('zombie', t.inFront(dist, side), t.game.player.facing.clone().negate())!;
  z.hp = 1e6;
  z.frozen = 1e6; // immobile (gelé), le recul reste mesurable
  return z;
}
const flat = (t: ReturnType<typeof createTestGame>, z: Zombie) => z.pos.angleTo(t.game.player.pos) * PLANET_RADIUS;

describe('Le Tabouret de bar', () => {
  it('ne frappe pas dans le vide : sans zombie à portée, pas de tour', () => {
    const { t, stool } = arena();
    dummy(t, T.radius + 6);
    t.play(T.firstDelay + 2);
    expect(t.events('zombieHit').filter((e) => e.weapon === stool)).toHaveLength(0);
    expect(stool.projectiles.some((p) => p.active)).toBe(false);
  });

  it('un zombie à portée, devant ou derrière : le tour le frappe une fois, et le repousse', () => {
    const { t, stool } = arena();
    const front = dummy(t, T.radius * 0.8);
    const back = dummy(t, -T.radius * 0.8);
    const before = flat(t, front);
    expect(t.playUntil(() => stool.projectiles.some((p) => p.active), T.firstDelay + 1)).toBe(true);
    t.play(T.swingTime + 0.05);
    const hits = t.events('zombieHit').filter((e) => e.weapon === stool);
    expect(hits.filter((e) => e.zombie === front)).toHaveLength(1);
    expect(hits.filter((e) => e.zombie === back)).toHaveLength(1);
    expect(hits[0].damage).toBeCloseTo(T.damage);
    t.play(0.3);
    expect(flat(t, front)).toBeGreaterThan(before + 0.5);
  });

  it('hors de portée du coup, un zombie n est pas touché', () => {
    const { t, stool } = arena();
    dummy(t, T.radius * 0.8);
    const far = dummy(t, 0, T.radius + T.zombieRadius + 2);
    t.playUntil(() => stool.projectiles.some((p) => p.active), T.firstDelay + 1);
    t.play(T.swingTime + 0.05);
    expect(t.events('zombieHit').filter((e) => e.weapon === stool && e.zombie === far)).toHaveLength(0);
  });

  it('un tabouret en plus : deux tabourets sur le cercle, deux coups par tour', () => {
    const { t, stool } = arena();
    stool.mods.projectiles = 1;
    stool.mods.knock = 0; // sans recul, le zombie reste à portée des deux tabourets
    const z = dummy(t, T.radius * 0.8);
    t.playUntil(() => stool.projectiles.some((p) => p.active), T.firstDelay + 1);
    expect(stool.projectiles.filter((p) => p.active)).toHaveLength(2);
    t.play(T.swingTime + 0.05);
    expect(t.events('zombieHit').filter((e) => e.weapon === stool && e.zombie === z)).toHaveLength(2);
  });

  it('les tours reviennent au rythme de sa cadence', () => {
    const { t, stool } = arena();
    stool.mods.knock = 0;
    dummy(t, T.radius * 0.8);
    t.play(T.firstDelay + T.swingTime + T.cooldown * 2 + 0.1);
    const n = t.events('zombieHit').filter((e) => e.weapon === stool).length;
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(3);
  });

  it('ses améliorations sortent aux level-ups, et la portée se lit avant/après', () => {
    const { stool } = arena();
    expect(stool.upgrades.map((u) => u.id)).toEqual(expect.arrayContaining(['damage', 'rate', 'size', 'knock', 'projectiles']));
    expect(stool.stats().find((l) => l.label === 'Portée du coup')!.value).toBeCloseTo(T.radius);
  });

  it('il se débloque en boutique (ce n est pas une arme de départ)', () => {
    const key = 'weapon:tabouret';
    expect(catalog().some((e) => e.key === key)).toBe(true);
    expect(owned(emptyProfile(), key)).toBe(false);
    const p = buy({ ...emptyProfile(), tunas: 10_000 }, key, 1)!;
    expect(owned(p, key)).toBe(true);
  });
});
