import { PLAYER_STATS } from '../config/player';
import { XP_DROPS } from '../config/xp';

/** Une stat affichable : valeur effective, unité, et bonus gagné pendant la run (formaté par l'interface). */
export type StatLine = {
  label: string;
  value: number;
  unit: StatUnit;
  /** Bonus par rapport à la base : en fraction (percent) ou en valeur ajoutée (plus). */
  bonus: number;
  bonusKind: 'percent' | 'plus';
};
export type StatUnit = 'count' | 'mult' | 'perSecond' | 'meters' | 'speed' | 'percent' | 'number';

/**
 * Stats du joueur modifiables pendant une run (cartes, objets, skill tree) : départ = valeurs du
 * perso. Les armes les lisent (vitesse d'attaque, projectiles en plus...).
 */
export class PlayerStats {
  attackSpeed!: number;
  extraProjectiles!: number;
  pickupRange!: number;
  xpGain!: number;
  luck!: number;

  constructor() { this.reset(); }

  /** Revient aux valeurs de départ (nouvelle run). */
  reset() {
    this.attackSpeed = PLAYER_STATS.attackSpeed;
    this.extraProjectiles = PLAYER_STATS.extraProjectiles;
    this.pickupRange = XP_DROPS.pickupRange;
    this.xpGain = 1;
    this.luck = 0;
  }

  /** Lignes de stats pour l'écran de pause. */
  lines(): StatLine[] {
    return [
      { label: "Vitesse d'attaque", value: this.attackSpeed, unit: 'mult', bonus: this.attackSpeed - PLAYER_STATS.attackSpeed, bonusKind: 'percent' },
      { label: 'Projectiles en plus', value: this.extraProjectiles, unit: 'count', bonus: this.extraProjectiles - PLAYER_STATS.extraProjectiles, bonusKind: 'plus' },
      { label: 'Ramassage', value: this.pickupRange, unit: 'meters', bonus: this.pickupRange / XP_DROPS.pickupRange - 1, bonusKind: 'percent' },
      { label: "Gain d'XP", value: this.xpGain, unit: 'mult', bonus: this.xpGain - 1, bonusKind: 'percent' },
      { label: 'Chance', value: this.luck, unit: 'count', bonus: this.luck, bonusKind: 'plus' },
    ];
  }
}
