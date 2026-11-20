import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BOSS_LOOK as L, FRERE_SONNEUR as F, WINE_LOOK } from '../config/bosses';
import { PLANET_RADIUS } from '../config/world';
import { createGroundMarks, type GroundMark } from '../fx/groundMarks';
import type { Abbe } from '../game/abbe';
import type { Boss, BossKind } from '../game/boss';
import type { BossWave } from '../game/frereSonneur';
import { characterMaterial, LAYER_CHARACTER, LAYER_SKY } from '../render/materials';
import { ABBE, GRAVE_BOSSES as G, LOGEN_LOOK, VADOR, VADOR_LOOK, XENO, XENO_LOOK, GUTS_LOOK } from '../config/bosses';
import type { Guts } from '../game/guts';
import type { Xeno } from '../game/xeno';
import type { Vador } from '../game/vador';
import type { Logen } from '../game/logen';
import { heightAt } from './terrain';

/** Ce qu'il faut pour dessiner un boss : son modèle, sa hauteur (m), sa vitesse de marche (pour la cadence des pas) ; `beam` : colonne de lumière au-dessus de lui tant qu'il attend (oui par défaut ; Sauron a celle du volcan). */
export type BossModel = { kind: BossKind; url: string; height: number; walkSpeed: number; beam?: boolean };

/** Animations jouées une seule fois (elles restent sur leur dernière image). */
const ONCE = ['strike', 'cast', 'roar', 'death', 'tail', 'slam', 'sweep'];

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
  const mats = new Map<string, THREE.Material>();
  /** Les pièces par matière (on peut en cacher : le sabre lancé n'est plus dans la main). */
  const parts = new Map<string, THREE.Object3D[]>();
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.MeshStandardMaterial;
    // Les pièces `glow_*` (sabre laser, lumières du plastron) brillent d'elles-mêmes, hors du contour sombre
    const glow = src.name.startsWith('glow_');
    let m = mats.get(src.name);
    if (!m) {
      if (glow) m = new THREE.MeshBasicMaterial({ color: src.color.clone().multiplyScalar(L.glowBoost), toneMapped: false });
      else { const t = characterMaterial({ color: src.color, map: src.map ?? null }); materials.push(t); m = t; }
      m.name = src.name;
      mats.set(src.name, m);
    }
    mesh.material = m;
    if (!parts.has(src.name)) parts.set(src.name, []);
    parts.get(src.name)!.push(mesh);
    mesh.castShadow = !glow;
    mesh.receiveShadow = false;
    mesh.layers.set(glow ? LAYER_SKY : LAYER_CHARACTER);
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
  // Le boss optionnel qui attend (avant le défi) : debout, en garde, sous une colonne de lumière
  const beamGeo = new THREE.CylinderGeometry(G.beamRadius * 0.6, G.beamRadius, G.beamHeight, 16, 1, true).translate(0, G.beamHeight / 2, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: G.beamColor, transparent: true, opacity: G.beamOpacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.layers.set(LAYER_SKY);
  beam.visible = false;
  scene.add(beam);
  let t = 0;
  const rageColor = new THREE.Color(GUTS_LOOK.rage.color);
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
    /** Cache (ou remontre) les pièces de ces matières. */
    hideParts(names: readonly string[], hidden: boolean) {
      for (const n of names) for (const o of parts.get(n) ?? []) o.visible = !hidden;
    },
    /** Le boss de ce type dessiné en ce moment (y compris son corps qui tombe), ou null. */
    get boss() { return held; },
    /**
     * Recopie le boss (null, ou d'un autre type : rien) ; `dt` : temps de jeu écoulé (0 : figé). `waiting` : le boss
     * optionnel de ce type qui attend qu'on le défie (debout, sous sa colonne de lumière).
     */
    sync(live: Boss | null, dt: number, waiting: { pos: THREE.Vector3; facing: THREE.Vector3 } | null = null) {
      if (live && live.kind === M.kind) held = live;
      const boss = held;
      const z = boss?.zombie;
      beam.visible = !!waiting && !boss && M.beam !== false;
      if (waiting && !boss) {
        t += dt;
        root.visible = true;
        if (shown !== 'idle') { shown = 'idle'; play('idle'); }
        mixer.update(dt);
        up.copy(waiting.pos).normalize();
        side.crossVectors(up, waiting.facing).normalize();
        fwd.crossVectors(side, up);
        root.quaternion.setFromRotationMatrix(basis.makeBasis(side, up, fwd));
        root.scale.setScalar(1);
        root.position.copy(waiting.pos);
        beam.position.copy(waiting.pos);
        beam.quaternion.copy(root.quaternion);
        (beam.material as THREE.MeshBasicMaterial).opacity = G.beamOpacity * (0.8 + 0.2 * Math.sin(t * 3));
        return;
      }
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
      // Un boss qui tourne sur lui-même (le tourbillon de Logen)
      if (boss.turn) root.rotateY(boss.turn);
      root.position.copy(z.pos).addScaledVector(up, -z.sink * (M.height * boss.scale / 2) + (boss.air ?? 0));
      flash = Math.max(0, flash - dt / L.flashTime);
      // Éclair blanc quand il encaisse ; lueur rouge de rage (le Berserker)
      const rage = boss.glow ?? 0;
      for (const mat of materials) mat.emissive.copy(rageColor).multiplyScalar(rage * GUTS_LOOK.rage.strength).addScalar(flash * flash * L.flash);
    },
  };
}

