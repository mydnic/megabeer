import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PLANET_RADIUS } from '../../src/config/world';
import { DIFFICULTIES, SPAWN, SPAWN_CURVE } from '../../src/config/spawn';
import { randomSpawn } from '../../src/world/decor/layout';
import { ZOMBIE_ATTACK, ZOMBIE_STATS } from '../../src/config/zombies';
import { spawnCurveAt } from '../../src/game/spawnDirector';
import { createTestGame } from '../support/testGame';

/** Une run au sol, Blonde désarmée et godmode : on observe la horde sans qu'elle meure ni nous tue. */
function observe(seed = 1) {
  const t = createTestGame(seed);
  t.startRunAndLand();
  t.game.loadout.weapons[0].mods.range = 0;
  t.game.cheats.god = true;
  return t;
}

const standing = (t: ReturnType<typeof createTestGame>) => t.game.horde.zombies.filter((z) => !z.dead);
/** Distance au sol (le long de la planète, sans le relief). */
const groundDist = (a: THREE.Vector3, b: THREE.Vector3) => a.angleTo(b) * PLANET_RADIUS;

describe('Les zombies arrivent', () => {
  it("personne avant l'atterrissage : la première horde sort de terre quand le Buveur touche le sol", () => {
    const t = createTestGame();
    t.game.startRun(randomSpawn(() => true)!);
    expect(t.game.arriving).toBe(true);
    t.play(0.3);
    expect(t.game.horde.zombies).toHaveLength(0);
    t.playUntil(() => !t.game.arriving, 10);
    t.play(1 / 60);
    expect(standing(t).length).toBe(SPAWN_CURVE[0].alive);
  });

  it("apparaissent hors de portée, sur un anneau autour du joueur, et sortent de terre avant d'avancer", () => {
    const t = observe();
    t.play(1 / 60);
    const p = t.game.player.pos;
    for (const z of standing(t)) {
      const d = groundDist(z.pos, p);
      expect(d).toBeGreaterThan(SPAWN.minDist * 0.95);
      expect(d).toBeLessThan(SPAWN.maxDist * 1.05);
      expect(z.rise).toBeGreaterThan(0);
    }
    const z = standing(t)[0];
    const at = z.pos.clone();
    t.play(SPAWN.riseTime * 0.8);
    expect(z.pos.distanceTo(at)).toBeLessThan(0.05);
    t.play(SPAWN.riseTime + 1);
    expect(z.pos.distanceTo(p)).toBeLessThan(at.distanceTo(p) - 0.5);
  });

  it('la horde se reforme quand on la décime', () => {
    const t = observe();
    t.play(1 / 60);
    for (const z of standing(t)) t.game.hitZombie(z, z.hp + 1, false, z.pos, t.game.player.facing.clone());
    expect(standing(t)).toHaveLength(0);
    t.play(SPAWN_CURVE[0].alive / SPAWN_CURVE[0].perSecond + 1);
    expect(standing(t).length).toBe(Math.round(spawnCurveAt(t.game.runTime).alive));
  });

  it('plus la run avance, plus ils sont nombreux', () => {
    const t = observe();
    t.play(1);
    const early = standing(t).length;
    t.game.runTime = 300; // on saute à 5:00
    t.play(20);
    expect(standing(t).length).toBe(Math.round(spawnCurveAt(t.game.runTime).alive));
    expect(standing(t).length).toBeGreaterThan(early * 5);
  });

  it('plus la run avance, plus ils sont coriaces', () => {
    const t = observe();
    t.play(1 / 60);
    expect(standing(t)[0].hp).toBe(ZOMBIE_STATS.hp);
    t.noSpawns();
    t.game.director.enabled = true;
    t.game.runTime = 480;
    t.play(1);
    const late = standing(t)[0];
    expect(late.hp).toBe(Math.round(ZOMBIE_STATS.hp * spawnCurveAt(t.game.runTime - 1).hpMul));
    expect(late.hp).toBeGreaterThan(ZOMBIE_STATS.hp * 3);
  });

  it('un zombie distancé ressort de terre devant le joueur', () => {
    const t = observe();
    t.noSpawns();
    const z = t.game.spawnZombie('basic', t.inFront(-(SPAWN.recycleDist + 15)), t.game.player.facing.clone())!;
    t.play(1 / 60);
    const d = groundDist(z.pos, t.game.player.pos);
    expect(d).toBeLessThan(SPAWN.maxDist * 1.05);
    expect(z.rise).toBeGreaterThan(0);
    // Devant : du côté où le Buveur regarde
    const toZ = z.pos.clone().sub(t.game.player.pos).normalize();
    expect(toZ.dot(t.game.player.facing)).toBeGreaterThan(0);
  });

  it("n'arrivent ni pendant la pause, ni pendant le choix des cartes, ni après la mort", () => {
    const t = observe();
    t.play(1 / 60);
    t.game.runTime = 300;
    t.game.pause();
    const n = t.game.horde.zombies.length;
    t.play(3);
    expect(t.game.horde.zombies.length).toBe(n);
    t.game.resume();
    t.game.cheats.god = false;
    t.game.health.damage(1000);
    t.play(1 / 60);
    expect(t.game.phase).toBe('dead');
    const dead = t.game.horde.zombies.length;
    t.play(3);
    expect(t.game.horde.zombies.length).toBeLessThanOrEqual(dead);
  });
});

describe('La difficulté', () => {
  it('Bourré : plus de zombies, plus coriaces, qui frappent plus fort', () => {
    const t = createTestGame();
    t.game.difficulty = 'bourre';
    const B = DIFFICULTIES.bourre;
    t.startRunAndLand();
    t.game.loadout.weapons[0].mods.range = 0;
    t.play(1 / 60);
    expect(standing(t).length).toBe(Math.round(SPAWN_CURVE[0].alive * B.count));
    expect(standing(t)[0].hp).toBe(Math.round(ZOMBIE_STATS.hp * B.hp));
    t.noSpawns();
    t.game.spawnZombie('basic', t.inFront(1.2), t.game.player.facing.clone().negate());
    t.playUntil(() => t.events('playerHurt').some((h) => !h.blocked), 4);
    expect(t.events('playerHurt').find((h) => !h.blocked)!.damage).toBeCloseTo(ZOMBIE_ATTACK.damage * B.damage);
  });
});
