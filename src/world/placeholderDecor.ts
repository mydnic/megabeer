// Décor PROVISOIRE (point d'étape cel-shading) : remplacé par le vrai décor de l'Abbaye.
import * as THREE from 'three';
import { PLANET_RADIUS as R } from '../config/world';
import { toonMaterial } from '../render/toon';
import { heightAt } from './terrain';
import type { Obstacle } from '../player/controller';

export function scatterPlaceholderDecor(scene: THREE.Scene, near: THREE.Vector3): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const COUNT = 2200;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 2, 7).translate(0, 1, 0), toonMaterial({ color: 0x6b4428 }), COUNT);
  const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 3.8, 8).translate(0, 3.7, 0), toonMaterial({ color: 0x2f6b3a }), COUNT);
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  rockGeo.computeBoundingBox();
  const rockTop = rockGeo.boundingBox!.max.y;
  const rock = new THREE.InstancedMesh(rockGeo, toonMaterial({ color: 0x9a918a }), COUNT);
  let nt = 0, nr = 0, seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const d = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), m = new THREE.Matrix4();
  const Y = new THREE.Vector3(0, 1, 0), spin = new THREE.Quaternion();
  for (let i = 0; i < COUNT; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, sq = Math.sqrt(1 - u * u);
    d.set(sq * Math.cos(a), u, sq * Math.sin(a));
    if (d.angleTo(near) < 0.03) continue; // dégage le point de départ
    const h = heightAt(d);
    if (h > 13) continue;
    p.copy(d).multiplyScalar(R + h - 0.2);
    q.setFromUnitVectors(Y, d).multiply(spin.setFromAxisAngle(Y, rnd() * Math.PI * 2));
    if (rnd() < 0.7) {
      const k = 0.8 + rnd() * 0.6;
      m.compose(p, q, s.set(k, k, k));
      trunk.setMatrixAt(nt, m); crown.setMatrixAt(nt, m); nt++;
      obstacles.push({ pos: p.clone(), radius: 0.45 * k, top: 6 * k });
    } else {
      const k = 0.6 + rnd() * 1.4;
      m.compose(p, q, s.set(k, k * 0.7, k));
      rock.setMatrixAt(nr++, m);
      // Base au niveau du sol (le rocher est enfoncé de 0,2). Le dessus est mesuré sur le vrai maillage,
      // le blocage latéral sur son emprise à hauteur de marche.
      const surface = new THREE.Mesh(rockGeo);
      surface.matrixAutoUpdate = false;
      surface.matrixWorld.copy(m);
      obstacles.push({ pos: d.clone().multiplyScalar(R + h), radius: 0.78 * k, top: rockTop * k * 0.7 - 0.2, surface });
    }
  }
  trunk.count = crown.count = nt; rock.count = nr;
  for (const im of [trunk, crown, rock]) { im.castShadow = true; im.receiveShadow = true; scene.add(im); }
  return obstacles;
}
