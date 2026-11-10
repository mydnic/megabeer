import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CHESTS } from '../../src/config/chests';
import { ITEMS, type ItemDef } from '../../src/config/items';
import { RARITIES } from '../../src/config/upgrades';
import { PLANET_RADIUS } from '../../src/config/world';
import { rollItemCards, type ItemCard } from '../../src/game/chests';
import { createTestGame } from '../support/testGame';

/** Une run au sol, calme : pas de zombies, Canette désarmée. */
function arena() {
  const t = createTestGame();
  const spawn = t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  return { t, spawn };
}

/** Le Buveur se poste à `dist` m d'un coffre (au sol), tourné vers lui. */
function standNear(t: ReturnType<typeof createTestGame>, chest: { pos: THREE.Vector3 }, dist: number) {
  const up = chest.pos.clone().normalize();
  const side = new THREE.Vector3(1, 0, 0).cross(up).normalize();
  t.game.player.reset(chest.pos.clone().addScaledVector(side, dist).normalize(), side.clone().negate());
  t.play(0.1);
}

/** Appui sur la touche d'action (une image). */
const press = (t: ReturnType<typeof createTestGame>) => t.play(1 / 60, { action: true, actionPressed: true });

/** Appui, puis attente de la fin de la révélation (l'écran de choix s'ouvre). */
const open = (t: ReturnType<typeof createTestGame>) => { press(t); t.play(t.events('chestRevealing').at(-1)!.duration + 0.1); };

const dist = (a: THREE.Vector3, b: THREE.Vector3) => a.angleTo(b) * PLANET_RADIUS;

