import { describe, expect, it } from 'vitest';
import { FLAQUE_BIERE as F } from '../../src/config/arsenal';
import { ITEMS } from '../../src/config/items';
import { rollItemCards } from '../../src/game/chests';
import { emptyProfile, recordRun } from '../../src/meta/profile';
import { achievementFor, runUnlocks } from '../../src/meta/shop';
import { createTestGame } from '../support/testGame';

/** Une run calme avec la Flaque de bière ; avec l'objet `item` si donné. */
function arena(item?: 'trilogieCinema' | 'trilogieLongue') {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  const w = t.game.loadout.add('flaqueBiere')!;
  if (item) t.game.gainItem(item);
  return { t, w };
}
/** Temps que tient la première flaque posée (s). */
function puddleLife(item?: 'trilogieCinema' | 'trilogieLongue') {
  const { t, w } = arena(item);
  t.play(0.5, { moveY: 1 });
  const first = (w.zones ?? []).find((z) => z.active)!;
  expect(first).toBeDefined();
  return first.life;
}

describe('La Trilogie du Seigneur des Anneaux', () => {
  it('les zones au sol durent bien plus longtemps : x3,5 en version cinéma, x4,5 en version longue', () => {
    const base = puddleLife();
    expect(base).toBeCloseTo(F.life, 3);
    expect(puddleLife('trilogieCinema') / base).toBeCloseTo(1 + ITEMS.trilogieCinema.stats.zoneDuration, 3);
    expect(puddleLife('trilogieLongue') / base).toBeCloseTo(1 + ITEMS.trilogieLongue.stats.zoneDuration, 3);
  });

  it('une flaque de la version longue tient encore quand les autres ont séché', () => {
    const { t, w } = arena('trilogieLongue');
    t.play(0.5, { moveY: 1 });
    t.play(F.life + 1);
    expect((w.zones ?? []).some((z) => z.active)).toBe(true);
  });

  it('seules les zones s allongent : la durée des autres effets (étourdissements, gels) ne bouge pas', () => {
    const { t } = arena('trilogieLongue');
    expect(t.game.stats.duration).toBe(1);
  });

  it('deux éditions uniques : la version cinéma en Rare, la version longue en Légendaire', () => {
    expect(ITEMS.trilogieCinema.rarity).toBe(2);
    expect(ITEMS.trilogieLongue.rarity).toBe(4);
    const owned = new Set(['trilogieCinema', 'trilogieLongue'] as const);
    for (let i = 0; i < 20; i++) {
      expect(rollItemCards(2, 20, undefined, owned).some((c) => c.item === 'trilogieCinema')).toBe(false);
      expect(rollItemCards(4, 20, undefined, owned).some((c) => c.item === 'trilogieLongue')).toBe(false);
    }
  });

  it('elles ne s achètent pas : « Collectionneur » débloque la version cinéma, « Jusqu à la fermeture » la version longue', () => {
    expect(achievementFor('item:trilogieCinema')?.id).toBe('collectionneur');
    expect(achievementFor('item:trilogieLongue')?.id).toBe('fermeture');
    const p = { ...emptyProfile(), tunas: 10_000 };
    expect(runUnlocks(p).items.has('trilogieCinema')).toBe(false);
    const q = recordRun(p, { survived: 700, kills: 0, tunas: 0, achievements: ['collectionneur', 'fermeture'] }, 2);
    expect(runUnlocks(q).items.has('trilogieCinema')).toBe(true);
    expect(runUnlocks(q).items.has('trilogieLongue')).toBe(true);
  });
});
