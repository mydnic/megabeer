import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { VEHICLES } from '../../src/config/vehicles';
import { withNormals } from '../../src/render/meshPrep';

/** Les primitives d'un GLB de véhicule et leurs attributs (sans charger les sommets). */
function primitives(file: string) {
  const b = readFileSync(join('src/assets/models/vehicules', file));
  const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')) as { meshes: { primitives: { attributes: Record<string, number> }[] }[] };
  return json.meshes.flatMap((m) => m.primitives);
}

describe('Les modèles des véhicules', () => {
  it('chaque véhicule a son fichier, avec des pièces dessinables', () => {
    for (const V of Object.values(VEHICLES)) expect(primitives(V.file).length, V.file).toBeGreaterThan(0);
  });

  it('un modèle livré sans normales (le bus scolaire) les reçoit avant le rendu : sinon l écran se couvre d un carré noir', () => {
    // Le bus est bien livré ainsi (le bug vu en jeu)
    expect(primitives(VEHICLES.bus.file).some((p) => p.attributes.NORMAL === undefined)).toBe(true);
    // Une pièce sans normales en ressort avec des normales finies et unitaires, une par face (low-poly à facettes)
    const box = new THREE.BoxGeometry(1, 2, 3);
    box.deleteAttribute('normal');
    const g = withNormals(box);
    const n = g.attributes.normal;
    expect(n).toBeDefined();
    for (let i = 0; i < n.count; i++) {
      const v = new THREE.Vector3(n.getX(i), n.getY(i), n.getZ(i));
      expect(Number.isFinite(v.x + v.y + v.z)).toBe(true);
      expect(v.length()).toBeCloseTo(1, 5);
    }
    // Une pièce qui a déjà ses normales n'est pas touchée
    const ok = new THREE.BoxGeometry(1, 1, 1);
    expect(withNormals(ok)).toBe(ok);
  });
});
