import * as THREE from 'three';
import { XP_DROPS as X } from '../config/xp';

/** Une goutte de bière (XP) : position, point de chute, valeur, et son état d'aspiration. */
export type XpDrop = {
  pos: THREE.Vector3; base: THREE.Vector3; speed: number; value: number;
  size: number; phase: number; flying: boolean; age: number;
};

/**
 * Gouttes de bière (XP), simulation seule (rendu dans xpDropsView.ts) : en lévitation au-dessus du
 * sol ; à portée de ramassage, elles filent en ligne droite vers le joueur en accélérant et sont
 * avalées (jamais d'orbite).
 */
export function createXpDrops(groundAt: (p: THREE.Vector3) => number) {
  const drops: XpDrop[] = [];
  const up = new THREE.Vector3(), tmp = new THREE.Vector3();

  return {
    drops: drops as readonly XpDrop[],
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
      drops.push({ pos: base.clone().addScaledVector(up, X.hover), base, speed: X.startSpeed, value, size, phase: Math.random() * 6.28, flying: false, age: 0 });
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
          tmp.subVectors(target, d.pos);
          const dist = tmp.length();
          d.speed = Math.min(X.maxSpeed, d.speed + X.attract * dt);
          const stepLen = d.speed * dt;
          if (dist < X.collectDist || stepLen >= dist) { onCollect(d.value); drops.splice(i, 1); continue; }
          d.pos.addScaledVector(tmp, stepLen / dist);
        } else {
          // Lévitation au-dessus du point de chute
          up.copy(d.base).normalize();
          const rise = Math.min(1, d.age * 4); // monte en sortant du corps
          d.pos.copy(d.base).addScaledVector(up, X.hover * rise + Math.sin(d.age * X.bobSpeed + d.phase) * X.bob);
        }
      }
    },
    clear() { drops.length = 0; },
  };
}
export type XpDrops = ReturnType<typeof createXpDrops>;
