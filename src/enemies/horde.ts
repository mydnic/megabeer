import * as THREE from 'three';
import { ZOMBIE_MOVE as M, ZOMBIE_VISUAL as V, type ZombieModel } from '../config/zombies';
import { PLANET_RADIUS } from '../config/world';
import { heightAt } from '../world/terrain';
import type { DecorCollider } from '../world/decor/collider';
import type { PlayerController } from '../player/controller';
import { Zombie, type ZombieLibrary } from './zombie';

/**
 * Ensemble des zombies en jeu : poursuite du joueur sur la sphère (dans le plan tangent), collage
 * au sol et au décor, glissement le long des murs, écartement entre zombies, corps solides.
 */
export function createHorde(scene: THREE.Scene, lib: ZombieLibrary, player: PlayerController, decor?: DecorCollider) {
  const zombies: Zombie[] = [];
  const tmp = new THREE.Vector3();
  const up = new THREE.Vector3();
  const want = new THREE.Vector3();
  const before = new THREE.Vector3();
  const side = new THREE.Vector3();
  const push = new THREE.Vector3();

  /** Recolle un point au sol (relief ou dessus de décor franchissable), en gardant sa direction. */
  function snap(p: THREE.Vector3) {
    p.setLength(player.supportAt(p, p.length()));
  }

  /** Pose un zombie sur le sol, à la direction donnée, regardant vers `facing`. */
  function spawn(model: ZombieModel, dir: THREE.Vector3, facing: THREE.Vector3) {
    const z = new Zombie(scene, lib, model);
    // Sonde un peu au-dessus du relief : trouve aussi le dessus du décor (dalles, marches)
    z.pos.copy(dir).normalize();
    z.pos.setLength(PLANET_RADIUS + heightAt(z.pos) + 2.5);
    snap(z.pos);
    const n = tmp.copy(z.pos).normalize();
    z.facing.copy(facing).addScaledVector(n, -facing.dot(n)).normalize();
    zombies.push(z);
    return z;
  }

  function step(z: Zombie, dt: number, target: THREE.Vector3) {
    up.copy(z.pos).normalize();
    want.subVectors(target, z.pos);
    want.addScaledVector(up, -want.dot(up));
    const dist = want.length();
    z.turnToward(target, dt);
    if (dist < V.attackRange) { z.play('attack'); return; }
    // Avance dans la direction du regard (il tourne, il ne glisse pas de côté)
    want.normalize();
    const align = Math.max(0, z.facing.dot(want));
    let speed = M.speed * z.speedMul * align;
    // Contournement : bloqué contre un mur au pas précédent, il longe l'obstacle quelque temps
    if (z.detour > 0) {
      z.detour -= dt;
      side.crossVectors(up, want).multiplyScalar(z.detourSide);
      want.lerp(side, M.detourBlend).normalize();
      speed = M.speed * z.speedMul;
    }
    before.copy(z.pos);
    z.pos.addScaledVector(want, speed * dt);
    decor?.resolve(z.pos, M.radius);
    snap(z.pos);
    // Mesure de l'avancée réelle : presque rien = bloqué, on lance un contournement
    const moved = tmp.subVectors(z.pos, before).length();
    if (speed > 0.5 && moved < speed * dt * M.stuckRatio && z.detour <= 0) {
      z.detour = M.detourTime;
      z.detourSide = Math.random() < 0.5 ? -1 : 1;
    }
    z.walkSpeed = dt > 0 ? moved / dt : 0;
    z.play(z.walkSpeed > 0.3 ? 'walk' : 'idle');
  }

  /** Écarte les zombies trop proches entre eux, et du joueur (les corps sont solides). */
  function separate() {
    const minD = M.radius * 2;
    for (let i = 0; i < zombies.length; i++) {
      const a = zombies[i];
      for (let j = i + 1; j < zombies.length; j++) {
        const b = zombies[j];
        push.subVectors(a.pos, b.pos);
        const d = push.length();
        if (d >= minD || d < 1e-5) continue;
        push.multiplyScalar((minD - d) / d * 0.5);
        a.pos.add(push); b.pos.sub(push);
      }
    }
    // Le joueur est repoussé hors des corps (sur le plan tangent)
    const pr = M.radius + M.playerRadius;
    for (const z of zombies) {
      push.subVectors(player.pos, z.pos);
      up.copy(player.pos).normalize();
      push.addScaledVector(up, -push.dot(up));
      const d = push.length();
      if (d >= pr || d < 1e-5) continue;
      player.pos.addScaledVector(push, (pr - d) / d);
    }
  }

  return {
    zombies,
    spawn,
    update(dt: number) {
      for (const z of zombies) step(z, dt, player.pos);
      separate();
      for (const z of zombies) { decor?.resolve(z.pos, M.radius); snap(z.pos); z.update(dt); }
    },
  };
}
