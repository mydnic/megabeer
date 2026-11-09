import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/config/enemies';
import { createTestGame } from '../support/testGame';

const P = ENEMIES.reliques.protector;

/** Une arène calme, figée (personne ne bouge), Canette désarmée. */
function arena() {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  const away = t.game.player.facing.clone();
  /** Fait apparaître un ennemi à `dist` m devant le joueur, décalé de `side` m. */
  const put = (enemy: 'reliques' | 'zombie', dist: number, side = 0) => t.game.spawnZombie(enemy, t.inFront(dist, side), away)!;
  /** Coup de `dmg` PV sur `z` : PV perdus. */
  const hit = (z: ReturnType<typeof put>, dmg: number) => {
    const before = z.hp;
    t.game.hitZombie(z, dmg, false, z.pos, away);
    return before - z.hp;
  };
  return { t, put, hit };
}

describe('Le Moine porte-reliques', () => {
  it("arrive à 6:00 dans le roster de l'Abbaye", () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.game.loadout.weapons[0].mods.range = 0;
    t.game.cheats.god = true;
    t.game.runTime = 360 + 10;
    t.play(40);
    expect(t.events('zombieSpawned').some((e) => e.zombie.enemy === 'reliques')).toBe(true);
  });

  it('ses voisins prennent moitié moins de dégâts, et le coup est marqué comme amorti', () => {
    const { t, put, hit } = arena();
    put('reliques', 12);
    const zombie = put('zombie', 12, 2);
    expect(hit(zombie, 4)).toBeCloseTo(4 * (1 - P.reduction));
    expect(t.events('zombieHit').at(-1)!.shielded).toBe(true);
  });

  it('hors de son halo, les dégâts sont entiers', () => {
    const { t, put, hit } = arena();
    put('reliques', 12);
    const zombie = put('zombie', 12, P.radius + 2);
    expect(hit(zombie, 4)).toBe(4);
    expect(t.events('zombieHit').at(-1)!.shielded).toBe(false);
  });

  it("il ne se protège pas lui-même, et deux porte-reliques ne se cumulent pas", () => {
    const { put, hit } = arena();
    const a = put('reliques', 12);
    put('reliques', 12, -2);
    const zombie = put('zombie', 12, 2);
    expect(hit(zombie, 4)).toBeCloseTo(4 * (1 - P.reduction));
    // a est protégé par l'autre porte-reliques, mais pas par lui-même : une seule réduction
    expect(hit(a, 4)).toBeCloseTo(4 * (1 - P.reduction));
  });

  it('seul, il encaisse les coups en entier', () => {
    const { put, hit } = arena();
    const a = put('reliques', 12);
    expect(hit(a, 4)).toBe(4);
  });

  it('mort, il ne protège plus personne', () => {
    const { put, hit } = arena();
    const a = put('reliques', 12);
    const zombie = put('zombie', 12, 2);
    hit(a, 999);
    expect(a.dead).toBe(true);
    expect(hit(zombie, 4)).toBe(4);
  });
});
