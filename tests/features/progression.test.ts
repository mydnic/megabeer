import { ENEMIES } from '../../src/config/enemies';
import { describe, expect, it } from 'vitest';
import { LEVELS, XP_DROPS } from '../../src/config/xp';
import { LEVEL_UP_SCREEN, RARITIES } from '../../src/config/upgrades';
import { rollCards, cardText, type Card, type UpgradeCard } from '../../src/game/levelUpCards';
import { WEAPON_FACTORIES } from '../../src/weapons/registry';
import type { Weapon, WeaponId } from '../../src/weapons/weapon';
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
  /** Nombre de cartes attendu au premier level-up : une par arme équipée ou à équiper, dans la limite de l'écran. */
  const expectedCards = () => Math.min(LEVEL_UP_SCREEN.cards, Object.keys(WEAPON_FACTORIES).length);
  /** La carte d'amélioration de l'arme de départ dans la proposition. */
  const upgradeOf = (t: ReturnType<typeof arena>) =>
    t.game.offer!.find((c): c is UpgradeCard => c.kind === 'upgrade' && c.weapon === t.game.loadout.weapons[0])!;

  it("se déclenche avec assez d'XP : le jeu se fige et propose une carte par arme possible", () => {
    const t = arena();
    t.game.addXp(LEVELS.first);
    t.play(1 / 60);
    expect(t.game.progression.level).toBe(2);
    expect(t.game.offer).toHaveLength(expectedCards());
    expect(t.game.frozen).toBe(true);
    const before = t.game.runTime;
    t.play(1);
    expect(t.game.runTime).toBe(before);
  });

  it("applique l'amélioration choisie à l'arme et fait repartir le jeu", () => {
    const t = arena();
    t.game.addXp(LEVELS.first);
    t.play(1 / 60);
    const card = upgradeOf(t);
    const before = card.weapon.mods[card.upgrade.id];
    t.game.pickCard(card);
    expect(card.weapon.mods[card.upgrade.id]).toBeGreaterThan(before);
    expect(card.weapon.mods.level).toBe(2);
    expect(t.game.offer).toBeNull();
    expect(t.game.frozen).toBe(false);
  });

  it("avec une seule arme, une carte propose une nouvelle arme, et la choisir l'équipe", () => {
    const t = arena();
    t.game.addXp(LEVELS.first);
    t.play(1 / 60);
    const card = t.game.offer!.find((c) => c.kind === 'weapon');
    expect(card).toBeDefined();
    if (card?.kind !== 'weapon') return;
    t.game.pickCard(card);
    expect(t.game.loadout.weapons.map((w) => w.id)).toContain(card.weaponId);
    expect(t.game.loadout.weapons).toHaveLength(2);
    expect(t.events('cardPicked')[0].card).toBe(card);
  });

  it("enchaîne les écrans quand plusieurs degrés sont gagnés d'un coup", () => {
    const t = arena();
    t.game.addXp(500);
    const gained = t.game.progression.pending;
    expect(gained).toBeGreaterThan(1);
    t.play(1 / 60);
    for (let i = 0; i < gained; i++) {
      expect(t.game.offer).not.toBeNull();
      t.game.pickCard(upgradeOf(t));
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
  /** Des armes équipées de test (le tirage ne lit que l'identifiant et les améliorations). */
  const fakes = (n: number) => Array.from({ length: n }, (_, i) => ({ ...weapons()[0], id: `arme${i}` as WeaponId }) as Weapon);
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `nouvelle${i}` as WeaponId);
  const weaponOf = (c: Card) => (c.kind === 'weapon' ? c.weaponId : c.weapon.id);

  it('ne proposent jamais deux cartes pour la même arme : une seule amélioration par arme', () => {
    const w = fakes(4);
    for (let i = 0; i < 300; i++) {
      const cards = rollCards(3, 0, w, []);
      expect(cards).toHaveLength(3);
      expect(new Set(cards.map(weaponOf)).size).toBe(3);
    }
  });

  it("proposent toujours une nouvelle arme tant qu'il y en a moins de 3, si une arme est disponible", () => {
    const one = fakes(1), two = fakes(2);
    for (let i = 0; i < 300; i++) {
      for (const w of [one, two]) expect(rollCards(3, 0, w, ids(5)).some((c) => c.kind === 'weapon')).toBe(true);
      expect(rollCards(3, 0, two, []).some((c) => c.kind === 'weapon')).toBe(false);
    }
  });

  it('avec 3 armes, une nouvelle arme peut sortir sans être garantie', () => {
    const w = fakes(3);
    let withNew = 0;
    for (let i = 0; i < 300; i++) if (rollCards(3, 0, w, ids(5)).some((c) => c.kind === 'weapon')) withNew++;
    expect(withNew).toBeGreaterThan(0);
    expect(withNew).toBeLessThan(300);
  });

  it("sont moins nombreuses quand il y a moins d'armes possibles", () => {
    const w = fakes(1);
    expect(rollCards(3, 0, w, ids(1))).toHaveLength(2);
    expect(rollCards(3, 0, w, [])).toHaveLength(1);
  });

  it("ne proposent « projectile en plus » qu'à partir de la rareté minimum", () => {
    const w = weapons();
    for (let i = 0; i < 300; i++) {
      for (const c of rollCards(3, 0, w, [])) {
        if (c.kind === 'upgrade' && c.upgrade.id === 'projectiles') expect(c.tier).toBeGreaterThanOrEqual(c.upgrade.minTier!);
      }
    }
  });

  it('sortent plus souvent en raretés hautes avec de la chance (LUCK)', () => {
    const w = fakes(3);
    const highShare = (luck: number) => {
      let high = 0, n = 0;
      for (let i = 0; i < 1500; i++) {
        for (const c of rollCards(3, luck, w, [])) { if (c.kind !== 'upgrade') continue; n++; if (c.tier >= 2) high++; }
      }
      return high / n;
    };
    expect(highShare(30)).toBeGreaterThan(highShare(0) * 1.5);
  });

  it('disent clairement leur effet, multiplié par la rareté', () => {
    const canette = weapons()[0];
    const card = (id: string, tier: number): UpgradeCard =>
      ({ kind: 'upgrade', weapon: canette, upgrade: canette.upgrades.find((u) => u.id === id)!, tier });
    const dmg = card('damage', 0).upgrade;
    expect(cardText(card('damage', 0))).toBe(`+${Math.round(dmg.value * 100)} % dégâts`);
    expect(cardText(card('damage', 2))).toBe(`+${Math.round(dmg.value * RARITIES[2].mult * 100)} % dégâts`);
    expect(cardText(card('rate', 0))).toContain("vitesse d'attaque");
    expect(cardText(card('critMult', 0))).toBe('+0,15 multiplicateur critique');
  });
});
