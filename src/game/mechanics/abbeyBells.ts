import { BELLS as B } from '../../config/abbey';
import type { EnemyId } from '../../config/enemies';
import type { Game } from '../game';
import type { MapMechanic } from './mechanic';

/**
 * Les cloches de l'Abbaye : toutes les 2 min, elles sonnent quelques coups d'alerte, puis c'est le
 * débarquement : pendant 30 s, un seul type d'ennemi sort de terre en continu et en masse tout autour
 * du joueur. Coupées avec les arrivées automatiques.
 */
export function createAbbeyBells(game: Game): MapMechanic {
  /** Temps de run du prochain débarquement ; début de la sonnerie en cours et coups déjà sonnés (-1 : silence). */
  let next: number = B.every, ringStart = 0, tolled = -1;
  /** Débarquement en cours : temps restant (s, 0 : aucun), type d'ennemi, arrivées en attente et total. */
  let surge = 0, enemy: EnemyId = 'zombie', budget = 0, landed = 0;

  const startSurge = () => {
    tolled = -1;
    next = (Math.floor(game.runTime / B.every) + 1) * B.every;
    surge = B.duration;
    // Un seul type pour tout le débarquement, parmi ceux déjà arrivés dans la run
    enemy = game.director.pickEnemy(game.runTime);
    budget = 1;
    landed = 0;
    game.events.emit('bellsLanding', { duration: B.duration, enemy });
  };

  const updateSurge = (dt: number) => {
    const step = Math.min(dt, surge);
    surge -= step;
    budget += B.perSecond * game.mods.count * step;
    const n = Math.floor(budget);
    if (n > 0) {
      budget -= n;
      landed += game.director.spawnAround(n, B.minDist, B.maxDist, enemy);
    }
    if (surge <= 0) game.events.emit('bellsSurgeEnded', { count: landed });
  };

  return {
    reset() { next = B.every; tolled = -1; surge = 0; },
    trigger() { next = game.runTime + B.warn; tolled = -1; },
    update(dt) {
      if (!game.director.enabled) return;
      if (surge > 0) updateSurge(dt);
      const t = game.runTime;
      // Chrono avancé d'un coup (outils de dev) : on ne rattrape pas les sonneries sautées
      if (tolled < 0 && t > next) next = (Math.floor(t / B.every) + 1) * B.every;
      if (tolled < 0 && t >= next - B.warn) {
        tolled = 0;
        ringStart = t;
        game.events.emit('bellsRinging', { inSeconds: next - t });
      }
      if (tolled < 0) return;
      const gap = B.warn / B.tolls;
      while (tolled < B.tolls && t >= ringStart + tolled * gap) game.events.emit('bellToll', { index: tolled++ });
      if (t >= next) startSurge();
    },
  };
}
