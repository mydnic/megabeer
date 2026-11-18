import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHARACTERS, type CharacterId } from '../../src/config/characters';
import { ACHIEVEMENTS } from '../../src/config/achievements';
import { VOMI } from '../../src/config/arsenal';
import { LEVEL_UP_SCREEN } from '../../src/config/upgrades';
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

  it('le Père Noël reçoit un cadeau (un coffre gratuit) près de lui à intervalle régulier', () => {
    const t = runWith('pereNoel');
    const every = CHARACTERS.pereNoel.freeChestEvery;
    t.play(every - 2);
    expect(t.events('freeChestSpawned')).toHaveLength(0);
    t.play(3);
    expect(t.events('freeChestSpawned')).toHaveLength(1);
    // Le Buveur, lui, n'en reçoit pas
    const b = runWith('buveur');
    b.play(every + 1);
    expect(b.events('freeChestSpawned')).toHaveLength(0);
  });

  it('le Père Noël s achète en boutique', () => {
    const p = { ...emptyProfile(), tunas: 1e6 };
    expect(owned(p, 'character:pereNoel')).toBe(false);
    const bought = buy(p, 'character:pereNoel', 0)!;
    expect(owned(bought, 'character:pereNoel')).toBe(true);
  });

  it('le Cop fige le zombie qui le frappe au contact, puis plus pendant le délai ; pas le Buveur', () => {
    const S = CHARACTERS.cop.contactStun;
    const firstHit = (id: CharacterId) => {
      const t = runWith(id);
      t.game.loadout.weapons[0].mods.damage = -1e6; // ne tue pas l'attaquant
      t.game.cheats.god = true;
      const z = t.game.spawnZombie('zombie', t.inFront(1.2), t.game.player.facing.clone().negate())!;
      z.hp = 1e6;
      let hits = 0;
      t.game.events.on('playerHurt', () => { hits++; });
      expect(t.playUntil(() => hits > 0, 10)).toBe(true);
      return { t, z, frozen: z.frozen };
    };
    expect(firstHit('buveur').frozen).toBe(0);
    const { t, z, frozen } = firstHit('cop');
    expect(frozen).toBeCloseTo(S.duration, 1);
    // Figé, il ne frappe plus ; le coup suivant ne le refige pas avant la fin du délai
    const at = t.game.runTime;
    let again = -1;
    t.game.events.on('playerHurt', () => { if (again < 0) again = t.game.runTime; });
    expect(t.playUntil(() => again >= 0, 10)).toBe(true);
    expect(again - at).toBeGreaterThanOrEqual(S.duration - 0.05);
    expect(again - at).toBeLessThan(S.cooldown);
    expect(z.frozen).toBe(0);
  });

  it('le Cop est très costaud et lent, et s achète en boutique', () => {
    const b = runWith('buveur'), c = runWith('cop');
    expect(c.game.health.max - b.game.health.max).toBeCloseTo(statOf('cop', 'maxHp'));
    expect(c.game.stats.moveSpeed).toBeLessThan(b.game.stats.moveSpeed);
    const p = { ...emptyProfile(), tunas: 1e6 };
    expect(owned(p, 'character:cop')).toBe(false);
    expect(owned(buy(p, 'character:cop', 0)!, 'character:cop')).toBe(true);
  });

  it('le Futur Marié : son poison monte deux fois plus vite qu avec le même Vomi chez le Buveur', () => {
    // Deuxième battement de poison sur un zombie posé dans la flaque (un battement = un cumul, deux pour lui)
    const secondTick = (id: CharacterId) => {
      const t = runWith(id);
      const w = id === 'futurMarie' ? t.game.loadout.weapons[0] : t.game.loadout.add('vomi')!;
      if (id !== 'futurMarie') t.game.loadout.weapons[0].mods.range = 0;
      w.mods.rate = 0.01;
      if ('critChance' in w.mods) w.mods.critChance = -1;
      const z = t.game.spawnZombie('zombie', t.inFront(7), t.game.player.facing.clone().negate())!;
      z.hp = 1e6; z.frozen = 1e6;
      t.playUntil(() => (w.zones ?? []).some((zone) => zone.active), 4);
      t.play(1.6);
      const ticks = t.events('zombieHit').filter((e) => e.weapon === w && e.zombie === z && e.damage < VOMI.damage * 3).map((e) => e.damage);
      return ticks;
    };
    const b = secondTick('buveur'), m = secondTick('futurMarie');
    expect(b.length).toBeGreaterThan(2);
    expect(m.length).toBeGreaterThan(2);
    // Au deuxième battement : 2 cumuls pour le Buveur, 4 pour lui
    expect(m[1] / b[1]).toBeCloseTo(2, 1);
  });

  it('le Futur Marié est rapide et fragile, et s achète en boutique', () => {
    const b = runWith('buveur'), m = runWith('futurMarie');
    expect(m.game.health.max - b.game.health.max).toBeCloseTo(statOf('futurMarie', 'maxHp'));
    expect(m.game.stats.moveSpeed).toBeGreaterThan(b.game.stats.moveSpeed);
    expect(m.game.stats.pickupRange - b.game.stats.pickupRange).toBeCloseTo(statOf('futurMarie', 'pickupRange'));
    const p = { ...emptyProfile(), tunas: 1e6 };
    expect(owned(p, 'character:futurMarie')).toBe(false);
    expect(owned(buy(p, 'character:futurMarie', 0)!, 'character:futurMarie')).toBe(true);
  });

  it('le Barman voit 4 cartes à chaque level-up, les autres 3', () => {
    const offered = (id: CharacterId) => {
      const t = runWith(id);
      t.game.addXp(1e3);
      t.playUntil(() => t.events('levelUpOffered').length > 0, 5);
      return t.events('levelUpOffered')[0].cards.length;
    };
    expect(offered('barman')).toBe(CHARACTERS.barman.levelUpCards);
    expect(offered('buveur')).toBe(LEVEL_UP_SCREEN.cards);
  });

  it('le Barman fait moins de dégâts et s achète en boutique', () => {
    const b = runWith('buveur'), m = runWith('barman');
    expect(m.game.stats.damage - b.game.stats.damage).toBeCloseTo(statOf('barman', 'damage'));
    const p = { ...emptyProfile(), tunas: 1e6 };
    expect(owned(p, 'character:barman')).toBe(false);
    expect(owned(buy(p, 'character:barman', 0)!, 'character:barman')).toBe(true);
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
