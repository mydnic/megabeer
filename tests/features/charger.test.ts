import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/config/enemies';
import { PLANET_RADIUS } from '../../src/config/world';
import { createTestGame } from '../support/testGame';

const C = ENEMIES.tonnelier.charger;

/** Une arène calme, Blonde désarmée, et un Frère tonnelier face au joueur à `dist` m. */
function duel(dist: number) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  const monk = t.game.spawnZombie('tonnelier', t.inFront(dist), t.game.player.facing.clone().negate())!;
  return { t, monk };
}

/** Distance au sol (m) entre deux points. */
const ground = (a: THREE.Vector3, b: THREE.Vector3) => a.angleTo(b) * PLANET_RADIUS;

describe('Le Frère tonnelier', () => {
  it("arrive à 4:00 dans le roster de l'Abbaye", () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.game.loadout.weapons[0].mods.range = 0;
    t.game.cheats.god = true;
    t.game.runTime = 240 + 10; // après les cloches de 4:00
    t.play(40);
    expect(t.events('zombieSpawned').some((e) => e.zombie.enemy === 'tonnelier')).toBe(true);
  });

  it("à portée, il s'arrête et marque au sol la ligne de sa charge, droit sur le joueur", () => {
    const { t, monk } = duel(C.range + 6);
    expect(t.playUntil(() => t.events('chargeAimed').length > 0, 8)).toBe(true);
    const aim = t.events('chargeAimed')[0];
    expect(aim.zombie).toBe(monk);
    expect(aim.length).toBe(C.length);
    expect(aim.width).toBe(C.width);
    expect(ground(monk.pos, t.game.player.pos)).toBeLessThan(C.range + 0.5);
    // La ligne passe par le joueur
    const toPlayer = t.game.player.pos.clone().sub(aim.from);
    const up = aim.from.clone().normalize();
    toPlayer.addScaledVector(up, -toPlayer.dot(up)).normalize();
    expect(aim.dir.dot(toPlayer)).toBeGreaterThan(0.98);
    // Il reste planté pendant qu'il prend son élan
    const at = monk.pos.clone();
    t.play(C.windup * 0.6);
    expect(monk.pos.distanceTo(at)).toBeLessThan(0.3);
  });

  it('puis il fonce en ligne droite, très vite, et renverse le joueur resté sur la ligne', () => {
    const { t, monk } = duel(C.range - 2);
    t.playUntil(() => t.events('chargeAimed').length > 0, 4);
    const aim = t.events('chargeAimed')[0];
    expect(t.playUntil(() => t.events('playerHurt').some((h) => !h.blocked), C.windup + 2)).toBe(true);
    expect(t.events('playerHurt').find((h) => !h.blocked)!.damage).toBe(C.damage);
    // Il ne dévie pas de sa ligne
    t.play(0.4);
    const off = monk.pos.clone().sub(aim.from);
    const up = aim.from.clone().normalize();
    off.addScaledVector(up, -off.dot(up));
    const side = off.clone().addScaledVector(aim.dir, -off.dot(aim.dir)).length();
    expect(side).toBeLessThan(0.6);
    expect(off.dot(aim.dir)).toBeGreaterThan(C.range - 3);
  });

  it("le joueur qui sort de la ligne pendant l'élan esquive la charge", () => {
    const { t } = duel(C.range - 2);
    t.playUntil(() => t.events('chargeAimed').length > 0, 4);
    t.play(C.windup + C.length / C.speed + 0.5, { moveX: 1 });
    expect(t.events('playerHurt').filter((h) => !h.blocked)).toHaveLength(0);
  });

  it("après sa charge, il reste sonné un moment avant de repartir vers le joueur", () => {
    const { t, monk } = duel(C.range - 2);
    t.game.cheats.god = true;
    t.playUntil(() => t.events('chargeAimed').length > 0, 4);
    t.play(C.windup + C.length / C.speed + 0.2);
    const at = monk.pos.clone();
    t.play(C.recover * 0.7);
    expect(monk.pos.distanceTo(at)).toBeLessThan(0.3);
    t.play(C.recover * 0.3 + 1);
    expect(monk.pos.distanceTo(at)).toBeGreaterThan(1);
  });

  it('il ne recharge pas aussitôt : il attend avant de reprendre son élan', () => {
    const { t } = duel(C.range - 2);
    t.game.cheats.god = true;
    t.playUntil(() => t.events('chargeAimed').length > 0, 4);
    t.play(C.windup + C.length / C.speed + C.recover + 0.3);
    expect(t.events('chargeAimed')).toHaveLength(1);
  });
});
