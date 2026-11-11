import { describe, expect, it } from 'vitest';
import { BASE_SPEED } from '../../src/config/world';
import { TOURNEE_DROPS, TOURNEE_FX, TOURNEES, type TourneeId } from '../../src/config/tournees';
import { tourneeDropChance } from '../../src/game/tournees';
import { createTestGame } from '../support/testGame';

/** Une run au sol, calme : pas de zombies, Canette désarmée. */
function arena(opts: Parameters<typeof createTestGame>[1] = {}) {
  const t = createTestGame(1, opts);
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  return t;
}

/** Un zombie à `dist` m devant le joueur, tourné vers lui. */
function zombieAt(t: ReturnType<typeof createTestGame>, dist: number, side = 0) {
  return t.game.spawnZombie('zombie', t.inFront(dist, side), t.game.player.facing.clone().negate())!;
}

const active = (t: ReturnType<typeof createTestGame>, id: TourneeId) => t.game.tournees.left(id) > 0;

describe('Les tournées du bar', () => {
  it('un ennemi tué lâche parfois une tournée ; ramassée, elle agit et annonce son nom', () => {
    const t = arena({ tournees: 'peket' });
    const z = zombieAt(t, 2);
    t.game.hitZombie(z, 999, false, z.pos, t.game.player.facing);
    expect(t.game.tournees.drops.drops).toHaveLength(1);
    expect(t.playUntil(() => t.events('tourneeTaken').length > 0, 3)).toBe(true);
    expect(t.events('tourneeTaken')[0].id).toBe('peket');
    expect(active(t, 'peket')).toBe(true);
  });

  it('une tournée pas ramassée finit par disparaître', () => {
    const t = arena();
    t.game.tournees.drops.drop(t.inFront(40), 0);
    t.play(TOURNEE_DROPS.life + 0.5);
    expect(t.game.tournees.drops.drops).toHaveLength(0);
  });

  it('la Chance rend les tournées plus fréquentes', () => {
    expect(tourneeDropChance(0)).toBeCloseTo(TOURNEE_DROPS.dropChance);
    expect(tourneeDropChance(10)).toBeGreaterThan(tourneeDropChance(0));
  });

  it('Tournée générale : tous les ennemis autour encaissent, pas ceux qui sont loin', () => {
    const t = arena();
    const near = zombieAt(t, 8), far = zombieAt(t, TOURNEE_FX.generale.radius + 15);
    const hp = far.hp;
    t.game.takeTournee('generale');
    expect(t.events('zombieHit').some((h) => h.zombie === near && h.damage > 0)).toBe(true);
    expect(far.hp).toBe(hp);
    expect(active(t, 'generale')).toBe(false);
  });

  it('Pression max : dégâts des armes x2 pendant sa durée', () => {
    const t = arena();
    const weapon = t.game.loadout.weapons[0];
    const z = zombieAt(t, 5);
    z.hp = 1000;
    t.game.takeTournee('pression');
    t.game.hitZombie(z, 5, false, z.pos, t.game.player.facing, weapon);
    expect(t.events('zombieHit').at(-1)!.damage).toBeCloseTo(5 * t.game.stats.damage * TOURNEE_FX.pression.damageMul);
    t.play(TOURNEES.pression.duration + 0.2);
    expect(t.events('tourneeEnded').map((e) => e.id)).toContain('pression');
    t.game.hitZombie(z, 5, false, z.pos, t.game.player.facing, weapon);
    expect(t.events('zombieHit').at(-1)!.damage).toBeCloseTo(5 * t.game.stats.damage);
  });

  it('Seau à glace : les ennemis proches gèlent, pas les lointains', () => {
    const t = arena();
    const near = zombieAt(t, 6), far = zombieAt(t, TOURNEE_FX.seau.radius + 10);
    t.game.takeTournee('seau');
    expect(near.frozen).toBeGreaterThan(TOURNEE_FX.seau.freeze - 0.01);
    expect(far.frozen).toBe(0);
  });

  it('Double pinte : l\'XP ramassée compte double', () => {
    const t = arena();
    t.game.takeTournee('doublePinte');
    t.game.xp.drop(t.inFront(1), 2);
    t.play(1);
    expect(t.events('xpCollected').at(-1)!.amount).toBeCloseTo(2 * t.game.stats.xpGain * TOURNEE_FX.doublePinte.xpMul);
  });

  it('Péket : le Buveur court plus vite, puis revient à sa vitesse', () => {
    const t = arena();
    t.game.takeTournee('peket');
    t.play(0.1);
    expect(t.game.player.speed).toBeCloseTo(BASE_SPEED * TOURNEE_FX.peket.speedMul);
    t.play(TOURNEES.peket.duration);
    expect(t.game.player.speed).toBeCloseTo(BASE_SPEED);
  });

  it('Casque à bière : les coups ne font rien et l\'ennemi rebondit', () => {
    const t = arena();
    t.game.takeTournee('casque');
    const z = zombieAt(t, 1.2);
    const hp = t.game.health.hp;
    t.play(3);
    expect(t.game.health.hp).toBe(hp);
    expect(t.events('playerHurt').filter((e) => !e.blocked)).toHaveLength(0);
    expect(z.pos.distanceTo(t.game.player.pos)).toBeGreaterThan(1.2);
  });

  it('Frites-mayo : gros soin tout de suite, puis un peu de régénération', () => {
    const t = arena();
    t.game.health.hp = 20;
    t.game.takeTournee('fritesMayo');
    expect(t.game.health.hp).toBeCloseTo(20 + TOURNEE_FX.fritesMayo.heal);
    t.play(2);
    expect(t.game.health.hp).toBeGreaterThan(20 + TOURNEE_FX.fritesMayo.heal + TOURNEE_FX.fritesMayo.regen);
  });

  it('Sous-bock porte-bonheur : Chance en plus pendant sa durée, puis retour', () => {
    const t = arena();
    const luck = t.game.stats.luck;
    t.game.takeTournee('sousBock');
    expect(t.game.stats.luck).toBe(luck + TOURNEE_FX.sousBock.luck);
    t.play(TOURNEES.sousBock.duration + 0.2);
    expect(t.game.stats.luck).toBe(luck);
  });

  it('reprendre la même tournée relance sa durée sans cumuler l\'effet', () => {
    const t = arena();
    t.game.takeTournee('sousBock');
    t.play(10);
    t.game.takeTournee('sousBock');
    expect(t.game.stats.luck).toBe(TOURNEE_FX.sousBock.luck);
    expect(t.game.tournees.left('sousBock')).toBeCloseTo(TOURNEES.sousBock.duration);
  });

  it('une nouvelle run efface les tournées en cours', () => {
    const t = arena();
    t.game.takeTournee('peket');
    t.game.takeTournee('sousBock');
    t.game.abandon();
    expect(t.game.stats.luck).toBe(0);
    expect((Object.keys(TOURNEES) as TourneeId[]).some((id) => t.game.tournees.left(id) > 0)).toBe(false);
  });
});
