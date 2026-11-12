import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BOSS_LOOK as L, FRERE_SONNEUR as F, WINE_LOOK } from '../config/bosses';
import { PLANET_RADIUS } from '../config/world';
import { createGroundMarks, type GroundMark } from '../fx/groundMarks';
import type { Abbe } from '../game/abbe';
import type { Boss, BossKind } from '../game/boss';
import type { FrereSonneur } from '../game/frereSonneur';
import { characterMaterial, LAYER_CHARACTER, LAYER_SKY } from '../render/materials';
import { ABBE } from '../config/bosses';
import { heightAt } from './terrain';

/** Ce qu'il faut pour dessiner un boss : son modèle, sa hauteur (m), sa vitesse de marche (pour la cadence des pas). */
export type BossModel = { kind: BossKind; url: string; height: number; walkSpeed: number };

/** Animations jouées une seule fois (elles restent sur leur dernière image). */
const ONCE = ['strike', 'cast', 'roar', 'death'];

/**
 * Rendu d'un boss (modèles sculptés de tools/blender/) : le modèle détaillé en cel-shading, animé par un mixeur (fondu
 * entre les animations), posé là où la simulation le met, à sa taille (l'Abbé grandit). Une vue par boss : elle ne
 * dessine que le boss de son type, et garde son corps le temps qu'il tombe après sa mort.
 */
