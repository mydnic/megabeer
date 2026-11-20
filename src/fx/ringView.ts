import * as THREE from 'three';
import { RING_LOOK } from '../config/bosses';
import { LAYER_SKY } from '../render/materials';

/**
 * L'Anneau unique (issue #20) : au sol après la chute de Sauron, un anneau d'or qui tourne en flottant, dans une lueur ;
 * puis, au doigt, le joueur invisible devient translucide (il se voit encore, les ennemis non).
 */
export function createRingView(scene: THREE.Scene) {
  const L = RING_LOOK;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(L.radius, L.tube, 16, 48),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(L.color).multiplyScalar(L.glow), toneMapped: false }),
  );
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(L.radius * 2.2, 16, 12),
    new THREE.MeshBasicMaterial({ color: L.color, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  const root = new THREE.Group();
  root.add(ring, halo);
  for (const o of [ring, halo]) o.layers.set(LAYER_SKY);
  root.visible = false;
  scene.add(root);
  const up = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  let t = 0;
  /** Opacité actuelle du joueur (1 : visible), et les matières qu'on a rendues translucides. */
  let fade = 1;
  const touched = new Set<THREE.Material>();
  /** Couches d'origine des pièces du joueur sorties des passes de contour pendant l'invisibilité. */
  const layers = new Map<THREE.Object3D, number>();

  return {
    /** L'Anneau au sol (`at`, null : aucun) ; `dt` : temps de jeu écoulé. */
    sync(at: THREE.Vector3 | null, dt: number) {
      t += dt;
      root.visible = !!at;
      if (!at) return;
      up.copy(at).normalize();
      root.position.copy(up).multiplyScalar(at.length() + L.hover + Math.sin(t * 2) * 0.12);
      root.quaternion.setFromUnitVectors(Y, up);
      ring.rotation.set(Math.PI / 2 - 0.35, t * L.spin, 0);
      halo.scale.setScalar(1 + 0.1 * Math.sin(t * 3));
    },
    /** Le joueur invisible devient translucide, en fondu. */
    syncPlayer(model: THREE.Object3D | null, invisible: boolean, dt: number) {
      const target = invisible ? L.playerOpacity : 1;
      fade += (target - fade) * Math.min(1, dt * 6);
      if (Math.abs(fade - target) < 0.01) fade = target;
      // Rien à faire tant qu'il est visible et que rien n'a été touché
      if (!model || (fade === 1 && touched.size === 0 && layers.size === 0)) return;
      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        // Translucide, il sort des passes de contour et d'occlusion (elles redessinaient sa silhouette pleine)
        if (fade < 1 && !layers.has(mesh)) { layers.set(mesh, mesh.layers.mask); mesh.layers.set(LAYER_SKY); }
        else if (fade === 1 && layers.has(mesh)) { mesh.layers.mask = layers.get(mesh)!; layers.delete(mesh); }
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          if (fade < 1) {
            if (!touched.has(m)) { touched.add(m); m.transparent = true; m.depthWrite = false; m.needsUpdate = true; }
            m.opacity = fade;
          } else if (touched.has(m)) {
            m.transparent = false;
            m.opacity = 1;
            m.depthWrite = true;
            m.needsUpdate = true;
            touched.delete(m);
          }
        }
      });
    },
  };
}
