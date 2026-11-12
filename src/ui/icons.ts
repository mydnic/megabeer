import type { WeaponId } from '../weapons/weapon';
import { K, G, P, E, R, L, cap, ensureIconDefs, iconDefs } from './iconKit';

/**
 * Icônes SVG partagées par l'interface (cartes de level-up, HUD, pause). Même style partout : couleur,
 * volume, contour épais (voir `iconKit.ts`). Les objets de coffre sont dans `itemIcons.ts`.
 */
export { itemIcon } from './itemIcons';

/** Icône haute (armes, pompe) : boîte de 40 x 90. */
const tall = (cls: string, body: string) => {
  ensureIconDefs();
  return `<svg viewBox="0 0 40 90" class="${cls}">${body}</svg>`;
};
/** Volume cylindrique et contour posés par-dessus un corps déjà décoré. */
const shell = (d: string, sw = 3) =>
  `<path d="${d}" fill="url(#mb-vol)"/><path d="${d}" fill="none" stroke="${K}" stroke-width="${sw}" stroke-linejoin="round"/>`;
const label = (x: number, y: number, size: number, text: string, fill: string, family: string, len?: number) =>
  `<text x="${x}" y="${y}" text-anchor="middle"${len ? ` textLength="${len}" lengthAdjust="spacingAndGlyphs"` : ''} font-family="${family}" font-weight="900" font-size="${size}" fill="${fill}">${text}</text>`;

/**
 * Canette de bière façon Jupiler 33cl : haut blanc argenté, grande vague rouge en diagonale, écusson
 * rouge bordé de blanc avec la tête de taureau noire, nom en blanc gras, couvercle et fond en métal.
 */
const CAN = 'M4 18c0-2.200 1.800-4 4-4h24c2.200 0 4 1.800 4 4v58c0 2.200-1.800 4-4 4H8c-2.200 0-4-1.800-4-4z';
export const canetteIcon = (cls: string) => tall(cls, `
<path d="${CAN}" fill="#d0142c"/>
<path d="M5.500 17H34.500V30L5.500 47z" fill="#f4f5f7"/><path d="M5.500 47L34.500 30V36L5.500 53z" fill="#9c1020"/>
<path d="M5.500 54.200L34.500 37.200" stroke="#fff" stroke-width=".9"/>
<path d="M24 30c1-3 0-6-2-8c-1.200-1.400.2-3.400 1.800-2.400c1 .6.6 2-.4 1.600" stroke="${K}" stroke-width="1.300" fill="none" stroke-linecap="round"/>
<path d="M12 23.500c5 0 8-1.200 8-1.200s3 1.200 8 1.200v8c0 7-4 11-8 13.500c-4-2.500-8-6.500-8-13.500z" fill="#d0142c" stroke="#fff" stroke-width="1.800" stroke-linejoin="round"/>
<path d="M16 30c2-1.500 6-1.800 8.500-.2c1.200.8 1.300 2.600.6 4l-.9 2.200l.8 3.200h-1.800l-1-2.600h-3.400l-1 2.800h-1.800l.4-3.200c-.9-.2-1.600-.6-2-1.200l-1.600 1.600c-.8.6-1.800.2-1.800-.8l.6-2.600c.4-1.600 1.400-2.600 2.600-3.200z" fill="${K}"/>
<path d="M14.800 32.200c-1.200-.8-1.800-2-1.400-3.200" stroke="${K}" stroke-width="1.300" fill="none" stroke-linecap="round"/>
${label(20, 60, 8.5, 'Jupiler', '#fff', 'Arial Black, Arial, sans-serif', 27)}
<text x="20" y="66" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="3.600" letter-spacing=".4" fill="#e8c76a">PILS</text>
<path d="M5.500 75h29v2c0 1.700-1.300 3-3 3h-23c-1.700 0-3-1.300-3-3z" fill="#c2c8d0"/>
${shell(CAN)}
${P('M8 10c0-1.400 1.100-2.500 2.500-2.500h19c1.400 0 2.500 1.100 2.500 2.500V14.500H8z', G.steel, 'vol', 2.5)}
${E(20, 7.5, 10.5, 2.4, '#e4e8ed', '', 2)}
<ellipse cx="21.500" cy="7.300" rx="3.600" ry="1.100" fill="none" stroke="${K}" stroke-width="1.100"/>`);

