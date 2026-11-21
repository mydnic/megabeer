import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NARUTO } from '../../src/config/naruto';
import { BASE_SPEED, PLANET_RADIUS } from '../../src/config/world';
import { createTestGame } from '../support/testGame';

/** Hasard à graine fixe : même point d'arrivée à chaque passage. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seeded(9)); });
afterEach(() => { vi.restoreAllMocks(); });

const dist = (a: THREE.Vector3, b: THREE.Vector3) => a.angleTo(b) * PLANET_RADIUS;

/** Une run calme : pas d'ennemis, arme désarmée, joueur invincible. */
function calm() {
  const t = createTestGame();
  const spawn = t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  t.game.cheats.god = true;
  return { t, spawn };
}

describe('Naruto', () => {
  it('il court déjà sur la planète au début de la run, loin du point d arrivée', () => {
    const { t, spawn } = calm();
    const n = t.game.naruto;
    expect(n.pos).not.toBeNull();
    expect(n.state).toBe('running');
    expect(dist(n.pos!, spawn.dir)).toBeGreaterThanOrEqual(NARUTO.minFromSpawn);
  });

  it('il file bien plus vite que le joueur, change de cap et souffle de temps en temps', () => {
    const { t } = calm();
    const n = t.game.naruto;
    expect(NARUTO.speed).toBeGreaterThan(BASE_SPEED * 1.5);
    const start = n.pos!.clone(), facing0 = n.facing.clone();
    let rested = false, turned = false, travelled = 0;
    let last = n.pos!.clone();
    for (let i = 0; i < 20 * 20; i++) {
      t.play(0.05);
      if (n.state === 'resting') rested = true;
      if (n.facing.angleTo(facing0) > 0.5) turned = true;
      travelled += dist(last, n.pos!);
      last.copy(n.pos!);
    }
    expect(rested).toBe(true);
    expect(turned).toBe(true);
    // En 20 s, il a couru loin (même avec ses pauses) et il est resté au sol
    expect(travelled).toBeGreaterThan(BASE_SPEED * 20);
    expect(dist(start, n.pos!)).toBeGreaterThan(0);
    expect(n.pos!.length()).toBeGreaterThan(PLANET_RADIUS - 5);
  });

  it('le toucher le fait disparaître en fumée et laisse un coffre légendaire gratuit', () => {
    const { t } = calm();
    const n = t.game.naruto;
    // Naruto posé juste devant le joueur
    expect(n.placeAt(t.inFront(1))).toBe(true);
    const chests = t.game.chests.list.length;
    t.play(0.05);
    const caught = t.events('narutoCaught');
    expect(caught).toHaveLength(1);
    expect(n.state).toBe('gone');
    expect(n.pos).toBeNull();
    const chest = caught[0].chest!;
    expect(chest).not.toBeNull();
    expect(chest.free).toBe(true);
    expect(chest.rarity).toBe(NARUTO.chestRarity);
    expect(t.game.chests.list.length).toBe(chests + 1);
    expect(dist(chest.pos, caught[0].at)).toBeLessThan(4);
  });

  it('de loin, rien ; une fois attrapé, il ne revient pas', () => {
    const { t } = calm();
    const n = t.game.naruto;
    expect(n.placeAt(t.inFront(12))).toBe(true);
    t.play(0.05);
    expect(t.events('narutoCaught')).toHaveLength(0);
    expect(n.placeAt(t.inFront(1))).toBe(true);
    t.play(0.05);
    t.play(3);
    expect(t.events('narutoCaught')).toHaveLength(1);
    expect(n.state).toBe('gone');
  });

  it('une nouvelle run remet un Naruto en course', () => {
    const { t } = calm();
    expect(t.game.naruto.placeAt(t.inFront(1))).toBe(true);
    t.play(0.05);
    expect(t.game.naruto.state).toBe('gone');
    t.game.goHome();
    expect(t.game.naruto.pos).toBeNull();
    t.startRunAndLand();
    expect(t.game.naruto.state).toBe('running');
  });
});
