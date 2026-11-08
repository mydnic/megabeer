import * as THREE from 'three';
import { NONE, type GridShape } from './gridShape';

/** Un élément de décor posé : repère local (y = verticale du sol) et forme de collision. */
export type DecorBody = {
  /** Origine du modèle dans le monde (au pied). */
  pos: THREE.Vector3;
  /** Monde -> local (rotation + translation). */
  inv: THREE.Matrix4;
  /** Local -> monde (rotation seule), pour remettre les poussées dans le monde. */
  rot: THREE.Quaternion;
  shape: GridShape;
  /** Grand modèle courbé sur la sphère (voir bendToSphere) : repère local par projection. */
  bend?: Bend;
};

/**
 * Courbure d'un grand modèle : un point local (x, y, z) est posé sur la planète en direction
 * normalize(c * R + e1 * x + e2 * z), à la hauteur base + y. Projection inversible exactement.
 */
export type Bend = { c: THREE.Vector3; e1: THREE.Vector3; e2: THREE.Vector3; R: number; base: number };

/** Monde -> local d'un corps courbé. */
export function unbend(b: Bend, p: THREE.Vector3, out: THREE.Vector3) {
  const r = p.length();
  const dc = p.dot(b.c);
  return out.set((b.R * p.dot(b.e1)) / dc, r - b.base, (b.R * p.dot(b.e2)) / dc);
}

const CELL = 10; // m, maille de l'index spatial

/**
 * Collisions avec le décor : index spatial des éléments, poussée hors des cases occupées,
 * hauteur du sol porteur, et tracé de rayon pour la caméra.
 */
export class DecorCollider {
  private buckets = new Map<number, DecorBody[]>();
  private tmp = new THREE.Vector3();
  private lp = new THREE.Vector3();
  private push = new THREE.Vector3();
  private seen = new Set<DecorBody>();
  private found: DecorBody[] = [];

  constructor(public bodies: DecorBody[], readonly step: number, readonly clearance: number) {
    this.reset(bodies);
  }

  /** Remplace tout le décor (nouvelle planète) ; les joueurs et la horde gardent la même référence. */
  reset(bodies: DecorBody[]) {
    this.bodies = bodies;
    this.buckets.clear();
    for (const b of bodies) {
      const r = b.shape.radius;
      const lo = this.tmp.copy(b.pos).subScalar(r).divideScalar(CELL).floor();
      const hi = this.lp.copy(b.pos).addScalar(r).divideScalar(CELL).floor();
      for (let x = lo.x; x <= hi.x; x++) for (let y = lo.y; y <= hi.y; y++) for (let z = lo.z; z <= hi.z; z++) {
        const k = this.key(x, y, z);
        let list = this.buckets.get(k);
        if (!list) this.buckets.set(k, (list = []));
        list.push(b);
      }
    }
  }

  private key(x: number, y: number, z: number) {
    return ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
  }

  /** Éléments dont la zone touche la sphère (p, r). */
  near(p: THREE.Vector3, r: number): DecorBody[] {
    this.seen.clear();
    this.found.length = 0;
    const lo = this.tmp.copy(p).subScalar(r).divideScalar(CELL).floor();
    const x0 = lo.x, y0 = lo.y, z0 = lo.z;
    const hi = this.tmp.copy(p).addScalar(r).divideScalar(CELL).floor();
    for (let x = x0; x <= hi.x; x++) for (let y = y0; y <= hi.y; y++) for (let z = z0; z <= hi.z; z++) {
      const list = this.buckets.get(this.key(x, y, z));
      if (!list) continue;
      for (const b of list) {
        if (this.seen.has(b)) continue;
        this.seen.add(b);
        if (b.pos.distanceToSquared(p) < (b.shape.radius + r) ** 2) this.found.push(b);
      }
    }
    return this.found;
  }

  private toLocal(b: DecorBody, p: THREE.Vector3) {
    return b.bend ? unbend(b.bend, p, this.lp) : this.lp.copy(p).applyMatrix4(b.inv);
  }

  /** Une case bloque-t-elle un corps dont les pieds sont à la hauteur locale `feet` ? */
  private blocks(s: GridShape, k: number, feet: number) {
    const t = s.top[k];
    return t !== NONE && t > feet + this.step && s.bottom[k] < feet + this.clearance;
  }

