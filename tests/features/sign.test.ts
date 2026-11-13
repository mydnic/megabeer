import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SIGN } from '../../src/config/decor';
import { PLANET_RADIUS as R } from '../../src/config/world';
import { abbeySites, setTerrainSeed } from '../../src/world/terrain';
import { layoutAbbeyPlanet } from '../../src/world/decor/layout';

/** Les lettres du panneau posées sur la planète `seed`, dans l'ordre de lecture. */
function letters(seed: number) {
  setTerrainSeed(seed);
  const placements = layoutAbbeyPlanet(seed).placements.filter((p) => p.id.startsWith('sign'));
  return placements.map((p) => {
    const pos = new THREE.Vector3(), q = new THREE.Quaternion();
    p.matrix.decompose(pos, q, new THREE.Vector3());
    return { id: p.id, pos, front: new THREE.Vector3(0, 0, 1).applyQuaternion(q) };
  });
}

describe('Le panneau MORTEHAN', () => {
  for (const seed of [1, 2, 3, 42]) {
    it(`planète ${seed} : les lettres de MORTEHAN, dans l'ordre, sur une hauteur face à l'abbaye du départ`, () => {
      const L = letters(seed);
      expect(L.map((l) => l.id.slice(4)).join('')).toBe(SIGN.text);
      const home = abbeySites[0].dir.clone().multiplyScalar(R);
      for (const l of L) {
        const dist = l.pos.clone().normalize().angleTo(home.clone().normalize()) * R;
        expect(dist).toBeGreaterThan(SIGN.minDist * 0.7);
        expect(dist).toBeLessThan(SIGN.maxDist * 1.3);
        // Chaque lettre regarde vers l'abbaye
        expect(l.front.dot(home.clone().sub(l.pos).normalize())).toBeGreaterThan(0.7);
      }
      // Lues de gauche à droite depuis l'abbaye : chaque lettre est à droite de la précédente
      for (let i = 1; i < L.length; i++) {
        const up = L[i].pos.clone().normalize();
        const right = new THREE.Vector3().crossVectors(L[i].front.clone().negate(), up);
        expect(L[i].pos.clone().sub(L[i - 1].pos).dot(right)).toBeGreaterThan(SIGN.pitch * 0.8);
      }
    });
  }
});
