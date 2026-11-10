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
  /** Multiplicateur global des dégâts des armes (stat Dégâts). */
  damage!: number;
  /** Multiplicateur de la vitesse de déplacement (stat Vitesse). */
  moveSpeed!: number;
  attackSpeed!: number;
  /** Multiplicateur passager de la cadence (Happy hour), posé par le jeu à chaque pas. */
  rateMul!: number;
  extraProjectiles!: number;
  pickupRange!: number;
  xpGain!: number;
  luck!: number;

  constructor() { this.reset(); }

  /** Revient aux valeurs de départ (nouvelle run). */
  reset() {
    this.damage = 1;
    this.moveSpeed = 1;
    this.attackSpeed = PLAYER_STATS.attackSpeed;
    this.rateMul = 1;
    this.extraProjectiles = PLAYER_STATS.extraProjectiles;
    this.pickupRange = XP_DROPS.pickupRange;
    this.xpGain = 1;
    this.luck = 0;
  }

  /** Cadence effective des armes : vitesse d'attaque et effets passagers. Les armes lisent celle-ci. */
  get fireRate() { return this.attackSpeed * this.rateMul; }

  /** Lignes de stats pour l'écran de pause. */
  lines(): StatLine[] {
    return [
      { label: 'Dégâts', value: this.damage, unit: 'mult', bonus: this.damage - 1, bonusKind: 'percent' },
      { label: 'Vitesse', value: this.moveSpeed, unit: 'mult', bonus: this.moveSpeed - 1, bonusKind: 'percent' },
      { label: "Vitesse d'attaque", value: this.attackSpeed, unit: 'mult', bonus: this.attackSpeed - PLAYER_STATS.attackSpeed, bonusKind: 'percent' },
      { label: 'Projectiles en plus', value: this.extraProjectiles, unit: 'count', bonus: this.extraProjectiles - PLAYER_STATS.extraProjectiles, bonusKind: 'plus' },
      { label: "Portée d'attraction", value: this.pickupRange, unit: 'meters', bonus: this.pickupRange / XP_DROPS.pickupRange - 1, bonusKind: 'percent' },
      { label: "Gain d'XP", value: this.xpGain, unit: 'mult', bonus: this.xpGain - 1, bonusKind: 'percent' },
      { label: 'Chance', value: this.luck, unit: 'count', bonus: this.luck, bonusKind: 'plus' },
    ];
  }
}
