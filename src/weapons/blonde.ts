import * as THREE from 'three';
import { WEAPONS } from '../config/weapons';
import type { Zombie } from '../enemies/zombie';
import type { Bottles } from './bottles';

const W = WEAPONS.blonde;

type Deps = {
  bottles: Bottles;
  zombies: () => readonly Zombie[];
  playerPos: () => THREE.Vector3;
  /** Lance le geste ; appelle le rappel au lâcher avec la position de la main. */
  throwFromHand: (delay: number, onRelease: (hand: THREE.Vector3) => void) => boolean;
  /** Rayon du sol sous un point. */
  groundAt: (p: THREE.Vector3) => number;
  /** La bouteille touche le sol. */
  onGround: (pos: THREE.Vector3) => void;
};

/**
 * La Blonde : toutes les `cooldown` secondes, si un zombie est à portée, le Buveur lance une
 * bouteille vers le plus proche, en cloche, en anticipant sa marche.
 */
export function createBlonde(d: Deps) {
  let cooldown = 0.3;
  const tmp = new THREE.Vector3();
  const up = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const vel = new THREE.Vector3();

  function nearest(from: THREE.Vector3) {
    let best: Zombie | null = null, bestD: number = W.range;
    for (const z of d.zombies()) {
      const dist = z.pos.distanceTo(from);
      if (dist < bestD) { bestD = dist; best = z; }
    }
    return best;
  }

  /** Vitesse de lancer pour atteindre la cible en cloche, avec anticipation de sa marche. */
  function solve(from: THREE.Vector3, z: Zombie, out: THREE.Vector3) {
    up.copy(from).normalize();
    let t = 0;
    for (let i = 0; i < 3; i++) {
      aim.copy(z.pos).addScaledVector(tmp.copy(z.pos).normalize(), W.aimHeight).addScaledVector(z.facing, z.walkSpeed * t);
      const dlt = tmp.subVectors(aim, from);
      const h = dlt.dot(up);
      dlt.addScaledVector(up, -h); // partie horizontale
      t = Math.max(0.08, dlt.length() / W.speed);
      if (i === 2) out.copy(dlt).divideScalar(t).addScaledVector(up, h / t + 0.5 * W.gravity * t);
    }
    return out;
  }

  return {
    update(dt: number) {
      cooldown -= dt;
      if (cooldown > 0) return;
      if (!nearest(d.playerPos())) return;
      // Le geste part ; la cible est choisie au lâcher (le zombie a pu bouger)
      const ok = d.throwFromHand(W.releaseDelay, (hand) => {
        const z = nearest(hand);
        if (!z) return;
        d.bottles.launch(hand, solve(hand, z, vel), W.gravity, W.spinRate, { damage: W.damage, pierce: W.pierce, hit: new Set<Zombie>() });
      });
      if (ok) cooldown = W.cooldown;
    },
    /** Avance les bouteilles ; casse celles qui touchent le sol. */
    updateBottles(dt: number) {
      d.bottles.update(dt, W.life, (b) => {
        if (b.pos.length() <= d.groundAt(b.pos)) { d.onGround(b.pos); return false; }
        return true;
      });
    },
    reset() { cooldown = 0.3; d.bottles.clear(); },
  };
}
