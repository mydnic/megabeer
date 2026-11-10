import { ITEM_EFFECTS as E, type EffectId } from '../config/items';

/**
 * Effets spéciaux des objets pris pendant la run : la puissance de chaque effet (valeurs des cartes
 * additionnées) et leurs minuteries (bouclier de mousse, happy hour). Le jeu les interroge à ses
 * moments clés (ennemi tué, coup reçu, XP ramassée) et les fait avancer à chaque pas.
 */
export class ItemEffects {
  private power: Record<EffectId, number> = { explodeOnKill: 0, foamShield: 0, happyHour: 0, healOnXp: 0 };
  /** Mousse épaisse : bouclier prêt (absorbe le prochain coup) et recharge en cours (0 à 1). */
  shield = false;
  shieldCharge = 0;
  /** Happy hour : temps avant la prochaine (s) et temps restant de celle en cours (s). */
  happyIn = 0;
  happyLeft = 0;

  /** Ajoute un objet à effet (sa valeur de carte). Renvoie ce qui démarre tout de suite. */
  add(effect: EffectId, value: number) {
    const first = this.power[effect] === 0;
    this.power[effect] += value;
    // Premier exemplaire : le bouclier arrive plein, la première happy hour démarre au prochain cycle
    if (effect === 'foamShield' && first) this.shield = true;
    if (effect === 'happyHour' && first) this.happyIn = E.happyHour.every;
  }

  has(effect: EffectId) { return this.power[effect] > 0; }

  /** Chance qu'un ennemi tué explose (Cendrier). */
  get explodeChance() { return Math.min(E.explodeOnKill.maxChance, this.power.explodeOnKill); }
  /** PV soignés par goutte d'XP (Sachet de cacahuètes). */
  get healPerXp() { return this.power.healOnXp; }
  /** Multiplicateur de la vitesse d'attaque (Happy hour en cours). */
  get rateMul() { return this.happyLeft > 0 ? E.happyHour.rate : 1; }

  /** Le bouclier absorbe un coup : renvoie true s'il était prêt (il repart en recharge). */
  absorb() {
    if (!this.shield) return false;
    this.shield = false;
    this.shieldCharge = 0;
    return true;
  }

  /** Avance les minuteries ; renvoie ce qui vient de se passer pour que le jeu l'annonce. */
  update(dt: number) {
    let shieldUp = false, happyStart = false, happyEnd = false;
    if (this.power.foamShield > 0 && !this.shield) {
      this.shieldCharge += this.power.foamShield * dt;
      if (this.shieldCharge >= 1) { this.shield = true; this.shieldCharge = 0; shieldUp = true; }
    }
    if (this.power.happyHour > 0) {
      if (this.happyLeft > 0 && (this.happyLeft -= dt) <= 0) { this.happyLeft = 0; happyEnd = true; }
      if ((this.happyIn -= dt) <= 0) {
        this.happyIn += E.happyHour.every;
        this.happyLeft = this.power.happyHour;
        happyStart = true;
      }
    }
    return { shieldUp, happyStart, happyEnd };
  }

  reset() {
    for (const k of Object.keys(this.power) as EffectId[]) this.power[k] = 0;
    this.shield = false;
    this.shieldCharge = 0;
    this.happyIn = 0;
    this.happyLeft = 0;
  }
}
