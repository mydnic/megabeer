import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BINS, SNACK } from '../../src/config/bins';
import { CHEST_TRAP, CHESTS } from '../../src/config/chests';
import { PLANET_RADIUS } from '../../src/config/world';
import { heightAt } from '../../src/world/terrain';
import { createTestGame } from '../support/testGame';

/**
 * Une run au sol, calme, avec les poubelles : pas de zombies, Canette désarmée. `random` décide du
 * butin (0 : XP, 0,7 : capsules, 0,99 : snack, avec les poids de la config).
 */
function arena(random?: () => number) {
  const t = createTestGame(1, { bins: true, random });
  const spawn = t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  return { t, spawn };
}

const dist = (a: THREE.Vector3, b: THREE.Vector3) => a.angleTo(b) * PLANET_RADIUS;

/** Point au sol à `d` m de `from`, dans la direction tangente `dir`. */
function ground(from: THREE.Vector3, dir: THREE.Vector3, d: number) {
  const p = from.clone().normalize().multiplyScalar(PLANET_RADIUS).addScaledVector(dir, d).normalize();
  return p.multiplyScalar(PLANET_RADIUS + heightAt(p));
}

/** Pose le Buveur à `d` m de `at` (au sol), tourné vers lui ; renvoie la direction de `at` vers le joueur. */
function standAt(t: ReturnType<typeof createTestGame>, at: THREE.Vector3, d: number) {
  const up = at.clone().normalize();
  const side = new THREE.Vector3(1, 0, 0).cross(up).normalize();
  t.game.player.reset(ground(at, side, d).normalize(), side.clone().negate());
  return side;
}

/** Le Buveur arrive au contact de la poubelle (posé tout près, il avance : rien entre eux). */
function runInto(t: ReturnType<typeof createTestGame>, bin: { pos: THREE.Vector3; broken: boolean }) {
  standAt(t, bin.pos, 1.3);
  return t.playUntil(() => bin.broken, 3, { moveY: 1 });
}

describe('Les poubelles', () => {
  it('une run en pose sur la planète, loin du départ, espacées, à l\'écart des coffres et des pompes', () => {
    const { t, spawn } = arena();
    const bins = t.game.bins.list;
    expect(bins.length).toBeGreaterThanOrEqual(BINS.count * 0.9);
    for (const b of bins) {
      expect(b.broken).toBe(false);
      expect(dist(b.pos, spawn.dir)).toBeGreaterThan(BINS.minFromSpawn - 0.5);
      for (const c of t.game.chests.list) expect(dist(b.pos, c.pos)).toBeGreaterThan(BINS.minFromChest - 0.5);
      for (const p of t.game.pumps.list) expect(dist(b.pos, p.pos)).toBeGreaterThan(BINS.minFromPump - 0.5);
    }
    for (let i = 0; i < 30; i++) for (let j = i + 1; j < bins.length; j++) {
      expect(dist(bins[i].pos, bins[j].pos)).toBeGreaterThan(BINS.minSpacing - 0.5);
    }
  });

  it('le Buveur qui fonce dedans la casse : elle lâche des gouttes d\'XP', () => {
    const { t } = arena(() => 0);
    const bin = t.game.bins.list[0];
    expect(runInto(t, bin)).toBe(true);
    const e = t.events('binBroken');
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ bin, by: 'player', loot: 'xp' });
    expect(t.game.xp.drops).toHaveLength(BINS.xp.drops);
    expect(t.game.xp.drops.reduce((s, d) => s + d.value, 0)).toBe(BINS.xp.drops * BINS.xp.value);
  });

  it('parfois elle lâche des capsules', () => {
    const { t } = arena(() => 0.7);
    const bin = t.game.bins.list[0];
    runInto(t, bin);
    expect(t.events('binBroken')[0].loot).toBe('coins');
    // Ramassées en restant là (certaines le sont dès leur chute, sous les pieds du Buveur)
    t.play(2);
    expect(t.game.coinDrops.drops).toHaveLength(0);
    expect(t.game.coins).toBeGreaterThanOrEqual(BINS.coins.min);
    expect(t.game.coins).toBeLessThanOrEqual(BINS.coins.max);
  });

  it('rarement un cornet de frites, qui soigne quand on le ramasse', () => {
    const { t } = arena(() => 0.99);
    const bin = t.game.bins.list[0];
    t.game.health.hp = 50;
    runInto(t, bin);
    expect(t.events('binBroken')[0].loot).toBe('snack');
    expect(t.playUntil(() => t.events('snackEaten').length > 0, 3)).toBe(true);
    expect(t.game.health.hp).toBe(50 + SNACK.heal);
    expect(t.events('snackEaten')[0].heal).toBe(SNACK.heal);
  });

  it('une poubelle cassée ne se recasse pas', () => {
    const { t } = arena(() => 0);
    const bin = t.game.bins.list[0];
    runInto(t, bin);
    t.play(1, { moveY: 1 });
    standAt(t, bin.pos, 3);
    t.play(2, { moveY: 1 });
    expect(t.events('binBroken').filter((e) => e.bin === bin)).toHaveLength(1);
  });

  it('une arme la casse : le Fût qui roule passe dessus en allant vers un zombie', () => {
    const { t } = arena(() => 0);
    const fut = t.game.equip('fut')!;
    // Le joueur, une poubelle à 3 m devant lui, un zombie 3 m plus loin dans la même ligne
    const p = t.game.player;
    const bin = t.game.bins.add(t.inFront(3));
    t.game.spawnZombie('zombie', t.inFront(6), p.facing.clone().negate());
    expect(t.playUntil(() => bin.broken, 5)).toBe(true);
    const e = t.events('binBroken').find((x) => x.bin === bin)!;
    expect(e.by).toBe('weapon');
    expect(fut.projectiles.some((x) => x.active) || t.events('zombieHit').some((h) => h.weapon === fut)).toBe(true);
  });

  it('une explosion d\'arme la casse (Gueuze)', () => {
    const { t } = arena(() => 0);
    const gueuze = t.game.equip('gueuze')!;
    const p = t.game.player;
    const bin = t.game.bins.add(t.inFront(6));
    // Zombie figé juste à côté de la poubelle : la grenade explose sur lui
    t.game.spawnZombie('zombie', t.inFront(6, 0.6), p.facing.clone().negate())!.frozen = 100;
    expect(t.playUntil(() => bin.broken, 6)).toBe(true);
    expect(t.events('weaponExploded').some((e) => e.weapon === gueuze)).toBe(true);
    expect(t.events('binBroken')[0].by).toBe('weapon');
  });
});

