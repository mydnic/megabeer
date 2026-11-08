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

/**
 * Note les zombies du débarquement : sortis de terre dans l'anneau des cloches (les arrivées
 * normales se font plus loin), avec le temps de run de leur apparition.
 */
function watchSurge(t: ReturnType<typeof createTestGame>) {
  const surge: { zombie: Zombie; at: number; quarter: number }[] = [];
  t.game.events.on('zombieSpawned', ({ zombie }) => {
    const d = groundDist(zombie.pos, t.game.player.pos);
    if (d >= BELLS.maxDist * 1.05) return;
    // Quart du cercle où il sort, dans le repère du joueur à cet instant (devant, droite, derrière, gauche)
    const p = t.game.player.pos, up = p.clone().normalize(), fwd = t.game.player.facing;
    const v = zombie.pos.clone().sub(p), right = new THREE.Vector3().crossVectors(fwd, up);
    const quarter = Math.floor((Math.atan2(v.dot(right), v.dot(fwd)) + Math.PI) / (Math.PI / 2)) % 4;
    surge.push({ zombie, at: t.game.runTime, quarter });
  });
  return surge;
}

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

  it("débarquement : un seul type d'ennemi sort de terre en continu tout autour du joueur, pendant 30 s", () => {
    const t = beforeBells();
    const surge = watchSurge(t);
    t.playUntil(() => t.events('bellsLanding').length > 0, 10);
    const start = t.game.runTime;
    const { model } = t.events('bellsLanding')[0];
    t.play(BELLS.duration + 3);

    // En continu : il en arrive encore au début, au milieu et à la fin
    for (const k of [0.1, 0.5, 0.9]) {
      const from = start + BELLS.duration * k - 1, to = from + 2;
      expect(surge.some((s) => s.at > from && s.at < to)).toBe(true);
    }
    // En masse : au rythme prévu, et c'est fini après 30 s
    const total = BELLS.perSecond * BELLS.duration;
    expect(surge.length).toBeGreaterThan(total * 0.9);
    expect(surge.length).toBeLessThan(total * 1.1);
    expect(surge.every((s) => s.at <= start + BELLS.duration + 0.05)).toBe(true);
    expect(t.events('bellsSurgeEnded')[0].count).toBe(surge.length);
    // Un seul type d'ennemi pour tout le débarquement
    expect(surge.every((s) => s.zombie.model === model)).toBe(true);

    // Tout autour : chaque quart du cercle reçoit des zombies
    expect(new Set(surge.map((s) => s.quarter)).size).toBe(4);
  });

  it('reviennent toutes les 2 minutes', () => {
    const t = beforeBells();
    t.play(BELLS.warn + 2);
    expect(t.events('bellsLanding')).toHaveLength(1);
    t.game.runTime = BELLS.every * 2 - BELLS.warn - 1;
    t.play(BELLS.warn + 2);
    expect(t.events('bellsLanding')).toHaveLength(2);
  });

  it('se taisent quand la run est figée, et le débarquement aussi', () => {
    const t = beforeBells();
    t.game.runTime = BELLS.every - 1; // l'heure de sonner est passée, mais le jeu est en pause
    t.game.pause();
    t.play(BELLS.warn + 3);
    expect(t.events('bellsRinging')).toHaveLength(0);
    t.game.resume();
    t.playUntil(() => t.events('bellsLanding').length > 0, 10);
    const surge = watchSurge(t);
    t.play(2);
    t.game.pause();
    const n = surge.length;
    t.play(5);
    expect(surge.length).toBe(n);
  });

  it('en Bourré, le débarquement est plus gros', () => {
    const t = beforeBells('bourre');
    t.playUntil(() => t.events('bellsLanding').length > 0, 10);
    t.play(BELLS.duration + 1);
    const total = BELLS.perSecond * BELLS.duration * DIFFICULTIES.bourre.count;
    expect(t.events('bellsSurgeEnded')[0].count).toBeGreaterThan(total * 0.9);
  });
});
