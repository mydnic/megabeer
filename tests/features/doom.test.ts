import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DECOR_LAYOUT } from '../../src/config/decor';
import { DOOM_MOUNTAIN as DM } from '../../src/config/doom';
import { PLANET, PLANET_RADIUS } from '../../src/config/world';
import { layoutAbbeyPlanet } from '../../src/world/decor/layout';
import { abbeySites, doomSite, heightAt, setTerrainSeed } from '../../src/world/terrain';
import { createTestGame } from '../support/testGame';

const R = PLANET_RADIUS;
/** Le point à `s` m du centre du cratère, dans la direction `k` (0 à 1 : un tour). */
function at(s: number, k = 0) {
  const c = doomSite.dir;
  const t1 = new THREE.Vector3().crossVectors(c, Math.abs(c.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
  const dir = t1.applyAxisAngle(c, k * Math.PI * 2);
  return c.clone().applyAxisAngle(new THREE.Vector3().crossVectors(c, dir).normalize(), s / R);
}

describe('La Montagne du Destin', () => {
  it('est là à chaque run, loin de toutes les abbayes', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      setTerrainSeed(seed);
      for (const a of abbeySites) expect(a.dir.angleTo(doomSite.dir) * R).toBeGreaterThan(DM.minFromAbbeys);
    }
  });

  it('se dresse au-dessus de la plaine, avec un cratère creux à fond plat au sommet', () => {
    setTerrainSeed(3);
    const floor = heightAt(at(0));
    const rim = heightAt(at(DM.rimRadius, 0.3));
    const foot = heightAt(at(DM.baseRadius * 1.2, 0.3));
    expect(rim - foot).toBeGreaterThan(DM.height * 0.7);
    expect(rim - floor).toBeGreaterThan(DM.depth * 0.8);
    for (let k = 0; k < 1; k += 0.125) expect(Math.abs(heightAt(at(DM.floorRadius * 0.9, k)) - floor)).toBeLessThan(0.3);
  });

  it('se grimpe : du pied jusqu au fond du cratère, aucune pente ne bloque le joueur', () => {
    const limit = Math.tan((PLANET.maxSlopeDeg * Math.PI) / 180);
    for (const seed of [1, 4]) {
      setTerrainSeed(seed);
      for (const k of [0, 0.37, 0.71]) {
        let worst = 0;
        for (let s = DM.baseRadius * 1.1; s > 0.5; s -= 0.5) worst = Math.max(worst, Math.abs(heightAt(at(s - 0.5, k)) - heightAt(at(s, k))) / 0.5);
        expect(worst).toBeLessThan(limit);
      }
    }
  });

  it('le décor ne pousse pas dans son cratère', () => {
    setTerrainSeed(2);
    const { placements } = layoutAbbeyPlanet(2);
    const p = new THREE.Vector3();
    for (const pl of placements) {
      p.setFromMatrixPosition(pl.matrix).normalize();
      expect(p.angleTo(doomSite.dir) * R).toBeGreaterThan(DM.rimRadius);
    }
    expect(DECOR_LAYOUT.maxAltitude).toBeLessThan(DM.height);
  });

  it('la lave du cratère brûle le joueur qui marche dedans, pas celui qui la saute', () => {
    const t = createTestGame();
    t.startRunAndLand();
    t.noSpawns();
    t.game.loadout.weapons[0].mods.range = 0;
    const p = t.game.player;
    p.reset(at((DM.lava.inner + DM.lava.outer) / 2), p.facing.clone());
    t.play(0.3);
    expect(t.events('lavaBurn').length).toBeGreaterThan(0);
    expect(t.events('playerHurt').length).toBeGreaterThan(0);
    const before = t.events('lavaBurn').length;
    t.play(DM.lava.tick * 2.5);
    expect(t.events('lavaBurn').length).toBeGreaterThan(before);
    // Au milieu de l'arène : plus rien
    p.reset(at(0), p.facing.clone());
    t.play(0.3);
    const n = t.events('lavaBurn').length;
    t.play(1);
    expect(t.events('lavaBurn').length).toBe(n);
    // En l'air au-dessus de la lave : rien
    p.reset(at((DM.lava.inner + DM.lava.outer) / 2), p.facing.clone());
    p.pos.setLength(p.pos.length() + 2);
    const m = t.events('lavaBurn').length;
    t.play(1 / 60);
    expect(t.events('lavaBurn').length).toBe(m);
  });
});