describe('Le coffre piégé', () => {
  /** Une run où tous les coffres posés sont piégés. */
  function trapArena() {
    const t = createTestGame(1, { traps: 'always' });
    t.startRunAndLand();
    t.noSpawns();
    t.game.loadout.weapons[0].mods.range = 0;
    return t;
  }

  it('payé, il explose : le joueur proche encaisse, des ennemis sortent, pas d\'objet, capsules perdues', () => {
    const t = trapArena();
    const chest = t.game.chests.list[0];
    expect(chest.trapped).toBe(true);
    t.game.coins = CHESTS.basePrice + 2;
    standAt(t, chest.pos, 1.8);
    t.play(0.1);
    const hp = t.game.health.hp;
    t.play(1 / 60, { action: true, actionPressed: true });
    expect(chest.opened).toBe(true);
    expect(t.game.coins).toBe(2);
    const e = t.events('chestTrapped');
    expect(e).toHaveLength(1);
    expect(e[0].hit).toBe(true);
    expect(t.game.health.hp).toBeCloseTo(hp - CHEST_TRAP.damage * t.game.mods.damage);
    expect(e[0].zombies).toHaveLength(CHEST_TRAP.count);
    expect(t.game.horde.zombies.filter((z) => !z.dead)).toHaveLength(CHEST_TRAP.count);
    // Pas de lootbox ni de choix d'objet, le jeu n'est pas figé
    expect(t.events('chestRevealing')).toHaveLength(0);
    expect(t.game.offer).toBeNull();
    expect(t.game.frozen).toBe(false);
  });

  it('un coffre gratuit (Bonnet du Père Noël) n\'est jamais piégé', () => {
    const t = trapArena();
    const chest = t.game.chests.addFree(t.game.player.pos, t.game.player.facing, 4)!;
    expect(chest.trapped).toBeFalsy();
  });

  it('sans piège forcé, les coffres piégés restent rares', () => {
    const t = createTestGame(1, { traps: 'real' });
    t.startRunAndLand();
    const list = t.game.chests.list;
    const share = list.filter((c) => c.trapped).length / list.length;
    expect(share).toBeLessThan(0.25);
  });
});