describe('Les coffres', () => {
  it('une run en pose une centaine, loin du départ, des pompes et espacés entre eux', () => {
    const { t, spawn } = arena();
    const chests = t.game.chests.list;
    expect(chests.length).toBeGreaterThanOrEqual(CHESTS.count * 0.95);
    for (const c of chests) {
      expect(dist(c.pos, spawn.dir)).toBeGreaterThan(CHESTS.minFromSpawn - 0.5);
      for (const p of t.game.pumps.list) expect(dist(c.pos, p.pos)).toBeGreaterThan(CHESTS.minFromPump - 0.5);
      for (const o of chests) if (o !== c) expect(dist(c.pos, o.pos)).toBeGreaterThan(CHESTS.minSpacing - 0.5);
    }
  });

  it("sans assez de capsules, la touche d'action ne l'ouvre pas", () => {
    const { t } = arena();
    const chest = t.game.chests.list[0];
    t.game.coins = CHESTS.basePrice - 1;
    standNear(t, chest, 1.8);
    expect(t.game.chests.focus).toBe(chest);
    press(t);
    expect(chest.opened).toBe(false);
    expect(t.game.coins).toBe(CHESTS.basePrice - 1);
    expect(t.game.offer).toBeNull();
    expect(t.events('chestDenied')).toHaveLength(1);
  });

  it('avec assez, il se paie, fige le jeu et propose 3 objets différents de la même rareté', () => {
    const { t } = arena();
    const chest = t.game.chests.list[0];
    t.game.coins = CHESTS.basePrice + 4;
    standNear(t, chest, 1.8);
    press(t);
    expect(chest.opened).toBe(true);
    expect(t.game.coins).toBe(4);
    // La rareté se révèle d'abord, jeu figé, sans cartes
    expect(t.game.frozen).toBe(true);
    expect(t.game.offer).toBeNull();
    expect(t.events('chestRevealing')).toHaveLength(1);
    t.play(t.events('chestRevealing')[0].duration + 0.1);
    expect(t.game.frozen).toBe(true);
    const cards = t.game.offer as ItemCard[];
    expect(cards).toHaveLength(CHESTS.choices);
    expect(new Set(cards.map((c) => c.item)).size).toBe(CHESTS.choices);
    expect(new Set(cards.map((c) => c.rarity)).size).toBe(1);
    expect(cards[0].rarity).toBe(t.events('chestOpened')[0].rarity);
    expect(t.events('chestRevealing')[0].rarity).toBe(cards[0].rarity);
  });

  it('hors de portée, la touche ne fait rien', () => {
    const { t } = arena();
    const chest = t.game.chests.list[0];
    t.game.coins = 100;
    standNear(t, chest, CHESTS.interactRange + 2);
    press(t);
    expect(chest.opened).toBe(false);
    expect(t.game.coins).toBe(100);
  });

  it('le prix monte à chaque coffre ouvert', () => {
    const { t } = arena();
    t.game.coins = 1000;
    const [a, b] = t.game.chests.list;
    standNear(t, a, 1.8);
    open(t);
    t.game.pickCard(t.game.offer![0]);
    const after1 = t.game.coins;
    expect(after1).toBe(1000 - CHESTS.basePrice);
    standNear(t, b, 1.8);
    press(t);
    expect(t.game.coins).toBe(after1 - CHESTS.basePrice - CHESTS.priceStep);
  });

  it("choisir un objet applique son effet et le range dans les objets du joueur", () => {
    const { t } = arena();
    t.game.coins = 100;
    standNear(t, t.game.chests.list[0], 1.8);
    open(t);
    const card = (t.game.offer as ItemCard[]).find((c) => 'stat' in ITEMS[c.item]) ?? (t.game.offer as ItemCard[])[0];
    const def: ItemDef = ITEMS[card.item];
    const stat = def.stat;
    const read = () => (!stat ? 0 : stat === 'maxHp' ? t.game.health.max : t.game.stats[stat]);
    const before = read();
    t.game.pickCard(card);
    // Objet à stat : la stat monte ; objet à effet spécial : l'effet est actif
    if (stat) expect(read()).toBeCloseTo(before + card.value, 5);
    else expect(t.game.effects.has(def.effect!)).toBe(true);
    expect(t.game.items).toEqual([{ item: card.item, rarity: card.rarity }]);
    expect(t.game.frozen).toBe(false);
  });

  it('un objet vaut plus quand la rareté monte, et « Deux mains » ne sort qu à partir de Rare', () => {
    for (let r = 0; r < RARITIES.length; r++) {
      for (let i = 0; i < 50; i++) {
        for (const c of rollItemCards(r, 3)) {
          const def = ITEMS[c.item] as { value: number; fixed?: boolean; minRarity?: number };
          expect(r).toBeGreaterThanOrEqual(def.minRarity ?? 0);
          expect(c.value).toBeCloseTo(def.fixed ? def.value : def.value * RARITIES[r].mult, 5);
        }
      }
    }
  });

  it('le coffre est plein : on bute dessus', () => {
    const { t } = arena();
    const chest = t.game.chests.list[0];
    standNear(t, chest, 4);
    let closest = Infinity;
    for (let i = 0; i < 2 * 60; i++) {
      t.play(1 / 60, { moveY: 1 });
      closest = Math.min(closest, dist(chest.pos, t.game.player.pos));
    }
    expect(closest).toBeLessThan(2);
    expect(closest).toBeGreaterThan(Math.min(CHESTS.body.halfX, CHESTS.body.halfZ));
  });

  it('pendant la révélation, les zombies sont figés et on ne peut pas mettre en pause', () => {
    const { t } = arena();
    t.game.coins = 100;
    const chest = t.game.chests.list[0];
    standNear(t, chest, 1.8);
    const z = t.game.spawnZombie('zombie', t.inFront(8), t.game.player.facing.clone().negate())!;
    press(t);
    const at = z.pos.clone();
    t.play(CHESTS.revealTime * 0.5);
    expect(z.pos.distanceTo(at)).toBeLessThan(1e-6);
    t.game.pause();
    expect(t.events('paused')).toHaveLength(0);
  });
});
