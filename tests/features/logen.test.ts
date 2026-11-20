import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GRAVE_BOSSES as G, LOGEN as L } from '../../src/config/bosses';
import { TUNAS } from '../../src/config/tunas';
import { PLANET_RADIUS } from '../../src/config/world';
import type { Logen } from '../../src/game/logen';
import { randomSpawn } from '../../src/world/decor/layout';
import { createTestGame } from '../support/testGame';

/** Hasard à graine fixe : même arrivée à chaque passage. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seeded(9)); });
afterEach(() => { vi.restoreAllMocks(); });

const dist = (a: THREE.Vector3, b: THREE.Vector3) => a.angleTo(b) * PLANET_RADIUS;
type T = ReturnType<typeof createTestGame>;
const press = (t: T) => t.play(1 / 60, { action: true, actionPressed: true });
/** Le point `at` déplacé de `d` m autour de l'axe tangent `axis`. */
const around = (at: THREE.Vector3, d: number, axis: THREE.Vector3) => at.clone().normalize().applyAxisAngle(axis.clone().normalize(), d / PLANET_RADIUS);

/** Logen défié, posé à 4 m devant le joueur (run calme, arme désarmée) ; puis le joueur placé à `d` m de lui. */
function fight(d = 4) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  const b = t.game.graveBosses.placeAt('logen', t.inFront(4));
  b.facing.copy(t.game.player.facing).negate();
  t.play(0.1);
  press(t);
  const boss = t.game.bosses.find((x) => x.kind === 'logen') as Logen;
  const z = boss.zombie, p = t.game.player;
  if (d !== 4) p.reset(around(z.pos, d, new THREE.Vector3().crossVectors(z.pos, z.facing)), p.facing.clone());
  t.play(0.05);
  return { t, boss };
}

describe('Logen Neuf-Doigts, boss optionnel d un cimetière', () => {
  it('il attend devant un autre cimetière que Vador, loin du départ', () => {
    const t = createTestGame();
    const spawn = randomSpawn(() => true)!;
    const side = new THREE.Vector3().crossVectors(spawn.dir, spawn.facing).normalize();
    const out = spawn.facing.clone();
    const graves = [100, 150, 200].map((d) => ({ dir: around(spawn.dir, d, side), out }));
    t.game.startRun({ ...spawn, graveyards: graves });
    const kinds = t.game.graveBosses.list.map((b) => b.kind).sort();
    expect(kinds).toEqual([...G.kinds].sort());
    const [a, b] = t.game.graveBosses.list;
    expect(dist(a.pos, b.pos)).toBeGreaterThan(20);
  });

  it('à portée, la touche d action le défie', () => {
    const { t, boss } = fight();
    expect(boss).toBeDefined();
    expect(t.events('graveBossChallenged').map((e) => e.boss.kind)).toEqual(['logen']);
  });

  it('de loin, il charge : la bande est marquée d abord, puis il fonce et percute le joueur resté dedans', () => {
    const { t, boss } = fight(12);
    t.playUntil(() => !!boss.lane, 4);
    expect(boss.lane).not.toBeNull();
    expect(t.events('playerHurt')).toHaveLength(0);
    const start = boss.zombie.pos.clone();
    t.playUntil(() => t.events('playerHurt').length > 0, L.charge.windup + 2);
    expect(t.events('logenCharge')).toHaveLength(1);
    expect(t.events('playerHurt').length).toBeGreaterThan(0);
    expect(dist(boss.zombie.pos, start)).toBeGreaterThan(5);
  });

  it('s écarter de la bande avant qu il parte évite la charge ; au bout, il reste essoufflé', () => {
    const { t, boss } = fight(12);
    t.playUntil(() => !!boss.lane && boss.lane.t > 0.5, 4);
    const lane = boss.lane!;
    // Le joueur fait un grand pas de côté
    const p = t.game.player;
    p.reset(around(p.pos, 6, lane.dir), p.facing.clone());
    t.playUntil(() => !boss.lane, L.charge.windup + 3);
    expect(t.events('playerHurt')).toHaveLength(0);
    // Essoufflé : il ne bouge plus un moment
    const at = boss.zombie.pos.clone();
    t.play(L.charge.tired * 0.7);
    expect(dist(boss.zombie.pos, at)).toBeLessThan(0.3);
  });

  it('de près, il tourbillonne : le cercle est marqué, puis il tourne et blesse le joueur dedans', () => {
    const { t, boss } = fight(3);
    t.playUntil(() => !!boss.ring, 4);
    expect(boss.ring).not.toBeNull();
    expect(t.events('playerHurt')).toHaveLength(0);
    t.playUntil(() => t.events('playerHurt').length > 0, L.spin.windup + L.spin.duration + 0.5);
    expect(t.events('logenSpin')).toHaveLength(1);
    expect(t.events('playerHurt').length).toBeGreaterThan(0);
    expect(boss.turn).toBeGreaterThan(0);
  });

  it('sortir du cercle avant qu il tourne l évite', () => {
    const { t, boss } = fight(3);
    t.playUntil(() => !!boss.ring, 4);
    const p = t.game.player;
    const away = new THREE.Vector3().crossVectors(boss.zombie.pos, p.pos.clone().sub(boss.zombie.pos)).normalize();
    p.reset(around(boss.zombie.pos, L.spin.radius + 3, away), p.facing.clone());
    t.playUntil(() => !boss.ring, L.spin.windup + L.spin.duration + 0.5);
    expect(t.events('logenSpin')).toHaveLength(1);
    expect(t.events('playerHurt')).toHaveLength(0);
  });

  it('le Sanguinaire (phase 2) : il crie, enchaîne deux charges et ne s essouffle plus', () => {
    const { t, boss } = fight(12);
    t.game.cheats.god = true;
    boss.zombie.hp = boss.zombie.maxHp * L.phase2.below * 0.9;
    t.play(0.05);
    expect(boss.phase).toBe(2);
    expect(t.events('bossPhase').map((e) => e.phase)).toEqual([2]);
    t.play(L.phase2.pause + 0.1);
    // Le joueur loin, il charge deux fois de suite
    const p = t.game.player;
    p.reset(around(boss.zombie.pos, 12, new THREE.Vector3().crossVectors(boss.zombie.pos, boss.zombie.facing)), p.facing.clone());
    t.playUntil(() => t.events('logenCharge').length >= 2, 8);
    expect(t.events('logenCharge').length).toBeGreaterThanOrEqual(2);
  });

  it('tué, il rapporte beaucoup d XP, un coffre légendaire gratuit et des TUNAS', () => {
    const { t, boss } = fight();
    t.game.cheats.god = true;
    t.game.hitZombie(boss.zombie, 1e6, false, boss.zombie.pos, t.game.player.facing);
    t.play(0.1);
    const e = t.events('bossKilled');
    expect(e.map((x) => x.boss.kind)).toEqual(['logen']);
    expect(e[0].chest?.rarity).toBe(L.chestRarity);
    expect(t.game.tunaDrops.drops.reduce((n, d) => n + d.value, 0)).toBeGreaterThanOrEqual(TUNAS.boss.logen);
    expect(t.game.bosses).toHaveLength(0);
  });
});
