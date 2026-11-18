import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { VEHICLES } from '../../src/config/vehicles';
import { withNormals } from '../../src/render/meshPrep';
import { groundPose } from '../../src/world/groundPose';

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

  it('un véhicule épouse la pente du sol (il ne reste pas à plat) : nez levé en montée, penché vers le côté bas', () => {
    const R = 100;
    const pos = new THREE.Vector3(0, R, 0), facing = new THREE.Vector3(0, 0, 1);
    const pose = (ground: (p: THREE.Vector3) => number) => {
      const at = new THREE.Vector3(), q = new THREE.Quaternion();
      groundPose(pos, facing, 2, 1, (p) => ground(p), at, q);
      return { at, up: new THREE.Vector3(0, 1, 0).applyQuaternion(q), fwd: new THREE.Vector3(0, 0, 1).applyQuaternion(q) };
    };
    // Sol plat : droit, posé au sol
    const flat = pose(() => R);
    expect(flat.up.angleTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(1e-3);
    expect(flat.at.length()).toBeCloseTo(R, 3);
    // Ça monte devant (le sol s'élève de 0,3 m par m vers l'avant) : le capot pointe vers le haut
    const climb = pose((p) => R + 0.3 * p.z);
    expect(climb.fwd.y).toBeGreaterThan(0.2);
    expect(climb.fwd.angleTo(new THREE.Vector3(0, 0.3, 1).normalize())).toBeLessThan(0.05);
    // Le sol monte vers sa droite : le toit penche vers sa gauche
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), facing);
    const bank = pose((p) => R + 0.25 * p.dot(right));
    expect(bank.up.dot(right)).toBeLessThan(-0.15);
    // Posé au milieu des appuis, au ras du sol (pas en l'air ni enterré)
    expect(bank.at.length()).toBeCloseTo(R, 1);
  });
});
