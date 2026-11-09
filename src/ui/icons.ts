import type { WeaponId } from '../weapons/weapon';

/** Icônes SVG partagées par l'interface (cartes de level-up, HUD, pause). */

/** Canette de bière en métal : couvercle et fond argentés, corps rouge, reflet sur le flanc. */
export const canetteIcon = (cls: string) => `<svg viewBox="0 0 40 90" class="${cls}"><path d="M9 20c0-3 3-5 6-5h10c3 0 6 2 6 5v52c0 3-3 5-6 5H15c-3 0-6-2-6-5z"
 fill="#c8102e" stroke="#1a120c" stroke-width="3" stroke-linejoin="round"/><path d="M11 15c0-3 3-5 6-5h6c3 0 6 2 6 5v5H11z" fill="#c8ccd2" stroke="#1a120c" stroke-width="3" stroke-linejoin="round"/>
<path d="M9 72h22v3c0 3-3 5-6 5H15c-3 0-6-2-6-5z" fill="#c8ccd2" stroke="#1a120c" stroke-width="3" stroke-linejoin="round"/>
<path d="M14 28v38" stroke="#fff5" stroke-width="3" stroke-linecap="round"/></svg>`;

/** Bouteille de Stout, façon Duvel : col court, ventre bombé, fond resserré, verre brun stout, étiquette ovale. */
export const stoutIcon = (cls: string) => `<svg viewBox="0 0 40 90" class="${cls}"><path d="M15 9h10v11c0 5 13 12 13 32c0 14-3 26-7 32c-1 2-3 3-5 3H14c-2 0-4-1-5-3c-4-6-7-18-7-32c0-20 13-27 13-32z"
 fill="#4a2c1a" stroke="#1a120c" stroke-width="3" stroke-linejoin="round"/><rect x="13" y="3" width="14" height="8" rx="2" fill="#c9a24a" stroke="#1a120c" stroke-width="3"/>
<ellipse cx="20" cy="57" rx="12.5" ry="10" fill="#eadcbc" stroke="#1a120c" stroke-width="2.5"/><path d="M9 38c2-5 5-9 8-11" stroke="#fff3" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;

/** Icône de chaque arme (ajouter une arme = ajouter son icône ici). */
const WEAPON_ICONS: Record<WeaponId, (cls: string) => string> = {
  canette: canetteIcon,
  stout: stoutIcon,
};

export const weaponIcon = (id: WeaponId, cls: string) => WEAPON_ICONS[id](cls);
