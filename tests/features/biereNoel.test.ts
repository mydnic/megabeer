import { describe, expect, it } from 'vitest';
import { BIERE_NOEL as B } from '../../src/config/arsenal';
import { emptyProfile } from '../../src/meta/profile';
import { buy, catalog, owned } from '../../src/meta/shop';
import type { Zombie } from '../../src/enemies/zombie';
import { createTestGame } from '../support/testGame';

/** Une run au sol sans zombies, la Bière de Noël équipée ; la Canette désarmée. */
function arena() {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  const noel = t.game.loadout.add('biereNoel')!;
  noel.mods.critChance = -B.critChance;
  return { t, noel };
}

function dummy(t: ReturnType<typeof createTestGame>, dist: number, side = 0): Zombie {
  const z = t.game.spawnZombie('zombie', t.inFront(dist, side), t.game.player.facing.clone().negate())!;
  z.hp = 1e6;
  z.frozen = 1e6;
  return z;
}

describe('La Bière de Noël', () => {
  it('des bouteilles tournent autour du joueur, à la distance de l orbite', () => {
    const { t, noel } = arena();
    t.play(0.5);
    const active = noel.projectiles.filter((p) => p.active);
    expect(active).toHaveLength(B.count);
    for (const p of active) {
      const flat = p.pos.clone().sub(t.game.player.pos);
      flat.addScaledVector(t.game.player.pos.clone().normalize(), -flat.dot(t.game.player.pos.clone().normalize()));
      expect(flat.length()).toBeCloseTo(B.radius, 1);
    }
  });

  it('frappe un zombie sur l orbite, plusieurs fois sur la durée, jamais plus vite que son délai', () => {
    const { t, noel } = arena();
    const z = dummy(t, B.radius);
    // Recul annulé : le zombie reste sur l'orbite
    const at = z.pos.clone();
    for (let i = 0; i < 240; i++) { z.pos.copy(at); z.knockVel.set(0, 0, 0); t.play(1 / 60); }
    const hits = t.events('zombieHit').filter((e) => e.weapon === noel && e.zombie === z);
    expect(hits.length).toBeGreaterThan(2);
    expect(hits[0].damage).toBeCloseTo(B.damage);
    // Au plus (temps / délai) coups par bouteille
    expect(hits.length).toBeLessThanOrEqual(Math.ceil(4 / B.rehit) * B.count);
  });

  it('ne touche pas un zombie hors de l orbite', () => {
    const { t, noel } = arena();
    const far = dummy(t, B.radius + 3);
    t.play(4);
    expect(t.events('zombieHit').filter((e) => e.weapon === noel && e.zombie === far)).toHaveLength(0);
  });

  it('la carte « bouteille en plus » ajoute une bouteille', () => {
    const { t, noel } = arena();
    noel.mods.projectiles = 1;
    t.play(0.2);
    expect(noel.projectiles.filter((p) => p.active)).toHaveLength(B.count + 1);
  });

  it('se débloque en boutique', () => {
    const entry = catalog().find((e) => e.key === 'weapon:biereNoel')!;
    expect(entry).toBeDefined();
    const p = buy({ ...emptyProfile(), tunas: entry.price }, entry.key, 0)!;
    expect(owned(p, entry.key)).toBe(true);
  });
});
