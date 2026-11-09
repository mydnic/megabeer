import { describe, expect, it } from 'vitest';
import { ENEMIES, ROSTERS } from '../../src/config/enemies';
import { createTestGame } from '../support/testGame';

const FROM = ROSTERS.abbaye.find((e) => e.enemy === 'gargouille')!.from;

describe('La Gargouille', () => {
  it("arrive à 7:00 dans le roster de l'Abbaye", () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.game.loadout.weapons[0].mods.range = 0;
    t.game.cheats.god = true;
    t.game.runTime = FROM + 10;
    t.play(40);
    expect(t.events('zombieSpawned').some((e) => e.zombie.enemy === 'gargouille')).toBe(true);
  });

  it("s'approche du joueur et le frappe au corps à corps, avec ses propres dégâts", () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.noSpawns();
    t.game.loadout.weapons[0].mods.range = 0;
    t.game.spawnZombie('gargouille', t.inFront(8), t.game.player.facing.clone().negate());
    expect(t.playUntil(() => t.events('playerHurt').some((h) => !h.blocked), 10)).toBe(true);
    expect(t.events('playerHurt').find((h) => !h.blocked)!.damage).toBe(ENEMIES.gargouille.damage);
  });
});
