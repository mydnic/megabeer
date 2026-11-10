import { PLAYER_STATS } from '../config/player';
import { XP_DROPS } from '../config/xp';
import { ITEM_STAT_CAPS } from '../config/items';

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
 * perso. Les armes les lisent (cadence, projectiles en plus, critique, taille...).
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
  /** Chances de critique ajoutées (0,04 = +4 points) et dégâts critiques ajoutés (au multiplicateur). */
  critChance!: number;
  critDamage!: number;
  /** Taille des explosions et des ondes (x1 au départ, +0,1 = +10 %). */
  size!: number;
  /** Durée des effets (gel, ralenti, étourdissement, happy hour, sonné). */
  duration!: number;
  /** PV rendus par seconde. */
  regen!: number;
  /** PV retirés de chaque coup reçu. */
  armor!: number;
  /** Chance d'esquiver un coup (0 à 1). */
  dodge!: number;
  /** Recul des ennemis touchés (x1 au départ). */
  knockback!: number;
  /** Part des dégâts infligés rendue en PV. */
  lifeSteal!: number;
  /** Capsules gagnées (x1 au départ). */
  coinGain!: number;
  /** Vitesse de remplissage des pompes à bière (x1 au départ). */
  pumpSpeed!: number;
  /** Réduction du prix des coffres (0 à 1). */
  chestDiscount!: number;
  /** Hauteur de saut ajoutée (-0,2 = saut 20 % moins haut). */
  jumpHeight!: number;
  /** Cochonnet : chance qu'une volée ait un projectile de plus (posée par le jeu). */
  extraShotChance!: number;
  /** Hasard (le jeu y branche le sien, réglable dans les tests). */
  random: () => number = Math.random;

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
    this.critChance = 0;
    this.critDamage = 0;
    this.size = 1;
    this.duration = 1;
    this.regen = 0;
    this.armor = 0;
    this.dodge = 0;
    this.knockback = 1;
    this.lifeSteal = 0;
    this.coinGain = 1;
    this.pumpSpeed = 1;
    this.chestDiscount = 0;
    this.jumpHeight = 0;
    this.extraShotChance = 0;
  }

  /** Cadence effective des armes : vitesse d'attaque et effets passagers. Les armes lisent celle-ci. */
  get fireRate() { return this.attackSpeed * this.rateMul; }

  /** Projectiles en plus pour une volée : la stat, et parfois un de plus (Cochonnet). Une fois par volée. */
  volleyBonus() { return this.extraProjectiles + (this.extraShotChance > 0 && this.random() < this.extraShotChance ? 1 : 0); }

  /** Stats plafonnées (esquive, réduction des coffres, vol de vie). */
  get dodgeChance() { return Math.min(ITEM_STAT_CAPS.dodge, this.dodge); }
  get discount() { return Math.min(ITEM_STAT_CAPS.chestDiscount, this.chestDiscount); }
  get steal() { return Math.min(ITEM_STAT_CAPS.lifeSteal, this.lifeSteal); }

  /** Lignes de stats pour l'écran de pause (les stats d'objets n'apparaissent qu'une fois gagnées). */
  lines(): StatLine[] {
    const lines: StatLine[] = [
      { label: 'Dégâts', value: this.damage, unit: 'mult', bonus: this.damage - 1, bonusKind: 'percent' },
      { label: 'Vitesse', value: this.moveSpeed, unit: 'mult', bonus: this.moveSpeed - 1, bonusKind: 'percent' },
      { label: "Vitesse d'attaque", value: this.attackSpeed, unit: 'mult', bonus: this.attackSpeed - PLAYER_STATS.attackSpeed, bonusKind: 'percent' },
      { label: 'Projectiles en plus', value: this.extraProjectiles, unit: 'count', bonus: this.extraProjectiles - PLAYER_STATS.extraProjectiles, bonusKind: 'plus' },
      { label: "Portée d'attraction", value: this.pickupRange, unit: 'meters', bonus: this.pickupRange / XP_DROPS.pickupRange - 1, bonusKind: 'percent' },
      { label: "Gain d'XP", value: this.xpGain, unit: 'mult', bonus: this.xpGain - 1, bonusKind: 'percent' },
      { label: 'Chance', value: this.luck, unit: 'count', bonus: this.luck, bonusKind: 'plus' },
    ];
    const extra: [string, number, StatUnit, number][] = [
      ['Critique', this.critChance, 'percent', this.critChance],
      ['Dégâts critiques', this.critDamage, 'number', this.critDamage],
      ['Taille', this.size, 'mult', this.size - 1],
      ['Durée', this.duration, 'mult', this.duration - 1],
      ['Régénération', this.regen, 'perSecond', this.regen],
      ['Armure', this.armor, 'number', this.armor],
      ['Esquive', this.dodgeChance, 'percent', this.dodgeChance],
      ['Recul', this.knockback, 'mult', this.knockback - 1],
      ['Vol de vie', this.steal, 'percent', this.steal],
      ['Capsules', this.coinGain, 'mult', this.coinGain - 1],
      ['Remplissage des pompes', this.pumpSpeed, 'mult', this.pumpSpeed - 1],
      ['Prix des coffres', -this.discount, 'percent', -this.discount],
      ['Saut', 1 + this.jumpHeight, 'mult', this.jumpHeight],
    ];
    for (const [label, value, unit, bonus] of extra) {
      if (Math.abs(bonus) < 1e-6) continue;
      const pct = unit === 'mult' || unit === 'percent';
      lines.push({ label, value, unit, bonus, bonusKind: pct ? 'percent' : 'plus' });
    }
    return lines;
  }
}
