import * as THREE from 'three';
import { ALLIES, ALLY_RULES as R, type AllyId } from '../config/allies';
import { PLANET_RADIUS } from '../config/world';
import type { DecorCollider } from '../world/decor/collider';
import { abbeySites, heightAt } from '../world/terrain';

/** Un allié de la run : sa sorte, où il est, où il regarde, s'il attend, suit le joueur ou est parti ; ses minuteries. */
export type Ally = {
  kind: AllyId; pos: THREE.Vector3; facing: THREE.Vector3; state: 'waiting' | 'following' | 'gone';
  /** Temps de compagnie qui reste (s) ; prochain usage du pouvoir (s) ; vitesse de marche à cette image (m/s). */
  left: number; cooldown: number; speed: number;
};

/** Un Kienzan en vol : où il est (au sol, l'affichage le lève), sa direction, la distance qui lui reste, qui il a tranché. */
export type Disc = { pos: THREE.Vector3; dir: THREE.Vector3; left: number; hit: Set<object> };
/** Un bloc de TNT posé par Steve : où, et le temps avant l'explosion (s). */
export type Tnt = { pos: THREE.Vector3; fuse: number; fuseTime: number };

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);

/**
 * Les alliés d'une run (issue #18) : un par abbaye. Touché, un allié rejoint le joueur et le suit un temps ; le jeu
 * applique son pouvoir quand `update` le demande. Ce que lancent ou posent les alliés (Kienzan, TNT) vit ici aussi.
 */
export class Allies {
  readonly list: Ally[] = [];
  readonly discs: Disc[] = [];
  readonly tnts: Tnt[] = [];
  private tmp = new THREE.Vector3();
  private want = new THREE.Vector3();

  constructor(private collider: DecorCollider) {}

  clear() { this.list.length = 0; this.discs.length = 0; this.tnts.length = 0; }

  /** Nouvelle run : un allié dans chaque abbaye, dans l'ordre de `ALLIES` (l'arrivée est n'importe où sur la carte). */
  place(kinds: readonly AllyId[] = Object.keys(ALLIES) as AllyId[]) {
    this.clear();
    kinds.forEach((kind, i) => {
      const site = abbeySites[i];
      if (!site) return;
      const pos = this.freeSpot(site.dir);
      const facing = new THREE.Vector3().crossVectors(pos.clone().normalize(), Math.abs(pos.y) < 0.9 * pos.length() ? Y : X).normalize();
      this.list.push({ kind, pos, facing, state: 'waiting', left: 0, cooldown: 0, speed: 0 });
    });
  }

  /** Pose un allié `kind` qui attend à la direction `dir` (panneau DEV, tests) ; un seul de chaque sorte : celui de son
   * abbaye est remplacé. */
  placeAt(kind: AllyId, dir: THREE.Vector3) {
    const i = this.list.findIndex((x) => x.kind === kind);
    if (i >= 0) this.list.splice(i, 1);
    const d = dir.clone().normalize();
    const pos = d.clone().multiplyScalar(PLANET_RADIUS + heightAt(d));
    const facing = new THREE.Vector3().crossVectors(d, Math.abs(d.y) < 0.9 ? Y : X).normalize();
    const a: Ally = { kind, pos, facing, state: 'waiting', left: 0, cooldown: 0, speed: 0 };
    this.list.push(a);
    return a;
  }

  /**
   * Avance d'un pas : un allié touché rejoint le joueur (`onJoin`), ceux qui le suivent marchent derrière lui et usent
   * de leur pouvoir à leur cadence (`onPower`), puis s'en vont (`onLeave`).
   */
  update(dt: number, playerPos: THREE.Vector3, playerFacing: THREE.Vector3, playerSpeed: number,
    on: { join(a: Ally): void; power(a: Ally): void; leave(a: Ally): void }) {
    for (const a of this.list) {
      if (a.state === 'waiting') {
        a.speed = 0;
        if (a.pos.angleTo(playerPos) * PLANET_RADIUS < R.joinRange) {
          a.state = 'following';
          a.left = R.followTime;
          a.cooldown = ALLIES[a.kind].power.every * 0.5;
          on.join(a);
        }
        continue;
      }
      if (a.state !== 'following') continue;
      a.left -= dt;
      if (a.left <= 0) { a.state = 'gone'; a.speed = 0; on.leave(a); continue; }
      this.follow(a, dt, playerPos, playerFacing, playerSpeed);
      a.cooldown -= dt;
      if (a.cooldown <= 0) { a.cooldown = ALLIES[a.kind].power.every; on.power(a); }
    }
  }

