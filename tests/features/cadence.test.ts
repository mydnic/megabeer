import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../../src/config/weapons';
import { createTestGame } from '../support/testGame';

/** Une run au sol, sans arrivée de zombies, avec seulement l'arme `id` (sans amélioration). */
function only(id: 'canette' | 'stout') {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  if (id !== 'canette') { t.game.loadout.weapons[0].mods.range = 0; t.game.loadout.add(id); }
  const w = t.game.loadout.weapons.find((x) => x.id === id)!;
  // Deux zombies increvables à portée, de part et d'autre
  for (const side of [-1.5, 1.5]) {
    const z = t.game.spawnZombie('zombie', t.inFront(8, side), t.game.player.facing.clone().negate())!;
    z.hp = 1e6;
    z.frozen = 1e6;
  }
  return { t, w };
}

/** Instants (s) où une nouvelle bouteille de l'arme part. */
function launches(t: ReturnType<typeof createTestGame>, w: { projectiles: { active: boolean; age: number }[] }, seconds: number) {
  const times: number[] = [];
  let now = 0;
  const seen = new Set<object>();
  for (let i = 0; i < seconds * 60; i++) {
    t.play(1 / 60);
    now += 1 / 60;
    for (const p of w.projectiles) {
      if (p.active && p.age <= 1 / 60 + 1e-6 && !seen.has(p)) { times.push(now); seen.add(p); }
      if (!p.active) seen.delete(p);
    }
  }
  return times;
}

describe('Cadence des armes de départ', () => {
  for (const id of ['canette', 'stout'] as const) {
    it(`${id} sans amélioration : une bouteille par lancer, une toutes les ${WEAPONS[id].cooldown} s, même avec deux zombies à portée`, () => {
      const { t, w } = only(id);
      t.play(1);
      const times = launches(t, w, 10);
      const gaps = times.slice(1).map((x, i) => x - times[i]);
      expect(times.length).toBeGreaterThanOrEqual(Math.floor(10 / WEAPONS[id].cooldown) - 1);
      for (const g of gaps) expect(g).toBeGreaterThan(WEAPONS[id].cooldown * 0.9);
    });
  }
});
