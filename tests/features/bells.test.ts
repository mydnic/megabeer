import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BELLS } from '../../src/config/abbey';
import { DIFFICULTIES } from '../../src/config/spawn';
import { PLANET_RADIUS } from '../../src/config/world';
import type { Zombie } from '../../src/enemies/zombie';
import { createTestGame } from '../support/testGame';

/** Une run au sol, Blonde désarmée et godmode, juste avant la première sonnerie. */
function beforeBells(difficulty: keyof typeof DIFFICULTIES = 'sobre') {
  const t = createTestGame();
  t.game.difficulty = difficulty;
  t.startRunAndLand();
  t.game.loadout.weapons[0].mods.range = 0;
  t.game.cheats.god = true;
  t.play(1 / 60);
  t.game.runTime = BELLS.every - BELLS.warn - 1;
  return t;
}

const groundDist = (a: THREE.Vector3, b: THREE.Vector3) => a.angleTo(b) * PLANET_RADIUS;

describe("Les cloches de l'Abbaye", () => {
  it('sonnent à 2:00 et préviennent quelques secondes avant le débarquement', () => {
    const t = beforeBells();
    t.play(1.5);
    expect(t.events('bellsRinging')).toHaveLength(1);
    expect(t.events('bellsLanding')).toHaveLength(0);
    const ringAt = t.game.runTime;
    t.playUntil(() => t.events('bellsLanding').length > 0, BELLS.warn + 1);
    expect(t.game.runTime - ringAt).toBeGreaterThan(BELLS.warn - 1);
    expect(t.events('bellToll')).toHaveLength(BELLS.tolls);
  });

  it('font sortir une horde de terre en cercle autour du joueur', () => {
    const t = beforeBells();
    // Les zombies du débarquement : ceux apparus juste avant l'annonce, dans le même pas de jeu
    const spawned: Zombie[] = [];
    let landed: Zombie[] = [];
    t.game.events.on('zombieSpawned', ({ zombie }) => spawned.push(zombie));
    t.game.events.on('bellsLanding', ({ count }) => { landed = spawned.slice(-count); });
    t.playUntil(() => t.events('bellsLanding').length > 0, 10);
    expect(t.events('bellsLanding')[0].count).toBe(BELLS.count);
    expect(landed).toHaveLength(BELLS.count);
    const p = t.game.player.pos;
    for (const z of landed) {
      const d = groundDist(z.pos, p);
      expect(d).toBeGreaterThan(BELLS.minDist * 0.95);
      expect(d).toBeLessThan(BELLS.maxDist * 1.05);
      expect(z.rise).toBeGreaterThan(0);
    }
    // Tout autour : aucune issue franche, chaque quart du cercle est occupé
    const up = p.clone().normalize();
    const fwd = t.game.player.facing;
    const right = new THREE.Vector3().crossVectors(fwd, up);
    const quarters = new Set(landed.map((z: Zombie) => {
      const v = z.pos.clone().sub(p);
      return Math.floor((Math.atan2(v.dot(right), v.dot(fwd)) + Math.PI) / (Math.PI / 2)) % 4;
    }));
    expect(quarters.size).toBe(4);
  });

  it('reviennent toutes les 2 minutes', () => {
    const t = beforeBells();
    t.play(BELLS.warn + 2);
    expect(t.events('bellsLanding')).toHaveLength(1);
    t.game.runTime = BELLS.every * 2 - BELLS.warn - 1;
    t.play(BELLS.warn + 2);
    expect(t.events('bellsLanding')).toHaveLength(2);
  });

  it('se taisent quand la run est figée', () => {
    const t = beforeBells();
    t.game.runTime = BELLS.every - 1; // l'heure de sonner est passée, mais le jeu est en pause
    t.game.pause();
    t.play(BELLS.warn + 3);
    expect(t.events('bellsRinging')).toHaveLength(0);
  });

  it('en Bourré, le débarquement est plus gros', () => {
    const t = beforeBells('bourre');
    t.playUntil(() => t.events('bellsLanding').length > 0, 10);
    expect(t.events('bellsLanding')[0].count).toBe(Math.round(BELLS.count * DIFFICULTIES.bourre.count));
  });
});
