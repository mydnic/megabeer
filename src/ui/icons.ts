import type { WeaponId } from '../weapons/weapon';

/** Icônes SVG partagées par l'interface (cartes de level-up, HUD, pause). */

/** Bouteille de Blonde. */
export const blondeIcon = (cls: string) => `<svg viewBox="0 0 40 90" class="${cls}"><path d="M15 4h10v18c0 4 9 9 9 20v40c0 4-3 6-7 6H13c-4 0-7-2-7-6V42c0-11 9-16 9-20z"
 fill="#b85f16" stroke="#1a120c" stroke-width="3" stroke-linejoin="round"/><rect x="13" y="1" width="14" height="7" rx="2" fill="#e2bd52" stroke="#1a120c" stroke-width="3"/>
<rect x="8" y="48" width="24" height="20" rx="3" fill="#f6d77e" stroke="#1a120c" stroke-width="2.5"/><path d="M11 30c3-3 5-5 5-9" stroke="#fff3" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;

/** Bouteille de Stout : trapue, verre noir, étiquette crème, bouchon de liège. */
export const stoutIcon = (cls: string) => `<svg viewBox="0 0 40 90" class="${cls}"><path d="M14 16h12v10c0 4 11 8 11 20v34c0 4-3 6-7 6H10c-4 0-7-2-7-6V46c0-12 11-16 11-20z"
 fill="#2a1c14" stroke="#1a120c" stroke-width="3" stroke-linejoin="round"/><rect x="12" y="8" width="16" height="10" rx="2" fill="#b08a5a" stroke="#1a120c" stroke-width="3"/>
<rect x="7" y="50" width="26" height="22" rx="3" fill="#eadcbc" stroke="#1a120c" stroke-width="2.5"/><path d="M10 36c3-3 6-5 6-9" stroke="#fff3" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;

/** Icône de chaque arme (ajouter une arme = ajouter son icône ici). */
const WEAPON_ICONS: Record<WeaponId, (cls: string) => string> = {
  blonde: blondeIcon,
  stout: stoutIcon,
};

export const weaponIcon = (id: WeaponId, cls: string) => WEAPON_ICONS[id](cls);
