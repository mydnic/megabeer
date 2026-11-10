import { ITEM_EFFECTS as E, type EffectId } from '../config/items';

const NONE = (): Record<EffectId, number> => ({
  explodeOnKill: 0, foamShield: 0, happyHour: 0, healOnXp: 0, slowOnHit: 0, freezeChance: 0, closeDamage: 0,
  eliteDamage: 0, crowdBoost: 0, extraShotChance: 0, lowHpDamage: 0, damageSpread: 0, musicWave: 0,
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
  /**
   * Mousse épaisse : une bulle par exemplaire, chacune avec sa recharge (bulles par seconde, selon sa
   * rareté), prête ou en recharge (0 à 1).
   */
  readonly shields: { rate: number; ready: boolean; charge: number }[] = [];
  /** Happy hour : temps avant la prochaine (s) et temps restant de celle en cours (s). */
  happyIn = 0;
  happyLeft = 0;
  /** Sifflet, Juke-box et Bonnet : temps avant le prochain (s). */
  whistleIn = 0;
  musicIn = 0;
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
    // Mousse épaisse : chaque exemplaire apporte sa bulle, qui arrive pleine
    if (effect === 'foamShield') this.shields.push({ rate: value, ready: true, charge: 0 });
    if (!first) return;
    // Premier exemplaire : les minuteries démarrent un cycle complet
    if (effect === 'happyHour') this.happyIn = E.happyHour.every;
    if (effect === 'whistle') this.whistleIn = E.whistle.every;
    if (effect === 'musicWave') this.musicIn = E.musicWave.every;
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

  /** Mousse épaisse : nombre de bulles prêtes. */
  get shieldsUp() { return this.shields.reduce((n, s) => n + (s.ready ? 1 : 0), 0); }

  /**
   * Une bulle absorbe un coup : renvoie true si l'une était prête. C'est celle qui se recharge le plus
   * vite qui éclate (elle reviendra la première).
   */
  absorb() {
    let best: (typeof this.shields)[number] | null = null;
    for (const s of this.shields) if (s.ready && (!best || s.rate > best.rate)) best = s;
    if (!best) return false;
    best.ready = false;
    best.charge = 0;
    return true;
  }

  /** Ardoise du bar : le coup reçu s'ajoute à l'ardoise, payée sur la durée de l'effet. */
  owe(damage: number) {
    this.owed += damage;
    this.owedRate = this.owed / this.power.damageSpread;
  }

  /** Avance les minuteries (`duration` : stat Durée) ; renvoie ce qui vient de se passer. */
  update(dt: number, duration: number) {
    let shieldUp = false, happyStart = false, happyEnd = false, whistle = false, music = false, freeChest = false;
    for (const s of this.shields) {
      if (s.ready) continue;
      s.charge += s.rate * dt;
      if (s.charge >= 1) { s.ready = true; s.charge = 0; shieldUp = true; }
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
    if (this.power.musicWave > 0 && (this.musicIn -= dt) <= 0) { this.musicIn += E.musicWave.every; music = true; }
    if (this.power.freeChest > 0 && (this.freeChestIn -= dt) <= 0) { this.freeChestIn += this.freeChestEvery; freeChest = true; }
    // Ardoise : ce qui tombe pendant ce pas
    let owedNow = 0;
    if (this.owed > 0) {
      owedNow = Math.min(this.owed, this.owedRate * dt);
      this.owed -= owedNow;
    }
    return { shieldUp, happyStart, happyEnd, whistle, music, freeChest, owedNow };
  }

  reset() {
    Object.assign(this.power, NONE());
    this.shields.length = 0;
    this.happyIn = this.happyLeft = this.whistleIn = this.musicIn = this.freeChestIn = 0;
    this.revives = 0;
    this.owed = this.owedRate = 0;
    this.crowded = false;
  }
}
