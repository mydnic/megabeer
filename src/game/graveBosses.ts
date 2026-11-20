import * as THREE from 'three';
import { GRAVE_BOSSES as G } from '../config/bosses';
import { PLANET_RADIUS } from '../config/world';
import type { DecorCollider } from '../world/decor/collider';
import type { GraveSite } from '../world/decor/layout';
import { heightAt } from '../world/terrain';
import type { BossKind } from './boss';
import { flatAround } from './patronDoor';

/** Un boss optionnel : où il attend, où il regarde ; `waiting` tant qu'il n'a pas été défié. */
export type GraveBoss = { kind: BossKind; pos: THREE.Vector3; facing: THREE.Vector3; waiting: boolean };

/**
 * Les boss optionnels (issue #19) : chacun attend devant le portail d'un cimetière, loin du départ. Le joueur à portée
 * peut le défier (`focus`) ; le jeu le fait alors entrer en combat. Sans cimetière (tests), il attend à l'écart du départ.
 */
export class GraveBosses {
  readonly list: GraveBoss[] = [];
  /** Le boss qui attend à portée du joueur (null : aucun). */
  focus: GraveBoss | null = null;
  private readonly tmp = new THREE.Vector3();

  constructor(private readonly collider: DecorCollider, private readonly random: () => number) {}

  clear() { this.list.length = 0; this.focus = null; }

  /**
   * Nouvelle run : chaque boss devant un cimetière différent, tiré au hasard parmi ceux loin du départ ; Sauron au fond
   * du cratère de la Montagne du Destin (`doomDir`).
   */
  place(spawnDir: THREE.Vector3, graveyards: readonly GraveSite[] = [], doomDir: THREE.Vector3 | null = null) {
    this.clear();
    const far = graveyards.filter((g) => g.dir.angleTo(spawnDir) * PLANET_RADIUS >= G.minFromSpawn);
    for (const kind of G.kinds) {
      if (far.length) {
        const g = far.splice(Math.floor(this.random() * far.length), 1)[0];
        const pos = this.freeSpot(g.dir);
        // Il tourne le dos au portail : il garde l'entrée
        const up = pos.clone().normalize();
        const facing = g.out.clone().addScaledVector(up, -g.out.dot(up)).normalize();
        this.list.push({ kind, pos, facing, waiting: true });
        continue;
      }
      // Sans cimetière (tests) : sur un sol plat à quelque distance du départ, sans tirer au hasard (les autres
      // placements de la run gardent leurs tirages)
      const side = new THREE.Vector3().crossVectors(spawnDir, Math.abs(spawnDir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
      const dir = new THREE.Vector3();
      for (let i = 0; i < 72; i++) {
        const axis = side.clone().applyAxisAngle(spawnDir, (i / 72) * Math.PI * 2);
        dir.copy(spawnDir).applyAxisAngle(axis, (G.minFromSpawn + 20) / PLANET_RADIUS);
        if (flatAround(dir, 4, 1)) break;
      }
      this.placeAt(kind, dir);
    }
    if (doomDir) this.placeAt('sauron', doomDir);
  }

  /** Pose un boss `kind` qui attend à la direction `dir` (panneau DEV, tests) ; un seul de chaque sorte. */
  placeAt(kind: BossKind, dir: THREE.Vector3) {
    const i = this.list.findIndex((b) => b.kind === kind);
    if (i >= 0) this.list.splice(i, 1);
    const d = dir.clone().normalize();
    const pos = d.clone().multiplyScalar(PLANET_RADIUS + heightAt(d));
    const facing = new THREE.Vector3().crossVectors(d, Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    const b: GraveBoss = { kind, pos, facing, waiting: true };
    this.list.push(b);
    return b;
  }

  update(playerPos: THREE.Vector3) {
    this.focus = this.list.find((b) => b.waiting && b.pos.angleTo(playerPos) * PLANET_RADIUS < G.interactRange) ?? null;
  }

  /** Un point libre près du portail (un sapin peut être juste devant). */
  private freeSpot(dir: THREE.Vector3) {
    const d = dir.clone().normalize();
    const t1 = new THREE.Vector3().crossVectors(d, Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    const t2 = new THREE.Vector3().crossVectors(d, t1);
    const p = new THREE.Vector3();
    for (let r = 0; r <= G.searchRadius; r += 1) {
      for (let k = 0; k < (r ? 12 : 1); k++) {
        const a = (k / 12) * Math.PI * 2;
        p.copy(d).multiplyScalar(PLANET_RADIUS).addScaledVector(t1, Math.cos(a) * r).addScaledVector(t2, Math.sin(a) * r).normalize();
        const pos = p.clone().multiplyScalar(PLANET_RADIUS + heightAt(p));
        if (!this.collider.occupied(this.tmp.copy(p).multiplyScalar(pos.length() + 1.5), 1.6)) return pos;
      }
    }
    return d.multiplyScalar(PLANET_RADIUS + heightAt(d));
  }
}
