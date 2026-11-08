import * as THREE from 'three';
import { DECOR_LAYOUT, DECOR_LIGHTS as LI, LIGHT_SOURCES, type DecorModelId } from '../../config/decor';
import { PLANET_RADIUS, PLAYER_PHYSICS } from '../../config/world';
import { DecorCollider, type Bend, type DecorBody } from './collider';
import { layoutAbbeyPlanet, randomSpawn } from './layout';
import { heightAt } from '../terrain';
import { LAYER_CHARACTER } from '../../render/materials';
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

/**
 * Découpe les grands triangles (arête max `maxEdge`) : sans ça, une grande face plane (dallage,
 * toit, long mur) resterait tendue entre ses coins une fois courbée, et passerait sous le sol.
 * Géométrie non indexée ; couleurs et normales interpolées au milieu des arêtes coupées.
 */
function tessellate(geo: THREE.BufferGeometry, maxEdge: number): THREE.BufferGeometry {
  const names = Object.keys(geo.attributes);
  const src = names.map((n) => geo.attributes[n] as THREE.BufferAttribute);
  type V = number[][]; // une liste d'attributs par sommet
  const out: number[][] = names.map(() => []);
  const vert = (i: number): V => src.map((a) => Array.from({ length: a.itemSize }, (_, k) => a.array[i * a.itemSize + k]));
  const mid = (a: V, b: V): V => a.map((arr, n) => arr.map((x, k) => (x + b[n][k]) / 2));
  const dist = (a: V, b: V) => Math.hypot(a[0][0] - b[0][0], a[0][1] - b[0][1], a[0][2] - b[0][2]);
  const emit = (t: V[]) => t.forEach((v) => v.forEach((arr, n) => out[n].push(...arr)));
  const split = (t: V[], depth: number) => {
    const e = [dist(t[0], t[1]), dist(t[1], t[2]), dist(t[2], t[0])];
    const k = e.indexOf(Math.max(...e));
    if (e[k] <= maxEdge || depth > 12) return emit(t);
    const a = t[k], b2 = t[(k + 1) % 3], c = t[(k + 2) % 3], m = mid(a, b2);
    split([a, m, c], depth + 1);
    split([m, b2, c], depth + 1);
  };
  for (let i = 0; i < src[0].count; i += 3) split([vert(i), vert(i + 1), vert(i + 2)], 0);
  const g = new THREE.BufferGeometry();
  names.forEach((n, i) => g.setAttribute(n, new THREE.Float32BufferAttribute(out[i], src[i].itemSize)));
  return g;
}

/** Géométrie posée directement dans le monde, chaque sommet reprojeté sur la sphère. */
function bendToSphere(geo: THREE.BufferGeometry, b: Bend): THREE.BufferGeometry {
  // L'écart entre une face plane et la sphère sur 1 m est de l'ordre du millimètre
  const g = tessellate(geo.index ? geo.toNonIndexed() : geo, 1.0);
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
 * Décor de la planète : charge les modèles une fois, puis `generate(seed)` pose le décor de cette
 * planète (instancié : un appel de rendu par modèle), reconstruit les collisions (même objet
 * `collider`, gardé par le joueur et la horde) et les flammes des lanternes. Les lumières des
 * lanternes (la nuit, sur les plus proches) sont créées une seule fois.
 * Le relief doit déjà correspondre à la seed (setTerrainSeed).
 */
export async function createDecor(scene: THREE.Scene) {
  const lib = await loadDecorLibrary();
  const collider = new DecorCollider([], PLAYER_PHYSICS.stepHeight, PLAYER_PHYSICS.headClearance);
  const flameMat = new THREE.MeshBasicMaterial({ fog: false });
  flameMat.color.setRGB(5, 2.6, 0.9); // au-delà de 1 : déclenche le halo
  const flameGeo = new THREE.IcosahedronGeometry(0.09, 1);

  let group: THREE.Group | null = null;
  let flames: THREE.Vector3[] = [];
  let spawn = { dir: new THREE.Vector3(0, 1, 0), facing: new THREE.Vector3(1, 0, 0) };

  /** Retire le décor de la planète précédente (les géométries des modèles sont partagées : gardées). */
  function clear() {
    if (!group) return;
    scene.remove(group);
    group.traverse((o) => {
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
      else if (o.userData.ownGeometry) (o as THREE.Mesh).geometry.dispose();
    });
    group = null;
  }

  function generate(seed: number) {
    clear();
    const { placements, spawn: s } = layoutAbbeyPlanet(seed);
    spawn = s;
    const g = new THREE.Group();
    g.name = 'decor';

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
          mesh.layers.set(LAYER_CHARACTER); // contouré comme le perso
          mesh.name = `decor:${id}`;
          mesh.userData.ownGeometry = true;
          g.add(mesh);
        }
        continue;
      }
      const mesh = new THREE.InstancedMesh(model.geometry, model.material, mats.length);
      mats.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false; // l'ensemble couvre toute la planète
      mesh.layers.set(LAYER_CHARACTER); // contouré comme le perso
      mesh.name = `decor:${id}`;
      g.add(mesh);
    }

    // --- Collisions
    collider.reset(placements.map((p) => {
      const pos = new THREE.Vector3(), rot = new THREE.Quaternion(), sc = new THREE.Vector3();
      p.matrix.decompose(pos, rot, sc);
      return { pos, rot, inv: p.matrix.clone().invert(), shape: lib.get(p.id)!.shape, bend: bends.get(p.matrix) } as DecorBody;
    }));

    // --- Lanternes : flammes (toujours)
    flames = [];
    for (const p of placements) {
      const h = LIGHT_SOURCES[p.id];
      if (h === undefined) continue;
      flames.push(new THREE.Vector3(0, h, 0).applyMatrix4(p.matrix));
    }
    const flameMesh = new THREE.InstancedMesh(flameGeo, flameMat, Math.max(1, flames.length));
    flames.forEach((f, i) => flameMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(f.x, f.y, f.z)));
    flameMesh.count = flames.length;
    flameMesh.frustumCulled = false;
    g.add(flameMesh);

    scene.add(g);
    group = g;
    refresh = 0;
  }

  // Vraies lumières des lanternes, la nuit, sur les plus proches
  const lights = Array.from({ length: LI.count }, () => {
    const l = new THREE.PointLight(LI.color, 0, LI.distance, 2);
    scene.add(l);
    return l;
  });
  const order: number[] = [];
  let refresh = 0;

  const spawnTmp = new THREE.Vector3();
  return {
    collider,
    generate,
    /** Point de départ de repli : le parvis de l'abbaye principale. */
    get spawn() { return spawn; },
    /** Départ de run au hasard sur la planète, loin de tout élément du décor (repli : le parvis). */
    randomSpawn() {
      return randomSpawn((dir) => collider.near(spawnTmp.copy(dir).multiplyScalar(PLANET_RADIUS + heightAt(dir)), DECOR_LAYOUT.spawnClearance).length === 0) ?? spawn;
    },
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