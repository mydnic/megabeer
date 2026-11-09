import type { WeaponId } from '../weapons/weapon';

/** Icônes SVG partagées par l'interface (cartes de level-up, HUD, pause). */

/** Bouteille de Blonde, façon Jupiler : col long qui s'évase doucement, corps droit, étiquette rouge au ventre et au col. */
export const blondeIcon = (cls: string) => `<svg viewBox="0 0 40 90" class="${cls}"><path d="M16 8h8v20c0 6 9 10 9 18v36c0 3-2 5-5 5H12c-3 0-5-2-5-5V46c0-8 9-12 9-18z"
 fill="#9a5214" stroke="#1a120c" stroke-width="3" stroke-linejoin="round"/><rect x="14" y="3" width="12" height="7" rx="2" fill="#e2bd52" stroke="#1a120c" stroke-width="3"/>
<rect x="15" y="19" width="10" height="7" rx="1.5" fill="#c8102e" stroke="#1a120c" stroke-width="2"/>
<rect x="8" y="53" width="24" height="20" rx="3" fill="#c8102e" stroke="#1a120c" stroke-width="2.5"/><rect x="10" y="60" width="20" height="5" fill="#f4e6c8"/>
<path d="M11 44c2-4 5-7 7-9" stroke="#fff3" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;

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
