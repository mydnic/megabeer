import { describe, expect, it } from 'vitest';
import { ENEMIES, ROSTERS } from '../../src/config/enemies';
import { PLANET_RADIUS } from '../../src/config/world';
import { createTestGame } from '../support/testGame';

const FROM = ROSTERS.abbaye.find((e) => e.enemy === 'prieur')!.from;
const S = ENEMIES.prieur.summoner;

/** Une arène calme, Canette désarmée, et un Prieur face au joueur à `dist` m. */
function duel(dist: number) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  t.game.cheats.god = true;
  const prieur = t.game.spawnZombie('prieur', t.inFront(dist), t.game.player.facing.clone().negate())!;
  return { t, prieur };
}

describe('Le Prieur', () => {
  it("arrive à 8:00 dans le roster de l'Abbaye", () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.game.loadout.weapons[0].mods.range = 0;
    t.game.cheats.god = true;
    t.game.runTime = FROM + 10;
    t.play(40);
    expect(t.events('zombieSpawned').some((e) => e.zombie.enemy === 'prieur')).toBe(true);
  });

  it('à portée, il s’arrête, fait son geste, et des squelettes sortent de terre autour de lui', () => {
    const { t, prieur } = duel(S.range - 2);
    expect(t.playUntil(() => t.events('summonCast').length > 0, S.firstDelay + 1)).toBe(true);
    expect(t.events('summonCast')[0].zombie).toBe(prieur);
    expect(t.playUntil(() => t.events('summoned').length > 0, S.cast + 0.5)).toBe(true);
    const { skeletons } = t.events('summoned')[0];
    expect(skeletons).toHaveLength(S.count);
    for (const s of skeletons) {
      expect(s.enemy).toBe(S.enemy);
      expect(s.rise).toBeGreaterThan(0); // ils émergent du sol
      expect(s.pos.angleTo(prieur.pos) * PLANET_RADIUS).toBeLessThan(S.radius * 1.5);
    }
  });

  it("pendant son geste il ne bouge plus, puis il recommence après son délai", () => {
    const { t, prieur } = duel(S.range - 2);
    t.playUntil(() => t.events('summonCast').length > 0, S.firstDelay + 1);
    const at = prieur.pos.clone();
    t.play(S.cast * 0.8);
    expect(prieur.pos.distanceTo(at)).toBeLessThan(0.05);
    // Il peut s'approcher entre deux invocations : le joueur s'éloigne pour rester à distance
    expect(t.playUntil(() => t.events('summonCast').length > 1, S.cooldown + 1)).toBe(true);
    expect(t.events('summoned').length).toBeGreaterThanOrEqual(1);
  });

  it("loin du joueur, il n'invoque rien", () => {
    const { t } = duel(S.range + 20);
    t.play(S.firstDelay + S.cast + 1);
    expect(t.events('summonCast')).toHaveLength(0);
  });

  it('les squelettes sont fragiles, rapportent peu et foncent sur le joueur', () => {
    const sk = ENEMIES[S.enemy];
    expect(sk.hp).toBeLessThan(ENEMIES.zombie.hp);
    expect(sk.xp).toBeLessThanOrEqual(ENEMIES.zombie.xp);
    const { t } = duel(S.range - 2);
    t.game.cheats.god = false;
    t.playUntil(() => t.events('summoned').length > 0, S.firstDelay + S.cast + 1);
    expect(t.playUntil(() => t.events('playerHurt').some((h) => h.zombie.enemy === S.enemy && !h.blocked), 15)).toBe(true);
  });
});
