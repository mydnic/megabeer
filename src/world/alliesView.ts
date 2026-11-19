import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ALLIES, ALLY_FX as FX, ALLY_LOOK as L, type AllyId } from '../config/allies';
import type { Allies } from '../game/allies';
import { characterMaterial, LAYER_CHARACTER, LAYER_SKY } from '../render/materials';
import { withNormals } from '../render/meshPrep';

const urls = import.meta.glob('../assets/models/*.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const urlOf = (file: string) => Object.entries(urls).find(([k]) => k.endsWith(`/${file}`))?.[1];

/** Un allié affiché : son modèle, son mixeur et ses clips (repos, course, pouvoir), sa colonne de lumière quand il attend. */
type Shown = {
  root: THREE.Group; mixer: THREE.AnimationMixer | null;
  idle: THREE.AnimationAction | null; run: THREE.AnimationAction | null; power: THREE.AnimationAction | null;
  moving: boolean; beam: THREE.Mesh;
};

/** Matières des personnages : cel-shading, ombres, contours ; la transparence des textures (cheveux) gardée. */
function toCharacter(model: THREE.Object3D) {
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry = withNormals(m.geometry);
    const src = m.material as THREE.MeshStandardMaterial;
    m.material = characterMaterial({ color: src.color, map: src.map ?? null, alphaTest: src.alphaTest || (src.transparent ? 0.5 : 0), side: src.side });
    m.castShadow = true;
    m.layers.set(LAYER_CHARACTER);
    m.frustumCulled = false;
  });
}

/**
 * Les alliés (issue #18) : chacun à sa place, en cel-shading comme les personnages. Il attend dans son abbaye sous une
 * colonne de lumière (pour le trouver) ; il suit le joueur en courant (ou en sautillant, s'il n'a pas de clip de course) ;
 * il joue son geste de pouvoir quand il l'use. Et ce qu'ils lancent ou posent : les Kienzan, les blocs de TNT.
 */
