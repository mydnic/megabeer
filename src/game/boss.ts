import type { Zombie } from '../enemies/zombie';

/** Les boss du jeu (un contrôleur et un modèle chacun). */
export type BossKind = 'sonneur' | 'abbe';

/**
 * Ce que le jeu, l'affichage et l'interface lisent de n'importe quel boss. Son corps est un zombie de la horde
 * (les armes le visent, il encaisse et meurt comme les autres) ; son contrôleur le pilote à la place de la horde.
 */
export interface Boss {
  readonly kind: BossKind;
  readonly name: string;
  readonly zombie: Zombie;
  /** Phase en cours (1, puis 2 sous `phaseAt` de ses PV). */
  phase: number;
  readonly phaseAt: number;
  /** Animation en cours (nom du clip) et son temps (s). */
  anim: string;
  animTime: number;
  /** Taille (1 : normale ; l'Abbé grandit en phase 2). */
  scale: number;
  /** Musique (dossier de music/boss/). */
  readonly music: string;
  update(dt: number): void;
}
