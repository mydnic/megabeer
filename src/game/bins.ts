import * as THREE from 'three';
import { BINS as B } from '../config/bins';
import { PLANET_RADIUS } from '../config/world';
import { heightAt } from '../world/terrain';
import { randomDir } from './pumps';

/** Une poubelle : ses pieds, son centre (à mi-hauteur), et si elle est déjà cassée. */
export type Bin = { pos: THREE.Vector3; center: THREE.Vector3; broken: boolean };

/** Taille d'une case de la grille des poubelles (m) : une poubelle est rangée dans toutes les cases que touchent ses zones. */
const CELL = 2;
const key = (x: number, y: number, z: number) => ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);

/**
 * Les poubelles d'une run (GDD section 10, exploration) : posées au hasard sur la planète, elles se
 * cassent d'un coup, au contact du joueur ou d'une arme. Une grille fixe les retrouve en une lecture
 * pour chaque projectile en vol (des centaines par image en fin de partie).
 */
export class Bins {
  readonly list: Bin[] = [];
  private readonly grid = new Map<number, Bin[]>();
  private readonly tmp = new THREE.Vector3();

  /** Nouvelle run : pose `count` poubelles loin de `spawnDir` et des points `avoid` (coffres à `minFromChest`, pompes à `minFromPump`). */
  place(spawnDir: THREE.Vector3, chests: readonly THREE.Vector3[], pumps: readonly THREE.Vector3[], count: number = B.count) {
    this.clear();
    const dir = new THREE.Vector3();
    const far = (a: THREE.Vector3, b: THREE.Vector3, d: number) => a.angleTo(b) * PLANET_RADIUS >= d;
    for (let i = 0; i < B.placementTries && this.list.length < count; i++) {
      randomDir(dir);
      if (!far(dir, spawnDir, B.minFromSpawn)) continue;
      if (!chests.every((p) => far(dir, p, B.minFromChest))) continue;
      if (!pumps.every((p) => far(dir, p, B.minFromPump))) continue;
      if (!this.list.every((b) => far(dir, b.pos, B.minSpacing))) continue;
      this.add(dir.clone().multiplyScalar(PLANET_RADIUS + heightAt(dir)));
    }
  }

  /** Pose une poubelle à ce point au sol (placement, tests). */
  add(at: THREE.Vector3) {
    const pos = at.clone().setLength(PLANET_RADIUS + heightAt(this.tmp.copy(at).normalize()));
    const center = pos.clone().addScaledVector(this.tmp.copy(pos).normalize(), B.height / 2);
    const bin: Bin = { pos, center, broken: false };
    this.list.push(bin);
    // Rangée dans chaque case que touche sa zone de coup (ou de contact avec le joueur, la plus grande)
    const r = Math.max(B.hitRadius, B.touch) + 0.1;
    for (let x = Math.floor((center.x - r) / CELL); x <= Math.floor((center.x + r) / CELL); x++)
      for (let y = Math.floor((center.y - r) / CELL); y <= Math.floor((center.y + r) / CELL); y++)
        for (let z = Math.floor((center.z - r) / CELL); z <= Math.floor((center.z + r) / CELL); z++) {
          const k = key(x, y, z);
          const cell = this.grid.get(k);
          if (cell) cell.push(bin); else this.grid.set(k, [bin]);
        }
    return bin;
  }

  /** La poubelle encore debout dont la zone de coup contient `p` (un projectile), s'il y en a une. */
  at(p: THREE.Vector3) {
    const cell = this.grid.get(key(Math.floor(p.x / CELL), Math.floor(p.y / CELL), Math.floor(p.z / CELL)));
    if (!cell) return null;
    for (const b of cell) if (!b.broken && b.center.distanceToSquared(p) < B.hitRadius * B.hitRadius) return b;
    return null;
  }

  /** Poubelles encore debout à moins de `radius` m de `p` (explosions : rares, on parcourt la liste). */
  within(p: THREE.Vector3, radius: number, out: Bin[]) {
    out.length = 0;
    const r = radius + B.hitRadius;
    for (const b of this.list) if (!b.broken && b.center.distanceToSquared(p) < r * r) out.push(b);
    return out;
  }

  /** La poubelle encore debout que touche le joueur (pieds en `feet`), s'il y en a une. */
  touching(feet: THREE.Vector3) {
    this.tmp.copy(feet).setLength(feet.length() + B.height / 2);
    const cell = this.grid.get(key(Math.floor(this.tmp.x / CELL), Math.floor(this.tmp.y / CELL), Math.floor(this.tmp.z / CELL)));
    if (!cell) return null;
    for (const b of cell) if (!b.broken && b.pos.angleTo(feet) * PLANET_RADIUS < B.touch && Math.abs(feet.length() - b.pos.length()) < B.height) return b;
    return null;
  }

  clear() {
    this.list.length = 0;
    this.grid.clear();
  }
}
