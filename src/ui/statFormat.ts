import type { StatLine } from '../game/playerStats';
import type { StatRow } from './pauseMenu';

/** Nombre à la française : virgule décimale, `dec` décimales au plus. */
export const fmt = (n: number, dec = 1) => n.toLocaleString('fr', { maximumFractionDigits: dec });

/** Valeur affichée selon l'unité de la stat. */
export function formatValue(l: StatLine) {
  switch (l.unit) {
    case 'mult': return `x${fmt(l.value, 2)}`;
    case 'perSecond': return `${fmt(l.value, 2)} / s`;
    case 'meters': return `${fmt(l.value)} m`;
    case 'speed': return `${fmt(l.value)} m/s`;
    case 'percent': return `${fmt(l.value * 100, l.value < 2 ? 1 : 0)} %`;
    case 'count': return String(Math.round(l.value));
    default: return fmt(l.value);
  }
}

/** Bonus affiché ("+30 %", "+1", "+0,15") ; vide sans bonus. */
export function formatBonus(l: StatLine) {
  if (l.bonusKind === 'percent') return Math.abs(l.bonus) < 0.005 ? '' : `${l.bonus > 0 ? '+' : ''}${Math.round(l.bonus * 100)} %`;
  return l.bonus ? `+${fmt(l.bonus, 2)}` : '';
}

/** Ligne prête pour l'écran de pause : libellé, valeur, bonus. */
export const toRow = (l: StatLine): StatRow => [l.label, formatValue(l), formatBonus(l)];
