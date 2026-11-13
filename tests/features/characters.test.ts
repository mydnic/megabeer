import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHARACTERS, type CharacterId } from '../../src/config/characters';
import { ACHIEVEMENTS } from '../../src/config/achievements';
import { emptyProfile } from '../../src/meta/profile';
import { buy, owned } from '../../src/meta/shop';
import { createTestGame } from '../support/testGame';

/** Hasard à graine fixe : même point d'arrivée et mêmes coups à chaque passage. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seeded(11)); });
afterEach(() => { vi.restoreAllMocks(); });

/** Une run au sol avec le perso `id`, sans zombies. */
function runWith(id: CharacterId) {
  const t = createTestGame();
  t.game.character = id;
  t.startRunAndLand();
  t.noSpawns();
  return t;
}
const statOf = (id: CharacterId, stat: string) => CHARACTERS[id].stats.find((s) => s.stat === stat)?.value ?? 0;

describe('Les persos jouables', () => {
  it('chaque perso commence la run avec son arme de départ, seule', () => {
    for (const id of Object.keys(CHARACTERS) as CharacterId[]) {
      const t = runWith(id);
      expect(t.game.loadout.weapons.map((w) => w.id)).toEqual([CHARACTERS[id].weapon]);
    }
  });

  it('le Videur a ses bonus de stat (armure, PV, vitesse) par rapport au Buveur', () => {
    const b = runWith('buveur'), v = runWith('videur');
    expect(v.game.stats.armor - b.game.stats.armor).toBeCloseTo(statOf('videur', 'armor'));
    expect(v.game.health.max - b.game.health.max).toBeCloseTo(statOf('videur', 'maxHp'));
    expect(v.game.stats.moveSpeed - b.game.stats.moveSpeed).toBeCloseTo(statOf('videur', 'moveSpeed'));
  });

  it('changer de perso entre deux runs change l arme de départ', () => {
    const t = runWith('videur');
    t.game.abandon();
    t.play(5);
    t.game.goHome?.();
    t.game.character = 'buveur';
    t.startRunAndLand();
    expect(t.game.loadout.weapons.map((w) => w.id)).toEqual([CHARACTERS.buveur.weapon]);
  });

  it('le Videur ne recule pas sous les coups ; le Buveur, si', () => {
    const knockOf = (id: CharacterId) => {
      const t = runWith(id);
      t.game.loadout.weapons[0].mods.damage = -1e6; // ne tue pas l'attaquant
      const z = t.game.spawnZombie('zombie', t.inFront(1.2), t.game.player.facing.clone().negate())!;
      z.hp = 1e6;
      let hurt = false;
      t.game.events.on('playerHurt', () => { hurt = true; });
      expect(t.playUntil(() => hurt, 10)).toBe(true);
      // Le plus fort recul juste après le coup
      let max = t.game.player.knockVel.length();
      for (let i = 0; i < 12; i++) { t.play(1 / 60); max = Math.max(max, t.game.player.knockVel.length()); }
      return max;
    };
    expect(knockOf('buveur')).toBeGreaterThan(0.5);
    expect(knockOf('videur')).toBe(0);
  });

  it('le perso joué est noté dans le bilan de fin de run', () => {
    const t = runWith('videur');
    t.game.abandon();
    t.play(1);
    expect(t.events('runEnded').at(-1)?.character).toBe('videur');
  });

  it('le Videur se débloque avec le succès Sonné, pas en boutique', () => {
    const a = ACHIEVEMENTS.find((x) => x.unlocks?.includes('character:videur'))!;
    expect(a).toBeDefined();
    const p = { ...emptyProfile(), tunas: 1e6 };
    expect(owned(p, 'character:videur')).toBe(false);
    expect(buy(p, 'character:videur', 0)).toBeNull();
    expect(owned({ ...p, achievements: [a.id] }, 'character:videur')).toBe(true);
    expect(owned(p, 'character:buveur')).toBe(true);
  });
});