  /**
   * Suit le joueur comme un compagnon : il marche vers lui et s'arrête à `followDistance` m (sans le contourner quand il
   * tourne), en s'écartant des autres alliés. Trop loin, il réapparaît derrière lui.
   */
  private follow(a: Ally, dt: number, playerPos: THREE.Vector3, playerFacing: THREE.Vector3, playerSpeed: number) {
    const aUp = a.pos.clone().normalize();
    const tangent = (v: THREE.Vector3) => v.addScaledVector(aUp, -v.dot(aUp));
    this.want.subVectors(playerPos, a.pos);
    tangent(this.want);
    const dist = this.want.length();
    if (dist > R.catchUp) {
      a.pos.copy(playerPos).addScaledVector(playerFacing, -R.followDistance);
      this.ground(a.pos);
      a.speed = 0;
      return;
    }
    const toPlayer = dist > 1e-4 ? this.want.clone().divideScalar(dist) : a.facing.clone();
    // Vers le joueur, de plus en plus vite quand il s'éloigne ; arrêté à sa distance
    const max = Math.max(R.minSpeed, playerSpeed * R.speed);
    const move = this.want.copy(toPlayer).multiplyScalar(THREE.MathUtils.clamp((dist - R.followDistance) * R.gain, 0, max));
    // Écart aux autres alliés (et au joueur, s'il arrive dessus)
    for (const o of this.list) {
      if (o === a || o.state !== 'following') continue;
      const away = tangent(this.tmp.subVectors(a.pos, o.pos));
      const d = away.length();
      if (d < R.spacing && d > 1e-4) move.addScaledVector(away, (R.spacing - d) / d * R.push);
    }
    if (dist < R.followDistance * 0.6) move.addScaledVector(toPlayer, -(R.followDistance * 0.6 - dist) * R.push);
    tangent(move);
    const v = Math.min(move.length(), max);
    a.speed = v;
    if (v > 0.05) {
      move.setLength(v);
      a.pos.addScaledVector(move, dt);
      a.facing.lerp(move.divideScalar(v), 1 - Math.exp(-dt * 8));
    } else {
      // Arrêté : il se tourne vers le joueur
      a.facing.lerp(toPlayer, 1 - Math.exp(-dt * 4));
    }
    this.ground(a.pos);
    const up = a.pos.clone().normalize();
    a.facing.addScaledVector(up, -a.facing.dot(up)).normalize();
  }

  /** Pose le point sur le sol (relief). */
  private ground(p: THREE.Vector3) {
    const d = this.tmp.copy(p).normalize();
    p.copy(d).multiplyScalar(PLANET_RADIUS + heightAt(d));
  }

  /** Un point libre près du centre d'une abbaye (le centre peut être pris par un bâtiment). */
  private freeSpot(dir: THREE.Vector3) {
    const d = dir.clone().normalize();
    const t1 = new THREE.Vector3().crossVectors(d, Math.abs(d.y) < 0.9 ? Y : X).normalize();
    const t2 = new THREE.Vector3().crossVectors(d, t1);
    const p = new THREE.Vector3();
    for (let r = 0; r <= R.searchRadius; r += 2) {
      for (let k = 0; k < (r ? 12 : 1); k++) {
        const ang = (k / 12) * Math.PI * 2;
        p.copy(d).multiplyScalar(PLANET_RADIUS).addScaledVector(t1, Math.cos(ang) * r).addScaledVector(t2, Math.sin(ang) * r).normalize();
        const pos = p.clone().multiplyScalar(PLANET_RADIUS + heightAt(p));
        if (!this.collider.occupied(this.tmp.copy(p).multiplyScalar(pos.length() + 0.9), 0.6)) return pos;
      }
    }
    return d.multiplyScalar(PLANET_RADIUS + heightAt(d));
  }
}
