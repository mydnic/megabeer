import * as THREE from 'three';
import { XP_DROPS as X } from '../config/xp';
import { LAYER_CHARACTER } from '../render/materials';

/**
 * Gouttes de bière (XP) : rondes, dorées, en lévitation au-dessus du sol, qui flottent doucement.
 * À portée de ramassage, elles filent vers le Buveur en accélérant et sont avalées. Un seul dessin.
 */
export function createXpDrops(scene: THREE.Scene, groundAt: (p: THREE.Vector3) => number) {
  const geo = new THREE.SphereGeometry(1, 16, 12);
  const mat = new THREE.MeshToonMaterial({ color: X.color, emissive: X.color, emissiveIntensity: X.glow });
  const mesh = new THREE.InstancedMesh(geo, mat, X.max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.layers.set(LAYER_CHARACTER); // contour comme les persos : lisible sur l'herbe
  mesh.count = 0;
  scene.add(mesh);

  type Drop = { pos: THREE.Vector3; base: THREE.Vector3; vel: THREE.Vector3; value: number; size: number; phase: number; flying: boolean; age: number };
  const drops: Drop[] = [];
  const up = new THREE.Vector3(), tmp = new THREE.Vector3(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();

  return {
    /** Lâche une goutte de valeur `value` (XP) au point donné (pieds du zombie). */
    drop(at: THREE.Vector3, value: number) {
      if (drops.length >= X.max) return;
      const size = X.radius * Math.cbrt(value);
      // Petit éparpillement autour du point de mort
      up.copy(at).normalize();
      const off = tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.8);
      off.addScaledVector(up, -off.dot(up));
      const base = at.clone().add(off);
      base.setLength(groundAt(base));
      drops.push({ pos: base.clone().addScaledVector(up, X.hover), base, vel: new THREE.Vector3(), value, size, phase: Math.random() * 6.28, flying: false, age: 0 });
    },
    /**
     * Avance les gouttes. `target` = point d'aspiration (le torse du joueur), `range` = rayon de
     * ramassage. Appelle `onCollect(value)` pour chaque goutte avalée.
     */
    update(dt: number, target: THREE.Vector3, range: number, onCollect: (value: number) => void) {
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.age += dt;
        if (!d.flying && d.pos.distanceTo(target) < range) d.flying = true;
        if (d.flying) {
          // Aspirée : accélère vers le joueur
          tmp.subVectors(target, d.pos);
          const dist = tmp.length();
          if (dist < X.collectDist) { onCollect(d.value); drops.splice(i, 1); continue; }
          d.vel.addScaledVector(tmp.divideScalar(dist), X.attract * dt);
          if (d.vel.length() > X.maxSpeed) d.vel.setLength(X.maxSpeed);
          d.pos.addScaledVector(d.vel, dt);
        } else {
          // Lévitation au-dessus du point de chute
          up.copy(d.base).normalize();
          const rise = Math.min(1, d.age * 4); // monte en sortant du corps
          d.pos.copy(d.base).addScaledVector(up, X.hover * rise + Math.sin(d.age * X.bobSpeed + d.phase) * X.bob);
        }
      }
      drops.forEach((d, i) => {
        // Légère pulsation, apparition en grossissant
        const k = d.size * Math.min(1, d.age * 6) * (1 + Math.sin(d.age * 5 + d.phase) * 0.06);
        mesh.setMatrixAt(i, m.compose(d.pos, q, s.setScalar(k)));
      });
      mesh.count = drops.length;
      mesh.instanceMatrix.needsUpdate = true;
    },
    clear() { drops.length = 0; mesh.count = 0; },
  };
}
