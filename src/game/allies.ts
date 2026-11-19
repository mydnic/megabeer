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

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);

/**
 * Les alliés d'une run (issue #18) : un par abbaye, sauf celle de l'arrivée. Touché, un allié rejoint le joueur et le suit
 * un temps ; le jeu applique son pouvoir quand `update` le demande.
 */
export class Allies {
  readonly list: Ally[] = [];
  private tmp = new THREE.Vector3();
  private want = new THREE.Vector3();

  constructor(private collider: DecorCollider) {}

  clear() { this.list.length = 0; }

  /** Nouvelle run : un allié dans chaque abbaye autre que la plus proche de l'arrivée (dans l'ordre de `ALLIES`). */
  place(spawnDir: THREE.Vector3, kinds: readonly AllyId[] = Object.keys(ALLIES) as AllyId[]) {
    this.clear();
    const sites = [...abbeySites].sort((a, b) => a.dir.angleTo(spawnDir) - b.dir.angleTo(spawnDir)).slice(1);
    kinds.forEach((kind, i) => {
      const site = sites[i];
      if (!site) return;
      const pos = this.freeSpot(site.dir);
      const facing = new THREE.Vector3().crossVectors(pos.clone().normalize(), Math.abs(pos.y) < 0.9 * pos.length() ? Y : X).normalize();
      this.list.push({ kind, pos, facing, state: 'waiting', left: 0, cooldown: 0, speed: 0 });
    });
  }

  /** Pose un allié `kind` qui attend à la direction `dir` (panneau DEV, tests). */
  placeAt(kind: AllyId, dir: THREE.Vector3) {
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

  /** Marche vers sa place derrière le joueur, sur le côté ; trop loin, il réapparaît à côté de lui. */
  private follow(a: Ally, dt: number, playerPos: THREE.Vector3, playerFacing: THREE.Vector3, playerSpeed: number) {
    const up = this.tmp.copy(playerPos).normalize();
    const side = new THREE.Vector3().crossVectors(playerFacing, up).normalize();
    const target = playerPos.clone().addScaledVector(playerFacing, -R.followDistance).addScaledVector(side, -R.followSide);
    const gap = target.distanceTo(a.pos);
    if (gap > R.catchUp) { a.pos.copy(target); this.ground(a.pos); a.speed = 0; return; }
    this.want.subVectors(target, a.pos);
    const aUp = a.pos.clone().normalize();
    this.want.addScaledVector(aUp, -this.want.dot(aUp));
    const d = this.want.length();
    const speed = Math.max(R.minSpeed, playerSpeed * R.speed);
    const step = Math.min(d, speed * dt);
    if (d > 0.05) {
      this.want.divideScalar(d);
      a.pos.addScaledVector(this.want, step);
      a.facing.lerp(this.want, 1 - Math.exp(-dt * 8)).normalize();
    }
    a.speed = dt > 0 ? step / dt : 0;
    this.ground(a.pos);
    a.facing.addScaledVector(aUp, -a.facing.dot(aUp)).normalize();
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
