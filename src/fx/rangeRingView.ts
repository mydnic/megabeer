import * as THREE from 'three';
import { LAYER_SKY } from '../render/materials';
import type { Zone } from '../weapons/weapon';

/**
 * Apparence d'un anneau de portée autour du joueur (Rot sonique) : couleur, largeur du ruban (m), hauteur au-dessus du
 * sol (m), opacité à pleine charge, nombre de segments, nombre de reflets qui tournent le long de l'anneau et leur vitesse.
 */
export type RangeRingLook = { color: number; width: number; lift: number; opacity: number; segments: number; dashes: number; dashSpeed: number };

/**
 * Anneau de portée : un ruban fin dont chaque point est posé sur le sol (relief, sites aplanis, dessus du décor sous
 * les pieds du joueur), pour qu'il ne s'enfonce jamais dans une pente. Un seul dessin ; le sol n'est relu que quand le
 * joueur bouge ou que l'anneau change de taille.
 */
export function createRangeRingView(scene: THREE.Scene, L: RangeRingLook, groundAt: (p: THREE.Vector3, feetR: number) => number) {
  const n = L.segments;
  const pos = new Float32Array((n + 1) * 2 * 3);
  const edge = new Float32Array((n + 1) * 2);
  const along = new Float32Array((n + 1) * 2);
  const index: number[] = [];
  for (let i = 0; i <= n; i++) {
    edge[i * 2] = 0; edge[i * 2 + 1] = 1;
    along[i * 2] = along[i * 2 + 1] = i / n;
    if (i < n) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
  geo.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
  geo.setIndex(index);

  const uTime = { value: 0 };
  const mat = new THREE.MeshBasicMaterial({ color: L.color, transparent: true, opacity: L.opacity, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 });
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTime = uTime;
    s.vertexShader = `attribute float aEdge;\nattribute float aAlong;\nvarying float vEdge;\nvarying float vAlong;\n${s.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEdge = aEdge;\nvAlong = aAlong;');
    s.fragmentShader = `uniform float uTime;\nvarying float vEdge;\nvarying float vAlong;\n${s.fragmentShader}`
      .replace('#include <color_fragment>', `#include <color_fragment>
  // Bords fondus, et des reflets qui tournent doucement le long de l'anneau
  float band = 1.0 - abs(vEdge * 2.0 - 1.0);
  float shine = 0.7 + 0.3 * sin((vAlong * ${L.dashes.toFixed(1)} - uTime * ${L.dashSpeed.toFixed(2)}) * 6.2831853);
  diffuseColor.a *= smoothstep(0.0, 0.6, band) * shine;`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  // Hors des passes d'occlusion et de contour (comme les ondes et les particules) : sinon il ressort noir
  mesh.layers.set(LAYER_SKY);
  mesh.visible = false;
  scene.add(mesh);

  const up = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), q = new THREE.Vector3(), last = new THREE.Vector3();
  let lastR = -1;
  return {
    /** `zone` : la portée à dessiner (absente ou inactive : rien) ; `feetR` : rayon des pieds du joueur. */
    sync(zone: Zone | undefined, feetR: number, dt: number) {
      if (!zone?.active) { mesh.visible = false; return; }
      mesh.visible = true;
      uTime.value += dt;
      mat.opacity = L.opacity * (zone.strength ?? 1);
      if (last.distanceToSquared(zone.pos) < 1e-4 && Math.abs(lastR - zone.radius) < 1e-3) return;
      last.copy(zone.pos); lastR = zone.radius;
      up.copy(zone.pos).normalize();
      t1.set(Math.abs(up.y) < 0.9 ? 0 : 1, Math.abs(up.y) < 0.9 ? 1 : 0, 0).cross(up).normalize();
      t2.crossVectors(up, t1);
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        for (let k = 0; k < 2; k++) {
          const r = zone.radius + (k === 0 ? -L.width / 2 : L.width / 2);
          q.copy(zone.pos).addScaledVector(t1, c * r).addScaledVector(t2, s * r);
          const g = groundAt(q, feetR);
          q.normalize().multiplyScalar(g + L.lift);
          const o = (i * 2 + k) * 3;
          pos[o] = q.x; pos[o + 1] = q.y; pos[o + 2] = q.z;
        }
      }
      posAttr.needsUpdate = true;
    },
  };
}
