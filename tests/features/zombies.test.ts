import { ENEMIES } from '../../src/config/enemies';
import { describe, expect, it } from 'vitest';
import { PLAYER_STATS } from '../../src/config/player';
import { createTestGame } from '../support/testGame';

/** Une run au sol, Canette désarmée (portée nulle), sans les zombies de départ. */
function arena() {
  const t = createTestGame();
  t.startRunAndLand();
  t.noSpawns();
  t.game.loadout.weapons[0].mods.range = 0;
  return t;
}

describe('Un zombie', () => {
  it('marche vers le joueur', () => {
    const t = arena();
    const z = t.game.spawnZombie('zombie', t.inFront(15), t.game.player.facing.clone())!;
    const before = z.pos.distanceTo(t.game.player.pos);
    t.play(3);
    expect(z.pos.distanceTo(t.game.player.pos)).toBeLessThan(before - 2);
  });

  it('frappe au contact : le Buveur perd des PV et recule', () => {
    const t = arena();
    t.game.spawnZombie('zombie', t.inFront(1.2), t.game.player.facing.clone().negate());
    const start = t.game.player.pos.clone();
    expect(t.playUntil(() => t.events('playerHurt').some((h) => !h.blocked), 4)).toBe(true);
    expect(t.game.health.hp).toBe(PLAYER_STATS.maxHp - ENEMIES.zombie.damage);
    t.play(0.2);
    expect(t.game.player.pos.distanceTo(start)).toBeGreaterThan(0.3);
  });

  it("ne peut pas enchaîner les coups : juste après un coup, le Buveur est invulnérable un instant", () => {
    const t = arena();
    for (const side of [-0.8, 0, 0.8]) t.game.spawnZombie('zombie', t.inFront(1.2, side), t.game.player.facing.clone().negate());
    t.playUntil(() => t.events('playerHurt').some((h) => !h.blocked), 4);
    const firstHp = t.game.health.hp;
    t.play(PLAYER_STATS.invulnTime * 0.5);
    expect(t.game.health.hp).toBe(firstHp);
  });

  it('frappe aussi un Buveur en plein saut (sauter ne protège pas)', () => {
    const t = arena();
    t.game.spawnZombie('zombie', t.inFront(1.2), t.game.player.facing.clone().negate());
    // Le Buveur saute sans arrêt : un coup doit quand même finir par porter
    let hurt = false;
    for (let i = 0; i < 6 * 60 && !hurt; i++) {
      t.play(1 / 60, t.game.player.onGround ? { jumpPressed: true, jump: true } : {});
      hurt = t.events('playerHurt').some((h) => !h.blocked);
    }
    expect(hurt).toBe(true);
  });

  it("ne fait rien en godmode (outil de dev)", () => {
    const t = arena();
    t.game.cheats.god = true;
    t.game.spawnZombie('zombie', t.inFront(1.2), t.game.player.facing.clone().negate());
    t.play(4);
    expect(t.game.health.hp).toBe(PLAYER_STATS.maxHp);
  });

  it('meurt, se couche puis disparaît dans le sol', () => {
    const t = arena();
    const z = t.game.spawnZombie('zombie', t.inFront(8), t.game.player.facing.clone())!;
    t.game.horde.setPassive(true);
    t.game.hitZombie(z, z.hp + 1, false, z.pos, t.game.player.facing.clone());
    expect(z.dead).toBe(true);
    expect(t.playUntil(() => !t.game.horde.zombies.includes(z), 10)).toBe(true);
  });
});

describe('La mort du Buveur', () => {
  it('arrive à 0 PV : la run se termine, le temps ralentit, les zombies ne frappent plus', () => {
    const t = arena();
    t.play(1);
    t.game.health.damage(PLAYER_STATS.maxHp);
    t.play(1 / 60);
    expect(t.game.phase).toBe('dead');
    expect(t.events('died')).toHaveLength(1);
    const end = t.events('runEnded')[0];
    expect(end.reason).toBe('mort');
    // Ralenti : une seconde réelle fait moins d'une seconde de jeu
    const dt = t.game.step(1 / 60);
    expect(dt).toBeLessThan(1 / 60);
    // Plus de coups, même au contact
    t.game.spawnZombie('zombie', t.inFront(1.2), t.game.player.facing.clone().negate());
    const hurtBefore = t.events('playerHurt').length;
    t.play(4);
    expect(t.events('playerHurt').length).toBe(hurtBefore);
  });

  it("ramène à l'accueil quand je continue après l'écran de mort", () => {
    const t = arena();
    t.game.health.damage(PLAYER_STATS.maxHp);
    t.play(3);
    t.game.goHome();
    expect(t.game.phase).toBe('home');
    expect(t.game.horde.zombies).toHaveLength(0);
  });
});
