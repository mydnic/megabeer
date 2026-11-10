import type { WeaponId } from '../weapons/weapon';
import type { ItemId } from '../config/items';

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

/**
 * Pompe à bière, de profil : une tireuse (colonne chromée, bec, poignée de la couleur de la pompe) qui
 * remplit une pinte posée sur l'égouttoir ; filet de bière, pinte à moitié pleine avec sa mousse.
 */
export const pumpIcon = (cls: string, handle: number) => {
  const c = `#${handle.toString(16).padStart(6, '0')}`;
  return `<svg viewBox="0 0 40 90" class="${cls}">
<rect x="1.5" y="80" width="37" height="6" rx="2" fill="#5a5f66" stroke="#1a120c" stroke-width="2.5"/>
<path d="M5 80V18c0-2 1.5-3.5 3.5-3.5h20c2 0 3.5 1.5 3.5 3.5v6h-4v-4H11v60z" fill="#c8ccd2" stroke="#1a120c" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M8 22v54" stroke="#fff8" stroke-width="2" stroke-linecap="round"/>
<path d="M14.5 14.5l-1.5-11c0-1 .8-1.8 1.8-1.8h4.4c1 0 1.8.8 1.8 1.8l-1.5 11z" fill="${c}" stroke="#1a120c" stroke-width="2" stroke-linejoin="round"/>
<path d="M30 28v29" stroke="#e8a01c" stroke-width="2.4" stroke-linecap="round"/>
<path d="M19 48h22l-2.4 32H21.4z" fill="rgba(255,255,255,.22)"/>
<path d="M19.9 60h20.2l-1.5 20H21.4z" fill="#e8a01c"/>
<path d="M19.6 56h20.8l-.3 4.5H19.9z" fill="#fff4dc"/>
<circle cx="25" cy="70" r="1.1" fill="#fff6"/><circle cx="33" cy="74" r=".9" fill="#fff6"/><circle cx="29" cy="66" r=".8" fill="#fff6"/>
<path d="M19 48h22l-2.4 32H21.4z" fill="none" stroke="#1a120c" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M22 52l1.5 24" stroke="#fff8" stroke-width="1.6" stroke-linecap="round"/></svg>`;
};

/** Icône de chaque arme (ajouter une arme = ajouter son icône ici). */
const WEAPON_ICONS: Record<WeaponId, (cls: string) => string> = {
  canette: canetteIcon,
  stout: stoutIcon,
  fut: futIcon,
  gueuze: gueuzeIcon,
};

export const weaponIcon = (id: WeaponId, cls: string) => WEAPON_ICONS[id](cls);

/** Contour commun des icônes. */
const K = '#1a120c';

/**
 * Coffre en trois quarts : planches de chêne, ferrures rivetées, coins en fer, serrure dorée et gemme
 * de la couleur `--c` (la rareté). Fermé par défaut ; la classe `open` sur le svg cache le couvercle
 * bombé et montre l'intérieur du couvercle relevé, le dedans qui brille et le faisceau.
 * Parties animables : `ch-lid` (couvercle fermé), `ch-open` (couvercle relevé), `ch-beam`, `ch-gem`.
 */
