import { describe, expect, it } from 'vitest';
import { ITEMS, type ItemDef, type ItemId } from '../../src/config/items';
import { ITEM_PRICES, STARTING_ITEMS } from '../../src/config/shop';
import { RARITIES } from '../../src/config/upgrades';
import { rollItemCards } from '../../src/game/chests';
import { type UpgradeCard } from '../../src/game/levelUpCards';
import { emptyProfile, mergeProfiles, readProfile } from '../../src/meta/profile';
import { buy, catalog, owned, runUnlocks } from '../../src/meta/shop';
import { createTestGame } from '../support/testGame';

const rich = (tunas = 10_000) => ({ ...emptyProfile(), tunas });

describe('La boutique', () => {
  it('un nouveau joueur a déjà 3 objets par rareté ; les autres sont à vendre, au prix de leur rareté', () => {
    for (let r = 0; r < RARITIES.length; r++) {
      expect(STARTING_ITEMS.filter((id) => (ITEMS[id] as ItemDef).rarity === r)).toHaveLength(3);
    }
    const items = catalog().filter((e) => e.kind === 'item');
    expect(items).toHaveLength(Object.keys(ITEMS).length - STARTING_ITEMS.length);
    for (const e of items) if (e.kind === 'item') expect(e.price).toBe(ITEM_PRICES[e.rarity]);
  });

  it('acheter retire les TUNAS et débloque l article, pour de bon', () => {
    const entry = catalog().find((e) => e.kind === 'item')!;
    const p = buy(rich(500), entry.key, 1)!;
    expect(p.tunas).toBe(500 - entry.price);
    expect(owned(p, entry.key)).toBe(true);
    // La sauvegarde relue garde l'achat
    expect(owned(readProfile(JSON.parse(JSON.stringify(p))), entry.key)).toBe(true);
  });

  it('impossible sans assez de TUNAS, ou deux fois le même', () => {
    const entry = catalog().find((e) => e.kind === 'item')!;
    expect(buy(rich(entry.price - 1), entry.key, 1)).toBeNull();
    const once = buy(rich(), entry.key, 1)!;
    expect(buy(once, entry.key, 2)).toBeNull();
    expect(buy(rich(), 'item:nimportequoi', 1)).toBeNull();
  });

  it('la première connexion réunit les achats du navigateur et du compte', () => {
    const [a, b] = catalog().filter((e) => e.kind === 'item');
    const m = mergeProfiles(buy(rich(), a.key, 1)!, buy(rich(), b.key, 1)!, 3);
    expect(owned(m, a.key) && owned(m, b.key)).toBe(true);
  });

  it('un coffre ne propose que des objets débloqués', () => {
    const allowed = runUnlocks(emptyProfile()).items;
    for (let r = 0; r < RARITIES.length; r++) {
      for (let i = 0; i < 30; i++) {
        const cards = rollItemCards(r, 3, allowed);
        expect(cards).toHaveLength(3);
        for (const c of cards) expect(STARTING_ITEMS).toContain(c.item);
      }
    }
    // Un objet acheté peut sortir à son tour
    const bought = catalog().find((e) => e.kind === 'item' && e.rarity === 4)!;
    const after = runUnlocks(buy(rich(), bought.key, 1)!).items;
    const seen = new Set<ItemId>();
    for (let i = 0; i < 200; i++) for (const c of rollItemCards(4, 3, after)) seen.add(c.item);
    expect(bought.kind === 'item' && seen.has(bought.item)).toBe(true);
  });

  it('dans la run, les coffres et le level-up suivent les déblocages', () => {
    const t = createTestGame();
    t.game.unlocks = { ...runUnlocks(emptyProfile()), weapons: new Set(['canette', 'stout']) };
    t.startRunAndLand();
    t.noSpawns();
    t.game.addXp(t.game.progression.next);
    t.play(0.1);
    const offered = t.game.offer!.filter((c) => c.kind === 'weapon').map((c) => c.kind === 'weapon' && c.weaponId);
    for (const w of offered) expect(['stout']).toContain(w);
  });
});

describe('Relancer, Bannir, Passer (débloqués par le skill tree)', () => {
  /** Une run au premier level-up, avec `n` utilisations de chaque option. */
  function levelUp(n = 1) {
    const t = createTestGame();
    t.game.unlocks = { ...runUnlocks(emptyProfile()), options: { reroll: n, banish: n, skip: n } };
    t.startRunAndLand();
    t.noSpawns();
    t.game.addXp(t.game.progression.next);
    t.play(0.1);
    expect(t.game.offerKind).toBe('level');
    return t;
  }

  it('sans déblocage, aucune option', () => {
    const t = createTestGame();
    t.startRunAndLand();
    expect(t.game.cardOptions).toEqual({ reroll: 0, banish: 0, skip: 0 });
    expect(t.game.rerollCards()).toBe(false);
  });

  it('Relancer tire de nouvelles cartes, une fois', () => {
    const t = levelUp();
    const before = t.game.offer;
    expect(t.game.rerollCards()).toBe(true);
    expect(t.game.offer).not.toBe(before);
    expect(t.game.offer!.length).toBeGreaterThan(0);
    expect(t.game.rerollCards()).toBe(false);
  });

  it('Bannir retire la carte, et elle ne revient plus de la run', () => {
    const t = levelUp();
    // Une arme équipée, dont on bannit une amélioration
    const card = t.game.offer!.find((c): c is UpgradeCard => c.kind === 'upgrade') ?? null;
    const target = card ?? t.game.offer![0];
    expect(t.game.banishCard(target)).toBe(true);
    expect(t.game.offer?.includes(target) ?? false).toBe(false);
    expect(t.events('cardBanished')).toHaveLength(1);
    // Beaucoup de tirages : la carte bannie ne ressort jamais
    const key = target.kind === 'upgrade' ? `${target.weapon.id}:${target.upgrade.id}` : target.kind === 'weapon' ? target.weaponId : '';
    expect(t.game.banned.has(key)).toBe(true);
  });

  it('Passer ferme le level-up sans rien prendre', () => {
    const t = levelUp();
    const level = t.game.loadout.weapons[0].mods.level;
    expect(t.game.skipCards()).toBe(true);
    expect(t.game.offer).toBeNull();
    expect(t.game.frozen).toBe(false);
    expect(t.game.loadout.weapons[0].mods.level).toBe(level);
    expect(t.events('cardsSkipped')).toHaveLength(1);
  });

  it('les options ne marchent pas sur un coffre ou une pompe', () => {
    const t = levelUp();
    t.game.offerKind = 'chest';
    expect(t.game.rerollCards()).toBe(false);
    expect(t.game.skipCards()).toBe(false);
  });
});
