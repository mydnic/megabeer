import { SAIYAN as S, type SaiyanTier } from '../config/saiyan';

/**
 * Jauge de colère et transformation Super Saiyan (GDD section 10). La jauge n'existe qu'une fois l'objet Sang Saiyan
 * pris (`enabled`). Elle se remplit en tuant et en prenant des coups, sauf pendant la transformation. À la demande, le
 * joueur se transforme au plus haut palier atteint, pour `duration` s, puis la jauge retombe à 0. Le jeu applique les
 * bonus du palier (`tier`) et les retire à la fin.
 */
export class Saiyan {
  enabled = false;
  /** Points de jauge. */
  points = 0;
  /** Palier de la transformation en cours (0 : pas transformé ; 1 à 6). */
  tier = 0;
  /** Temps qui reste à la transformation (s). */
  left = 0;
  /** Prochain éclair (SSJ2), s. */
  lightningIn = 0;

  reset() { this.enabled = false; this.points = 0; this.tier = 0; this.left = 0; this.lightningIn = 0; }

  get active() { return this.tier > 0; }
  /** Le palier de la transformation en cours (null : pas transformé). */
  get current(): SaiyanTier | null { return this.tier > 0 ? S.tiers[this.tier - 1] : null; }

  /** Plus haut palier atteint par la jauge (0 : aucun). */
  get reached() {
    let n = 0;
    while (n < S.thresholds.length && this.points >= S.thresholds[n]) n++;
    return n;
  }

  /** Ajoute des points (pas pendant la transformation) ; renvoie le palier nouvellement atteint, sinon 0. */
  gain(points: number) {
    if (!this.enabled || this.active || points <= 0) return 0;
    const before = this.reached;
    this.points = Math.min(this.points + points, S.thresholds[S.thresholds.length - 1]);
    const after = this.reached;
    return after > before ? after : 0;
  }

  /** Se transforme au plus haut palier atteint ; renvoie ce palier (0 : rien à faire). */
  transform() {
    if (!this.enabled || this.active || this.reached === 0) return 0;
    this.tier = this.reached;
    this.left = S.duration;
    this.lightningIn = 0;
    return this.tier;
  }

  /** Avance le temps ; renvoie true quand la transformation vient de finir (la jauge retombe à 0). */
  update(dt: number) {
    if (!this.active) return false;
    this.left -= dt;
    if (this.left > 0) return false;
    this.tier = 0;
    this.left = 0;
    this.points = 0;
    return true;
  }
}
