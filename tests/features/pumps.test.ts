import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PUMPS, STAT_BONUSES } from '../../src/config/pumps';
import { RARITIES } from '../../src/config/upgrades';
import { rollStatCards } from '../../src/game/pumps';
import { PLANET_RADIUS } from '../../src/config/world';
import { WEAPONS } from '../../src/config/weapons';
import type { StatCard } from '../../src/game/levelUpCards';
import { createTestGame } from '../support/testGame';

/** Une run au sol, calme : pas de zombies, Canette désarmée. */
function arena() {
  const t = createTestGame();
  const spawn = t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  return { t, spawn };
}

/** Le Buveur se poste à `dist` m d'une pompe (au sol). */
function standNear(t: ReturnType<typeof createTestGame>, pump: { pos: THREE.Vector3 }, dist: number) {
  const up = pump.pos.clone().normalize();
  const side = new THREE.Vector3(1, 0, 0).cross(up).normalize();
  const at = pump.pos.clone().addScaledVector(side, dist).normalize();
  t.game.player.reset(at, side.clone().negate());
}

/** Reste près de la pompe jusqu'à ce qu'elle propose ses bonus. */
function fill(t: ReturnType<typeof createTestGame>, pump: { pos: THREE.Vector3 }) {
  standNear(t, pump, PUMPS.radius * 0.5);
  t.playUntil(() => t.game.offer !== null, PUMPS.fillTime + 1);
}

