import { TOURNEE_DROPS as D, TOURNEE_FX as F, TOURNEES, type TourneeId } from '../config/tournees';
import { createXpDrops } from '../pickups/xpDrops';
import type * as THREE from 'three';

/** Les tournées, dans un ordre fixe : la valeur d'une tournée au sol est son rang dans cette liste. */
export const TOURNEE_IDS = Object.keys(TOURNEES) as TourneeId[];

/** Chance qu'un ennemi tué lâche une tournée, pour une Chance (LUCK) donnée. */
export function tourneeDropChance(luck: number) {
  return D.dropChance * (1 + Math.max(0, luck) * D.dropLuck);
}

/** Tire une tournée selon les poids de la config (`r` : hasard de 0 à 1). */
export function rollTournee(r: number): TourneeId {
  const total = TOURNEE_IDS.reduce((s, id) => s + TOURNEES[id].weight, 0);
  let x = r * total;
  for (const id of TOURNEE_IDS) { x -= TOURNEES[id].weight; if (x <= 0) return id; }
  return TOURNEE_IDS[TOURNEE_IDS.length - 1];
}

/**
 * Les tournées du bar d'une run (simulation seule) : celles qui attendent au sol (`drops`, valeur = rang
 * dans `TOURNEE_IDS`) et le temps qu'il reste à celles qui agissent. Le jeu applique les effets immédiats ;
 * ici, les multiplicateurs que le jeu lit à chaque coup ou chaque pas.
 */
export class Tournees {
  readonly drops: ReturnType<typeof createXpDrops>;
  private readonly time: Record<TourneeId, number> = Object.fromEntries(TOURNEE_IDS.map((id) => [id, 0])) as Record<TourneeId, number>;

  constructor(groundAt: (p: THREE.Vector3) => number) {
    this.drops = createXpDrops(groundAt, D);
  }

  /** Temps restant d'une tournée (s, 0 : inactive). */
  left(id: TourneeId) { return this.time[id]; }

  /** Lance (ou relance) la minuterie d'une tournée ; renvoie vrai si elle n'était pas déjà active. */
  start(id: TourneeId) {
    const fresh = this.time[id] <= 0;
    this.time[id] = TOURNEES[id].duration;
    return fresh;
  }

  /** Avance les minuteries ; renvoie les tournées qui viennent de finir. */
  update(dt: number, ended: TourneeId[]) {
    ended.length = 0;
    for (const id of TOURNEE_IDS) {
      if (this.time[id] <= 0) continue;
      this.time[id] -= dt;
      if (this.time[id] <= 0) { this.time[id] = 0; ended.push(id); }
    }
    return ended;
  }

  get damageMul() { return this.time.pression > 0 ? F.pression.damageMul : 1; }
  get xpMul() { return this.time.doublePinte > 0 ? F.doublePinte.xpMul : 1; }
  get speedMul() { return this.time.peket > 0 ? F.peket.speedMul : 1; }
  get helmet() { return this.time.casque > 0; }
  get regen() { return this.time.fritesMayo > 0 ? F.fritesMayo.regen : 0; }

  clear() {
    for (const id of TOURNEE_IDS) this.time[id] = 0;
    this.drops.clear();
  }
}
