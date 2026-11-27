import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACHIEVEMENTS } from '../../src/config/achievements';
import { GRAVE_BOSSES as G, VADOR as V } from '../../src/config/bosses';
import { TUNAS } from '../../src/config/tunas';
import { PLANET_RADIUS } from '../../src/config/world';
import type { Vador } from '../../src/game/vador';
import { randomSpawn } from '../../src/world/decor/layout';
import { createTestGame } from '../support/testGame';

/** Hasard à graine fixe : même arrivée, mêmes placements à chaque passage. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seeded(9)); });
afterEach(() => { vi.restoreAllMocks(); });

const dist = (a: THREE.Vector3, b: THREE.Vector3) => a.angleTo(b) * PLANET_RADIUS;
type T = ReturnType<typeof createTestGame>;
const press = (t: T) => t.play(1 / 60, { action: true, actionPressed: true });

/** Une run calme (pas de zombies, Canette désarmée) ; Vador posé à `d` m devant le joueur, face à lui. */
function withVador(d = 4) {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  const b = t.game.graveBosses.placeAt('vador', t.inFront(d));
  b.facing.copy(t.game.player.facing).negate();
  t.play(0.1);
  return { t, b };
}

/** Défie Vador (posé juste devant) et rend son contrôleur. */
function fight(d = 4) {
  const { t, b } = withVador(d);
  press(t);
  return { t, b, boss: t.game.bosses.find((x) => x.kind === 'vador') as Vador };
}

/** Le point `p` décalé de `d` m sur le côté, perpendiculairement à la ligne qui le relie à `from`. */
function sidestep(p: THREE.Vector3, from: THREE.Vector3, d: number) {
  const up = p.clone().normalize();
  const toward = from.clone().sub(p);
  toward.addScaledVector(up, -toward.dot(up)).normalize();
  // Tourner autour de la direction « vers from » fait glisser sur le côté
  return around(p, d, toward);
}

/** Un point au sol à `d` m d'un point, sur un grand cercle tiré d'une direction tangente. */
function around(at: THREE.Vector3, d: number, axis: THREE.Vector3) {
  return at.clone().normalize().applyAxisAngle(axis.clone().normalize(), d / PLANET_RADIUS);
}