/** Une onde à dessiner : couleur, rayon où elle s'éteint, largeur de son front (m). */
export type WaveLook = { color: number; maxRadius: number; width: number };

/**
 * Ondes d'un boss (le Frère Sonneur, Sauron) : un anneau de segments lumineux posés un à un sur le relief, qui grandit
 * comme l'onde du jeu.
 */
export function createWaveRingView(scene: THREE.Scene, look: WaveLook = { color: L.waveColor, maxRadius: F.wave.maxRadius, width: F.wave.width }) {
  const N = L.waveSegments, maxWaves = 4;
  const segGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const segMat = new THREE.MeshBasicMaterial({ color: look.color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
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
    sync(boss: { waves: readonly BossWave[]; zombie: { dead: boolean } } | null) {
      let n = 0;
      for (const w of boss && !boss.zombie.dead ? boss.waves : []) {
        if (n + N > N * maxWaves) break;
        const fade = 1 - w.radius / look.maxRadius;
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
          s.set(segLen, L.waveHeight * (0.4 + 0.6 * fade), look.width * 0.35);
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

/** Coup de sabre de Vador : la zone marquée au sol, qui se remplit jusqu'au coup. */
export function createSaberMarkView(scene: THREE.Scene) {
  const marks = createGroundMarks(scene, VADOR_LOOK.strike);
  const list: GroundMark[] = [];
  const one: GroundMark = { at: new THREE.Vector3(), radius: 0, t: 0 };
  return {
    sync(boss: Vador | null) {
      list.length = 0;
      const m = boss && !boss.zombie.dead ? boss.mark : null;
      if (m) { one.at = m.at; one.radius = m.radius; one.t = m.t; list.push(one); }
      marks.sync(list);
    },
  };
}

/** Le sabre lancé de Vador : le sabre laser du jeu, lame rouge lumineuse, qui tourne à plat au-dessus du sol. */
export async function createThrownSaberView(scene: THREE.Scene, url: string) {
  const T = VADOR_LOOK.thrown;
  const src = (await new GLTFLoader().loadAsync(url)).scene;
  const root = new THREE.Group();
  const spinner = new THREE.Group();
  root.add(spinner);
  const box = new THREE.Box3().setFromObject(src);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  // Couché à plat : la lame (axe Y du modèle) le long de X, centré sur sa poignée tournante
  const holder = new THREE.Group();
  holder.add(src);
  src.position.sub(center);
  // Plus épais que dans la main : il doit se lire de loin
  const k = T.length / Math.max(size.x, size.y, size.z);
  holder.scale.set(k * T.thick, k, k * T.thick);
  holder.rotation.z = Math.PI / 2;
  spinner.add(holder);
  // Le flou de la rotation : un disque rouge lumineux, à plat
  const blur = new THREE.Mesh(new THREE.RingGeometry(T.length * 0.12, T.length * 0.5, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: T.blade, transparent: true, opacity: T.blur, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  blur.layers.set(LAYER_SKY);
  blur.frustumCulled = false;
  root.add(blur);
  src.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const blade = (mesh.material as THREE.Material).name.startsWith('lame');
    mesh.material = blade
      ? new THREE.MeshBasicMaterial({ color: new THREE.Color(T.blade).multiplyScalar(T.glow), toneMapped: false })
      : characterMaterial({ color: T.hilt });
    mesh.layers.set(blade ? LAYER_SKY : LAYER_CHARACTER);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
  });
  root.visible = false;
  scene.add(root);
  const up = new THREE.Vector3(), side = new THREE.Vector3(), fwd = new THREE.Vector3(), basis = new THREE.Matrix4();
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  let t = 0;
  return {
    sync(boss: Vador | null, dt: number) {
      const s = boss && !boss.zombie.dead ? boss.thrown : null;
      root.visible = !!s;
      if (!s) return;
      t += dt;
      up.copy(s.pos).normalize();
      fwd.crossVectors(Math.abs(up.y) < 0.9 ? Y : X, up).normalize();
      side.crossVectors(up, fwd);
      root.quaternion.setFromRotationMatrix(basis.makeBasis(side, up, fwd));
      root.position.copy(up).multiplyScalar(PLANET_RADIUS + heightAt(up) + VADOR.phase2.throw.height);
      spinner.rotation.y = t * T.spin;
    },
  };
}

/** Marques au sol de Logen : la bande de sa charge (des disques côte à côte qui se remplissent), le cercle de son tourbillon. */
export function createLogenMarksView(scene: THREE.Scene) {
  const lanes = createGroundMarks(scene, LOGEN_LOOK.charge);
  const rings = createGroundMarks(scene, LOGEN_LOOK.spin);
  const N = LOGEN_LOOK.chargeDiscs;
  const discs: GroundMark[] = Array.from({ length: N }, () => ({ at: new THREE.Vector3(), radius: 0, t: 0 }));
  const ring: GroundMark = { at: new THREE.Vector3(), radius: 0, t: 0 };
  const lane: GroundMark[] = [], one: GroundMark[] = [];
  const axis = new THREE.Vector3();
  return {
    sync(boss: Logen | null) {
      lane.length = 0; one.length = 0;
      const live = boss && !boss.zombie.dead ? boss : null;
      const l = live?.lane;
      if (l) {
        // Les disques le long de la bande, sur la sphère (de son départ jusqu'au bout de la charge)
        axis.crossVectors(l.from, l.dir).normalize();
        for (let i = 0; i < N; i++) {
          const m = discs[i];
          const along = ((i + 0.5) / N) * l.length;
          m.at.copy(l.from).applyAxisAngle(axis, along / l.from.length());
          m.radius = l.width / 2;
          m.t = l.t;
          lane.push(m);
        }
      }
      const r = live?.ring;
      if (r) { ring.at.copy(r.at); ring.radius = r.radius; ring.t = r.t; one.push(ring); }
      lanes.sync(lane);
      rings.sync(one);
    },
  };
}

/** Marques au sol du Xénomorphe : le point de chute de son bond, la bande de son coup de queue, ses flaques d'acide. */
export function createXenoMarksView(scene: THREE.Scene) {
  const pounce = createGroundMarks(scene, XENO_LOOK.pounce);
  const tails = createGroundMarks(scene, XENO_LOOK.tail);
  const acid = createGroundMarks(scene, XENO_LOOK.acid);
  const N = XENO_LOOK.tailDiscs;
  const discs: GroundMark[] = Array.from({ length: N }, () => ({ at: new THREE.Vector3(), radius: 0, t: 0 }));
  const ring: GroundMark = { at: new THREE.Vector3(), radius: 0, t: 0 };
  const pools: GroundMark[] = [];
  const lane: GroundMark[] = [], one: GroundMark[] = [], wet: GroundMark[] = [];
  const axis = new THREE.Vector3();
  return {
    sync(boss: Xeno | null) {
      lane.length = 0; one.length = 0; wet.length = 0;
      const live = boss && !boss.zombie.dead ? boss : null;
      const l = live?.lane;
      if (l) {
        axis.crossVectors(l.from, l.dir).normalize();
        for (let i = 0; i < N; i++) {
          const m = discs[i];
          m.at.copy(l.from).applyAxisAngle(axis, (((i + 0.5) / N) * l.length) / l.from.length());
          m.radius = l.width / 2;
          m.t = l.t;
          lane.push(m);
        }
      }
      const r = live?.mark;
      if (r) { ring.at.copy(r.at); ring.radius = r.radius; ring.t = r.t; one.push(ring); }
      let k = 0;
      for (const w of boss ? boss.pools : []) {
        const m = pools[k] ?? (pools[k] = { at: w.at, radius: 0, t: 1 });
        k++;
        m.at = w.at;
        // Elle s'étale vite, puis sèche en rétrécissant à la fin
        m.radius = w.radius * Math.min(1, w.t / 0.25, (XENO.phase2.acid.life - w.t) / 0.6);
        m.t = 1;
        wet.push(m);
      }
      tails.sync(lane);
      pounce.sync(one);
      acid.sync(wet);
    },
  };
}

/** Marques au sol de Guts : l'arc de son fauchage (des rangs de disques en éventail), la bande de son coup abattu. */
export function createGutsMarksView(scene: THREE.Scene) {
  const arcs = createGroundMarks(scene, GUTS_LOOK.sweep);
  const lanes = createGroundMarks(scene, GUTS_LOOK.slam);
  const fan: GroundMark[] = [];
  for (const [, n] of GUTS_LOOK.sweepRows) for (let i = 0; i < n; i++) fan.push({ at: new THREE.Vector3(), radius: 0, t: 0 });
  const N = GUTS_LOOK.slamDiscs;
  const discs: GroundMark[] = Array.from({ length: N }, () => ({ at: new THREE.Vector3(), radius: 0, t: 0 }));
  const a1: GroundMark[] = [], l1: GroundMark[] = [];
  const axis = new THREE.Vector3(), dir = new THREE.Vector3(), up = new THREE.Vector3();
  return {
    sync(boss: Guts | null) {
      a1.length = 0; l1.length = 0;
      const live = boss && !boss.zombie.dead ? boss : null;
      const a = live?.arc;
      if (a) {
        up.copy(a.at).normalize();
        let k = 0;
        for (const [dist, n] of GUTS_LOOK.sweepRows) {
          for (let i = 0; i < n; i++) {
            const m = fan[k++];
            // Le long de l'arc, d'un bord à l'autre
            const ang = -a.half + (2 * a.half * i) / Math.max(1, n - 1);
            dir.copy(a.dir).applyAxisAngle(up, ang);
            axis.crossVectors(a.at, dir).normalize();
            m.at.copy(a.at).applyAxisAngle(axis, Math.min(dist, a.radius - GUTS_LOOK.sweepDisc * 0.5) / a.at.length());
            m.radius = GUTS_LOOK.sweepDisc;
            m.t = a.t;
            a1.push(m);
          }
        }
      }
      const l = live?.lane;
      if (l) {
        axis.crossVectors(l.from, l.dir).normalize();
        for (let i = 0; i < N; i++) {
          const m = discs[i];
          m.at.copy(l.from).applyAxisAngle(axis, (((i + 0.5) / N) * l.length) / l.from.length());
          m.radius = l.width / 2;
          m.t = l.t;
          l1.push(m);
        }
      }
      arcs.sync(a1);
      lanes.sync(l1);
    },
  };
}