export async function createAlliesView(scene: THREE.Scene) {
  const kinds = Object.keys(ALLIES) as AllyId[];
  const shown = new Map<AllyId, Shown>();
  const beamGeo = new THREE.CylinderGeometry(L.beamRadius * 0.6, L.beamRadius, L.beamHeight, 16, 1, true).translate(0, L.beamHeight / 2, 0);
  for (const kind of kinds) {
    const url = urlOf(ALLIES[kind].file);
    if (!url) continue;
    const gltf = await new GLTFLoader().loadAsync(url);
    const model = gltf.scene;
    toCharacter(model);
    const root = new THREE.Group();
    root.add(model);
    root.visible = false;
    scene.add(root);
    let mixer: THREE.AnimationMixer | null = null;
    let idle: THREE.AnimationAction | null = null, run: THREE.AnimationAction | null = null, power: THREE.AnimationAction | null = null;
    if (gltf.animations.length) {
      mixer = new THREE.AnimationMixer(model);
      const clip = (...names: string[]) => gltf.animations.find((a) => names.includes(a.name));
      const i = clip('idle'), r = clip('run'), p = clip('power', 'staff');
      if (i) { idle = mixer.clipAction(i); idle.play(); }
      if (r) { run = mixer.clipAction(r); run.setEffectiveWeight(0); run.play(); }
      if (p) { power = mixer.clipAction(p); power.setLoop(THREE.LoopOnce, 1); power.clampWhenFinished = false; }
      // Geste fini : il reprend la course ou le repos
      mixer.addEventListener('finished', () => {
        const me = shown.get(kind)!;
        me.power?.fadeOut(0.15);
        (me.moving && me.run ? me.run : me.idle)?.setEffectiveWeight(1);
      });
    }
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: L.beamColor, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.layers.set(LAYER_SKY);
    beam.visible = false;
    scene.add(beam);
    shown.set(kind, { root, mixer, idle, run, power, moving: false, beam });
  }

  // Kienzan : un disque plat de lumière qui tourne sur lui-même
  const discGeo = new THREE.CylinderGeometry(FX.disc.radius, FX.disc.radius, FX.disc.thickness, 32);
  const discMat = new THREE.MeshBasicMaterial({ color: FX.disc.color, toneMapped: false });
  const haloMat = new THREE.MeshBasicMaterial({ color: FX.disc.color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const discs: THREE.Group[] = [];
  const discAt = (i: number) => {
    while (discs.length <= i) {
      const g = new THREE.Group();
      const core = new THREE.Mesh(discGeo, discMat);
      const halo = new THREE.Mesh(discGeo, haloMat);
      halo.scale.set(1.35, 2, 1.35);
      core.layers.set(LAYER_SKY); halo.layers.set(LAYER_SKY);
      g.add(core, halo);
      g.visible = false;
      scene.add(g);
      discs.push(g);
    }
    return discs[i];
  };

  // TNT : le bloc fourni ; une coque blanche par-dessus qui clignote de plus en plus vite
  const tntUrl = urlOf(FX.tnt.file);
  const tntModel = tntUrl ? (await new GLTFLoader().loadAsync(tntUrl)).scene : new THREE.Group();
  toCharacter(tntModel);
  const box = new THREE.Box3().setFromObject(tntModel);
  const size = box.getSize(new THREE.Vector3());
  const flashGeo = new THREE.BoxGeometry(size.x * 1.04, size.y * 1.04, size.z * 1.04).translate(0, size.y / 2, 0);
  const tnts: { root: THREE.Group; flash: THREE.Mesh }[] = [];
  const tntAt = (i: number) => {
    while (tnts.length <= i) {
      const root = new THREE.Group();
      root.add(tntModel.clone());
      const flash = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      flash.layers.set(LAYER_SKY);
      root.add(flash);
      root.visible = false;
      scene.add(root);
      tnts.push({ root, flash });
    }
    return tnts[i];
  };

  const up = new THREE.Vector3(), right = new THREE.Vector3(), fwd = new THREE.Vector3(), basis = new THREE.Matrix4();
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  let t = 0;
  return {
    /** Un allié use de son pouvoir : il joue son geste. */
    power(kind: AllyId) {
      const s = shown.get(kind);
      if (!s?.power) return;
      (s.moving && s.run ? s.run : s.idle)?.setEffectiveWeight(0);
      s.power.reset().setEffectiveTimeScale(L.powerRate).setEffectiveWeight(1).fadeIn(0.1).play();
    },
    /** Chaque image : chaque allié à sa place (caché hors run ou une fois parti), les Kienzan, les blocs de TNT. */
    sync(allies: Allies, inRun: boolean, dt: number) {
      t += dt;
      for (const [kind, s] of shown) {
        const a = inRun ? allies.list.find((x) => x.kind === kind) : undefined;
        const on = !!a && a.state !== 'gone';
        s.root.visible = on;
        s.beam.visible = on && a!.state === 'waiting';
        if (!on || !a) continue;
        up.copy(a.pos).normalize();
        right.crossVectors(up, a.facing).normalize();
        s.root.position.copy(a.pos);
        // En marche : il court (ou sautille, sans clip de course) ; à l'arrêt, il respire
        const moving = a.speed > 0.5;
        if (moving !== s.moving && s.run) {
          const busy = s.power?.isRunning() && s.power.getEffectiveWeight() > 0;
          if (!busy) { (moving ? s.idle : s.run)?.setEffectiveWeight(0); (moving ? s.run : s.idle)?.setEffectiveWeight(1); }
        }
        s.moving = moving;
        if (s.run) s.run.setEffectiveTimeScale(THREE.MathUtils.clamp(a.speed / 6, 0.6, 1.6));
        const hop = s.run ? 0 : moving ? Math.abs(Math.sin(t * L.hopRate)) * L.hop : Math.sin(t * 2) * 0.01;
        s.root.position.addScaledVector(up, hop);
        s.root.quaternion.setFromRotationMatrix(basis.makeBasis(right, up, a.facing));
        s.mixer?.update(dt);
        if (s.beam.visible) {
          s.beam.position.copy(a.pos);
          s.beam.quaternion.copy(s.root.quaternion);
          (s.beam.material as THREE.MeshBasicMaterial).opacity = 0.22 + 0.08 * Math.sin(t * 3);
        }
      }
      const ds = inRun ? allies.discs : [];
      for (let i = 0; i < ds.length; i++) {
        const g = discAt(i), d = ds[i];
        up.copy(d.pos).normalize();
        g.visible = true;
        g.position.copy(d.pos).addScaledVector(up, FX.disc.height);
        right.crossVectors(up, d.dir).normalize();
        // Le disque à plat (son axe sur la verticale du sol), qui tourne
        g.quaternion.setFromRotationMatrix(basis.makeBasis(right, up, d.dir));
        g.rotateY(t * FX.disc.spin);
      }
      for (let i = ds.length; i < discs.length; i++) discs[i].visible = false;
      const ts = inRun ? allies.tnts : [];
      for (let i = 0; i < ts.length; i++) {
        const v = tntAt(i), b = ts[i];
        up.copy(b.pos).normalize();
        fwd.crossVectors(Math.abs(up.y) < 0.9 ? Y : X, up).normalize();
        right.crossVectors(up, fwd);
        v.root.visible = true;
        v.root.position.copy(b.pos);
        v.root.quaternion.setFromRotationMatrix(basis.makeBasis(right, up, fwd));
        const k = 1 - Math.max(0, b.fuse) / b.fuseTime;
        const rate = FX.tnt.blink[0] + (FX.tnt.blink[1] - FX.tnt.blink[0]) * k;
        (v.flash.material as THREE.MeshBasicMaterial).opacity = Math.sin(b.fuse * rate) > 0 ? 0.75 : 0;
        v.root.scale.setScalar(1 + FX.tnt.swell * k * k);
      }
      for (let i = ts.length; i < tnts.length; i++) tnts[i].root.visible = false;
    },
  };
}
