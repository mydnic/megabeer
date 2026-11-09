import * as THREE from 'three';
import { ENEMIES, type ChargerDef, type EnemyDef, type EnemyId } from '../config/enemies';
import { ZOMBIE_ATTACK, ZOMBIE_HURT as H, ZOMBIE_MOVE as M, ZOMBIE_VISUAL as V, type ZombieModel } from '../config/zombies';
import { PLANET_RADIUS } from '../config/world';
import { heightAt } from '../world/terrain';
import type { DecorCollider } from '../world/decor/collider';
import type { PlayerController } from '../player/controller';
import { Zombie, type ZombieTimings } from './zombie';

/**
 * Ensemble des zombies en jeu (simulation seule, le rendu est dans hordeView.ts) : poursuite du joueur
 * sur la sphère (dans le plan tangent), collage au sol et au décor, glissement le long des murs,
 * écartement entre zombies, corps solides, coups portés au joueur.
 */
export function createHorde(kinds: Record<ZombieModel, ZombieTimings>, player: PlayerController, decor?: DecorCollider) {
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
  function spawn(enemy: EnemyId, dir: THREE.Vector3, facing: THREE.Vector3) {
    const C = (ENEMIES[enemy] as EnemyDef).charger;
    const z = new Zombie(kinds[ENEMIES[enemy].model], enemy, C && kinds[C.emptyModel]);
    // Sonde un peu au-dessus du relief : trouve aussi le dessus du décor (dalles, marches)
    z.pos.copy(dir).normalize();
    z.pos.setLength(PLANET_RADIUS + heightAt(z.pos) + 2.5);
    snap(z.pos);
    const n = tmp.copy(z.pos).normalize();
    z.facing.copy(facing).addScaledVector(n, -facing.dot(n)).normalize();
    zombies.push(z);
    api.onSpawn?.(z);
    return z;
  }

  function step(z: Zombie, dt: number, target: THREE.Vector3) {
    up.copy(z.pos).normalize();
    // Recul subi (coup de bouteille), amorti
    if (z.knockVel.lengthSq() > 1e-4) {
      z.knockVel.addScaledVector(up, -z.knockVel.dot(up));
      z.pos.addScaledVector(z.knockVel, dt);
      z.knockVel.multiplyScalar(Math.exp(-dt / H.knockDecay));
    }
    // Mort, sonné ou en train de sortir de terre : ni marche ni coup
    if (z.dead || z.stagger > 0 || z.rise > 0) { z.walkSpeed = 0; return; }
    want.subVectors(target, z.pos);
    want.addScaledVector(up, -want.dot(up));
    const dist = want.length();
    z.turnToward(target, dt);
    // Joueur mort : ils s'approchent du corps et restent plantés autour, sans frapper
    if (passive && dist < V.attackRange + 0.3) {
      if (z.state !== 'attack' || z.attackDone) z.play('idle');
      return;
    }
    // Brique Chargeur : élan (ligne marquée), charge en ligne droite, puis sonné
    const C = z.def.charger;
    if (C && chargerStep(z, C, dt, dist)) return;
    // Brique Kamikaze : tout près du joueur, il s'arrête et allume la mèche (il ne frappe jamais)
    const K = z.def.kamikaze;
    if (K) {
      if (z.fuse < 0 && dist <= K.trigger) {
        z.fuse = K.fuse;
        api.onArm?.(z);
      }
      if (z.fuse >= 0) {
        z.walkSpeed = 0;
        if (z.state !== 'hit') z.play('hit');
        return;
      }
    }
    // Brique Tireur : à portée de lancer (mais pas au contact), il s'arrête et lance
    const T = z.def.thrower;
    if (T) {
      if (z.throwing) {
        if (!z.attackDone) { z.walkSpeed = 0; return; } // le geste va au bout
        z.throwing = false;
        z.play('idle');
      }
      if (dist > V.attackRange + V.attackExit && dist <= T.range) {
        z.walkSpeed = 0;
        if (z.state !== 'idle') z.play('idle');
        // Il lance une fois tourné vers le joueur
        if (z.throwTimer <= 0 && z.facing.dot(tmp.copy(want).normalize()) > 0.9) {
          z.play('attack', true);
          z.throwing = true;
          z.throwTimer = T.cooldown;
        }
        return;
      }
    }
    // Un coup commencé va au bout ; il enchaîne tant que le joueur reste un peu au-delà de la portée
    if (z.state === 'attack' && (!z.attackDone || dist < V.attackRange + V.attackExit)) {
      z.attackDone = z.attackDone && dist >= V.attackRange + V.attackExit;
      return;
    }
    if (dist < V.attackRange && !K) { z.play('attack'); return; }
    // Avance dans la direction du regard (il tourne, il ne glisse pas de côté)
    want.normalize();
    const align = Math.max(0, z.facing.dot(want));
    let speed = z.def.speed * z.speedMul * align;
    // Contournement : bloqué contre un mur au pas précédent, il longe l'obstacle quelque temps
    if (z.detour > 0) {
      z.detour -= dt;
      side.crossVectors(up, want).multiplyScalar(z.detourSide);
      want.lerp(side, M.detourBlend).normalize();
      speed = z.def.speed * z.speedMul;
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
    // Marche / arrêt : on garde l'état un minimum de temps (pas de clignotement d'animation)
    const next = z.walkSpeed > 0.3 ? 'walk' : 'idle';
    if (z.state === 'attack' || z.stateTime > V.minStateTime) z.play(next);
  }

  /** Le tonneau qui roule devant le chargeur, posé au sol sur sa ligne. */
  function placeBarrel(z: Zombie, C: ChargerDef) {
    z.barrelPos.copy(z.pos).addScaledVector(z.chargeDir, C.barrelAhead);
    snap(z.barrelPos);
  }

  /** Brique Chargeur : renvoie vrai quand elle pilote le zombie à ce pas (élan, charge ou sonné). */
  function chargerStep(z: Zombie, C: ChargerDef, dt: number, dist: number) {
    z.chargeCooldown = Math.max(0, z.chargeCooldown - dt);
    // Tonneau éclaté : il en reprend un à la fin du délai
    if (z.barrel === 'broken' && z.charge === 'none' && z.chargeCooldown <= 0) z.barrel = 'held';
    if (z.charge === 'windup') {
      z.walkSpeed = 0;
      z.facing.copy(z.chargeDir);
      z.chargeTimer -= dt;
      if (z.chargeTimer <= 0) {
        z.charge = 'charge';
        z.chargeLeft = C.length;
        z.chargeHit = false;
        // Il lâche son tonneau, qui roule devant lui
        z.barrel = 'rolling';
        z.barrelTravel = 0;
        placeBarrel(z, C);
      }
      return true;
    }
    if (z.charge === 'charge') {
      // Droit devant, sans viser : la direction reste celle de la ligne (recollée au plan du sol)
      z.chargeDir.addScaledVector(up, -z.chargeDir.dot(up)).normalize();
      z.facing.copy(z.chargeDir);
      const step = Math.min(C.speed * dt, z.chargeLeft);
      before.copy(z.pos);
      z.pos.addScaledVector(z.chargeDir, step);
      decor?.resolve(z.pos, M.radius);
      snap(z.pos);
      const moved = tmp.subVectors(z.pos, before).length();
      z.chargeLeft -= step;
      z.walkSpeed = dt > 0 ? moved / dt : 0;
      if (z.state !== 'walk') z.play('walk');
      z.barrelTravel += moved;
      placeBarrel(z, C);
      // Le tonneau percute le joueur sur son passage : renversé, le tonneau éclate, la charge s'arrête
      if (!passive && z.barrelPos.angleTo(player.pos) * PLANET_RADIUS < C.width / 2 + M.playerRadius) {
        z.barrel = 'broken';
        z.charge = 'recover';
        z.chargeTimer = C.recover;
        api.onChargeHit?.(z, z.chargeDir.clone());
        api.onBarrelBreak?.(z);
        return true;
      }
      // Fin de la ligne, ou arrêté net par un mur : le tonneau s'arrête là, il est sonné
      if (z.chargeLeft <= 0 || (step > 0 && moved < step * M.stuckRatio)) {
        z.barrel = 'resting';
        z.charge = 'recover';
        z.chargeTimer = C.recover;
      }
      return true;
    }
    if (z.charge === 'recover') {
      z.walkSpeed = 0;
      if (z.state !== 'hit') z.play('hit');
      z.chargeTimer -= dt;
      if (z.chargeTimer <= 0) {
        z.charge = 'none';
        z.chargeCooldown = C.cooldown;
        if (z.barrel === 'resting') z.barrel = 'held'; // il a ramassé son tonneau
        z.play('idle');
      }
      return true;
    }
    // À portée (mais pas au contact), tonneau en main et tourné vers le joueur : il prend son élan, la ligne est marquée
    if (z.chargeCooldown <= 0 && z.barrel === 'held' && !passive && dist <= C.range && dist > V.attackRange
        && z.facing.dot(tmp.copy(want).normalize()) > 0.95) {
      z.charge = 'windup';
      z.chargeTimer = C.windup;
      z.chargeFrom.copy(z.pos);
      z.chargeDir.copy(want).normalize();
      z.walkSpeed = 0;
      z.play('idle');
      api.onAim?.(z);
      return true;
    }
    return false;
  }

  // Grille de hachage pour l'écartement (seuls les voisins de case sont testés)
  const grid = new Map<number, number[]>();
  const cellKey = (x: number, y: number, z: number) => ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) | 0;

  /** Écarte les zombies trop proches entre eux, et du joueur (les corps sont solides). */
  function separate() {
    const minD = M.radius * 2, cell = minD;
    for (const list of grid.values()) list.length = 0;
    zombies.forEach((z, i) => {
      if (z.dead) return; // les corps ne gênent personne
      const k = cellKey(Math.floor(z.pos.x / cell), Math.floor(z.pos.y / cell), Math.floor(z.pos.z / cell));
      let list = grid.get(k);
      if (!list) { list = []; grid.set(k, list); }
      list.push(i);
    });
    for (let i = 0; i < zombies.length; i++) {
      const a = zombies[i];
      if (a.dead) continue;
      const cx = Math.floor(a.pos.x / cell), cy = Math.floor(a.pos.y / cell), cz = Math.floor(a.pos.z / cell);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const list = grid.get(cellKey(cx + dx, cy + dy, cz + dz));
        if (!list) continue;
        for (const j of list) {
          if (j <= i) continue;
          const b = zombies[j];
          push.subVectors(a.pos, b.pos);
          const d = push.length();
          if (d >= minD || d < 1e-5) continue;
          push.multiplyScalar((minD - d) / d * 0.5);
          a.pos.add(push); b.pos.sub(push);
        }
      }
    }
    // Le joueur est repoussé hors des corps (sur le plan tangent)
    const pr = M.radius + M.playerRadius;
    for (const z of zombies) {
      // Un chargeur lancé renverse le joueur et le traverse, il ne le pousse pas devant lui
      if (z.dead || z.charge === 'charge') continue;
      push.subVectors(player.pos, z.pos);
      up.copy(player.pos).normalize();
      push.addScaledVector(up, -push.dot(up));
      const d = push.length();
      if (d >= pr || d < 1e-5) continue;
      player.pos.addScaledVector(push, (pr - d) / d);
    }
  }

  let passive = false;
  const api = {
    zombies,
    spawn,
    /** Joueur mort : plus de coups, ils se rassemblent autour du corps. */
    setPassive(v: boolean) { passive = v; },
    /** Retire tous les zombies (nouvelle run). */
    clear() { zombies.length = 0; },
    update(dt: number) {
      for (const z of zombies) step(z, dt, player.pos);
      separate();
      for (const z of zombies) {
        decor?.resolve(z.pos, M.radius);
        snap(z.pos);
        z.update(dt);
        // Mèche du kamikaze : à zéro, il explose (même sonné)
        if (z.fuse >= 0 && !z.dead && !passive) {
          z.fuse -= dt;
          if (z.fuse <= 0) { api.onExplode?.(z); continue; }
        }
        // Lancer : la bouteille part au moment du geste où le bras se détend
        if (z.throwing && z.hitNow && !z.dead && !passive) { api.onThrow?.(z); continue; }
        // Le coup porte si le joueur est encore à portée au moment où le bras arrive
        if (!passive && !z.dead && z.hitNow && z.pos.distanceTo(player.pos) < ZOMBIE_ATTACK.reach) {
          up.copy(player.pos).normalize();
          push.subVectors(player.pos, z.pos);
          push.addScaledVector(up, -push.dot(up));
          if (push.lengthSq() < 1e-6) push.copy(z.facing);
          api.onHit?.(z, push.normalize());
        }
      }
      // Corps entièrement enfoncés : retirés
      for (let i = zombies.length - 1; i >= 0; i--) if (zombies[i].gone) zombies.splice(i, 1);
    },
    /** Zombies encore debout (cibles des armes). */
    alive() { return zombies.filter((z) => !z.dead); },
    /** Appelé quand un zombie touche le joueur, avec la direction du coup (du zombie vers le joueur). */
    onHit: undefined as ((z: Zombie, dir: THREE.Vector3) => void) | undefined,
    /** Appelé quand un tireur lâche son projectile. */
    onThrow: undefined as ((z: Zombie) => void) | undefined,
    /** Appelé quand un chargeur prend son élan (sa ligne est dans chargeFrom / chargeDir). */
    onAim: undefined as ((z: Zombie) => void) | undefined,
    /** Appelé quand un chargeur renverse le joueur, avec la direction de la charge. */
    onChargeHit: undefined as ((z: Zombie, dir: THREE.Vector3) => void) | undefined,
    /** Appelé quand le tonneau d'un chargeur éclate sur le joueur (il est en barrelPos). */
    onBarrelBreak: undefined as ((z: Zombie) => void) | undefined,
    /** Appelé quand un kamikaze allume sa mèche. */
    onArm: undefined as ((z: Zombie) => void) | undefined,
    /** Appelé quand la mèche d'un kamikaze arrive au bout. */
    onExplode: undefined as ((z: Zombie) => void) | undefined,
    /** Appelé à chaque apparition de zombie. */
    onSpawn: undefined as ((z: Zombie) => void) | undefined,
  };
  return api;
}
