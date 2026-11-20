import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GRAVE_BOSSES as GB, GUTS as G } from '../../src/config/bosses';
import { TUNAS } from '../../src/config/tunas';
import { PLANET_RADIUS } from '../../src/config/world';
import type { Guts } from '../../src/game/guts';
import { randomSpawn } from '../../src/world/decor/layout';
import { createTestGame } from '../support/testGame';

/** Hasard à graine fixe : même arrivée à chaque passage. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seeded(13)); });
afterEach(() => { vi.restoreAllMocks(); });

const dist = (a: THREE.Vector3, b: THREE.Vector3) => a.angleTo(b) * PLANET_RADIUS;
type T = ReturnType<typeof createTestGame>;
const press = (t: T) => t.play(1 / 60, { action: true, actionPressed: true });
/** Le point `at` déplacé de `d` m autour de l'axe tangent `axis`. */
const around = (at: THREE.Vector3, d: number, axis: THREE.Vector3) => at.clone().normalize().applyAxisAngle(axis.clone().normalize(), d / PLANET_RADIUS);

/** Guts défié, posé à 4 m devant le joueur (run calme, arme désarmée) ; puis le joueur placé à `d` m devant lui. */
function fight(d = 4) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  const b = t.game.graveBosses.placeAt('guts', t.inFront(4));
  b.facing.copy(t.game.player.facing).negate();
  t.play(0.1);
  press(t);
  const boss = t.game.bosses.find((x) => x.kind === 'guts') as Guts;
  const z = boss.zombie, p = t.game.player;
  if (d !== 4) p.reset(around(z.pos, d, new THREE.Vector3().crossVectors(z.pos, z.facing)), p.facing.clone());
  t.play(0.05);
  return { t, boss };
}

describe('Guts, boss optionnel d un cimetière', () => {
  it('il attend devant un cimetière à lui, comme les autres boss optionnels', () => {
    const t = createTestGame();
    const spawn = randomSpawn(() => true)!;
    const side = new THREE.Vector3().crossVectors(spawn.dir, spawn.facing).normalize();
    const graves = [100, 140, 180, 220, 260].map((d) => ({ dir: around(spawn.dir, d, side), out: spawn.facing.clone() }));
    t.game.startRun({ ...spawn, graveyards: graves });
    const list = t.game.graveBosses.list.filter((b) => b.kind !== 'sauron');
    expect(list.map((b) => b.kind).sort()).toEqual([...GB.kinds].sort());
    const guts = list.find((b) => b.kind === 'guts')!;
    for (const o of list) if (o !== guts) expect(dist(o.pos, guts.pos)).toBeGreaterThan(20);
  });

  it('à portée, la touche d action le défie', () => {
    const { t, boss } = fight();
    expect(boss).toBeDefined();
    expect(t.events('graveBossChallenged').map((e) => e.boss.kind)).toEqual(['guts']);
  });

  it('de près, il fauche : l arc est marqué d abord, puis le joueur dedans encaisse', () => {
    const { t, boss } = fight(3);
    t.playUntil(() => !!boss.arc, 4);
    expect(boss.arc).not.toBeNull();
    expect(t.events('playerHurt')).toHaveLength(0);
    t.playUntil(() => t.events('gutsSweep').length > 0, G.sweep.windup + G.sweep.duration + 0.5);
    expect(t.events('gutsSweep')[0].hit).toBe(true);
    expect(t.events('playerHurt').length).toBeGreaterThan(0);
  });

  it('reculer hors de l arc avant le coup l évite', () => {
    const { t, boss } = fight(3);
    t.playUntil(() => !!boss.arc && boss.arc.t > G.sweep.track + 0.05, 4);
    const a = boss.arc!;
    const p = t.game.player;
    // Derrière lui : hors de l'arc, même tout près
    p.reset(around(a.at, 2.5, new THREE.Vector3().crossVectors(a.at, a.dir).negate()), p.facing.clone());
    t.playUntil(() => t.events('gutsSweep').length > 0, G.sweep.windup + G.sweep.duration + 0.5);
    expect(t.events('gutsSweep')[0].hit).toBe(false);
    expect(t.events('playerHurt')).toHaveLength(0);
  });

  it('de plus loin, il abat l épée en ligne : la bande est marquée, puis le joueur dedans encaisse', () => {
    const { t, boss } = fight(17);
    t.playUntil(() => !!boss.lane, 4);
    expect(boss.lane).not.toBeNull();
    t.playUntil(() => t.events('gutsSlam').length > 0, G.slam.windup + G.slam.duration + 0.5);
    expect(t.events('gutsSlam')[0].hit).toBe(true);
    expect(t.events('playerHurt').length).toBeGreaterThan(0);
  });

  it('un pas de côté hors de la bande évite le coup abattu', () => {
    const { t, boss } = fight(17);
    t.playUntil(() => !!boss.lane && boss.lane.t > G.slam.track + 0.05, 4);
    const l = boss.lane!;
    const p = t.game.player;
    p.reset(around(p.pos, l.width + 3, l.dir), p.facing.clone());
    t.playUntil(() => t.events('gutsSlam').length > 0, G.slam.windup + G.slam.duration + 0.5);
    expect(t.events('gutsSlam')[0].hit).toBe(false);
    expect(t.events('playerHurt')).toHaveLength(0);
  });

  it('le Berserker (phase 2) : il crie, s embrase, enchaîne trois fauchages et encaisse moitié moins', () => {
    const { t, boss } = fight(3);
    t.game.cheats.god = true;
    const z = boss.zombie;
    // Avant : un coup fait ses dégâts entiers
    let hp = z.hp;
    t.game.hitZombie(z, 100, false, z.pos, t.game.player.facing);
    expect(hp - z.hp).toBeCloseTo(100);
    z.hp = z.maxHp * G.phase2.below * 0.9;
    t.playUntil(() => boss.phase === 2, 4);
    expect(t.events('bossPhase').map((e) => e.phase)).toEqual([2]);
    hp = z.hp;
    t.game.hitZombie(z, 100, false, z.pos, t.game.player.facing);
    expect(hp - z.hp).toBeCloseTo(100 * (1 - G.phase2.armor));
    t.play(G.phase2.pause + 0.1);
    expect(boss.glow).toBeGreaterThan(0.9);
    // Le joueur reste tout près : trois fauchages d'affilée
    const before = t.events('gutsSweep').length;
    t.playUntil(() => t.events('gutsSweep').length >= before + G.phase2.sweeps, 6);
    expect(t.events('gutsSweep').length - before).toBeGreaterThanOrEqual(G.phase2.sweeps);
  });

  it('tué, il rapporte beaucoup d XP, un coffre légendaire gratuit et des TUNAS', () => {
    const { t, boss } = fight();
    t.game.cheats.god = true;
    t.game.hitZombie(boss.zombie, 1e6, false, boss.zombie.pos, t.game.player.facing);
    t.play(0.1);
    const e = t.events('bossKilled');
    expect(e.map((x) => x.boss.kind)).toEqual(['guts']);
    expect(e[0].chest?.rarity).toBe(G.chestRarity);
    expect(t.game.tunaDrops.drops.reduce((n, d) => n + d.value, 0)).toBeGreaterThanOrEqual(TUNAS.boss.guts);
    expect(t.game.bosses).toHaveLength(0);
  });
});
