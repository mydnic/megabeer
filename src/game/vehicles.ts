import * as THREE from 'three';
import { PLANET_RADIUS } from '../config/world';
import { VEHICLE_SPAWN as S, VEHICLES, type VehicleId } from '../config/vehicles';
import { RARITIES } from '../config/upgrades';
import type { DecorCollider } from '../world/decor/collider';
import { heightAt } from '../world/terrain';
import { randomDir } from './pumps';

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);

/** Un véhicule garé sur la planète, qui attend qu'on monte dedans : sa sorte, ses roues au sol, son capot, son âge (s). */
export type ParkedVehicle = { kind: VehicleId; pos: THREE.Vector3; facing: THREE.Vector3; age: number };
/** Le véhicule conduit : sa sorte, ses PV, le temps qui reste (s), le prochain coup qu'il peut encaisser (s). */
export type DrivenVehicle = { kind: VehicleId; hp: number; maxHp: number; left: number; duration: number; hitCooldown: number;
  /** Canon (le tank) : temps avant le prochain obus (s), et le point visé par le dernier (la tourelle s'y tourne). */
  reload: number; aim: THREE.Vector3 | null };
/** Un obus en vol : son point de départ, son point d'arrivée, le temps qui reste avant l'impact (s). */
export type Shell = { from: THREE.Vector3; to: THREE.Vector3; left: number; flight: number };

/**
 * Le véhicule d'une run (GDD section 9) : un seul, garé au hasard sur la planète dès le début ; il faut le trouver. Le
 * joueur monte dedans au contact. Le reste (conduite, écrasement, sortie) est mené par le jeu.
 */
export class Vehicles {
  parked: ParkedVehicle | null = null;
  driving: DrivenVehicle | null = null;
  /** Skill tree (ligne Véhicules) : durée et PV des véhicules (x). */
  timeMul = 1;
  hpMul = 1;
  /** Obus du tank en vol. */
  readonly shells: Shell[] = [];
  private tmp = new THREE.Vector3();

  constructor(private collider: DecorCollider, private random: () => number = Math.random) {}

  clear() {
    this.parked = null;
    this.driving = null;
    this.shells.length = 0;
  }

  /**
   * Nouvelle run : gare un véhicule tiré au hasard loin de `spawnDir`, à l'écart des points `avoid` (coffres, pompes...).
   * Renvoie null s'il n'y a pas de place.
   */
  place(spawnDir: THREE.Vector3, avoid: readonly THREE.Vector3[], kind: VehicleId = this.pick()) {
    this.clear();
    const dir = new THREE.Vector3();
    const far = (a: THREE.Vector3, b: THREE.Vector3, d: number) => a.angleTo(b) * PLANET_RADIUS >= d;
    for (let i = 0; i < S.tries; i++) {
      randomDir(dir);
      if (!far(dir, spawnDir, S.minFromSpawn) || !avoid.every((p) => far(dir, p, S.minFromOthers))) continue;
      if (this.park(dir, kind)) return this.parked;
    }
    return null;
  }

  /** Gare un véhicule `kind` à la direction `dir` si le sol y est libre et plat. */
  private park(dir: THREE.Vector3, kind: VehicleId) {
    if (!this.flat(dir)) return false;
    const pos = dir.clone().multiplyScalar(PLANET_RADIUS + heightAt(dir));
    if (this.collider.occupied(this.tmp.copy(dir).multiplyScalar(pos.length() + 0.8), VEHICLES[kind].car.radius + 0.6)) return false;
    // Capot tourné au hasard dans le plan du sol
    const ref = Math.abs(dir.y) < 0.9 ? Y : X;
    const facing = new THREE.Vector3().crossVectors(dir, ref).normalize().applyAxisAngle(dir, this.random() * Math.PI * 2);
    this.parked = { kind, pos, facing, age: 0 };
    return true;
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
   * Gare un véhicule `kind` entre `minDist` et `maxDist` m de `playerPos` (panneau DEV, tests), sur un sol libre et plat.
   * Renvoie null s'il n'y a pas de place.
   */
  spawnNear(playerPos: THREE.Vector3, kind: VehicleId = this.pick(), minDist: number = S.minDist, maxDist: number = S.maxDist) {
    const up = playerPos.clone().normalize();
    const side = new THREE.Vector3().crossVectors(up, Math.abs(up.y) < 0.9 ? Y : X).normalize();
    const dir = new THREE.Vector3();
    for (let i = 0; i < S.tries; i++) {
      const dist = minDist + this.random() * (maxDist - minDist);
      const axis = side.clone().applyAxisAngle(up, this.random() * Math.PI * 2);
      dir.copy(up).applyAxisAngle(axis, dist / PLANET_RADIUS);
      if (this.park(dir, kind)) return this.parked;
    }
    return null;
  }

  /** Avance d'un pas ; renvoie le véhicule garé que le joueur touche (il monte dedans), sinon null. */
  update(dt: number, playerPos: THREE.Vector3): ParkedVehicle | null {
    if (this.driving || !this.parked) return null;
    this.parked.age += dt;
    return this.parked.pos.angleTo(playerPos) * PLANET_RADIUS < S.enterRange ? this.parked : null;
  }

  /** Le joueur monte dans le véhicule garé : il devient le véhicule conduit. */
  enter(v: ParkedVehicle) {
    const D = VEHICLES[v.kind];
    this.parked = null;
    const hp = D.hp * this.hpMul, duration = D.duration * this.timeMul;
    this.driving = { kind: v.kind, hp, maxHp: hp, left: duration, duration, hitCooldown: 0, reload: 0, aim: null };
    return this.driving;
  }

  /** Le joueur en descend (fin du temps ou véhicule détruit) : il n'y en a plus pour cette run. */
  exit() {
    this.driving = null;
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
