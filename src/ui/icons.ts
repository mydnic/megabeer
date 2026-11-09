import type { WeaponId } from '../weapons/weapon';

/** Icônes SVG partagées par l'interface (cartes de level-up, HUD, pause). */

/**
 * Canette de bière façon Jupiler 33cl : haut blanc argenté, grande vague rouge en diagonale, écusson
 * rouge bordé de blanc avec la tête de taureau noire, nom en blanc gras, couvercle et fond en métal.
 */
export const canetteIcon = (cls: string) => `<svg viewBox="0 0 40 90" class="${cls}"><path d="M4 18c0-2 2-4 4-4h24c2 0 4 2 4 4v58c0 2-2 4-4 4H8c-2 0-4-2-4-4z"
 fill="#d0142c" stroke="#1a120c" stroke-width="3" stroke-linejoin="round"/>
<path d="M5.5 17H34.5V30L5.5 47z" fill="#f2f3f4"/><path d="M5.5 47L34.5 30V36L5.5 53z" fill="#9c1020"/>
<path d="M5.5 54.2L34.5 37.2" stroke="#fff" stroke-width=".9"/>
<path d="M24 30c1-3 0-6-2-8c-1.2-1.4.2-3.4 1.8-2.4c1 .6.6 2-.4 1.6" stroke="#1a120c" stroke-width="1.3" fill="none" stroke-linecap="round"/>
<path d="M12 23.5c5 0 8-1.2 8-1.2s3 1.2 8 1.2v8c0 7-4 11-8 13.5c-4-2.5-8-6.5-8-13.5z" fill="#d0142c" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>
<path d="M16 30c2-1.5 6-1.8 8.5-.2c1.2.8 1.3 2.6.6 4l-.9 2.2l.8 3.2h-1.8l-1-2.6h-3.4l-1 2.8h-1.8l.4-3.2c-.9-.2-1.6-.6-2-1.2l-1.6 1.6c-.8.6-1.8.2-1.8-.8l.6-2.6c.4-1.6 1.4-2.6 2.6-3.2z" fill="#1a120c"/>
<path d="M14.8 32.2c-1.2-.8-1.8-2-1.4-3.2" stroke="#1a120c" stroke-width="1.3" fill="none" stroke-linecap="round"/>
<text x="20" y="60" text-anchor="middle" textLength="27" lengthAdjust="spacingAndGlyphs" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="8.5" fill="#fff">Jupiler</text>
<text x="20" y="66" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="3.6" letter-spacing=".4" fill="#e8c76a">PILS</text>
<path d="M8 9.5c0-1 1-2 2-2h20c1 0 2 1 2 2V14H8z" fill="#c8ccd2" stroke="#1a120c" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M5.5 76h29c0 1.5-1 3-2.5 3H8c-1.5 0-2.5-1.5-2.5-3z" fill="#c8ccd2"/></svg>`;

/**
 * Bouteille de Stout calquée sur la Duvel 33cl, en verre brun stout : capsule, col qui s'élargit,
 * longues épaules arrondies, corps droit, grande étiquette blanche (« Duvel » rouge, « STOUT »).
 */
export const stoutIcon = (cls: string) => `<svg viewBox="0 0 40 90" class="${cls}"><path d="M15 8h10v8c0 2 .6 3 .6 5c0 4 10.4 9 10.4 25v35c0 2-2 4-4 4H8c-2 0-4-2-4-4V46c0-16 10.4-21 10.4-25c0-2 .6-3 .6-5z"
 fill="#4a2c1a" stroke="#1a120c" stroke-width="3" stroke-linejoin="round"/>
<path d="M15.6 17.5h8.8" stroke="#2e1b10" stroke-width="1.2"/>
<rect x="13.5" y="3" width="13" height="6" rx="1.5" fill="#cfc4a6" stroke="#1a120c" stroke-width="2.5"/>
<rect x="5.5" y="49" width="29" height="30" fill="#f4f2ee"/><path d="M5.5 49h29M5.5 79h29" stroke="#1a120c" stroke-width="1.2"/>
<path d="M18.4 52.4h3.2l-.4 1.8c-.2.8-.8 1.2-1.2 1.2s-1-.4-1.2-1.2z M20 55.4v1.4M18.8 57h2.4" stroke="#b08a3a" stroke-width=".7" fill="#e8c76a"/>
<text x="20" y="67.5" text-anchor="middle" textLength="26" lengthAdjust="spacingAndGlyphs" font-family="Georgia, 'Times New Roman', serif" font-weight="900" font-size="10" fill="#c8102e">Duvel</text>
<text x="20" y="74" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="4.2" letter-spacing=".7" fill="#1a120c">STOUT</text>
<path d="M9 44c1.5-5 4-9 6.5-11.5" stroke="#fff3" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;

/** Icône de chaque arme (ajouter une arme = ajouter son icône ici). */
const WEAPON_ICONS: Record<WeaponId, (cls: string) => string> = {
  canette: canetteIcon,
  stout: stoutIcon,
};

export const weaponIcon = (id: WeaponId, cls: string) => WEAPON_ICONS[id](cls);
