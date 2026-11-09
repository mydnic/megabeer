import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/config/enemies';
import { PLANET_RADIUS } from '../../src/config/world';
import { createTestGame } from '../support/testGame';

const K = ENEMIES.pelerin.kamikaze;

/** Une arène calme, Canette désarmée, et un Pèlerin gonflé face au joueur à `dist` m. */
function duel(dist: number) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  const pilgrim = t.game.spawnZombie('pelerin', t.inFront(dist), t.game.player.facing.clone().negate())!;
  return { t, pilgrim };
}

/** Distance au sol (m) entre deux points. */
const ground = (a: { angleTo(b: never): number }, b: unknown) => a.angleTo(b as never) * PLANET_RADIUS;

describe('Le Pèlerin gonflé', () => {
  it("arrive à 3:00 dans le roster de l'Abbaye", () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.game.loadout.weapons[0].mods.range = 0;
    t.game.cheats.god = true;
    t.game.runTime = 180 + 10; // après les cloches de 2:00, avant celles de 4:00
    t.play(40);
    expect(t.events('zombieSpawned').some((e) => e.zombie.enemy === 'pelerin')).toBe(true);
  });

  it("fonce sur le joueur, puis s'arrête tout près et allume la mèche : la zone de l'explosion est annoncée", () => {
    const { t, pilgrim } = duel(12);
    expect(t.playUntil(() => t.events('kamikazeArmed').length > 0, 6)).toBe(true);
    const armed = t.events('kamikazeArmed')[0];
    expect(armed.zombie).toBe(pilgrim);
    expect(armed.radius).toBe(K.radius);
    expect(armed.fuse).toBe(K.fuse);
    expect(ground(pilgrim.pos, t.game.player.pos)).toBeLessThan(K.trigger + 0.5);
    // Il reste planté là pendant la mèche, et n'a pas encore explosé
    const at = pilgrim.pos.clone();
    t.play(K.fuse * 0.5);
    expect(pilgrim.pos.distanceTo(at)).toBeLessThan(0.3);
    expect(t.events('enemyExploded')).toHaveLength(0);
  });

  it("le joueur resté dans la zone prend l'explosion, et le pèlerin disparaît sans lâcher de bière", () => {
    const { t, pilgrim } = duel(K.trigger - 0.5);
    expect(t.playUntil(() => t.events('enemyExploded').length > 0, K.fuse + 1)).toBe(true);
    const boom = t.events('enemyExploded')[0];
    expect(boom.hit).toBe(true);
    expect(boom.killed).toBe(false);
    // Ses seuls dégâts sont l'explosion : il ne frappe pas au contact
    const hurts = t.events('playerHurt').filter((h) => !h.blocked);
    expect(hurts).toHaveLength(1);
    expect(hurts[0].damage).toBe(K.damage);
    t.play(0.1);
    expect(t.game.horde.zombies).not.toContain(pilgrim);
    expect(t.game.xp.drops).toHaveLength(0);
    expect(t.game.kills).toBe(0);
  });

  it("le joueur qui s'éloigne pendant la mèche esquive l'explosion", () => {
    const { t } = duel(K.trigger - 0.5);
    t.playUntil(() => t.events('kamikazeArmed').length > 0, 3);
    t.playUntil(() => t.events('enemyExploded').length > 0, K.fuse + 0.5, { moveX: 1 });
    expect(t.events('enemyExploded')[0].hit).toBe(false);
    expect(t.events('playerHurt').filter((h) => !h.blocked)).toHaveLength(0);
  });

  it("tué de loin, il explose sur place sans toucher le joueur, et lâche sa bière", () => {
    const { t, pilgrim } = duel(12);
    t.game.hitZombie(pilgrim, 999, false, pilgrim.pos, t.game.player.facing.clone());
    const boom = t.events('enemyExploded')[0];
    expect(boom.killed).toBe(true);
    expect(boom.hit).toBe(false);
    expect(ground(boom.at, pilgrim.pos)).toBeLessThan(0.01);
    expect(t.game.xp.drops.map((d) => d.value)).toEqual([ENEMIES.pelerin.xp]);
    expect(t.game.kills).toBe(1);
    t.play(0.1);
    expect(t.game.horde.zombies).not.toContain(pilgrim);
  });

  it('tué à bout portant, son explosion touche quand même le joueur', () => {
    const { t, pilgrim } = duel(K.radius - 0.8);
    t.game.hitZombie(pilgrim, 999, false, pilgrim.pos, t.game.player.facing.clone());
    expect(t.events('enemyExploded')[0].hit).toBe(true);
    expect(t.events('playerHurt').find((h) => !h.blocked)!.damage).toBe(K.damage);
  });
});
