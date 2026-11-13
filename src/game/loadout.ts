import { WEAPON_HUD } from '../config/hud';
import { WEAPON_FACTORIES } from '../weapons/registry';
import type { Weapon, WeaponContext, WeaponId } from '../weapons/weapon';

/**
 * Armes équipées pendant la run, dans l'ordre d'obtention : 4 au maximum (GDD section 6), l'arme de
 * départ du perso compte dans les 4.
 */
export class Loadout {
  readonly weapons: Weapon[] = [];
  readonly max: number = WEAPON_HUD.slots;

  constructor(private ctx: WeaponContext, private starting: WeaponId) {
    this.reset();
  }

  /** Change à chaque fois que l'arsenal change (pour ce qui en dépend : synergies actives). */
  version = 0;

  get full() { return this.weapons.length >= this.max; }

  has(id: WeaponId) { return this.weapons.some((w) => w.id === id); }

  /** Équipe une nouvelle arme ; renvoie null si l'arsenal est plein ou si elle est déjà là. */
  add(id: WeaponId): Weapon | null {
    if (this.full || this.has(id)) return null;
    const w = WEAPON_FACTORIES[id](this.ctx);
    this.weapons.push(w);
    this.version++;
    return w;
  }

  /** Arme de départ des prochaines runs (celle du perso choisi). */
  setStarting(id: WeaponId) { this.starting = id; }

  /** Nouvelle run : seule l'arme de départ, sans amélioration. */
  reset() {
    this.weapons.length = 0;
    this.version++;
    this.add(this.starting);
  }

  /** Attaque de toutes les armes. */
  update(dt: number) { for (const w of this.weapons) w.update(dt); }

  /** Vol des projectiles de toutes les armes. */
  updateProjectiles(dt: number) { for (const w of this.weapons) w.updateProjectiles(dt); }
}
