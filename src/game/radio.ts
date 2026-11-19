import * as THREE from 'three';
import { RADIO as R } from '../config/radio';
import { PLANET_RADIUS } from '../config/world';
import type { DecorCollider } from '../world/decor/collider';
import { heightAt } from '../world/terrain';

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);

/** État de la radio : posée et éteinte, en train de jouer (elle attire la horde), ou cassée. */
export type RadioState = 'idle' | 'playing' | 'broken';

/**
 * La radio planquée d'une run (issue #16) : posée au hasard loin de l'arrivée. Allumée, elle sert de leurre à la horde
 * (le jeu le dit à la horde) et encaisse ses coups jusqu'à être détruite. `focus` : le joueur est à portée pour l'allumer.
 */
export class Radio {
  pos: THREE.Vector3 | null = null;
  facing = new THREE.Vector3();
  state: RadioState = 'idle';
  hp: number = R.hp;
  /** PV max (skill tree : ligne Radio). */
  maxHp: number = R.hp;
  focus = false;
  private tmp = new THREE.Vector3();

  constructor(private collider: DecorCollider, private random: () => number = Math.random) {}

  clear() {
    this.pos = null;
    this.state = 'idle';
    this.hp = this.maxHp;
    this.focus = false;
  }

  /**
   * Nouvelle run : cache la radio loin de `spawnDir`, à l'écart des points `avoid`. Son propre tirage, tiré du point
   * d'arrivée : il ne décale pas le hasard du reste du jeu.
   */
  place(spawnDir: THREE.Vector3, avoid: readonly THREE.Vector3[]) {
    this.clear();
    let seed = (Math.floor((spawnDir.x * 73856093) ^ (spawnDir.y * 19349663) ^ (spawnDir.z * 83492791)) >>> 0) || 1;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
    const own = this.random;
    this.random = rnd;
    const dir = new THREE.Vector3();
    const far = (a: THREE.Vector3, b: THREE.Vector3, d: number) => a.angleTo(b) * PLANET_RADIUS >= d;
    for (let i = 0; i < R.tries; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      dir.set(r * Math.cos(a), u, r * Math.sin(a));
      if (!far(dir, spawnDir, R.minFromSpawn) || !avoid.every((p) => far(dir, p, R.minFromOthers))) continue;
      if (this.placeAt(dir)) { this.random = own; return this.pos; }
    }
    this.random = own;
    return null;
  }

  /** Pose la radio à la direction `dir` si le sol y est libre et plat (aussi : panneau DEV, tests). */
  placeAt(dir: THREE.Vector3) {
    dir = dir.clone().normalize();
    if (!this.flat(dir)) return false;
    const pos = dir.clone().multiplyScalar(PLANET_RADIUS + heightAt(dir));
    if (this.collider.occupied(this.tmp.copy(dir).multiplyScalar(pos.length() + 0.5), 0.8)) return false;
    this.pos = pos;
    this.state = 'idle';
    this.hp = this.maxHp;
    this.facing.crossVectors(dir, Math.abs(dir.y) < 0.9 ? Y : X).normalize().applyAxisAngle(dir, this.random() * Math.PI * 2);
    return true;
  }

  /** Le joueur est-il à portée pour l'allumer ? */
  update(playerPos: THREE.Vector3) {
    this.focus = this.state === 'idle' && !!this.pos && this.pos.angleTo(playerPos) * PLANET_RADIUS < R.interactRange;
  }

  /** Allume la radio (si elle est à portée et éteinte). */
  turnOn() {
    if (!this.focus) return false;
    this.state = 'playing';
    this.focus = false;
    return true;
  }

  /** Un coup d'ennemi : renvoie true si la radio vient de casser. */
  hit(damage: number) {
    if (this.state !== 'playing') return false;
    this.hp = Math.max(0, this.hp - damage);
    if (this.hp > 0) return false;
    this.state = 'broken';
    return true;
  }

  private flat(dir: THREE.Vector3) {
    const h0 = heightAt(dir);
    const a = new THREE.Vector3().crossVectors(dir, Math.abs(dir.y) < 0.9 ? Y : X).normalize();
    const b = new THREE.Vector3().crossVectors(dir, a);
    for (const t of [a, b, a.clone().negate(), b.clone().negate()]) {
      const d = this.tmp.copy(dir).addScaledVector(t, R.flatRadius / PLANET_RADIUS).normalize();
      if (Math.abs(heightAt(d) - h0) > R.maxBump) return false;
    }
    return true;
  }
}
