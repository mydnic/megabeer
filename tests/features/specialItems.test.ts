import { describe, expect, it } from 'vitest';
import { ITEMS, ITEM_EFFECTS } from '../../src/config/items';
import { ENEMIES } from '../../src/config/enemies';
import { PLAYER_STATS } from '../../src/config/player';
import { createTestGame } from '../support/testGame';

/** Arène calme, run lancée ; `random` : le hasard des effets d'objets (0 : tout se déclenche). */
function arena(random = () => 0) {
  const t = createTestGame(1, { random });
  t.startRunAndLand();
  t.noSpawns();
  return t;
}

const toward = (t: ReturnType<typeof arena>) => t.game.player.facing.clone();

describe('Objets à effet spécial', () => {
  it('Cendrier : un ennemi tué explose et blesse ses voisins, jamais le joueur', () => {
    const t = arena();
    t.game.gainItem('cendrier');
    const victim = t.game.spawnZombie('zombie', t.inFront(6), toward(t).negate())!;
    const neighbour = t.game.spawnZombie('zombie', t.inFront(7), toward(t).negate())!;
    const far = t.game.spawnZombie('zombie', t.inFront(6 + ITEM_EFFECTS.explodeOnKill.radius + 3), toward(t).negate())!;
    const hp = t.game.health.hp;
    t.game.hitZombie(victim, ENEMIES.zombie.hp * 10, false, victim.pos, toward(t));
    // Le voisin encaisse (et s'il meurt, il peut exploser à son tour)
    expect(t.events('itemExploded')[0].zombie).toBe(victim);
    expect(neighbour.hp).toBeLessThan(ENEMIES.zombie.hp);
    expect(far.hp).toBe(ENEMIES.zombie.hp);
    expect(t.game.health.hp).toBe(hp);
  });

  it("Cendrier : sans l'objet, ou quand le hasard dit non, rien n'explose", () => {
    const without = arena();
    const z1 = without.game.spawnZombie('zombie', without.inFront(6), toward(without))!;
    without.game.hitZombie(z1, 9999, false, z1.pos, toward(without));
    expect(without.events('itemExploded')).toHaveLength(0);

    const unlucky = arena(() => 0.99);
    unlucky.game.gainItem('cendrier');
    const z2 = unlucky.game.spawnZombie('zombie', unlucky.inFront(6), toward(unlucky))!;
    unlucky.game.hitZombie(z2, 9999, false, z2.pos, toward(unlucky));
    expect(unlucky.events('itemExploded')).toHaveLength(0);
  });

  it('Mousse épaisse : le bouclier absorbe un coup entier, puis se recharge', () => {
    const t = arena();
    t.game.cheats.god = false;
    t.game.loadout.weapons[0].mods.range = 0; // le joueur ne tire pas : le zombie reste au contact
    t.game.gainItem('mousseEpaisse');
    const hp = t.game.health.hp;
    t.game.spawnZombie('novice', t.inFront(1.2), toward(t).negate());
    expect(t.playUntil(() => t.events('foamShieldPopped').length > 0, 6)).toBe(true);
    expect(t.game.health.hp).toBe(hp);
    // Le coup suivant fait mal : le bouclier n'est pas encore revenu
    expect(t.playUntil(() => t.events('playerHurt').some((h) => !h.blocked), 6)).toBe(true);
    expect(t.game.health.hp).toBeLessThan(hp);
    // Il revient au bout de 1 / valeur secondes
    t.noSpawns();
    expect(t.playUntil(() => t.events('foamShieldUp').length > 0, 1 / ITEMS.mousseEpaisse.value + 1)).toBe(true);
    expect(t.game.effects.shieldsUp).toBe(1);
  });

  it('Mousse épaisse prise deux fois : deux bulles, chacune avec sa recharge', () => {
    const t = arena();
    t.game.cheats.god = false;
    t.game.loadout.weapons[0].mods.range = 0;
    t.game.gainItem('mousseEpaisse');
    t.game.gainItem('mousseEpaisse');
    expect(t.game.effects.shieldsUp).toBe(2);
    const hp = t.game.health.hp;
    const z = t.game.spawnZombie('novice', t.inFront(1.2), toward(t).negate())!;
    // Deux coups de suite absorbés, sans perdre de PV
    expect(t.playUntil(() => t.events('foamShieldPopped').length >= 2, 8)).toBe(true);
    expect(t.game.health.hp).toBe(hp);
    expect(t.game.effects.shieldsUp).toBe(0);
    // Chacune revient de son côté : deux recharges
    t.game.hitZombie(z, 9999, false, z.pos, toward(t));
    t.noSpawns();
    expect(t.playUntil(() => t.game.effects.shieldsUp === 2, 1 / ITEMS.mousseEpaisse.value + 2)).toBe(true);
    expect(t.events('foamShieldUp')).toHaveLength(2);
  });

  it("Happy hour : toutes les 60 s, la cadence double pendant quelques secondes", () => {
    const t = arena();
    t.game.gainItem('happyHour');
    const base = t.game.stats.fireRate;
    t.play(ITEM_EFFECTS.happyHour.every - 1);
    expect(t.events('happyHourStarted')).toHaveLength(0);
    expect(t.playUntil(() => t.events('happyHourStarted').length > 0, 2)).toBe(true);
    expect(t.game.stats.fireRate).toBeCloseTo(base * ITEM_EFFECTS.happyHour.rate, 5);
    t.play(ITEMS.happyHour.value + 0.2);
    expect(t.events('happyHourEnded')).toHaveLength(1);
    expect(t.game.stats.fireRate).toBeCloseTo(base, 5);
  });

  it("Sachet de cacahuètes : chaque goutte d'XP ramassée soigne un peu", () => {
    const t = arena();
    t.game.gainItem('cacahuetes');
    t.game.health.hp = PLAYER_STATS.maxHp / 2;
    const hp = t.game.health.hp;
    t.game.xp.drop(t.inFront(1), 1);
    t.game.xp.drop(t.inFront(1, 0.5), 1);
    expect(t.playUntil(() => t.events('xpCollected').length >= 2, 5)).toBe(true);
    expect(t.game.health.hp).toBeCloseTo(hp + 2 * ITEMS.cacahuetes.value, 5);
  });

  it('les objets à effet se cumulent', () => {
    const t = arena();
    t.game.gainItem('cacahuetes');
    t.game.gainItem('cacahuetes');
    expect(t.game.effects.healPerXp).toBeCloseTo(ITEMS.cacahuetes.value * 2, 5);
    expect(t.game.items).toHaveLength(2);
  });
});
