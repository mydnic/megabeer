import * as THREE from 'three';
import type { Projectile } from './weapon';

/**
 * Gouttes de jet pour l'affichage (Tireuse, Corne de brume) : des projectiles invisibles dont seule la traînée se
 * voit, lancés en éventail ; ils ne frappent rien (l'arme applique ses coups sur son cône), ils montrent le jet.
 */
export function createSpray() {
  const drops: (Projectile & { life: number })[] = [];
  const v = new THREE.Vector3(), up = new THREE.Vector3();
  return {
    drops,
    /** `n` gouttes depuis `from`, autour de `dir` (dans le plan du sol), écartées sur `spread` rad. */
    emit(from: THREE.Vector3, dir: THREE.Vector3, n: number, spread: number, speed: number, life: number, lift = 1.5) {
      up.copy(from).normalize();
      for (let i = 0; i < n; i++) {
        let d = drops.find((x) => !x.active);
        if (!d) {
          d = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), up0: new THREE.Vector3(), spinAxis: new THREE.Vector3(1, 0, 0), spinRate: 0, gravity: 9, age: 0, size: 1, active: false, hidden: true, life: 0 };
          drops.push(d);
        }
        const a = n > 1 ? (i / (n - 1) - 0.5) * 2 * spread : 0;
        v.copy(dir).applyAxisAngle(up, a + (Math.random() - 0.5) * 0.1).multiplyScalar(speed * (0.85 + Math.random() * 0.3)).addScaledVector(up, lift);
        d.pos.copy(from).addScaledVector(up, 1.0);
        d.vel.copy(v);
        d.up0.copy(up);
        d.age = 0;
        d.life = life;
        d.active = true;
      }
    },
    update(dt: number) {
      for (const d of drops) {
        if (!d.active) continue;
        d.age += dt;
        up.copy(d.pos).normalize();
        d.vel.addScaledVector(up, -d.gravity * dt);
        d.pos.addScaledVector(d.vel, dt);
        if (d.age > d.life) d.active = false;
      }
    },
    reset() { for (const d of drops) d.active = false; },
  };
}
