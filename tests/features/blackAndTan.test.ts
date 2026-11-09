import { describe, expect, it } from 'vitest';
import { SYNERGIES, WEAPONS } from '../../src/config/weapons';
import { createTestGame } from '../support/testGame';

const BT = SYNERGIES.blackAndTan;
const C = WEAPONS.canette;

/** Une run au sol sans zombies, sans coups critiques ; la Stout équipée si demandé. */
function arena(withStout: boolean) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.horde.setPassive(true);
  const canette = t.game.loadout.weapons[0];
  canette.mods.critChance = -C.critChance;
  const stout = withStout ? t.game.loadout.add('stout')! : null;
  if (stout) stout.mods.critChance = -WEAPONS.stout.critChance;
  return { t, canette, stout };
}

/** Un zombie qui ne meurt pas, à `dist` m devant le joueur. */
function dummy(t: ReturnType<typeof createTestGame>, dist: number) {
  const z = t.game.spawnZombie('zombie', t.inFront(dist), t.game.player.facing.clone().negate())!;
  z.hp = 1e6;
  return z;
}

describe('La synergie Black and Tan (Canette + Stout)', () => {
  it('un zombie touché par une Stout est sonné un moment', () => {
    const { t, canette, stout } = arena(true);
    canette.mods.range = 0;
    const z = dummy(t, 8);
    t.playUntil(() => t.events('zombieHit').some((h) => h.weapon === stout), 3);
    expect(z.dazed).toBeGreaterThan(BT.duration - 0.1);
  });

  it('pendant ce temps, les canettes lui font des dégâts multipliés', () => {
    const { t, canette, stout } = arena(true);
    const z = dummy(t, 8);
    // La Stout d'abord (la Canette attend), puis la Canette sur le zombie sonné
    canette.mods.range = 0;
    t.playUntil(() => t.events('zombieHit').some((h) => h.weapon === stout), 3);
    stout!.mods.range = 0;
    canette.mods.range = 1;
    t.playUntil(() => t.events('zombieHit').some((h) => h.weapon === canette), 3);
    const hit = t.events('zombieHit').find((h) => h.weapon === canette)!;
    expect(z.dazed).toBeGreaterThan(0);
    expect(hit.damage).toBeCloseTo(C.damage * BT.mult);
    expect(hit.combo).toBe(true);
  });

  it("une fois l'effet passé, les canettes refont leurs dégâts normaux", () => {
    const { t, canette, stout } = arena(true);
    const z = dummy(t, 8);
    canette.mods.range = 0;
    t.playUntil(() => t.events('zombieHit').some((h) => h.weapon === stout), 3);
    stout!.mods.range = 0;
    t.play(BT.duration + 0.2);
    expect(z.dazed).toBe(0);
    canette.mods.range = 1;
    t.playUntil(() => t.events('zombieHit').some((h) => h.weapon === canette), 3);
    expect(t.events('zombieHit').find((h) => h.weapon === canette)!.damage).toBeCloseTo(C.damage);
  });

  it("la Stout elle-même ne profite pas du bonus", () => {
    const { t, canette, stout } = arena(true);
    canette.mods.range = 0;
    dummy(t, 8);
    t.playUntil(() => t.events('zombieHit').filter((h) => h.weapon === stout).length >= 2, 5);
    for (const h of t.events('zombieHit').filter((h) => h.weapon === stout)) expect(h.damage).toBeCloseTo(WEAPONS.stout.damage);
  });

  it('sans la Stout, la Canette ne sonne personne et fait ses dégâts normaux', () => {
    const { t } = arena(false);
    const z = dummy(t, 8);
    t.playUntil(() => t.events('zombieHit').length >= 2, 4);
    expect(z.dazed).toBe(0);
    for (const h of t.events('zombieHit')) expect(h.damage).toBeCloseTo(C.damage);
  });
});
