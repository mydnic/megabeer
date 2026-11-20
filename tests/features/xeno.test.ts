import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GRAVE_BOSSES as G, XENO as X } from '../../src/config/bosses';
import { TUNAS } from '../../src/config/tunas';
import { PLANET_RADIUS } from '../../src/config/world';
import type { Xeno } from '../../src/game/xeno';
import { randomSpawn } from '../../src/world/decor/layout';
import { createTestGame } from '../support/testGame';

/** Hasard à graine fixe : même arrivée à chaque passage. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seeded(11)); });
afterEach(() => { vi.restoreAllMocks(); });

const dist = (a: THREE.Vector3, b: THREE.Vector3) => a.angleTo(b) * PLANET_RADIUS;
type T = ReturnType<typeof createTestGame>;
const press = (t: T) => t.play(1 / 60, { action: true, actionPressed: true });
/** Le point `at` déplacé de `d` m autour de l'axe tangent `axis`. */
const around = (at: THREE.Vector3, d: number, axis: THREE.Vector3) => at.clone().normalize().applyAxisAngle(axis.clone().normalize(), d / PLANET_RADIUS);

/** Le Xénomorphe défié, posé à 4 m devant le joueur (run calme, arme désarmée) ; puis le joueur placé à `d` m de lui. */
function fight(d = 4) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  const b = t.game.graveBosses.placeAt('xeno', t.inFront(4));
  b.facing.copy(t.game.player.facing).negate();
  t.play(0.1);
  press(t);
  const boss = t.game.bosses.find((x) => x.kind === 'xeno') as Xeno;
  const z = boss.zombie, p = t.game.player;
  if (d !== 4) p.reset(around(z.pos, d, new THREE.Vector3().crossVectors(z.pos, z.facing)), p.facing.clone());
  t.play(0.05);
  return { t, boss };
}