/**
 * Bouteille de Stout calquée sur la Duvel 33cl, en verre brun stout : capsule, col qui s'élargit,
 * longues épaules arrondies, corps droit, grande étiquette blanche marquée « Stout » en rouge.
 */
const STOUT = 'M15 8h10v8c0 2 .6 3 .6 5c0 4 10.400 9 10.400 25v35c0 2.200-1.800 4-4 4H8c-2.200 0-4-1.800-4-4V46c0-16 10.400-21 10.400-25c0-2 .6-3 .6-5z';
export const stoutIcon = (cls: string) => tall(cls, `
<path d="${STOUT}" fill="#4a2a17"/>
<path d="M15.600 17.500h8.800" stroke="#2a170c" stroke-width="1.400"/>
<rect x="5.500" y="49" width="29" height="30" fill="#f7f4ee"/><path d="M5.500 49h29M5.500 79h29" stroke="#c8a24a" stroke-width="1.600"/>
<path d="M18.400 52.400h3.200l-.4 1.800c-.2.800-.8 1.200-1.200 1.200s-1-.4-1.200-1.200zM20 55.400v1.400M18.800 57h2.400" stroke="#b08a3a" stroke-width=".7" fill="#e8c76a"/>
${label(20, 70, 10, 'Stout', '#c8102e', "Georgia, 'Times New Roman', serif", 26)}
<path d="M11 74.500h18" stroke="#c8102e" stroke-width=".9"/>
${shell(STOUT)}
${R(13.5, 2.5, 13, 6.5, 1.5, G.gold, 'vol', 2.5)}`);

/** Fût qui roule : tonneau en bois bombé, douelles, deux cerclages rivetés, bonde. */
const FUT = 'M8 20c4-2 20-2 24 0c3 8 4 16 4 25s-1 17-4 25c-4 2-20 2-24 0c-3-8-4-16-4-25s1-17 4-25z';
export const futIcon = (cls: string) => tall(cls, `
<path d="${FUT}" fill="#96592f"/>
<path d="M14 21c-1.500 8-2 16-2 24s.5 16 2 24M20 20.500v49M26 21c1.500 8 2 16 2 24s-.5 16-2 24" stroke="#5e3519" stroke-width="1.600" fill="none"/>
<path d="M6.200 31c6-1.600 21.600-1.600 27.600 0M6.200 59c6 1.600 21.600 1.600 27.600 0" stroke="${K}" stroke-width="6.500" fill="none"/>
<path d="M6.200 31c6-1.600 21.600-1.600 27.600 0M6.200 59c6 1.600 21.600 1.600 27.600 0" stroke="#aab1ba" stroke-width="4" fill="none"/>
<g fill="#eef1f5"><circle cx="11" cy="30.300" r=".9"/><circle cx="20" cy="29.800" r=".9"/><circle cx="29" cy="30.300" r=".9"/><circle cx="11" cy="59.700" r=".9"/><circle cx="20" cy="60.200" r=".9"/><circle cx="29" cy="59.700" r=".9"/></g>
${R(17.3, 42.5, 5.4, 5, 1.2, '#2e1a0e', '', 1.2)}
${shell(FUT)}
${E(20, 20.5, 12, 2.8, '#b9773f', 'sh', 2.2)}`);

/**
 * Gueuze, d'après une bouteille de kriek lambic 25 cl : verre sombre rouge cerise, col et épaules sous
 * une feuille rouge brillante, étiquette foncée à double liseré crème, cerises, nom en crème.
 */
