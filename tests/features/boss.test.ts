import { describe, expect, it } from 'vitest';
import { FRERE_SONNEUR as F } from '../../src/config/bosses';
import { RARITIES } from '../../src/config/upgrades';
import { PLANET_RADIUS } from '../../src/config/world';
import { createTestGame } from '../support/testGame';

/** Une run au sol, calme : pas de zombies, Canette désarmée. */
function arena() {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
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

  it('marche vers le joueur', () => {
    const t = arena();
    t.game.cheats.god = true;
    const boss = t.game.spawnBoss()!;
    const d0 = dist(boss.zombie, t.game.player.pos);
    t.play(4);
    expect(dist(boss.zombie, t.game.player.pos)).toBeLessThan(d0 - 4);
  });

  it('à portée, il abat son maillet : une onde part, elle blesse le joueur resté au sol', () => {
    const t = arena();
    const boss = t.game.spawnBoss(t.inFront(F.strike.range - 3))!;
    expect(t.playUntil(() => t.events('bossWave').length > 0, 4)).toBe(true);
    expect(boss.zombie.dead).toBe(false);
    expect(t.playUntil(() => t.events('playerHurt').some((e) => !e.blocked), 3)).toBe(true);
  });

  it('on évite l\'onde en sautant au bon moment', () => {
    const t = arena();
    const boss = t.game.spawnBoss(t.inFront(F.strike.range - 1))!;
    t.game.health.invuln = 0;
    // On attend l'impact du maillet, puis on saute juste avant que l'anneau arrive
    expect(t.playUntil(() => t.events('bossWave').length > 0, 4)).toBe(true);
    const w = t.events('bossWave')[0];
    const d = w.at.angleTo(t.game.player.pos) * PLANET_RADIUS;
    const reach = Math.max(0, (d - F.wave.width) / F.wave.speed - 0.05);
    t.play(reach);
    t.play(1 / 60, { jump: true, jumpPressed: true });
    t.play(0.5, { jump: true });
    expect(boss.waves.length).toBeGreaterThanOrEqual(0);
    expect(t.events('playerHurt').filter((e) => !e.blocked)).toHaveLength(0);
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
