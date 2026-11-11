import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LAST_CALL } from '../../src/config/lastCall';
import { PLANET_RADIUS } from '../../src/config/world';
import { bellDropChance } from '../../src/game/lastCall';
import { heightAt } from '../../src/world/terrain';
import { createTestGame } from '../support/testGame';

/** Une run au sol, calme : pas de zombies, Canette désarmée. */
function arena(opts: Parameters<typeof createTestGame>[1] = {}) {
  const t = createTestGame(1, opts);
  const spawn = t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  return { t, spawn };
}

const dist = (a: THREE.Vector3, b: THREE.Vector3) => a.angleTo(b) * PLANET_RADIUS;

/** Point au sol à `d` m du joueur, dans la direction `angle` (rad) autour de lui. */
function around(t: ReturnType<typeof createTestGame>, d: number, angle: number) {
  const p = t.game.player;
  const up = p.pos.clone().normalize();
  const side = new THREE.Vector3().crossVectors(p.facing, up).normalize();
  const dir = p.facing.clone().multiplyScalar(Math.cos(angle)).addScaledVector(side, Math.sin(angle));
  const axis = new THREE.Vector3().crossVectors(up, dir).normalize();
  const at = up.clone().applyAxisAngle(axis, d / PLANET_RADIUS);
  return at.multiplyScalar(PLANET_RADIUS + heightAt(at));
}

/** Sème de l'XP et des capsules loin du joueur, jusqu'à l'autre bout de la planète. */
function scatter(t: ReturnType<typeof createTestGame>) {
  const far = [30, 80, 200, 400, Math.PI * PLANET_RADIUS * 0.95];
  far.forEach((d, i) => {
    t.game.xp.drop(around(t, d, i * 1.3), 2);
    t.game.coinDrops.drop(around(t, d, i * 1.3 + 0.6), 1);
  });
  return { xp: far.length * 2, coins: far.length };
}

/** Le Buveur se poste à 1,8 m d'un point au sol, tourné vers lui. */
function standNear(t: ReturnType<typeof createTestGame>, at: THREE.Vector3) {
  const up = at.clone().normalize();
  const side = new THREE.Vector3(1, 0, 0).cross(up).normalize();
  t.game.player.reset(at.clone().addScaledVector(side, 1.8).normalize(), side.clone().negate());
  t.play(0.1);
}

const press = (t: ReturnType<typeof createTestGame>) => t.play(1 / 60, { action: true, actionPressed: true });

describe('Le dernier service', () => {
  it('une run pose quelques grandes cloches, loin du départ et loin les unes des autres', () => {
    const { t, spawn } = arena();
    const bells = t.game.lastCall.list;
    expect(bells).toHaveLength(LAST_CALL.count);
    for (const b of bells) {
      expect(b.rung).toBe(false);
      expect(dist(b.pos, spawn.dir)).toBeGreaterThan(LAST_CALL.minFromSpawn - 0.5);
      for (const o of bells) if (o !== b) expect(dist(b.pos, o.pos)).toBeGreaterThan(LAST_CALL.minSpacing - 0.5);
      for (const c of t.game.chests.list) expect(dist(b.pos, c.pos)).toBeGreaterThan(LAST_CALL.minFromChest - 0.5);
    }
  });

  it('sonner une cloche ramène toute l\'XP et toutes les capsules de la planète au Buveur', () => {
    const { t } = arena();
    const bell = t.game.lastCall.list[0];
    standNear(t, bell.pos);
    expect(t.game.lastCall.focus).toBe(bell);
    const sown = scatter(t);
    const coins0 = t.game.coins, xpBefore = t.events('xpCollected').length;
    press(t);
    expect(bell.rung).toBe(true);
    const e = t.events('lastCallRung');
    expect(e).toHaveLength(1);
    expect(e[0].source).toBe('bell');
    // Tout arrive en quelques secondes, même de l'autre bout de la planète
    expect(t.playUntil(() => { if (t.game.offer) t.game.pickCard(t.game.offer[0]); return t.game.xp.drops.length === 0 && t.game.coinDrops.drops.length === 0; }, 15)).toBe(true);
    expect(t.events('xpCollected').slice(xpBefore).reduce((s, e) => s + e.amount, 0)).toBeCloseTo(sown.xp * t.game.stats.xpGain);
    expect(t.game.coins - coins0).toBe(sown.coins);
  });

  it('les gouttes glissent le long du sol, sans traverser la planète', () => {
    const { t } = arena();
    const bell = t.game.lastCall.list[0];
    standNear(t, bell.pos);
    t.game.xp.drop(around(t, Math.PI * PLANET_RADIUS * 0.9, 0), 2);
    press(t);
    let lowest = Infinity;
    t.playUntil(() => {
      const d = t.game.xp.drops[0];
      if (d) lowest = Math.min(lowest, d.pos.length() - (PLANET_RADIUS + heightAt(d.pos.clone().normalize())));
      return t.game.xp.drops.length === 0;
    }, 15);
    expect(lowest).toBeGreaterThan(-0.5);
  });

  it('une cloche sonnée ne resonne pas, et les snacks restent où ils sont', () => {
    const { t } = arena();
    const bell = t.game.lastCall.list[0];
    standNear(t, bell.pos);
    t.game.snackDrops.drop(around(t, 60, 1), 1);
    press(t);
    t.play(0.5);
    press(t);
    expect(t.events('lastCallRung')).toHaveLength(1);
    expect(t.game.lastCall.focus).toBeNull();
    t.play(5);
    expect(t.game.snackDrops.drops).toHaveLength(1);
  });

  it('un ennemi tué lâche parfois une clochette : ramassée, elle fait la même chose', () => {
    const { t } = arena({ bellDrops: 'always' });
    const z = t.game.spawnZombie('zombie', t.inFront(2), t.game.player.facing.clone().negate())!;
    t.game.hitZombie(z, 999, false, z.pos, t.game.player.facing);
    expect(t.game.bellDrops.drops).toHaveLength(1);
    const sown = scatter(t);
    const coins0 = t.game.coins;
    expect(t.playUntil(() => t.events('lastCallRung').length > 0, 3)).toBe(true);
    expect(t.events('lastCallRung')[0].source).toBe('drop');
    // L'XP ramassée fait monter de niveau : on prend la première carte à chaque fois
    expect(t.playUntil(() => { if (t.game.offer) t.game.pickCard(t.game.offer[0]); return t.game.coinDrops.drops.length === 0; }, 15)).toBe(true);
    expect(t.game.coins - coins0).toBe(sown.coins);
  });

  it('la Chance rend la clochette plus fréquente', () => {
    expect(bellDropChance(0)).toBeCloseTo(LAST_CALL.dropChance);
    expect(bellDropChance(10)).toBeGreaterThan(bellDropChance(0));
  });
});
