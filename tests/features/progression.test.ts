import { ENEMIES } from '../../src/config/enemies';
import { describe, expect, it } from 'vitest';
import { LEVELS, XP_DROPS } from '../../src/config/xp';
import { LEVEL_UP_SCREEN, RARITIES } from '../../src/config/upgrades';
import { rollCards, cardText, type Card } from '../../src/game/levelUpCards';
import { createTestGame } from '../support/testGame';

/** Une run au sol, sans zombies ni tirs : on pilote l'XP à la main. */
function arena() {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  return t;
}

describe("Les gouttes de bière (XP)", () => {
  it('tombent quand un zombie meurt', () => {
    const t = arena();
    const z = t.game.spawnZombie('zombie', t.inFront(12), t.game.player.facing.clone())!;
    t.game.hitZombie(z, z.hp + 1, false, z.pos, t.game.player.facing.clone());
    expect(t.game.xp.drops).toHaveLength(1);
    expect(t.game.xp.drops[0].value).toBe(ENEMIES.zombie.xp);
  });

  it('filent vers le Buveur et sont avalées quand il passe à portée', () => {
    const t = arena();
    t.game.xp.drop(t.inFront(XP_DROPS.pickupRange * 0.5), 3);
    t.play(1);
    expect(t.game.xp.drops).toHaveLength(0);
    expect(t.events('xpCollected')[0].amount).toBe(3);
    expect(t.game.progression.xp).toBe(3);
  });

  it('restent en place hors de portée', () => {
    const t = arena();
    t.game.xp.drop(t.inFront(XP_DROPS.pickupRange * 3), 3);
    t.play(2);
    expect(t.game.xp.drops).toHaveLength(1);
  });

  it('rapportent plus avec la stat Gain d\'XP', () => {
    const t = arena();
    t.game.stats.xpGain = 2;
    t.game.xp.drop(t.inFront(1), 3);
    t.play(1);
    expect(t.events('xpCollected')[0].amount).toBe(6);
  });
});

describe('Le level-up', () => {
  it("se déclenche avec assez d'XP : le jeu se fige et propose 3 cartes", () => {
    const t = arena();
    t.game.addXp(LEVELS.first);
    t.play(1 / 60);
    expect(t.game.progression.level).toBe(2);
    expect(t.game.offer).toHaveLength(LEVEL_UP_SCREEN.cards);
    expect(t.game.frozen).toBe(true);
    const before = t.game.runTime;
    t.play(1);
    expect(t.game.runTime).toBe(before);
  });

  it("applique la carte choisie à l'arme et fait repartir le jeu", () => {
    const t = arena();
    t.game.addXp(LEVELS.first);
    t.play(1 / 60);
    const card = t.game.offer![0];
    const before = card.weapon.mods[card.upgrade.id];
    t.game.pickCard(card);
    expect(card.weapon.mods[card.upgrade.id]).toBeGreaterThan(before);
    expect(card.weapon.mods.level).toBe(2);
    expect(t.game.offer).toBeNull();
    expect(t.game.frozen).toBe(false);
  });

  it('enchaîne les écrans quand plusieurs degrés sont gagnés d\'un coup', () => {
    const t = arena();
    t.game.addXp(500);
    const gained = t.game.progression.pending;
    expect(gained).toBeGreaterThan(1);
    t.play(1 / 60);
    for (let i = 0; i < gained; i++) {
      expect(t.game.offer).not.toBeNull();
      t.game.pickCard(t.game.offer![0]);
    }
    expect(t.game.offer).toBeNull();
    expect(t.events('levelUpOffered').map((e) => e.first)).toEqual([true, ...Array(gained - 1).fill(false)]);
    expect(t.game.loadout.weapons[0].mods.level).toBe(1 + gained);
  });

  it('refuse une carte qui ne fait pas partie de la proposition', () => {
    const t = arena();
    t.game.addXp(LEVELS.first);
    t.play(1 / 60);
    const fake: Card = { ...t.game.offer![0] };
    t.game.pickCard(fake);
    expect(t.game.offer).not.toBeNull();
  });
});

describe('Les cartes', () => {
  const weapons = () => { const t = arena(); return t.game.loadout.weapons; };

  it('proposent 3 améliorations différentes', () => {
    for (let i = 0; i < 50; i++) {
      const cards = rollCards(3, 0, weapons());
      expect(new Set(cards.map((c) => c.upgrade.id)).size).toBe(3);
    }
  });

  it("ne proposent « projectile en plus » qu'à partir de la rareté minimum", () => {
    const w = weapons();
    for (let i = 0; i < 300; i++) {
      for (const c of rollCards(3, 0, w)) {
        if (c.upgrade.id === 'projectiles') expect(c.tier).toBeGreaterThanOrEqual(c.upgrade.minTier!);
      }
    }
  });

  it('sortent plus souvent en raretés hautes avec de la chance (LUCK)', () => {
    const w = weapons();
    const highShare = (luck: number) => {
      let high = 0, n = 0;
      for (let i = 0; i < 1500; i++) for (const c of rollCards(3, luck, w)) { n++; if (c.tier >= 2) high++; }
      return high / n;
    };
    expect(highShare(30)).toBeGreaterThan(highShare(0) * 1.5);
  });

  it('disent clairement leur effet, multiplié par la rareté', () => {
    const blonde = weapons()[0];
    const dmg = blonde.upgrades.find((u) => u.id === 'damage')!;
    expect(cardText({ weapon: blonde, upgrade: dmg, tier: 0 })).toBe(`+${Math.round(dmg.value * 100)} % dégâts`);
    expect(cardText({ weapon: blonde, upgrade: dmg, tier: 2 })).toBe(`+${Math.round(dmg.value * RARITIES[2].mult * 100)} % dégâts`);
    const rate = blonde.upgrades.find((u) => u.id === 'rate')!;
    expect(cardText({ weapon: blonde, upgrade: rate, tier: 0 })).toContain("vitesse d'attaque");
    const crit = blonde.upgrades.find((u) => u.id === 'critMult')!;
    expect(cardText({ weapon: blonde, upgrade: crit, tier: 0 })).toBe('+0,15 multiplicateur critique');
  });
});
