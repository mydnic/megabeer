import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ABBE as A, PATRON_DOOR } from '../../src/config/bosses';
import { PLANET_RADIUS } from '../../src/config/world';
import type { Abbe } from '../../src/game/abbe';
import { flatAround } from '../../src/game/patronDoor';
import { createTestGame } from '../support/testGame';

/** Hasard à graine fixe : même planète, mêmes placements à chaque passage. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seeded(11)); });
afterEach(() => { vi.restoreAllMocks(); });

/** Une run au sol, calme : pas de zombies, Canette désarmée. */
function arena() {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  return t;
}

const dist = (a: THREE.Vector3, b: THREE.Vector3) => a.angleTo(b) * PLANET_RADIUS;
const press = (t: ReturnType<typeof createTestGame>) => t.play(1 / 60, { action: true, actionPressed: true });

/** Le Buveur se poste devant la porte, à `d` m, tourné vers elle. */
function atDoor(t: ReturnType<typeof createTestGame>, d = 2) {
  const door = t.game.door;
  t.game.player.reset(door.pos!.clone().addScaledVector(door.facing, d).normalize(), door.facing.clone().negate());
  t.play(0.1);
}

/** L'Abbé devant le joueur, prêt à se battre (sorti de terre). */
function abbe(t: ReturnType<typeof createTestGame>, d = 10) {
  const p = t.game.player;
  const at = t.inFront(d);
  const boss = t.game.spawnAbbe(at, p.pos.clone().sub(at))! as Abbe;
  t.playUntil(() => boss.zombie.rise <= 0, 3);
  return boss;
}

describe('La Porte du patron', () => {
  it('une run en pose une, loin du départ', () => {
    const t = arena();
    const spawn = t.game.player.pos.clone();
    expect(t.game.door.pos).not.toBeNull();
    expect(dist(t.game.door.pos!, spawn)).toBeGreaterThan(PATRON_DOOR.minFromSpawn - 25);
  });

  it('elle est posée sur un sol presque plat, pas sur un flanc de montagne', () => {
    for (const seed of [3, 11, 27]) {
      vi.spyOn(Math, 'random').mockImplementation(seeded(seed));
      const t = arena();
      const dir = t.game.door.pos!.clone().normalize();
      expect(flatAround(dir, PATRON_DOOR.flatRadius, PATRON_DOOR.maxBump)).toBe(true);
    }
  });

  it("devant elle, la touche d'action l'ouvre : l'Abbé en sort, une seule fois", () => {
    const t = arena();
    t.game.cheats.god = true;
    atDoor(t);
    expect(t.game.door.focus).toBe(true);
    press(t);
    expect(t.game.door.open).toBe(true);
    expect(t.events('doorOpened')).toHaveLength(1);
    expect(t.game.boss?.kind).toBe('abbe');
    press(t);
    expect(t.events('bossSpawned')).toHaveLength(1);
  });

  it('pas d\'appel tant qu\'un autre boss est debout', () => {
    const t = arena();
    t.game.cheats.god = true;
    t.game.spawnBoss();
    atDoor(t);
    press(t);
    expect(t.game.door.open).toBe(false);
    expect(t.events('doorBusy')).toHaveLength(1);
    expect(t.game.boss?.kind).toBe('sonneur');
  });
});

describe("L'Abbé", () => {
  it('à portée, il répand son vin : des flaques marquées autour du joueur, qui brûlent qui reste dedans', () => {
    const t = arena();
    const boss = abbe(t);
    expect(t.playUntil(() => t.events('winePoured').length > 0, 6)).toBe(true);
    const puddles = t.events('winePoured')[0].puddles;
    expect(puddles).toHaveLength(A.cast.puddles);
    expect(Math.min(...puddles.map((w) => dist(w.at, t.game.player.pos)))).toBeLessThan(0.5);
    // Marquée : rien ; allumée : le joueur dedans encaisse
    const hp = t.game.health.hp;
    t.play(A.cast.arm * 0.8);
    expect(t.game.health.hp).toBe(hp);
    expect(t.playUntil(() => t.events('playerHurt').some((e) => !e.blocked), 2)).toBe(true);
    expect(t.events('playerHurt').find((e) => !e.blocked)!.damage).toBeCloseTo(A.cast.damage * t.game.mods.damage);
    expect(boss.puddles.length).toBeGreaterThan(0);
  });

  it('hors des flaques, on ne prend rien', () => {
    const t = arena();
    abbe(t);
    expect(t.playUntil(() => t.events('winePoured').length > 0, 6)).toBe(true);
    // Le Buveur s'écarte loin avant l'allumage
    const p = t.game.player;
    p.reset(p.pos.clone().applyAxisAngle(new THREE.Vector3().crossVectors(p.pos, p.facing).normalize(), 25 / PLANET_RADIUS).normalize(), p.facing);
    t.play(A.cast.arm + 1.5);
    expect(t.events('playerHurt').filter((e) => !e.blocked)).toHaveLength(0);
  });

  it('sous la moitié de ses PV, il boit son calice et devient géant', () => {
    const t = arena();
    t.game.cheats.god = true;
    const boss = abbe(t);
    t.game.hitZombie(boss.zombie, boss.zombie.hp * 0.55, false, boss.zombie.pos, t.game.player.facing, t.game.loadout.weapons[0]);
    t.play(0.1);
    expect(boss.phase).toBe(2);
    expect(t.events('bossPhase')).toHaveLength(1);
    t.play(A.phase2.roar + A.phase2.growTime);
    expect(boss.scale).toBeCloseTo(A.phase2.grow);
    expect(boss.zombie.size).toBeCloseTo(A.bodyScale * A.phase2.grow);
  });

  it('le tuer laisse un coffre légendaire gratuit, et la run continue', () => {
    const t = arena();
    t.game.cheats.god = true;
    const boss = abbe(t);
    const time = t.game.runTime;
    t.game.hitZombie(boss.zombie, 1e6, false, boss.zombie.pos, t.game.player.facing);
    const killed = t.events('bossKilled').at(-1)!;
    expect(killed.chest).not.toBeNull();
    expect(killed.chest!.rarity).toBe(A.chestRarity);
    expect(killed.chest!.free).toBe(true);
    expect(t.game.boss).toBeNull();
    expect(t.game.frozen).toBe(false);
    t.play(2);
    expect(t.game.phase).toBe('run');
    expect(t.game.runTime).toBeGreaterThan(time + 1.9);
    expect(t.events('runEnded')).toHaveLength(0);
  });
});
