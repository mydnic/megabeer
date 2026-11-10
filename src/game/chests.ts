import * as THREE from 'three';
import { CHESTS as C } from '../config/chests';
import { ITEMS, type ItemDef, type ItemId } from '../config/items';
import { RARITIES } from '../config/upgrades';
import { PLANET_RADIUS } from '../config/world';
import { groundBodies, type DecorCollider } from '../world/decor/collider';
import { boxShape } from '../world/decor/gridShape';
import { heightAt } from '../world/terrain';
import { randomDir } from './pumps';

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);

/** Un coffre posé sur la planète : ses pieds, et s'il a déjà été ouvert. */
export type Chest = { pos: THREE.Vector3; opened: boolean; free?: boolean };

/** Carte d'objet (coffre) : l'objet, sa rareté, l'effet qui en découle. */
export type ItemCard = { kind: 'item'; item: ItemId; rarity: number; mult: number };

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
  get price() { return Math.round((C.basePrice + this.opened * C.priceStep) * (1 - this.discount)); }
  /** Réduction des prix (Carte de fidélité, 0 à 1), posée par le jeu. */
  discount = 0;
  /** Prix d'un coffre donné (un coffre du Bonnet est gratuit). */
  priceOf(chest: Chest) { return chest.free ? 0 : this.price; }

  /**
   * Bonnet du Père Noël : pose un coffre gratuit à `dist` m du joueur, sur un sol libre et plat
   * (essaie plusieurs directions autour de `facing`). Renvoie null s'il n'y a plus de place.
   */
  addFree(playerPos: THREE.Vector3, facing: THREE.Vector3, dist: number) {
    if (this.list.filter((c) => c.free).length >= C.extraMax) return null;
    const up = playerPos.clone().normalize();
    const side = new THREE.Vector3().crossVectors(up, facing).normalize();
    const dir = new THREE.Vector3(), q = new THREE.Quaternion();
    for (let i = 0; i < 16; i++) {
      const a = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 8);
      const out = facing.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a));
      const axis = new THREE.Vector3().crossVectors(up, out).normalize();
      dir.copy(up).applyQuaternion(q.setFromAxisAngle(axis, dist / PLANET_RADIUS));
      const pos = dir.clone().multiplyScalar(PLANET_RADIUS + heightAt(dir));
      if (this.collider.occupied(this.tmp.copy(dir).multiplyScalar(pos.length() + 0.6), 1)) continue;
      const chest: Chest = { pos, opened: false, free: true };
      this.list.push(chest);
      this.collider.setExtra('chests', groundBodies(this.list.map((c) => c.pos), boxShape(C.body.halfX, C.body.halfZ, C.body.height)));
      return chest;
    }
    return null;
  }

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
    this.discount = 0;
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
    const def: ItemDef = ITEMS[id];
    cards.push({ kind: 'item', item: id, rarity, mult: def.fixed ? 1 : RARITIES[rarity].mult });
  }
  return cards;
}
