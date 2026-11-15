import { describe, expect, it } from 'vitest';
import { FLAQUE_BIERE as F } from '../../src/config/arsenal';
import { catalog } from '../../src/meta/shop';
import { createTestGame } from '../support/testGame';

function arena() {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  const w = t.game.loadout.add('flaqueBiere')!;
  return { t, w };
}
const active = (w: { zones?: readonly { active: boolean }[] }) => (w.zones ?? []).filter((z) => z.active);

describe('La Flaque de bière', () => {
  it('en marchant, le joueur laisse une traînée de flaques ; immobile, il n en pose plus', () => {
    const { t, w } = arena();
    t.play(2, { moveY: 1 });
    const n = active(w).length;
    expect(n).toBeGreaterThan(2);
    t.play(F.life + 0.5);
    expect(active(w).length).toBeLessThanOrEqual(1);
  });

  it('un zombie qui marche dans une flaque glisse : étourdi et touché, mais pas deux fois de suite', () => {
    const { t, w } = arena();
    t.play(0.1);
    const z = t.game.spawnZombie('zombie', t.inFront(0.6), t.game.player.facing.clone().negate())!;
    z.hp = 1e6;
    t.play(0.2);
    expect(z.frozen).toBeGreaterThan(0);
    const hits = () => t.events('zombieHit').filter((e) => e.weapon === w && e.zombie === z).length;
    expect(hits()).toBe(1);
    t.play(F.stun + 0.2);
    expect(hits()).toBe(1);
  });

  it('les flaques disparaissent après leur durée', () => {
    const { t, w } = arena();
    t.play(0.1);
    expect(active(w).length).toBe(1);
    t.play(F.life + 0.2);
    expect(active(w).length).toBe(0);
  });

  it('se débloque en boutique', () => {
    expect(catalog().some((e) => e.key === 'weapon:flaqueBiere')).toBe(true);
  });
});
