import * as THREE from 'three';
import { LAST_CALL as L } from '../config/lastCall';
import { PLANET_RADIUS } from '../config/world';
import { groundBodies, type DecorCollider } from '../world/decor/collider';
import { boxShape } from '../world/decor/gridShape';
import { heightAt } from '../world/terrain';
import { randomDir } from './pumps';

/** Une grande cloche du bar posée sur la planète : son pied, et si elle a déjà sonné. */
export type CallBell = { pos: THREE.Vector3; rung: boolean };

/** Chance qu'un ennemi tué lâche une clochette, pour une Chance (LUCK) donnée. */
export function bellDropChance(luck: number) {
  return L.dropChance * (1 + Math.max(0, luck) * L.dropLuck);
}

/**
 * Les cloches du « Dernier service » (GDD section 10, Cloche du bar) : quelques grandes cloches posées
 * loin les unes des autres. À la touche d'action, une cloche sonne (une seule fois) : toute l'XP et toutes
 * les capsules de la planète arrivent au Buveur. `focus` : la cloche pas encore sonnée à portée.
 */
export class LastCall {
  readonly list: CallBell[] = [];
  focus: CallBell | null = null;
  private tmp = new THREE.Vector3();

  constructor(private collider: DecorCollider) {}

  /** Nouvelle run : pose les cloches loin de `spawnDir`, des coffres et des pompes. */
  place(spawnDir: THREE.Vector3, chests: readonly THREE.Vector3[], pumps: readonly THREE.Vector3[], count: number = L.count) {
    this.clear();
    const dir = new THREE.Vector3();
    const far = (a: THREE.Vector3, b: THREE.Vector3, d: number) => a.angleTo(b) * PLANET_RADIUS >= d;
    // Espacement souhaité, relâché peu à peu si la planète est trop encombrée pour le tenir
    for (let spacing: number = L.minSpacing; this.list.length < count && spacing > 10; spacing *= 0.8) {
      for (let i = 0; i < L.placementTries && this.list.length < count; i++) {
        randomDir(dir);
        if (!far(dir, spawnDir, L.minFromSpawn)) continue;
        if (!this.list.every((b) => far(dir, b.pos, spacing))) continue;
        if (!chests.every((p) => far(dir, p, L.minFromChest))) continue;
        if (!pumps.every((p) => far(dir, p, L.minFromPump))) continue;
        const pos = dir.clone().multiplyScalar(PLANET_RADIUS + heightAt(dir));
        // Hors du décor : le point à hauteur de poitrine doit être libre
        if (this.collider.occupied(this.tmp.copy(dir).multiplyScalar(pos.length() + 1), 1.2)) continue;
        this.list.push({ pos, rung: false });
      }
    }
    this.collider.setExtra('lastCall', groundBodies(this.list.map((b) => b.pos), boxShape(L.body.halfX, L.body.halfZ, L.body.height)));
  }

  clear() {
    this.list.length = 0;
    this.focus = null;
    this.collider.setExtra('lastCall', []);
  }

  /** Cherche la cloche pas encore sonnée à portée du joueur. */
  update(playerPos: THREE.Vector3) {
    let best: number = L.interactRange;
    this.focus = null;
    for (const b of this.list) {
      if (b.rung) continue;
      const d = b.pos.angleTo(playerPos) * PLANET_RADIUS;
      if (d < best) { best = d; this.focus = b; }
    }
  }
}
