import { describe, expect, it } from 'vitest';
import { TARGETING, WEAPONS } from '../../src/config/weapons';
import type { Zombie } from '../../src/enemies/zombie';
import { pickTarget } from '../../src/weapons/targeting';
import { createTestGame } from '../support/testGame';

const C = WEAPONS.canette;

/** Une run au sol, zombies figés, la Canette seule qui tire vite (beaucoup de canettes en l'air). */
function arena(rate: number) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.horde.setPassive(true);
  const canette = t.game.loadout.weapons[0];
  canette.mods.rate = rate;
  canette.mods.critChance = -C.critChance;
  return { t, canette };
}

function dummy(t: ReturnType<typeof createTestGame>, dist: number, side: number, hp: number) {
  const z = t.game.spawnZombie('zombie', t.inFront(dist, side), t.game.player.facing.clone().negate())!;
  z.hp = hp;
  z.stagger = 1e6;
  return z;
}

describe('La visée des armes', () => {
  it("ne gaspille pas de canette sur un zombie qui a déjà assez de dégâts en route pour mourir", () => {
    for (let run = 0; run < 10; run++) {
      const { t, canette } = arena(8);
      // Une canette suffit à tuer chacun : la deuxième part sur l'autre, aucune ne finit dans le vide
      const a = dummy(t, 8, -1, C.damage / 2), b = dummy(t, 8.5, 1, C.damage / 2);
      t.playUntil(() => a.dead && b.dead, 3);
      expect(a.dead && b.dead).toBe(true);
      expect(t.events('projectileHitGround').filter((e) => e.weapon === canette)).toHaveLength(0);
    }
  });

  it("ne tire toujours pas quand aucun zombie n'est à portée", () => {
    const { t, canette } = arena(6);
    dummy(t, C.range + 10, 0, 1e6);
    t.play(1);
    expect(canette.projectiles.filter((p) => p.active)).toHaveLength(0);
  });
});

describe('Le choix de cible', () => {
  /** Des zombies de test : distance, PV, dégâts déjà en route. */
  const fake = (d: number, hp = 10, incoming = 0) =>
    ({ targetable: true, hp, incoming, pos: { distanceTo: () => d } }) as unknown as Zombie;
  const from = {} as never;

  it('répartit les tirs entre les plus proches au lieu de toujours prendre le même', () => {
    const zs = [fake(5), fake(6), fake(7), fake(8), fake(9)];
    const picked = new Set<Zombie>();
    for (let i = 0; i < 200; i++) picked.add(pickTarget(zs, from, 20, TARGETING.spread)!);
    expect(picked.size).toBe(Math.min(TARGETING.spread, zs.length));
    expect(picked.has(zs[0])).toBe(true);
  });

  it('écarte les zombies déjà condamnés, sauf s\'il ne reste qu\'eux', () => {
    const doomed = fake(4, 10, 12), alive = fake(9);
    for (let i = 0; i < 100; i++) expect(pickTarget([doomed, alive], from, 20, TARGETING.spread)).toBe(alive);
    expect(pickTarget([doomed], from, 20, TARGETING.spread)).toBe(doomed);
  });

  it('respecte la portée et les zombies déjà visés par la volée', () => {
    const a = fake(5), b = fake(30);
    expect(pickTarget([a, b], from, 20, TARGETING.spread, new Set([a]))).toBeNull();
  });
});
