import { describe, expect, it } from 'vitest';
import { FUT } from '../../src/config/weapons';
import { PLANET_RADIUS } from '../../src/config/world';
import type { Zombie } from '../../src/enemies/zombie';
import { heightAt } from '../../src/world/terrain';
import { createTestGame } from '../support/testGame';

/** Une run au sol sans zombies, le Fût équipé et la Canette désarmée ; aucun critique. */
function arena() {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.horde.setPassive(true);
  t.game.loadout.weapons[0].mods.range = 0;
  const fut = t.game.equip('fut')!;
  fut.mods.critChance = -FUT.critChance;
  return { t, fut };
}

/** Un zombie immobile qui ne meurt pas, à `dist` m devant le joueur (passif, il viendrait contourner le mur). */
function dummy(t: ReturnType<typeof createTestGame>, dist: number, side = 0) {
  const z = t.game.spawnZombie('zombie', t.inFront(dist, side), t.game.player.facing.clone().negate())!;
  z.hp = 1e6;
  z.stagger = 1e6;
  return z;
}

describe('Le Fût qui roule', () => {
  it('fait rouler un fût vers le zombie le plus proche, qui le prend de plein fouet', () => {
    const { t, fut } = arena();
    dummy(t, 9);
    expect(t.playUntil(() => t.events('zombieHit').some((h) => h.weapon === fut), 4)).toBe(true);
    expect(t.events('zombieHit').find((h) => h.weapon === fut)!.damage).toBeCloseTo(FUT.damage);
  });

  it('il roule sur le sol', () => {
    const { t, fut } = arena();
    dummy(t, 14);
    t.playUntil(() => fut.projectiles.some((p) => p.active && p.age > 0.3), 4);
    const p = fut.projectiles.find((x) => x.active)!;
    const ground = PLANET_RADIUS + heightAt(p.pos.clone().normalize());
    expect(p.pos.length() - ground).toBeCloseTo(FUT.radius, 1);
  });

  it("il écrase tous les zombies sur sa ligne, une fois chacun, sans s'arrêter", () => {
    const { t, fut } = arena();
    const line = [dummy(t, 6), dummy(t, 9), dummy(t, 12)];
    t.playUntil(() => t.events('zombieHit').some((h) => h.weapon === fut), 4);
    t.play(FUT.life);
    const hits = t.events('zombieHit').filter((h) => h.weapon === fut);
    const victims = new Set<Zombie>(hits.map((h) => h.zombie));
    for (const z of line) expect(victims.has(z)).toBe(true);
    // Un seul fût lancé pendant ce temps (cadence > durée de vie) : un coup par zombie
    expect(hits).toHaveLength(line.length);
  });

  it('il éclate contre un mur : le zombie derrière est épargné', () => {
    const { t, fut } = arena();
    t.wall(5, 8);
    const z = dummy(t, 9);
    t.play(FUT.cooldown + FUT.life);
    expect(t.events('zombieHit').some((h) => h.zombie === z && h.weapon === fut)).toBe(false);
    expect(t.events('projectileHitGround').some((e) => e.weapon === fut)).toBe(true);
  });

  it('au bout de sa course, il éclate', () => {
    const { t, fut } = arena();
    dummy(t, FUT.range - 1, 6); // à portée, mais hors de la ligne d'un fût lancé droit devant
    t.playUntil(() => fut.projectiles.some((p) => p.active), 4);
    t.play(FUT.life + 0.1);
    expect(fut.projectiles.every((p) => !p.active)).toBe(true);
  });
});
