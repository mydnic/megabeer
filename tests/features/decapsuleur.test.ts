import { describe, expect, it } from 'vitest';
import { DECAPSULEUR as D } from '../../src/config/arsenal';
import { catalog } from '../../src/meta/shop';
import type { Zombie } from '../../src/enemies/zombie';
import { createTestGame } from '../support/testGame';

function arena() {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  const w = t.game.loadout.add('decapsuleur')!;
  w.mods.critChance = -D.critChance;
  return { t, w };
}

function dummy(t: ReturnType<typeof createTestGame>, dist: number, side = 0): Zombie {
  const z = t.game.spawnZombie('zombie', t.inFront(dist, side), t.game.player.facing.clone().negate())!;
  z.hp = 1e6;
  z.frozen = 1e6;
  return z;
}

describe('Le Décapsuleur', () => {
  it('part vers un zombie, revient vers le joueur et se fait rattraper', () => {
    const { t, w } = arena();
    dummy(t, 5);
    expect(t.playUntil(() => w.projectiles.some((p) => p.active), D.firstDelay + 1)).toBe(true);
    let farthest = 0;
    const done = t.playUntil(() => {
      for (const p of w.projectiles) if (p.active) farthest = Math.max(farthest, p.pos.distanceTo(t.game.player.pos));
      return !w.projectiles.some((p) => p.active);
    }, D.life + 0.5);
    expect(done).toBe(true);
    expect(farthest).toBeGreaterThan(4);
  });

  it('frappe un zombie sur sa route à l aller et au retour', () => {
    const { t, w } = arena();
    const z = dummy(t, 4);
    const at = z.pos.clone();
    expect(t.playUntil(() => w.projectiles.some((p) => p.active), D.firstDelay + 1)).toBe(true);
    // Le zombie reste en place (recul annulé) le temps du vol
    for (let i = 0; i < D.life * 60 && w.projectiles.some((p) => p.active); i++) { z.pos.copy(at); z.knockVel.set(0, 0, 0); t.play(1 / 60); }
    const hits = t.events('zombieHit').filter((e) => e.weapon === w && e.zombie === z);
    expect(hits).toHaveLength(2);
    expect(hits[0].damage).toBeCloseTo(D.damage);
  });

  it('deux décapsuleurs partent en éventail', () => {
    const { t, w } = arena();
    w.mods.projectiles = 1;
    dummy(t, 6);
    t.playUntil(() => w.projectiles.filter((p) => p.active).length === 2, D.firstDelay + 1);
    t.play(0.3);
    const [a, b] = w.projectiles.filter((p) => p.active);
    expect(a.pos.distanceTo(b.pos)).toBeGreaterThan(1);
  });

  it('se débloque en boutique', () => {
    expect(catalog().some((e) => e.key === 'weapon:decapsuleur')).toBe(true);
  });
});
