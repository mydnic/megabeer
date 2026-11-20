import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAURON as S } from '../../src/config/bosses';
import { ITEMS, ITEM_EFFECTS, type ItemId } from '../../src/config/items';
import { PLANET_RADIUS } from '../../src/config/world';
import { rollItemCards } from '../../src/game/chests';
import { catalog } from '../../src/meta/shop';
import { createTestGame } from '../support/testGame';

/** Hasard à graine fixe : même arrivée à chaque passage. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seeded(7)); });
afterEach(() => { vi.restoreAllMocks(); });

const R = ITEM_EFFECTS.ring;
const dist = (a: THREE.Vector3, b: THREE.Vector3) => a.angleTo(b) * PLANET_RADIUS;

/** Une run calme ; le joueur ne tire pas. */
function arena() {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  return t;
}
type T = ReturnType<typeof arena>;

/** Sauron défié au fond du cratère (le joueur à 4 m de lui), puis tué. */
function killSauron(t: T) {
  const c = t.game.doom.dir;
  const axis = new THREE.Vector3().crossVectors(c, Math.abs(c.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
  const at = c.clone().applyAxisAngle(axis, 4 / PLANET_RADIUS);
  t.game.player.reset(at, new THREE.Vector3().crossVectors(axis, at).normalize());
  t.game.cheats.god = true;
  const boss = t.game.challenge(t.game.graveBosses.list.find((b) => b.kind === 'sauron')!)!;
  t.game.hitZombie(boss.zombie, 1e6, false, boss.zombie.pos, t.game.player.facing);
  t.play(0.1);
  return boss;
}

describe("L'Anneau unique", () => {
  it('Sauron tombé, l Anneau roule au sol à côté de lui ; on le ramasse en marchant dessus', () => {
    const t = arena();
    killSauron(t);
    const drop = t.game.ringDrop!;
    expect(t.events('ringDropped')).toHaveLength(1);
    // À côté de son coffre (le corps, lui, glisse encore)
    expect(dist(drop, t.events('bossKilled')[0].chest!.pos)).toBeLessThan(S.ring.offset + 1);
    expect(t.game.items.some((i) => i.item === 'anneau')).toBe(false);
    t.game.player.reset(drop.clone().normalize(), t.game.player.facing.clone());
    t.play(0.1);
    expect(t.events('ringTaken')).toHaveLength(1);
    expect(t.game.ringDrop).toBeNull();
    expect(t.game.items.filter((i) => i.item === 'anneau')).toHaveLength(1);
  });

  it('il ne sort jamais d un coffre et ne s achète pas en boutique', () => {
    for (let i = 0; i < 200; i++) {
      for (const c of rollItemCards(ITEMS.anneau.rarity, 3)) expect(c.item).not.toBe('anneau' as ItemId);
    }
    expect(catalog().some((e) => e.kind === 'item' && e.item === 'anneau')).toBe(false);
  });

  it('il s enfile tout seul : invisible quelques secondes, à intervalle régulier', () => {
    const t = arena();
    t.game.gainItem('anneau');
    t.play(R.every - 0.5);
    expect(t.game.invisible).toBe(false);
    t.play(1);
    expect(t.events('ringOn')).toHaveLength(1);
    expect(t.game.invisible).toBe(true);
    t.play(R.duration * t.game.stats.duration);
    expect(t.events('ringOff')).toHaveLength(1);
    expect(t.game.invisible).toBe(false);
    t.play(R.every);
    expect(t.events('ringOn')).toHaveLength(2);
  });

  it('invisible, rien ne le touche, et les ennemis vont là où ils l ont vu', () => {
    const t = arena();
    t.game.gainItem('anneau');
    t.play(R.every + 0.1);
    expect(t.game.invisible).toBe(true);
    const seen = t.game.player.pos.clone();
    // Il s'éloigne ; un zombie arrive sur l'endroit où il était
    const p = t.game.player;
    const away = new THREE.Vector3().crossVectors(p.pos, p.facing).normalize();
    p.reset(p.pos.clone().normalize().applyAxisAngle(away, 8 / PLANET_RADIUS), p.facing.clone());
    const z = t.game.spawnZombie('zombie', t.inFront(1.2), p.facing.clone().negate())!;
    const start = dist(z.pos, seen);
    t.play(R.duration * t.game.stats.duration - 0.2);
    expect(t.game.invisible).toBe(true);
    expect(t.events('playerHurt')).toHaveLength(0);
    // Il est allé vers l'endroit où il l'a vu, pas vers lui
    expect(dist(z.pos, seen)).toBeLessThan(start - 2);
  });

  it('les boss aussi perdent sa trace : ils visent là où il était', () => {
    const t = arena();
    killSauron(t);
    t.game.gainItem('anneau');
    t.play(R.every + 0.1);
    const seen = t.game.player.pos.clone();
    const p = t.game.player;
    p.reset(p.pos.clone().normalize().applyAxisAngle(new THREE.Vector3().crossVectors(p.pos, p.facing).normalize(), 5 / PLANET_RADIUS), p.facing.clone());
    expect(t.game.seenPos.distanceTo(seen)).toBeLessThan(1e-6);
    expect(t.game.seenPos.distanceTo(p.pos)).toBeGreaterThan(1);
  });

  it('invisible, il frappe plus fort', () => {
    const t = arena();
    t.game.cheats.god = true;
    const z = t.game.spawnZombie('tonnelier', t.inFront(10), t.game.player.facing.clone().negate())!;
    const shoot = () => t.game.hitZombie(z, 2, false, z.pos, t.game.player.facing.clone(), t.game.loadout.weapons[0]);
    let hp = z.hp;
    shoot();
    const full = hp - z.hp;
    t.game.gainItem('anneau');
    t.play(R.every + 0.1);
    expect(t.game.invisible).toBe(true);
    hp = z.hp;
    shoot();
    expect(hp - z.hp).toBeCloseTo(full * (1 + R.damage), 5);
  });

  it('déjà au doigt, Sauron n en lâche pas un second', () => {
    const t = arena();
    t.game.gainItem('anneau');
    killSauron(t);
    expect(t.events('ringDropped')).toHaveLength(0);
    expect(t.game.ringDrop).toBeNull();
  });
});
