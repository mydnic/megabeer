import { describe, expect, it } from 'vitest';
import { ITEM_EFFECTS, ITEMS } from '../../src/config/items';
import { createTestGame } from '../support/testGame';

const B = ITEM_EFFECTS.senzu.below;

/** Une run calme ; `n` Senzus prises dans des coffres. */
function arena(n: number) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  for (let i = 0; i < n; i++) t.game.gainItem('senzu');
  return t;
}
/** Le joueur tombe juste sous le seuil, puis le jeu avance un instant. */
function hurtBelow(t: ReturnType<typeof arena>) {
  t.game.health.hp = t.game.health.max * B * 0.8;
  t.play(0.1);
}

describe('La Senzu', () => {
  it('sous le seuil de PV, il en mange une et retrouve tous ses PV, une seule fois', () => {
    const t = arena(1);
    t.game.health.hp = t.game.health.max * (B + 0.05);
    t.play(0.2);
    expect(t.events('senzuEaten')).toHaveLength(0);
    expect(t.game.items.filter((i) => i.item === 'senzu')).toHaveLength(1);
    hurtBelow(t);
    expect(t.events('senzuEaten')).toHaveLength(1);
    expect(t.game.health.hp).toBe(t.game.health.max);
    expect(t.game.items.filter((i) => i.item === 'senzu')).toHaveLength(0);
    // Plus de Senzu : la fois suivante, rien
    hurtBelow(t);
    expect(t.events('senzuEaten')).toHaveLength(1);
    expect(t.game.health.hp).toBeLessThan(t.game.health.max * B);
  });

  it('deux Senzus : deux soins complets', () => {
    const t = arena(2);
    hurtBelow(t);
    hurtBelow(t);
    expect(t.events('senzuEaten').map((e) => e.left)).toEqual([1, 0]);
    // Mangées, elles quittent les objets du joueur
    expect(t.game.items.filter((i) => i.item === 'senzu')).toHaveLength(0);
    expect(t.game.health.hp).toBe(t.game.health.max);
  });

  it('sans Senzu, pas de soin', () => {
    const t = arena(0);
    hurtBelow(t);
    expect(t.events('senzuEaten')).toHaveLength(0);
    expect(t.game.health.hp).toBeLessThan(t.game.health.max * B);
  });

  it('c est un objet de coffre Dingue', () => {
    expect(ITEMS.senzu.rarity).toBe(3);
    expect(ITEMS.senzu.effect).toBe('senzu');
  });
});
