import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CORNE, ODEUR, PLATEAU, ROT, TIREUSE, WEIZEN } from '../../src/config/arsenal';
import { catalog } from '../../src/meta/shop';
import type { Zombie } from '../../src/enemies/zombie';
import type { WeaponId } from '../../src/weapons/weapon';
import { createTestGame } from '../support/testGame';

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seeded(9)); });
afterEach(() => { vi.restoreAllMocks(); });

function arena(id: WeaponId) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  const w = t.game.loadout.add(id)!;
  if ('critChance' in w.mods) w.mods.critChance = -1;
  return { t, w };
}
function dummy(t: ReturnType<typeof createTestGame>, dist: number, side = 0, frozen = true): Zombie {
  const z = t.game.spawnZombie('zombie', t.inFront(dist, side), t.game.player.facing.clone().negate())!;
  z.hp = 1e6;
  if (frozen) z.frozen = 1e6;
  return z;
}
const hitsOn = (t: ReturnType<typeof createTestGame>, w: object, z: Zombie) => t.events('zombieHit').filter((e) => e.weapon === w && e.zombie === z);

describe('Les armes de zone du roster', () => {
  it('Weizen : un nuage se pose sur un zombie et le frappe plusieurs fois', () => {
    const { t, w } = arena('weizen');
    const z = dummy(t, 8);
    t.play(WEIZEN.firstDelay + WEIZEN.life * 0.8);
    expect((w.zones ?? []).some((zone) => zone.active)).toBe(true);
    expect(hitsOn(t, w, z).length).toBeGreaterThan(3);
  });

  it('Tireuse : le jet touche un zombie proche, pas un zombie loin', () => {
    const { t, w } = arena('tireuse');
    const near = dummy(t, 2.5);
    const far = dummy(t, TIREUSE.range + 3, 3);
    t.play(1);
    expect(hitsOn(t, w, near).length).toBeGreaterThan(2);
    expect(hitsOn(t, w, far).length).toBe(0);
  });

  it('Corne de brume : un zombie devant le joueur est repoussé loin ; derrière, rien', () => {
    const { t, w } = arena('corne');
    const front = dummy(t, 3, 0, false);
    const back = dummy(t, -3, 0, false);
    front.frozen = back.frozen = 0;
    const before = front.pos.distanceTo(t.game.player.pos);
    t.playUntil(() => hitsOn(t, w, front).length > 0, CORNE.firstDelay + 1);
    t.play(0.4);
    expect(front.pos.distanceTo(t.game.player.pos)).toBeGreaterThan(before + 1.5);
    expect(hitsOn(t, w, back)).toHaveLength(0);
  });

  it('Rot sonique : plus le joueur ramasse d XP, plus le rot fait mal', () => {
    const a = arena('rot');
    const za = dummy(a.t, 2);
    a.t.playUntil(() => hitsOn(a.t, a.w, za).length > 0, ROT.firstDelay + 1);
    const plain = hitsOn(a.t, a.w, za)[0].damage;
    const b = arena('rot');
    const zb = dummy(b.t, 2);
    b.t.game.xpGathered = 100;
    b.t.playUntil(() => hitsOn(b.t, b.w, zb).length > 0, ROT.firstDelay + 1);
    expect(hitsOn(b.t, b.w, zb)[0].damage).toBeGreaterThan(plain * 2);
  });

  it('Odeur d alcool : un zombie dans l aura est confus et prend des dégâts', () => {
    const { t, w } = arena('odeur');
    const z = dummy(t, ODEUR.radius * 0.6);
    t.play(1.2);
    expect(z.confused).toBeGreaterThan(0);
    expect(hitsOn(t, w, z).length).toBeGreaterThan(0);
  });

  it('Plateau de serveur : il bloque un coup puis se recharge', () => {
    const { t, w } = arena('plateau');
    t.play(0.1);
    const hp = t.game.health.hp;
    const z = dummy(t, 0.9, 0, false);
    z.frozen = 0;
    t.playUntil(() => t.events('playerHurt').length > 0, 5);
    expect(t.events('playerHurt')[0].blocked).toBe(true);
    expect(t.game.health.hp).toBe(hp);
    expect(w.projectiles.filter((p) => p.active).length).toBe(PLATEAU.count - 1);
  });

  it('toutes se débloquent en boutique', () => {
    for (const id of ['weizen', 'tireuse', 'corne', 'rot', 'odeur', 'plateau']) expect(catalog().some((e) => e.key === `weapon:${id}`)).toBe(true);
  });
});
