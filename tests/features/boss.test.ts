import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FRERE_SONNEUR as F } from '../../src/config/bosses';
import { RARITIES } from '../../src/config/upgrades';
import { PLANET_RADIUS } from '../../src/config/world';
import { createTestGame } from '../support/testGame';

/** Hasard à graine fixe : même planète, même départ, mêmes placements à chaque passage (combat reproductible). */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seeded(7)); });
afterEach(() => { vi.restoreAllMocks(); });

/** Une run au sol, calme : pas de zombies, Canette désarmée, rien d'autre sur la planète (la cloche roule librement). */
function arena() {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  t.game.chests.clear();
  t.game.pumps.clear();
  t.game.lastCall.clear();
  return t;
}

const dist = (a: { pos: import('three').Vector3 }, b: import('three').Vector3) => a.pos.angleTo(b) * PLANET_RADIUS;

describe('Le Frère Sonneur', () => {
  it('arrive tout seul à son heure, une seule fois', () => {
    const t = arena();
    t.game.cheats.god = true;
    t.game.runTime = F.arriveAt - 1;
    t.play(1.5);
    expect(t.events('bossSpawned')).toHaveLength(1);
    const boss = t.game.boss!;
    expect(boss.zombie.hp).toBe(Math.round(F.hp * t.game.mods.hp));
    expect(dist(boss.zombie, t.game.player.pos)).toBeGreaterThan(F.spawnDist - 3);
    t.play(5);
    expect(t.events('bossSpawned')).toHaveLength(1);
  });

  it('arrive avec sa cloche géante posée entre lui et le joueur', () => {
    const t = arena();
    t.game.cheats.god = true;
    const boss = t.game.spawnBoss()!;
    const p = t.game.player.pos;
    expect(dist(boss.bell, p)).toBeLessThan(dist(boss.zombie, p));
    expect(dist(boss.bell, boss.zombie.pos)).toBeCloseTo(F.bell.standOff, 0);
  });

  it('il sonne sa cloche : chaque coup lance une onde depuis la cloche, elle blesse le joueur resté au sol', () => {
    const t = arena();
    const boss = t.game.spawnBoss(t.inFront(11))!;
    expect(t.playUntil(() => t.events('bossWave').length > 0, 4)).toBe(true);
    expect(t.events('bossWave')[0].at.distanceTo(boss.bell.pos)).toBeLessThan(0.1);
    expect(t.playUntil(() => t.events('playerHurt').some((e) => !e.blocked), 3)).toBe(true);
    expect(t.events('playerHurt').find((e) => !e.blocked)!.damage).toBeCloseTo(F.wave.damage * t.game.mods.damage);
  });

  it("on évite l'onde en sautant au bon moment", () => {
    const t = arena();
    t.game.spawnBoss(t.inFront(11));
    expect(t.playUntil(() => t.events('bossWave').length > 0, 4)).toBe(true);
    const w = t.events('bossWave')[0];
    const d = w.at.angleTo(t.game.player.pos) * PLANET_RADIUS;
    t.play(Math.max(0, (d - F.wave.width) / F.wave.speed - 0.05));
    t.play(1 / 60, { jump: true, jumpPressed: true });
    t.play(0.5, { jump: true });
    expect(t.events('playerHurt').filter((e) => !e.blocked)).toHaveLength(0);
  });

  it('après ses coups de cloche, il la pousse : elle roule vers le joueur et le renverse', () => {
    const t = arena();
    const boss = t.game.spawnBoss(t.inFront(11))!;
    expect(t.playUntil(() => t.events('bossBellPush').length > 0, 10)).toBe(true);
    expect(t.events('bossWave')).toHaveLength(F.strike.rings);
    const before = dist(boss.bell, t.game.player.pos);
    t.game.health.invuln = 0;
    const hurt = t.events('playerHurt').length;
    expect(t.playUntil(() => t.events('playerHurt').slice(hurt).some((e) => e.damage === F.bell.damage * t.game.mods.damage && !e.blocked), 3)).toBe(true);
    expect(dist(boss.bell, t.game.player.pos)).toBeLessThan(before);
  });

  it("la cloche s'arrête au bout de sa course ; il retourne la chercher et la resonne là où elle est", () => {
    const t = arena();
    t.game.cheats.god = true;
    const boss = t.game.spawnBoss(t.inFront(11))!;
    expect(t.playUntil(() => t.events('bossBellStop').length > 0, 12)).toBe(true);
    expect(boss.bell.rolling).toBe(false);
    const stoppedAt = boss.bell.pos.clone();
    expect(t.playUntil(() => t.events('bossWave').length > F.strike.rings, 20)).toBe(true);
    expect(t.events('bossWave').at(-1)!.at.distanceTo(stoppedAt)).toBeLessThan(0.1);
    expect(dist(boss.zombie, stoppedAt)).toBeLessThan(F.bell.standOff + F.bell.arrive + 0.5);
  });

  it('sous la moitié de ses PV, il rugit et passe en phase 2', () => {
    const t = arena();
    t.game.cheats.god = true;
    const boss = t.game.spawnBoss()!;
    t.game.hitZombie(boss.zombie, boss.zombie.hp * 0.55, false, boss.zombie.pos, t.game.player.facing, t.game.loadout.weapons[0]);
    t.play(0.1);
    expect(boss.phase).toBe(2);
    expect(t.events('bossPhase')).toHaveLength(1);
  });

  it('tué, il laisse un coffre légendaire gratuit', () => {
    const t = arena();
    t.game.cheats.god = true;
    const boss = t.game.spawnBoss()!;
    t.game.hitZombie(boss.zombie, 1e6, false, boss.zombie.pos, t.game.player.facing);
    t.play(0.1);
    const e = t.events('bossKilled');
    expect(e).toHaveLength(1);
    const chest = e[0].chest!;
    expect(chest.free).toBe(true);
    expect(chest.rarity).toBe(F.chestRarity);
    expect(t.game.boss).toBeNull();
    // Ouvert, il propose des objets de cette rareté
    t.game.coins = 0;
    const up = chest.pos.clone().normalize();
    t.game.player.reset(chest.pos.clone().addScaledVector(up.clone().cross(t.game.player.facing).normalize(), 1.8).normalize(), t.game.player.facing);
    t.play(0.1);
    t.play(1 / 60, { action: true, actionPressed: true });
    expect(t.events('chestRevealing')[0].rarity).toBe(F.chestRarity);
    expect(RARITIES[F.chestRarity].id).toBe('legendaire');
  });
});
