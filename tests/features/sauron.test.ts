import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAURON as S } from '../../src/config/bosses';
import { DOOM_MOUNTAIN as DM } from '../../src/config/doom';
import { TUNAS } from '../../src/config/tunas';
import { PLANET_RADIUS } from '../../src/config/world';
import type { Sauron } from '../../src/game/sauron';
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

/** Une run calme (arme désarmée), le joueur posé dans le cratère à `d` m du centre. */
function crater(d: number) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  const c = t.game.doom.dir;
  const axis = new THREE.Vector3().crossVectors(c, Math.abs(c.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
  const place = (m: number) => {
    const at = around(c, m, axis);
    t.game.player.reset(at, new THREE.Vector3().crossVectors(axis, at).normalize());
  };
  place(d);
  return { t, c, axis, place };
}

/** Sauron défié de 4 m ; puis le joueur placé à `d` m du centre du cratère. */
function fight(d = 4) {
  const { t, c, axis, place } = crater(4);
  t.play(0.1);
  press(t);
  const boss = t.game.bosses.find((x) => x.kind === 'sauron') as Sauron;
  if (d !== 4) place(d);
  t.play(0.05);
  return { t, boss, c, axis };
}

describe('Sauron, au fond du cratère de la Montagne du Destin', () => {
  it('à chaque run, il attend au fond du cratère, derrière l anneau de lave', () => {
    const { t, c } = crater(4);
    const b = t.game.graveBosses.list.find((x) => x.kind === 'sauron')!;
    expect(b).toBeDefined();
    expect(b.waiting).toBe(true);
    expect(dist(b.pos, c)).toBeLessThan(DM.lava.inner - 2);
  });

  it('à portée, la touche d action le défie', () => {
    const { t, boss } = fight();
    expect(boss).toBeDefined();
    expect(t.events('graveBossChallenged').map((e) => e.boss.kind)).toEqual(['sauron']);
  });

  it('de près, il balaie : l arc est marqué d abord, puis le joueur dedans encaisse et part au loin', () => {
    const { t, boss } = fight(3);
    t.playUntil(() => !!boss.arc, 4);
    expect(boss.arc).not.toBeNull();
    expect(t.events('playerHurt')).toHaveLength(0);
    t.playUntil(() => t.events('sauronSweep').length > 0, S.sweep.windup + S.sweep.duration + 0.5);
    expect(t.events('sauronSweep')[0].hit).toBe(true);
    expect(t.events('playerHurt').length).toBeGreaterThan(0);
    const before = dist(t.game.player.pos, boss.zombie.pos);
    t.play(0.8);
    expect(dist(t.game.player.pos, boss.zombie.pos)).toBeGreaterThan(before + 4);
  });

  it('reculer hors de l arc avant le coup l évite', () => {
    const { t, boss } = fight(3);
    t.playUntil(() => !!boss.arc && boss.arc.t > S.sweep.track + 0.05, 4);
    const a = boss.arc!;
    const p = t.game.player;
    // Derrière lui : hors de l'arc, même tout près
    p.reset(around(a.at, 2.5, new THREE.Vector3().crossVectors(a.at, a.dir).negate()), p.facing.clone());
    t.playUntil(() => t.events('sauronSweep').length > 0, S.sweep.windup + S.sweep.duration + 0.5);
    expect(t.events('sauronSweep')[0].hit).toBe(false);
    expect(t.events('playerHurt')).toHaveLength(0);
  });

  it('de plus loin, il abat sa masse : le point d impact est marqué, puis le joueur dessous encaisse', () => {
    const { t, boss } = fight(16);
    t.playUntil(() => !!boss.impact && boss.impact.t > S.slam.track + 0.05, 8);
    const m = boss.impact!;
    expect(t.events('playerHurt')).toHaveLength(0);
    // Le joueur se jette sous la masse
    t.game.player.reset(m.at.clone().normalize(), t.game.player.facing.clone());
    t.playUntil(() => t.events('sauronSlam').length > 0, S.slam.windup + S.slam.duration);
    expect(t.events('sauronSlam')[0].hit).toBe(true);
    expect(t.events('playerHurt').length).toBeGreaterThan(0);
  });

  it('une onde part du point d impact : elle blesse le joueur resté au sol', () => {
    const { t } = fight(16);
    t.game.cheats.god = false;
    expect(t.playUntil(() => t.events('sauronWave').length > 0, 10)).toBe(true);
    expect(t.events('sauronSlam')[0].hit).toBe(false);
    expect(t.events('sauronWave')[0].at.distanceTo(t.events('sauronSlam')[0].at)).toBeLessThan(0.1);
    expect(t.playUntil(() => t.events('playerHurt').some((e) => !e.blocked), 3)).toBe(true);
    expect(t.events('playerHurt').find((e) => !e.blocked)!.damage).toBeCloseTo(S.wave.damage * t.game.mods.damage);
  });

  it('on évite l onde en sautant au bon moment', () => {
    const { t } = fight(16);
    expect(t.playUntil(() => t.events('sauronWave').length > 0, 10)).toBe(true);
    const w = t.events('sauronWave')[0];
    const d = dist(w.at, t.game.player.pos);
    t.play(Math.max(0, (d - S.wave.width) / S.wave.speed - 0.05));
    t.play(1 / 60, { jump: true, jumpPressed: true });
    t.play(0.5, { jump: true });
    expect(t.events('playerHurt').filter((e) => !e.blocked)).toHaveLength(0);
  });

  it('il ne quitte pas le cratère, même quand le joueur s en va', () => {
    const { t, boss, c } = fight(18);
    t.game.cheats.god = true;
    for (let i = 0; i < 40; i++) {
      t.play(0.25);
      // Jamais jusqu'à la lave
      expect(dist(boss.zombie.pos, c)).toBeLessThan(DM.lava.inner - 1);
    }
  });

  it('l Oeil (phase 2) : il lève le bras, l Oeil s allume et son regard traque le joueur et le brûle', () => {
    const { t, boss } = fight(16);
    t.game.cheats.god = true;
    const z = boss.zombie;
    z.hp = z.maxHp * S.phase2.below * 0.9;
    t.playUntil(() => boss.phase === 2, 6);
    expect(t.events('bossPhase').map((e) => e.phase)).toEqual([2]);
    expect(boss.gaze).toBeNull();
    t.playUntil(() => !!boss.gaze, S.phase2.pause + S.slam.duration + 1);
    const g = boss.gaze!;
    const start = dist(g.at, t.game.player.pos);
    t.play(1);
    expect(dist(g.at, t.game.player.pos)).toBeLessThan(start - S.phase2.eye.speed * 0.8);
    // Le joueur reste planté là : le regard l'atteint et le brûle
    t.game.cheats.god = false;
    t.game.player.reset(t.game.player.pos.clone().normalize(), t.game.player.facing.clone());
    expect(t.playUntil(() => t.events('sauronGaze').length > 0, start / S.phase2.eye.speed + 2)).toBe(true);
  });

  it('tué, il rapporte beaucoup d XP, un coffre légendaire gratuit et des TUNAS', () => {
    const { t, boss } = fight();
    t.game.cheats.god = true;
    t.game.hitZombie(boss.zombie, 1e6, false, boss.zombie.pos, t.game.player.facing);
    t.play(0.1);
    const e = t.events('bossKilled');
    expect(e.map((x) => x.boss.kind)).toEqual(['sauron']);
    expect(e[0].chest?.rarity).toBe(S.chestRarity);
    expect(t.game.tunaDrops.drops.reduce((n, d) => n + d.value, 0)).toBeGreaterThanOrEqual(TUNAS.boss.sauron);
    expect(t.game.bosses).toHaveLength(0);
  });
});
