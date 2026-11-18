import * as THREE from 'three';
import type { Zone } from '../weapons/weapon';

/**
 * Apparence d'une zone d'arme au sol (flaque de bière, de vomi...) : couleur, opacité, couleur du bord, hauteur
 * au-dessus du sol (m), temps d'apparition et de disparition (s) ; `core` : opacité du centre par rapport au bord
 * (1 par défaut : disque plein ; bas : un anneau, pour une zone qui reste autour du joueur sans le masquer).
 */
export type ZoneLook = { color: number; rim: number; opacity: number; lift: number; fadeIn: number; fadeOut: number; core?: number };

const INITIAL = 32;
const Y = new THREE.Vector3(0, 1, 0);

/**
 * Zones posées par les armes : un disque à bords doux par zone, couché sur la verticale locale, un seul dessin
 * instancié pour toutes. Chaque zone apparaît puis s'estompe (`aAlpha` par instance).
 */
export function createZoneView(scene: THREE.Scene, L: ZoneLook, groundAt: (p: THREE.Vector3) => number) {
  const geo = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: L.color, transparent: true, opacity: L.opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6 });
  const rim = new THREE.Color(L.rim);
  mat.onBeforeCompile = (s) => {
    s.uniforms.uRim = { value: rim };
    s.uniforms.uCore = { value: L.core ?? 1 };
    s.vertexShader = `attribute float aAlpha;\nvarying float vAlpha;\nvarying vec2 vDisc;\n${s.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = aAlpha;\nvDisc = position.xz;');
    s.fragmentShader = `uniform vec3 uRim;\nuniform float uCore;\nvarying float vAlpha;\nvarying vec2 vDisc;\n${s.fragmentShader}`
      .replace('#include <color_fragment>', `#include <color_fragment>
  float d = length(vDisc);
  // Bord un peu irrégulier (flaque), plus foncé, et fondu vers l'extérieur
  float wob = 0.06 * sin(atan(vDisc.y, vDisc.x) * 5.0) + 0.04 * sin(atan(vDisc.y, vDisc.x) * 9.0 + 1.3);
  float edge = 1.0 - smoothstep(0.82 + wob, 1.0 + wob * 0.5, d);
  diffuseColor.rgb = mix(diffuseColor.rgb, uRim, smoothstep(0.55, 0.95, d));
  diffuseColor.a *= edge * vAlpha * mix(uCore, 1.0, smoothstep(0.6, 0.95, d));`);
  };
  let capacity = INITIAL;
  let mesh: THREE.InstancedMesh;
  let alpha: THREE.InstancedBufferAttribute;
  function build() {
    if (mesh) { scene.remove(mesh); mesh.dispose(); }
    const g = geo.clone();
    alpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    alpha.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aAlpha', alpha);
    mesh = new THREE.InstancedMesh(g, mat, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    mesh.count = 0;
    scene.add(mesh);
  }
  build();

  const q = new THREE.Quaternion(), up = new THREE.Vector3(), p = new THREE.Vector3(), s = new THREE.Vector3(), m4 = new THREE.Matrix4();
  return {
    sync(zones: readonly Zone[]) {
      let n = 0;
      for (const z of zones) if (z.active) n++;
      if (n > capacity) { while (capacity < n) capacity *= 2; build(); }
      let i = 0;
      for (const z of zones) {
        if (!z.active) continue;
        up.copy(z.pos).normalize();
        p.copy(up).multiplyScalar(groundAt(z.pos) + L.lift);
        q.setFromUnitVectors(Y, up);
        m4.compose(p, q, s.setScalar(z.radius));
        mesh.setMatrixAt(i, m4);
        const a = Math.min(1, z.age / L.fadeIn) * Math.min(1, (z.life - z.age) / L.fadeOut) * (z.strength ?? 1);
        alpha.setX(i, Math.max(0, a));
        i++;
      }
      mesh.count = i;
      mesh.instanceMatrix.needsUpdate = true;
      alpha.needsUpdate = true;
    },
  };
}