describe('Les pompes à bière', () => {
  it('le fût est plein : on bute dessus au lieu de le traverser', () => {
    const { t } = arena();
    const pump = t.game.pumps.list[0];
    standNear(t, pump, 5);
    // Il marche droit dessus : il s'approche, bute, puis glisse le long du fût sans jamais entrer
    let closest = Infinity;
    for (let i = 0; i < 3 * 60; i++) {
      t.play(1 / 60, { moveY: 1 });
      closest = Math.min(closest, pump.pos.angleTo(t.game.player.pos) * PLANET_RADIUS);
    }
    expect(closest).toBeLessThan(3);
    expect(closest).toBeGreaterThan(Math.min(PUMPS.body.halfX, PUMPS.body.halfZ));
  });

  it('les pompes de la run précédente ne bloquent plus rien', () => {
    const { t } = arena();
    const old = t.game.pumps.list[0].pos.clone();
    const decor = t.game.player.decor!;
    expect(decor.occupied(old.clone().setLength(old.length() + 1), 0.2)).toBe(true);
    t.game.abandon();
    expect(decor.occupied(old.clone().setLength(old.length() + 1), 0.2)).toBe(false);
  });

  it('une run en pose plusieurs, loin du départ et espacées entre elles', () => {
    const { t, spawn } = arena();
    const pumps = t.game.pumps.list;
    expect(pumps).toHaveLength(PUMPS.count);
    for (const p of pumps) {
      expect(p.pos.angleTo(spawn.dir) * PLANET_RADIUS).toBeGreaterThan(PUMPS.minFromSpawn - 0.5);
      for (const q of pumps) if (q !== p) expect(p.pos.angleTo(q.pos) * PLANET_RADIUS).toBeGreaterThan(PUMPS.minSpacing - 0.5);
    }
  });

  it("rester à côté remplit la pinte, et elle redescend quand on s'éloigne", () => {
    const { t } = arena();
    const pump = t.game.pumps.list[0];
    standNear(t, pump, PUMPS.radius * 0.5);
    t.play(PUMPS.fillTime * 0.5);
    expect(pump.fill).toBeGreaterThan(0.4);
    expect(pump.fill).toBeLessThan(0.6);
    const before = pump.fill;
    standNear(t, pump, PUMPS.radius * 3);
    t.play(1);
    expect(pump.fill).toBeLessThan(before);
  });

  it("la jauge suit la pompe qu'on remplit, et dit si la bière coule", () => {
    const { t } = arena();
    const pump = t.game.pumps.list[0];
    expect(t.game.pumps.focus).toBeNull();
    standNear(t, pump, PUMPS.radius * 0.5);
    t.play(1);
    expect(t.game.pumps.focus).toBe(pump);
    expect(t.game.pumps.filling).toBe(true);
    standNear(t, pump, PUMPS.radius * 1.5);
    t.play(0.5);
    expect(t.game.pumps.focus).toBe(pump);
    expect(t.game.pumps.filling).toBe(false);
  });

  it('pleine, le jeu se fige et propose 3 bonus de stat différents', () => {
    const { t } = arena();
    const pump = t.game.pumps.list[0];
    fill(t, pump);
    expect(t.game.frozen).toBe(true);
    const offer = t.game.offer!;
    expect(offer).toHaveLength(PUMPS.choices);
    expect(offer.every((c) => c.kind === 'stat')).toBe(true);
    expect(new Set(offer.map((c) => (c as StatCard).stat)).size).toBe(PUMPS.choices);
    expect(t.events('pumpFilled')[0].pump).toBe(pump);
  });

  it('chaque bonus a une rareté, et sa valeur suit la rareté comme les cartes d\'arme', () => {
    const { t } = arena();
    const pump = t.game.pumps.list[0];
    fill(t, pump);
    for (const c of t.game.offer! as StatCard[]) {
      const base = STAT_BONUSES.find((b) => b.id === c.stat)!;
      expect(c.value).toBeCloseTo(base.fixed ? base.value : base.value * RARITIES[c.rarity].mult);
    }
  });

  it('une pompe en or, ou plus de chance, sort plus souvent des raretés hautes', () => {
    const highShare = (tier: 'bronze' | 'or', luck: number) => {
      let high = 0, n = 0;
      for (let i = 0; i < 1500; i++) for (const c of rollStatCards(tier, 3, luck)) { n++; if (c.rarity >= 2) high++; }
      return high / n;
    };
    expect(highShare('or', 0)).toBeGreaterThan(highShare('bronze', 0) * 1.5);
    expect(highShare('bronze', 20)).toBeGreaterThan(highShare('bronze', 0) * 1.5);
  });

  it("choisir un bonus l'applique, la pompe est vidée et ne se remplit plus", () => {
    const { t } = arena();
    const pump = t.game.pumps.list[0];
    fill(t, pump);
    const card = t.game.offer![0] as StatCard;
    const statsBefore = { ...t.game.stats };
    t.game.pickCard(card);
    expect(t.game.frozen).toBe(false);
    expect(pump.used).toBe(true);
    const key = card.stat as keyof typeof statsBefore;
    if (card.stat !== 'maxHp') expect(t.game.stats[key]).toBeCloseTo((statsBefore[key] as number) + card.value);
    t.play(PUMPS.fillTime + 1);
    expect(t.game.offer).toBeNull();
    expect(t.events('pumpFilled')).toHaveLength(1);
  });

  it('le bonus de dégâts renforce toutes les armes', () => {
    const { t } = arena();
    t.game.stats.damage = 1.5;
    const canette = t.game.loadout.weapons[0];
    canette.mods.range = 1;
    canette.mods.critChance = -WEAPONS.canette.critChance;
    const z = t.game.spawnZombie('zombie', t.inFront(8), t.game.player.facing.clone().negate())!;
    z.hp = 1e6;
    t.playUntil(() => t.events('zombieHit').length > 0, 3);
    expect(t.events('zombieHit')[0].damage).toBeCloseTo(WEAPONS.canette.damage * 1.5);
  });

  it('le bonus de PV max soigne aussi de la même valeur', () => {
    const { t } = arena();
    const pump = t.game.pumps.list[0];
    fill(t, pump);
    const hp = t.game.health.hp, max = t.game.health.max;
    t.game.applyStatBonus('maxHp', 20);
    expect(t.game.health.max).toBe(max + 20);
    expect(t.game.health.hp).toBe(Math.min(hp + 20, max + 20));
  });
});
