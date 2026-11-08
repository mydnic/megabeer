import * as THREE from 'three';
import type { ThrowerDef } from '../config/enemies';
import type { Projectile } from '../weapons/weapon';
import type { Zombie } from './zombie';

/**
 * Un projectile ennemi en vol : lancé en cloche d'un point à un point au sol (`to`), marqué au sol
 * pendant tout le vol. Il a la forme d'un `Projectile` pour être dessiné comme une bouteille.
 */
export type EnemyShot = Projectile & {
  source: Zombie;
  from: THREE.Vector3;
  /** Point d'impact au sol (annoncé par la marque). */
  to: THREE.Vector3;
  /** Avancement du vol (0 au lâcher, 1 à l'impact). */
  t: number;
  flightTime: number;
  arc: number;
  radius: number;
  damage: number;
};

/** Projectiles des ennemis tireurs (simulation seule). */
export function createEnemyShots() {
  const shots: EnemyShot[] = [];
  const up = new THREE.Vector3();
  const prev = new THREE.Vector3();

  /** Position en vol à l'avancement `t` : ligne au ras de la planète, plus la cloche. */
  function place(s: EnemyShot, out: THREE.Vector3) {
    const r = THREE.MathUtils.lerp(s.from.length(), s.to.length(), s.t);
    out.lerpVectors(s.from, s.to, s.t).setLength(r);
    up.copy(out).normalize();
    return out.addScaledVector(up, s.arc * 4 * s.t * (1 - s.t));
  }

  return {
    shots,
    /** Lance un projectile de `from` vers le point au sol `to`, selon la brique Tireur `T`. */
    launch(source: Zombie, from: THREE.Vector3, to: THREE.Vector3, T: ThrowerDef, damage: number) {
      const up0 = from.clone().normalize();
      const dir = to.clone().sub(from);
      const s: EnemyShot = {
        source, from: from.clone(), to: to.clone(), t: 0,
        flightTime: T.flightTime, arc: T.arc, radius: T.radius, damage,
        pos: from.clone(), vel: new THREE.Vector3(), up0,
        spinAxis: new THREE.Vector3().crossVectors(up0, dir).normalize(),
        spinRate: 1.6, gravity: 0, age: 0, size: 1, active: true,
      };
      shots.push(s);
      return s;
    },
    /** Avance les vols ; `onLand` est appelé pour chaque projectile qui touche le sol. */
    update(dt: number, onLand: (s: EnemyShot) => void) {
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        prev.copy(s.pos);
        s.t = Math.min(1, s.t + dt / s.flightTime);
        s.age += dt;
        place(s, s.pos);
        if (dt > 0) s.vel.subVectors(s.pos, prev).divideScalar(dt);
        if (s.t >= 1) {
          s.active = false;
          shots.splice(i, 1);
          onLand(s);
        }
      }
    },
    clear() { shots.length = 0; },
  };
}
