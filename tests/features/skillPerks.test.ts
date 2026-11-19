import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RADIO } from '../../src/config/radio';
import { SAIYAN } from '../../src/config/saiyan';
import { SKILL_LINES } from '../../src/config/skills';
import { VEHICLES } from '../../src/config/vehicles';
import { emptyProfile } from '../../src/meta/profile';
import { runUnlocks } from '../../src/meta/shop';
import { buySkill, skillBonuses } from '../../src/meta/skills';
import { createTestGame } from '../support/testGame';

/** Hasard à graine fixe : même point d'arrivée à chaque passage. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seeded(4)); });
afterEach(() => { vi.restoreAllMocks(); });

/** Un profil qui a acheté toute la ligne `line`. */
function full(line: string) {
  let p = { ...emptyProfile(), tunas: 100_000 };
  const L = SKILL_LINES.find((l) => l.id === line)!;
  for (let i = 0; i < L.tiers.length; i++) p = buySkill(p, line, i)!;
  return p;
}
/** Somme des bonus d'une ligne complète pour un bonus de mécanique. */
const total = (line: string, perk: string) => (skillBonuses(full(line)).perks as Record<string, number>)[perk];

/** Une run avec ce que donne le profil `p`. */
function run(p = emptyProfile()) {
  const t = createTestGame();
  t.game.unlocks = runUnlocks(p);
  t.startRunAndLand();
  t.noSpawns();
  return t;
}

describe('Skill tree : radio, Super Saiyan, véhicules', () => {
  it('trois nouvelles lignes de paliers', () => {
    for (const id of ['radio', 'saiyan', 'vehicules']) expect(SKILL_LINES.some((l) => l.id === id)).toBe(true);
  });

  it('ligne Radio : la radio planquée a plus de PV', () => {
    expect(run().game.radio.hp).toBe(RADIO.hp);
    const t = run(full('radio'));
    expect(t.game.radio.maxHp).toBeCloseTo(RADIO.hp * (1 + total('radio', 'radioHp')));
    expect(t.game.radio.hp).toBeCloseTo(t.game.radio.maxHp);
  });

  it('ligne Super Saiyan : la jauge se remplit plus vite et la transformation dure plus longtemps', () => {
    const t = run(full('saiyan'));
    t.game.gainItem('sangSaiyan');
    const z = t.game.spawnZombie('zombie', t.inFront(6), t.game.player.facing)!;
    t.game.hitZombie(z, 1e6, false, z.pos, z.pos.clone(), null, 0);
    expect(t.game.saiyan.points).toBeCloseTo(SAIYAN.points.kill * (1 + total('saiyan', 'saiyanGain')));
    expect(t.game.saiyan.duration).toBeCloseTo(SAIYAN.duration + total('saiyan', 'saiyanTime'));
  });

  it('ligne Véhicules : ils durent plus longtemps, encaissent plus et écrasent plus fort', () => {
    const t = run(full('vehicules'));
    t.game.vehicles.spawnNear(t.game.player.pos, 'delorean', 0.4, 15);
    const v = t.game.vehicles.parked!;
    t.game.player.reset(v.pos.clone().normalize(), v.facing.clone());
    t.play(0.1);
    const d = t.game.vehicles.driving!;
    expect(d.maxHp).toBeCloseTo(VEHICLES.delorean.hp * (1 + total('vehicules', 'vehicleHp')));
    expect(d.duration).toBeCloseTo(VEHICLES.delorean.duration * (1 + total('vehicules', 'vehicleTime')));
    expect(total('vehicules', 'vehicleCrush')).toBeGreaterThan(0);
  });
});
