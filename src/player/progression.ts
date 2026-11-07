import { LEVELS } from '../config/xp';

/** XP et niveau, présentés comme l'alcoolémie et le degré (GDD section 9). */
export class Progression {
  level = 1;
  xp = 0;
  next: number = LEVELS.first;
  /** Degrés gagnés pas encore choisis (écrans de level-up à enchaîner). */
  pending = 0;

  /** Ajoute de l'XP ; renvoie le nombre de degrés gagnés. */
  add(amount: number) {
    this.xp += amount;
    let gained = 0;
    while (this.xp >= this.next) {
      this.xp -= this.next;
      this.level++;
      gained++;
      this.next = Math.round(this.next * LEVELS.mult + LEVELS.add);
    }
    this.pending += gained;
    return gained;
  }

  get ratio() { return this.xp / this.next; }

  reset() {
    this.level = 1;
    this.xp = 0;
    this.next = LEVELS.first;
    this.pending = 0;
  }
}
