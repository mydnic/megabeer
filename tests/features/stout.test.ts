import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../../src/config/weapons';
import { rollCards } from '../../src/game/levelUpCards';
import type { Zombie } from '../../src/enemies/zombie';
import { createTestGame } from '../support/testGame';

const S = WEAPONS.stout;
const B = WEAPONS.blonde;

/** Une run au sol sans zombies, la Stout équipée ; la Blonde désarmée sauf demande. */
function arena(keepBlonde = false) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  if (!keepBlonde) t.game.loadout.weapons[0].mods.range = 0;
  const stout = t.game.loadout.add('stout')!;
  stout.mods.critChance = -S.critChance; // aucun critique
  return { t, stout };
}

/** Un zombie qui ne meurt pas : on mesure les coups. */
function dummy(t: ReturnType<typeof createTestGame>, dist: number, side = 0) {
  const z = t.game.spawnZombie('zombie', t.inFront(dist, side), t.game.player.facing.clone().negate())!;
  z.hp = 1e6;
  return z;
}

describe('La Stout', () => {
  it("s'équipe à côté de la Blonde et lance toute seule une bouteille sur le zombie le plus proche", () => {
    const { t, stout } = arena();
    expect(t.game.loadout.weapons.map((w) => w.id)).toEqual(['blonde', 'stout']);
    t.game.spawnZombie('zombie', t.inFront(8), t.game.player.facing.clone().negate());
    expect(t.playUntil(() => t.events('zombieHit').length > 0, 3)).toBe(true);
    expect(t.events('zombieHit')[0].weapon).toBe(stout);
  });

  it('elle tire moins vite que la Blonde, mais frappe bien plus fort', () => {
    expect(S.cooldown).toBeGreaterThan(B.cooldown);
    expect(S.speed).toBeLessThan(B.speed);
    expect(S.damage).toBeGreaterThanOrEqual(B.damage * 1.5);
    const { t } = arena();
    t.game.horde.setPassive(true);
    dummy(t, 8);
    t.playUntil(() => t.events('zombieHit').length > 0, 3);
    expect(t.events('zombieHit')[0].damage).toBeCloseTo(S.damage);
  });

  it("un zombie touché recule bien plus loin qu'avec la Blonde", () => {
    const knockOf = (weapon: 'blonde' | 'stout') => {
      const { t } = arena(weapon === 'blonde');
      if (weapon === 'blonde') t.game.loadout.weapons[1].mods.range = 0;
      t.game.horde.setPassive(true);
      let knock = 0;
      t.game.events.on('zombieHit', ({ zombie }) => { knock ||= zombie.knockVel.length(); });
      dummy(t, 8);
      t.playUntil(() => knock > 0, 3);
      return knock;
    };
    expect(knockOf('stout')).toBeGreaterThan(knockOf('blonde') * 2);
  });

  it('elle traverse le premier zombie et écrase celui de derrière', () => {
    const { t, stout } = arena();
    t.game.horde.setPassive(true);
    dummy(t, 7);
    dummy(t, 7.8);
    t.playUntil(() => t.events('zombieHit').length > 0, 3);
    t.play(0.4); // bien avant le lancer suivant
    const victims = new Set<Zombie>(t.events('zombieHit').filter((h) => h.weapon === stout).map((h) => h.zombie));
    expect(victims.size).toBe(1 + S.pierce);
  });

  it('une fois équipée, ses améliorations sortent aux level-ups', () => {
    const { t } = arena(true);
    const cards = rollCards(50, 0, t.game.loadout.weapons);
    expect(cards.some((c) => c.weapon.id === 'stout')).toBe(true);
    expect(cards.some((c) => c.weapon.id === 'blonde')).toBe(true);
  });
});
