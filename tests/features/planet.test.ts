import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DECOR_LAYOUT } from '../../src/config/decor';
import { abbeySites, heightAt, setTerrainSeed } from '../../src/world/terrain';
import { layoutAbbeyPlanet, randomSpawn } from '../../src/world/decor/layout';

/** Relief échantillonné en quelques points fixes de la planète. */
function reliefSample() {
  const dirs = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0.5, 0.5, 0.7], [-0.3, 0.8, -0.5]].map((v) => new THREE.Vector3(...v).normalize());
  return dirs.map((d) => heightAt(d));
}

describe('La planète', () => {
  it('est la même pour une même seed (pour rejouer une map)', () => {
    setTerrainSeed(42);
    const a = reliefSample();
    const abbeyA = abbeySites[0].dir.clone();
    const decorA = layoutAbbeyPlanet(42).placements.length;
    setTerrainSeed(7);
    setTerrainSeed(42);
    expect(reliefSample()).toEqual(a);
    expect(abbeySites[0].dir.equals(abbeyA)).toBe(true);
    expect(layoutAbbeyPlanet(42).placements.length).toBe(decorA);
  });

  it('change à chaque seed : relief et abbayes ailleurs', () => {
    setTerrainSeed(1);
    const a = reliefSample(), abbeyA = abbeySites[0].dir.clone();
    setTerrainSeed(2);
    expect(reliefSample()).not.toEqual(a);
    expect(abbeySites[0].dir.angleTo(abbeyA)).toBeGreaterThan(0.01);
  });

  it(`a ${DECOR_LAYOUT.abbeyCount} abbayes bien séparées`, () => {
    setTerrainSeed(3);
    expect(abbeySites.length).toBe(DECOR_LAYOUT.abbeyCount);
    for (let i = 0; i < abbeySites.length; i++) {
      for (let j = i + 1; j < abbeySites.length; j++) {
        expect(abbeySites[i].dir.angleTo(abbeySites[j].dir)).toBeGreaterThan(0.1);
      }
    }
  });

  it('fait partir le Buveur sur un terrain praticable, à un endroit différent à chaque run', () => {
    setTerrainSeed(5);
    const a = randomSpawn(() => true)!, b = randomSpawn(() => true)!;
    expect(heightAt(a.dir)).toBeLessThanOrEqual(DECOR_LAYOUT.maxAltitude);
    expect(a.dir.angleTo(b.dir)).toBeGreaterThan(0);
    // Regard dans le plan du sol
    expect(Math.abs(a.facing.dot(a.dir))).toBeLessThan(1e-6);
  });

  it('évite le décor au point de départ', () => {
    setTerrainSeed(5);
    let refused = 0;
    const spawn = randomSpawn(() => (refused++ < 10 ? false : true));
    expect(spawn).not.toBeNull();
    expect(refused).toBeGreaterThan(10);
  });
});