const GUEUZE = 'M16 4h8v20c0 5 9 9 9 17v39c0 2.800-2.200 5-5 5H12c-2.800 0-5-2.200-5-5V41c0-8 9-12 9-17z';
const FOIL = 'M14.600 3.500h10.800v20.500c0 3 2 5 4 6.500L27.100 32.100L24.700 30.700L22.400 32.200L20 30.700L17.600 32.200L15.300 30.700L12.900 32.100L10.600 30.500c2-1.500 4-3.500 4-6.500z';
export const gueuzeIcon = (cls: string) => tall(cls, `
<path d="${GUEUZE}" fill="#3a0d12"/>
<rect x="8.500" y="48" width="23" height="27" rx="2" fill="#2a0a0e" stroke="#e9d9b6" stroke-width="1.600"/>
<rect x="10.400" y="50" width="19.200" height="23" rx="1" fill="none" stroke="#e9d9b6" stroke-width=".6"/>
${label(20, 57.5, 6.2, 'Gueuze', '#f1e4c4', "Georgia, 'Times New Roman', serif", 17)}
<path d="M18.400 61.400c.6-1.200 1.400-1.800 2.600-2.100M21 59.300c.4 1.200 1 2 2 2.400" stroke="#4f9a36" stroke-width=".9" fill="none"/>
<circle cx="18.200" cy="63.600" r="2.300" fill="#e2203a"/><circle cx="22.800" cy="63.800" r="2.300" fill="#c8102e"/>
<circle cx="17.500" cy="62.800" r=".7" fill="#ffb0bc"/><circle cx="22.100" cy="63" r=".7" fill="#ffb0bc"/>
<path d="M13 69.500h14" stroke="#e9d9b6" stroke-width=".7"/>
${shell(GUEUZE)}
${P(FOIL, '#e2203a', 'vol', 2)}`);

/**
 * Pompe à bière, de profil : une tireuse (colonne chromée, bec, poignée de la couleur de la pompe) qui
 * remplit une pinte posée sur l'égouttoir ; filet de bière, pinte à moitié pleine avec sa mousse.
 */
export const pumpIcon = (cls: string, handle: number) => {
  const c = `#${handle.toString(16).padStart(6, '0')}`;
  return tall(cls, `
${R(1.5, 80, 37, 6.5, 2, G.dark, 'sh', 2.5)}
${P('M5 80V18c0-2 1.500-3.500 3.500-3.500h20c2 0 3.500 1.500 3.500 3.500v6h-4.500v-3.500H11.500V80z', G.steel, 'vol', 2.5)}
${P('M14.500 14.500l-1.700-10.700c-.2-1.200.8-2.300 2-2.300h4.400c1.200 0 2.200 1.100 2 2.300l-1.700 10.700z', c, 'vol', 2.2)}
<path d="M30 25v32" stroke="${K}" stroke-width="4" stroke-linecap="round"/><path d="M30 25v32" stroke="#f4a81e" stroke-width="2.200" stroke-linecap="round"/>
<path d="M19 48h22l-2.400 32H21.400z" fill="rgba(255,255,255,.2)"/>
<path d="M19.900 60h20.200l-1.500 20H21.400z" fill="${G.beer}"/>
<path d="M19.500 54.500c1.500-2 4-2 5.500-.5c2-2 5-2 6.500 0c2-1.500 5-1.500 6.500 0c1.500-.5 3 1 2.500 2.500l-.3 4H19.900z" fill="${G.foam}"/>
<circle cx="25" cy="70" r="1.100" fill="#fff" opacity=".5"/><circle cx="33" cy="74" r=".9" fill="#fff" opacity=".5"/><circle cx="29" cy="66" r=".8" fill="#fff" opacity=".5"/>
<path d="M19 48h22l-2.400 32H21.400z" fill="url(#mb-vol)" opacity=".7"/>
<path d="M19 48h22l-2.400 32H21.400z" fill="none" stroke="${K}" stroke-width="2.500" stroke-linejoin="round"/>
${L('M22.200 52l1.500 24', '#fff', 1.6, 0.7)}`);
};

/** Icône de chaque arme (ajouter une arme = ajouter son icône ici). */
const WEAPON_ICONS: Record<WeaponId, (cls: string) => string> = {
  canette: canetteIcon,
  stout: stoutIcon,
  fut: futIcon,
  gueuze: gueuzeIcon,
};

export const weaponIcon = (id: WeaponId, cls: string) => WEAPON_ICONS[id](cls);

/**
 * Coffre en trois quarts : planches de chêne, ferrures rivetées, coins en fer, serrure dorée et gemme
 * de la couleur `--c` (la rareté). Fermé par défaut ; la classe `open` sur le svg cache le couvercle
 * bombé et montre l'intérieur du couvercle relevé, le dedans qui brille et la lumière qui en sort.
 * Parties animables : `ch-lid` (couvercle fermé), `ch-open` (couvercle relevé), `ch-beam` (lueur du
 * dedans), `ch-ray` (halo et rayons qui montent), `ch-gem`.
 */
