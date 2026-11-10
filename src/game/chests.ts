import * as THREE from 'three';
import { CHESTS as C } from '../config/chests';
import { ITEMS, type ItemId } from '../config/items';
import { RARITIES } from '../config/upgrades';
import { PLANET_RADIUS } from '../config/world';
import { groundBodies, type DecorCollider } from '../world/decor/collider';
import { boxShape } from '../world/decor/gridShape';
import { heightAt } from '../world/terrain';
import { randomDir } from './pumps';

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);

/** Un coffre posé sur la planète : ses pieds, et s'il a déjà été ouvert. */
export type Chest = { pos: THREE.Vector3; opened: boolean };

/** Carte d'objet (coffre) : l'objet, sa rareté, l'effet qui en découle. */
export type ItemCard = { kind: 'item'; item: ItemId; rarity: number; value: number };

/**
 * Les coffres d'une run : une centaine posés au hasard, payés en capsules à la touche d'action, à
 * prix croissant. `focus` : le coffre fermé à portée du joueur (le plus proche), s'il y en a un.
 */
export class Chests {
  readonly list: Chest[] = [];
  focus: Chest | null = null;
  /** Coffres ouverts pendant la run (le prix monte à chaque fois). */
  opened = 0;
  private tmp = new THREE.Vector3();

  constructor(private collider: DecorCollider) {}

  /** Prix du prochain coffre (capsules). */
  get price() { return C.basePrice + this.opened * C.priceStep; }

  /** Nouvelle run : pose les coffres loin de `spawnDir` et des points `avoid` (les pompes). */
  place(spawnDir: THREE.Vector3, avoid: readonly THREE.Vector3[]) {
    this.clear();
    const dir = new THREE.Vector3();
    const far = (a: THREE.Vector3, b: THREE.Vector3, d: number) => a.angleTo(b) * PLANET_RADIUS >= d;
    for (let i = 0; i < C.placementTries && this.list.length < C.count; i++) {
      randomDir(dir);
      if (!far(dir, spawnDir, C.minFromSpawn)) continue;
      if (!avoid.every((p) => far(dir, p, C.minFromPump))) continue;
      if (!this.list.every((c) => far(dir, c.pos, C.minSpacing))) continue;
      const pos = dir.clone().multiplyScalar(PLANET_RADIUS + heightAt(dir));
      if (!this.flat(dir)) continue;
      // Hors du décor : le point à hauteur de taille doit être libre
      if (this.collider.occupied(this.tmp.copy(dir).multiplyScalar(pos.length() + 0.6), 1)) continue;
      this.list.push({ pos, opened: false });
    }
    this.collider.setExtra('chests', groundBodies(this.list.map((c) => c.pos), boxShape(C.body.halfX, C.body.halfZ, C.body.height)));
  }

  /** Le sol est-il assez plat autour de `dir` pour y poser un coffre ? */
  private flat(dir: THREE.Vector3) {
    const h0 = heightAt(dir);
    const a = new THREE.Vector3().crossVectors(dir, Math.abs(dir.y) < 0.9 ? Y : X).normalize();
    const b = new THREE.Vector3().crossVectors(dir, a);
    for (const t of [a, b, a.clone().negate(), b.clone().negate()]) {
      const d = this.tmp.copy(dir).addScaledVector(t, C.flatRadius / PLANET_RADIUS).normalize();
      if (Math.abs(heightAt(d) - h0) > C.maxBump) return false;
    }
    return true;
  }

  clear() {
    this.list.length = 0;
    this.focus = null;
    this.opened = 0;
    this.collider.setExtra('chests', []);
  }

  /** Cherche le coffre fermé à portée du joueur. */
  update(playerPos: THREE.Vector3) {
    let best: number = C.interactRange;
    this.focus = null;
    for (const c of this.list) {
      if (c.opened) continue;
      const d = c.pos.angleTo(playerPos) * PLANET_RADIUS;
      if (d < best) { best = d; this.focus = c; }
    }
  }
}

/** Les objets proposés par un coffre de rareté `rarity` : `n` objets différents, permis à cette rareté. */
export function rollItemCards(rarity: number, n: number): ItemCard[] {
  const left = (Object.keys(ITEMS) as ItemId[]).filter((id) => ((ITEMS[id] as { minRarity?: number }).minRarity ?? 0) <= rarity);
  const cards: ItemCard[] = [];
  while (cards.length < n && left.length) {
    const id = left.splice(Math.floor(Math.random() * left.length), 1)[0];
    const def = ITEMS[id] as { value: number; fixed?: boolean };
    cards.push({ kind: 'item', item: id, rarity, value: def.fixed ? def.value : def.value * RARITIES[rarity].mult });
  }
  return cards;
}
