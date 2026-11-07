import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BOTTLE_LOOK as L } from '../config/weapons';
import { characterMaterial, LAYER_CHARACTER } from '../render/materials';

const urls = import.meta.glob('../assets/quaternius-food-pack/*.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

type Bottle = {
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spinAxis: THREE.Vector3;
  spinRate: number;
  gravity: number;
  life: number;
  active: boolean;
  /** Données de l'arme qui l'a lancée (dégâts, perçage...). */
  payload: unknown;
};

/**
 * Bouteilles en vol : réserve d'objets réutilisés, chute vers le centre de la planète, rotation.
 * Les collisions (zombies, sol) sont décidées par l'appelant via `onStep`.
 */
export async function createBottles(scene: THREE.Scene) {
  const url = Object.entries(urls).find(([p]) => p.endsWith('/' + L.file))?.[1];
  if (!url) throw new Error(`Modèle de bouteille introuvable : ${L.file}`);
  const gltf = await new GLTFLoader().loadAsync(url);
  const template = gltf.scene;
  // Cel-shading et couleurs de la Blonde
  const mats = new Map<string, THREE.Material>();
  template.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.MeshStandardMaterial;
    let m = mats.get(src.name);
    if (!m) {
      const c = L.colors[src.name];
      m = characterMaterial({ color: c !== undefined ? new THREE.Color(c) : src.color });
      mats.set(src.name, m);
    }
    mesh.material = m;
    mesh.castShadow = true;
    mesh.layers.set(LAYER_CHARACTER);
  });
  // Recentrée sur son milieu, mise à la longueur voulue (axe Y = axe de la bouteille)
  const box = new THREE.Box3().setFromObject(template);
  const center = box.getCenter(new THREE.Vector3());
  template.position.sub(center);
  const holder = new THREE.Group();
  holder.add(template);
  holder.scale.setScalar(L.length / (box.max.y - box.min.y));

  const pool: Bottle[] = [];
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3();

  return {
    /** Lance une bouteille. */
    launch(pos: THREE.Vector3, vel: THREE.Vector3, gravity: number, spinRate: number, payload: unknown) {
      let b = pool.find((x) => !x.active);
      if (!b) {
        const mesh = holder.clone();
        scene.add(mesh);
        b = { mesh, pos: new THREE.Vector3(), vel: new THREE.Vector3(), spinAxis: new THREE.Vector3(), spinRate: 0, gravity: 0, life: 0, active: false, payload: null };
        pool.push(b);
      }
      b.pos.copy(pos);
      b.vel.copy(vel);
      b.gravity = gravity;
      b.spinRate = spinRate;
      b.life = 0;
      b.payload = payload;
      b.active = true;
      // Tourne « par-dessus » : axe horizontal perpendiculaire à la trajectoire
      up.copy(pos).normalize();
      b.spinAxis.crossVectors(vel, up).normalize();
      if (b.spinAxis.lengthSq() < 1e-6) b.spinAxis.set(1, 0, 0);
      b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
      b.mesh.position.copy(pos);
      b.mesh.visible = true;
      return b;
    },
    /**
     * Fait avancer les bouteilles. `onStep(b, prev)` renvoie false pour retirer la bouteille
     * (impact sur le sol ou fin de perçage).
     */
    update(dt: number, maxLife: number, onStep: (b: Bottle, prev: THREE.Vector3) => boolean) {
      const prev = new THREE.Vector3();
      for (const b of pool) {
        if (!b.active) continue;
        prev.copy(b.pos);
        up.copy(b.pos).normalize();
        b.vel.addScaledVector(up, -b.gravity * dt);
        b.pos.addScaledVector(b.vel, dt);
        b.life += dt;
        b.mesh.position.copy(b.pos);
        b.mesh.quaternion.premultiply(q.setFromAxisAngle(b.spinAxis, b.spinRate * Math.PI * 2 * dt));
        if (b.life > maxLife || !onStep(b, prev)) { b.active = false; b.mesh.visible = false; }
      }
    },
    clear() { for (const b of pool) { b.active = false; b.mesh.visible = false; } },
  };
}
export type Bottles = Awaited<ReturnType<typeof createBottles>>;
export type { Bottle };
