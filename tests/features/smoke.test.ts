import { describe, expect, it } from 'vitest';
import { rollCards } from '../../src/game/levelUpCards';

describe('mise en place des tests', () => {
  it('tire 3 cartes différentes', () => {
    const cards = rollCards(3, 0);
    expect(cards).toHaveLength(3);
    expect(new Set(cards.map((c) => c.upgrade.id)).size).toBe(3);
  });
});
