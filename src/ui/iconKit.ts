/**
 * Boîte à outils des icônes SVG : un seul style pour toute l'interface. Chaque forme est posée en trois
 * couches (couleur, volume, contour) : la couleur à plat, un dégradé de volume par-dessus (cylindre,
 * dôme ou boule, éclairés du haut à gauche), puis le contour sombre épais. Les dégradés sont déclarés
 * une fois dans la page (`ensureIconDefs`) et partagés par toutes les icônes.
 */

/** Contour commun des icônes. */
export const K = '#1a120c';

/** Couleurs de la palette des icônes (dégradés `url(#mb-...)` déclarés plus bas). */
export const G = {
  beer: 'url(#mb-beer)', foam: 'url(#mb-foam)', red: 'url(#mb-red)', wood: 'url(#mb-wood)', steel: 'url(#mb-steel)',
  gold: 'url(#mb-gold)', green: 'url(#mb-green)', blue: 'url(#mb-blue)', ice: 'url(#mb-ice)', skin: 'url(#mb-skin)',
  dark: 'url(#mb-dark)', cream: 'url(#mb-cream)', brown: 'url(#mb-brown)', leather: 'url(#mb-leather)', fire: 'url(#mb-fire)',
  pink: 'url(#mb-pink)', glass: 'url(#mb-glass)',
} as const;

const lin = (id: string, stops: [number, string, number?][], horizontal = false) =>
  `<linearGradient id="mb-${id}" x1="0" y1="0" x2="${horizontal ? 1 : 0}" y2="${horizontal ? 0 : 1}">${stops
    .map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`).join('')}</linearGradient>`;

const DEFS = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"><defs>
${lin('beer', [[0, '#ffd75e'], [0.55, '#f4a81e'], [1, '#d9740a']])}
${lin('foam', [[0, '#ffffff'], [1, '#f3dfb2']])}
${lin('red', [[0, '#ff6b55'], [0.6, '#dc3327'], [1, '#a81c1c']])}
${lin('wood', [[0, '#c98a4c'], [1, '#7a4420']])}
${lin('steel', [[0, '#f4f6f9'], [0.5, '#c2c8d0'], [1, '#868d97']])}
${lin('gold', [[0, '#fff0a0'], [0.45, '#ffc93a'], [1, '#d98a12']])}
${lin('green', [[0, '#8be05e'], [1, '#2f8a2c']])}
${lin('blue', [[0, '#7cc8ff'], [1, '#2a68b8']])}
${lin('ice', [[0, '#f2fcff'], [1, '#8fd0f5']])}
${lin('skin', [[0, '#ffd3ad'], [1, '#e39a6c']])}
${lin('dark', [[0, '#565c66'], [1, '#22262b']])}
${lin('cream', [[0, '#fffaea'], [1, '#e8d3a6']])}
${lin('brown', [[0, '#7a4424'], [1, '#3e2010']])}
${lin('leather', [[0, '#a8683a'], [1, '#6a3a1c']])}
${lin('fire', [[0, '#ffe36a'], [0.5, '#ff9a2a'], [1, '#e2452a']])}
${lin('pink', [[0, '#ffb0c0'], [1, '#e2557a']])}
${lin('glass', [[0, '#ffffff', 0.55], [1, '#bfe6ff', 0.25]])}
${lin('vol', [[0, '#000', 0.3], [0.2, '#fff', 0], [0.32, '#fff', 0.42], [0.46, '#fff', 0], [0.68, '#000', 0], [1, '#000', 0.36]], true)}
${lin('sh', [[0, '#fff', 0.28], [0.45, '#fff', 0], [0.6, '#000', 0], [1, '#000', 0.3]])}
<radialGradient id="mb-ball" cx="0.36" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity="0.65"/><stop offset="0.35" stop-color="#fff" stop-opacity="0"/><stop offset="0.65" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.42"/></radialGradient>
<radialGradient id="mb-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="0.4" stop-color="#ffe9a0" stop-opacity="0.55"/><stop offset="1" stop-color="#ffc93a" stop-opacity="0"/></radialGradient>
</defs></svg>`;

let injected = false;
/** Déclare les dégradés dans la page (une fois). Sans document (tests), ne fait rien. */
export function ensureIconDefs() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const host = document.createElement('div');
  host.innerHTML = DEFS;
  document.body.appendChild(host.firstElementChild!);
}

type Vol = 'vol' | 'sh' | 'ball' | '';
const layers = (el: string, fill: string, vol: Vol, sw: number) =>
  `<${el} fill="${fill}"/>${vol ? `<${el} fill="url(#mb-${vol})"/>` : ''}${sw > 0 ? `<${el} fill="none" stroke="${K}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>` : ''}`;

/** Forme libre : couleur, volume (`vol` cylindre, `sh` dôme, `ball` boule, '' à plat), contour. */
export const P = (d: string, fill: string, vol: Vol = 'sh', sw = 3) => layers(`path d="${d}"`, fill, vol, sw);
export const C = (cx: number, cy: number, r: number, fill: string, vol: Vol = 'ball', sw = 3) => layers(`circle cx="${cx}" cy="${cy}" r="${r}"`, fill, vol, sw);
export const E = (cx: number, cy: number, rx: number, ry: number, fill: string, vol: Vol = 'sh', sw = 3) =>
  layers(`ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"`, fill, vol, sw);
