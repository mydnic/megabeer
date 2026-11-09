import type { WeaponId } from '../weapons/weapon';

/** Icônes SVG partagées par l'interface (cartes de level-up, HUD, pause). */

/** Bouteille de Blonde. */
export const blondeIcon = (cls: string) => `<svg viewBox="0 0 40 90" class="${cls}"><path d="M15 4h10v18c0 4 9 9 9 20v40c0 4-3 6-7 6H13c-4 0-7-2-7-6V42c0-11 9-16 9-20z"
 fill="#b85f16" stroke="#1a120c" stroke-width="3" stroke-linejoin="round"/><rect x="13" y="1" width="14" height="7" rx="2" fill="#e2bd52" stroke="#1a120c" stroke-width="3"/>
<rect x="8" y="48" width="24" height="20" rx="3" fill="#f6d77e" stroke="#1a120c" stroke-width="2.5"/><path d="M11 30c3-3 5-5 5-9" stroke="#fff3" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;

/** Bouteille de Stout, façon Duvel : col court, ventre bombé, fond resserré, verre brun stout, étiquette ovale. */
export const stoutIcon = (cls: string) => `<svg viewBox="0 0 40 90" class="${cls}"><path d="M15 9h10v11c0 5 13 12 13 32c0 14-3 26-7 32c-1 2-3 3-5 3H14c-2 0-4-1-5-3c-4-6-7-18-7-32c0-20 13-27 13-32z"
 fill="#4a2c1a" stroke="#1a120c" stroke-width="3" stroke-linejoin="round"/><rect x="13" y="3" width="14" height="8" rx="2" fill="#c9a24a" stroke="#1a120c" stroke-width="3"/>
<ellipse cx="20" cy="57" rx="12.5" ry="10" fill="#eadcbc" stroke="#1a120c" stroke-width="2.5"/><path d="M9 38c2-5 5-9 8-11" stroke="#fff3" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;

/** Icône de chaque arme (ajouter une arme = ajouter son icône ici). */
const WEAPON_ICONS: Record<WeaponId, (cls: string) => string> = {
  blonde: blondeIcon,
  stout: stoutIcon,
};

export const weaponIcon = (id: WeaponId, cls: string) => WEAPON_ICONS[id](cls);