const CHEST_CSS = `.ch .ch-open, .ch .ch-beam { opacity: 0; } .ch.open .ch-lid { opacity: 0; } .ch.open .ch-open, .ch.open .ch-beam { opacity: 1; }
.ch-open, .ch-lid { transform-box: fill-box; transform-origin: 50% 100%; }`;
let chestCss = false;
export const chestSvg = (cls: string, color?: string) => {
  if (!chestCss && typeof document !== 'undefined') {
    chestCss = true;
    const s = document.createElement('style');
    s.textContent = CHEST_CSS;
    document.head.appendChild(s);
  }
  return `<svg viewBox="0 0 124 112" class="ch ${cls}"${color ? ` style="--c:${color}"` : ''}>
<ellipse cx="60" cy="104" rx="52" ry="6" fill="${K}" opacity=".45"/>
<g class="ch-open">
<path d="M24 52L30 12h78l2 40z" fill="#5a3420" stroke="${K}" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M29 25h79M27 39h82" stroke="#43261a" stroke-width="2.5"/>
<path d="M44 12v40M94 12v40" stroke="#5c6168" stroke-width="7"/>
<path d="M24 52L30 12h78l2 40z" fill="none" stroke="${K}" stroke-width="3.5" stroke-linejoin="round"/>
</g>
<path class="ch-beam ch-ray" d="M20 56L4 -40h116L104 56z" style="fill: var(--c, #ffc93a)" fill-opacity=".3"/>
<path d="M12 58l12-6h86l-12 6z" fill="#2a1608" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>
<path class="ch-beam" d="M22 56.5l6-3h76l-6 3z" style="fill: var(--c, #ffc93a)"/>
<path d="M98 58l12-6v40l-12 8z" fill="#6a3d22" stroke="${K}" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M98 72l12-6M98 86l12-6" stroke="#4e2c18" stroke-width="2.5"/>
<path d="M104 55v41" stroke="#5c6168" stroke-width="5"/>
<path d="M98 58l12-6v40l-12 8z" fill="none" stroke="${K}" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M12 58h86v42H12z" fill="#93582f"/>
<path d="M14 72h82M14 86h82" stroke="#6e3f20" stroke-width="2.5"/>
<path d="M18 64h26M18 78h18" stroke="#fff3" stroke-width="2.5" stroke-linecap="round"/>
<path d="M30 58v42M80 58v42" stroke="#6a6e75" stroke-width="9"/>
<path d="M34.5 58v42M84.5 58v42" stroke="${K}" stroke-width="1.5" opacity=".5"/>
<path d="M14 60h8v8M96 60h-8v8M14 98h8v-8M96 98h-8v-8" stroke="#6a6e75" stroke-width="5" fill="none"/>
<g fill="#c9ccd1" stroke="${K}" stroke-width="1.2"><circle cx="30" cy="66" r="2"/><circle cx="30" cy="92" r="2"/><circle cx="80" cy="66" r="2"/><circle cx="80" cy="92" r="2"/></g>
<path d="M12 58h86v42H12z" fill="none" stroke="${K}" stroke-width="3.5" stroke-linejoin="round"/>
<g class="ch-lid">
<path d="M98 58c0-22-16-34-36-36l12-6c20 2 36 14 36 36z" fill="#6a3d22" stroke="${K}" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M104 55c0-20-14-31-30-34" stroke="#5c6168" stroke-width="5" fill="none"/>
<path d="M98 58c0-22-16-34-36-36l12-6c20 2 36 14 36 36z" fill="none" stroke="${K}" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M12 58c0-22 20-36 43-36h7c20 2 36 14 36 36z" fill="#a8683a"/>
<path d="M14 46c10 1 70 1 83 0M20 34c14 1 58 1 72 0" stroke="#7a4626" stroke-width="2.5" fill="none"/>
<path d="M30 58V30M80 58V30" stroke="#6a6e75" stroke-width="9"/>
<g fill="#c9ccd1" stroke="${K}" stroke-width="1.2"><circle cx="30" cy="40" r="2"/><circle cx="80" cy="40" r="2"/></g>
<path d="M20 44c3-8 12-14 22-16" stroke="#fff5" stroke-width="3.5" fill="none" stroke-linecap="round"/>
<path d="M12 58c0-22 20-36 43-36h7c20 2 36 14 36 36z" fill="none" stroke="${K}" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M10 54h90v6H10z" fill="#5c6168" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>
</g>
<path d="M45 54h20v24c0 4-4 7-10 7s-10-3-10-7z" fill="#e2b13c" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>
<path d="M48.5 57.5h5" stroke="#fff8" stroke-width="2.5" stroke-linecap="round"/>
<circle class="ch-gem" cx="55" cy="65" r="5.5" style="fill: var(--c, #e2453a)" stroke="${K}" stroke-width="2.5"/>
<circle cx="53.4" cy="63.4" r="1.6" fill="#fffb"/>
<path d="M55 73v6" stroke="${K}" stroke-width="3.5" stroke-linecap="round"/>
</svg>`;
};

/** Coffre fermé, gemme de la couleur `lock`. */
export const chestIcon = (cls: string, lock: number) => chestSvg(cls, `#${lock.toString(16).padStart(6, '0')}`);

const svg64 = (cls: string, body: string) => `<svg viewBox="0 0 64 64" class="${cls}">${body}</svg>`;
const PINT = (fill: string) => `fill="${fill}" stroke="${K}" stroke-width="3" stroke-linejoin="round"`;

