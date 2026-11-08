import { describe, expect, it } from 'vitest';
import { createTestGame } from '../support/testGame';

describe('le jeu tourne sans navigateur', () => {
  it('une run démarre, le Buveur atterrit et les zombies de départ arrivent', () => {
    const t = createTestGame();
    t.startRunAndLand();
    expect(t.game.phase).toBe('run');
    expect(t.game.arriving).toBe(false);
    expect(t.events('landed')).toHaveLength(1);
    expect(t.events('zombieSpawned')).toHaveLength(4);
  });
});
