import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/config/enemies';
import { PLANET_RADIUS } from '../../src/config/world';
import { createTestGame } from '../support/testGame';

const T = ENEMIES.lanceur.thrower;

/** Une arène calme, Blonde désarmée, et un Moine lanceur face au joueur à `dist` m. */
function duel(dist: number) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  const monk = t.game.spawnZombie('lanceur', t.inFront(dist), t.game.player.facing.clone().negate())!;
  return { t, monk };
}

describe('Le Moine lanceur', () => {
  it("arrive à 2:00 dans le roster de l'Abbaye", () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.game.loadout.weapons[0].mods.range = 0;
    t.game.cheats.god = true;
    t.game.runTime = 120 + 10; // après les cloches de 2:00
    t.play(40);
    expect(t.events('zombieSpawned').some((e) => e.zombie.enemy === 'lanceur')).toBe(true);
  });

  it("s'approche, puis s'arrête à distance pour lancer des bouteilles vers le joueur", () => {
    const { t, monk } = duel(T.range + 8);
    expect(t.playUntil(() => t.events('enemyThrow').length > 0, 10)).toBe(true);
    const d = monk.pos.distanceTo(t.game.player.pos);
    expect(d).toBeLessThan(T.range + 0.5);
    expect(d).toBeGreaterThan(T.range - 3);
    // Il reste planté là pendant qu'il lance
    const at = monk.pos.clone();
    t.play(1);
    expect(monk.pos.distanceTo(at)).toBeLessThan(0.3);
  });

  it("la bouteille vise l'endroit où était le joueur, et son impact est marqué au sol pendant tout le vol", () => {
    const { t } = duel(T.range - 2);
    t.playUntil(() => t.events('enemyThrow').length > 0, 10);
    const { shot } = t.events('enemyThrow')[0];
    expect(shot.to.angleTo(t.game.player.pos) * PLANET_RADIUS).toBeLessThan(0.3);
    expect(t.game.shots.shots).toContain(shot);
    t.play(T.flightTime * 0.5);
    expect(t.game.shots.shots).toContain(shot);
    expect(t.events('enemyShotLanded')).toHaveLength(0);
  });

  it('le joueur qui reste sur la marque prend la bouteille', () => {
    const { t } = duel(T.range - 2);
    t.playUntil(() => t.events('enemyShotLanded').length > 0, 10);
    expect(t.events('enemyShotLanded')[0].hit).toBe(true);
    const hurt = t.events('playerHurt').find((h) => !h.blocked)!;
    expect(hurt.damage).toBe(T.damage);
  });

  it("le joueur qui sort de la marque pendant le vol l'esquive", () => {
    const { t } = duel(T.range - 2);
    t.playUntil(() => t.events('enemyThrow').length > 0, 10);
    // Pas de côté pendant le vol
    t.playUntil(() => t.events('enemyShotLanded').length > 0, T.flightTime + 0.5, { moveX: 1 });
    expect(t.events('enemyShotLanded')[0].hit).toBe(false);
    expect(t.events('playerHurt').filter((h) => !h.blocked)).toHaveLength(0);
  });

  it('au contact, il frappe comme les autres', () => {
    const { t } = duel(1.2);
    expect(t.playUntil(() => t.events('playerHurt').some((h) => !h.blocked), 4)).toBe(true);
    expect(t.events('playerHurt').find((h) => !h.blocked)!.damage).toBe(ENEMIES.lanceur.damage);
    expect(t.events('enemyThrow')).toHaveLength(0);
  });
});
