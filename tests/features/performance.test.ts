import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { RENDER } from '../../src/config/visual';
import { ZOMBIE_HURT } from '../../src/config/zombies';
import { createAdaptiveResolution } from '../../src/render/adaptiveResolution';
import { createTestGame } from '../support/testGame';

const A = RENDER.adaptive;

/** Faux moteur de rendu : on ne regarde que sa densite de pixels. */
function fakeRenderer(ratio = 2) {
  let r = ratio;
  return { getPixelRatio: () => r, setPixelRatio: (v: number) => { r = v; } } as unknown as THREE.WebGLRenderer;
}
/** Joue `seconds` secondes a `fps` images par seconde, avec `cpuMs` de calcul par image. */
function run(a: ReturnType<typeof createAdaptiveResolution>, seconds: number, fps: number, cpuMs: number) {
  for (let i = 0; i < seconds * fps; i++) a.update(1 / fps, cpuMs);
}

describe('La resolution adaptative', () => {
  it('carte graphique qui sature : la resolution baisse, jamais sous le plancher', () => {
    const renderer = fakeRenderer(2);
    let applied = 0;
    const a = createAdaptiveResolution(renderer, () => applied++);
    run(a, 4, 30, 5);
    expect(a.scale).toBeLessThan(1);
    expect(renderer.getPixelRatio()).toBeCloseTo(2 * a.scale);
    expect(applied).toBeGreaterThan(0);
    run(a, 60, 30, 5);
    expect(a.scale).toBeCloseTo(A.minScale);
  });

  it('jeu qui calcule trop longtemps : baisser la resolution ne servirait a rien, elle ne bouge pas', () => {
    const a = createAdaptiveResolution(fakeRenderer(), () => {});
    run(a, 20, 30, 30);
    expect(a.scale).toBe(1);
  });

  it('cadence tenue : la resolution ne bouge pas ; apres une baisse, elle remonte quand ca va mieux', () => {
    const a = createAdaptiveResolution(fakeRenderer(), () => {});
    run(a, 20, 60, 5);
    expect(a.scale).toBe(1);
    run(a, 4, 30, 5);
    const low = a.scale;
    expect(low).toBeLessThan(1);
    run(a, 120, 60, 5);
    expect(a.scale).toBe(1);
  });
});

describe('La horde en fin de partie', () => {
  it('les armes touchent les ennemis proches sans parcourir toute la horde (index spatial)', () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.noSpawns();
    const near = t.game.spawnZombie('zombie', t.inFront(4), t.game.player.facing.clone().negate())!;
    const far = t.game.spawnZombie('zombie', t.inFront(40), t.game.player.facing.clone().negate())!;
    const found = t.game.horde.near(near.pos, 3, []);
    expect(found).toContain(near);
    expect(found).not.toContain(far);
    // Rayon enorme : toute la horde
    expect(t.game.horde.near(near.pos, 500, [])).toHaveLength(2);
    // Un mort n'est plus propose
    t.game.hitZombie(near, 9999, false, near.pos, t.game.player.facing.clone());
    expect(t.game.horde.near(near.pos, 3, [])).not.toContain(near);
  });

  it('un ennemi qui marche reste dans l index : une bouteille le trouve la ou il est maintenant', () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.noSpawns();
    t.game.cheats.god = true;
    const z = t.game.spawnZombie('tonnelier', t.inFront(16), t.game.player.facing.clone().negate())!;
    const hp = z.hp;
    expect(t.playUntil(() => z.hp < hp, 8)).toBe(true);
  });

  it('horde qui meurt en chaine : les corps au sol sont plafonnes', () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.noSpawns();
    t.game.loadout.weapons[0].mods.range = 0;
    const n = ZOMBIE_HURT.maxCorpses + 80;
    const zs = Array.from({ length: n }, (_, i) => t.game.spawnZombie('zombie', t.inFront(6 + (i % 20), (i % 30) - 15), t.game.player.facing.clone().negate())!);
    for (const z of zs) t.game.hitZombie(z, 9999, false, z.pos, t.game.player.facing.clone());
    t.play(ZOMBIE_HURT.corpseMinTime + 0.2);
    expect(t.game.horde.zombies.length).toBeLessThanOrEqual(ZOMBIE_HURT.maxCorpses);
    // Tous comptes comme tues, leur XP est au sol
    expect(t.game.kills).toBe(n);
  });
});
