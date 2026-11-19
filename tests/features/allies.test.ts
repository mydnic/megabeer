import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALLIES, ALLY_RULES } from '../../src/config/allies';
import { PLANET_RADIUS } from '../../src/config/world';
import { abbeySites } from '../../src/world/terrain';
import { createTestGame } from '../support/testGame';

/** Hasard à graine fixe : même point d'arrivée à chaque passage. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seeded(6)); });
afterEach(() => { vi.restoreAllMocks(); });

const G = ALLIES.gandalf.power;
const dist = (a: THREE.Vector3, b: THREE.Vector3) => a.angleTo(b) * PLANET_RADIUS;

/** Une run calme, l'arme désarmée ; Gandalf posé juste devant le joueur, qui le rejoint. */
function withGandalf() {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  t.game.cheats.god = true;
  t.game.allies.clear();
  t.game.allies.placeAt('gandalf', t.inFront(1));
  t.play(0.1);
  return t;
}

describe('Les alliés', () => {
  it('Gandalf attend dans une abbaye, pas celle de l arrivée', () => {
    const t = createTestGame();
    const spawn = t.startRunAndLand();
    const g = t.game.allies.list.find((a) => a.kind === 'gandalf')!;
    expect(g).toBeDefined();
    expect(g.state).toBe('waiting');
    const nearest = [...abbeySites].sort((a, b) => a.dir.angleTo(spawn.dir) - b.dir.angleTo(spawn.dir))[0];
    const at = [...abbeySites].sort((a, b) => a.dir.angleTo(g.pos) - b.dir.angleTo(g.pos))[0];
    expect(at).not.toBe(nearest);
    expect(dist(g.pos, at.dir)).toBeLessThan(ALLY_RULES.searchRadius + 1);
  });

  it('touché, il rejoint le joueur et le suit quand il marche', () => {
    const t = withGandalf();
    expect(t.events('allyJoined').map((e) => e.kind)).toEqual(['gandalf']);
    const g = t.game.allies.list[0];
    expect(g.state).toBe('following');
    t.play(5, { moveY: 1 });
    expect(dist(g.pos, t.game.player.pos)).toBeLessThan(ALLY_RULES.followDistance + ALLY_RULES.followSide + 2);
  });

  it('au bout d une minute, il s en va (et ne revient pas)', () => {
    const t = withGandalf();
    t.play(ALLY_RULES.followTime - 1);
    expect(t.events('allyLeft')).toHaveLength(0);
    t.play(2);
    expect(t.events('allyLeft').map((e) => e.kind)).toEqual(['gandalf']);
    expect(t.game.allies.list[0].state).toBe('gone');
    t.play(1);
    expect(t.events('allyJoined')).toHaveLength(1);
  });

  it('Gandalf frappe le sol de son bâton : les ennemis autour de lui sont pétrifiés, pas ceux au loin', () => {
    const t = withGandalf();
    const g = t.game.allies.list[0];
    const up = g.pos.clone().normalize();
    const side = new THREE.Vector3().crossVectors(up, g.facing).normalize();
    const near = t.game.spawnZombie('zombie', g.pos.clone().addScaledVector(side, G.radius * 0.5), g.facing.clone())!;
    const far = t.game.spawnZombie('zombie', g.pos.clone().addScaledVector(side, G.radius * 6), g.facing.clone())!;
    near.hp = far.hp = 1e6;
    t.playUntil(() => t.events('allyPower').length > 0, G.every + 1);
    expect(t.events('allyPower')[0].kind).toBe('gandalf');
    expect(near.frozen).toBeGreaterThan(G.duration * 0.8);
    expect(far.frozen).toBe(0);
  });
});