export async function createBossView(scene: THREE.Scene, M: BossModel) {
  const gltf = await new GLTFLoader().loadAsync(M.url);
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const scale = M.height / (box.max.y - box.min.y);
  const materials: THREE.MeshToonMaterial[] = [];
  const mats = new Map<string, THREE.MeshToonMaterial>();
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.MeshStandardMaterial;
    let m = mats.get(src.name);
    if (!m) { m = characterMaterial({ color: src.color }); m.name = src.name; mats.set(src.name, m); materials.push(m); }
    mesh.material = m;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.layers.set(LAYER_CHARACTER);
    mesh.frustumCulled = false;
  });
  const root = new THREE.Group();
  const holder = new THREE.Group();
  holder.scale.setScalar(scale);
  holder.add(model);
  root.add(holder);
  root.visible = false;
  scene.add(root);

  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map<string, THREE.AnimationAction>();
  for (const clip of gltf.animations) {
    const a = mixer.clipAction(clip);
    if (ONCE.includes(clip.name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    actions.set(clip.name, a);
  }
  let current: THREE.AnimationAction | null = null;
  let shown: string | null = null;
  let flash = 0;
  let held: Boss | null = null;
  const up = new THREE.Vector3(), side = new THREE.Vector3(), fwd = new THREE.Vector3(), basis = new THREE.Matrix4();

  function play(anim: string) {
    const next = actions.get(anim);
    if (!next || next === current) return;
    next.reset().setEffectiveWeight(1).play();
    if (current) next.crossFadeFrom(current, 0.2, false);
    current = next;
  }

  return {
    /** Le boss a encaissé un coup : éclair blanc. */
    hit() { flash = 1; },
    /** Le boss de ce type dessiné en ce moment (y compris son corps qui tombe), ou null. */
    get boss() { return held; },
    /** Recopie le boss (null, ou d'un autre type : rien) ; `dt` : temps de jeu écoulé (0 : figé). */
    sync(live: Boss | null, dt: number) {
      if (live && live.kind === M.kind) held = live;
      const boss = held;
      const z = boss?.zombie;
      if (!boss || !z || z.gone) {
        root.visible = false;
        held = null;
        if (shown) { mixer.stopAllAction(); current = null; shown = null; }
        return;
      }
      root.visible = true;
      const anim = z.dead ? 'death' : boss.anim;
      if (shown !== anim) { shown = anim; play(anim); }
      if (current) current.timeScale = boss.anim === 'walk' ? Math.max(0.5, z.walkSpeed / M.walkSpeed) : 1;
      mixer.update(dt);
      // Debout sur le sol, tourné vers sa cible ; il sort de terre et s'y enfonce mort
      up.copy(z.pos).normalize();
      side.crossVectors(up, z.facing).normalize();
      fwd.crossVectors(side, up);
      basis.makeBasis(side, up, fwd);
      root.quaternion.setFromRotationMatrix(basis);
      root.scale.setScalar(boss.scale);
      root.position.copy(z.pos).addScaledVector(up, -z.sink * (M.height * boss.scale / 2));
      flash = Math.max(0, flash - dt / L.flashTime);
      for (const mat of materials) mat.emissive.setScalar(flash * flash * L.flash);
    },
  };
}

/** Ondes du Frère Sonneur : un anneau de segments lumineux posés un à un sur le relief, qui grandit comme l'onde du jeu. */
export function createWaveRingView(scene: THREE.Scene) {
  const N = L.waveSegments, maxWaves = 4;
  const segGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const segMat = new THREE.MeshBasicMaterial({ color: L.waveColor, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const segs = new THREE.InstancedMesh(segGeo, segMat, N * maxWaves);
  segs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  segs.frustumCulled = false;
  segs.layers.set(LAYER_SKY);
  segs.count = 0;
  scene.add(segs);
  const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
  const dir = new THREE.Vector3(), tan = new THREE.Vector3(), m = new THREE.Matrix4(), basis = new THREE.Matrix4(), pos = new THREE.Vector3(), s = new THREE.Vector3();
  const q = new THREE.Quaternion(), cw = new THREE.Vector3(), bw = new THREE.Vector3(), along = new THREE.Vector3(), out = new THREE.Vector3();

  return {
    sync(boss: FrereSonneur | null) {
      let n = 0;
      for (const w of boss && !boss.zombie.dead ? boss.waves : []) {
        if (n + N > N * maxWaves) break;
        const fade = 1 - w.radius / F.wave.maxRadius;
        const c = cw.copy(w.at).normalize();
        const a = tan.copy(Math.abs(c.y) < 0.9 ? Y : X).cross(c).normalize();
        const b = bw.crossVectors(c, a);
        const arc = w.radius / w.at.length();
        const segLen = (2 * Math.PI * Math.max(w.radius, 0.3)) / N * 1.15;
        for (let i = 0; i < N; i++) {
          const t = (i / N) * Math.PI * 2;
          dir.copy(a).multiplyScalar(Math.cos(t)).addScaledVector(b, Math.sin(t));
          pos.copy(c).multiplyScalar(Math.cos(arc)).addScaledVector(dir, Math.sin(arc)).normalize();
          const ground = PLANET_RADIUS + heightAt(pos);
          along.crossVectors(pos, dir).normalize();
          out.crossVectors(along, pos);
          basis.makeBasis(along, pos, out);
          q.setFromRotationMatrix(basis);
          s.set(segLen, L.waveHeight * (0.4 + 0.6 * fade), F.wave.width * 0.35);
          m.compose(pos.multiplyScalar(ground), q, s);
          segs.setMatrixAt(n++, m);
        }
      }
      segs.count = n;
      segs.instanceMatrix.needsUpdate = true;
    },
  };
}

/** Flaques de vin de l'Abbé : marquées (le disque se remplit jusqu'à l'allumage), puis brûlantes, épousant le relief. */
export function createWineView(scene: THREE.Scene) {
  const arming = createGroundMarks(scene, WINE_LOOK.arming);
  const burning = createGroundMarks(scene, WINE_LOOK.burning);
  const a: GroundMark[] = [], b: GroundMark[] = [];
  const pool: GroundMark[] = [];
  return {
    sync(boss: Abbe | null) {
      a.length = 0; b.length = 0;
      let k = 0;
      for (const w of boss ? boss.puddles : []) {
        const m = pool[k] ?? (pool[k] = { at: w.at, radius: 0, t: 0 });
        k++;
        m.at = w.at;
        const C = ABBE.cast;
        if (w.t < C.arm) { m.radius = w.radius; m.t = w.t / C.arm; a.push(m); }
        else {
          // Elle sèche en rétrécissant à la fin
          const left = C.arm + C.life - w.t;
          m.radius = w.radius * Math.min(1, left / 0.6);
          m.t = 1;
          b.push(m);
        }
      }
      arming.sync(a);
      burning.sync(b);
    },
  };
}
