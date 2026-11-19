import * as THREE from 'three';
import { SAIYAN_LOOK } from '../config/saiyan';
import { LAYER_SKY } from '../render/materials';

const VERT = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Flamme d'aura façon Dragon Ball : silhouette en œuf autour du corps qui s'effile vers le haut en langues de feu qui
// montent (bruit qui défile), bord brillant, intérieur léger traversé de traits qui filent vers le ciel.
const FRAG = `uniform float uTime; uniform vec3 uColor; uniform float uAlpha; uniform float uSeed; uniform vec2 uMargin;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
void main() {
  // La flamme tient dans le bas du cadre (marge en haut et sur les côtés : les langues montent sans être coupées)
  vec2 p = vec2((vUv.x * 2.0 - 1.0) * uMargin.x, vUv.y * uMargin.y);
  float t = uTime + uSeed;
  // Enveloppe autour du corps (ellipse), étirée vers le haut en longues langues de feu qui montent et vacillent
  vec2 q = vec2(p.x / 0.6, (p.y - 0.36) / 0.4);
  float base = length(q) - 1.0;
  float up = smoothstep(-0.1, 1.0, p.y);
  float n1 = fbm(vec2(p.x * 3.2, p.y * 1.8 - t * 3.2));
  float n2 = fbm(vec2(p.x * 5.0 + 5.0, p.y * 2.6 - t * 4.6));
  float f = base - (n1 * 1.2 + n2 * 0.4 - 0.6) * (0.35 + 1.9 * up);
  if (f > 0.0) discard;
  float inner = smoothstep(0.0, -0.7, f);
  float edge = 1.0 - smoothstep(0.0, -0.16, f);
  // Traits clairs qui filent vers le haut à l'intérieur
  float streak = smoothstep(0.6, 0.92, fbm(vec2(p.x * 9.0, p.y * 1.2 - t * 4.2)));
  vec3 col = mix(uColor, vec3(1.0), clamp(edge * 0.25 + inner * 0.25 + streak * 0.35, 0.0, 1.0));
  float a = (0.35 + edge * 0.9 + streak * 0.4) * smoothstep(0.0, 0.07, p.y) * uAlpha;
  // Les langues s'éteignent avant le bord du cadre
  a *= (1.0 - smoothstep(0.82, 1.0, vUv.y)) * (1.0 - smoothstep(0.82, 1.0, abs(vUv.x * 2.0 - 1.0)));
  gl_FragColor = vec4(col * 1.4, a);
}`;

/**
 * Aura du Super Saiyan : deux flammes face à la caméra (tournées seulement autour de la verticale du joueur), une
 * derrière le perso et une plus légère devant, de la couleur du palier. Elle grandit d'un coup à la transformation
 * puis se pose, et vacille.
 */
export function createAuraView(scene: THREE.Scene) {
  const L = SAIYAN_LOOK.aura;
  const make = (seed: number, alpha: number) => {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color() }, uAlpha: { value: 0 }, uSeed: { value: seed }, uMargin: { value: new THREE.Vector2(L.margin[0], L.margin[1]) } },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), mat);
    mesh.layers.set(LAYER_SKY);
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.renderOrder = 3;
    scene.add(mesh);
    return { mesh, mat, alpha };
  };
  const back = make(0, 1), front = make(17.3, L.front);
  const up = new THREE.Vector3(), toCam = new THREE.Vector3(), right = new THREE.Vector3(), basis = new THREE.Matrix4();
  let strength = 0, time = 0, burst = 0, lastColor = -1;

  return {
    /** Chaque image : la couleur du palier en cours (null : pas transformé), les pieds du joueur, la caméra. */
    sync(color: number | null, feet: THREE.Vector3, camera: THREE.Camera, dt: number) {
      time += dt;
      if (color !== null && lastColor === -1) burst = 1;
      lastColor = color ?? -1;
      strength = THREE.MathUtils.clamp(strength + (color !== null ? dt / L.fadeIn : -dt / L.fadeOut), 0, 1);
      burst = Math.max(0, burst - dt / L.burstTime);
      const on = strength > 0.001;
      back.mesh.visible = front.mesh.visible = on;
      if (!on) return;
      up.copy(feet).normalize();
      toCam.copy(camera.position).sub(feet);
      toCam.addScaledVector(up, -toCam.dot(up)).normalize();
      right.crossVectors(up, toCam).normalize();
      const flicker = 1 + Math.sin(time * 23) * 0.04 + Math.sin(time * 37 + 1) * 0.03;
      const grow = 1 + burst * L.burstScale;
      for (const [k, layer] of [[0, back], [L.frontOffset, front]] as const) {
        const m = layer.mesh;
        m.position.copy(feet).addScaledVector(up, -0.1).addScaledVector(toCam, k - L.backOffset * (k === 0 ? 1 : 0));
        m.quaternion.setFromRotationMatrix(basis.makeBasis(right, up, toCam));
        m.scale.set(L.width * L.margin[0] * grow * flicker, L.height * L.margin[1] * grow * (2 - flicker), 1);
        layer.mat.uniforms.uTime.value = time;
        if (color !== null) layer.mat.uniforms.uColor.value.set(color);
        layer.mat.uniforms.uAlpha.value = strength * layer.alpha * (1 + burst);
      }
    },
  };
}
