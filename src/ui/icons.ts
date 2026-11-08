import type { WeaponId } from '../weapons/weapon';

/** Icônes SVG partagées par l'interface (cartes de level-up, HUD, pause). */

/** Bouteille de Blonde. */
export const blondeIcon = (cls: string) => `<svg viewBox="0 0 40 90" class="${cls}"><path d="M15 4h10v18c0 4 9 9 9 20v40c0 4-3 6-7 6H13c-4 0-7-2-7-6V42c0-11 9-16 9-20z"
 fill="#b85f16" stroke="#1a120c" stroke-width="3" stroke-linejoin="round"/><rect x="13" y="1" width="14" height="7" rx="2" fill="#e2bd52" stroke="#1a120c" stroke-width="3"/>
<rect x="8" y="48" width="24" height="20" rx="3" fill="#f6d77e" stroke="#1a120c" stroke-width="2.5"/><path d="M11 30c3-3 5-5 5-9" stroke="#fff3" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;

/** Icône de chaque arme (ajouter une arme = ajouter son icône ici). */
const WEAPON_ICONS: Record<WeaponId, (cls: string) => string> = {
  blonde: blondeIcon,
};

export const weaponIcon = (id: WeaponId, cls: string) => WEAPON_ICONS[id](cls);
