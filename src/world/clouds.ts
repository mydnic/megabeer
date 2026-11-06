import * as THREE from 'three';
import { PLANET_RADIUS as R } from '../config/world';
import { LAYER_SKY, litMaterial } from '../render/materials';

const CLOUDS = {
  count: 150,
  altitude: [62, 88] as const,
  puffs: [6, 11] as const,
  puffSize: [5, 12] as const,
  /** Tour complet de la couche de nuages autour de la planète (s). */
  periodSeconds: 900,
};

/**
 * Gros nuages ronds en couche autour de la planète : amas de boules toon blanches, dessous aplati,
 * qui dérivent lentement. Pas de contour, pas d'ombre portée.
 */
export function createClouds(scene: THREE.Scene) {
  const group = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(1, 3);
  let seed = 1234;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const lerp = (r: readonly [number, number]) => r[0] + (r[1] - r[0]) * rnd();

  const mats: THREE.Matrix4[] = [];
  const d = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), p = new THREE.Vector3();
  const q = new THREE.Quaternion(), s = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < CLOUDS.count; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, sq = Math.sqrt(1 - u * u);
    d.set(sq * Math.cos(a), u, sq * Math.sin(a));
    t1.set(0, 1, 0).cross(d);
    if (t1.lengthSq() < 1e-4) t1.set(1, 0, 0);
    t1.normalize();
    t2.crossVectors(d, t1);
    const alt = R + lerp(CLOUDS.altitude);
    const n = Math.round(lerp(CLOUDS.puffs));
    const spread = lerp([10, 22]);
    q.setFromUnitVectors(Y, d);
    for (let k = 0; k < n; k++) {
      const ang = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * spread;
      const size = lerp(CLOUDS.puffSize) * (1 - (rr / spread) * 0.45);
      p.copy(d).multiplyScalar(alt + size * 0.25)
        .addScaledVector(t1, Math.cos(ang) * rr)
        .addScaledVector(t2, Math.sin(ang) * rr * 0.6);
      mats.push(new THREE.Matrix4().compose(p, q, s.set(size, size * 0.62, size)));
    }
  }
  const mesh = new THREE.InstancedMesh(geo, litMaterial({ color: 0xffffff, roughness: 1, emissive: 0x8a96b0, emissiveIntensity: 0.35 }), mats.length);
  mats.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.layers.set(LAYER_SKY);
  mesh.frustumCulled = false;
  group.add(mesh);
  scene.add(group);

  const axis = new THREE.Vector3(0.2, 1, 0.1).normalize();
  return {
    group,
    update(dt: number) {
      if (group.visible) group.rotateOnWorldAxis(axis, (dt / CLOUDS.periodSeconds) * Math.PI * 2);
    },
  };
}
