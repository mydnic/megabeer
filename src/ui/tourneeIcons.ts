import type { TourneeId } from '../config/tournees';
import { K, G, P, C, E, R, L, spark, burst, glow, pint, svg64 } from './iconKit';

/** Texte d'étiquette (police du jeu), contour sombre. */
const T = (x: number, y: number, size: number, text: string, fill = '#fff4dc', stroke = 3) =>
  `<text x="${x}" y="${y}" text-anchor="middle" font-family="Lilita One, system-ui, sans-serif" font-size="${size}" fill="${fill}" stroke="${K}" stroke-width="${stroke}" paint-order="stroke" stroke-linejoin="round">${text}</text>`;

/** Une icône par tournée du bar (même kit que les objets : couleur, volume, contour épais). */
export const TOURNEE_ICONS: Record<TourneeId, string> = {
  // Plateau rond chargé de trois pintes, sur un éclat doré
  generale: `${burst(32, 34, 31, 20, 10, G.gold, 2.5, 0.15)}
${pint(9, 13, 0.62, -10)}${pint(36, 13, 0.62, 10)}${pint(21, 6, 0.7, 0)}
${E(32, 50, 25, 7, G.steel, 'sh')}
${L('M14 48.500c5-2 12-3 18-3', '#fff', 2.5, 0.8)}`,

  // Fût cerclé posé dans des flammes, robinet qui crache
  pression: `${P('M8 60c-4-10 2-16 6-22c1 6 4 7 6 7c-1-8 4-14 9-20c0 8 5 11 7 14c2-5 1-9 0-13c6 5 12 13 12 20c3-3 4-6 4-10c5 7 6 17 3 24z', G.fire, 'sh')}
${R(17, 18, 30, 36, 8, G.wood, 'vol')}
${R(15, 24, 34, 5, 2, G.steel, 'vol', 2.5)}${R(15, 43, 34, 5, 2, G.steel, 'vol', 2.5)}
${R(28, 8, 8, 10, 2, G.steel, 'vol', 2.5)}${P('M36 10h9v5h-4v4h-5z', G.steel, '', 2.5)}
${C(43, 24, 2.5, G.beer, '', 2)}
${T(32, 40, 13, 'x2', '#fff4dc', 3.5)}`,

  // Seau en métal plein de glaçons, givre
  seau: `${P('M12 26h40l-5 32c-.4 2.400-2 3.500-4 3.500H21c-2 0-3.600-1.100-4-3.500z', G.steel, 'vol')}
${R(9, 22, 46, 7, 3, G.steel, 'vol', 2.5)}
${R(16, 9, 14, 14, 3, G.ice, 'sh', 2.5)}${R(30, 6, 14, 14, 3, G.ice, 'sh', 2.5)}${R(38, 13, 13, 13, 3, G.ice, 'sh', 2.5)}
${L('M19 12l4 4M33 9l4 4M41 16l3 3', '#fff', 2.5, 0.9)}
${L('M20 36v18M32 36v19M44 36v18', K, 2, 0.35)}
${spark(10, 12, 5, '#f2fcff')}${spark(56, 34, 4, '#f2fcff')}`,

  // Deux pintes qui trinquent, « x2 »
  doublePinte: `${glow(32, 24, 22, 0.8)}
${pint(4, 14, 0.78, -14)}${pint(31, 14, 0.78, 14)}
${spark(32, 10, 6)}
${T(32, 60, 17, 'x2', '#ffd75e', 4)}`,

  // Petit verre à shot, flamme bleue au-dessus
  peket: `${P('M32 3c4 7 12 11 12 20c0 7-5 12-12 12s-12-5-12-12c0-5 3-8 5-10c0 4 2 6 4 6c-1-6 1-11 3-16z', G.blue, 'sh')}
${P('M32 14c2 4 6 6 6 11c0 4-3 6-6 6s-6-2-6-6c0-3 2-4 3-5c0 2 1 3 2 3c0-3 0-6 1-9z', G.ice, '', 2)}
${P('M18 32h28l-4 26c-.3 2-1.800 3-3.600 3H25.600c-1.800 0-3.300-1-3.600-3z', G.glass, 'vol')}
${P('M20.200 41h23.600l-2.200 16c-.2 1.400-1.200 2-2.600 2H25c-1.400 0-2.400-.6-2.600-2z', G.gold, '', 2)}
${L('M23 36l2.500 20', '#fff', 2.5, 0.8)}`,

  // Casque de chantier rouge, deux canettes sur les côtés, pailles jusqu'à la bouche
  casque: `${L('M14 30c-6 8-4 18 6 24M50 30c6 8 4 18-6 24', K, 6, 1)}${L('M14 30c-6 8-4 18 6 24M50 30c6 8 4 18-6 24', '#fff4dc', 3, 1)}
${P('M10 38c0-15 10-26 22-26s22 11 22 26z', G.red, 'sh')}
${R(5, 36, 54, 7, 3, G.red, 'vol', 2.5)}
${R(4, 18, 11, 18, 3, G.gold, 'vol', 2.5)}${R(49, 18, 11, 18, 3, G.gold, 'vol', 2.5)}
${L('M18 22c3-5 8-7 13-7.500', '#fff', 3, 0.7)}
${C(26, 56, 4, G.cream, '', 2)}${C(38, 56, 4, G.cream, '', 2)}`,

  // Cornet de frites, gros pâté de mayo par-dessus
  fritesMayo: `${R(16, 8, 6, 26, 2, G.gold, 'vol', 2.2)}${R(24, 4, 6, 28, 2, G.gold, 'vol', 2.2)}${R(33, 6, 6, 26, 2, G.gold, 'vol', 2.2)}${R(41, 10, 6, 24, 2, G.gold, 'vol', 2.2)}
${P('M20 18c0-6 5-9 10-8c2-4 8-4 10 0c5 0 8 4 6 9c-3 3-23 3-26-1z', G.cream, 'sh', 2.5)}
${P('M12 26h40l-6 33c-.3 1.800-1.800 3-3.600 3H21.600c-1.800 0-3.300-1.200-3.600-3z', G.red, 'vol')}
${L('M16 34h32', K, 2.5, 1)}
${T(32, 52, 11, 'MAYO', '#fffaea', 3)}`,

  // Sous-bock rond vert, trèfle à quatre feuilles
  sousBock: `${E(32, 34, 27, 25, G.green, 'sh')}
${E(32, 34, 21, 19, 'none', '', 2)}
${C(26, 28, 6, G.green, 'ball', 2.5)}${C(38, 28, 6, G.green, 'ball', 2.5)}${C(26, 40, 6, G.green, 'ball', 2.5)}${C(38, 40, 6, G.green, 'ball', 2.5)}
${L('M32 34c3 7 6 12 11 16', K, 3.5, 1)}
${spark(52, 12, 6)}${spark(10, 54, 4)}`,
};

/** Icône d'une tournée (SVG 64 x 64). */
export const tourneeIcon = (id: TourneeId, cls = 'tn-ic') => svg64(cls, TOURNEE_ICONS[id]);
