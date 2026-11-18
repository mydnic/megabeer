import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VEHICLE_LOOK as L, VEHICLES, type VehicleId } from '../config/vehicles';
import { RARITIES } from '../config/upgrades';
import type { Vehicles } from '../game/vehicles';
import type { PlayerController } from '../player/controller';
import { characterMaterial, LAYER_CHARACTER, LAYER_SKY } from '../render/materials';
import { withNormals } from '../render/meshPrep';

const urls = import.meta.glob('../assets/models/vehicules/*.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** Tourelle (le tank) : le pivot qui la porte avec le canon, l'axe vertical dans le repère de son parent, sa pose de départ. */
type Turret = { pivot: THREE.Object3D; axis: THREE.Vector3; base: THREE.Quaternion; yaw: number };
/** Un véhicule prêt à poser : son groupe (capot vers +Z, roues à y = 0), ses roues qui tournent, ses animations et sa tourelle (tank). */
type Model = { root: THREE.Group; wheels: THREE.Object3D[]; mixer: THREE.AnimationMixer | null; forward: THREE.AnimationAction | null; turret: Turret | null };

/**
 * Charge un véhicule : tourné pour regarder vers l'avant, à sa longueur, centré, roues au sol, en cel-shading comme le
 * reste des objets. Les roues (nœuds « wheel ») sont recentrées pour tourner sur leur axe.
 */
async function loadModel(kind: VehicleId): Promise<Model> {
  const D = VEHICLES[kind];
  const url = Object.entries(urls).find(([k]) => k.endsWith(`/${D.file}`))?.[1];
  if (!url) throw new Error(`Modèle de véhicule introuvable : ${D.file}`);
  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  // Objets d'aide sans matière (le tank en a un), qui fausseraient la taille
  const helpers: THREE.Object3D[] = [];
  model.traverse((o) => { if (/^icosphere/i.test(o.name)) helpers.push(o); });
  for (const o of helpers) o.removeFromParent();
  const turn = new THREE.Group();
  turn.rotation.set(...(D.rotation.map((d) => THREE.MathUtils.degToRad(d)) as [number, number, number]));
  turn.add(model);
  const fit = new THREE.Group();
  fit.add(turn);
  fit.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(fit);
  const k = D.length / (box.max.z - box.min.z);
  fit.scale.setScalar(k);
  fit.position.set(-(box.min.x + box.max.x) / 2 * k, -box.min.y * k, -(box.min.z + box.max.z) / 2 * k);
  const root = new THREE.Group();
  root.add(fit);
  const wheels: THREE.Object3D[] = [];
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry = withNormals(m.geometry);
      const src = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[];
      const toon = src.map((s) => characterMaterial({ color: s.color ?? new THREE.Color(0x888888) }));
      m.material = Array.isArray(m.material) ? toon : toon[0];
      m.castShadow = true;
      m.layers.set(LAYER_CHARACTER);
      m.frustumCulled = false;
    }
    if (/wheel/i.test(o.name) && m.isMesh) {
      // Roue recentrée sur son moyeu
      m.geometry.computeBoundingBox();
      const c = m.geometry.boundingBox!.getCenter(new THREE.Vector3());
      m.geometry.translate(-c.x, -c.y, -c.z);
      m.position.add(c.multiply(m.scale).applyQuaternion(m.quaternion));
      wheels.push(m);
    }
  });
  let mixer: THREE.AnimationMixer | null = null, forward: THREE.AnimationAction | null = null;
  const clip = gltf.animations.find((a) => /forward/i.test(a.name));
  if (clip) { mixer = new THREE.AnimationMixer(model); forward = mixer.clipAction(clip); forward.play(); }
  // Tourelle et canon (le tank) : portés ensemble par un pivot posé au centre de la tourelle
  let turret: Turret | null = null;
  const top = model.getObjectByName('Tank_Turret'), gun = model.getObjectByName('Tank_Gun');
  if (top && top.parent) {
    root.updateMatrixWorld(true);
    const parent = top.parent;
    const centre = new THREE.Box3().setFromObject(top).getCenter(new THREE.Vector3());
    const pivot = new THREE.Object3D();
    parent.add(pivot);
    pivot.position.copy(parent.worldToLocal(centre));
    pivot.updateMatrixWorld(true);
    pivot.attach(top);
    if (gun) pivot.attach(gun);
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(parent.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
    turret = { pivot, axis, base: pivot.quaternion.clone(), yaw: 0 };
  }
  root.visible = false;
  return { root, wheels, mixer, forward, turret };
}

/**
 * Rendu des véhicules : celui qui est garé (une colonne de lumière de la couleur de sa rareté le signale de loin) ou
 * celui que le joueur conduit (à sa place, roues qui tournent selon le chemin parcouru).
 */
