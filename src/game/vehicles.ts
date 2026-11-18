import * as THREE from 'three';
import { PLANET_RADIUS } from '../config/world';
import { VEHICLE_SPAWN as S, VEHICLES, type VehicleId } from '../config/vehicles';
import { RARITIES } from '../config/upgrades';
import type { DecorCollider } from '../world/decor/collider';
import { heightAt } from '../world/terrain';

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);

/** Un véhicule garé sur la planète, qui attend qu'on monte dedans : sa sorte, ses roues au sol, son capot, son âge (s). */
export type ParkedVehicle = { kind: VehicleId; pos: THREE.Vector3; facing: THREE.Vector3; age: number };
/** Le véhicule conduit : sa sorte, ses PV, le temps qui reste (s), le prochain coup qu'il peut encaisser (s). */
export type DrivenVehicle = { kind: VehicleId; hp: number; maxHp: number; left: number; duration: number; hitCooldown: number };

/**
 * Les véhicules d'une run (GDD section 9) : un seul garé à la fois, qui apparaît à son heure à quelques dizaines de
 * mètres du joueur et repart s'il n'est pas pris ; le joueur monte dedans au contact. Le reste (conduite, écrasement,
 * sortie) est mené par le jeu.
 */
export class Vehicles {
  parked: ParkedVehicle | null = null;
  driving: DrivenVehicle | null = null;
  /** Prochaine apparition (temps de run, s). */
  private nextAt: number = S.firstAt;
  private tmp = new THREE.Vector3();

  constructor(private collider: DecorCollider, private random: () => number = Math.random) {}

  clear() {
    this.parked = null;
    this.driving = null;
    this.nextAt = S.firstAt;
  }

  /** Tire une sorte de véhicule : les plus rares sortent moins souvent (poids des raretés). */
  pick(): VehicleId {
    const pool = S.pool;
    const w = pool.map((k) => RARITIES[VEHICLES[k].rarity].weight);
    let r = this.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) if ((r -= w[i]) <= 0) return pool[i];
    return pool[pool.length - 1];
  }

  /**
   * Pose un véhicule `kind` entre `minDist` et `maxDist` m de `playerPos`, sur un sol libre et plat. Renvoie null s'il
   * n'y a pas de place.
   */
  spawnNear(playerPos: THREE.Vector3, kind: VehicleId = this.pick(), minDist: number = S.minDist, maxDist: number = S.maxDist) {
    const up = playerPos.clone().normalize();
    const side = new THREE.Vector3().crossVectors(up, Math.abs(up.y) < 0.9 ? Y : X).normalize();
    const dir = new THREE.Vector3();
    for (let i = 0; i < S.tries; i++) {
      const dist = minDist + this.random() * (maxDist - minDist);
      const axis = side.clone().applyAxisAngle(up, this.random() * Math.PI * 2);
      dir.copy(up).applyAxisAngle(axis, dist / PLANET_RADIUS);
      if (!this.flat(dir)) continue;
      const pos = dir.clone().multiplyScalar(PLANET_RADIUS + heightAt(dir));
      if (this.collider.occupied(this.tmp.copy(dir).multiplyScalar(pos.length() + 0.8), VEHICLES[kind].car.radius + 0.6)) continue;
      // Capot tourné au hasard dans le plan du sol
      const facing = side.clone().applyAxisAngle(up, this.random() * Math.PI * 2);
      facing.addScaledVector(dir, -facing.dot(dir)).normalize();
      this.parked = { kind, pos, facing, age: 0 };
      return this.parked;
    }
    return null;
  }

  /**
   * Avance d'un pas : apparition à son heure (s'il n'y en a ni garé ni conduit), départ du véhicule garé trop vieux.
   * Renvoie le véhicule garé que le joueur touche (il monte dedans), sinon null.
   */
  update(dt: number, runTime: number, playerPos: THREE.Vector3): ParkedVehicle | null {
    if (this.driving) return null;
    if (this.parked) {
      this.parked.age += dt;
      if (this.parked.age > S.lifetime) { this.parked = null; this.nextAt = runTime + S.every; return null; }
      if (this.parked.pos.angleTo(playerPos) * PLANET_RADIUS < S.enterRange) return this.parked;
      return null;
    }
    if (runTime >= this.nextAt) {
      this.nextAt = runTime + S.every;
      this.spawnNear(playerPos);
    }
    return null;
  }

  /** Le joueur monte dans le véhicule garé : il devient le véhicule conduit. */
  enter(v: ParkedVehicle) {
    const D = VEHICLES[v.kind];
    this.parked = null;
    this.driving = { kind: v.kind, hp: D.hp, maxHp: D.hp, left: D.duration, duration: D.duration, hitCooldown: 0 };
    return this.driving;
  }

  /** Le joueur en descend (fin du temps ou véhicule détruit) ; le suivant apparaîtra `every` s plus tard. */
  exit(runTime: number) {
    this.driving = null;
    this.nextAt = runTime + S.every;
  }

  /** Le sol est-il assez plat autour de `dir` pour y garer un véhicule ? */
  private flat(dir: THREE.Vector3) {
    const h0 = heightAt(dir);
    const a = new THREE.Vector3().crossVectors(dir, Math.abs(dir.y) < 0.9 ? Y : X).normalize();
    const b = new THREE.Vector3().crossVectors(dir, a);
    for (const t of [a, b, a.clone().negate(), b.clone().negate()]) {
      const d = this.tmp.copy(dir).addScaledVector(t, S.flatRadius / PLANET_RADIUS).normalize();
      if (Math.abs(heightAt(d) - h0) > S.maxBump) return false;
    }
    return true;
  }
}
