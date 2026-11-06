import * as THREE from 'three';
import { DECOR_LIGHTS as LI, LIGHT_SOURCES, type DecorModelId } from '../../config/decor';
import { PLANET_RADIUS, PLAYER_PHYSICS } from '../../config/world';
import { DecorCollider, type Bend, type DecorBody } from './collider';
import { layoutAbbeyPlanet } from './layout';
import { loadDecorLibrary } from './library';

/** Modèles assez grands pour devoir épouser la courbure de la planète. */
const BENT = new Set<DecorModelId>(['abbey']);

function bendFrame(m: THREE.Matrix4): Bend {
  const pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  m.decompose(pos, q, s);
  return {
    c: pos.clone().normalize(),
    e1: new THREE.Vector3(1, 0, 0).applyQuaternion(q),
    e2: new THREE.Vector3(0, 0, 1).applyQuaternion(q),
    R: PLANET_RADIUS,
    base: pos.length(),
  };
}

/** Géométrie posée directement dans le monde, chaque sommet reprojeté sur la sphère. */
function bendToSphere(geo: THREE.BufferGeometry, b: Bend): THREE.BufferGeometry {
  const g = geo.clone();
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    d.copy(b.c).multiplyScalar(b.R).addScaledVector(b.e1, v.x).addScaledVector(b.e2, v.z).normalize();
    d.multiplyScalar(b.base + v.y);
    pos.setXYZ(i, d.x, d.y, d.z);
  }
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * Décor de la planète : charge les modèles, les pose (instanciés : un appel de rendu par modèle),
 * construit les collisions et gère les lumières des lanternes la nuit.
 */
export async function createDecor(scene: THREE.Scene) {
  const lib = await loadDecorLibrary();
  const { placements, spawn } = layoutAbbeyPlanet();

  // --- Rendu instancié
  const byModel = new Map<DecorModelId, THREE.Matrix4[]>();
  for (const p of placements) {
    if (!byModel.has(p.id)) byModel.set(p.id, []);
    byModel.get(p.id)!.push(p.matrix);
  }
  const bends = new Map<THREE.Matrix4, Bend>();
  for (const [id, mats] of byModel) {
    const model = lib.get(id)!;
    if (BENT.has(id)) {
      // Grand modèle : courbé sur la sphère (sinon ses bords flottent au-dessus du sol)
      for (const m of mats) {
        const bend = bendFrame(m);
        bends.set(m, bend);
        const mesh = new THREE.Mesh(bendToSphere(model.geometry, bend), model.material);
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.name = `decor:${id}`;
        scene.add(mesh);
      }
      continue;
    }
    const mesh = new THREE.InstancedMesh(model.geometry, model.material, mats.length);
    mats.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false; // l'ensemble couvre toute la planète
    mesh.name = `decor:${id}`;
    scene.add(mesh);
  }

  // --- Collisions
  const bodies: DecorBody[] = placements.map((p) => {
    const pos = new THREE.Vector3(), rot = new THREE.Quaternion(), s = new THREE.Vector3();
    p.matrix.decompose(pos, rot, s);
    return { pos, rot, inv: p.matrix.clone().invert(), shape: lib.get(p.id)!.shape, bend: bends.get(p.matrix) };
  });
  const collider = new DecorCollider(bodies, PLAYER_PHYSICS.stepHeight, PLAYER_PHYSICS.headClearance);

  // --- Lanternes : flammes (toujours) et vraies lumières (la nuit, sur les plus proches)
  const flames: THREE.Vector3[] = [];
  for (const p of placements) {
    const h = LIGHT_SOURCES[p.id];
    if (h === undefined) continue;
    flames.push(new THREE.Vector3(0, h, 0).applyMatrix4(p.matrix));
  }
  const flameMat = new THREE.MeshBasicMaterial({ fog: false });
  flameMat.color.setRGB(5, 2.6, 0.9); // au-delà de 1 : déclenche le halo
  const flameMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 1), flameMat, Math.max(1, flames.length));
  flames.forEach((f, i) => flameMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(f.x, f.y, f.z)));
  flameMesh.count = flames.length;
  flameMesh.frustumCulled = false;
  scene.add(flameMesh);

  const lights = Array.from({ length: LI.count }, () => {
    const l = new THREE.PointLight(LI.color, 0, LI.distance, 2);
    scene.add(l);
    return l;
  });
  const order: number[] = [];
  let refresh = 0;

  return {
    collider,
    spawn,
    /** `night` : 0 en plein jour, 1 en pleine nuit. */
    update(dt: number, playerPos: THREE.Vector3, night: number) {
      refresh -= dt;
      if (refresh <= 0) {
        // Les lanternes les plus proches reçoivent une vraie lumière (tri 4 fois par seconde)
        refresh = 0.25;
        order.length = 0;
        flames.forEach((f, i) => { if (f.distanceToSquared(playerPos) < LI.range * LI.range) order.push(i); });
        order.sort((a, b) => flames[a].distanceToSquared(playerPos) - flames[b].distanceToSquared(playerPos));
        lights.forEach((l, k) => {
          if (k < order.length) l.position.copy(flames[order[k]]);
          l.userData.active = k < order.length;
        });
      }
      const flicker = 0.9 + Math.sin(performance.now() * 0.013) * 0.05 + Math.sin(performance.now() * 0.031) * 0.05;
      for (const l of lights) l.intensity = l.userData.active ? LI.intensity * night * flicker : 0;
    },
  };
}
