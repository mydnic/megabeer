import { ACHIEVEMENTS, type AchievementDef } from '../config/achievements';
import type { DifficultyId } from '../config/spawn';

/** Ce que le suivi lit du jeu à chaque image (sans connaître le jeu lui-même). */
export type AchievementSource = {
  runTime: () => number;
  kills: () => number;
  weapons: () => number;
  tunas: () => number;
  difficulty: () => DifficultyId;
};

/**
 * Suivi des succès pendant une run : les compteurs de la run (élites, objets, poubelles...) et ceux de toujours
 * (`lifetimeKills`, donné au départ de la run). Chaque succès pas encore gagné (`owned`) tombe au plus une fois, et
 * `onUnlock` l'annonce.
 */
export class AchievementTracker {
  /** Succès déjà gagnés avant la run (sauvegarde) : ils ne retombent pas. */
  owned: ReadonlySet<string> = new Set();
  /** Ennemis tués avant cette run (sauvegarde), pour les succès « au total ». */
  lifetimeKills = 0;
  /** Gagnés pendant cette run, dans l'ordre. */
  readonly gained: string[] = [];
  private counts = { elites: 0, items: 0, bins: 0, synergy: 0 };
  private bosses: { kind: string; difficulty: DifficultyId }[] = [];

  constructor(private src: AchievementSource, private onUnlock: (a: AchievementDef) => void) {}

  reset() {
    this.gained.length = 0;
    this.counts = { elites: 0, items: 0, bins: 0, synergy: 0 };
    this.bosses = [];
  }

  elite() { this.counts.elites++; this.check(); }
  item() { this.counts.items++; this.check(); }
  bin() { this.counts.bins++; this.check(); }
  synergy() { this.counts.synergy++; this.check(); }
  boss(kind: string) { this.bosses.push({ kind, difficulty: this.src.difficulty() }); this.check(); }

  /** Chaque image de la run, et à sa fin (`ended` : la run vient de se terminer). */
  check(ended = false) {
    for (const a of ACHIEVEMENTS) {
      if (this.owned.has(a.id) || this.gained.includes(a.id) || !this.met(a, ended)) continue;
      this.gained.push(a.id);
      this.onUnlock(a);
    }
  }

  private met(a: AchievementDef, ended: boolean) {
    const r = a.rule, s = this.src;
    switch (r.kind) {
      case 'runEnded': return ended;
      case 'survive': return s.runTime() >= r.seconds;
      case 'boss': return this.bosses.some((b) => b.kind === r.boss && (!r.difficulty || b.difficulty === r.difficulty));
      case 'runKills': return s.kills() >= r.n;
      case 'totalKills': return this.lifetimeKills + s.kills() >= r.n;
      case 'weapons': return s.weapons() >= r.n;
      case 'synergy': return this.counts.synergy > 0;
      case 'elites': return this.counts.elites >= r.n;
      case 'items': return this.counts.items >= r.n;
      case 'bins': return this.counts.bins >= r.n;
      case 'tunas': return s.tunas() >= r.n;
    }
  }
}