describe('Dark Vador, boss optionnel d un cimetière', () => {
  it('il attend devant le portail d un cimetière loin du départ, dos au portail', () => {
    const t = createTestGame();
    const spawn = randomSpawn(() => true)!;
    const up = spawn.dir;
    const side = new THREE.Vector3().crossVectors(up, spawn.facing).normalize();
    const near = around(up, 20, side), far = around(up, 150, side);
    const out = spawn.facing.clone();
    t.game.startRun({ ...spawn, graveyards: [{ dir: near, out }, { dir: far, out }] });
    const [b] = t.game.graveBosses.list;
    expect(b.kind).toBe('vador');
    expect(b.waiting).toBe(true);
    expect(dist(b.pos, far)).toBeLessThan(G.searchRadius + 0.5);
    const bu = b.pos.clone().normalize();
    expect(b.facing.dot(out.clone().addScaledVector(bu, -out.dot(bu)).normalize())).toBeGreaterThan(0.99);
  });

  it('sans cimetière, il attend quand même, loin du départ', () => {
    const t = createTestGame();
    t.startRunAndLand();
    const [b] = t.game.graveBosses.list;
    expect(b?.kind).toBe('vador');
    expect(dist(b.pos, t.game.player.pos)).toBeGreaterThan(G.minFromSpawn - 5);
  });

  it('tant qu il attend, il ne se bat pas et les armes ne le visent pas', () => {
    const { t } = withVador();
    t.play(3);
    expect(t.game.bosses).toHaveLength(0);
    expect(t.game.horde.zombies.some((z) => z.def.name === V.name)).toBe(false);
  });

  it('à portée, la touche d action le défie : le combat commence, une seule fois', () => {
    const { t, b } = withVador();
    expect(t.game.graveBosses.focus).toBe(b);
    press(t);
    expect(t.game.bosses.map((x) => x.kind)).toEqual(['vador']);
    expect(b.waiting).toBe(false);
    expect(t.events('graveBossChallenged')).toHaveLength(1);
    expect(t.events('bossSpawned')).toHaveLength(1);
    press(t);
    expect(t.events('bossSpawned')).toHaveLength(1);
  });

  it('on le défie même si un autre boss est debout ; chacun tombe de son côté', () => {
    const { t, b } = withVador();
    t.game.cheats.god = true;
    t.game.spawnBoss();
    press(t);
    expect(b.waiting).toBe(false);
    expect(t.game.bosses.map((x) => x.kind).sort()).toEqual(['sonneur', 'vador']);
    // Le Sonneur tombe : Vador reste debout, seul
    const s = t.game.bosses.find((x) => x.kind === 'sonneur')!;
    t.game.hitZombie(s.zombie, 1e6, false, s.zombie.pos, t.game.player.facing);
    expect(t.game.bosses.map((x) => x.kind)).toEqual(['vador']);
  });

  it('défié avant 5:00, il n empêche pas le Sonneur de venir à son heure', () => {
    const { t } = fight();
    t.game.cheats.god = true;
    t.game.runTime = 299;
    t.play(1.5);
    expect(t.game.bosses.map((x) => x.kind).sort()).toEqual(['sonneur', 'vador']);
  });

  it('son coup de sabre est marqué au sol avant de partir : rester dedans fait mal', () => {
    const { t, boss } = fight(3);
    t.playUntil(() => !!boss.mark, 3);
    expect(t.events('playerHurt')).toHaveLength(0);
    const hp = t.game.health.hp;
    t.playUntil(() => t.events('saberStrike').length > 0, V.strike.windup + V.strike.duration + 0.5);
    expect(t.events('saberStrike')[0].hit).toBe(true);
    expect(t.game.health.hp).toBeLessThan(hp);
  });

  it('sortir de la zone marquée avant le coup l esquive', () => {
    const { t, boss } = fight(3);
    t.playUntil(() => !!boss.mark, 3);
    const m = boss.mark!;
    const p = t.game.player;
    const away = p.pos.clone().sub(m.at);
    t.game.player.reset(p.pos.clone().addScaledVector(away.normalize(), m.radius + 3).normalize(), p.facing.clone());
    const hp = t.game.health.hp;
    t.playUntil(() => t.events('saberStrike').length > 0, V.strike.windup + V.strike.duration + 0.5);
    expect(t.events('saberStrike')[0].hit).toBe(false);
    expect(t.game.health.hp).toBe(hp);
  });

  it('au début de la préparation, la zone suit le joueur qui s écarte ; puis elle se fige', () => {
    const { t, boss } = fight(3);
    t.playUntil(() => !!boss.mark, 3);
    const m = boss.mark!;
    const start = m.at.clone();
    // Le joueur fait un pas de côté tout de suite : la zone le suit
    const p = t.game.player;
    p.reset(sidestep(p.pos, boss.zombie.pos, 3), p.facing.clone());
    t.playUntil(() => boss.mark!.t >= V.strike.track, 1);
    const tracked = boss.mark!.at.clone();
    expect(dist(tracked, start)).toBeGreaterThan(0.3);
    // Figée : elle ne bouge plus jusqu'au coup
    t.play(V.strike.windup * (1 - V.strike.track) * 0.8);
    expect(dist(boss.mark!.at, tracked)).toBeLessThan(0.05);
  });

  it('il marche vers le joueur resté loin', () => {
    const { t, boss } = fight(4);
    const p = t.game.player;
    p.reset(around(boss.zombie.pos, 20, new THREE.Vector3().crossVectors(boss.zombie.pos, p.facing)), p.facing.clone());
    const before = dist(boss.zombie.pos, p.pos);
    t.play(3);
    expect(dist(boss.zombie.pos, p.pos)).toBeLessThan(before - V.speed * 2);
  });

  it('tué, il rapporte beaucoup d XP, un coffre légendaire gratuit et des TUNAS', () => {
    const { t, boss } = fight();
    t.game.cheats.god = true;
    t.game.hitZombie(boss.zombie, 1e6, false, boss.zombie.pos, t.game.player.facing);
    t.play(0.1);
    const e = t.events('bossKilled');
    expect(e).toHaveLength(1);
    expect(e[0].chest?.rarity).toBe(V.chestRarity);
    expect(e[0].chest?.free).toBe(true);
    expect(t.game.tunaDrops.drops.reduce((n, d) => n + d.value, 0)).toBeGreaterThanOrEqual(TUNAS.boss.vador);
    expect(V.xp).toBeGreaterThan(100);
    expect(t.game.bosses).toHaveLength(0);
  });
});

