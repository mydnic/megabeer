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

/** Position de `p` dans le repère de la ligne : avancée le long de la ligne et écart sur le côté (m). */
function onLine(p: THREE.Vector3, from: THREE.Vector3, dir: THREE.Vector3) {
  const off = p.clone().sub(from);
  const up = from.clone().normalize();
  off.addScaledVector(up, -off.dot(up));
  const along = off.dot(dir);
  return { along, side: off.addScaledVector(dir, -along).length() };
}

/** Pas de côté pendant tout l'élan et la charge : le joueur esquive. */
const dodge = { moveX: 1 };

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
    expect(onLine(t.game.player.pos, aim.from, aim.dir).side).toBeLessThan(0.2);
    // Il reste planté pendant qu'il prend son élan, son tonneau encore dans les bras
    const at = monk.pos.clone();
    t.play(C.windup * 0.6);
    expect(monk.pos.distanceTo(at)).toBeLessThan(0.3);
    expect(monk.barrel).toBe('held');
  });

  it('puis il fonce derrière son tonneau qui roule devant lui : le tonneau renverse le joueur et éclate', () => {
    const { t, monk } = duel(C.range - 2);
    t.playUntil(() => t.events('chargeAimed').length > 0, 4);
    t.playUntil(() => monk.charge === 'charge', C.windup + 0.5);
    // Le tonneau roule en tête, le moine court derrière, mains vides
    t.play(0.1);
    expect(monk.barrel).toBe('rolling');
    expect(monk.model).toBe(C.emptyModel);
    const aim = t.events('chargeAimed')[0];
    expect(onLine(monk.barrelPos, aim.from, aim.dir).along).toBeGreaterThan(onLine(monk.pos, aim.from, aim.dir).along);
    expect(t.playUntil(() => t.events('playerHurt').some((h) => !h.blocked), 2)).toBe(true);
    expect(t.events('playerHurt').find((h) => !h.blocked)!.damage).toBe(C.damage);
    expect(t.events('barrelBroke')).toHaveLength(1);
    // Le tonneau éclaté, la charge s'arrête net : il reste sonné, sans tonneau
    expect(monk.barrel).toBe('broken');
    expect(monk.charge).toBe('recover');
  });

  it("il fonce en ligne droite, et le joueur qui sort de la ligne pendant l'élan esquive", () => {
    const { t, monk } = duel(C.range - 2);
    t.playUntil(() => t.events('chargeAimed').length > 0, 4);
    const aim = t.events('chargeAimed')[0];
    t.playUntil(() => monk.charge === 'recover', C.windup + C.length / C.speed + 1, dodge);
    expect(t.events('playerHurt').filter((h) => !h.blocked)).toHaveLength(0);
    // Toute la ligne, sans dévier
    const end = onLine(monk.pos, aim.from, aim.dir);
    expect(end.side).toBeLessThan(0.6);
    expect(end.along).toBeGreaterThan(C.length - C.barrelAhead - 1);
    // Le tonneau s'arrête au bout de la ligne, intact
    expect(monk.barrel).toBe('resting');
    expect(t.events('barrelBroke')).toHaveLength(0);
  });

  it('raté, il reste sonné le temps de ramasser son tonneau, puis repart vers le joueur', () => {
    const { t, monk } = duel(C.range - 2);
    t.playUntil(() => t.events('chargeAimed').length > 0, 4);
    t.playUntil(() => monk.charge === 'recover', C.windup + C.length / C.speed + 1, dodge);
    const at = monk.pos.clone();
    t.play(C.recover * 0.7);
    expect(monk.pos.distanceTo(at)).toBeLessThan(0.3);
    t.play(C.recover * 0.3 + 0.1);
    expect(monk.barrel).toBe('held');
    expect(monk.model).toBe(ENEMIES.tonnelier.model);
    t.play(1.5);
    expect(monk.pos.distanceTo(at)).toBeGreaterThan(1);
  });

  it("tonneau éclaté, il n'en reprend un qu'après un délai : pas de nouvelle charge avant", () => {
    const { t, monk } = duel(C.range - 2);
    t.game.cheats.god = true;
    t.playUntil(() => t.events('barrelBroke').length > 0, C.windup + 3);
    t.play(C.recover + 0.3);
    expect(monk.barrel).toBe('broken');
    expect(monk.model).toBe(C.emptyModel);
    expect(t.events('chargeAimed')).toHaveLength(1);
    t.play(C.cooldown + 0.5);
    expect(monk.barrel).toBe('held');
  });
});