const CHEST_CSS = `.ch .ch-open, .ch .ch-beam { opacity: 0; } .ch.open .ch-lid { opacity: 0; } .ch.open .ch-open, .ch.open .ch-beam { opacity: 1; }
.ch-open, .ch-lid { transform-box: fill-box; transform-origin: 50% 100%; }
.ch { overflow: visible; }
.ch-ray { transform-box: fill-box; transform-origin: 50% 100%; }
.ch-gem { animation: ch-gem 1.6s ease-in-out infinite; }
@keyframes ch-gem { 50% { filter: brightness(1.5); } }`;
let chestCss = false;
let chestId = 0;
export const chestSvg = (cls: string, color?: string) => {
  ensureIconDefs();
  if (!chestCss && typeof document !== 'undefined') {
    chestCss = true;
    const s = document.createElement('style');
    s.textContent = CHEST_CSS;
    document.head.appendChild(s);
  }
  const id = `ch${++chestId}`;
  const stop = (o: number, a: number) => `<stop offset="${o}" style="stop-color: var(--c, #ffc93a)" stop-opacity="${a}"/>`;
  const plank = '#9a5c30', plankDark = '#6e3f20', side = '#6a3d22', iron = '#8a9099';
  return `<svg viewBox="0 0 124 112" class="ch ${cls}"${color ? ` style="--c:${color}"` : ''}>
<defs>
<radialGradient id="${id}g" cx=".5" cy=".92" r=".9">${stop(0, 0.95)}${stop(0.35, 0.45)}${stop(1, 0)}</radialGradient>
<linearGradient id="${id}r" x1="0" y1="1" x2="0" y2="0">${stop(0, 0.85)}${stop(1, 0)}</linearGradient>
<linearGradient id="${id}i" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".95"/>${stop(0.5, 0.9)}${stop(1, 0.2)}</linearGradient>
</defs>
<ellipse cx="60" cy="104" rx="52" ry="6" fill="${K}" opacity=".45"/>
<g class="ch-open">
${P('M24 52L30 12h78l2 40z', '#5a3420', 'sh', 3.5)}
<path d="M29 25h79M27 39h82" stroke="#43261a" stroke-width="2.500"/>
<path d="M44 12v40M94 12v40" stroke="${K}" stroke-width="9"/><path d="M44 13.500v37M94 13.500v37" stroke="${iron}" stroke-width="6"/>
<path d="M24 52L30 12h78l2 40z" fill="none" stroke="${K}" stroke-width="3.500" stroke-linejoin="round"/>
</g>
<g class="ch-beam ch-ray">
<ellipse cx="61" cy="20" rx="62" ry="62" fill="url(#${id}g)"/>
<path d="M52 55L26 -30h9L57 55zM59 55L56 -40h10L64 55zM66 55L88 -30h9L71 55z" fill="url(#${id}r)" opacity=".5"/>
</g>
<path d="M12 58l12-6h86l-12 6z" fill="#2a1608" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>
<path class="ch-beam" d="M22 56.500l6-3h76l-6 3z" fill="url(#${id}i)"/>
${P('M98 58l12-6v40l-12 8z', side, 'sh', 3.5)}
<path d="M98 72l12-6M98 86l12-6" stroke="#4e2c18" stroke-width="2.500"/>
<path d="M104 55v41" stroke="${K}" stroke-width="7"/><path d="M104 56.500v38" stroke="#6a6e75" stroke-width="4"/>
<path d="M98 58l12-6v40l-12 8z" fill="none" stroke="${K}" stroke-width="3.500" stroke-linejoin="round"/>
<path d="M12 58h86v42H12z" fill="${plank}"/><path d="M12 58h86v42H12z" fill="url(#mb-sh)"/>
<path d="M14 72h82M14 86h82" stroke="${plankDark}" stroke-width="2.500"/>
<path d="M18 64h26M18 78h18" stroke="#fff" stroke-opacity=".28" stroke-width="2.500" stroke-linecap="round"/>
<path d="M30 58v42M80 58v42" stroke="${K}" stroke-width="12"/><path d="M30 59.500v39M80 59.500v39" stroke="${iron}" stroke-width="9"/>
<path d="M27.500 60v38M77.500 60v38" stroke="#fff" stroke-opacity=".45" stroke-width="2"/>
<path d="M14 60h8v8M96 60h-8v8M14 98h8v-8M96 98h-8v-8" stroke="#6a6e75" stroke-width="5" fill="none"/>
<g fill="#eef1f5" stroke="${K}" stroke-width="1.200"><circle cx="30" cy="66" r="2.200"/><circle cx="30" cy="92" r="2.200"/><circle cx="80" cy="66" r="2.200"/><circle cx="80" cy="92" r="2.200"/></g>
<path d="M12 58h86v42H12z" fill="none" stroke="${K}" stroke-width="3.500" stroke-linejoin="round"/>
<g class="ch-lid">
${P('M98 58c0-22-16-34-36-36l12-6c20 2 36 14 36 36z', side, 'sh', 3.5)}
<path d="M104 55c0-20-14-31-30-34" stroke="${K}" stroke-width="7" fill="none"/><path d="M104 54c0-19-13.500-29.500-29-32.700" stroke="#6a6e75" stroke-width="4" fill="none"/>
<path d="M98 58c0-22-16-34-36-36l12-6c20 2 36 14 36 36z" fill="none" stroke="${K}" stroke-width="3.500" stroke-linejoin="round"/>
<path d="M12 58c0-22 20-36 43-36h7c20 2 36 14 36 36z" fill="#b06d3c"/><path d="M12 58c0-22 20-36 43-36h7c20 2 36 14 36 36z" fill="url(#mb-sh)"/>
<path d="M14 46c10 1 70 1 83 0M20 34c14 1 58 1 72 0" stroke="#7a4626" stroke-width="2.500" fill="none"/>
<path d="M30 58V30M80 58V30" stroke="${K}" stroke-width="12"/><path d="M30 58V31.500M80 58V31.500" stroke="${iron}" stroke-width="9"/>
<path d="M27.500 57V33M77.500 57V33" stroke="#fff" stroke-opacity=".45" stroke-width="2"/>
<g fill="#eef1f5" stroke="${K}" stroke-width="1.200"><circle cx="30" cy="40" r="2.200"/><circle cx="80" cy="40" r="2.200"/></g>
<path d="M20 44c3-8 12-14 22-16" stroke="#fff" stroke-opacity=".4" stroke-width="3.500" fill="none" stroke-linecap="round"/>
<path d="M12 58c0-22 20-36 43-36h7c20 2 36 14 36 36z" fill="none" stroke="${K}" stroke-width="3.500" stroke-linejoin="round"/>
${R(10, 54, 90, 6, 1, '#6a6e75', 'sh', 3)}
</g>
${P('M45 54h20v24c0 4-4 7-10 7s-10-3-10-7z', G.gold, 'vol', 3)}
<circle class="ch-gem" cx="55" cy="65" r="5.500" style="fill: var(--c, #e2453a)" stroke="${K}" stroke-width="2.500"/>
<circle cx="55" cy="65" r="5.500" fill="url(#mb-ball)"/>
<circle cx="53.200" cy="63.200" r="1.600" fill="#fff" opacity=".9"/>
<path d="M55 73v6" stroke="${K}" stroke-width="3.500" stroke-linecap="round"/>
</svg>`;
};

