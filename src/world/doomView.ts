import * as THREE from 'three';
import { DOOM_MOUNTAIN as DM } from '../config/doom';
import { PLANET_RADIUS } from '../config/world';
import { LAYER_SKY } from '../render/materials';
import { doomSite, heightAt, seededRandom } from './terrain';

const L = DM.look;

/**
 * La lave du cratère : une croûte sombre qui dérive, de la lave en fusion dessous et des fissures incandescentes qui
 * palpitent.
 */
function lavaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCrust: { value: new THREE.Color(L.crust) },
      uMolten: { value: new THREE.Color(L.molten) },
      uHot: { value: new THREE.Color(L.hot) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uCrust, uMolten, uHot;
      varying vec3 vWorld;
      varying vec2 vUv;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float noise(vec3 x) {
        vec3 i = floor(x), f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }
      void main() {
        vec3 p = vWorld / ${L.scale.toFixed(2)};
        p += vec3(uTime * 0.05, uTime * 0.03, -uTime * 0.04);
        // Le motif se tord sur lui-même : de grandes plaques de croûte séparées par des veines de lave
        vec3 q = vec3(fbm(p), fbm(p + 4.3), fbm(p - 2.7));
        float h = fbm(p + 2.0 * q + uTime * 0.08);
        float crack = 1.0 - abs(fbm(p * 1.7 + q) * 2.0 - 1.0);
        vec3 col = mix(uCrust, uMolten, smoothstep(0.5, 0.66, h));
        col = mix(col, uHot, pow(crack, 12.0) * (0.7 + 0.3 * sin(uTime * 2.0 + h * 9.0)));
        gl_FragColor = vec4(col * ${L.glow.toFixed(2)}, 1.0);
      }`,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

/**
 * La Montagne du Destin vue de près et de loin : l'anneau de lave au fond du cratère, les coulées de lave qui descendent
 * les flancs, une colonne rouge au-dessus du cratère, visible de loin. Refait quand la planète change.
 */
export function createDoomView(scene: THREE.Scene) {
  // L'anneau de lave, posé sur le relief
  const SEG = 128, RINGS = 6;
  const ringGeo = new THREE.BufferGeometry();
  const ringPos = new Float32Array(SEG * (RINGS + 1) * 3);
  ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPos, 3));
  ringGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(SEG * (RINGS + 1) * 2), 2));
  const idx: number[] = [];
  for (let r = 0; r < RINGS; r++) {
    for (let i = 0; i < SEG; i++) {
      const a = r * SEG + i, b = r * SEG + ((i + 1) % SEG), c = a + SEG, d = b + SEG;
      idx.push(a, c, b, b, c, d);
    }
  }
  ringGeo.setIndex(idx);
  const poolMat = lavaMaterial();
  // Les coulées : une couleur unie, plus chaude au coeur qu'aux bords (couleurs par sommet), qui pulse
  const VL = DM.veins.look;
  const flowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide });
  const edge = new THREE.Color(VL.edge), core = new THREE.Color(VL.core), tint = new THREE.Color();
  const pool = new THREE.Mesh(ringGeo, poolMat);
  pool.layers.set(LAYER_SKY);
  pool.frustumCulled = false;
  scene.add(pool);

  // Les coulées : des rubans qui suivent la pente
  const veins = new THREE.Mesh(new THREE.BufferGeometry(), flowMat);
  veins.layers.set(LAYER_SKY);
  veins.frustumCulled = false;
  scene.add(veins);

  const B = DM.beam;
  // La colonne s'allume au-dessus de la crête et se dissout dans le ciel (opacité par sommet, pas de bord net)
  const beamGeo = new THREE.CylinderGeometry(B.radius * 0.5, B.radius, B.height, 24, 16, true).translate(0, B.height / 2, 0);
  const by = beamGeo.attributes.position, fade = new Float32Array(by.count * 4);
  for (let i = 0; i < by.count; i++) {
    const h = by.getY(i) / B.height;
    const a = THREE.MathUtils.smoothstep(h, 0, B.fadeIn) * (1 - THREE.MathUtils.smoothstep(h, B.fadeOut, 1));
    fade.set([1, 1, 1, a], i * 4);
  }
  beamGeo.setAttribute('color', new THREE.BufferAttribute(fade, 4));
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: B.color, vertexColors: true, transparent: true, opacity: B.opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.layers.set(LAYER_SKY);
  scene.add(beam);

  const built = new THREE.Vector3();
  let t = 0;
  const up = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), p = new THREE.Vector3(), dir = new THREE.Vector3();

  /** Le point à `s` m du centre `c` du cratère, dans la direction tangente `d`. */
  const along = (c: THREE.Vector3, d: THREE.Vector3, s: number, out: THREE.Vector3) => out.copy(c).applyAxisAngle(up.crossVectors(c, d).normalize(), s / PLANET_RADIUS);

  function buildVeins(c: THREE.Vector3) {
    const V = DM.veins;
    const ACROSS = V.across;
    const rand = seededRandom(Math.floor((c.x * 7919 + c.y * 104729 + c.z * 1299709) * 1000));
    const pos: number[] = [], col: number[] = [], index: number[] = [];
    const g = new THREE.Vector3(), side = new THREE.Vector3(), q = new THREE.Vector3(), n = new THREE.Vector3(), down = new THREE.Vector3();
    for (let k = 0; k < V.count; k++) {
      const a = ((k + 0.25 + rand() * 0.5) / V.count) * Math.PI * 2;
      dir.copy(t1).multiplyScalar(Math.cos(a)).addScaledVector(t2, Math.sin(a));
      // Départ juste sous la crête, côté extérieur
      along(c, dir, DM.rimRadius + 1, p);
      const phase = rand() * 10, freq = 0.08 + rand() * 0.06;
      let dist = 0;
      const first = pos.length / 3;
      for (let i = 0; i < 400; i++) {
        n.copy(p).normalize();
        // Vers le bas : la pente du relief, et toujours un peu en s'éloignant du cratère ; elle serpente
        down.copy(n).multiplyScalar(n.dot(c)).sub(c).normalize();
        side.crossVectors(n, down).normalize();
        const e = 0.8 / PLANET_RADIUS;
        const h0 = heightAt(n);
        g.copy(down).multiplyScalar(h0 - heightAt(q.copy(n).addScaledVector(down, e).normalize())).addScaledVector(side, h0 - heightAt(q.copy(n).addScaledVector(side, e).normalize()));
        const step = down.clone().add(g.multiplyScalar(0.6)).addScaledVector(side, Math.sin(dist * freq + phase) * V.wiggle);
        step.addScaledVector(n, -step.dot(n)).normalize();
        side.crossVectors(n, step).normalize();
        const s = n.angleTo(c) * PLANET_RADIUS;
        const u = Math.min(1, (s - DM.rimRadius) / (DM.baseRadius * V.reach - DM.rimRadius));
        const w = V.top + (V.bottom - V.top) * u;
        // En travers, plusieurs points posés chacun sur le relief : la coulée épouse la pente sur toute sa largeur
        for (let j = 0; j <= ACROSS; j++) {
          const f = j / ACROSS;
          q.copy(n).addScaledVector(side, ((f - 0.5) * w) / PLANET_RADIUS).normalize();
          q.multiplyScalar(PLANET_RADIUS + heightAt(q) + V.lift);
          pos.push(q.x, q.y, q.z);
          const k = 1 - (2 * f - 1) ** 2;
          tint.copy(edge).lerp(core, k * k);
          col.push(tint.r, tint.g, tint.b);
        }
        if (i > 0) {
          const b = first + (i - 1) * (ACROSS + 1);
          for (let j = 0; j < ACROSS; j++) {
            const a0 = b + j, a1 = a0 + ACROSS + 1;
            index.push(a0, a1, a0 + 1, a0 + 1, a1, a1 + 1);
          }
        }
        if (u >= 1) break;
        p.copy(n).addScaledVector(step, V.step / PLANET_RADIUS).normalize();
        dist += V.step;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(index);
    veins.geometry.dispose();
    veins.geometry = geo;
  }

  function build() {
    built.copy(doomSite.dir);
    const c = doomSite.dir;
    t1.crossVectors(c, Math.abs(c.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    t2.crossVectors(c, t1);
    for (let r = 0; r <= RINGS; r++) {
      const s = DM.lava.inner + ((DM.lava.outer - DM.lava.inner) * r) / RINGS;
      for (let i = 0; i < SEG; i++) {
        const a = (i / SEG) * Math.PI * 2;
        dir.copy(t1).multiplyScalar(Math.cos(a)).addScaledVector(t2, Math.sin(a));
        along(c, dir, s, p);
        p.multiplyScalar(PLANET_RADIUS + heightAt(p) + 0.03);
        ringPos.set([p.x, p.y, p.z], (r * SEG + i) * 3);
      }
    }
    ringGeo.attributes.position.needsUpdate = true;
    ringGeo.computeVertexNormals();
    ringGeo.computeBoundingSphere();
    buildVeins(c);
    // Au-dessus de la crête : la colonne se voit de loin sans voiler l'arène
    beam.position.copy(c).multiplyScalar(PLANET_RADIUS + heightAt(c) + DM.depth + B.above);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), c);
  }

  return {
    sync(dt: number) {
      if (!built.equals(doomSite.dir)) build();
      t += dt;
      poolMat.uniforms.uTime.value = t;
      flowMat.color.setScalar(VL.glow * (1 + VL.pulse * Math.sin(t * VL.speed)));
      (beam.material as THREE.MeshBasicMaterial).opacity = B.opacity * (0.85 + 0.15 * Math.sin(t * 1.3));
    },
  };
}