/** Une icône par objet de coffre (ajouter un objet = ajouter son icône ici). */
const ITEM_ICONS: Record<ItemId, (cls: string) => string> = {
  // Bouteille trapue de bière forte, étiquette rouge « 12° », étincelles
  biereForte: (cls) => svg64(cls, `
<path d="M27 3h10v5H27z" fill="#d9b23a" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M27.5 8h9v9c0 3 9 6 9 15v26c0 2-2 4-4 4h-19c-2 0-4-2-4-4V32c0-9 9-12 9-15z" ${PINT('#6b2f0e')}/>
<path d="M18.5 35h27v17h-27z" fill="#d23b2a" stroke="${K}" stroke-width="2.5"/>
<text x="32" y="48.5" text-anchor="middle" font-family="Lilita One, system-ui" font-size="12" fill="#fff4dc">12°</text>
<path d="M23 27c1-3 3-5 5-6" stroke="#fff6" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<path d="M50 12l3-5M54 19l5-2M14 12l-3-5M10 19l-5-2" stroke="#ffc93a" stroke-width="2.5" stroke-linecap="round"/>`),
  // Pinte lancée à toute vitesse : traits de vitesse
  tourneeRapide: (cls) => svg64(cls, `
<path d="M3 28h12M6 38h10M3 48h12" stroke="#cdbfa6" stroke-width="3" stroke-linecap="round"/>
<g transform="rotate(12 40 36)">
<path d="M24 16h30l-3 42H27z" ${PINT('#e8a01c')}/>
<path d="M22 12c0-3 3-5 6-5 2-2 6-2 8 0 2-2 7-2 9 0 4-1 9 1 9 5 1 3-1 6-4 6H26c-3 0-5-2-4-6z" ${PINT('#fff4dc')}/>
<path d="M29 23l2 29" stroke="#fff8" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="44" cy="34" r="1.6" fill="#fff8"/><circle cx="40" cy="46" r="1.3" fill="#fff8"/></g>`),
  // Torse de profil en t-shirt trop court : le gros ventre sort devant, par-dessus la ceinture
  ventreABiere: (cls) => svg64(cls, `
<path d="M14 2h16c2 6 4 10 5 15 14 4 24 14 23 26-1 10-10 17-22 17H14z" ${PINT('#f0b48c')}/>
<path d="M14 2h16c2 6 4 10 5 15 9 3 16 8 20 15-12 4-28 4-41 1z" ${PINT('#3f7fc0')}/>
<path d="M20 8h9v22c0 3-2 5-4.5 5S20 33 20 30z" fill="#e6a47c" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M19 6h11v10H19z" fill="#3f7fc0" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M44 38c4 2 6 5 7 9" stroke="#fff7" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M52 46c-1 2 0 4 2 4" stroke="${K}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<path d="M12 53h28l-1 7H12z" ${PINT('#5a3420')}/>
<rect x="30" y="51" width="8" height="11" rx="2" fill="#e2b13c" stroke="${K}" stroke-width="2.5"/>`),
  // Godasse de cuir usée, lacets et grosse semelle
  godasses: (cls) => svg64(cls, `
<path d="M16 8h20v24c6 2 18 4 22 10v8H8V38c0-4 4-6 8-8z" ${PINT('#8a5230')}/>
<path d="M6 50h54v5c0 2-2 4-4 4H10c-2 0-4-2-4-4z" ${PINT('#3a2a20')}/>
<path d="M15 6h22v6H15z" fill="#6e3f20" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M21 17l11 4M21 23l11 4M21 29l11 4" stroke="#f3e6cf" stroke-width="2.5" stroke-linecap="round"/>
<path d="M12 41c4-2 8-2 10 0" stroke="#fff5" stroke-width="2.5" fill="none" stroke-linecap="round"/>`),
  // Aimant en fer à cheval qui attire une capsule
  aimantCapsules: (cls) => svg64(cls, `
<g transform="rotate(-35 26 26)">
<path d="M8 38V22C8 11 16 4 26 4s18 7 18 18v16H33V22c0-5-3-8-7-8s-7 3-7 8v16z" ${PINT('#d23b2a')}/>
<path d="M8 38h11v-8H8zM33 38h11v-8H33z" fill="#c9ccd1" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/></g>
<path d="M38 40c3 2 5 4 6 7M44 35c3 2 5 4 7 7" stroke="#ffc93a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<path d="M43 52l-.4 6 2-.8 2 1.5 2-1 2 1.4 2-1.2 2 1 2-1.5 1.7.8-.5-6z" fill="#a81c1c" stroke="${K}" stroke-width="2" stroke-linejoin="round"/>
<ellipse cx="52.5" cy="52" rx="9.5" ry="3.8" fill="#d42a2a" stroke="${K}" stroke-width="2"/>
<ellipse cx="52.5" cy="52" rx="5" ry="2" fill="none" stroke="#fff4dc" stroke-width="1.3"/>`),
  // Ticket de tournée : pointillés et pinte imprimée
  ticketTournee: (cls) => svg64(cls, `
<g transform="rotate(-12 32 32)">
<path d="M4 18h56v8a6 6 0 0 0 0 12v8H4v-8a6 6 0 0 0 0-12z" ${PINT('#ffc93a')}/>
<path d="M20 20v24" stroke="${K}" stroke-width="2" stroke-dasharray="3 3"/>
<path d="M30 25h16l-1.5 15h-13z" fill="#e8a01c" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M29 25c0-2 2-3 4-3 1-1 3-1 5 0 2-1 4-1 6 0 2 0 4 1 3 3z" fill="#fff4dc" stroke="${K}" stroke-width="2" stroke-linejoin="round"/>
<path d="M11 25v14" stroke="#c4560f" stroke-width="3" stroke-linecap="round"/>
<path d="M24 21h32" stroke="#fff8" stroke-width="2" stroke-linecap="round"/></g>`),
  // Trèfle à quatre feuilles
  trefle: (cls) => svg64(cls, `
<path d="M32 34c4 10 8 18 14 24" stroke="#2f7a2c" stroke-width="4.5" fill="none" stroke-linecap="round"/>
<path d="M32 34c4 10 8 18 14 24" stroke="${K}" stroke-width="1.5" fill="none" opacity=".4"/>
<g fill="#4fb84a" stroke="${K}" stroke-width="3" stroke-linejoin="round">
<path d="M32 32C25 30 17 24 19 16c2-6 10-6 13 1 3-7 11-7 13-1 2 8-6 14-13 16z"/>
<path d="M32 32C25 30 17 24 19 16c2-6 10-6 13 1 3-7 11-7 13-1 2 8-6 14-13 16z" transform="rotate(90 32 32)"/>
<path d="M32 32C25 30 17 24 19 16c2-6 10-6 13 1 3-7 11-7 13-1 2 8-6 14-13 16z" transform="rotate(180 32 32)"/>
<path d="M32 32C25 30 17 24 19 16c2-6 10-6 13 1 3-7 11-7 13-1 2 8-6 14-13 16z" transform="rotate(270 32 32)"/></g>
<path d="M23 17c1-3 4-4 7-2M45 47c2-1 4-3 4-6" stroke="#fff7" stroke-width="2.5" fill="none" stroke-linecap="round"/>`),
  // Deux pintes qui trinquent, la mousse qui gicle
  deuxMains: (cls) => svg64(cls, `
<g transform="rotate(-16 18 40)">
<path d="M7 22h21l-2 34H9z" ${PINT('#e8a01c')}/>
<path d="M5 19c0-3 3-4 5-4 2-2 5-2 7 0 2-2 6-2 8 0 3 0 6 2 5 5H6z" ${PINT('#fff4dc')}/>
<path d="M11 26l1.5 24" stroke="#fff8" stroke-width="2.2" stroke-linecap="round"/></g>
<g transform="rotate(16 46 40)">
<path d="M36 22h21l-2 34H38z" ${PINT('#c9771a')}/>
<path d="M34 19c0-3 3-4 5-4 2-2 5-2 7 0 2-2 6-2 8 0 3 0 6 2 5 5H35z" ${PINT('#fff4dc')}/>
<path d="M40 26l1.5 24" stroke="#fff8" stroke-width="2.2" stroke-linecap="round"/></g>
<circle cx="32" cy="9" r="3" fill="#fff4dc" stroke="${K}" stroke-width="2"/><circle cx="25" cy="4.5" r="2" fill="#fff4dc" stroke="${K}" stroke-width="1.5"/><circle cx="39" cy="4.5" r="2" fill="#fff4dc" stroke="${K}" stroke-width="1.5"/>`),
  // Cendrier en verre épais, cigarette posée qui fume, étincelle
  cendrier: (cls) => svg64(cls, `
<path d="M6 38c0 9 12 16 26 16s26-7 26-16v-4H6z" fill="#7fa7b8" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>
<ellipse cx="32" cy="34" rx="26" ry="11" fill="#a9cbd8" stroke="${K}" stroke-width="3"/>
<ellipse cx="32" cy="35" rx="16" ry="6" fill="#5b6e78" stroke="${K}" stroke-width="2.5"/>
<path d="M8 31h8M48 31h8" stroke="${K}" stroke-width="3" stroke-linecap="round"/>
<path d="M30 33l22-9" stroke="#f3e6cf" stroke-width="5" stroke-linecap="round"/>
<path d="M30 33l22-9" stroke="${K}" stroke-width="1.5" opacity=".35"/>
<path d="M47 26l5-2" stroke="#d27a2a" stroke-width="5" stroke-linecap="round"/>
<path d="M53 22c-3-4 3-6 0-10s3-6 1-9" stroke="#cdbfa6" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<path d="M12 44c4 3 10 5 16 5" stroke="#fff8" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<path d="M14 14l3 5M8 20l5 2M22 9l1 5" stroke="#ff7a2a" stroke-width="2.5" stroke-linecap="round"/>`),
  // Bouclier de mousse : une grosse bulle de mousse bordée, bulles dedans
  mousseEpaisse: (cls) => svg64(cls, `
<path d="M32 4l22 8v16c0 15-10 26-22 32C20 54 10 43 10 28V12z" fill="#fff4dc" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>
<path d="M32 10l16 6v12c0 11-7 19-16 24-9-5-16-13-16-24V16z" fill="#f3d9a0"/>
<g fill="#fff8f0" stroke="${K}" stroke-width="2"><circle cx="25" cy="24" r="5"/><circle cx="37" cy="21" r="4"/><circle cx="33" cy="33" r="6"/><circle cx="24" cy="38" r="3"/><circle cx="41" cy="34" r="3"/></g>
<path d="M14 14l6-2" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
<circle cx="23.5" cy="22.5" r="1.5" fill="#fff"/><circle cx="31.5" cy="31" r="1.8" fill="#fff"/>`),
  // Happy hour : horloge de bar, aiguilles sur l'heure de l'apéro, pinte devant
  happyHour: (cls) => svg64(cls, `
<circle cx="28" cy="28" r="23" fill="#ffc93a" stroke="${K}" stroke-width="3"/>
<circle cx="28" cy="28" r="17" fill="#fff4dc" stroke="${K}" stroke-width="2.5"/>
<path d="M28 13v3M43 28h-3M28 43v-3M13 28h3" stroke="${K}" stroke-width="2.5" stroke-linecap="round"/>
<path d="M28 28V18M28 28l8 5" stroke="${K}" stroke-width="3" stroke-linecap="round"/>
<circle cx="28" cy="28" r="2.5" fill="#d23b2a" stroke="${K}" stroke-width="1.5"/>
<path d="M40 34h18l-2 26H42z" fill="#e8a01c" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>
<path d="M38 32c0-3 3-4 5-4 2-2 5-2 7 0 2-2 6-2 8 0 2 0 4 2 3 5H39z" fill="#fff4dc" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M44 38l1 18" stroke="#fff8" stroke-width="2" stroke-linecap="round"/>`),
  // Sachet de cacahuètes ouvert, cacahuètes qui en sortent
  cacahuetes: (cls) => svg64(cls, `
<path d="M10 20l4-12h28l4 12-2 38H12z" fill="#d23b2a" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>
<path d="M14 8l4 12h26" stroke="#9e1f16" stroke-width="2.5" fill="none"/>
<path d="M16 30h24v14H16z" fill="#ffc93a" stroke="${K}" stroke-width="2.5"/>
<path d="M21 37c0-3 3-4 5-3s4 0 5-1 4 1 3 4-3 4-5 3-4 0-5 1-3-1-3-4z" fill="#c98a4a" stroke="${K}" stroke-width="1.5"/>
<g fill="#e0b07a" stroke="${K}" stroke-width="2.2">
<path d="M44 12c3-2 7-1 8 2s0 5 2 7-1 7-5 6-5-3-7-4-3-5 0-8z"/>
<path d="M50 34c3-1 6 1 6 4s-1 4 0 6-2 6-5 5-4-3-5-5 0-8 4-10z" transform="rotate(30 52 42)"/></g>
<path d="M46 16l3 2M50 22l2 1" stroke="#a87048" stroke-width="1.5" stroke-linecap="round"/>
<path d="M14 24l2 26" stroke="#fff6" stroke-width="2.5" stroke-linecap="round"/>`),
  // Énorme pinte, flèches d'agrandissement
  pinteXXL: (cls) => svg64(cls, `
<path d="M14 14h36l-4 46H18z" ${PINT('#e8a01c')}/>
<path d="M11 11c0-4 4-6 7-6 3-3 8-3 11 0 3-3 8-3 11 0 4-1 11 1 11 6 1 3-1 6-4 6H15c-3 0-5-3-4-6z" ${PINT('#fff4dc')}/>
<path d="M20 22l2 32" stroke="#fff8" stroke-width="3" stroke-linecap="round"/>
<path d="M4 34l6-6v4h4M60 34l-6-6v4h-4" stroke="${K}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  // Kebab dans son pain, sauce blanche
  kebab: (cls) => svg64(cls, `
<path d="M8 40c0-16 10-28 24-28s24 12 24 28c-6 10-42 10-48 0z" ${PINT('#e6b36a')}/>
<path d="M14 36c4-12 10-18 18-18s14 6 18 18" fill="#8a4a22" stroke="${K}" stroke-width="2.5"/>
<path d="M18 30c3-3 6-2 8 0M30 24c3-2 6-1 8 1M36 31c3-2 6-1 8 2" stroke="#5aa83a" stroke-width="3" stroke-linecap="round" fill="none"/>
<path d="M17 37c5 2 25 2 30 0" stroke="#fff4dc" stroke-width="4" stroke-linecap="round"/>
<path d="M12 44c6 6 34 6 40 0" stroke="#fff6" stroke-width="2.5" fill="none" stroke-linecap="round"/>`),
  // Petit verre à shot renversé d'un coup, gouttes
  culSec: (cls) => svg64(cls, `
<g transform="rotate(-35 32 34)"><path d="M20 18h24l-4 32H24z" ${PINT('#c9ccd1')}/>
<path d="M22 22h20l-1.5 12h-17z" fill="#e8a01c"/><path d="M25 22l2 24" stroke="#fff8" stroke-width="2.5" stroke-linecap="round"/></g>
<circle cx="50" cy="16" r="3" fill="#e8a01c" stroke="${K}" stroke-width="2"/><circle cx="56" cy="26" r="2.2" fill="#e8a01c" stroke="${K}" stroke-width="1.8"/>
<path d="M8 50l6-2M6 42l6 0" stroke="#ffc93a" stroke-width="2.5" stroke-linecap="round"/>`),
  // Briquet et sa flamme
  briquet: (cls) => svg64(cls, `
<path d="M32 4c6 6 10 11 10 17 0 6-4 9-10 9s-10-3-10-9c0-4 3-6 5-10 1 4 3 5 5 5 0-5-2-8 0-12z" fill="#ff8a2a" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M32 16c3 3 4 6 4 8 0 3-2 4-4 4s-4-1-4-4c0-3 3-5 4-8z" fill="#ffd45a"/>
<path d="M20 32h24v8H20z" fill="#c9ccd1" stroke="${K}" stroke-width="2.5"/>
<rect x="18" y="40" width="28" height="20" rx="4" fill="#d23b2a" stroke="${K}" stroke-width="3"/>
<path d="M22 44v12" stroke="#fff6" stroke-width="2.5" stroke-linecap="round"/>`),
  // Canette verte « 0,0 % » et goutte de soin
  sansAlcool: (cls) => svg64(cls, `
<path d="M14 12c0-2 2-4 4-4h20c2 0 4 2 4 4v44c0 2-2 4-4 4H18c-2 0-4-2-4-4z" ${PINT('#4fb84a')}/>
<path d="M14 26h28v16H14z" fill="#fff4dc" stroke="${K}" stroke-width="2"/>
<text x="28" y="38" text-anchor="middle" font-family="Lilita One, system-ui" font-size="10" fill="#2f7a2c">0,0%</text>
<path d="M18 46v8" stroke="#fff6" stroke-width="2.5" stroke-linecap="round"/>
<path d="M50 30c4 5 7 9 7 13a7 7 0 0 1-14 0c0-4 3-8 7-13z" fill="#e2453a" stroke="${K}" stroke-width="2.5"/>
<path d="M50 38v8M46 42h8" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`),
  // Bonnet rouge à pompon blanc
  bonnet: (cls) => svg64(cls, `
<path d="M10 46C12 26 24 10 42 12c6 1 10 6 12 12-8-4-14-2-16 4 6 4 8 10 8 18z" ${PINT('#d23b2a')}/>
<path d="M6 44h44v12H6z" fill="#fff4dc" stroke="${K}" stroke-width="3" stroke-linejoin="round" rx="5"/>
<circle cx="56" cy="26" r="6" fill="#fff4dc" stroke="${K}" stroke-width="2.5"/>
<path d="M18 36c2-8 8-16 16-18" stroke="#fff5" stroke-width="3" fill="none" stroke-linecap="round"/>`),
  // Seau à glace argenté, glaçons qui dépassent
  seauAGlace: (cls) => svg64(cls, `
<path d="M14 18l6-6 10 2 8-6 8 4 4 8z" fill="#bfe6ff" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M8 22h48l-6 36H14z" ${PINT('#c9ccd1')}/>
<path d="M8 22h48" stroke="${K}" stroke-width="5"/>
<path d="M12 32h40M14 46h36" stroke="#9aa0a8" stroke-width="2"/>
<path d="M4 30c-2 4 0 8 4 8M60 30c2 4 0 8-4 8" stroke="${K}" stroke-width="2.5" fill="none"/>
<path d="M16 28l2 24" stroke="#fff8" stroke-width="3" stroke-linecap="round"/>`),
  // Tireuse de fût avec manomètre
  pression: (cls) => svg64(cls, `
<path d="M12 22c0-8 40-8 40 0v32c0 6-40 6-40 0z" ${PINT('#8a5230')}/>
<path d="M12 30c6 3 34 3 40 0M12 46c6 3 34 3 40 0" stroke="#6a6e75" stroke-width="4" fill="none"/>
<circle cx="32" cy="14" r="10" fill="#fff4dc" stroke="${K}" stroke-width="3"/>
<path d="M32 14l5-5" stroke="#d23b2a" stroke-width="3" stroke-linecap="round"/>
<path d="M25 12h2M32 7v2M39 12h-2" stroke="${K}" stroke-width="2" stroke-linecap="round"/>`),
  // Tête qui tourne : poche de glace sur le front
  gueuleDeBois: (cls) => svg64(cls, `
<circle cx="32" cy="36" r="22" ${PINT('#f0b48c')}/>
<path d="M14 22c4-10 32-12 38-2-6 4-30 6-38 2z" ${PINT('#5bb8e8')}/>
<path d="M22 38l6 4M28 38l-6 4M36 38l6 4M42 38l-6 4" stroke="${K}" stroke-width="2.5" stroke-linecap="round"/>
<path d="M26 50c4-3 8-3 12 0" stroke="${K}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<path d="M54 8c2 2 0 4 2 6M8 10c-2 2 0 4-2 6" stroke="#ffc93a" stroke-width="2.5" fill="none" stroke-linecap="round"/>`),
  // Gant de boxe rouge
  gantsVideur: (cls) => svg64(cls, `
<path d="M14 30c0-14 8-24 22-24 12 0 18 8 18 18 0 8-4 14-10 16H20c-4-2-6-5-6-10z" ${PINT('#d23b2a')}/>
<path d="M14 30c-6-2-8 6-4 10 3 3 8 2 10 0" ${PINT('#d23b2a')}/>
<path d="M18 40h28v14H18z" fill="#fff4dc" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>
<path d="M22 14c4-4 10-5 14-4" stroke="#fff6" stroke-width="3" fill="none" stroke-linecap="round"/>`),
  // Lunettes rondes avec reflet
  lunettes: (cls) => svg64(cls, `
<path d="M4 26l6-6M60 26l-6-6" stroke="${K}" stroke-width="3" stroke-linecap="round"/>
<circle cx="19" cy="34" r="12" fill="#bfe6ff" stroke="${K}" stroke-width="3.5"/>
<circle cx="45" cy="34" r="12" fill="#bfe6ff" stroke="${K}" stroke-width="3.5"/>
<path d="M31 32c0-3 2-4 1-4M33 32c0-3-2-4-1-4" stroke="${K}" stroke-width="3"/><path d="M29 31h6" stroke="${K}" stroke-width="3"/>
<path d="M13 30l6-4M39 30l6-4" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`),
  // Écharpe de supporter rayée
  echarpe: (cls) => svg64(cls, `
<path d="M8 14c14-6 34-6 48 0v10c-14-6-34-6-48 0z" ${PINT('#d23b2a')}/>
<path d="M40 22l4 34h-12l-2-32z" ${PINT('#d23b2a')}/>
<path d="M18 11v10M28 9v10M48 11v10M33 30l9-1M34 40l9-1" stroke="#fff4dc" stroke-width="4"/>
<path d="M32 56v5M36 56v5M40 56v5" stroke="${K}" stroke-width="2.5" stroke-linecap="round"/>`),
  // Cochonnet en bois et boule de pétanque
  cochonnet: (cls) => svg64(cls, `
<circle cx="24" cy="38" r="18" ${PINT('#9aa0a8')}/>
<path d="M10 30c8 4 20 4 28 0M8 42c8 4 24 4 32 0" stroke="#6a6e75" stroke-width="2.5" fill="none"/>
<path d="M14 26c3-4 6-6 10-6" stroke="#fff8" stroke-width="3" fill="none" stroke-linecap="round"/>
<circle cx="50" cy="20" r="8" fill="#ffc93a" stroke="${K}" stroke-width="3"/>
<circle cx="47.5" cy="17.5" r="2" fill="#fff8"/>`),
  // Bouteille qui titube, traits de déséquilibre
  demarche: (cls) => svg64(cls, `
<g transform="rotate(18 32 36)"><path d="M28 6h8v12c0 3 8 6 8 14v24c0 2-2 4-4 4H24c-2 0-4-2-4-4V32c0-8 8-11 8-14z" ${PINT('#4b8a3a')}/>
<path d="M20 34h24v10H20z" fill="#fff4dc" stroke="${K}" stroke-width="2"/></g>
<path d="M6 20c3-2 5 2 8 0M4 32c3-2 5 2 8 0M52 46c3-2 5 2 8 0" stroke="#cdbfa6" stroke-width="2.5" fill="none" stroke-linecap="round"/>`),
  // Ressort de canapé
  ressort: (cls) => svg64(cls, `
<path d="M10 56h44" stroke="${K}" stroke-width="4" stroke-linecap="round"/>
<path d="M18 52c0-4 28-4 28-8s-28-4-28-8 28-4 28-8-28-4-28-8 28-4 28-8" stroke="#c9ccd1" stroke-width="5" fill="none" stroke-linecap="round"/>
<path d="M18 52c0-4 28-4 28-8s-28-4-28-8 28-4 28-8-28-4-28-8 28-4 28-8" stroke="${K}" stroke-width="1.5" fill="none" opacity=".5"/>
<path d="M8 10l6 4M56 10l-6 4M32 2v6" stroke="#ffc93a" stroke-width="3" stroke-linecap="round"/>`),
  // Deux pintes, la seconde dorée qui brille
  secondeTournee: (cls) => svg64(cls, `
<path d="M8 22h20l-2 34H10z" ${PINT('#9a6a3a')}/>
<path d="M30 16h26l-3 42H33z" ${PINT('#ffc93a')}/>
<path d="M28 13c0-3 3-5 6-5 2-2 6-2 8 0 2-2 6-2 8 0 4 0 8 2 7 6z" ${PINT('#fff4dc')}/>
<path d="M36 22l2 30" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
<path d="M58 4l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="#fff" stroke="${K}" stroke-width="1.5"/>`),
  // Carte de fidélité tamponnée
  carteFidelite: (cls) => svg64(cls, `
<rect x="4" y="14" width="56" height="36" rx="6" ${PINT('#f3e6cf')}/>
<path d="M4 22h56" stroke="#d23b2a" stroke-width="6"/>
<g fill="#e8a01c" stroke="${K}" stroke-width="2"><circle cx="14" cy="36" r="5"/><circle cx="26" cy="36" r="5"/><circle cx="38" cy="36" r="5"/></g>
<circle cx="50" cy="36" r="5" fill="none" stroke="${K}" stroke-width="2" stroke-dasharray="3 2"/>`),
  // Trois glaçons
  glacons: (cls) => svg64(cls, `
<g fill="#bfe6ff" stroke="${K}" stroke-width="3" stroke-linejoin="round">
<path d="M8 30l14-6 12 6v14l-14 6-12-6z"/><path d="M30 34l14-6 12 6v14l-14 6-12-6z"/><path d="M18 12l14-6 12 6v14l-14 6-12-6z"/></g>
<path d="M12 34l8-3M34 38l8-3M22 16l8-3" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`),
  // Cloche du dernier service et horloge
  lastOrder: (cls) => svg64(cls, `
<path d="M14 46c0-20 6-32 18-32s18 12 18 32z" ${PINT('#ffc93a')}/>
<path d="M8 46h48v6H8z" fill="#c9771a" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>
<circle cx="32" cy="10" r="4" fill="#c9771a" stroke="${K}" stroke-width="2.5"/>
<circle cx="32" cy="56" r="4" fill="#5c6168" stroke="${K}" stroke-width="2.5"/>
<path d="M22 40c0-10 3-16 8-20" stroke="#fff8" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M4 20l6 4M60 20l-6 4" stroke="#d23b2a" stroke-width="3" stroke-linecap="round"/>`),
  // Ardoise noire avec traits à la craie
  ardoise: (cls) => svg64(cls, `
<rect x="6" y="8" width="52" height="46" rx="4" fill="#8a5230" stroke="${K}" stroke-width="3"/>
<rect x="11" y="13" width="42" height="36" fill="#2d3236" stroke="${K}" stroke-width="2"/>
<path d="M16 20v12M20 20v12M24 20v12M28 20v12M14 30l16-8M36 22h12M36 30h8M16 40h28" stroke="#f3e6cf" stroke-width="2.2" stroke-linecap="round"/>`),
  // Juke-box arrondi, notes
  jukeBox: (cls) => svg64(cls, `
<path d="M12 58V26c0-12 9-20 20-20s20 8 20 20v32z" ${PINT('#d23b2a')}/>
<path d="M18 30c0-8 6-14 14-14s14 6 14 14v8H18z" fill="#ffc93a" stroke="${K}" stroke-width="2.5"/>
<path d="M18 44h28v10H18z" fill="#2d3236" stroke="${K}" stroke-width="2.5"/>
<path d="M22 49h20" stroke="#5bb8e8" stroke-width="3"/>
<path d="M54 10v10a3 3 0 1 1-2-3V10l6-2v8a3 3 0 1 1-2-3" stroke="${K}" stroke-width="2" fill="#fff4dc"/>`),
  // Bretelles croisées
  bretelles: (cls) => svg64(cls, `
<path d="M14 6l8 0 24 52h-8zM50 6h-8L18 58h8z" ${PINT('#d23b2a')}/>
<rect x="9" y="2" width="18" height="8" rx="2" fill="#c9ccd1" stroke="${K}" stroke-width="2.5"/>
<rect x="37" y="2" width="18" height="8" rx="2" fill="#c9ccd1" stroke="${K}" stroke-width="2.5"/>
<rect x="15" y="54" width="14" height="8" rx="2" fill="#c9ccd1" stroke="${K}" stroke-width="2.5"/>
<rect x="35" y="54" width="14" height="8" rx="2" fill="#c9ccd1" stroke="${K}" stroke-width="2.5"/>`),
  // Casquette avec deux canettes et pailles
  casquette: (cls) => svg64(cls, `
<path d="M10 44c0-14 10-22 22-22s22 8 22 22z" ${PINT('#3f7fc0')}/>
<path d="M30 44h30c0 4-4 6-8 6H30z" ${PINT('#2d5f94')}/>
<rect x="6" y="18" width="10" height="16" rx="2" fill="#d23b2a" stroke="${K}" stroke-width="2.5"/>
<rect x="48" y="18" width="10" height="16" rx="2" fill="#4fb84a" stroke="${K}" stroke-width="2.5"/>
<path d="M14 30c6 6 12 8 16 2M50 30c-6 6-12 8-16 2" stroke="#fff4dc" stroke-width="2.5" fill="none"/>`),
  // Paire de tongs
  tongs: (cls) => svg64(cls, `
<path d="M12 8c8 0 12 10 12 24s-2 26-10 26S4 46 4 32 6 8 12 8z" ${PINT('#4aa8ff')}/>
<path d="M44 8c8 0 12 10 12 24s-2 26-10 26-10-12-10-26 2-24 8-24z" ${PINT('#4aa8ff')}/>
<path d="M14 16L8 30M14 16l8 12M46 16l-6 12M46 16l8 12" stroke="#ffc93a" stroke-width="3.5" stroke-linecap="round"/>`),
  // Sifflet d'arbitre et son cordon
  sifflet: (cls) => svg64(cls, `
<path d="M8 8c10 6 18 14 22 22" stroke="#d23b2a" stroke-width="3" fill="none"/>
<path d="M26 28h26v12H40a12 12 0 1 1-14-12z" ${PINT('#c9ccd1')}/>
<circle cx="28" cy="42" r="5" fill="#2d3236" stroke="${K}" stroke-width="2"/>
<path d="M54 22l6-4M56 30h6" stroke="#ffc93a" stroke-width="3" stroke-linecap="round"/>`),
  // Paille rayée dans un verre
  paille: (cls) => svg64(cls, `
<path d="M14 24h32l-4 34H18z" ${PINT('#d23b2a')}/>
<path d="M14 24h32l-1 8H15z" fill="#fff4dc" opacity=".6"/>
<path d="M34 50L46 6l8 2" stroke="#fff4dc" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M36 42l2-8M40 28l2-8M44 14l1-4" stroke="#d23b2a" stroke-width="5"/>
<path d="M19 30l2 22" stroke="#fff8" stroke-width="2.5" stroke-linecap="round"/>`),
  // Fourchette qui pique une frite
  piqueAssiette: (cls) => svg64(cls, `
<path d="M22 4v14M28 4v14M34 4v14M20 16c0 6 16 6 16 0" stroke="#c9ccd1" stroke-width="3.5" fill="none" stroke-linecap="round"/>
<path d="M28 22v36" stroke="#c9ccd1" stroke-width="6" stroke-linecap="round"/>
<path d="M28 22v36" stroke="${K}" stroke-width="1.5" opacity=".4"/>
<path d="M40 10l14 4-8 36-10-2z" fill="#ffc93a" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/>`),
  // Porte-monnaie à fermoir, capsule qui dépasse
  porteMonnaie: (cls) => svg64(cls, `
<ellipse cx="34" cy="16" rx="8" ry="3.4" fill="#d42a2a" stroke="${K}" stroke-width="2"/>
<path d="M8 28c0-6 4-10 10-10h28c6 0 10 4 10 10v20c0 6-4 10-10 10H18c-6 0-10-4-10-10z" ${PINT('#8a5230')}/>
<path d="M8 30h48" stroke="${K}" stroke-width="3"/>
<circle cx="26" cy="22" r="4" fill="#ffc93a" stroke="${K}" stroke-width="2"/><circle cx="38" cy="22" r="4" fill="#ffc93a" stroke="${K}" stroke-width="2"/>
<path d="M14 36v14" stroke="#fff5" stroke-width="3" stroke-linecap="round"/>`),
  // Tabouret de bar, plaque « réservé »
  tabouret: (cls) => svg64(cls, `
<ellipse cx="32" cy="14" rx="20" ry="7" ${PINT('#d23b2a')}/>
<path d="M18 20l-6 40M46 20l6 40M24 20l-2 40M40 20l2 40" stroke="#5c6168" stroke-width="4" stroke-linecap="round"/>
<path d="M14 44h36" stroke="#5c6168" stroke-width="4"/>
<rect x="18" y="26" width="28" height="11" rx="2" fill="#fff4dc" stroke="${K}" stroke-width="2"/>
<path d="M22 31.5h20" stroke="#d23b2a" stroke-width="2.5"/>`),
  // Bon de réduction découpé, « -% »
  bonReduction: (cls) => svg64(cls, `
<path d="M6 14h52v36H6z" ${PINT('#4fb84a')}/>
<path d="M6 14h52v36H6z" fill="none" stroke="#fff4dc" stroke-width="2" stroke-dasharray="4 3" transform="translate(4 4) scale(.875)"/>
<text x="32" y="40" text-anchor="middle" font-family="Lilita One, system-ui" font-size="18" fill="#fff4dc" stroke="${K}" stroke-width="1">-%</text>
<path d="M54 6l6 6-4 4M2 54l6-2" stroke="#cdbfa6" stroke-width="2.5" stroke-linecap="round"/>`),
};

export const itemIcon = (id: ItemId, cls: string) => ITEM_ICONS[id](cls);

/** Capsule de bière (Pièces), vue de trois quarts : toute rouge, dessus clair et anneau imprimé, jupe crantée plus sombre. */
export const capsuleIcon = () => `<svg viewBox="0 0 24 24"><path d="M2.5 9L1.9 17.5L4.1 16.6L6.4 18.5L8.6 17.5L10.9 19.1L13.1 17.7L15.4 18.9L17.6 17.1L19.9 18.0L22.1 16.1L21.5 9z" fill="#a81c1c" stroke="#1a120c" stroke-width="1.6" stroke-linejoin="round"/><path d="M5.7 10.9v5.7" stroke="#6e1010" stroke-width="1"/><path d="M8.8 12.3v4.8" stroke="#6e1010" stroke-width="1"/><path d="M12.0 12.8v4.4" stroke="#6e1010" stroke-width="1"/><path d="M15.2 12.3v4.8" stroke="#6e1010" stroke-width="1"/><path d="M18.3 10.9v5.7" stroke="#6e1010" stroke-width="1"/><ellipse cx="12" cy="9" rx="9.5" ry="4.2" fill="#d42a2a" stroke="#1a120c" stroke-width="1.6"/><ellipse cx="12" cy="9" rx="5.2" ry="2.3" fill="none" stroke="#fff4dc" stroke-width="1.3"/><path d="M6.5 7.6a6 2.6 0 0 1 3.5-1.5" stroke="#fff8" stroke-width="1.1" fill="none" stroke-linecap="round"/></svg>`;
