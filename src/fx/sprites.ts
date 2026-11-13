import * as THREE from 'three';
import { SPRITE_FX as S } from '../config/fx';
import { PLAYER_PHYSICS } from '../config/world';
import { LAYER_SKY } from '../render/materials';

/**
 * Particules face à la caméra, dessinées par le shader (aucune texture) : lueurs, éclats en étoile,
 * anneaux et bouffées de fumée façon dessin animé. Deux dessins pour tout le jeu : les lumineuses
 * (additives, elles nourrissent le bloom) et la fumée (opaque, à deux tons). Les autres effets
 * (`fx/vfx.ts`) composent leurs recettes avec `emit`.
 */

/** Forme d'une particule. */
export type SpriteKind = 'glow' | 'star' | 'ring' | 'smoke';
const KIND: Record<SpriteKind, number> = { glow: 0, star: 1, ring: 2, smoke: 3 };

export type SpriteSpec = {
  kind: SpriteKind;
  color: number;
  /** Taille au départ et à la fin (m). */
  size: number;
  endSize?: number;
  /** Durée de vie (s). */
  life: number;
  /** Vitesse (m/s) ; `gravity` : part de la gravité subie (négatif : monte), `drag` : freinage (1/s). */
  vel?: THREE.Vector3;
  gravity?: number;
  drag?: number;
  /** Intensité lumineuse (les valeurs au-dessus de 1 débordent dans le bloom). */
  intensity?: number;
  /** Rotation de départ (rad) et vitesse de rotation (rad/s). */
  rot?: number;
  spin?: number;
};

type Particle = {
  pos: THREE.Vector3; vel: THREE.Vector3; color: THREE.Color; kind: number;
  size: number; endSize: number; life: number; max: number; gravity: number; drag: number; intensity: number; rot: number; spin: number;
};

const VERT = `
attribute vec3 aPos; attribute vec4 aColor; attribute vec4 aData;
varying vec2 vUv; varying vec4 vColor; varying vec2 vKind;
void main() {
  vUv = position.xy * 2.0;
  vColor = aColor; vKind = aData.zw;
  float c = cos(aData.y), s = sin(aData.y);
  vec2 p = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * aData.x;
  vec4 mv = viewMatrix * vec4(aPos, 1.0);
  mv.xy += p;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
uniform float uSmoke;
varying vec2 vUv; varying vec4 vColor; varying vec2 vKind;
void main() {
  float r = length(vUv), kind = vKind.x, k = vKind.y, a = 0.0;
  vec3 col = vColor.rgb;
  if (uSmoke > 0.5) {
    // Bouffée ronde à lobes, deux tons (éclairée du haut), bord net : elle rétrécit au lieu de s'effacer
    float ang = atan(vUv.y, vUv.x);
    float edge = 0.8 + 0.09 * sin(ang * 5.0) + 0.05 * sin(ang * 9.0 + 2.0);
    a = smoothstep(edge, edge - 0.05, r);
    float lit = smoothstep(-0.25, 0.2, vUv.y * 0.8 - r * 0.35 + 0.15);
    col = mix(col * 0.66, col, lit);
  } else if (kind < 0.5) {
    a = exp(-r * r * 4.5) * smoothstep(1.0, 0.6, r);
  } else if (kind < 1.5) {
    // Coeur brillant et quatre branches fines
    vec2 q = abs(vUv);
    float m = min(q.x, q.y);
    float spike = exp(-m * m * 260.0) * exp(-r * r * 2.4);
    a = max(exp(-r * r * 10.0), spike) * smoothstep(1.0, 0.75, r);
  } else {
    // Anneau qui s'ouvre et s'affine
    float rad = 0.2 + 0.72 * k, w = 0.12 * (1.0 - k) + 0.025;
    a = smoothstep(w, 0.0, abs(r - rad));
  }
  if (a * vColor.a < 0.004) discard;
  gl_FragColor = vec4(col, vColor.a * a);
}`;

