import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BIN_LOOK as L, BINS } from '../config/bins';
import { PLAYER_PHYSICS } from '../config/world';
import type { Bin } from '../game/bins';
import { characterMaterial, LAYER_CHARACTER } from '../render/materials';

const urls = import.meta.glob('../assets/models/poubelle.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** Une poubelle cassée en train de tomber : moment de la casse, sens de la chute, vol du couvercle. */
type Fall = { at: number; tip: THREE.Vector3; lidPos: THREE.Vector3; lidVel: THREE.Vector3; lidAxis: THREE.Vector3; lidRest: boolean };

/**
 * Rendu des poubelles : la poubelle de rue « Trashcan » (Poly by Google), un dessin pour le corps et un
 * pour le couvercle, pour toutes. Cassée, son couvercle s'envole en tournant, le corps se couche, reste
 * un instant au sol puis s'enfonce.
 */
export async function createBinsView(scene: THREE.Scene) {
  const gltf = await new GLTFLoader().loadAsync(Object.values(urls)[0]);
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const scale = L.width / (box.max.x - box.min.x);
  // Repère de la poubelle : pieds à y = 0, centrée, à l'échelle
  const toBin = new THREE.Matrix4().makeScale(scale, scale, scale)
    .multiply(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2));
  const height = (box.max.y - box.min.y) * scale;

  const max = BINS.count + 40;
  const body = characterMaterial({ color: L.body });
  const lidMat = characterMaterial({ color: L.lid });
  const bodies: THREE.InstancedMesh[] = [], lids: THREE.InstancedMesh[] = [];
  // Le couvercle tourne autour de son propre centre : sa géométrie est recentrée, son décalage gardé
  const lidCenter = new THREE.Vector3();
  const lidGeos: THREE.BufferGeometry[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry.clone().applyMatrix4(toBin.clone().multiply(m.matrixWorld));
    const isLid = (m.material as THREE.Material).name.startsWith('Couvercle');
    if (isLid) lidGeos.push(g);
    else bodies.push(instanced(g, body));
  });
  const lidBox = new THREE.Box3();
  for (const g of lidGeos) { g.computeBoundingBox(); lidBox.union(g.boundingBox!); }
  lidBox.getCenter(lidCenter);
  for (const g of lidGeos) lids.push(instanced(g.translate(-lidCenter.x, -lidCenter.y, -lidCenter.z), lidMat));

  function instanced(g: THREE.BufferGeometry, mat: THREE.Material) {
    const mesh = new THREE.InstancedMesh(g, mat, max);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.layers.set(LAYER_CHARACTER);
    mesh.count = 0;
    scene.add(mesh);
    return mesh;
  }

  const Y = new THREE.Vector3(0, 1, 0);
  const place = new THREE.Matrix4(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(), p = new THREE.Vector3(), axis = new THREE.Vector3();
  const pivot = new THREE.Vector3(), shift = new THREE.Vector3(), lift = new THREE.Matrix4().makeTranslation(lidCenter.x, lidCenter.y, lidCenter.z);
  const qb = new THREE.Quaternion();
  const falls = new Map<Bin, Fall>();
  let time = 0;

  /** Durée totale de la chute d'une poubelle cassée (ensuite elle n'est plus dessinée). */
  const life = L.tipTime + L.stay + L.sinkTime;

  return {
    /** Recopie les poubelles ; `dt` : temps de jeu écoulé (0 : figé). */
    sync(bins: readonly Bin[], dt: number) {
      const t = (time += dt);
      if (bins.length === 0) falls.clear();
      let n = 0;
      for (const b of bins) {
        if (n >= max) break;
        up.copy(b.pos).normalize();
        q.setFromUnitVectors(Y, up);
        if (!b.broken) {
          place.compose(b.pos, q, one);
          for (const mesh of bodies) mesh.setMatrixAt(n, place);
          for (const mesh of lids) mesh.setMatrixAt(n, m.multiplyMatrices(place, lift));
          n++;
          continue;
        }
        let f = falls.get(b);
        if (!f) {
          // Elle tombe dans un sens au hasard ; le couvercle part en l'air, un peu sur le côté
          const tip = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
          const lidPos = new THREE.Vector3(lidCenter.x, lidCenter.y, lidCenter.z).applyQuaternion(q).add(b.pos);
          const side = tip.clone().applyQuaternion(q);
          const lidVel = up.clone().multiplyScalar(L.lidUp).addScaledVector(side, -L.lidSide);
          f = { at: t, tip, lidPos, lidVel, lidAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), lidRest: false };
          falls.set(b, f);
        }
        const age = t - f.at;
        if (age > life) continue;
        // Enfoncement en fin de vie
        const sink = age > L.tipTime + L.stay ? ((age - L.tipTime - L.stay) / L.sinkTime) * L.sinkDepth : 0;
        // Corps : il bascule autour de son pied, du côté `tip`
        const k = Math.min(1, age / L.tipTime);
        const angle = (Math.PI / 2) * (1 - (1 - k) * (1 - k));
        q2.setFromAxisAngle(axis.set(f.tip.z, 0, -f.tip.x).normalize(), angle);
        // Rotation autour du bord du pied qui reste au sol : l'origine se déplace de (pivot - R·pivot)
        pivot.copy(f.tip).multiplyScalar(L.width / 2);
        shift.copy(pivot).applyQuaternion(q2).negate().add(pivot).applyQuaternion(q);
        place.compose(p.copy(b.pos).addScaledVector(up, -sink).add(shift), qb.multiplyQuaternions(q, q2), one);
        for (const mesh of bodies) mesh.setMatrixAt(n, place);
        // Couvercle : vol balistique, puis posé au sol (à hauteur des pieds de la poubelle)
        if (!f.lidRest && dt > 0) {
          f.lidVel.addScaledVector(up, -PLAYER_PHYSICS.gravity * dt);
          f.lidPos.addScaledVector(f.lidVel, dt);
          if (f.lidPos.length() < b.pos.length() + 0.05 && f.lidVel.dot(up) < 0) { f.lidRest = true; f.lidPos.setLength(b.pos.length() + 0.05); }
        }
        const spin = f.lidRest ? 0 : age * L.lidSpin * Math.PI * 2;
        q2.setFromAxisAngle(f.lidAxis, spin);
        m.compose(p.copy(f.lidPos).addScaledVector(up, -sink), qb.multiplyQuaternions(q, q2), one);
        for (const mesh of lids) mesh.setMatrixAt(n, m);
        n++;
      }
      for (const mesh of bodies) { mesh.count = n; mesh.instanceMatrix.needsUpdate = true; }
      for (const mesh of lids) { mesh.count = n; mesh.instanceMatrix.needsUpdate = true; }
    },
    /** Hauteur du modèle (m), pour les effets. */
    height,
  };
}

