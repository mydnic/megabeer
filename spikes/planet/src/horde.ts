// Test technique jetable (GDD section 20, étape 0b) : horde de zombies instanciés sur la sphère.
// - un seul InstancedMesh, animation de marche calculée dans le shader (aucun coût CPU par os)
// - poursuite du joueur dans le plan tangent, collage au relief
// - séparation entre zombies via une grille de hachage spatiale
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const MAX = 4000;

function zombieGeometry(): THREE.BufferGeometry {
  // part : 0 corps, 1 jambe gauche, 2 jambe droite, 3 bras gauche, 4 bras droit
  const parts: [THREE.BufferGeometry, number][] = [
    [new THREE.BoxGeometry(0.6, 0.7, 0.35).translate(0, 1.15, 0), 0],
    [new THREE.BoxGeometry(0.4, 0.4, 0.4).translate(0, 1.72, 0.04), 0],
    [new THREE.BoxGeometry(0.24, 0.8, 0.24).translate(-0.16, 0.4, 0), 1],
    [new THREE.BoxGeometry(0.24, 0.8, 0.24).translate(0.16, 0.4, 0), 2],
    [new THREE.BoxGeometry(0.17, 0.17, 0.7).translate(-0.4, 1.4, 0.35), 3],
    [new THREE.BoxGeometry(0.17, 0.17, 0.7).translate(0.4, 1.4, 0.35), 4],
  ];
  for (const [g, part] of parts) {
    const n = g.attributes.position.count;
    g.setAttribute('aPart', new THREE.Float32BufferAttribute(new Array(n).fill(part), 1));
  }
  return mergeGeometries(parts.map((p) => p[0]))!;
}

export type Horde = ReturnType<typeof createHorde>;

