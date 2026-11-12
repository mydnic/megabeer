import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../../src/config/weapons';
import { rollCards } from '../../src/game/levelUpCards';
import type { Zombie } from '../../src/enemies/zombie';
import { createTestGame } from '../support/testGame';

const S = WEAPONS.stout;
const B = WEAPONS.canette;

/** Une run au sol sans zombies, la Stout équipée ; la Canette désarmée sauf demande. */
function arena(keepCanette = false) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  if (!keepCanette) t.game.loadout.weapons[0].mods.range = 0;
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
  it("s'équipe à côté de la Canette et lance toute seule une bouteille sur le zombie le plus proche", () => {
    const { t, stout } = arena();
    expect(t.game.loadout.weapons.map((w) => w.id)).toEqual(['canette', 'stout']);
    t.game.spawnZombie('zombie', t.inFront(8), t.game.player.facing.clone().negate());
    expect(t.playUntil(() => t.events('zombieHit').length > 0, 3)).toBe(true);
    expect(t.events('zombieHit')[0].weapon).toBe(stout);
  });

  it('elle tire moins vite que la Canette, mais frappe bien plus fort', () => {
    expect(S.cooldown).toBeGreaterThan(B.cooldown);
    expect(S.speed).toBeLessThan(B.speed);
    expect(S.damage).toBeGreaterThanOrEqual(B.damage * 1.5);
    const { t } = arena();
    t.game.horde.setPassive(true);
    dummy(t, 8);
    t.playUntil(() => t.events('zombieHit').length > 0, 3);
    expect(t.events('zombieHit')[0].damage).toBeCloseTo(S.damage);
  });

  it("un zombie touché recule bien plus loin qu'avec la Canette", () => {
    const knockOf = (weapon: 'canette' | 'stout') => {
      const { t } = arena(weapon === 'canette');
      if (weapon === 'canette') t.game.loadout.weapons[1].mods.range = 0;
      t.game.horde.setPassive(true);
      let knock = 0;
      t.game.events.on('zombieHit', ({ zombie }) => { knock ||= zombie.knockVel.length(); });
      dummy(t, 8);
      t.playUntil(() => knock > 0, 3);
      return knock;
    };
    expect(knockOf('stout')).toBeGreaterThan(knockOf('canette') * 2);
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
    const cards = rollCards(3, 0, t.game.loadout.weapons, []);
    expect(cards.some((c) => c.kind === 'upgrade' && c.weapon.id === 'stout')).toBe(true);
    expect(cards.some((c) => c.kind === 'upgrade' && c.weapon.id === 'canette')).toBe(true);
  });

  it('elle gagne des projectiles en plus : la carte existe, et une volée lance alors deux bouteilles', () => {
    const { t, stout } = arena();
    expect(stout.upgrades.some((u) => u.id === 'projectiles')).toBe(true);
    stout.mods.projectiles = 1;
    t.game.spawnZombie('zombie', t.inFront(8), t.game.player.facing.clone().negate())!.hp = 1e6;
    // Les bouteilles d'une volée partent à la suite : deux en l'air, mais jamais trois
    expect(t.playUntil(() => stout.projectiles.filter((b) => b.active).length === 2, 3)).toBe(true);
    expect(stout.projectiles.filter((b) => b.active).length).toBeLessThanOrEqual(2);
  });
});
