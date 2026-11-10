import { ITEM_EFFECTS as E, type EffectId } from '../config/items';

const NONE = (): Record<EffectId, number> => ({
  explodeOnKill: 0, foamShield: 0, happyHour: 0, healOnXp: 0, slowOnHit: 0, freezeChance: 0, closeDamage: 0,
  eliteDamage: 0, crowdBoost: 0, extraShotChance: 0, lowHpDamage: 0, damageSpread: 0, levelUpWave: 0,
  standRegen: 0, whistle: 0, revive: 0, freeChest: 0, freeChestChance: 0, doubleJump: 0,
});

/**
 * Effets spéciaux des objets pris pendant la run : la puissance de chaque effet (valeurs des cartes
 * additionnées) et leurs minuteries. Le jeu les interroge à ses moments clés (ennemi touché ou tué,
 * coup reçu, XP ramassée, niveau gagné, mort) et les fait avancer à chaque pas.
 */
export class ItemEffects {
  /** Puissance de chaque effet (0 : objet absent). */
  readonly power = NONE();
  /** Mousse épaisse : bouclier prêt et recharge en cours (0 à 1). */
  shield = false;
  shieldCharge = 0;
  /** Happy hour : temps avant la prochaine (s) et temps restant de celle en cours (s). */
  happyIn = 0;
  happyLeft = 0;
  /** Sifflet et Bonnet : temps avant le prochain (s). */
  whistleIn = 0;
  freeChestIn = 0;
  /** Seconde tournée : retours à la vie restants. */
  revives = 0;
  /** Ardoise du bar : dégâts encore à encaisser, et leur rythme (PV/s). */
  owed = 0;
  owedRate = 0;
  /** Écharpe : le joueur est entouré (mis à jour par le jeu). */
  crowded = false;

  /** Ajoute un objet à effet (valeur de sa carte). */
  add(effect: EffectId, value: number) {
    const first = this.power[effect] === 0;
    this.power[effect] += value;
    // Seconde tournée : un retour à la vie par exemplaire
    if (effect === 'revive') this.revives++;
    if (!first) return;
    // Premier exemplaire : le bouclier arrive plein, les minuteries démarrent un cycle complet
    if (effect === 'foamShield') this.shield = true;
    if (effect === 'happyHour') this.happyIn = E.happyHour.every;
    if (effect === 'whistle') this.whistleIn = E.whistle.every;
    if (effect === 'freeChest') this.freeChestIn = this.freeChestEvery;
  }

  has(effect: EffectId) { return this.power[effect] > 0; }

  get explodeChance() { return Math.min(E.explodeOnKill.maxChance, this.power.explodeOnKill); }
  get healPerXp() { return this.power.healOnXp; }
  get rateMul() { return this.happyLeft > 0 ? E.happyHour.rate : 1; }
  get slow() { return Math.min(E.slowOnHit.max, this.power.slowOnHit); }
  get freezeChance() { return Math.min(E.freezeChance.max, this.power.freezeChance); }
  get extraShotChance() { return Math.min(E.extraShotChance.max, this.power.extraShotChance); }
  get freeChestChance() { return Math.min(E.freeChestChance.max, this.power.freeChestChance); }
  get freeChestEvery() { return E.freeChest.every / Math.max(1, this.power.freeChest); }

  /** Le bouclier absorbe un coup : renvoie true s'il était prêt (il repart en recharge). */
  absorb() {
    if (!this.shield) return false;
    this.shield = false;
    this.shieldCharge = 0;
    return true;
  }

  /** Ardoise du bar : le coup reçu s'ajoute à l'ardoise, payée sur la durée de l'effet. */
  owe(damage: number) {
    this.owed += damage;
    this.owedRate = this.owed / this.power.damageSpread;
  }

  /** Avance les minuteries (`duration` : stat Durée) ; renvoie ce qui vient de se passer. */
  update(dt: number, duration: number) {
    let shieldUp = false, happyStart = false, happyEnd = false, whistle = false, freeChest = false;
    if (this.power.foamShield > 0 && !this.shield) {
      this.shieldCharge += this.power.foamShield * dt;
      if (this.shieldCharge >= 1) { this.shield = true; this.shieldCharge = 0; shieldUp = true; }
    }
    if (this.power.happyHour > 0) {
      if (this.happyLeft > 0 && (this.happyLeft -= dt) <= 0) { this.happyLeft = 0; happyEnd = true; }
      if ((this.happyIn -= dt) <= 0) {
        this.happyIn += E.happyHour.every;
        this.happyLeft = this.power.happyHour * duration;
        happyStart = true;
      }
    }
    if (this.power.whistle > 0 && (this.whistleIn -= dt) <= 0) { this.whistleIn += E.whistle.every; whistle = true; }
    if (this.power.freeChest > 0 && (this.freeChestIn -= dt) <= 0) { this.freeChestIn += this.freeChestEvery; freeChest = true; }
    // Ardoise : ce qui tombe pendant ce pas
    let owedNow = 0;
    if (this.owed > 0) {
      owedNow = Math.min(this.owed, this.owedRate * dt);
      this.owed -= owedNow;
    }
    return { shieldUp, happyStart, happyEnd, whistle, freeChest, owedNow };
  }

  reset() {
    Object.assign(this.power, NONE());
    this.shield = false;
    this.shieldCharge = 0;
    this.happyIn = this.happyLeft = this.whistleIn = this.freeChestIn = 0;
    this.revives = 0;
    this.owed = this.owedRate = 0;
    this.crowded = false;
  }
}
