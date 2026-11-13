import * as THREE from 'three';
import { PLANET_RADIUS } from '../config/world';
import { heightAt } from '../world/terrain';

/** Look d'une marque au sol : couleur, opacité, épaisseur de l'anneau (part du rayon). */
export type GroundMarkLook = { markColor: number; markOpacity: number; markRing: number };

/** Une marque à afficher : centre au sol, rayon (m), remplissage de 0 à 1. */
export type GroundMark = { at: THREE.Vector3; radius: number; t: number };

/** Segments du tour, et hauteur au-dessus du relief (m). */
const SEGMENTS = 40;
const LIFT = 0.07;

/**
 * Marques au sol d'un danger à venir : un anneau qui délimite la zone et un disque qui se remplit
 * à mesure que le danger approche (point d'impact d'une bouteille, explosion d'un kamikaze).
 * Elles épousent le relief : chaque point est reposé sur le sol, même sur une pente.
 */
export function createGroundMarks(scene: THREE.Scene, L: GroundMarkLook) {
  const material = (opacity: number) => new THREE.MeshBasicMaterial({
    color: L.markColor, transparent: true, opacity, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4, side: THREE.DoubleSide,
  });
  const ringMat = material(L.markOpacity), fillMat = material(L.markOpacity * 0.45);
  // Rangées de cercles (part du rayon) : l'anneau en a 2, le disque plusieurs pour suivre les bosses
  const ringRows = [1 - L.markRing, 1];
  const fillRows = [0, 0.34, 0.67, 1];
  const meshes: { ring: THREE.Mesh; fill: THREE.Mesh }[] = [];
  const up = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), p = new THREE.Vector3();

  /** Maillage polaire : une rangée de SEGMENTS points par cercle, reliées en bandes. */
  function polar(rows: number[], mat: THREE.Material) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rows.length * SEGMENTS * 3), 3));
    // Normales vers le ciel (les passes du rendu, dont l'occlusion ambiante, en ont besoin)
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(rows.length * SEGMENTS * 3), 3));
    const index: number[] = [];
    for (let r = 0; r < rows.length - 1; r++) {
      for (let s = 0; s < SEGMENTS; s++) {
        const a = r * SEGMENTS + s, b = r * SEGMENTS + (s + 1) % SEGMENTS;
        const c = a + SEGMENTS, d = b + SEGMENTS;
        index.push(a, c, b, b, c, d);
      }
    }
    geo.setIndex(index);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    mesh.userData.diag = 'marques'; // ?sans=marques (diagnostic du rendu)
    scene.add(mesh);
    return mesh;
  }

  /** Pose les points du maillage sur le relief autour du centre courant (up), rangée par rangée. */
  function drape(mesh: THREE.Mesh, rows: number[], radius: number) {
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const nor = mesh.geometry.getAttribute('normal') as THREE.BufferAttribute;
    let i = 0;
    for (const f of rows) {
      for (let s = 0; s < SEGMENTS; s++) {
        const a = (s / SEGMENTS) * Math.PI * 2;
        p.copy(up).multiplyScalar(PLANET_RADIUS)
          .addScaledVector(e1, Math.cos(a) * radius * f)
          .addScaledVector(e2, Math.sin(a) * radius * f)
          .normalize();
        nor.setXYZ(i, p.x, p.y, p.z);
        p.multiplyScalar(PLANET_RADIUS + heightAt(p) + LIFT);
        pos.setXYZ(i++, p.x, p.y, p.z);
      }
    }
    pos.needsUpdate = nor.needsUpdate = true;
  }

  return {
    /** Affiche les marques de la liste (les autres sont cachées). */
    sync(marks: readonly GroundMark[]) {
      marks.forEach((k, i) => {
        let m = meshes[i];
        if (!m) {
          m = { ring: polar(ringRows, ringMat), fill: polar(fillRows, fillMat) };
          meshes.push(m);
        }
        up.copy(k.at).normalize();
        e1.set(1, 0, 0);
        if (Math.abs(up.x) > 0.9) e1.set(0, 1, 0);
        e1.addScaledVector(up, -e1.dot(up)).normalize();
        e2.crossVectors(up, e1);
        m.ring.visible = m.fill.visible = true;
        drape(m.ring, ringRows, k.radius);
        drape(m.fill, fillRows, Math.max(0.01, k.radius * k.t));
      });
      for (let i = marks.length; i < meshes.length; i++) meshes[i].ring.visible = meshes[i].fill.visible = false;
    },
  };
}
