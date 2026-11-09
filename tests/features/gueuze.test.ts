import { describe, expect, it } from 'vitest';
import { GUEUZE as G } from '../../src/config/weapons';
import { createTestGame } from '../support/testGame';

/** Une run au sol sans zombies, la Gueuze équipée et la Canette désarmée ; aucun critique. */
function arena() {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.horde.setPassive(true);
  t.game.loadout.weapons[0].mods.range = 0;
  const gueuze = t.game.equip('gueuze')!;
  gueuze.mods.critChance = -G.critChance;
  return { t, gueuze };
}

/** Un zombie immobile qui ne meurt pas, à `dist` m devant le joueur (décalé de `side` m). */
function dummy(t: ReturnType<typeof createTestGame>, dist: number, side = 0) {
  const z = t.game.spawnZombie('zombie', t.inFront(dist, side), t.game.player.facing.clone().negate())!;
  z.hp = 1e6;
  z.stagger = 1e6; // ne bouge pas : on mesure où tombe l'explosion
  return z;
}

describe('La Gueuze', () => {
  it('est lancée sur le plus gros groupe, pas sur le zombie le plus proche', () => {
    const { t, gueuze } = arena();
    const alone = dummy(t, 5, -4);
    const group = [dummy(t, 11, 0), dummy(t, 11.8, 0.6), dummy(t, 11.4, -0.8), dummy(t, 12.2, -0.2)];
    expect(t.playUntil(() => t.events('weaponExploded').some((e) => e.weapon === gueuze), 6)).toBe(true);
    const victims = new Set(t.events('zombieHit').filter((h) => h.weapon === gueuze).map((h) => h.zombie));
    for (const z of group) expect(victims.has(z)).toBe(true);
    expect(victims.has(alone)).toBe(false);
  });

  it("n'explose qu'après son retard, une fois posée au sol", () => {
    const { t, gueuze } = arena();
    dummy(t, 9);
    // Posée : elle ne vole plus (vitesse nulle)
    expect(t.playUntil(() => gueuze.projectiles.some((p) => p.active && p.vel.lengthSq() === 0), 6)).toBe(true);
    const landedAt = t.game.runTime;
    expect(t.events('zombieHit')).toHaveLength(0);
    t.playUntil(() => t.events('weaponExploded').length > 0, 3);
    expect(t.game.runTime - landedAt).toBeGreaterThan(G.fuse - 0.05);
    expect(t.game.runTime - landedAt).toBeLessThan(G.fuse + 0.1);
  });

  it("fait ses dégâts à tous les zombies dans le rayon, et à aucun au-delà", () => {
    const { t, gueuze } = arena();
    const center = dummy(t, 10);
    const inside = dummy(t, 10, G.radius * 0.7);
    const outside = dummy(t, 10, G.radius * 2 + 1); // trop loin pour former un groupe avec les autres
    t.playUntil(() => t.events('weaponExploded').length > 0, 6);
    const ex = t.events('weaponExploded')[0];
    expect(ex.radius).toBeCloseTo(G.radius);
    const hits = t.events('zombieHit').filter((h) => h.weapon === gueuze);
    const victims = new Set(hits.map((h) => h.zombie));
    expect(victims.has(center)).toBe(true);
    expect(victims.has(inside)).toBe(true);
    expect(victims.has(outside)).toBe(false);
    for (const h of hits) expect(h.damage).toBeCloseTo(G.damage);
  });

  it('ne blesse pas le Buveur, même tout près', () => {
    const { t } = arena();
    dummy(t, 2.5);
    t.playUntil(() => t.events('weaponExploded').length > 0, 6);
    expect(t.events('playerHurt')).toHaveLength(0);
  });
});
