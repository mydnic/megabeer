import * as THREE from 'three';
import { PATRON_DOOR as D } from '../config/bosses';
import { PLANET_RADIUS } from '../config/world';
import { heightAt } from '../world/terrain';
import type { DecorCollider } from '../world/decor/collider';
import { randomDir } from './pumps';

/**
 * La Porte du patron (GDD section 12) : une seule par run, posée loin du départ sur un sol presque plat. Le joueur l'active quand il veut
 * (touche d'action) : elle s'ouvre et le boss final en sort. `focus` : le joueur est à portée et elle est fermée.
 */
export class PatronDoor {
  /** Pied de la porte (null : pas encore posée), direction vers laquelle elle s'ouvre (au sol). */
  pos: THREE.Vector3 | null = null;
  readonly facing = new THREE.Vector3();
  open = false;
  focus = false;
  private readonly tmp = new THREE.Vector3();

  constructor(private readonly collider: DecorCollider) {}

  /** Nouvelle run : la pose loin du départ, à l'écart des coffres et des pompes, hors du décor, tournée vers le départ. */
  place(spawnDir: THREE.Vector3, chests: readonly THREE.Vector3[], pumps: readonly THREE.Vector3[]) {
    this.clear();
    const dir = new THREE.Vector3();
    const far = (a: THREE.Vector3, b: THREE.Vector3, d: number) => a.angleTo(b) * PLANET_RADIUS >= d;
    for (let i = 0; i < D.placementTries * 2; i++) {
      const k = i < D.placementTries ? 1 : 0.5;
      randomDir(dir);
      if (!far(dir, spawnDir, D.minFromSpawn)) continue;
      if (!chests.every((c) => far(dir, c, D.minFromChest * k))) continue;
      if (!pumps.every((c) => far(dir, c, D.minFromPump * k))) continue;
      const pos = dir.clone().multiplyScalar(PLANET_RADIUS + heightAt(dir));
      if (!flatAround(dir, D.flatRadius, D.maxBump / k)) continue;
      if (this.collider.occupied(this.tmp.copy(dir).multiplyScalar(pos.length() + 1.5), D.clearRadius * k)) continue;
      this.pos = pos;
      // Elle regarde vers le départ (le long du grand cercle)
      this.facing.copy(spawnDir).addScaledVector(dir, -spawnDir.dot(dir)).normalize();
      if (this.facing.lengthSq() < 1e-6) this.facing.set(1, 0, 0).addScaledVector(dir, -dir.x).normalize();
      return;
    }
  }

  clear() { this.pos = null; this.open = false; this.focus = false; }

  update(playerPos: THREE.Vector3) {
    this.focus = !!this.pos && !this.open && this.pos.angleTo(playerPos) * PLANET_RADIUS < D.interactRange;
  }
}

/** Le relief autour de `dir` (8 directions, à `radius` m et à mi-chemin) reste-t-il à moins de `bump` m de sa hauteur ? */
export function flatAround(dir: THREE.Vector3, radius: number, bump: number) {
  const h0 = heightAt(dir);
  const a = new THREE.Vector3().crossVectors(dir, Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
  const b = new THREE.Vector3().crossVectors(dir, a);
  const t = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    t.copy(a).multiplyScalar(Math.cos(ang)).addScaledVector(b, Math.sin(ang));
    for (const r of [radius / 2, radius]) {
      d.copy(dir).addScaledVector(t, r / PLANET_RADIUS).normalize();
      if (Math.abs(heightAt(d) - h0) > bump) return false;
    }
  }
  return true;
}
