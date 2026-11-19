import { describe, expect, it } from 'vitest';
import { SABRE as T } from '../../src/config/arsenal';
import { ENEMIES } from '../../src/config/enemies';
import { EVOLUTIONS } from '../../src/config/evolutions';
import type { Zombie } from '../../src/enemies/zombie';
import { createTestGame } from '../support/testGame';

/** Une run au sol sans zombies, le Sabre laser équipé ; la Canette désarmée. */
function arena() {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  const saber = t.game.loadout.add('sabre')!;
  saber.mods.critChance = -T.critChance;
  return { t, saber };
}
/** Un zombie qui ne meurt pas, immobile, à `dist` m devant (et `side` m sur le côté). */
function dummy(t: ReturnType<typeof createTestGame>, dist: number, side = 0): Zombie {
  const z = t.game.spawnZombie('zombie', t.inFront(dist, side), t.game.player.facing.clone().negate())!;
  z.hp = 1e6;
  z.frozen = 1e6;
  return z;
}
const hitsOn = (t: ReturnType<typeof createTestGame>, w: unknown, z: Zombie) => t.events('zombieHit').filter((e) => e.weapon === w && e.zombie === z);

describe('Le Sabre laser', () => {
  it('sans zombie à portée, il ne frappe pas', () => {
    const { t, saber } = arena();
    dummy(t, T.radius + 5);
    t.play(T.firstDelay + 2);
    expect(t.events('zombieHit').filter((e) => e.weapon === saber)).toHaveLength(0);
  });

  it('un coup en arc vers le zombie le plus proche : il le frappe, une fois par coup ; un zombie dans son dos est épargné', () => {
    const { t, saber } = arena();
    const front = dummy(t, T.radius * 0.6);
    const back = dummy(t, -T.radius * 0.9);
    t.play(T.firstDelay + T.swingTime + 0.05);
    expect(hitsOn(t, saber, front)).toHaveLength(1);
    expect(hitsOn(t, saber, front)[0].damage).toBeCloseTo(T.damage, 5);
    expect(hitsOn(t, saber, back)).toHaveLength(0);
  });

  it('il enchaîne les coups à sa cadence', () => {
    const { t, saber } = arena();
    saber.mods.knock = 0; // le zombie reste à portée
    const z = dummy(t, T.radius * 0.6);
    t.play(T.firstDelay + T.cooldown * 3 + 0.1);
    expect(hitsOn(t, saber, z).length).toBeGreaterThanOrEqual(3);
  });

  it('la lame coupe une bouteille ennemie qui passe dans son arc', () => {
    const { t, saber } = arena();
    const monk = dummy(t, T.radius * 0.8);
    // Au début d'un coup, une bouteille part de la lame vers le joueur
    t.playUntil(() => saber.projectiles.some((p) => p.active), T.firstDelay + 1);
    const blade = saber.projectiles.find((p) => p.active)!;
    t.game.shots.launch(monk, blade.pos.clone(), t.game.player.pos.clone(), ENEMIES.lanceur.thrower!, 10);
    t.play(T.swingTime);
    expect(t.events('enemyShotBlocked').length).toBeGreaterThan(0);
  });

  it('évolution Sabre double : une lame de chaque côté, le zombie dans son dos est frappé aussi', () => {
    const { t, saber } = arena();
    saber.mods.evolved = 1;
    const front = dummy(t, T.radius * 0.7);
    const back = dummy(t, -T.radius * 0.7);
    t.play(T.firstDelay + T.swingTime + 0.05);
    expect(hitsOn(t, saber, front)).toHaveLength(1);
    expect(hitsOn(t, saber, back)).toHaveLength(1);
    expect(EVOLUTIONS.sabre.item).toBe('mousseEpaisse');
  });
});
