import * as THREE from 'three';
import { DOOM_MOUNTAIN as DM } from '../config/doom';
import { PLANET_RADIUS } from '../config/world';
import { doomSite } from '../world/terrain';

/**
 * La Montagne du Destin (issue #20) : son relief vit dans le terrain (`doomSite`, `heightAt`) ; ici, ce qui s'y passe.
 * L'anneau de lave au fond du cratère brûle le joueur qui y marche (il faut le sauter).
 */
export class DoomMountain {
  private tick = 0;

  /** Centre du cratère (direction unitaire). */
  get dir() { return doomSite.dir; }

  /** Distance au centre du cratère (m, le long du sol). */
  distance(pos: THREE.Vector3) { return pos.angleTo(doomSite.dir) * PLANET_RADIUS; }

  /** Ce point est-il sur la lave ? */
  inLava(pos: THREE.Vector3) {
    const s = this.distance(pos);
    return s >= DM.lava.inner && s <= DM.lava.outer;
  }

  /** Le joueur (à `height` m au-dessus du sol) : vrai quand la lave le brûle à cette image. */
  update(dt: number, pos: THREE.Vector3, height: number) {
    this.tick -= dt;
    if (height > 0.4 || !this.inLava(pos) || this.tick > 0) return false;
    this.tick = DM.lava.tick;
    return true;
  }
}
