import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/config/enemies';
import { PLANET_RADIUS } from '../../src/config/world';
import { heightAt } from '../../src/world/terrain';
import { createTestGame } from '../support/testGame';

const J = ENEMIES.gargouille.leaper;

/** Une arène calme, Blonde désarmée, et une Gargouille face au joueur à `dist` m. */
function duel(dist: number) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  const gargoyle = t.game.spawnZombie('gargouille', t.inFront(dist), t.game.player.facing.clone().negate())!;
  return { t, gargoyle };
}

/** Hauteur (m) d'un point au-dessus du relief. */
const altitude = (p: THREE.Vector3) => p.length() - PLANET_RADIUS - heightAt(p.clone().normalize());

describe('La Gargouille', () => {
  it("arrive à 7:00 dans le roster de l'Abbaye", () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.game.loadout.weapons[0].mods.range = 0;
    t.game.cheats.god = true;
    t.game.runTime = 420 + 10;
    t.play(40);
    expect(t.events('zombieSpawned').some((e) => e.zombie.enemy === 'gargouille')).toBe(true);
  });

  it("à portée, elle se ramasse et marque au sol l'endroit où se trouve le joueur", () => {
    const { t, gargoyle } = duel(J.range + 6);
    expect(t.playUntil(() => t.events('leapAimed').length > 0, 8)).toBe(true);
    const aim = t.events('leapAimed')[0];
    expect(aim.zombie).toBe(gargoyle);
    expect(aim.radius).toBe(J.radius);
    expect(aim.to.angleTo(t.game.player.pos) * PLANET_RADIUS).toBeLessThan(0.3);
  });

  it('puis elle bondit en cloche et retombe sur la marque', () => {
    const { t, gargoyle } = duel(J.range - 2);
    t.game.cheats.god = true;
    t.playUntil(() => t.events('leapAimed').length > 0, 4);
    const aim = t.events('leapAimed')[0];
    t.play(J.windup + J.flight * 0.5);
    expect(altitude(gargoyle.pos)).toBeGreaterThan(J.height * 0.6);
    expect(t.playUntil(() => t.events('leapLanded').length > 0, J.flight)).toBe(true);
    expect(gargoyle.pos.angleTo(aim.to) * PLANET_RADIUS).toBeLessThan(0.5);
    expect(Math.abs(altitude(gargoyle.pos))).toBeLessThan(0.1);
  });

  it('le joueur resté au sol sur la marque est écrasé', () => {
    const { t } = duel(J.range - 2);
    t.playUntil(() => t.events('leapLanded').length > 0, J.windup + J.flight + 3);
    expect(t.events('leapLanded')[0].hit).toBe(true);
    const hurt = t.events('playerHurt').filter((h) => !h.blocked);
    expect(hurt).toHaveLength(1);
    expect(hurt[0].damage).toBe(J.damage);
  });

  it('le joueur qui sort de la marque esquive', () => {
    const { t } = duel(J.range - 2);
    t.playUntil(() => t.events('leapAimed').length > 0, 4);
    t.playUntil(() => t.events('leapLanded').length > 0, J.windup + J.flight + 0.5, { moveX: 1 });
    expect(t.events('leapLanded')[0].hit).toBe(false);
    expect(t.events('playerHurt').filter((h) => !h.blocked)).toHaveLength(0);
  });

  it("le joueur qui saute juste avant qu'elle retombe esquive aussi, sans bouger", () => {
    const { t, gargoyle } = duel(J.range - 2);
    t.playUntil(() => gargoyle.leap === 'flight' && gargoyle.leapTimer < 0.25, J.windup + J.flight + 3);
    t.play(1 / 60, { jump: true, jumpPressed: true });
    t.playUntil(() => t.events('leapLanded').length > 0, 1, { jump: true });
    expect(t.events('leapLanded')[0].hit).toBe(false);
    expect(t.events('playerHurt').filter((h) => !h.blocked)).toHaveLength(0);
  });

  it("après l'atterrissage, elle ne rebondit pas aussitôt", () => {
    const { t } = duel(J.range - 2);
    t.game.cheats.god = true;
    t.playUntil(() => t.events('leapLanded').length > 0, J.windup + J.flight + 3);
    t.play(J.recover + 0.5);
    expect(t.events('leapAimed')).toHaveLength(1);
  });
});
