import * as THREE from 'three';
import { RING_WAVE as L } from '../config/fx';
import { LAYER_SKY } from '../render/materials';

/**
 * Ondes au sol (Sifflet d'arbitre, Juke-box, Seconde tournée, explosions) : un front lumineux posé à
 * plat, qui s'élargit jusqu'au rayon de l'effet en s'effaçant. Le front est net et brillant, il laisse
 * derrière lui une traîne qui s'estompe vers le centre, striée de rayons.
 */
export function createRingWaveView(scene: THREE.Scene) {
  type Ring = { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; age: number; radius: number };
  const rings: Ring[] = [];
  const free: Ring[] = [];
  const geo = new THREE.CircleGeometry(1, 72).rotateX(-Math.PI / 2);
  const Y = new THREE.Vector3(0, 1, 0);

  function make(): Ring {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color() }, uAlpha: { value: 1 }, uThick: { value: L.thickness }, uK: { value: 0 } },
      vertexShader: `varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uAlpha; uniform float uThick; uniform float uK; varying vec2 vP;
        void main() {
          float r = length(vP), ang = atan(vP.y, vP.x);
          // Front : liseré net au bord, puis traîne qui s'efface vers le centre
          float edge = smoothstep(1.0 - uThick, 1.0 - uThick * 0.35, r) * smoothstep(1.0, 0.985, r);
          float tail = smoothstep(1.0 - uThick * 5.0, 1.0, r) * smoothstep(1.0, 0.98, r);
          float rays = 0.7 + 0.3 * sin(ang * 28.0 + r * 9.0);
          float a = (edge + tail * tail * 0.45 * rays) * uAlpha;
          if (a < 0.004) discard;
          gl_FragColor = vec4(uColor * (1.0 + edge * 0.8), a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.layers.set(LAYER_SKY);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { mesh, mat, age: 0, radius: 1 };
  }

  return {
    /** Lance une onde de couleur `color` autour de `at` (pieds), jusqu'à `radius` m. */
    spawn(at: THREE.Vector3, radius: number, color: number) {
      const r = free.pop() ?? make();
      const up = at.clone().normalize();
      r.mesh.position.copy(at).addScaledVector(up, L.lift);
      r.mesh.quaternion.setFromUnitVectors(Y, up);
      (r.mat.uniforms.uColor.value as THREE.Color).set(color);
      r.age = 0;
      r.radius = radius;
      r.mesh.visible = true;
      r.mesh.scale.setScalar(0.01);
      rings.push(r);
    },
    update(dt: number) {
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.age += dt;
        const k = Math.min(1, r.age / L.life);
        r.mesh.scale.setScalar(Math.max(0.01, r.radius * (1 - (1 - k) ** 3)));
        r.mat.uniforms.uAlpha.value = L.opacity * (1 - k * k);
        r.mat.uniforms.uK.value = k;
        if (k >= 1) { r.mesh.visible = false; rings.splice(i, 1); free.push(r); }
      }
    },
  };
}