describe('Le Xénomorphe, boss optionnel d un cimetière', () => {
  it('il attend devant un cimetière à lui, loin du départ, comme les autres boss optionnels', () => {
    const t = createTestGame();
    const spawn = randomSpawn(() => true)!;
    const side = new THREE.Vector3().crossVectors(spawn.dir, spawn.facing).normalize();
    const graves = [100, 140, 180, 220].map((d) => ({ dir: around(spawn.dir, d, side), out: spawn.facing.clone() }));
    t.game.startRun({ ...spawn, graveyards: graves });
    const list = t.game.graveBosses.list;
    expect(list.map((b) => b.kind).sort()).toEqual([...G.kinds].sort());
    const xeno = list.find((b) => b.kind === 'xeno')!;
    for (const o of list) if (o !== xeno) expect(dist(o.pos, xeno.pos)).toBeGreaterThan(20);
  });

  it('à portée, la touche d action le défie', () => {
    const { t, boss } = fight();
    expect(boss).toBeDefined();
    expect(t.events('graveBossChallenged').map((e) => e.boss.kind)).toEqual(['xeno']);
  });

  it('de loin, il bondit : le point de chute est marqué d abord, puis il retombe sur le joueur resté dessous', () => {
    const { t, boss } = fight(14);
    t.playUntil(() => !!boss.mark, 4);
    expect(boss.mark).not.toBeNull();
    expect(t.events('playerHurt')).toHaveLength(0);
    let high = 0;
    t.playUntil(() => { high = Math.max(high, boss.air); return t.events('xenoLand').length > 0; }, X.pounce.windup + X.pounce.flight + 1);
    expect(t.events('xenoLeap')).toHaveLength(1);
    expect(high).toBeGreaterThan(X.pounce.arc * 0.5);
    expect(t.events('xenoLand')[0].hit).toBe(true);
    expect(t.events('playerHurt').length).toBeGreaterThan(0);
    expect(dist(boss.zombie.pos, t.game.player.pos)).toBeLessThan(X.pounce.radius);
  });

  it('sortir du cercle une fois figé évite le bond', () => {
    const { t, boss } = fight(14);
    t.playUntil(() => !!boss.mark && boss.mark.t > X.pounce.track + 0.05, 4);
    const at = boss.mark!.at.clone();
    const p = t.game.player;
    p.reset(around(at, X.pounce.radius + 3, new THREE.Vector3().crossVectors(at, boss.zombie.pos)), p.facing.clone());
    t.playUntil(() => t.events('xenoLand').length > 0, X.pounce.windup + X.pounce.flight + 1);
    expect(t.events('xenoLand')[0].hit).toBe(false);
    expect(t.events('playerHurt')).toHaveLength(0);
    // Il retombe là où c'était marqué, pas sur le joueur
    expect(dist(boss.zombie.pos, at)).toBeLessThan(1);
  });

  it('de près, il pique de la queue : la bande est marquée, puis le joueur dedans encaisse', () => {
    const { t, boss } = fight(5);
    t.playUntil(() => !!boss.lane, 4);
    expect(boss.lane).not.toBeNull();
    expect(t.events('playerHurt')).toHaveLength(0);
    t.playUntil(() => t.events('xenoTail').length > 0, X.tail.windup + X.tail.duration + 0.5);
    expect(t.events('xenoTail')[0].hit).toBe(true);
    expect(t.events('playerHurt').length).toBeGreaterThan(0);
  });

  it('s écarter de la bande avant la piqûre l évite', () => {
    const { t, boss } = fight(5);
    t.playUntil(() => !!boss.lane && boss.lane.t > X.tail.track + 0.05, 4);
    const l = boss.lane!;
    const p = t.game.player;
    // Un pas de côté (perpendiculaire à la bande)
    p.reset(around(p.pos, l.width + 3, l.dir), p.facing.clone());
    t.playUntil(() => t.events('xenoTail').length > 0, X.tail.windup + X.tail.duration + 0.5);
    expect(t.events('xenoTail')[0].hit).toBe(false);
    expect(t.events('playerHurt')).toHaveLength(0);
  });

  it('phase 2 : il hurle, enchaîne deux bonds et laisse des flaques d acide qui rongent le joueur', () => {
    const { t, boss } = fight(14);
    t.game.cheats.god = true;
    boss.zombie.hp = boss.zombie.maxHp * X.phase2.below * 0.9;
    t.play(0.05);
    expect(boss.phase).toBe(2);
    expect(t.events('bossPhase').map((e) => e.phase)).toEqual([2]);
    t.play(X.phase2.pause + 0.1);
    const p = t.game.player;
    p.reset(around(boss.zombie.pos, 14, new THREE.Vector3().crossVectors(boss.zombie.pos, boss.zombie.facing)), p.facing.clone());
    t.playUntil(() => t.events('xenoLand').length >= 2, 8);
    expect(t.events('xenoLand').length).toBeGreaterThanOrEqual(2);
    expect(boss.pools.length).toBeGreaterThanOrEqual(2);
    // Debout dans une flaque, le joueur encaisse à chaque morsure de l'acide
    const pool = boss.pools[0];
    p.reset(pool.at.clone().normalize(), p.facing.clone());
    const before = t.events('playerHurt').length;
    t.play(X.phase2.acid.tick * 2.5);
    expect(t.events('playerHurt').length).toBeGreaterThan(before);
  });

  it('les flaques sèchent', () => {
    const { t, boss } = fight(14);
    boss.zombie.hp = boss.zombie.maxHp * X.phase2.below * 0.9;
    t.game.cheats.god = true;
    t.playUntil(() => boss.pools.length > 0, 10);
    expect(boss.pools.length).toBeGreaterThan(0);
    const first = boss.pools[0];
    t.play(X.phase2.acid.life + 0.2);
    expect(boss.pools).not.toContain(first);
  });

  it('tué, il rapporte beaucoup d XP, un coffre légendaire gratuit et des TUNAS', () => {
    const { t, boss } = fight();
    t.game.cheats.god = true;
    t.game.hitZombie(boss.zombie, 1e6, false, boss.zombie.pos, t.game.player.facing);
    t.play(0.1);
    const e = t.events('bossKilled');
    expect(e.map((x) => x.boss.kind)).toEqual(['xeno']);
    expect(e[0].chest?.rarity).toBe(X.chestRarity);
    expect(t.game.tunaDrops.drops.reduce((n, d) => n + d.value, 0)).toBeGreaterThanOrEqual(TUNAS.boss.xeno);
    expect(t.game.bosses).toHaveLength(0);
  });
});