export const R = (x: number, y: number, w: number, h: number, rx: number, fill: string, vol: Vol = 'sh', sw = 3) =>
  layers(`rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"`, fill, vol, sw);

/** Trait (reflet par défaut : blanc translucide, bouts ronds). */
export const L = (d: string, color = '#fff', w = 2.5, opacity = 0.75) =>
  `<path d="${d}" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

/** Étincelle à quatre branches. */
export const spark = (cx: number, cy: number, r: number, fill = '#fff', sw = 1.5) =>
  `<path d="M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}z" fill="${fill}"${sw > 0 ? ` stroke="${K}" stroke-width="${sw}" stroke-linejoin="round"` : ''}/>`;

/** Étoile d'éclat (pointes alternées `r1` / `r2`), pour les fonds « coup de poing ». */
export const burst = (cx: number, cy: number, r1: number, r2: number, n: number, fill: string, sw = 2.5, rot = 0) => {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n, r = i % 2 ? r2 : r1;
    pts.push(`${(cx + Math.sin(a) * r).toFixed(1)} ${(cy - Math.cos(a) * r).toFixed(1)}`);
  }
  return P(`M${pts.join('L')}z`, fill, '', sw);
};

/** Halo doux (lumière derrière un objet). */
export const glow = (cx: number, cy: number, r: number, opacity = 1) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#mb-glow)" opacity="${opacity}"/>`;

/**
 * Pinte de bière pleine avec sa mousse qui déborde : dessinée dans une boîte de 30 x 44 (mousse au-dessus),
 * placée en (`x`, `y`) à l'échelle `s`, penchée de `rot` degrés. `beer` : couleur de la bière.
 */
export const pint = (x: number, y: number, s = 1, rot = 0, beer: string = G.beer) => {
  const sw = 3 / s;
  return `<g transform="translate(${x} ${y}) rotate(${rot} 15 22) scale(${s})">
<path d="M2 6h26l-3 38H5z" fill="${beer}"/><path d="M2 6h26l-3 38H5z" fill="url(#mb-vol)"/>
<circle cx="18" cy="24" r="1.6" fill="#fff" opacity=".55"/><circle cx="14" cy="33" r="1.2" fill="#fff" opacity=".5"/><circle cx="21" cy="36" r="1" fill="#fff" opacity=".45"/>
<path d="M2 6h26l-3 38H5z" fill="none" stroke="${K}" stroke-width="${sw}" stroke-linejoin="round"/>
<path d="M22 12v8.5a2.6 2.6 0 0 1-5.2 0V11z" fill="url(#mb-foam)" stroke="${K}" stroke-width="${sw * 0.8}" stroke-linejoin="round"/>
<path d="M.5 8c-2.5-4 0-8.5 4.5-8.5c1.5-4 7.5-5 10-1.500c2.500-3.500 8.500-3 10 1c4.500-.5 7.500 3.500 5.500 7.500c.5 3-1.500 5-4 5H4c-3 0-4.500-2-3.500-3.500z" fill="url(#mb-foam)" stroke="${K}" stroke-width="${sw}" stroke-linejoin="round"/>
<path d="M5 4c1-2 3-3 5-2.500" stroke="#fff" stroke-width="${2 / s}" fill="none" stroke-linecap="round"/>
<path d="M7.500 15l1.800 24" stroke="#fff" stroke-opacity=".7" stroke-width="${2.6 / s}" fill="none" stroke-linecap="round"/>
</g>`;
};

/** Capsule de bière vue de trois quarts (dessus bombé, jupe crantée), centrée en (`cx`, `cy`), demi-largeur `r`. */
export const cap = (cx: number, cy: number, r: number, top = '#e2362e', skirt = '#a81c1c') => {
  const s = r / 9.5;
  return `<g transform="translate(${cx - 12 * s} ${cy - 9 * s}) scale(${s})">
<path d="M2.5 9L2.1 14.6L4.2 13.8L6.4 15.6L8.6 14.7L10.9 16.2L13.1 14.9L15.4 16L17.6 14.4L19.9 15.2L21.9 13.5L21.5 9z" fill="${skirt}" stroke="${K}" stroke-width="${1.7 / s * s}" stroke-linejoin="round"/>
<path d="M5.7 11.500v2.500M8.800 12.500v2.300M12 13v2.200M15.200 12.500v2.300M18.300 11.500v2.500" stroke="#000" stroke-opacity=".3" stroke-width="1"/>
<ellipse cx="12" cy="9" rx="9.500" ry="4.200" fill="${top}"/><ellipse cx="12" cy="9" rx="9.500" ry="4.200" fill="url(#mb-ball)"/>
<ellipse cx="12" cy="9" rx="9.500" ry="4.200" fill="none" stroke="${K}" stroke-width="1.700"/>
<ellipse cx="12" cy="9" rx="5.200" ry="2.200" fill="none" stroke="#fff4dc" stroke-width="1.200"/>
<path d="M5.500 7.600a6.500 2.800 0 0 1 4-1.700" stroke="#fff" stroke-opacity=".85" stroke-width="1.200" fill="none" stroke-linecap="round"/></g>`;
};

export const svg64 = (cls: string, body: string) => {
  ensureIconDefs();
  return `<svg viewBox="0 0 64 64" class="${cls}">${body}</svg>`;
};