export function createHorde(
  scene: THREE.Scene,
  heightAt: (d: THREE.Vector3) => number,
  R: number,
) {
  const geo = zombieGeometry();
  const phase = new Float32Array(MAX);
  for (let i = 0; i < MAX; i++) phase[i] = Math.random() * Math.PI * 2;
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));

  const uTime = { value: 0 };
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aPart;
attribute float aPhase;
uniform float uTime;
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
float t = uTime * 7.0 + aPhase;
float sw = sin(t) * 0.55;
if (aPart > 0.5 && aPart < 2.5) {
  float a = aPart < 1.5 ? sw : -sw;
  transformed.y -= 0.8; transformed = rotX(a) * transformed; transformed.y += 0.8;
} else if (aPart > 2.5) {
  float a = (aPart < 3.5 ? -sw : sw) * 0.3 - 0.15;
  transformed.y -= 1.4; transformed = rotX(a) * transformed; transformed.y += 1.4;
}
transformed.y += abs(cos(t)) * 0.06;`);
  };

  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false; // les instances sont partout autour du joueur
  const palette = [0x6f8f5a, 0x7d9a6a, 0x5f7d55, 0x8a8f60, 0x6a7f78].map((c) => new THREE.Color(c));
  for (let i = 0; i < MAX; i++) mesh.setColorAt(i, palette[i % palette.length]);
  scene.add(mesh);

  // État en tableaux plats (pas d'objets par zombie)
  const px = new Float32Array(MAX), py = new Float32Array(MAX), pz = new Float32Array(MAX);
  const speed = new Float32Array(MAX);
  let count = 0;

  // Grille de hachage spatiale (listes chaînées dans des tableaux)
  const CELL = 1.2, TABLE = 1 << 14;
  const head = new Int32Array(TABLE), next = new Int32Array(MAX);
  const hash = (x: number, y: number, z: number) =>
    ((Math.floor(x / CELL) * 73856093) ^ (Math.floor(y / CELL) * 19349663) ^ (Math.floor(z / CELL) * 83492791)) & (TABLE - 1);

  const v = new THREE.Vector3(), up = new THREE.Vector3(), t = new THREE.Vector3();
  function spawnAt(i: number, player: THREE.Vector3) {
    up.copy(player).normalize();
    t.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    t.addScaledVector(up, -t.dot(up)).normalize();
    const a = (38 + Math.random() * 25) / R; // distance au joueur le long de la surface
    v.copy(up).multiplyScalar(Math.cos(a)).addScaledVector(t, Math.sin(a)).normalize();
    v.multiplyScalar(R + heightAt(v));
    px[i] = v.x; py[i] = v.y; pz[i] = v.z;
    speed[i] = 2.6 + Math.random() * 2.2;
  }

  function setCount(n: number, player: THREE.Vector3) {
    n = Math.max(0, Math.min(MAX, n));
    for (let i = count; i < n; i++) spawnAt(i, player);
    count = n;
    mesh.count = n;
  }

  const m = new THREE.Matrix4(), fwd = new THREE.Vector3(), right = new THREE.Vector3();
  const pos = new THREE.Vector3(), push = new THREE.Vector3();
  const SEP = 0.9, SEP2 = SEP * SEP, STOP = 1.1;
  let heightTick = 0;
  const groundR = new Float32Array(MAX);

  function update(dt: number, time: number, player: THREE.Vector3) {
    uTime.value = time;

    // 1. Remplir la grille
    head.fill(-1);
    for (let i = 0; i < count; i++) {
      const h = hash(px[i], py[i], pz[i]);
      next[i] = head[h]; head[h] = i;
    }

    // Le relief n'est recalculé que pour un quart des zombies par frame (coût du bruit)
    heightTick = (heightTick + 1) & 3;

    const arr = mesh.instanceMatrix.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos.set(px[i], py[i], pz[i]);
      up.copy(pos).normalize();

      // 2. Direction vers le joueur dans le plan tangent
      fwd.subVectors(player, pos);
      fwd.addScaledVector(up, -fwd.dot(up));
      const dist = fwd.length();
      if (dist > 125) { spawnAt(i, player); continue; } // trop loin : réapparaît près du joueur
      fwd.divideScalar(dist || 1);

      // 3. Séparation avec les voisins (27 cellules)
      push.set(0, 0, 0);
      const cx = Math.floor(px[i] / CELL), cy = Math.floor(py[i] / CELL), cz = Math.floor(pz[i] / CELL);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const h = (((cx + dx) * 73856093) ^ ((cy + dy) * 19349663) ^ ((cz + dz) * 83492791)) & (TABLE - 1);
        for (let j = head[h]; j !== -1; j = next[j]) {
          if (j === i) continue;
          const ex = px[i] - px[j], ey = py[i] - py[j], ez = pz[i] - pz[j];
          const d2 = ex * ex + ey * ey + ez * ez;
          if (d2 < SEP2 && d2 > 1e-8) {
            const d = Math.sqrt(d2), k = (SEP - d) / d;
            push.x += ex * k; push.y += ey * k; push.z += ez * k;
          }
        }
      }
      push.addScaledVector(up, -push.dot(up));

      // 4. Avancer (s'arrêter au contact du joueur)
      const step = dist > STOP ? speed[i] * dt : 0;
      pos.addScaledVector(fwd, step).addScaledVector(push, Math.min(1, dt * 10));

      // 5. Coller au relief
      up.copy(pos).normalize();
      if ((i & 3) === heightTick || groundR[i] === 0) groundR[i] = R + heightAt(up);
      pos.copy(up).multiplyScalar(groundR[i]);
      px[i] = pos.x; py[i] = pos.y; pz[i] = pos.z;

      // 6. Matrice d'instance : vertical = normale, avant = vers le joueur
      right.crossVectors(up, fwd).normalize();
      fwd.crossVectors(right, up);
      m.makeBasis(right, up, fwd).setPosition(pos);
      m.toArray(arr, i * 16);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  return { update, setCount, get count() { return count; } };
}