function layer(scene: THREE.Scene, smoke: boolean, max: number) {
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  const pos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const color = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const data = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aPos', pos);
  geo.setAttribute('aColor', color);
  geo.setAttribute('aData', data);
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSmoke: { value: smoke ? 1 : 0 } }, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: smoke ? THREE.NormalBlending : THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.layers.set(LAYER_SKY);
  mesh.renderOrder = smoke ? 3 : 4;
  mesh.userData.diag = 'vfx'; // ?sans=vfx (diagnostic du rendu)
  scene.add(mesh);
  return { geo, pos, color, data, list: [] as Particle[], free: [] as Particle[], cursor: 0, max };
}

export function createSprites(scene: THREE.Scene) {
  const lights = layer(scene, false, S.maxLights), smokes = layer(scene, true, S.maxSmoke);
  const up = new THREE.Vector3();
  const ZERO = new THREE.Vector3();

  function write(L: ReturnType<typeof layer>, dt: number) {
    const list = L.list;
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.life += dt;
      if (p.life >= p.max) { L.free.push(p); continue; }
      if (p.gravity !== 0) p.vel.addScaledVector(up.copy(p.pos).normalize(), -PLAYER_PHYSICS.gravity * p.gravity * dt);
      if (p.drag > 0) p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.pos.addScaledVector(p.vel, dt);
      p.rot += p.spin * dt;
      const k = p.life / p.max;
      // Taille : part vite puis ralentit ; la fumée et les étoiles se referment sur la fin
      const ease = 1 - (1 - k) * (1 - k);
      let size = p.size + (p.endSize - p.size) * ease, alpha = 1;
      if (p.kind === 3) { size *= Math.min(1, k * 8) * (k > 0.55 ? 1 - ((k - 0.55) / 0.45) ** 2 : 1); alpha = S.smokeOpacity; }
      else if (p.kind === 2) alpha = (1 - k) * p.intensity;
      else alpha = (1 - k * k) * p.intensity;
      L.pos.setXYZ(n, p.pos.x, p.pos.y, p.pos.z);
      L.color.setXYZW(n, p.color.r, p.color.g, p.color.b, alpha);
      L.data.setXYZW(n, size, p.rot, p.kind, k);
      list[n++] = p;
    }
    list.length = n;
    L.geo.instanceCount = n;
    L.pos.needsUpdate = L.color.needsUpdate = L.data.needsUpdate = true;
  }

  return {
    /** Ajoute une particule en `pos`. Au-delà de la réserve, la plus ancienne laisse sa place. */
    emit(pos: THREE.Vector3, s: SpriteSpec) {
      const L = s.kind === 'smoke' ? smokes : lights;
      // Réserve pleine : la nouvelle remplace une ancienne, à tour de rôle (jamais de décalage du tableau)
      let p: Particle;
      if (L.list.length >= L.max) p = L.list[L.cursor = (L.cursor + 1) % L.max];
      else {
        p = L.free.pop() ?? { pos: new THREE.Vector3(), vel: new THREE.Vector3(), color: new THREE.Color(), kind: 0, size: 0, endSize: 0, life: 0, max: 0, gravity: 0, drag: 0, intensity: 1, rot: 0, spin: 0 };
        L.list.push(p);
      }
      p.pos.copy(pos);
      p.vel.copy(s.vel ?? ZERO);
      p.color.set(s.color);
      p.kind = KIND[s.kind];
      p.size = s.size; p.endSize = s.endSize ?? s.size;
      p.life = 0; p.max = s.life;
      p.gravity = s.gravity ?? 0; p.drag = s.drag ?? 0;
      p.intensity = s.intensity ?? 1; p.rot = s.rot ?? 0; p.spin = s.spin ?? 0;
    },
    update(dt: number) {
      write(lights, dt);
      write(smokes, dt);
    },
    clear() {
      lights.list.length = smokes.list.length = 0;
      lights.geo.instanceCount = smokes.geo.instanceCount = 0;
    },
    /** Part de la réserve déjà prise (0 à 1), fumée ou lumières : les recettes s'allègent quand elle monte. */
    load(smoke: boolean) { const L = smoke ? smokes : lights; return L.list.length / L.max; },
    /** Nombre de particules vivantes (tests, debug). */
    get count() { return lights.list.length + smokes.list.length; },
  };
}

export type Sprites = ReturnType<typeof createSprites>;
