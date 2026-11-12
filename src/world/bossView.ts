import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import sonneurUrl from '../assets/models/sonneur.glb?url';
import bellUrl from '../assets/models/cloche_geante.glb?url';
import { BOSS_LOOK as L, FRERE_SONNEUR as F } from '../config/bosses';
import type { BossAnim, FrereSonneur } from '../game/frereSonneur';
import { characterMaterial, LAYER_CHARACTER, LAYER_SKY } from '../render/materials';
import { heightAt } from './terrain';
import { PLANET_RADIUS } from '../config/world';

/** Animations jouées une seule fois (elles restent sur leur dernière image). */
const ONCE: BossAnim[] = ['strike', 'push', 'roar', 'death'];

/**
 * Rendu du Frère Sonneur (tools/blender/sonneur.py) : le modèle détaillé en cel-shading, animé par un mixeur
 * (fondu entre les animations), posé là où la simulation le met ; ses ondes, un anneau de segments lumineux
 * posés un à un sur le relief, qui grandit exactement comme l'onde du jeu ; sa cloche géante
 * (tools/blender/cloche_geante.py), qui tremble quand il la sonne, se couche pour rouler et se redresse à l'arrêt.
 */
export async function createBossView(scene: THREE.Scene) {
  const gltf = await new GLTFLoader().loadAsync(sonneurUrl);
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const scale = F.height / (box.max.y - box.min.y);
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
    if (ONCE.includes(clip.name as BossAnim)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    actions.set(clip.name, a);
  }
  let current: THREE.AnimationAction | null = null;
  let shown: BossAnim | null = null;
  let flash = 0;
  let held: FrereSonneur | null = null;

  // Ondes : segments lumineux posés sur le relief
  const N = L.waveSegments, maxWaves = 4;
  const segGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const segMat = new THREE.MeshBasicMaterial({ color: L.waveColor, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const segs = new THREE.InstancedMesh(segGeo, segMat, N * maxWaves);
  segs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  segs.frustumCulled = false;
  segs.layers.set(LAYER_SKY);
  segs.count = 0;
  scene.add(segs);

  // Cloche géante
  const bellGltf = await new GLTFLoader().loadAsync(bellUrl);
  const bellModel = bellGltf.scene;
  const bellBox = new THREE.Box3().setFromObject(bellModel);
  const bellScale = F.bell.height / (bellBox.max.y - bellBox.min.y);
  bellModel.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const name = (mesh.material as THREE.Material).name;
    mesh.material = characterMaterial({ color: L.bellColors[name] ?? 0xc48a3a, side: THREE.DoubleSide });
    mesh.castShadow = true;
    mesh.layers.set(LAYER_CHARACTER);
  });
  const clapper = bellModel.getObjectByName('battant');
  const bellRoot = new THREE.Group();
  const bellHolder = new THREE.Group();
  bellHolder.scale.setScalar(bellScale);
  bellHolder.add(bellModel);
  bellRoot.add(bellHolder);
  bellRoot.visible = false;
  scene.add(bellRoot);
  // Couchée ou debout : moment où elle a changé (temps de la vue), pour le fondu
  let bellTime = 0, rollChange = -10, wasRolling = false;
  const qUp = new THREE.Quaternion(), qLie = new THREE.Quaternion(), qRoll = new THREE.Quaternion(), qShake = new THREE.Quaternion();
  const lieAt = new THREE.Vector3(), axis = new THREE.Vector3(), shakeAxis = new THREE.Vector3();

  const Y = new THREE.Vector3(0, 1, 0);
  const up = new THREE.Vector3(), side = new THREE.Vector3(), fwd = new THREE.Vector3(), dir = new THREE.Vector3();
  const tan = new THREE.Vector3(), m = new THREE.Matrix4(), basis = new THREE.Matrix4(), pos = new THREE.Vector3(), s = new THREE.Vector3();
  const q = new THREE.Quaternion(), cw = new THREE.Vector3(), bw = new THREE.Vector3(), along = new THREE.Vector3(), out = new THREE.Vector3();

  function play(anim: BossAnim) {
    const next = actions.get(anim);
    if (!next || next === current) return;
    next.reset().setEffectiveWeight(1).play();
    if (current) next.crossFadeFrom(current, 0.2, false);
    current = next;
  }

  /** La cloche : debout (elle tremble quand elle sonne), couchée quand elle roule, fondu entre les deux. */
  function syncBell(boss: FrereSonneur, dt: number) {
    const b = boss.bell;
    bellTime += dt;
    if (b.rolling !== wasRolling) { wasRolling = b.rolling; rollChange = bellTime; }
    const since = bellTime - rollChange;
    let k = b.rolling ? Math.min(1, since / L.tipTime) : 1 - Math.min(1, since / L.standTime);
    k = k * k * (3 - 2 * k);
    up.copy(b.pos).normalize();
    // Debout : axe de la cloche sur la verticale
    qUp.setFromUnitVectors(Y, up);
    // Couchée : axe en travers de la route, elle tourne autour en roulant
    axis.crossVectors(up, b.dir.lengthSq() > 0 ? b.dir : side.set(1, 0, 0)).normalize();
    qLie.setFromUnitVectors(Y, axis);
    qRoll.setFromAxisAngle(axis, -b.spin);
    qLie.premultiply(qRoll);
    lieAt.copy(b.pos).addScaledVector(up, F.bell.radius).addScaledVector(axis, -F.bell.height / 2);
    bellRoot.position.copy(b.pos).lerp(lieAt, k);
    bellRoot.quaternion.copy(qUp).slerp(qLie, k);
    // Sonnée : elle tremble et le battant se balance, de moins en moins
    const r = b.rungAgo < L.ringTime ? 1 - b.rungAgo / L.ringTime : 0;
    if (r > 0 && k < 0.01) {
      shakeAxis.set(Math.sin(b.rungAgo * 7), 0, Math.cos(b.rungAgo * 7)).normalize();
      qShake.setFromAxisAngle(shakeAxis, Math.sin(b.rungAgo * 38) * L.ringShake * r);
      bellRoot.quaternion.multiply(qShake);
    }
    if (clapper) clapper.rotation.x = Math.sin(b.rungAgo * 9) * L.clapperSwing * r;
    bellRoot.visible = true;
  }

  return {
    /** Le boss a encaissé un coup : éclair blanc. */
    hit() { flash = 1; },
    /** Recopie le boss (null : aucun) ; `dt` : temps de jeu écoulé (0 : figé). */
    sync(live: FrereSonneur | null, dt: number) {
      // Tué, le boss n'est plus suivi par le jeu : on garde son corps le temps qu'il tombe et s'enfonce
      if (live) held = live;
      const boss = held;
      const z = boss?.zombie;
      if (!boss || !z || z.gone) {
        root.visible = false;
        bellRoot.visible = false;
        segs.count = 0;
        held = null;
        if (shown) { mixer.stopAllAction(); current = null; shown = null; }
        return;
      }
      root.visible = true;
      syncBell(boss, dt);
      const anim: BossAnim = z.dead ? 'death' : boss.anim;
      if (shown !== anim) { shown = anim; play(anim); }
      if (current) current.timeScale = boss.anim === 'walk' ? Math.max(0.5, z.walkSpeed / F.speed) : 1;
      mixer.update(dt);
      // Debout sur le sol, tourné vers sa cible ; il sort de terre et s'y enfonce mort
      up.copy(z.pos).normalize();
      side.crossVectors(up, z.facing).normalize();
      fwd.crossVectors(side, up);
      basis.makeBasis(side, up, fwd);
      root.quaternion.setFromRotationMatrix(basis);
      root.position.copy(z.pos).addScaledVector(up, -z.sink * (F.height / 2));
      flash = Math.max(0, flash - dt / L.flashTime);
      for (const mat of materials) mat.emissive.setScalar(flash * flash * L.flash);

      // Ondes
      let n = 0;
      for (const w of z.dead ? [] : boss.waves) {
        if (n + N > N * maxWaves) break;
        const fade = 1 - w.radius / F.wave.maxRadius;
        const c = cw.copy(w.at).normalize();
        const a = tan.copy(Math.abs(c.y) < 0.9 ? Y : side).cross(c).normalize();
        const b = bw.crossVectors(c, a);
        const arc = w.radius / z.pos.length();
        const segLen = (2 * Math.PI * Math.max(w.radius, 0.3)) / N * 1.15;
        for (let i = 0; i < N; i++) {
          const t = (i / N) * Math.PI * 2;
          dir.copy(a).multiplyScalar(Math.cos(t)).addScaledVector(b, Math.sin(t));
          pos.copy(c).multiplyScalar(Math.cos(arc)).addScaledVector(dir, Math.sin(arc)).normalize();
          const ground = PLANET_RADIUS + heightAt(pos);
          // Segment debout, couché le long du cercle
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