const chestImages = new Map<string, HTMLImageElement>();
/**
 * Le coffre en image (pour un canvas, comme la mini-carte) : fermé, ou ouvert avec la lumière de la couleur `color`
 * qui en sort. Une image par couleur et par état, gardée.
 */
export function chestImage(color: string, open: boolean) {
  const key = `${color}${open ? 'o' : ''}`;
  let img = chestImages.get(key);
  if (!img) {
    const body = chestSvg(open ? 'open' : '', color)
      .replace('<svg viewBox="0 0 124 112"', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${open ? '0 -36 124 148' : '0 0 124 112'}"`)
      .replace('<defs>', `<style>${CHEST_CSS}</style>${iconDefs()}<defs>`);
    img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(body)}`;
    chestImages.set(key, img);
  }
  return img;
}

/** Coffre fermé, gemme de la couleur `lock`. */
export const chestIcon = (cls: string, lock: number) => chestSvg(cls, `#${lock.toString(16).padStart(6, '0')}`);

/** Capsule de bière (Pièces), vue de trois quarts : toute rouge, dessus bombé et anneau imprimé, jupe crantée plus sombre. */
export const capsuleIcon = () => {
  ensureIconDefs();
  return `<svg viewBox="0 0 24 24">${cap(12, 12.5, 9.5)}</svg>`;
};
