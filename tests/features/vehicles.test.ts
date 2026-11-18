import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VEHICLE_SPAWN, VEHICLES } from '../../src/config/vehicles';
import { PLANET_RADIUS } from '../../src/config/world';
import { createTestGame } from '../support/testGame';

const D = VEHICLES.delorean;

/** Hasard à graine fixe : même point d'arrivée et même place du véhicule à chaque passage. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seeded(5)); });
afterEach(() => { vi.restoreAllMocks(); });

/** Une run calme, sans zombies. */
function calm() {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  return t;
}
const dist = (a: { angleTo(b: unknown): number }, b: unknown) => a.angleTo(b) * PLANET_RADIUS;

/** Une DeLorean garée juste à côté du joueur, qui monte dedans. */
function driving() {
  const t = calm();
  expect(t.game.vehicles.spawnNear(t.game.player.pos, 'delorean', 0.4, 1.2)).not.toBeNull();
  t.play(0.1);
  expect(t.game.vehicles.driving).not.toBeNull();
  return t;
}

describe('Les véhicules', () => {
  it('un seul véhicule par run, garé au hasard dès le début, loin du point d arrivée', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const t = createTestGame();
      const spawn = t.startRunAndLand();
      const v = t.game.vehicles.parked!;
      expect(v).not.toBeNull();
      expect(t.events('vehicleSpawned')).toHaveLength(1);
      expect(dist(v.pos, spawn.dir)).toBeGreaterThanOrEqual(VEHICLE_SPAWN.minFromSpawn);
      seen.add(v.pos.toArray().map((x) => x.toFixed(1)).join());
    }
    // Pas toujours au même endroit
    expect(seen.size).toBeGreaterThan(1);
  });

  it('il attend toute la run, et une fois utilisé il n y en a plus', () => {
    const t = calm();
    const v = t.game.vehicles.parked!;
    t.play(120);
    expect(t.game.vehicles.parked).toBe(v);
    // Le joueur le trouve et le prend, jusqu'au bout de sa durée
    t.game.vehicles.spawnNear(t.game.player.pos, v.kind, 0.4, 1.2);
    t.play(0.1);
    expect(t.game.vehicles.driving).not.toBeNull();
    t.play(D.duration + 1);
    expect(t.game.vehicles.driving).toBeNull();
    t.play(200);
    expect(t.game.vehicles.parked).toBeNull();
  });

  it('on monte dedans au contact ; au volant, les armes ne tirent plus', () => {
    const t = driving();
    expect(t.events('vehicleEntered')).toHaveLength(1);
    const w = t.game.loadout.weapons[0];
    const z = t.game.spawnZombie('zombie', t.inFront(9), t.game.player.facing.clone().negate())!;
    z.hp = 1e6; z.frozen = 1e6;
    t.play(4);
    expect(w.projectiles.some((p) => p.active)).toBe(false);
    expect(t.events('zombieHit').filter((e) => e.weapon === w)).toHaveLength(0);
  });

  it('elle se conduit comme une voiture : elle accélère, braque, puis freine et recule', () => {
    const t = driving();
    const start = t.game.player.pos.clone();
    const facing0 = t.game.player.facing.clone();
    t.play(2.5, { moveY: 1 });
    const fast = t.game.player.carSpeed;
    expect(fast).toBeGreaterThan(t.game.player.speed * 1.3);
    // Bien plus vite qu'à pied
    expect(dist(t.game.player.pos, start)).toBeGreaterThan(t.game.player.speed * 2.5 * 1.15);
    // Braquer à droite tourne le capot
    t.play(0.6, { moveY: 1, moveX: 1 });
    expect(t.game.player.facing.angleTo(facing0)).toBeGreaterThan(0.5);
    // Reculer freine, puis passe en marche arrière
    t.play(3, { moveY: -1 });
    expect(t.game.player.carSpeed).toBeLessThan(0);
    expect(t.game.player.carSpeed).toBeGreaterThanOrEqual(-D.car.reverseSpeed - 1e-6);
  });

  it('elle écrase les zombies sur son passage, pas à l arrêt', () => {
    const t = driving();
    const z = t.game.spawnZombie('zombie', t.inFront(D.crush.radius * 0.7), t.game.player.facing.clone().negate())!;
    z.frozen = 1e6;
    t.play(1);
    expect(t.events('vehicleCrushed')).toHaveLength(0);
    const far = t.game.spawnZombie('zombie', t.inFront(14), t.game.player.facing.clone().negate())!;
    far.frozen = 1e6;
    t.playUntil(() => t.events('vehicleCrushed').some((e) => e.zombie === far), 4, { moveY: 1 });
    const hit = t.events('vehicleCrushed').find((e) => e.zombie === far)!;
    expect(hit.speed).toBeGreaterThan(D.crush.minSpeed);
    expect(hit.killed).toBe(true);
  });

  it('le véhicule encaisse les coups à la place du joueur ; détruit, le joueur descend, invulnérable un instant', () => {
    const t = driving();
    const hp = t.game.health.hp;
    const z = t.game.spawnZombie('zombie', t.inFront(1.0, 1.0), t.game.player.facing.clone().negate())!;
    z.hp = 1e6;
    t.playUntil(() => t.events('vehicleHit').length > 0, 10);
    expect(t.game.health.hp).toBe(hp);
    expect(t.game.vehicles.driving!.hp).toBeLessThan(D.hp);
    t.game.vehicles.driving!.hp = 1;
    t.game.vehicles.driving!.hitCooldown = 0;
    t.playUntil(() => t.events('vehicleExited').length > 0, 10);
    expect(t.events('vehicleExited')[0].reason).toBe('destroyed');
    expect(t.game.vehicles.driving).toBeNull();
    expect(t.game.player.car).toBeNull();
    expect(t.game.health.invuln).toBeGreaterThan(VEHICLE_SPAWN.exitInvuln - 0.2);
  });

  it('au bout de sa durée on descend, et les armes reprennent', () => {
    const t = driving();
    const w = t.game.loadout.weapons[0];
    t.play(D.duration + 0.3);
    expect(t.events('vehicleExited')[0]?.reason).toBe('timeout');
    const z = t.game.spawnZombie('zombie', t.inFront(7), t.game.player.facing.clone().negate())!;
    z.hp = 1e6; z.frozen = 1e6;
    t.playUntil(() => t.events('zombieHit').some((e) => e.weapon === w), 6);
    expect(t.events('zombieHit').some((e) => e.weapon === w)).toBe(true);
  });
});
