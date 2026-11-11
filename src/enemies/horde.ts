import * as THREE from 'three';
import { ENEMIES, type EnemyId } from '../config/enemies';
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
/** Index spatial : taille d'une case (m), et nombre de cases au-delà duquel on parcourt toute la horde. */
const INDEX_CELL = 3;
const INDEX_MAX_CELLS = 125;

export function createHorde(kinds: Record<ZombieModel, ZombieTimings>, player: PlayerController, decor?: DecorCollider) {
  const zombies: Zombie[] = [];
  const tmp = new THREE.Vector3();
  const up = new THREE.Vector3();
  const want = new THREE.Vector3();
  const before = new THREE.Vector3();
  const side = new THREE.Vector3();
  const push = new THREE.Vector3();

  /**
   * Index spatial des zombies debout : une grille de cases de INDEX_CELL m, refaite à la fin de chaque
   * pas (et complétée à chaque apparition). Les armes et les effets y cherchent leurs voisins au lieu
   * de parcourir toute la horde : c'est ce qui tient la fin de partie (des centaines de projectiles
   * contre des centaines d'ennemis).
   */
  const index = new Map<number, Zombie[]>();
  /** Protecteurs debout (porte-reliques) : consultés à chaque coup. */
  const protectors: Zombie[] = [];
  /** Case d'une coordonnée, et clé unique d'une case (10 bits par axe : la planète tient largement dedans). */
  const cellOf = (v: number, cell: number) => Math.floor(v / cell) + 512;
  const keyOf = (x: number, y: number, z: number) => (x << 20) | (y << 10) | z;
  function addToIndex(z: Zombie) {
    const k = keyOf(cellOf(z.pos.x, INDEX_CELL), cellOf(z.pos.y, INDEX_CELL), cellOf(z.pos.z, INDEX_CELL));
    let list = index.get(k);
    if (!list) { list = []; index.set(k, list); }
    list.push(z);
    if (z.def.protector) protectors.push(z);
  }
  function reindex() {
    // Les cases quittées restent vides dans la table : on la vide quand elle a trop grossi
    if (index.size > INDEX_MAX_CELLS * 40) index.clear();
    for (const list of index.values()) list.length = 0;
    protectors.length = 0;
    for (const z of zombies) if (!z.dead) addToIndex(z);
  }
  /**
   * Remplit `out` avec les zombies debout dont la case touche la sphère (`p`, `r`) : des candidats, à
   * filtrer par la distance exacte. Rayon trop grand pour la grille : toute la horde.
   */
  function near(p: THREE.Vector3, r: number, out: Zombie[]) {
    out.length = 0;
    const x0 = cellOf(p.x - r, INDEX_CELL), x1 = cellOf(p.x + r, INDEX_CELL);
    const y0 = cellOf(p.y - r, INDEX_CELL), y1 = cellOf(p.y + r, INDEX_CELL);
    const z0 = cellOf(p.z - r, INDEX_CELL), z1 = cellOf(p.z + r, INDEX_CELL);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > INDEX_MAX_CELLS) {
      for (const z of zombies) if (!z.dead) out.push(z);
      return out;
    }
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const list = index.get(keyOf(x, y, z));
      if (list) for (let i = 0; i < list.length; i++) if (!list[i].dead) out.push(list[i]);
    }
    return out;
  }
  const around: Zombie[] = [];

  /** Recolle un point au sol (relief ou dessus de décor franchissable), en gardant sa direction. */
  function snap(p: THREE.Vector3) {
    p.setLength(player.supportAt(p, p.length()));
  }

  /**
   * Recolle un zombie au sol après un déplacement : poussé hors du décor puis posé dessus ; un
   * fantôme traverse le décor et reste au niveau du relief.
   */
  function settle(z: Zombie, fresh = true) {
    // Une image sur deux, il garde la hauteur de sol de l'image d'avant (il a bougé de quelques centimètres) :
    // la hauteur du relief est le calcul le plus cher de la horde
    if (!fresh && z.groundR > 0) { if (!z.def.ghost) decor?.resolve(z.pos, M.radius); z.pos.setLength(z.groundR); return; }
    if (z.def.ghost) z.pos.setLength(PLANET_RADIUS + heightAt(tmp.copy(z.pos).normalize()));
    else { decor?.resolve(z.pos, M.radius); snap(z.pos); }
    z.groundR = z.pos.length();
  }
  let tick = 0;

  /** Pose un zombie sur le sol, à la direction donnée, regardant vers `facing`. */
  function spawn(enemy: EnemyId, dir: THREE.Vector3, facing: THREE.Vector3) {
    const z = new Zombie(kinds[ENEMIES[enemy].model], enemy);
    // Sonde un peu au-dessus du relief : trouve aussi le dessus du décor (dalles, marches)
    z.pos.copy(dir).normalize();
    z.pos.setLength(PLANET_RADIUS + heightAt(z.pos) + 2.5);
    snap(z.pos);
    const n = tmp.copy(z.pos).normalize();
    z.facing.copy(facing).addScaledVector(n, -facing.dot(n)).normalize();
    zombies.push(z);
    addToIndex(z);
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
    if (z.dead || z.stagger > 0 || z.rise > 0 || z.frozen > 0) { z.walkSpeed = 0; return; }
    want.subVectors(target, z.pos);
    want.addScaledVector(up, -want.dot(up));
    const dist = want.length();
    z.turnToward(target, dt);
    // Joueur mort : ils s'approchent du corps et restent plantés autour, sans frapper
    if (passive && dist < V.attackRange + 0.3) {
      if (z.state !== 'attack' || z.attackDone) z.play('idle');
      return;
    }
    // Brique Invocateur : à portée, il s'arrête et fait son geste ; les invoqués sortent à la fin (update)
    const S = z.def.summoner;
    if (S) {
      if (z.casting > 0) {
        z.walkSpeed = 0;
        if (z.state !== 'cast') z.play('cast'); // repris après un coup reçu
        return;
      }
      if (z.summonTimer <= 0 && !passive && dist <= S.range) {
        z.casting = S.cast;
        z.summonTimer = S.cast + S.cooldown;
        z.walkSpeed = 0;
        z.play('cast', true);
        api.onCast?.(z);
        return;
      }
    }
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
    let speed = z.def.speed * z.speedMul * z.slowMul * align;
    // Contournement : bloqué contre un mur au pas précédent, il longe l'obstacle quelque temps
    if (z.detour > 0) {
      z.detour -= dt;
      side.crossVectors(up, want).multiplyScalar(z.detourSide);
      want.lerp(side, M.detourBlend).normalize();
      speed = z.def.speed * z.speedMul * z.slowMul;
    }
    before.copy(z.pos);
    z.pos.addScaledVector(want, speed * dt);
    // Poussé hors du décor tout de suite (pour mesurer s'il est bloqué) ; il est reposé au sol une fois, après l'écartement
    if (!z.def.ghost) decor?.resolve(z.pos, M.radius);
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

  // Grille pour l'écartement (seuls les voisins de case sont testés). Chaque paire de cases voisines n'est
  // visitée qu'une fois : la case elle-même et la moitié « avant » de ses 26 voisines.
  const grid = new Map<number, number[]>();
  const HALF: [number, number, number][] = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
    if (dx > 0 || (dx === 0 && (dy > 0 || (dy === 0 && dz > 0)))) HALF.push([dx, dy, dz]);
  }

  /** Écarte les zombies trop proches entre eux, et du joueur (les corps sont solides). */
  function separate() {
    const minD = M.radius * 2, cell = minD;
    if (grid.size > 8192) grid.clear();
    for (const list of grid.values()) list.length = 0;
    const minD2 = minD * minD;
    for (let i = 0; i < zombies.length; i++) {
      const z = zombies[i];
      if (z.dead) continue; // les corps ne gênent personne
      const k = keyOf(cellOf(z.pos.x, cell), cellOf(z.pos.y, cell), cellOf(z.pos.z, cell));
      let list = grid.get(k);
      if (!list) { list = []; grid.set(k, list); }
      list.push(i);
    }
    const apart = (a: Zombie, b: Zombie) => {
      const dx = a.pos.x - b.pos.x, dy = a.pos.y - b.pos.y, dz = a.pos.z - b.pos.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= minD2 || d2 < 1e-10) return;
      const d = Math.sqrt(d2), k = (minD - d) / d * 0.5;
      a.pos.x += dx * k; a.pos.y += dy * k; a.pos.z += dz * k;
      b.pos.x -= dx * k; b.pos.y -= dy * k; b.pos.z -= dz * k;
    };
    for (const [key, list] of grid) {
      const n = list.length;
      if (!n) continue;
      // Dans la case
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) apart(zombies[list[i]], zombies[list[j]]);
      // Avec la moitié avant des cases voisines
      const cx = key >> 20, cy = (key >> 10) & 1023, cz = key & 1023;
      for (const [dx, dy, dz] of HALF) {
        const other = grid.get(keyOf(cx + dx, cy + dy, cz + dz));
        if (!other || !other.length) continue;
        for (let i = 0; i < n; i++) for (let j = 0; j < other.length; j++) apart(zombies[list[i]], zombies[other[j]]);
      }
    }
    // Le joueur est repoussé hors des corps (sur le plan tangent)
    const pr = M.radius + M.playerRadius;
    up.copy(player.pos).normalize();
    for (const z of near(player.pos, pr + 0.5, around)) {
      push.subVectors(player.pos, z.pos);
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
    clear() { zombies.length = 0; reindex(); },
    update(dt: number) {
      for (const z of zombies) step(z, dt, player.pos);
      separate();
      tick++;
      for (let i = 0; i < zombies.length; i++) {
        const z = zombies[i];
        // Un corps qui ne glisse plus reste où il est
        if (!z.dead || z.knockVel.lengthSq() > 1e-4) settle(z, ((tick + i) & 1) === 0);
        if (z.def.ghost) z.ghostClock += dt;
        z.update(dt);
        // Mèche du kamikaze : à zéro, il explose (même sonné)
        if (z.fuse >= 0 && !z.dead && !passive) {
          z.fuse -= dt;
          if (z.fuse <= 0) { api.onExplode?.(z); continue; }
        }
        // Invocation : le geste va au bout même sous les coups ; mort avant, rien ne sort
        if (z.casting > 0 && !z.dead) {
          z.casting = Math.max(0, z.casting - dt);
          if (z.casting === 0) {
            z.play('idle');
            if (!passive) api.onSummon?.(z);
          }
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
      // Trop de corps au sol : les plus anciens disparaissent tout de suite
      let corpses = 0;
      for (const z of zombies) if (z.dead && !z.gone) corpses++;
      if (corpses > H.maxCorpses) {
        let extra = corpses - H.maxCorpses;
        for (const z of zombies) {
          if (extra <= 0) break;
          if (z.dead && !z.gone && z.deadTime > H.corpseMinTime) { z.gone = true; extra--; }
        }
      }
      // Corps entièrement enfoncés : retirés
      let kept = 0;
      for (let i = 0; i < zombies.length; i++) if (!zombies[i].gone) zombies[kept++] = zombies[i];
      zombies.length = kept;
      reindex();
    },
    /** Zombies debout près d'un point : voir l'index spatial plus haut. */
    near,
    /**
     * Brique Protecteur : part des dégâts retirée à `z` (0 si aucun halo d'un autre protecteur
     * debout ne le couvre ; les halos ne se cumulent pas).
     */
    shieldOf(z: Zombie) {
      let best = 0;
      for (const p of protectors) {
        const P = p.def.protector;
        if (!P || p === z || p.dead || P.reduction <= best) continue;
        // Distance en ligne droite : à cette échelle, elle vaut la distance au sol
        if (p.pos.distanceToSquared(z.pos) < P.radius * P.radius) best = P.reduction;
      }
      return best;
    },
    /** Zombies encore debout (cibles des armes). */
    alive() { return zombies.filter((z) => !z.dead); },
    /** Appelé quand un zombie touche le joueur, avec la direction du coup (du zombie vers le joueur). */
    onHit: undefined as ((z: Zombie, dir: THREE.Vector3) => void) | undefined,
    /** Appelé quand un tireur lâche son projectile. */
    onThrow: undefined as ((z: Zombie) => void) | undefined,
    /** Appelé quand un invocateur commence son geste. */
    onCast: undefined as ((z: Zombie) => void) | undefined,
    /** Appelé à la fin du geste d'un invocateur : les invoqués doivent sortir de terre. */
    onSummon: undefined as ((z: Zombie) => void) | undefined,
    /** Appelé quand un kamikaze allume sa mèche. */
    onArm: undefined as ((z: Zombie) => void) | undefined,
    /** Appelé quand la mèche d'un kamikaze arrive au bout. */
    onExplode: undefined as ((z: Zombie) => void) | undefined,
    /** Appelé à chaque apparition de zombie. */
    onSpawn: undefined as ((z: Zombie) => void) | undefined,
  };
  return api;
}
