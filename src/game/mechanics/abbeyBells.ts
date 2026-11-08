import { BELLS as B } from '../../config/abbey';
import type { EnemyId } from '../../config/enemies';
import type { Game } from '../game';
import type { MapMechanic } from './mechanic';

/**
 * Les cloches de l'Abbaye : toutes les 2 min pile, elles sonnent et le débarquement démarre aussitôt
 * (sans alerte) : pendant 30 s, un seul type d'ennemi sort de terre en continu et en masse tout autour
 * du joueur. Quelques coups de volée suivent le grand coup. Coupées avec les arrivées automatiques.
 */
export function createAbbeyBells(game: Game): MapMechanic {
  /** Temps de run du prochain débarquement. */
  let next: number = B.every;
  /** Débarquement en cours : temps écoulé et restant (s, 0 : aucun), type d'ennemi, arrivées en attente, total, coups de volée sonnés. */
  let elapsed = 0, surge = 0, enemy: EnemyId = 'zombie', budget = 0, landed = 0, tolled = 0;

  const startSurge = () => {
    next = (Math.floor(game.runTime / B.every) + 1) * B.every;
    elapsed = 0;
    surge = B.duration;
    // Un seul type pour tout le débarquement, parmi ceux déjà arrivés dans la run
    enemy = game.director.pickEnemy(game.runTime);
    budget = 1;
    landed = 0;
    tolled = 0;
    game.events.emit('bellsLanding', { duration: B.duration, enemy });
  };

  const updateSurge = (dt: number) => {
    const step = Math.min(dt, surge);
    surge -= step;
    elapsed += step;
    while (tolled < B.tolls && elapsed >= (tolled + 1) * B.tollGap) game.events.emit('bellToll', { index: tolled++ });
    budget += B.perSecond * game.mods.count * step;
    const n = Math.floor(budget);
    if (n > 0) {
      budget -= n;
      landed += game.director.spawnAround(n, B.minDist, B.maxDist, enemy);
    }
    if (surge <= 0) game.events.emit('bellsSurgeEnded', { count: landed });
  };

  return {
    reset() { next = B.every; surge = 0; },
    trigger() { next = game.runTime; },
    update(dt) {
      if (!game.director.enabled) return;
      if (surge > 0) updateSurge(dt);
      const t = game.runTime;
      // Chrono avancé d'un coup (outils de dev) : on ne rattrape pas les sonneries sautées
      if (t > next + 1) next = (Math.floor(t / B.every) + 1) * B.every;
      if (t >= next) startSurge();
    },
  };
}
