import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RADIO } from '../../src/config/radio';
import { PLANET_RADIUS } from '../../src/config/world';
import { createTestGame } from '../support/testGame';

/** Hasard à graine fixe : même point d'arrivée et même cachette à chaque passage. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seeded(9)); });
afterEach(() => { vi.restoreAllMocks(); });

const E = { actionPressed: true, action: true };
const dist = (a: THREE.Vector3, b: THREE.Vector3) => a.angleTo(b) * PLANET_RADIUS;

/** Une run calme, arme désarmée, la radio posée à côté du joueur (à `side` m sur sa droite). */
function nearRadio(side = 1.2) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  t.game.cheats.god = true;
  let ok = false;
  for (const s of [side, side + 0.5, side + 1, -side]) if (!ok) ok = t.game.radio.placeAt(t.inFront(0.2, s));
  expect(ok).toBe(true);
  return t;
}

/** Un point au sol à `d` m de `r`, du côté opposé au joueur. */
function away(t: ReturnType<typeof nearRadio>, r: THREE.Vector3, d: number) {
  const up = r.clone().normalize();
  const dir = r.clone().sub(t.game.player.pos);
  dir.addScaledVector(up, -dir.dot(up)).normalize();
  return up.multiplyScalar(PLANET_RADIUS).addScaledVector(dir, d);
}
/** La radio allumée de près, puis le joueur posé à 12 m de là. */
function playing() {
  const t = nearRadio();
  t.play(0.05);
  t.play(0.05, E);
  expect(t.game.radio.state).toBe('playing');
  const r = t.game.radio.pos!;
  const back = r.clone().normalize().multiplyScalar(PLANET_RADIUS).addScaledVector(away(t, r, 1).sub(r).normalize(), -12);
  t.game.player.reset(back, t.game.player.facing.clone());
  return t;
}

describe('La radio planquée', () => {
  it('une radio est cachée dès le début de la run, loin du point d arrivée, éteinte', () => {
    const t = createTestGame();
    const spawn = t.startRunAndLand();
    expect(t.game.radio.pos).not.toBeNull();
    expect(dist(t.game.radio.pos!, spawn.dir)).toBeGreaterThanOrEqual(RADIO.minFromSpawn);
    expect(t.game.radio.state).toBe('idle');
  });

  it('à portée, la touche d action l allume ; de loin, non', () => {
    const t = nearRadio();
    t.play(0.1);
    expect(t.game.radio.focus).toBe(true);
    t.play(0.05, E);
    expect(t.events('radioOn')).toHaveLength(1);
    expect(t.game.radio.state).toBe('playing');
    // Une seconde radio, loin : pas de focus
    const far = createTestGame();
    far.startRunAndLand();
    far.play(0.1, E);
    expect(far.events('radioOn')).toHaveLength(0);
  });

  it('allumée, elle attire la horde : les zombies vont vers elle et la frappent, pas le joueur', () => {
    const t = playing();
    const r = t.game.radio.pos!.clone();
    const z = t.game.spawnZombie('zombie', away(t, r, 8), t.game.player.facing.clone())!;
    z.hp = 1e6;
    const before = dist(z.pos, r);
    t.playUntil(() => t.events('radioHit').length > 0, 15);
    expect(dist(z.pos, r)).toBeLessThan(before);
    expect(t.events('radioHit').length).toBeGreaterThan(0);
    expect(t.events('playerHurt')).toHaveLength(0);
  });

  it('à force de coups elle casse, et la horde revient vers le joueur', () => {
    const t = playing();
    const r = t.game.radio.pos!.clone();
    for (let i = 0; i < 6; i++) { const z = t.game.spawnZombie('zombie', away(t, r, 1.5 + i * 0.4), t.game.player.facing.clone())!; z.hp = 1e6; }
    t.playUntil(() => t.events('radioBroken').length > 0, 120);
    expect(t.events('radioBroken')).toHaveLength(1);
    expect(t.game.radio.state).toBe('broken');
    expect(t.game.radio.hp).toBe(0);
    expect(t.game.horde.decoy).toBeNull();
  });
});
