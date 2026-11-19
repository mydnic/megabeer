import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALLIES, ALLY_RULES, type AllyId } from '../../src/config/allies';
import { DECOR_LAYOUT } from '../../src/config/decor';
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

/** Une run calme, l'arme désarmée ; l'allié `kind` posé juste devant le joueur, qui le rejoint. */
function withAlly(kind: AllyId = 'gandalf') {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  t.game.cheats.god = true;
  t.game.allies.clear();
  t.game.allies.placeAt(kind, t.inFront(1));
  t.play(0.1);
  return t;
}
const withGandalf = () => withAlly('gandalf');

/** Un zombie solide à `d` m de l'allié, sur son côté. */
function zombieBeside(t: ReturnType<typeof withAlly>, d: number) {
  const g = t.game.allies.list[0];
  const up = g.pos.clone().normalize();
  const side = new THREE.Vector3().crossVectors(up, g.facing).normalize();
  const z = t.game.spawnZombie('zombie', g.pos.clone().addScaledVector(side, d), g.facing.clone())!;
  z.hp = z.maxHp = 1e6;
  return z;
}

describe('Les alliés', () => {
  it('chaque abbaye a son allié, qui attend', () => {
    const t = createTestGame();
    t.startRunAndLand();
    const list = t.game.allies.list;
    expect(abbeySites).toHaveLength(DECOR_LAYOUT.abbeyCount);
    expect(list.map((a) => a.kind).sort()).toEqual((Object.keys(ALLIES) as AllyId[]).slice(0, abbeySites.length).sort());
    const homes = new Set(list.map((a) => [...abbeySites].sort((x, y) => x.dir.angleTo(a.pos) - y.dir.angleTo(a.pos))[0]));
    expect(homes.size).toBe(list.length);
    for (const a of list) {
      expect(a.state).toBe('waiting');
      const home = [...abbeySites].sort((x, y) => x.dir.angleTo(a.pos) - y.dir.angleTo(a.pos))[0];
      expect(dist(a.pos, home.dir)).toBeLessThan(ALLY_RULES.searchRadius + 1);
    }
  });

  it('touché, il rejoint le joueur et le suit quand il marche', () => {
    const t = withGandalf();
    expect(t.events('allyJoined').map((e) => e.kind)).toEqual(['gandalf']);
    const g = t.game.allies.list[0];
    expect(g.state).toBe('following');
    t.play(5, { moveY: 1 });
    expect(dist(g.pos, t.game.player.pos)).toBeLessThan(ALLY_RULES.followDistance + ALLY_RULES.followSide + 2);
  });

  it('plusieurs alliés suivent le joueur chacun à sa place, sans se marcher dessus', () => {
    const t = withAlly('krilin');
    t.game.allies.placeAt('yoda', t.inFront(1));
    t.game.allies.placeAt('steve', t.inFront(1));
    t.play(0.1);
    t.play(4, { moveY: 1 });
    const l = t.game.allies.list;
    expect(l.every((a) => a.state === 'following')).toBe(true);
    for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) expect(dist(l[i].pos, l[j].pos)).toBeGreaterThan(1);
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

  it('Krilin soigne le joueur tant qu il le suit', () => {
    const t = withAlly('krilin');
    t.game.health.hp = 10;
    t.play(4);
    const K = ALLIES.krilin.power;
    expect(t.game.health.hp).toBeGreaterThan(10 + K.heal * 3);
    expect(t.events('allyHealed').length).toBeGreaterThan(0);
  });

  it('le Kienzan de Krilin tranche les ennemis sur sa ligne, une fois chacun, puis s éteint', () => {
    const t = withAlly('krilin');
    const K = ALLIES.krilin.power;
    const a = zombieBeside(t, 4), b = zombieBeside(t, 8), off = zombieBeside(t, -K.range * 0.9);
    for (const z of [a, b, off]) z.frozen = 100;
    t.game.allies.list[0].cooldown = 0.01;
    // Le plus proche est visé ; le second, sur la même ligne, est tranché aussi ; celui de l'autre côté, non
    t.playUntil(() => t.events('allyPower').length > 0, K.every + 1);
    expect(t.game.allies.discs).toHaveLength(1);
    t.playUntil(() => t.events('kienzanFaded').length > 0, K.reach / K.speed + 1);
    expect(a.hp).toBeLessThan(1e6);
    expect(b.hp).toBeLessThan(1e6);
    expect(1e6 - a.hp).toBeCloseTo(1e6 - b.hp, 0);
    expect(off.hp).toBe(1e6);
    expect(t.game.allies.discs).toHaveLength(0);
  });

  it('Krilin garde son Kienzan quand personne n est à portée', () => {
    const t = withAlly('krilin');
    t.play(ALLIES.krilin.power.every + 1);
    expect(t.events('allyPower')).toHaveLength(0);
    expect(t.game.allies.discs).toHaveLength(0);
  });

  it('Yoda repousse les ennemis autour de lui et les sonne', () => {
    const t = withAlly('yoda');
    const Y = ALLIES.yoda.power;
    const g = t.game.allies.list[0];
    const near = zombieBeside(t, Y.radius * 0.5), far = zombieBeside(t, Y.radius * 4);
    const before = dist(near.pos, g.pos);
    g.cooldown = 0.01;
    t.playUntil(() => t.events('allyPower').length > 0, Y.every + 1);
    expect(near.frozen).toBeGreaterThan(Y.stun * 0.8);
    // Mesuré depuis là où il a poussé (lui suit le joueur)
    const from = t.events('allyPower')[0].pos;
    expect(dist(near.pos, from)).toBeLessThan(before + 0.5);
    t.play(0.5);
    expect(dist(near.pos, from)).toBeGreaterThan(before + 1.5);
    expect(far.frozen).toBe(0);
  });

  it('Steve pose un bloc de TNT qui explose plus tard et blesse les ennemis autour, pas le joueur', () => {
    const t = withAlly('steve');
    t.game.cheats.god = false;
    const T = ALLIES.steve.power;
    t.playUntil(() => t.events('tntPlaced').length > 0, T.every + 1);
    const at = t.events('tntPlaced')[0].pos;
    const up = at.clone().normalize();
    const side = new THREE.Vector3().crossVectors(up, t.game.allies.list[0].facing).normalize();
    const near = t.game.spawnZombie('zombie', at.clone().addScaledVector(side, T.radius * 0.5), side.clone())!;
    near.hp = near.maxHp = 1e6;
    near.frozen = 10;
    const hp = t.game.health.hp;
    t.play(T.fuse * 0.5);
    expect(t.events('tntExploded')).toHaveLength(0);
    t.playUntil(() => t.events('tntExploded').length > 0, T.fuse);
    expect(near.hp).toBeLessThan(1e6);
    expect(t.game.health.hp).toBe(hp);
  });
});
