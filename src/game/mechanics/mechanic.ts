import type { Game } from '../game';
import { createAbbeyBells } from './abbeyBells';

/**
 * Mécanique propre à une map (GDD section 13) : les cloches de l'Abbaye, les cuves de la Brasserie,
 * le feu d'artifice de la Fête de village. Elle avance avec le temps de run et agit sur le jeu.
 */
export interface MapMechanic {
  /** Appelé à chaque pas de jeu en run (joueur au sol, jeu non figé). */
  update(dt: number): void;
  /** Nouvelle run. */
  reset(): void;
  /** Déclenche l'événement tout de suite (outils de dev). */
  trigger(): void;
}

/** Une mécanique par map. Ajouter une map = une entrée ici. */
export const MAP_MECHANICS = {
  abbaye: createAbbeyBells,
} satisfies Record<string, (game: Game) => MapMechanic>;

export type MapId = keyof typeof MAP_MECHANICS;
