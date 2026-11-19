import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAIYAN } from '../../src/config/saiyan';
import { ITEMS } from '../../src/config/items';
import { rollItemCards } from '../../src/game/chests';
import { emptyProfile, recordRun } from '../../src/meta/profile';
import { achievementFor, runUnlocks } from '../../src/meta/shop';
import { createTestGame } from '../support/testGame';

/** Hasard à graine fixe : même point d'arrivée et mêmes coups à chaque passage. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seeded(7)); });
afterEach(() => { vi.restoreAllMocks(); });

const F = { transformPressed: true, transform: true };

/** Une run calme, arme désarmée ; avec l'objet Sang Saiyan si `blood`. */
function arena(blood = true) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  if (blood) t.game.gainItem('sangSaiyan');
  return t;
}
/** Tue d'un coup un zombie posé devant (élite si `elite`). */
function kill(t: ReturnType<typeof arena>, elite = false) {
  const z = elite ? t.game.spawnElite('zombie', t.inFront(6), t.game.player.facing)! : t.game.spawnZombie('zombie', t.inFront(6), t.game.player.facing)!;
  t.game.hitZombie(z, 1e6, false, z.pos, new THREE.Vector3(), null, 0);
}
/** Jauge remplie jusqu'au palier `tier`, puis transformation. */
function transformed(tier: number) {
  const t = arena();
  t.game.saiyan.points = SAIYAN.thresholds[tier - 1];
  t.play(1 / 60, F);
  expect(t.game.saiyan.tier).toBe(tier);
  return t;
}

describe('Le Super Saiyan', () => {
  it('sans le Sang Saiyan, pas de jauge ni de transformation', () => {
    const t = arena(false);
    for (let i = 0; i < 5; i++) kill(t);
    expect(t.game.saiyan.points).toBe(0);
    t.game.saiyan.points = SAIYAN.thresholds[0];
    t.play(0.1, F);
    expect(t.events('saiyanTransformed')).toHaveLength(0);
  });

  it('la jauge se remplit en tuant (un élite vaut plus) et en prenant des coups', () => {
    const t = arena();
    kill(t);
    expect(t.game.saiyan.points).toBe(SAIYAN.points.kill);
    kill(t, true);
    expect(t.game.saiyan.points).toBe(SAIYAN.points.kill + SAIYAN.points.elite);
    const before = t.game.saiyan.points, hp = t.game.health.hp;
    const z = t.game.spawnZombie('zombie', t.inFront(1.2), t.game.player.facing.clone().negate())!;
    z.hp = 1e6;
    t.playUntil(() => t.game.health.hp < hp, 10);
    expect(t.game.saiyan.points - before).toBeCloseTo((hp - t.game.health.hp) * SAIYAN.points.perHpLost, 3);
  });

  it('chaque palier atteint est annoncé, et la transformation prend le plus haut', () => {
    const t = arena();
    t.game.saiyan.points = SAIYAN.thresholds[0] - 1;
    kill(t);
    expect(t.events('saiyanTierReached').map((e) => e.tier)).toEqual([1]);
    t.game.saiyan.points = SAIYAN.thresholds[2] - 1;
    kill(t);
    expect(t.events('saiyanTierReached').at(-1)?.tier).toBe(3);
    t.play(1 / 60, F);
    expect(t.events('saiyanTransformed')[0]).toMatchObject({ tier: 3, name: SAIYAN.tiers[2].name, duration: SAIYAN.duration });
  });

  it('transformé : les bonus du palier pendant la durée, puis retirés, et la jauge retombe à 0', () => {
    const t = arena();
    const dmg = t.game.stats.damage, rate = t.game.stats.attackSpeed;
    t.game.saiyan.points = SAIYAN.thresholds[1];
    t.play(1 / 60, F);
    const T = SAIYAN.tiers[1];
    expect(t.game.stats.damage).toBeCloseTo(dmg + T.stats.damage!);
    expect(t.game.stats.attackSpeed).toBeCloseTo(rate + T.stats.attackSpeed!);
    // Pendant la transformation, la jauge ne se remplit pas
    kill(t);
    expect(t.game.saiyan.points).toBe(SAIYAN.thresholds[1]);
    t.play(SAIYAN.duration + 0.2);
    expect(t.events('saiyanEnded')).toHaveLength(1);
    expect(t.game.saiyan.tier).toBe(0);
    expect(t.game.saiyan.points).toBe(0);
    expect(t.game.stats.damage).toBeCloseTo(dmg);
    expect(t.game.stats.attackSpeed).toBeCloseTo(rate);
  });

  it('sans palier atteint, la touche ne fait rien', () => {
    const t = arena();
    t.play(0.1, F);
    expect(t.events('saiyanTransformed')).toHaveLength(0);
  });

  it('Kaioken brûle les PV, mais ne tue jamais', () => {
    const t = transformed(1);
    t.game.health.hp = 3;
    t.play(10);
    expect(t.game.health.hp).toBe(1);
    expect(t.game.health.dead).toBe(false);
  });

  it('Super Saiyan 2 : des éclairs frappent l ennemi le plus proche', () => {
    const t = transformed(3);
    const L = SAIYAN.tiers[2].lightning!;
    const z = t.game.spawnZombie('zombie', t.inFront(L.range * 0.5), t.game.player.facing)!;
    z.hp = 1e6; z.frozen = 1e6;
    t.play(L.every * 4 + 0.05);
    expect(t.events('saiyanLightning').length).toBeGreaterThanOrEqual(4);
    expect(t.events('zombieHit').some((e) => e.zombie === z && e.weapon === null)).toBe(true);
  });

  it('Ultra Instinct esquive tous les coups (sauf ceux des boss)', () => {
    const t = transformed(6);
    const hp = t.game.health.hp;
    const z = t.game.spawnZombie('zombie', t.inFront(1.2), t.game.player.facing.clone().negate())!;
    z.hp = 1e6;
    t.playUntil(() => t.events('playerDodged').length >= 2, 10);
    expect(t.events('playerDodged').length).toBeGreaterThanOrEqual(2);
    expect(t.game.health.hp).toBe(hp);
  });

  it('le Sang Saiyan est unique (il ne ressort plus des coffres une fois pris) et Légendaire', () => {
    expect(ITEMS.sangSaiyan.rarity).toBe(4);
    for (let i = 0; i < 20; i++) {
      expect(rollItemCards(4, 20, undefined, new Set(['sangSaiyan'])).some((c) => c.item === 'sangSaiyan')).toBe(false);
    }
    expect(rollItemCards(4, 20).some((c) => c.item === 'sangSaiyan')).toBe(true);
  });

  it('il ne s achète pas : le succès « Tenir l alcool » le débloque, puis il peut sortir des coffres', () => {
    const key = 'item:sangSaiyan';
    const a = achievementFor(key)!;
    expect(a.id).toBe('tenirAlcool');
    const p = { ...emptyProfile(), tunas: 10_000 };
    expect(runUnlocks(p).items.has('sangSaiyan')).toBe(false);
    const q = recordRun(p, { survived: 300, kills: 0, tunas: 0, achievements: [a.id] }, 2);
    expect(runUnlocks(q).items.has('sangSaiyan')).toBe(true);
  });
});
