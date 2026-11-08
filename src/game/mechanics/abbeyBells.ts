import { BELLS as B } from '../../config/abbey';
import type { Game } from '../game';
import type { MapMechanic } from './mechanic';

/**
 * Les cloches de l'Abbaye : toutes les 2 min, elles sonnent quelques coups d'alerte, puis une horde
 * sort de terre en cercle autour du joueur (le débarquement). Coupées avec les arrivées automatiques.
 */
export function createAbbeyBells(game: Game): MapMechanic {
  /** Temps de run du prochain débarquement ; début de la sonnerie en cours et coups déjà sonnés (-1 : silence). */
  let next: number = B.every, ringStart = 0, tolled = -1;

  const land = () => {
    const placed = game.director.surround(Math.round(B.count * game.mods.count), B.minDist, B.maxDist);
    game.events.emit('bellsLanding', { count: placed });
    tolled = -1;
    next = (Math.floor(game.runTime / B.every) + 1) * B.every;
  };

  return {
    reset() { next = B.every; tolled = -1; },
    trigger() { next = game.runTime + B.warn; tolled = -1; },
    update() {
      if (!game.director.enabled) return;
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
      if (t >= next) land();
    },
  };
}
