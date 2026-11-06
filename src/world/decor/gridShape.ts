import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

/**
 * Forme de collision d'un modèle, déduite de sa géométrie réelle : une grille dans son plan local
 * (x, z). Chaque case connaît :
 *  - top : la hauteur du dessus de ce qui se trouve à hauteur de corps (on y monte si c'est bas) ;
 *  - bottom : la hauteur du dessous de la matière (on passe dessous si c'est assez haut).
 * Ce qui est au-dessus de la tête (toit d'une nef, branches, linteau d'arcade) ne bloque pas.
 */
export type GridShape = {
  cell: number;
  minX: number; minZ: number;
  nx: number; nz: number;
  top: Float32Array;
  bottom: Float32Array;
  /** Rayon englobant dans le plan (m) et hauteur max, pour les tests grossiers. */
  radius: number;
  height: number;
};

export const NONE = -1e9;

/**
 * @param headroom hauteur du « plafond de corps » : au-dessus, la géométrie ne compte pas pour
 * marcher ou buter (un peu plus que la hauteur libre exigée pour passer dessous).
 */
export function computeGridShape(geometry: THREE.BufferGeometry, cell: number, headroom = 2.3): GridShape {
  const geo = geometry.clone();
  const bvh = new MeshBVH(geo);
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const minX = bb.min.x - cell, minZ = bb.min.z - cell;
  const nx = Math.ceil((bb.max.x - minX) / cell) + 1;
  const nz = Math.ceil((bb.max.z - minZ) / cell) + 1;
  const top = new Float32Array(nx * nz).fill(NONE);
  const bottom = new Float32Array(nx * nz).fill(NONE);
  const ray = new THREE.Ray();
  const down = new THREE.Vector3(0, -1, 0), up = new THREE.Vector3(0, 1, 0);
  let radius = 0;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = minX + (i + 0.5) * cell, z = minZ + (j + 0.5) * cell;
      ray.origin.set(x, bb.max.y + 1, z); ray.direction.copy(down);
      const above = bvh.raycastFirst(ray, THREE.DoubleSide);
      if (!above) continue;
      const k = i * nz + j;
      radius = Math.max(radius, Math.hypot(Math.abs(x) + cell, Math.abs(z) + cell));
      ray.origin.set(x, bb.min.y - 1, z); ray.direction.copy(up);
      const below = bvh.raycastFirst(ray, THREE.DoubleSide);
      const bot = below ? below.point.y : above.point.y;
      if (above.point.y <= headroom) {
        // Objet bas : son dessus est accessible
        top[k] = above.point.y;
        bottom[k] = bot;
        continue;
      }
      // Objet haut : que trouve-t-on sous le plafond de corps ?
      ray.origin.set(x, headroom, z); ray.direction.copy(down);
      const low = bvh.raycastFirst(ray, THREE.DoubleSide);
      const inside = low && low.face && low.face.normal.dot(down) > 0; // face vue de dos : on part de l'intérieur
      if (inside) {
        top[k] = above.point.y; // colonne pleine (mur, tronc, pilier) : infranchissable
        bottom[k] = bot;
      } else if (low) {
        top[k] = low.point.y; // sol, marche, banc... sous un toit
        bottom[k] = bot;
      } else {
        top[k] = above.point.y; // rien à hauteur de corps : on passe dessous
        bottom[k] = bot;
      }
    }
  }
  return { cell, minX, minZ, nx, nz, top, bottom, radius, height: bb.max.y };
}
