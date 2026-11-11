import * as THREE from 'three';
import { XP_DROPS } from '../config/xp';
import { heightAt } from '../world/terrain';
import { PLANET_RADIUS } from '../config/world';

/** Réglages de vol d'un objet à ramasser (gouttes d'XP, capsules...). */
export type DropMotion = {
  radius: number; hover: number; bob: number; bobSpeed: number;
  startSpeed: number; attract: number; maxSpeed: number; collectDist: number; max: number;
  /** Durée de vie au sol (s) : au-delà, l'objet pas encore aspiré disparaît (par défaut : jamais). */
  life?: number;
};

/** Une goutte de bière (XP) : position, point de chute, valeur, et son état d'aspiration. */
export type XpDrop = {
  pos: THREE.Vector3; base: THREE.Vector3; speed: number; value: number;
  size: number; phase: number; flying: boolean; age: number;
  /** Aspirée de loin (Dernier service) : vitesse le long du sol (m/s), 0 sinon. */
  pull: number;
};

/**
 * Gouttes de bière (XP), simulation seule (rendu dans xpDropsView.ts) : en lévitation au-dessus du
 * sol ; à portée de ramassage, elles filent en ligne droite vers le joueur en accélérant et sont
 * avalées (jamais d'orbite).
 */
export function createXpDrops(groundAt: (p: THREE.Vector3) => number, X: DropMotion = XP_DROPS) {
  const drops: XpDrop[] = [];
  const up = new THREE.Vector3(), tmp = new THREE.Vector3(), aim = new THREE.Vector3(), axis = new THREE.Vector3();
  let pullAccel = 0, pullMax = 0;

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
      drops.push({ pos: base.clone().addScaledVector(up, X.hover), base, speed: X.startSpeed, value, size, phase: Math.random() * 6.28, flying: false, age: 0, pull: 0 });
    },
    /**
     * Avance les gouttes. `target` = point d'aspiration (le torse du joueur), `range` = rayon de
     * ramassage. Appelle `onCollect(value)` pour chaque goutte avalée.
     */
    update(dt: number, target: THREE.Vector3, range: number, onCollect: (value: number) => void) {
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.age += dt;
        if (X.life !== undefined && d.age > X.life && !d.flying && d.pull <= 0) { drops.splice(i, 1); continue; }
        if (!d.flying && d.pos.distanceTo(target) < range) d.flying = true;
        if (!d.flying && d.pull > 0) {
          // Aspirée de loin : elle glisse le long du sol vers le joueur (grand cercle), à hauteur de lévitation
          d.pull = Math.min(pullMax, d.pull + pullAccel * dt);
          up.copy(d.pos).normalize();
          aim.copy(target).normalize();
          const angle = up.angleTo(aim);
          const step = (d.pull * dt) / d.pos.length();
          if (angle > 1e-5) {
            axis.crossVectors(up, aim);
            // Pile à l'opposé : n'importe quel axe perpendiculaire
            if (axis.lengthSq() < 1e-12) axis.set(1, 0, 0).cross(up);
            up.applyAxisAngle(axis.normalize(), Math.min(step, angle));
          }
          d.pos.copy(up).multiplyScalar(PLANET_RADIUS_OF(up) + X.hover);
          d.base.copy(up).multiplyScalar(PLANET_RADIUS_OF(up));
          // Arrivée près du joueur : l'aspiration normale prend le relais
          if (step >= angle || d.pos.distanceTo(target) < Math.max(range, 2)) d.flying = true;
          continue;
        }
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
    /**
     * Dernier service : toutes les gouttes au sol partent vers le joueur en glissant le long du sol, de
     * plus en plus vite (`start`, `accel`, `max` en m/s). Renvoie le nombre de gouttes aspirées.
     */
    pullAll(start: number, accel: number, max: number) {
      pullAccel = accel; pullMax = max;
      let n = 0;
      for (const d of drops) if (!d.flying) { d.pull = Math.max(d.pull, start); n++; }
      return n;
    },
    clear() { drops.length = 0; },
  };
}

/** Rayon du sol (relief seul, sans le décor) sous une direction. */
const PLANET_RADIUS_OF = (dir: THREE.Vector3) => PLANET_RADIUS + heightAt(dir);
export type XpDrops = ReturnType<typeof createXpDrops>;
