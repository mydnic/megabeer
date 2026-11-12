import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOSING as C } from '../../src/config/closing';
import { PLANET_RADIUS } from '../../src/config/world';
import { createTestGame } from '../support/testGame';

/** Hasard à graine fixe : mêmes apparitions à chaque passage. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seeded(5)); });
afterEach(() => { vi.restoreAllMocks(); });

/** Une run au sol, sans zombies, juste avant la fermeture. */
function beforeClosing(left = 1) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.bossDone = true;
  t.game.runTime = C.at - left;
  return t;
}

const dist = (a: THREE.Vector3, b: THREE.Vector3) => a.angleTo(b) * PLANET_RADIUS;

describe('La fermeture du bar', () => {
  it('à 10:00, la Mort sort de terre autour du Buveur', () => {
    const t = beforeClosing(1);
    t.play(0.5);
    expect(t.game.closing.reapers).toHaveLength(0);
    expect(t.events('closingStarted')).toHaveLength(0);
    t.play(1);
    expect(t.events('closingStarted')).toHaveLength(1);
    expect(t.game.closing.reapers).toHaveLength(1);
    const r = t.game.closing.reapers[0];
    expect(dist(r.pos, t.game.player.pos)).toBeCloseTo(C.spawnDist, -1);
    expect(t.events('reaperSpawned')).toHaveLength(1);
  });

  it('elle sort de terre sans bouger, puis fonce sur le joueur', () => {
    const t = beforeClosing(0.1);
    t.play(0.2);
    const r = t.game.closing.reapers[0];
    const start = r.pos.clone();
    t.play(C.rise * 0.8);
    expect(r.pos.distanceTo(start)).toBeLessThan(0.01);
    const before = dist(r.pos, t.game.player.pos);
    t.play(C.rise * 0.2 + 2);
    expect(dist(r.pos, t.game.player.pos)).toBeLessThan(before - C.speed);
  });

  it('les armes ne la touchent pas : elle ne meurt pas et reste après un long combat', () => {
    const t = beforeClosing(0.1);
    t.game.cheats.god = true;
    t.play(C.rise + 6);
    expect(t.game.horde.zombies.some((z) => z.targetable)).toBe(false);
    expect(t.game.closing.reapers).toHaveLength(1);
  });

  it('un coup de faux tue le Buveur : fin de run « mort »', () => {
    const t = beforeClosing(0.1);
    expect(t.playUntil(() => t.game.phase !== 'run', 20)).toBe(true);
    expect(t.events('reaperSwing').length).toBeGreaterThan(0);
    expect(t.events('runEnded').at(-1)!.reason).toBe('mort');
  });

  it('de plus en plus nombreuses, et de plus en plus rapides', () => {
    const t = beforeClosing(0.1);
    t.game.cheats.god = true;
    t.play(C.every * 2 + 1);
    expect(t.game.closing.reapers).toHaveLength(3);
    expect(t.game.closing.speedAt(C.at + 120)).toBeGreaterThan(t.game.closing.speedAt(C.at));
    expect(t.game.closing.speedAt(C.at + 3600)).toBe(C.maxSpeed);
  });

  it('la porte du patron reste ouvrable pendant la fermeture, et la victoire arrête tout', () => {
    const t = beforeClosing(0.1);
    t.game.cheats.god = true;
    t.play(1);
    const p = t.game.player;
    const at = t.inFront(10);
    const boss = t.game.spawnAbbe(at, p.pos.clone().sub(at))!;
    expect(boss).not.toBeNull();
    t.game.hitZombie(boss.zombie, 1e6, false, boss.zombie.pos, p.facing);
    expect(t.events('victory')).toHaveLength(1);
    const r = t.game.closing.reapers[0].pos.clone();
    t.play(2);
    expect(t.game.closing.reapers[0].pos.distanceTo(r)).toBe(0);
  });

  it('une nouvelle run repart sans Mort', () => {
    const t = beforeClosing(0.1);
    t.game.cheats.god = true;
    t.play(1);
    t.game.goHome();
    expect(t.game.closing.reapers).toHaveLength(0);
    expect(t.game.closing.started).toBe(false);
  });
});
