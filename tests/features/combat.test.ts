import { ENEMIES } from '../../src/config/enemies';
import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../../src/config/weapons';
import { createTestGame } from '../support/testGame';

const W = WEAPONS.canette;

/** Une run au sol, sans les zombies de départ : chaque test place les siens. */
function arena() {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  return t;
}

describe('La Canette', () => {
  it('lance toute seule une canette sur un zombie à portée et le tue', () => {
    const t = arena();
    const z = t.game.spawnZombie('zombie', t.inFront(8), t.game.player.facing.clone().negate())!;
    t.play(2);
    const hits = t.events('zombieHit');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].weapon?.id).toBe('canette');
    expect(z.dead).toBe(true);
    expect(t.game.kills).toBe(1);
  });

  it("ne tire pas quand aucun zombie n'est à portée", () => {
    const t = arena();
    t.game.spawnZombie('zombie', t.inFront(W.range + 15), t.game.player.facing.clone().negate());
    t.play(1);
    expect(t.game.loadout.weapons[0].projectiles.filter((p) => p.active)).toHaveLength(0);
    expect(t.events('zombieHit')).toHaveLength(0);
  });

  it('fait les dégâts de la config sur un coup normal', () => {
    const t = arena();
    const canette = t.game.loadout.weapons[0];
    canette.mods.critChance = -W.critChance; // aucun critique
    t.game.spawnZombie('zombie', t.inFront(8), t.game.player.facing.clone().negate());
    t.playUntil(() => t.events('zombieHit').length > 0, 3);
    const hit = t.events('zombieHit')[0];
    expect(hit.crit).toBe(false);
    expect(hit.damage).toBeCloseTo(W.damage);
  });

  it('fait un coup critique multiplié quand la chance de critique est de 100 %', () => {
    const t = arena();
    const canette = t.game.loadout.weapons[0];
    canette.mods.critChance = 1;
    t.game.spawnZombie('zombie', t.inFront(8), t.game.player.facing.clone().negate());
    t.playUntil(() => t.events('zombieHit').length > 0, 3);
    const hit = t.events('zombieHit')[0];
    expect(hit.crit).toBe(true);
    expect(hit.damage).toBeCloseTo(W.damage * W.critMult);
  });

  it("s'écrase sur le premier zombie touché (pas de perçage)", () => {
    const t = arena();
    // Deux zombies alignés : la canette ne peut toucher que le premier
    t.game.spawnZombie('zombie', t.inFront(7), t.game.player.facing.clone().negate());
    t.game.spawnZombie('zombie', t.inFront(7.6), t.game.player.facing.clone().negate());
    t.playUntil(() => t.events('zombieHit').length > 0, 3);
    t.play(0.05);
    expect(t.events('zombieHit')).toHaveLength(1);
  });

  it('lance une volée de plusieurs canettes sur des cibles différentes avec des projectiles en plus', () => {
    const t = arena();
    const canette = t.game.loadout.weapons[0];
    canette.mods.projectiles = 2;
    canette.mods.critChance = -W.critChance;
    for (const side of [-3, 0, 3]) t.game.spawnZombie('zombie', t.inFront(9, side), t.game.player.facing.clone().negate());
    // Un seul lancer : 3 canettes, une par zombie
    t.playUntil(() => t.events('zombieHit').length >= 3, 3);
    const victims = new Set(t.events('zombieHit').map((h) => h.zombie));
    expect(victims.size).toBe(3);
  });

  it('tire plus souvent avec plus de vitesse d\'attaque', () => {
    const throwsIn = (rate: number) => {
      const t = arena();
      t.game.loadout.weapons[0].mods.rate = rate;
      // Un zombie qui ne meurt jamais : on compte les coups
      const z = t.game.spawnZombie('zombie', t.inFront(9), t.game.player.facing.clone().negate())!;
      t.game.events.on('zombieHit', () => { z.hp = ENEMIES.zombie.hp; z.deadTime = -1; });
      t.game.horde.setPassive(true);
      t.play(4);
      return t.events('zombieHit').length;
    };
    expect(throwsIn(3)).toBeGreaterThan(throwsIn(1) * 2);
  });
});
