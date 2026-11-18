import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BIERE_NOEL, CORNE, PLATEAU } from '../../src/config/arsenal';
import { EVOLUTION, EVOLUTIONS, weaponTitle } from '../../src/config/evolutions';
import { LEVELS } from '../../src/config/xp';
import { applyEvolution } from '../../src/game/levelUpCards';
import { WEAPON_FACTORIES } from '../../src/weapons/registry';
import type { Zombie } from '../../src/enemies/zombie';
import type { Weapon, WeaponId } from '../../src/weapons/weapon';
import { createTestGame } from '../support/testGame';

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seeded(3)); });
afterEach(() => { vi.restoreAllMocks(); });

function arena(id: WeaponId) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  const w = id === 'canette' ? t.game.loadout.weapons[0] : t.game.loadout.add(id)!;
  return { t, w };
}
/** L'arme au niveau d'évolution, avec son objet. */
function ready(t: ReturnType<typeof createTestGame>, w: Weapon) {
  w.mods.level = EVOLUTION.level;
  t.game.gainItem(EVOLUTIONS[w.id].item);
}
function dummy(t: ReturnType<typeof createTestGame>, dist: number, side = 0, frozen = true): Zombie {
  const z = t.game.spawnZombie('zombie', t.inFront(dist, side), t.game.player.facing.clone().negate())!;
  z.hp = 1e6;
  if (frozen) z.frozen = 1e6;
  return z;
}
const offered = (t: ReturnType<typeof createTestGame>) => t.events('levelUpOffered').at(-1)!.cards;

describe('Les évolutions des armes', () => {
  it('chaque arme du roster a son évolution, avec un objet qui existe', () => {
    for (const id of Object.keys(WEAPON_FACTORIES) as WeaponId[]) expect(EVOLUTIONS[id]?.name).toBeTruthy();
  });

  it('la carte Évolution sort au level-up quand l arme est au niveau 8 et que l objet est possédé', () => {
    const { t, w } = arena('canette');
    ready(t, w);
    t.game.addXp(LEVELS.first); t.play(1 / 60);
    expect(offered(t).some((c) => c.kind === 'evolution' && c.weapon === w)).toBe(true);
  });

  it('sans l objet, ou sous le niveau 8, pas de carte Évolution', () => {
    const a = arena('canette');
    a.w.mods.level = EVOLUTION.level;
    a.t.game.addXp(LEVELS.first); a.t.play(1 / 60);
    expect(offered(a.t).some((c) => c.kind === 'evolution')).toBe(false);
    const b = arena('canette');
    b.w.mods.level = EVOLUTION.level - 1;
    b.t.game.gainItem(EVOLUTIONS.canette.item);
    b.t.game.addXp(LEVELS.first); b.t.play(1 / 60);
    expect(offered(b.t).some((c) => c.kind === 'evolution')).toBe(false);
  });

  it('prendre l évolution change le nom de l arme et lui donne ses bonus, une seule fois', () => {
    const { t, w } = arena('canette');
    ready(t, w);
    const before = w.mods.projectiles;
    t.game.addXp(LEVELS.first); t.play(1 / 60);
    t.game.pickCard(offered(t).find((c) => c.kind === 'evolution')!);
    expect(weaponTitle(w)).toBe(EVOLUTIONS.canette.name);
    expect(w.mods.projectiles).toBe(before + EVOLUTIONS.canette.mods.projectiles);
    expect(t.events('weaponEvolved')).toHaveLength(1);
    t.game.addXp(LEVELS.first * 3); t.play(1 / 60);
    expect(t.events('levelUpOffered').flatMap((e) => e.cards).filter((c) => c.kind === 'evolution')).toHaveLength(1);
  });

  it('Couronne de Noël : une seconde couronne, plus large, tourne en sens inverse', () => {
    const { t, w } = arena('biereNoel');
    w.mods.evolved = 1;
    w.mods.projectiles = 2;
    t.play(0.3);
    const r = w.projectiles.filter((p) => p.active).map((p) => {
      const up = t.game.player.pos.clone().normalize();
      const flat = p.pos.clone().sub(t.game.player.pos);
      return flat.addScaledVector(up, -flat.dot(up)).length();
    });
    expect(Math.max(...r)).toBeCloseTo(BIERE_NOEL.radius * BIERE_NOEL.outerRing, 1);
    expect(Math.min(...r)).toBeCloseTo(BIERE_NOEL.radius, 1);
  });

  it('Hymne du stade : la corne frappe aussi derrière le joueur et étourdit', () => {
    const { t, w } = arena('corne');
    w.mods.evolved = 1;
    const back = dummy(t, -3, 0, false);
    back.frozen = 0;
    t.playUntil(() => t.events('zombieHit').some((e) => e.weapon === w && e.zombie === back), CORNE.firstDelay + 1);
    expect(back.frozen).toBeGreaterThan(0);
  });

  it('Service en salle : le plateau évolué ricoche sur plus de zombies', () => {
    const touched = (evolve: boolean) => {
      const { t, w } = arena('plateau');
      if (evolve) applyEvolution(w);
      const pack = Array.from({ length: 10 }, (_, i) => dummy(t, 4 + i * 1.6, (i % 3) - 1));
      t.play(PLATEAU.cooldown + PLATEAU.life! + 1);
      return pack.filter((z) => t.events('zombieHit').some((e) => e.weapon === w && e.zombie === z)).length;
    };
    expect(touched(true)).toBeGreaterThan(touched(false));
  });

  it('Dés pipés : plus jamais de 1', () => {
    const { t, w } = arena('des421');
    w.mods.evolved = 1;
    w.mods.loaded = 1;
    w.mods.critChance = -1;
    dummy(t, 6);
    t.play(12);
    const dmg = t.events('zombieHit').filter((e) => e.weapon === w && !e.crit).map((e) => e.damage);
    expect(dmg.length).toBeGreaterThan(3);
    // Un 1 ferait base / 3,5 : aucun coup simple aussi faible
    expect(Math.min(...dmg)).toBeGreaterThan(9 / 3.5 + 0.01);
  });
});
