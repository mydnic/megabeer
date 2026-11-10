import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PLANET_RADIUS } from '../../src/config/world';
import { toMapCoords } from '../../src/world/mapProjection';
import { createTestGame } from '../support/testGame';

/** Repère de la carte autour du Buveur : le haut = là où il regarde. */
function frame(t: ReturnType<typeof createTestGame>) {
  const p = t.game.player;
  const up = p.pos.clone().normalize();
  const fwd = p.facing.clone().addScaledVector(up, -p.facing.dot(up)).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
  return { up, fwd, right };
}

describe('La mini-carte', () => {
  it('montre devant en haut, à droite à droite, à la bonne distance au sol', () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.noSpawns();
    const { up, fwd, right } = frame(t);
    const ahead = toMapCoords(up, fwd, right, t.inFront(20).normalize().multiplyScalar(PLANET_RADIUS));
    expect(ahead.y).toBeGreaterThan(19);
    expect(Math.abs(ahead.x)).toBeLessThan(1);
    const onRight = toMapCoords(up, fwd, right, t.inFront(0, 15).normalize().multiplyScalar(PLANET_RADIUS));
    expect(onRight.x).toBeGreaterThan(14);
    expect(Math.abs(onRight.y)).toBeLessThan(1);
  });

  it("une pompe loin derrière est en bas, à sa distance le long de la planète", () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.noSpawns();
    const { up, fwd, right } = frame(t);
    const back = up.clone().applyAxisAngle(right, 60 / PLANET_RADIUS); // 60 m en arrière, au sol
    const m = toMapCoords(up, fwd, right, back.multiplyScalar(PLANET_RADIUS + 3));
    expect(m.y).toBeLessThan(-59);
    expect(m.dist).toBeCloseTo(60, 0);
  });
});