export async function createVehiclesView(scene: THREE.Scene) {
  const kinds = Object.keys(VEHICLES) as VehicleId[];
  const models = new Map<VehicleId, Model>();
  for (const k of kinds) {
    const m = await loadModel(k);
    scene.add(m.root);
    models.set(k, m);
  }
  // Colonne de lumière du véhicule garé : cône évasé additif qui s'éteint vers le haut
  const beamGeo = new THREE.CylinderGeometry(L.beamRadius * 0.6, L.beamRadius, L.beamHeight, 20, 1, true).translate(0, L.beamHeight / 2, 0);
  const beamMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.layers.set(LAYER_SKY);
  beam.visible = false;
  scene.add(beam);

  // Obus du tank : petites sphères sombres sur leur trajectoire en cloche
  const SHELLS = 8;
  const shellMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(L.shell.radius, 10, 8), characterMaterial({ color: L.shell.color }), SHELLS);
  shellMesh.layers.set(LAYER_CHARACTER);
  shellMesh.frustumCulled = false;
  shellMesh.count = 0;
  scene.add(shellMesh);
  const shellM = new THREE.Matrix4(), shellP = new THREE.Vector3(), shellUp = new THREE.Vector3();
  const local = new THREE.Vector3(), yawQ = new THREE.Quaternion();

  const up = new THREE.Vector3(), right = new THREE.Vector3(), basis = new THREE.Matrix4(), last = new THREE.Vector3();
  let shown: Model | null = null, t = 0;
  const place = (m: Model, pos: THREE.Vector3, facing: THREE.Vector3) => {
    up.copy(pos).normalize();
    right.crossVectors(up, facing).normalize();
    m.root.position.copy(pos);
    m.root.quaternion.setFromRotationMatrix(basis.makeBasis(right, up, facing));
  };

  return {
    /** Chaque image : le véhicule garé ou celui qu'on conduit, à sa place. */
    sync(vehicles: Vehicles, player: PlayerController, dt: number, inRun: boolean) {
      t += dt;
      // Obus en vol : du canon à la cible, en cloche
      shellMesh.count = 0;
      for (const s of vehicles.shells) {
        if (shellMesh.count >= SHELLS) break;
        const k = 1 - s.left / s.flight;
        shellP.lerpVectors(s.from, s.to, k);
        shellUp.copy(shellP).normalize();
        shellP.addScaledVector(shellUp, Math.sin(k * Math.PI) * s.from.distanceTo(s.to) * 0.12);
        shellMesh.setMatrixAt(shellMesh.count++, shellM.makeTranslation(shellP.x, shellP.y, shellP.z));
      }
      shellMesh.instanceMatrix.needsUpdate = true;
      const kind = !inRun ? null : vehicles.driving?.kind ?? vehicles.parked?.kind ?? null;
      const m = kind ? models.get(kind)! : null;
      if (shown && shown !== m) shown.root.visible = false;
      shown = m;
      beam.visible = false;
      if (!m) return;
      m.root.visible = true;
      if (vehicles.driving) {
        place(m, player.renderPos, player.renderFacing);
        // Roues : un tour par circonférence parcourue (en marche arrière, elles tournent à l'envers)
        const moved = last.distanceTo(player.renderPos) * Math.sign(player.carSpeed || 1);
        last.copy(player.renderPos);
        if (Math.abs(moved) < 5) for (const w of m.wheels) w.rotateX(moved * L.wheelTurnsPerMeter * Math.PI * 2);
        if (m.mixer) { m.forward!.timeScale = player.carSpeed * L.tracksPerSpeed; m.mixer.update(dt); }
        // Tourelle : elle se tourne vers le dernier ennemi visé, puis revient dans l'axe
        if (m.turret) {
          const T = m.turret;
          let want = 0;
          if (vehicles.driving.aim) { m.root.updateMatrixWorld(true); local.copy(vehicles.driving.aim); m.root.worldToLocal(local); want = Math.atan2(local.x, local.z); }
          let d = want - T.yaw;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          T.yaw += Math.sign(d) * Math.min(Math.abs(d), L.turretRate * dt);
          T.pivot.quaternion.copy(yawQ.setFromAxisAngle(T.axis, T.yaw)).multiply(T.base);
        }
      } else {
        const p = vehicles.parked!;
        place(m, p.pos, p.facing);
        last.copy(p.pos);
        beam.visible = true;
        beam.position.copy(p.pos);
        beam.quaternion.copy(m.root.quaternion);
        beamMat.color.set(RARITIES[VEHICLES[p.kind].rarity].color);
        beamMat.opacity = 0.25 + 0.1 * Math.sin(t * 3);
      }
    },
  };
}
