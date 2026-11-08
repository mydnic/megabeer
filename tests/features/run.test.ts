import { describe, expect, it } from 'vitest';
import { PLAYER_STATS } from '../../src/config/player';
import { createTestGame } from '../support/testGame';
import { randomSpawn } from '../../src/world/decor/layout';

describe('Une run', () => {
  it("commence quand je clique sur Jouer : le Buveur tombe du ciel puis atterrit", () => {
    const t = createTestGame();
    const spawn = randomSpawn(() => true)!;
    t.game.startRun(spawn);
    expect(t.game.phase).toBe('run');
    expect(t.game.arriving).toBe(true);
    expect(t.game.player.onGround).toBe(false);

    expect(t.playUntil(() => !t.game.arriving, 5)).toBe(true);
    expect(t.game.player.onGround).toBe(true);
    expect(t.events('landed')).toHaveLength(1);
  });

  it("ne lance pas le chrono, ni les tirs, ni le contrôle pendant la chute", () => {
    const t = createTestGame();
    t.game.startRun(randomSpawn(() => true)!);
    const start = t.game.player.pos.clone();
    t.play(0.3, { moveY: 1 });
    expect(t.game.arriving).toBe(true);
    expect(t.game.runTime).toBe(0);
    // Il tombe tout droit : aucun déplacement sur le côté
    const up = start.clone().normalize();
    const sideways = t.game.player.pos.clone().sub(start);
    sideways.addScaledVector(up, -sideways.dot(up));
    expect(sideways.length()).toBeLessThan(0.01);
  });

  it("fait arriver les zombies de départ à l'atterrissage, pas avant", () => {
    const t = createTestGame();
    t.game.startRun(randomSpawn(() => true)!);
    expect(t.game.horde.zombies).toHaveLength(0);
    t.playUntil(() => !t.game.arriving, 5);
    expect(t.game.horde.zombies.length).toBeGreaterThan(0);
  });

  it('fait tourner le chrono une fois au sol', () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.play(2);
    expect(t.game.runTime).toBeGreaterThan(1.9);
    expect(t.game.runTime).toBeLessThan(2.1);
  });

  it("se termine par l'abandon depuis la pause : retour à l'accueil, la run est perdue", () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.play(1);
    t.game.pause();
    t.game.abandon();
    expect(t.game.phase).toBe('home');
    expect(t.events('runEnded')[0].reason).toBe('abandon');
    expect(t.events('home')).toHaveLength(1);
  });

  it('repart de zéro à la run suivante (PV, niveau, armes, kills, chrono, zombies)', () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.game.addXp(500);
    t.game.offer && t.game.pickCard(t.game.offer[0]);
    t.game.health.damage(30);
    t.play(2);
    t.game.pause();
    t.game.abandon();

    t.startRunAndLand();
    const g = t.game;
    expect(g.health.hp).toBe(PLAYER_STATS.maxHp);
    expect(g.progression.level).toBe(1);
    expect(g.progression.pending).toBe(0);
    expect(g.loadout.weapons.map((w) => w.id)).toEqual(['blonde']);
    expect(g.loadout.weapons[0].mods.level).toBe(1);
    expect(g.kills).toBe(0);
    expect(g.runTime).toBeLessThan(0.05); // le chrono démarre à l'atterrissage
    expect(g.offer).toBeNull();
  });
});

describe('Le Buveur', () => {
  it('avance quand je pousse le stick ou les touches', () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.noSpawns();
    const start = t.game.player.pos.clone();
    t.play(1, { moveY: 1 });
    expect(t.game.player.pos.distanceTo(start)).toBeGreaterThan(3);
  });

  it('saute et retombe', () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.noSpawns();
    t.play(0.2);
    t.play(1 / 60, { jumpPressed: true, jump: true });
    t.play(0.1);
    expect(t.game.player.onGround).toBe(false);
    expect(t.playUntil(() => t.game.player.onGround, 2)).toBe(true);
  });
});