describe('Dark Vador, phase 2 : le sabre lancé', () => {
  const TH = V.phase2.throw;
  /** Vador défié, passé sous la moitié de ses PV ; le joueur à `d` m de lui. */
  function enraged(d = 10) {
    const { t, boss } = fight(4);
    t.game.cheats.god = false;
    const z = boss.zombie;
    z.hp = z.maxHp * V.phase2.below * 0.9;
    const p = t.game.player;
    const axis = new THREE.Vector3().crossVectors(z.pos, z.facing);
    p.reset(around(z.pos, d, axis), p.facing.clone());
    t.play(0.05);
    return { t, boss };
  }

  it('sous la moitié de ses PV, il passe en phase 2 (furieux)', () => {
    const { t, boss } = enraged();
    expect(boss.phase).toBe(2);
    expect(t.events('bossPhase').map((e) => e.phase)).toEqual([2]);
  });

  it('il lance son sabre vers le joueur : la lame part de lui, va loin, puis revient dans sa main', () => {
    const { t, boss } = enraged(10);
    t.playUntil(() => !!boss.thrown, V.phase2.pause + TH.every + 2);
    expect(t.events('saberThrown')).toHaveLength(1);
    let far = 0;
    t.playUntil(() => { if (boss.thrown) far = Math.max(far, dist(boss.thrown.pos, boss.zombie.pos)); return !boss.thrown; }, 6);
    expect(far).toBeGreaterThan(8);
    expect(t.events('saberCaught')).toHaveLength(1);
  });

  it('au bout de sa course, la lame tourne sur place une seconde, revient, et il la relance vite', () => {
    const { t, boss } = enraged(10);
    t.playUntil(() => !!boss.thrown, V.phase2.pause + TH.every + 2);
    // Aller et retour à sa vitesse, plus l'attente au bout (marge pour Vador qui marche pendant le vol)
    let flight = 0;
    t.playUntil(() => { flight += 1 / 60; return !boss.thrown; }, 10);
    expect(boss.thrown).toBeNull();
    expect(flight).toBeLessThan((2 * TH.range) / TH.speed + TH.hold + 0.6);
    expect(flight).toBeGreaterThan(TH.hold);
    // Revenu dans sa main, il le relance peu après (le joueur toujours loin : pas de coup au corps à corps)
    const p = t.game.player;
    p.reset(around(boss.zombie.pos, 10, new THREE.Vector3().crossVectors(boss.zombie.pos, boss.zombie.facing)), p.facing.clone());
    // (un coup au corps à corps commencé au rattrapage se termine d'abord)
    t.playUntil(() => !boss.mark, 4);
    let wait = 0;
    t.playUntil(() => { wait += 1 / 60; return !!boss.thrown; }, 10);
    expect(boss.thrown).not.toBeNull();
    expect(wait).toBeLessThan(TH.every + TH.windup + 0.2);
  });

  it('lancé loin, le sabre ne reste pas bloqué au bout de sa course (bug trouvé en jeu)', () => {
    // Le bug : le point visé était au-dessus du sol (tangent à la planète), la lame volant au ras du sol ne
    // l'atteignait jamais et tournait sur place sans fin
    for (const d of [6, 10, 14]) {
      const { t, boss } = fight(4);
      boss.zombie.hp = boss.zombie.maxHp * V.phase2.below * 0.9;
      const z = boss.zombie, p = t.game.player;
      p.reset(around(z.pos, d, new THREE.Vector3().crossVectors(z.pos, z.facing)), p.facing.clone());
      t.playUntil(() => !!boss.thrown, V.phase2.pause + TH.every + 3);
      expect(boss.thrown).not.toBeNull();
      let flight = 0;
      t.playUntil(() => { flight += 1 / 60; return !boss.thrown; }, 20);
      expect(flight).toBeLessThan((2 * TH.range) / TH.speed + TH.hold + 0.6);
    }
  });

  it('il vise là où le joueur va, pas là où il est', () => {
    const { t, boss } = enraged(10);
    t.game.cheats.god = true;
    // Le joueur court de côté à 8 m/s, en ligne droite : la lame part devant lui
    const p = t.game.player;
    const side = (() => { const up = p.pos.clone().normalize(); const to = boss.zombie.pos.clone().sub(p.pos); to.addScaledVector(up, -to.dot(up)).normalize(); return to; })();
    const run = () => { p.reset(around(p.pos, 8 / 60, side), p.facing.clone()); return !!boss.thrown; };
    // Il court dès que Vador arme son lancer (sinon il serait déjà hors de portée)
    t.playUntil(() => boss.anim === 'cast', V.phase2.pause + TH.every + 2);
    t.playUntil(run, TH.windup + 0.5);
    const now = p.pos.clone(), target = boss.thrown!.target;
    for (let i = 0; i < Math.round((dist(boss.zombie.pos, now) / TH.speed) * 60); i++) { run(); t.play(1 / 60); }
    expect(dist(target, p.pos)).toBeLessThan(dist(target, now));
  });

  it('au bout de sa course, la lame glisse vers le joueur pendant qu elle tourne sur place', () => {
    const { t, boss } = enraged(6);
    t.game.cheats.god = true;
    t.playUntil(() => !!boss.thrown, V.phase2.pause + TH.every + 2);
    t.playUntil(() => !!boss.thrown && boss.thrown.hold < TH.hold, 3);
    const s = boss.thrown!;
    // Le joueur s'écarte de la lame : elle le suit
    const p = t.game.player;
    p.reset(sidestep(s.pos, boss.zombie.pos, 6), p.facing.clone());
    const before = dist(s.pos, p.pos);
    t.play(TH.hold * 0.5);
    expect(boss.thrown?.back).toBe(false);
    expect(dist(boss.thrown!.pos, p.pos)).toBeLessThan(before - 1);
  });

  it('le sabre blesse le joueur qu il traverse, une fois à l aller et une fois au retour', () => {
    const { t, boss } = enraged(10);
    t.game.cheats.god = false;
    // Le joueur reste planté sur la trajectoire : touché à l'aller puis au retour
    t.playUntil(() => !!boss.thrown, V.phase2.pause + TH.every + 2);
    const hp = t.game.health.hp;
    const before = t.events('playerHurt').length;
    // (le temps d'invulnérabilité après un coup est remis à zéro : on compte chaque passage)
    t.playUntil(() => { t.game.health.invuln = 0; return !boss.thrown; }, 6);
    expect(t.events('playerHurt').length - before).toBe(2);
    expect(t.game.health.hp).toBeLessThan(hp);
  });

  it('sabre lancé, il ne frappe pas au corps à corps', () => {
    const { t, boss } = enraged(10);
    t.playUntil(() => !!boss.thrown, V.phase2.pause + TH.every + 2);
    // Le joueur se colle à lui pendant que le sabre vole
    const p = t.game.player;
    p.reset(around(boss.zombie.pos, 2, new THREE.Vector3().crossVectors(boss.zombie.pos, boss.zombie.facing)), p.facing.clone());
    let struckInFlight = false;
    t.playUntil(() => { if (boss.thrown && boss.mark) struckInFlight = true; return !boss.thrown; }, 6);
    expect(struckInFlight).toBe(false);
  });

  const force = ACHIEVEMENTS.find((a) => a.rule.kind === 'boss' && a.rule.boss === 'vador' && a.rule.ally === 'yoda')!.id;
  const kill = (t: T, boss: Vador) => {
    t.game.cheats.god = true;
    t.game.hitZombie(boss.zombie, 1e6, false, boss.zombie.pos, t.game.player.facing);
    t.play(0.1);
  };

  it('le tuer avec Yoda qui suit le joueur débloque Que la mousse soit avec toi', () => {
    const { t, boss } = fight();
    t.game.allies.placeAt('yoda', t.inFront(1));
    t.play(0.1);
    expect(t.game.allies.list.find((a) => a.kind === 'yoda')?.state).toBe('following');
    kill(t, boss);
    expect(t.events('achievementUnlocked').some((e) => e.id === force)).toBe(true);
  });

  it('le tuer sans Yoda ne le débloque pas', () => {
    const { t, boss } = fight();
    t.game.allies.clear();
    kill(t, boss);
    expect(t.events('bossKilled')).toHaveLength(1);
    expect(t.events('achievementUnlocked').some((e) => e.id === force)).toBe(false);
  });
});
