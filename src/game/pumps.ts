import * as THREE from 'three';
import { PUMPS as P, PUMP_TIERS, STAT_BONUSES, type PumpTier } from '../config/pumps';
import { PLANET_RADIUS } from '../config/world';
import { heightAt } from '../world/terrain';
import type { DecorCollider } from '../world/decor/collider';
import type { StatCard } from './levelUpCards';

/** Une pompe à bière posée sur la planète. */
export type Pump = {
  /** Position au sol (pied de la pompe). */
  pos: THREE.Vector3;
  tier: PumpTier;
  /** Remplissage de la pinte (0 à 1). */
  fill: number;
  /** Déjà vidée : elle ne se remplit plus. */
  used: boolean;
};

/** Tire une qualité selon les poids de PUMP_TIERS. */
function rollTier(): PumpTier {
  const tiers = Object.keys(PUMP_TIERS) as PumpTier[];
  let x = Math.random() * tiers.reduce((s, k) => s + PUMP_TIERS[k].weight, 0);
  for (const k of tiers) { x -= PUMP_TIERS[k].weight; if (x <= 0) return k; }
  return 'bronze';
}

/** Point uniforme sur la sphère (direction). */
function randomDir(out: THREE.Vector3) {
  const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
  return out.set(r * Math.cos(a), u, r * Math.sin(a));
}

/**
 * Les pompes à bière d'une run (GDD section 10) : posées au hasard sur la planète, loin du départ,
 * espacées, hors du décor. Rester dans leur rayon remplit la pinte, s'éloigner la vide doucement ;
 * pleine, elle propose ses bonus (une seule fois).
 */
export class Pumps {
  readonly list: Pump[] = [];
  private tmp = new THREE.Vector3();

  constructor(private collider: DecorCollider) {}

  /** Nouvelle run : pose les pompes loin de `spawnDir`. */
  place(spawnDir: THREE.Vector3) {
    this.list.length = 0;
    const dir = new THREE.Vector3();
    for (let i = 0; i < P.placementTries && this.list.length < P.count; i++) {
      randomDir(dir);
      if (dir.angleTo(spawnDir) * PLANET_RADIUS < P.minFromSpawn) continue;
      if (this.list.some((p) => p.pos.angleTo(dir) * PLANET_RADIUS < P.minSpacing)) continue;
      const pos = dir.clone().multiplyScalar(PLANET_RADIUS + heightAt(dir));
      // Hors du décor (murs, arbres...) : le point à hauteur de poitrine doit être libre
      if (this.collider.occupied(this.tmp.copy(dir).multiplyScalar(pos.length() + 1), 1.2)) continue;
      this.list.push({ pos, tier: rollTier(), fill: 0, used: false });
    }
  }

  clear() { this.list.length = 0; }

  /** Remplit (ou vide) chaque pompe ; renvoie celle qui vient d'être pleine, s'il y en a une. */
  update(dt: number, playerPos: THREE.Vector3): Pump | null {
    let full: Pump | null = null;
    for (const p of this.list) {
      if (p.used) continue;
      const near = p.pos.angleTo(playerPos) * PLANET_RADIUS < P.radius;
      p.fill = near ? Math.min(1, p.fill + dt / P.fillTime) : Math.max(0, p.fill - dt * P.drainPerSecond);
      if (p.fill >= 1 && !full) { p.used = true; full = p; }
    }
    return full;
  }
}

/** Les bonus proposés par une pompe : `n` stats différentes, valeurs multipliées par sa qualité. */
export function rollStatCards(tier: PumpTier, n: number): StatCard[] {
  const order: PumpTier[] = ['bronze', 'argent', 'or'];
  const pool = STAT_BONUSES.filter((b) => order.indexOf(b.minTier ?? 'bronze') <= order.indexOf(tier));
  const cards: StatCard[] = [];
  const left = [...pool];
  while (cards.length < n && left.length) {
    const b = left.splice(Math.floor(Math.random() * left.length), 1)[0];
    cards.push({ kind: 'stat', stat: b.id, value: b.fixed ? b.value : b.value * PUMP_TIERS[tier].mult, tier });
  }
  return cards;
}