  /**
   * Pousse `pos` (pieds du corps, monde) hors des cases occupées dans un rayon `radius`.
   * Quelques itérations de la poussée la plus profonde : glisse proprement le long des murs.
   */
  resolve(pos: THREE.Vector3, radius: number) {
    const bodies = this.near(pos, radius + 1);
    for (const b of bodies) {
      const s = b.shape;
      for (let iter = 0; iter < 3; iter++) {
        const lp = this.toLocal(b, pos);
        const feet = lp.y;
        const i0 = Math.max(0, Math.floor((lp.x - radius - s.minX) / s.cell));
        const i1 = Math.min(s.nx - 1, Math.floor((lp.x + radius - s.minX) / s.cell));
        const j0 = Math.max(0, Math.floor((lp.z - radius - s.minZ) / s.cell));
        const j1 = Math.min(s.nz - 1, Math.floor((lp.z + radius - s.minZ) / s.cell));
        let best = 0, bx = 0, bz = 0;
        for (let i = i0; i <= i1; i++) {
          for (let j = j0; j <= j1; j++) {
            const k = i * s.nz + j;
            if (!this.blocks(s, k, feet)) continue;
            const x0 = s.minX + i * s.cell, z0 = s.minZ + j * s.cell;
            const cx = Math.min(Math.max(lp.x, x0), x0 + s.cell), cz = Math.min(Math.max(lp.z, z0), z0 + s.cell);
            let dx = lp.x - cx, dz = lp.z - cz;
            let d = Math.hypot(dx, dz);
            if (d >= radius) continue;
            if (d < 1e-5) { // centre dans la case : on sort par le côté le plus proche du centre de case
              dx = lp.x - (x0 + s.cell / 2); dz = lp.z - (z0 + s.cell / 2);
              d = Math.hypot(dx, dz) || 1e-5;
              const pen = radius + s.cell * 0.5;
              if (pen > best) { best = pen; bx = dx / d; bz = dz / d; }
              continue;
            }
            const pen = radius - d;
            if (pen > best) { best = pen; bx = dx / d; bz = dz / d; }
          }
        }
        if (best <= 1e-4) break;
        if (b.bend) this.push.copy(b.bend.e1).multiplyScalar(bx * best).addScaledVector(b.bend.e2, bz * best);
        else this.push.set(bx * best, 0, bz * best).applyQuaternion(b.rot);
        pos.add(this.push);
      }
    }
  }

  /**
   * Rayon (depuis le centre de la planète) du dessus de décor le plus haut sous le point `p`, s'il
   * n'est pas plus haut que les pieds + une marche. -Infinity s'il n'y a rien.
   */
  supportAt(p: THREE.Vector3, feetR: number): number {
    let best = -Infinity;
    const r = p.length();
    for (const b of this.near(p, 0.5)) {
      const s = b.shape;
      const lp = this.toLocal(b, p);
      const i = Math.floor((lp.x - s.minX) / s.cell), j = Math.floor((lp.z - s.minZ) / s.cell);
      if (i < 0 || j < 0 || i >= s.nx || j >= s.nz) continue;
      const t = s.top[i * s.nz + j];
      if (t === NONE) continue;
      const feetLocal = lp.y + (feetR - r); // hauteur locale des pieds
      if (t > feetLocal + this.step) continue;
      // Le dessus porteur, ramené en rayon
      const radial = r - lp.y + t;
      if (radial > best) best = radial;
    }
    return best;
  }

  /** Le point `p` est-il à l'intérieur d'une case occupée (pour la caméra) ? */
  occupied(p: THREE.Vector3, margin: number): boolean {
    for (const b of this.near(p, margin)) {
      const s = b.shape;
      const lp = this.toLocal(b, p);
      const i = Math.floor((lp.x - s.minX) / s.cell), j = Math.floor((lp.z - s.minZ) / s.cell);
      if (i < 0 || j < 0 || i >= s.nx || j >= s.nz) continue;
      const k = i * s.nz + j;
      if (s.top[k] !== NONE && lp.y < s.top[k] + margin && lp.y > s.bottom[k] - margin) return true;
    }
    return false;
  }
}
