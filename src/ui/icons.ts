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
 * longues épaules arrondies, corps droit, grande étiquette blanche marquée « Stout » en rouge.
 */
export const stoutIcon = (cls: string) => `<svg viewBox="0 0 40 90" class="${cls}"><path d="M15 8h10v8c0 2 .6 3 .6 5c0 4 10.4 9 10.4 25v35c0 2-2 4-4 4H8c-2 0-4-2-4-4V46c0-16 10.4-21 10.4-25c0-2 .6-3 .6-5z"
 fill="#4a2c1a" stroke="#1a120c" stroke-width="3" stroke-linejoin="round"/>
<path d="M15.6 17.5h8.8" stroke="#2e1b10" stroke-width="1.2"/>
<rect x="13.5" y="3" width="13" height="6" rx="1.5" fill="#cfc4a6" stroke="#1a120c" stroke-width="2.5"/>
<rect x="5.5" y="49" width="29" height="30" fill="#f4f2ee"/><path d="M5.5 49h29M5.5 79h29" stroke="#1a120c" stroke-width="1.2"/>
<path d="M18.4 52.4h3.2l-.4 1.8c-.2.8-.8 1.2-1.2 1.2s-1-.4-1.2-1.2z M20 55.4v1.4M18.8 57h2.4" stroke="#b08a3a" stroke-width=".7" fill="#e8c76a"/>
<text x="20" y="70" text-anchor="middle" textLength="26" lengthAdjust="spacingAndGlyphs" font-family="Georgia, 'Times New Roman', serif" font-weight="900" font-size="10" fill="#c8102e">Stout</text>
<path d="M9 44c1.5-5 4-9 6.5-11.5" stroke="#fff3" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;

/** Fût qui roule : tonneau en bois bombé, douelles, deux cerclages, bonde. */
export const futIcon = (cls: string) => `<svg viewBox="0 0 40 90" class="${cls}"><path d="M8 20c4-2 20-2 24 0c3 8 4 16 4 25s-1 17-4 25c-4 2-20 2-24 0c-3-8-4-16-4-25s1-17 4-25z"
 fill="#8a5230" stroke="#1a120c" stroke-width="3" stroke-linejoin="round"/>
<path d="M14 21c-1.5 8-2 16-2 24s.5 16 2 24M20 20.5v49M26 21c1.5 8 2 16 2 24s-.5 16-2 24" stroke="#5e3519" stroke-width="1.6" fill="none"/>
<path d="M6.2 31c6-1.6 21.6-1.6 27.6 0M6.2 59c6 1.6 21.6 1.6 27.6 0" stroke="#6f7378" stroke-width="4" fill="none"/>
<path d="M6.2 31c6-1.6 21.6-1.6 27.6 0M6.2 59c6 1.6 21.6 1.6 27.6 0" stroke="#1a120c" stroke-width="1" fill="none" transform="translate(0 2.2)"/>
<ellipse cx="20" cy="20.5" rx="12" ry="2.6" fill="#a8693f" stroke="#1a120c" stroke-width="2"/>
<rect x="17.5" y="43" width="5" height="4" rx="1" fill="#3a2214"/>
<path d="M10 36c0 6 0 12 1 18" stroke="#fff3" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;

/**
 * Gueuze, d'après une bouteille de kriek lambic 25 cl : verre sombre rouge cerise, col et épaules sous
 * une feuille rouge brillante, étiquette foncée à double liseré crème, cerises, nom en crème.
 */
export const gueuzeIcon = (cls: string) => `<svg viewBox="0 0 40 90" class="${cls}"><path d="M16 4h8v20c0 5 9 9 9 17v39c0 3-2 5-5 5H12c-3 0-5-2-5-5V41c0-8 9-12 9-17z"
 fill="#3a0d12" stroke="#1a120c" stroke-width="3" stroke-linejoin="round"/>
<path d="M14.6 3.5h10.8v20.5c0 3 2 5 4 6.5L27.1 32.1L24.7 30.7L22.4 32.2L20 30.7L17.6 32.2L15.3 30.7L12.9 32.1L10.6 30.5c2-1.5 4-3.5 4-6.5z"
 fill="#d0142c" stroke="#1a120c" stroke-width="2" stroke-linejoin="round"/>
<path d="M17 8v14M21.5 7v15" stroke="#ff6a7a" stroke-width="1" opacity=".7"/>
<rect x="8.5" y="48" width="23" height="27" rx="2" fill="#2a0a0e" stroke="#e9d9b6" stroke-width="1.6"/>
<rect x="10.4" y="50" width="19.2" height="23" rx="1" fill="none" stroke="#e9d9b6" stroke-width=".6"/>
<text x="20" y="57.5" text-anchor="middle" textLength="17" lengthAdjust="spacingAndGlyphs" font-family="Georgia, 'Times New Roman', serif" font-weight="900" font-size="6.2" fill="#f1e4c4">Gueuze</text>
<path d="M18.4 61.4c.6-1.2 1.4-1.8 2.6-2.1M21 59.3c.4 1.2 1 2 2 2.4" stroke="#3f7a2a" stroke-width=".9" fill="none"/>
<circle cx="18.2" cy="63.4" r="2.1" fill="#c8102e"/><circle cx="22.8" cy="63.6" r="2.1" fill="#c8102e"/>
<circle cx="17.6" cy="62.7" r=".6" fill="#ff9aa6"/><circle cx="22.2" cy="62.9" r=".6" fill="#ff9aa6"/>
<path d="M13 69h14" stroke="#e9d9b6" stroke-width=".7"/>
<path d="M10.5 36c-.5 6-.5 8 0 10" stroke="#fff3" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`;

/** Pompe à bière : fût couché sur son chevalet, cerclages de la couleur de la pompe, robinet qui coule. */
export const pumpIcon = (cls: string, hoop: number) => {
  const c = `#${hoop.toString(16).padStart(6, '0')}`;
  return `<svg viewBox="0 0 40 90" class="${cls}"><path d="M8 62l-3 18M32 62l3 18M10 70h20" stroke="#5e3519" stroke-width="3.5" stroke-linecap="round"/>
<ellipse cx="20" cy="48" rx="15" ry="14" fill="#8a5230" stroke="#1a120c" stroke-width="3"/>
<ellipse cx="20" cy="48" rx="9" ry="8.5" fill="#a8693f" stroke="#1a120c" stroke-width="2"/>
<ellipse cx="20" cy="48" rx="13" ry="12" fill="none" stroke="${c}" stroke-width="2.6"/>
<rect x="17" y="53" width="6" height="5" rx="1" fill="${c}" stroke="#1a120c" stroke-width="1.5"/>
<path d="M20 58v8" stroke="#f2c14e" stroke-width="2.4" stroke-linecap="round"/>
<path d="M10 40c2-3 4-5 7-6" stroke="#fff4" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`;
};

/** Icône de chaque arme (ajouter une arme = ajouter son icône ici). */
const WEAPON_ICONS: Record<WeaponId, (cls: string) => string> = {
  canette: canetteIcon,
  stout: stoutIcon,
  fut: futIcon,
  gueuze: gueuzeIcon,
};

export const weaponIcon = (id: WeaponId, cls: string) => WEAPON_ICONS[id](cls);
