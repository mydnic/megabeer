import { PLAYER_STATS as S } from '../config/player';

/** Points de vie du joueur, avec invulnérabilité courte après chaque coup. */
export class Health {
  max: number = S.maxHp;
  hp: number = S.maxHp;
  /** Temps d'invulnérabilité restant (s). */
  invuln = 0;

  get dead() { return this.hp <= 0; }
  get ratio() { return this.hp / this.max; }

  /** Retire des PV. Renvoie false si le coup est ignoré (invulnérable ou déjà mort). */
  damage(amount: number) {
    if (this.invuln > 0 || this.dead) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invuln = S.invulnTime;
    return true;
  }

  heal(amount: number) {
    if (!this.dead) this.hp = Math.min(this.max, this.hp + amount);
  }

  reset() {
    this.hp = this.max;
    this.invuln = 0;
  }

  update(dt: number) {
    this.invuln = Math.max(0, this.invuln - dt);
  }
}
