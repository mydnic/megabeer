import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GRAVE_BOSSES as G, VADOR as V } from '../../src/config/bosses';
import { TUNAS } from '../../src/config/tunas';
import { PLANET_RADIUS } from '../../src/config/world';
import type { Vador } from '../../src/game/vador';
import { randomSpawn } from '../../src/world/decor/layout';
import { createTestGame } from '../support/testGame';

/** Hasard à graine fixe : même arrivée, mêmes placements à chaque passage. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seeded(9)); });
afterEach(() => { vi.restoreAllMocks(); });

const dist = (a: THREE.Vector3, b: THREE.Vector3) => a.angleTo(b) * PLANET_RADIUS;
type T = ReturnType<typeof createTestGame>;
const press = (t: T) => t.play(1 / 60, { action: true, actionPressed: true });

/** Une run calme (pas de zombies, Canette désarmée) ; Vador posé à `d` m devant le joueur, face à lui. */
function withVador(d = 4) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  const b = t.game.graveBosses.placeAt('vador', t.inFront(d));
  b.facing.copy(t.game.player.facing).negate();
  t.play(0.1);
  return { t, b };
}

/** Défie Vador (posé juste devant) et rend son contrôleur. */
function fight(d = 4) {
  const { t, b } = withVador(d);
  press(t);
  return { t, b, boss: t.game.bosses.find((x) => x.kind === 'vador') as Vador };
}

/** Un point au sol à `d` m d'un point, sur un grand cercle tiré d'une direction tangente. */
function around(at: THREE.Vector3, d: number, axis: THREE.Vector3) {
  return at.clone().normalize().applyAxisAngle(axis.clone().normalize(), d / PLANET_RADIUS);
}

describe('Dark Vador, boss optionnel d un cimetière', () => {
  it('il attend devant le portail d un cimetière loin du départ, dos au portail', () => {
    const t = createTestGame();
    const spawn = randomSpawn(() => true)!;
    const up = spawn.dir;
    const side = new THREE.Vector3().crossVectors(up, spawn.facing).normalize();
    const near = around(up, 20, side), far = around(up, 150, side);
    const out = spawn.facing.clone();
    t.game.startRun({ ...spawn, graveyards: [{ dir: near, out }, { dir: far, out }] });
    const [b] = t.game.graveBosses.list;
    expect(b.kind).toBe('vador');
    expect(b.waiting).toBe(true);
    expect(dist(b.pos, far)).toBeLessThan(G.searchRadius + 0.5);
    const bu = b.pos.clone().normalize();
    expect(b.facing.dot(out.clone().addScaledVector(bu, -out.dot(bu)).normalize())).toBeGreaterThan(0.99);
  });

  it('sans cimetière, il attend quand même, loin du départ', () => {
    const t = createTestGame();
    t.startRunAndLand();
    const [b] = t.game.graveBosses.list;
    expect(b?.kind).toBe('vador');
    expect(dist(b.pos, t.game.player.pos)).toBeGreaterThan(G.minFromSpawn - 5);
  });

  it('tant qu il attend, il ne se bat pas et les armes ne le visent pas', () => {
    const { t } = withVador();
    t.play(3);
    expect(t.game.bosses).toHaveLength(0);
    expect(t.game.horde.zombies.some((z) => z.def.name === V.name)).toBe(false);
  });

  it('à portée, la touche d action le défie : le combat commence, une seule fois', () => {
    const { t, b } = withVador();
    expect(t.game.graveBosses.focus).toBe(b);
    press(t);
    expect(t.game.bosses.map((x) => x.kind)).toEqual(['vador']);
    expect(b.waiting).toBe(false);
    expect(t.events('graveBossChallenged')).toHaveLength(1);
    expect(t.events('bossSpawned')).toHaveLength(1);
    press(t);
    expect(t.events('bossSpawned')).toHaveLength(1);
  });

  it('on le défie même si un autre boss est debout ; chacun tombe de son côté', () => {
    const { t, b } = withVador();
    t.game.cheats.god = true;
    t.game.spawnBoss();
    press(t);
    expect(b.waiting).toBe(false);
    expect(t.game.bosses.map((x) => x.kind).sort()).toEqual(['sonneur', 'vador']);
    // Le Sonneur tombe : Vador reste debout, seul
    const s = t.game.bosses.find((x) => x.kind === 'sonneur')!;
    t.game.hitZombie(s.zombie, 1e6, false, s.zombie.pos, t.game.player.facing);
    expect(t.game.bosses.map((x) => x.kind)).toEqual(['vador']);
  });

  it('défié avant 5:00, il n empêche pas le Sonneur de venir à son heure', () => {
    const { t } = fight();
    t.game.cheats.god = true;
    t.game.runTime = 299;
    t.play(1.5);
    expect(t.game.bosses.map((x) => x.kind).sort()).toEqual(['sonneur', 'vador']);
  });

  it('son coup de sabre est marqué au sol avant de partir : rester dedans fait mal', () => {
    const { t, boss } = fight(3);
    t.playUntil(() => !!boss.mark, 3);
    expect(t.events('playerHurt')).toHaveLength(0);
    const hp = t.game.health.hp;
    t.playUntil(() => t.events('saberStrike').length > 0, V.strike.windup + V.strike.duration + 0.5);
    expect(t.events('saberStrike')[0].hit).toBe(true);
    expect(t.game.health.hp).toBeLessThan(hp);
  });

  it('sortir de la zone marquée avant le coup l esquive', () => {
    const { t, boss } = fight(3);
    t.playUntil(() => !!boss.mark, 3);
    const m = boss.mark!;
    const p = t.game.player;
    const away = p.pos.clone().sub(m.at);
    t.game.player.reset(p.pos.clone().addScaledVector(away.normalize(), m.radius + 3).normalize(), p.facing.clone());
    const hp = t.game.health.hp;
    t.playUntil(() => t.events('saberStrike').length > 0, V.strike.windup + V.strike.duration + 0.5);
    expect(t.events('saberStrike')[0].hit).toBe(false);
    expect(t.game.health.hp).toBe(hp);
  });

  it('il marche vers le joueur resté loin', () => {
    const { t, boss } = fight(4);
    const p = t.game.player;
    p.reset(around(boss.zombie.pos, 20, new THREE.Vector3().crossVectors(boss.zombie.pos, p.facing)), p.facing.clone());
    const before = dist(boss.zombie.pos, p.pos);
    t.play(3);
    expect(dist(boss.zombie.pos, p.pos)).toBeLessThan(before - V.speed * 2);
  });

  it('tué, il rapporte beaucoup d XP, un coffre légendaire gratuit et des TUNAS', () => {
    const { t, boss } = fight();
    t.game.cheats.god = true;
    t.game.hitZombie(boss.zombie, 1e6, false, boss.zombie.pos, t.game.player.facing);
    t.play(0.1);
    const e = t.events('bossKilled');
    expect(e).toHaveLength(1);
    expect(e[0].chest?.rarity).toBe(V.chestRarity);
    expect(e[0].chest?.free).toBe(true);
    expect(t.game.tunaDrops.drops.reduce((n, d) => n + d.value, 0)).toBeGreaterThanOrEqual(TUNAS.boss.vador);
    expect(V.xp).toBeGreaterThan(100);
    expect(t.game.bosses).toHaveLength(0);
  });
});
