import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/config/enemies';
import { PLANET_RADIUS } from '../../src/config/world';
import { heightAt } from '../../src/world/terrain';
import { createTestGame } from '../support/testGame';

const G = ENEMIES.fantome.ghost;

/** Une arène calme, Canette désarmée, et un Fantôme du cloître face au joueur à `dist` m. */
function duel(dist: number) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  t.game.cheats.god = true;
  const ghost = t.game.spawnZombie('fantome', t.inFront(dist), t.game.player.facing.clone().negate())!;
  return { t, ghost };
}

describe('Le Fantôme du cloître', () => {
  it("arrive à 5:00 dans le roster de l'Abbaye", () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.game.loadout.weapons[0].mods.range = 0;
    t.game.cheats.god = true;
    t.game.runTime = 300 + 10;
    t.play(40);
    expect(t.events('zombieSpawned').some((e) => e.zombie.enemy === 'fantome')).toBe(true);
  });

  it('il traverse les murs, là où le Zombie doit les contourner', () => {
    const { t, ghost } = duel(9);
    t.wall(4.5, 30); // un long mur entre eux et le joueur
    const zombie = t.game.spawnZombie('zombie', t.inFront(9, 3), t.game.player.facing.clone().negate())!;
    t.play(2.6);
    const p = t.game.player.pos;
    expect(ghost.pos.angleTo(p) * PLANET_RADIUS).toBeLessThan(3);
    expect(zombie.pos.angleTo(p) * PLANET_RADIUS).toBeGreaterThan(4);
  });

  it("il reste au niveau du sol en avançant (il ne s'enfonce pas)", () => {
    const { t, ghost } = duel(9);
    t.play(1.5);
    const ground = PLANET_RADIUS + heightAt(ghost.pos.clone().normalize());
    expect(Math.abs(ghost.pos.length() - ground)).toBeLessThan(0.05);
  });

  it("il est intouchable environ 1 s toutes les 3 s", () => {
    const { t, ghost } = duel(30);
    let off = 0;
    const steps = 9 * 60;
    for (let i = 0; i < steps; i++) {
      t.play(1 / 60);
      if (ghost.intangible) off++;
    }
    expect(off / steps).toBeCloseTo(G.intangible / G.every, 1);
  });

  it("intouchable, les coups le traversent : ni dégâts, ni impact ; le reste du temps, il encaisse", () => {
    const { t, ghost } = duel(30);
    const hp = ghost.hp;
    t.playUntil(() => ghost.intangible, G.every + 0.5);
    expect(ghost.targetable).toBe(false);
    expect(t.game.hitZombie(ghost, 5, false, ghost.pos, t.game.player.facing.clone())).toBe(false);
    expect(ghost.hp).toBe(hp);
    expect(t.events('zombieHit')).toHaveLength(0);
    t.playUntil(() => !ghost.intangible, G.intangible + 0.5);
    expect(ghost.targetable).toBe(true);
    t.game.hitZombie(ghost, 5, false, ghost.pos, t.game.player.facing.clone());
    expect(ghost.hp).toBe(hp - 5);
  });
});
