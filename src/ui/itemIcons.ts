import type { ItemId } from '../config/items';
import { K, G, P, C, E, R, L, spark, burst, glow, pint, cap, svg64 } from './iconKit';

/** Texte d'étiquette (police du jeu), contour sombre fin. */
const T = (x: number, y: number, size: number, text: string, fill = '#fff4dc', stroke = 0) =>
  `<text x="${x}" y="${y}" text-anchor="middle" font-family="Lilita One, system-ui, sans-serif" font-size="${size}" fill="${fill}"${stroke ? ` stroke="${K}" stroke-width="${stroke}" paint-order="stroke" stroke-linejoin="round"` : ''}>${text}</text>`;

/** Une icône par objet de coffre (ajouter un objet = ajouter son icône ici). */
export const ITEM_ICONS: Record<ItemId, string> = {
  // Bouteille trapue de bière forte sur un éclat doré, étiquette rouge « 12° »
  biereForte: `${burst(32, 33, 30, 19, 9, G.gold, 2.5, 0.2)}
${R(26.5, 3, 11, 6.5, 1.5, G.gold, 'vol', 2.5)}
${P('M27.5 9h9v8c0 3.500 9 6 9 15v24c0 2.500-2 4.500-4.500 4.500h-18c-2.500 0-4.500-2-4.500-4.500V32c0-9 9-11.500 9-15z', '#7a3610', 'vol')}
${P('M18.500 35h27v17h-27z', G.red, 'vol', 2.5)}
${T(32, 48.5, 12.5, '12°')}
${L('M23 27c.8-3 2.600-5 4.600-6.200')}`,

  // Pinte lancée à toute vitesse, penchée, traits de vitesse et mousse qui file
  tourneeRapide: `${L('M3 22h12M6 33h11M3 44h10', K, 6, 1)}${L('M3 22h12M6 33h11M3 44h10', '#fff4dc', 3, 1)}
${C(15, 14, 3, G.foam, '', 2)}${C(9, 9, 2, G.foam, '', 1.8)}
${pint(24, 13, 1.02, 14)}`,

  // Gros ventre rond qui dépasse d'un t-shirt trop court, nombril, ceinture
  ventreABiere: `${P('M12 50h40v9c0 1.500-1.500 3-3 3H15c-1.500 0-3-1.500-3-3z', '#3d4f7a', 'sh')}
${E(32, 40, 23, 17.5, G.skin, 'ball')}
${L('M32 46.500c-1.200 1-1.200 2.600 0 3.400', K, 2.2, 0.85)}
${L('M16 36c1.500-4 4.500-7 8.500-8.500', '#fff', 3, 0.55)}
${P('M9 8c5-3 10-4.500 14-4.500c2 3 16 3 18 0c4 0 9 1.500 14 4.500l5 13l-9 3.500v5c-6-4.500-32-4.500-38 0v-5L4 21z', '#f4f1ea', 'sh')}
${L('M23 3.500c2 5 16 5 18 0', K, 2.5, 1)}
${T(32, 21, 9, 'BIÈRE', '#d23b2a')}
${R(8, 52, 48, 6.5, 2, G.leather, 'sh', 2.5)}${R(27, 50.5, 10, 9.5, 2, G.gold, 'sh', 2.5)}`,

  // Godasse de cuir montante, lacets, grosse semelle crantée
  godasses: `${P('M15 7h20c1 8 1.500 16 1.500 24c7 2.500 18 4 21.500 11v8H7V39c0-4 3.500-6 8-8z', G.leather, 'sh')}
${P('M36.500 31c7 2.500 18 4 21.500 11v8H40c-1-7-2-13-3.500-19z', '#5a2f16', '', 0)}
${P('M15 7h20c1 8 1.500 16 1.500 24c7 2.500 18 4 21.500 11v8H7V39c0-4 3.500-6 8-8z', 'none', '', 3)}
${P('M5 50h55v5.500c0 2-1.800 3.500-3.800 3.500H50l-2-3h-6l-2 3H9c-2.200 0-4-1.500-4-3.500z', G.dark, 'sh')}
${R(13, 4, 24, 7, 2.5, '#7a4424', 'sh', 2.5)}
${L('M22 17l10 3.500M22 23l10.500 3.500M22 29l11 3.500', '#fff4dc', 2.6, 1)}
${L('M12 41c3.500-2.500 7.500-2.500 10 0', '#fff', 2.5, 0.5)}`,

  // Aimant en fer à cheval qui attire une capsule dans des éclairs
  aimantCapsules: `<g transform="rotate(-38 24 26)">
${P('M6 40V22C6 11 14 3 24 3s18 8 18 19v18H31V22c0-4.500-3-7.500-7-7.500s-7 3-7 7.500v18z', G.red, 'sh')}
${P('M6 40h11v-9H6zM31 40h11v-9H31z', G.steel, 'sh', 3)}</g>
${L('M39 37l3.500 2.500l-2.500 2l4.500 3', '#ffe36a', 2.6, 1)}${L('M46 31l3.500 2.500l-2 2l4 3', '#ffe36a', 2.6, 1)}
${cap(49, 52, 11)}`,

  // Ticket de tournée doré, bords découpés, pinte imprimée
  ticketTournee: `<g transform="rotate(-14 32 32) translate(2.500 2.500) scale(.92)">
${P('M3 17h58v9a6 6 0 0 0 0 12v9H3v-9a6 6 0 0 0 0-12z', G.gold, 'sh')}
${L('M19 19.500v25', K, 2, 0.6).replace('stroke-linecap="round"', 'stroke-dasharray="3 3.200"')}
${T(11.5, 38, 15, '1', '#c4560f')}
${pint(29, 23.5, 0.5)}
${L('M24 21h34', '#fff', 2.2, 0.8)}
${spark(52, 38, 5, '#fff', 0.9)}</g>`,

  // Trèfle à quatre feuilles bien charnu
  trefle: `${L('M33 36c2.500 9 6.500 16 13 22', K, 7, 1)}${L('M33 36c2.500 9 6.500 16 13 22', '#3f9a36', 3.6, 1)}
<g>${[0, 90, 180, 270].map((a) => `<g transform="rotate(${a} 32 31)">${P('M32 31C24 29 15.500 22 18 13.500c2-6.500 11-6.500 14 1c3-7.500 12-7.500 14-1c2.500 8.500-6 15.500-14 17.500z', G.green, 'ball')}${L('M32 29V18', '#1f6a1e', 1.6, 0.7)}</g>`).join('')}</g>
${L('M22 14.500c1.200-2.600 3.800-3.600 6.200-2.400', '#fff', 2.6, 0.8)}${spark(52, 12, 6, '#fff4dc', 0.9)}`,

  // Deux pintes qui trinquent, éclat et mousse qui gicle
  deuxMains: `${burst(32, 14, 13, 6, 7, '#fff4dc', 2, 0.3)}
${pint(3, 18, 0.92, -17)}
${pint(33, 18, 0.92, 17, '#e98a1c')}
${C(32, 6, 2.6, G.foam, '', 1.8)}${C(22, 4, 1.8, G.foam, '', 1.5)}${C(43, 5, 1.8, G.foam, '', 1.5)}`,

  // Cendrier en verre épais, mégot qui fume, braises
  cendrier: `${P('M5 38c0 10 12 17 27 17s27-7 27-17v-5H5z', '#6f9bb0', 'vol')}
${E(32, 33, 27, 11, '#b4d6e2', 'sh')}
${E(32, 34.5, 17, 6.5, '#4a5a64', 'sh', 2.5)}
${C(27, 35, 2.2, '#ff7a2a', '', 0)}${C(33, 37, 1.6, '#ffc93a', '', 0)}${C(37, 34, 1.4, '#ff7a2a', '', 0)}
${L('M31 33.500l21-9', K, 8, 1)}${L('M31 33.500l21-9', '#fff4dc', 5, 1)}${L('M46.500 27l5.500-2.500', '#e08a3a', 5, 1)}
${L('M54 20c-3.500-4 2.500-6-.5-10s2.500-5.500 1-8.500', '#e8dcc6', 3, 0.9)}
${L('M11 45c4.500 3.500 11 5.500 18 5.500', '#fff', 2.6, 0.7)}
${spark(13, 15, 5, '#ff9a2a', 0.9)}${spark(22, 8, 3.5, '#ffc93a', 0.9)}`,

  // Écu de mousse épaisse et brillante, bulles dedans
  mousseEpaisse: `${P('M32 3l23 8v17c0 15.500-10.500 27-23 33C19.500 55 9 43.500 9 28V11z', G.foam, 'sh', 3.5)}
${P('M32 9.500l17 6v12.500c0 11.500-7.500 20-17 25c-9.500-5-17-13.500-17-25V15.500z', G.beer, 'sh', 2.5)}
${C(25, 25, 5.5, G.foam, 'ball', 2)}${C(38, 22, 4.2, G.foam, 'ball', 2)}${C(33, 35, 6.5, G.foam, 'ball', 2)}${C(23.5, 38, 3, G.foam, 'ball', 1.8)}${C(42, 33, 3, G.foam, 'ball', 1.8)}
${L('M13.500 13.500l6-2.200', '#fff', 3, 1)}${spark(51, 9, 5.5, '#fff', 0.9)}`,

  // Horloge de bar à l'heure de l'apéro, pinte devant
  happyHour: `${C(27, 27, 24, G.gold, 'ball')}
${C(27, 27, 17.5, G.cream, 'sh', 2.5)}
${L('M27 12.500v3M41.500 27h-3M27 41.500v-3M12.500 27h3', K, 2.6, 1)}
${L('M27 27V17M27 27l7.500 4.500', K, 3.2, 1)}${C(27, 27, 2.6, G.red, '', 1.5)}
${L('M10 18c2-4 5-7 9-8.500', '#fff', 2.6, 0.8)}
${pint(36, 30, 0.74, 6)}`,

  // Sachet de cacahuètes ouvert, deux cacahuètes qui s'échappent
  cacahuetes: `${P('M9 21l4-13l5 3l5-3l5 3l5-3l5 3l4-3l3 13l-2 37c0 1.500-1.200 2.500-2.500 2.500H13.500c-1.300 0-2.500-1-2.500-2.500z', G.red, 'vol')}
${P('M14 31h26v15H14z', G.gold, 'sh', 2.5)}
${P('M19.500 38.500c0-3.500 3.500-5 6-3.500s4.500.5 6-.8s5 .8 4 4.300s-3.500 4.500-6 3.500s-4.500-.5-6 .8s-4-.8-4-4.300z', '#c98a4a', 'sh', 1.8)}
${L('M14 24l1.800 28', '#fff', 2.6, 0.6)}
<g transform="rotate(24 51 20)">${P('M46 11c3-2.500 8-1.500 9 2.500s-.5 5.500 1.500 8s-.5 8-5 7s-5.500-3.500-7.500-5s-2.500-9 2-12.500z', '#e6b57e', 'ball', 2.4)}${L('M48 16l2 2.500M51 22l1.500 2M53 15l1 2', '#a87048', 1.6, 1)}</g>
<g transform="rotate(-20 52 46)">${P('M48 38c3-2 7-.5 7.500 3s-.5 4.500 1 6.500s-.5 6.500-4.500 6s-4.500-3-6-4.500s-1.500-8 2-11z', '#e6b57e', 'ball', 2.4)}${L('M49.500 42l1.500 2M52 47.500l1 1.500', '#a87048', 1.6, 1)}</g>`,

  // Pinte énorme qui déborde du cadre, flèches d'agrandissement
  pinteXXL: `${pint(10.5, 12, 1.42, 0)}
${P('M2 34l8-8v5h5v6h-5v5z', '#fff4dc', '', 2.2)}${P('M62 34l-8-8v5h-5v6h5v5z', '#fff4dc', '', 2.2)}`,

  // Dürüm roulé dans son alu : viande, salade, tomate, sauce blanche
  kebab: `<g transform="rotate(-18 32 34)">
${P('M17 30h30l-6 28c-.5 2.500-2.500 4-5 4h-8c-2.500 0-4.500-1.500-5-4z', G.steel, 'vol')}
${L('M22 38l4 4l-3 5l4 5M40 36l-3 5l3 4l-3 6', K, 1.6, 0.35)}
${P('M13 30c-2-9 5-18 19-18s21 9 19 18c-1 3-37 3-38 0z', '#e9bd76', 'sh')}
${P('M18 26c1-6 6-10 14-10s13 4 14 10c-3 3-25 3-28 0z', '#8a4a22', 'sh', 2.5)}
${C(24, 21, 3.6, G.red, 'ball', 2)}${C(39, 21.500, 3.2, G.red, 'ball', 2)}
${L('M19 28c2.500-3.500 5.500-3.500 7.500-.5M28.500 23c2.500-3 5.500-2.500 7 0M36 28.500c2.500-3 5.500-3 8-.5', '#6cc84a', 3.6, 1)}
${L('M17 31.500c5 2.500 25 2.500 30 0', '#fff4dc', 4, 1)}</g>`,

  // Verre à shot renversé d'un coup sec, gouttes dorées
  culSec: `<g transform="rotate(-38 32 34)">
${P('M19 16h26l-4.500 36h-17z', '#dfeaf2', 'vol')}
${P('M21.500 20h21l-1.500 12.500H23z', G.beer, '', 0)}
${P('M22.500 46h19l-.8 6H23.300z', '#a9bccb', '', 0)}
${L('M24 21l2.500 26', '#fff', 2.8, 0.85)}</g>
${P('M49 8c3 4 5 6.500 5 9.500a5 5 0 0 1-10 0c0-3 2-5.500 5-9.500z', G.beer, 'ball', 2.2)}
${P('M57 24c2 2.800 3.500 4.500 3.500 6.600a3.500 3.500 0 0 1-7 0c0-2.100 1.500-3.800 3.500-6.600z', G.beer, 'ball', 2)}
${L('M5 52l7-2M4 43h7', '#ffc93a', 3, 1)}`,

  // Briquet tempête ouvert, grande flamme à deux tons
  briquet: `${glow(32, 16, 18, 0.8)}
${P('M32 2c7 6.500 11.500 12 11.500 18.500c0 6.500-4.500 10.500-11.500 10.500s-11.500-4-11.500-10.500c0-4.500 3-7 5.500-11c1 4 2.800 5.500 5 5.500c.5-5-1.500-8.500 1-13z', G.fire, '', 2.6)}
${P('M32 15c3.500 3.500 5 6.500 5 9c0 3.500-2.200 5-5 5s-5-1.500-5-5c0-3.500 3.500-5.500 5-9z', '#fff4b0', '', 0)}
${R(19.5, 31, 25, 8, 1.5, G.steel, 'vol', 2.6)}
${C(40, 35, 2, '#5c6168', '', 1.4)}
${R(17.5, 39, 29, 22, 4.5, G.red, 'vol')}
${L('M22.500 44v12', '#fff', 2.8, 0.65)}`,

  // Canette verte « 0,0 % » et croix de soin
  sansAlcool: `${R(9, 6, 31, 54, 5, G.green, 'vol')}
${E(24.5, 8, 13, 3.2, G.steel, 'sh', 2.5)}
${P('M10.500 25h28v17h-28z', G.cream, 'vol', 2)}
${T(24.5, 38, 10.5, '0,0%', '#2f7a2c')}
${C(48, 42, 13, G.red, 'ball')}
${L('M48 34.500v15M40.500 42h15', K, 7.5, 1)}${L('M48 34.500v15M40.500 42h15', '#fff', 4.5, 1)}`,

  // Bonnet du Père Noël, bord en fourrure, pompon
  bonnet: `${P('M9 46C10 26 22 9 41 10c7 .5 12 6 14.500 13c-7-3-12.500-1-14.500 4c5.500 4 7.500 10 7.500 19z', G.red, 'sh')}
${L('M17 37c2.500-9 9-17 18-19.500', '#fff', 3, 0.5)}
${P('M9 42c-3.500 0-6 2.500-6 6s2.500 6.500 6 6.500c2 2 5 2 7 .5c2 2 5.500 2 7.500 0c2 2 5.500 2 7.500 0c2 2 5.500 2 7.500 0c2 1.500 5 1.500 7-.5c3.500 0 6-3 6-6.500s-2.500-6-6-6z', G.foam, 'sh')}
${C(56, 25, 6.5, G.foam, 'ball', 2.6)}${spark(11, 13, 5.5, '#fff4dc', 0.9)}`,

  // Seau à champagne argenté rempli de glaçons, givre
  seauAGlace: `${P('M13 19l7-8l9 3l9-7l8 5l5 7z', G.ice, 'sh', 2.6)}${L('M21 15l5 2M38 11l4 3', '#fff', 2.2, 0.9)}
${P('M7 21h50l-6 36c-.3 1.800-1.800 3-3.500 3h-31c-1.700 0-3.200-1.200-3.500-3z', G.steel, 'vol')}
${R(4.5, 17.5, 55, 7, 3.5, G.steel, 'sh')}
${L('M12 34h40M14 47h36', '#5c6168', 2, 0.6)}
${C(5, 33, 3.5, 'none', '', 2.6)}${C(59, 33, 3.5, 'none', '', 2.6)}
${L('M17 29l2.500 25', '#fff', 3, 0.8)}${spark(46, 40, 5, '#fff', 0.9)}`,

  // Manomètre de fût dans le rouge
  pression: `${P('M24 46h16v10c0 2-1.500 3.500-3.500 3.500h-9c-2 0-3.500-1.500-3.500-3.500z', G.steel, 'vol')}
${C(32, 28, 25, G.steel, 'ball')}
${C(32, 28, 19, G.cream, 'sh', 2.5)}
<path d="M19.300 35.300a14.500 14.500 0 0 1 7-20.300" stroke="#4fb84a" stroke-width="4.500" fill="none"/>
<path d="M27.500 14.300a14.500 14.500 0 0 1 12.500 1.600" stroke="#ffc93a" stroke-width="4.500" fill="none"/>
<path d="M41 16.600a14.500 14.500 0 0 1 3.700 18.700" stroke="#e2362e" stroke-width="4.500" fill="none"/>
${L('M32 28l9.500-7.500', K, 3.4, 1)}${C(32, 28, 3.2, G.red, '', 1.8)}
${T(32, 42, 7, 'BAR', '#5c6168')}
${L('M14 18c2-4 5.500-7 9.500-8.500', '#fff', 2.6, 0.85)}`,

  // Tête des lendemains difficiles : poche de glace, yeux en croix, étoiles
  gueuleDeBois: `${C(32, 37, 22.5, G.skin, 'ball')}
${L('M21 38l6.500 5M27.500 38l-6.500 5M36.500 38l6.500 5M43 38l-6.500 5', K, 2.8, 1)}
${L('M25 52c2.500-2 4.500 1.500 7 0s4.500-2 7 0', K, 2.6, 1)}
${E(18, 47, 4, 2.5, '#ff8a7a', '', 0)}${E(46, 47, 4, 2.5, '#ff8a7a', '', 0)}
${P('M11 25c1-11 12-17 22-16s19 6 20 14c-7 5-34 7-42 2z', G.blue, 'sh')}
${R(26, 3, 12, 7, 2.5, '#2a68b8', 'sh', 2.5)}
${L('M17 21c2-5 6.500-8 12-8.500', '#fff', 2.6, 0.7)}
${spark(56, 12, 5, '#ffc93a', 0.9)}${spark(7, 14, 4, '#ffc93a', 0.9)}`,

  // Gant de boxe rouge, poignet lacé, éclat d'impact
  gantsVideur: `${burst(46, 16, 15, 8, 8, G.gold, 2.2, 0.2)}
${P('M13 31C13 16 21 5 35 5c12 0 19 8 19 19c0 8-4 14.500-10.500 17H19.500c-4-2-6.500-5.500-6.500-10z', G.red, 'ball')}
${P('M14 28c-6.500-2.500-9.500 5.500-5.500 10.500c3 3.500 8.500 3 11 .5z', G.red, 'ball')}
${L('M27 26c5 2.500 12 2.500 17-.5', K, 2.4, 0.5)}
${P('M17.500 41h29v15c0 1.500-1.200 2.800-2.800 2.800H20.300c-1.500 0-2.800-1.200-2.800-2.800z', G.cream, 'vol')}
${L('M25 45l5 5l-5 5M39 45l-5 5l5 5', G.red, 2.2, 1)}
${L('M21 15c3.500-4 9-5.500 14-4.500', '#fff', 3.2, 0.75)}`,

  // Lunettes rondes à gros verres, reflets
  lunettes: `${L('M3 25l7-6M61 25l-7-6', K, 3.5, 1)}
${C(18.5, 35, 14, G.dark, '', 3)}${C(45.5, 35, 14, G.dark, '', 3)}
${C(18.5, 35, 9.5, G.ice, 'ball', 2.2)}${C(45.5, 35, 9.5, G.ice, 'ball', 2.2)}
${L('M29.500 31c1.500-2.500 3.500-2.500 5 0', K, 4.5, 1)}
${L('M12.500 33l6-5.500M16 37l5.500-5M39.500 33l6-5.500M43 37l5.500-5', '#fff', 2.4, 0.95)}
${spark(54, 14, 5, '#fff', 0.9)}`,

  // Écharpe de supporter rayée, franges
  echarpe: `${P('M5 15c16-7 38-7 54 0v12c-16-7-38-7-54 0z', G.red, 'sh')}
<g stroke="#fff4dc" stroke-width="5"><path d="M15 11v12.500M26 9v12.500M38 9v12.500M49 11v12.500"/></g>
${P('M5 15c16-7 38-7 54 0v12c-16-7-38-7-54 0z', 'none', '', 3)}
${P('M38 22l6 34H31l-3-33z', G.red, 'vol')}
<g stroke="#fff4dc" stroke-width="4.500"><path d="M30 32l11.500-1M31.500 43l12-1"/></g>
${P('M38 22l6 34H31l-3-33z', 'none', '', 3)}
${L('M32.500 56v6M37.500 56v6M42.500 56v6', K, 2.8, 1)}
${P('M29 19c2-3.500 9-3.500 11 0l-1 6.500c-2.500-2-6.500-2-9 0z', '#b81f1f', 'sh', 2.6)}`,

  // Boule de pétanque striée et son cochonnet
  cochonnet: `${E(27, 58, 20, 3.5, K, '', 0).replace('fill="' + K + '"', `fill="${K}" opacity=".3"`)}
${C(26, 37, 21, '#aab1ba', 'ball')}
<g stroke="#5c6168" stroke-width="2.200" fill="none" opacity=".8"><path d="M7 30c9 4.500 29 4.500 38 0M5.500 41c10 5 31 5 41 0"/><path d="M26 16v42"/></g>
${L('M12 27c2.500-5 6.500-8 12-9', '#fff', 3.2, 0.9)}
${C(51, 16, 8.5, G.gold, 'ball')}${spark(57, 31, 4, '#fff4dc', 0.9)}`,

  // Bouteille verte qui titube, traits de déséquilibre, hoquets
  demarche: `<g transform="rotate(20 32 36)">
${R(27, 3, 10, 6, 1.5, G.gold, 'vol', 2.4)}
${P('M28 8h8v11c0 3.500 8.500 6 8.500 14.500V56c0 2.500-2 4.500-4.500 4.500H24c-2.500 0-4.500-2-4.500-4.500V33.500c0-8.500 8.500-11 8.500-14.500z', '#3f8a36', 'vol')}
${P('M19.500 35h25v12h-25z', G.cream, 'vol', 2.2)}
${spark(32, 41, 4, '#d23b2a', 0)}</g>
${L('M4 22c3-2.500 5 2.500 8 0M2 34c3-2.500 5 2.500 8 0', '#fff4dc', 3, 0.95)}${L('M52 47c3-2.500 5 2.500 8 0', '#fff4dc', 3, 0.95)}
${C(10, 9, 3, 'none', '', 2)}${C(17, 4.500, 1.8, 'none', '', 1.6)}`,

  // Ressort de canapé qui bondit
  ressort: `${R(8, 54, 48, 6.5, 3, G.dark, 'sh')}
${L('M19 54c0-4.500 26-3.500 26-8.500s-26-4-26-9s26-4-26-9s-26-4-26-9s26-4-26-9', K, 8, 1).replace('M19 54c0-4.500 26-3.500 26-8.500s-26-4-26-9s26-4-26-9s-26-4-26-9s26-4-26-9', 'M19 54c0-4.500 26-3.500 26-8.500s-26-4-26-9s26-4 26-9s-26-4-26-9s26-4 26-9')}
${L('M19 54c0-4.500 26-3.500 26-8.500s-26-4-26-9s26-4 26-9s-26-4-26-9s26-4 26-9', '#d7dce3', 4.6, 1)}
${L('M21 50.500c3-1.500 16-1.500 21-4M21 32.500c3-1.500 16-1.500 21-4', '#fff', 1.6, 0.9)}
${R(15, 6, 34, 6.5, 3, G.red, 'sh', 2.6)}
${L('M7 12l5 3M57 12l-5 3M32 1v3', '#ffc93a', 3, 1)}`,

  // Pinte vide derrière, pinte dorée ressuscitée devant, auréole
  secondeTournee: `${glow(40, 30, 26, 0.9)}
<g opacity=".9">${pint(3, 22, 0.8, -8, '#8a6a4a')}</g>
${pint(26, 15, 1.04, 5)}
<ellipse cx="42" cy="6.500" rx="12" ry="3.600" fill="none" stroke="${K}" stroke-width="5"/><ellipse cx="42" cy="6.500" rx="12" ry="3.600" fill="none" stroke="#ffe36a" stroke-width="2.600"/>
${spark(58, 22, 5.5, '#fff', 0.9)}`,

  // Carte de fidélité tamponnée, dernier tampon à gagner
  carteFidelite: `<g transform="rotate(-8 32 32)">
${R(3, 12, 58, 40, 6, G.cream, 'sh')}
${P('M4.500 20h55v8h-55z', G.red, '', 0)}
${T(32, 27, 7, 'FIDÉLITÉ', '#fff4dc')}
${cap(14, 39.5, 6.2)}${cap(27.5, 39.5, 6.2)}${cap(41, 39.5, 6.2)}
<circle cx="52.500" cy="40" r="5.200" fill="none" stroke="${K}" stroke-width="2" stroke-dasharray="3 2.400"/>
${R(3, 12, 58, 40, 6, 'none', '', 3)}</g>
${spark(56, 12, 5.5, '#ffc93a', 0.9)}`,

  // Trois glaçons translucides, arêtes brillantes
  glacons: `${[[19, 5], [5, 25], [29, 29]].map(([x, y]) => `<g transform="translate(${x} ${y})">
${P('M0 9.500L14 3l14 6.500V25l-14 6.500L0 25z', G.ice, '', 3)}
<path d="M0 9.500L14 16v15.500L0 25z" fill="#5fb0e6" opacity=".55"/><path d="M28 9.500L14 16v15.500L28 25z" fill="#2a68b8" opacity=".35"/>
${L('M0 9.500L14 16l14-6.500M14 16v15.500', K, 2, 0.75)}${L('M4 10l10-4.500', '#fff', 2.6, 1)}
${P('M0 9.500L14 3l14 6.500V25l-14 6.500L0 25z', 'none', '', 3)}</g>`).join('')}
${spark(54, 14, 5.5, '#fff', 0.9)}`,

  // Cloche du dernier service qui sonne
  lastOrder: `${L('M5 17l6 4M3 30h6M59 17l-6 4M61 30h-6', '#ffc93a', 3.2, 1)}
${C(32, 55, 5, G.dark, 'ball', 2.6)}
${P('M13 46C13 26 20 13 32 13s19 13 19 33z', G.gold, 'vol')}
${R(8, 44, 48, 7.5, 3.5, G.gold, 'sh')}
${C(32, 9, 4.6, G.gold, 'ball', 2.6)}
${L('M21 40c0-10 3-17 8.500-21', '#fff', 3.4, 0.8)}`,

  // Ardoise de bar : bâtons de comptage à la craie, total souligné
  ardoise: `<g transform="rotate(-5 32 32)">
${R(4, 6, 56, 50, 4.5, G.wood, 'sh')}
${R(10, 12, 44, 38, 1.5, '#2b3438', 'sh', 2.2)}
${L('M17 19v13M22 19v13M27 19v13M32 19v13M14.500 30l20-9', '#fff4dc', 2.4, 0.95)}
${L('M40 19v13M45 19v13', '#fff4dc', 2.4, 0.95)}
${L('M17 39h17M17 44h10', '#ffc93a', 2.4, 0.95)}
${T(44, 46, 10, '€', '#ff8a7a')}</g>
${R(43, 52, 15, 6, 2, '#fff4dc', 'sh', 2.2)}`,

  // Juke-box rétro : arche lumineuse, grille, notes de musique
  jukeBox: `${P('M10 60V26C10 13 20 4 32 4s22 9 22 22v34z', G.red, 'vol')}
${P('M16 30c0-9 7-16 16-16s16 7 16 16v9H16z', G.gold, 'sh', 2.6)}
${P('M21.500 31c0-6 4.700-10.500 10.500-10.500S42.500 25 42.500 31v8h-21z', '#3a1a3f', 'sh', 2.2)}
${C(32, 31, 5.5, '#22262b', 'ball', 1.8)}${C(32, 31, 1.6, G.gold, '', 0)}
${R(16, 43, 32, 12, 2, G.dark, 'sh', 2.6)}
${L('M21 47v4M25.500 47v4M30 47v4M34.500 47v4M39 47v4M43.500 47v4', '#7cc8ff', 2.2, 1)}
${L('M14 26c.5-7 4.500-13 10.500-16', '#fff', 2.6, 0.6)}
<g transform="translate(47 2)">${L('M4 12V2l8-2v9', K, 4.6, 1)}${L('M4 12V2l8-2v9', '#fff4dc', 2, 1)}${C(2.5, 12, 3, '#fff4dc', '', 1.8)}${C(10.5, 9.500, 3, '#fff4dc', '', 1.8)}</g>`,

  // Bretelles croisées à pinces
  bretelles: `${P('M13 8h9l25 48h-9z', G.red, 'vol')}${P('M51 8h-9L17 56h9z', G.red, 'vol')}
${L('M19 12l22 42', '#fff4dc', 1.8, 0.6)}${L('M45 12L23 54', '#fff4dc', 1.8, 0.6)}
${R(9, 2, 17, 9, 2.5, G.steel, 'sh', 2.6)}${R(38, 2, 17, 9, 2.5, G.steel, 'sh', 2.6)}
${R(13, 53, 16, 9, 2.5, G.steel, 'sh', 2.6)}${R(35, 53, 16, 9, 2.5, G.steel, 'sh', 2.6)}
${C(32, 32, 4, G.gold, 'ball', 2.2)}`,

  // Casquette à bière : deux canettes sur les côtés, pailles jusqu'à la bouche
  casquette: `${R(3, 12, 11, 19, 2.5, G.red, 'vol', 2.6)}${R(50, 12, 11, 19, 2.5, G.green, 'vol', 2.6)}
${L('M8.500 31c1 12 10 20 22 18M55.500 31c-1 12-10 20-22 18', K, 5, 1)}${L('M8.500 31c1 12 10 20 22 18M55.500 31c-1 12-10 20-22 18', '#fff4dc', 2.4, 1)}
${P('M11 42c0-14 9.500-23 21-23s21 9 21 23z', G.blue, 'ball')}
${L('M32 19v23', K, 2, 0.4)}${C(32, 19, 2.6, '#2a68b8', '', 2)}
${P('M27 42h34c0 5-4.500 8-9.500 8H36c-5 0-9-3-9-8z', '#2a5a9a', 'sh')}
${L('M17 35c1.500-6 5.500-10 11-11.500', '#fff', 2.8, 0.7)}`,

  // Paire de tongs de plage
  tongs: `<g transform="rotate(-10 18 32)">${P('M18 5c7.500 0 11 9 11 22c0 14-2.500 31-11 31S7 41 7 27C7 14 10.500 5 18 5z', G.blue, 'sh')}
${L('M18 16L9.500 31M18 16l8.500 15', K, 6, 1)}${L('M18 16L9.500 31M18 16l8.500 15', '#ffc93a', 3.2, 1)}${C(18, 16, 2.4, '#ffc93a', '', 1.6)}</g>
<g transform="rotate(10 46 32)">${P('M46 5c7.500 0 11 9 11 22c0 14-2.500 31-11 31S35 41 35 27C35 14 38.500 5 46 5z', G.blue, 'sh')}
${L('M46 16l-8.500 15M46 16l8.500 15', K, 6, 1)}${L('M46 16l-8.500 15M46 16l8.500 15', '#ffc93a', 3.2, 1)}${C(46, 16, 2.4, '#ffc93a', '', 1.6)}</g>`,

  // Sifflet d'arbitre chromé qui siffle, cordon rouge
  sifflet: `${L('M4 4c12 6 20 14 24 23', K, 6, 1)}${L('M4 4c12 6 20 14 24 23', '#e2362e', 3.2, 1)}
${P('M22 25h32v13H42.500A13.500 13.500 0 1 1 22 26.500z', G.steel, 'sh')}
${C(29, 40, 6, G.dark, 'ball', 2.4)}
${R(44, 27.500, 8, 4.500, 1, '#22262b', '', 0)}
${L('M21 33c1-3 3-5 6-6', '#fff', 2.6, 0.9)}
${L('M57 19l5-4M59 28h4M57 12l2-5', '#ffc93a', 3, 1)}`,

  // Gobelet rouge et paille rayée coudée
  paille: `${L('M36 50L46 8l10 2.500', K, 9, 1)}${L('M36 50L46 8l10 2.500', '#fff4dc', 6, 1)}
${L('M38 42l1.500-6M41.500 28l1.500-6M45 14l1-4M51 9l4 1', '#e2362e', 6, 1).replace('stroke-linecap="round"', '')}
${P('M11 22h36l-4.500 36c-.2 1.700-1.700 3-3.400 3H19c-1.700 0-3.200-1.300-3.400-3z', G.red, 'vol')}
${R(8.5, 18, 41, 7, 3.5, '#fff4dc', 'sh')}
${L('M17 30l2.500 24', '#fff', 2.8, 0.7)}`,

  // Fourchette qui pique une frite dorée
  piqueAssiette: `<g transform="rotate(20 32 32)">
${P('M27 30h10l2 28c.2 2.500-1.800 4.500-4.300 4.500h-5.400c-2.500 0-4.500-2-4.300-4.500z', G.wood, 'vol')}
${P('M21 3v15c0 6 4 9 11 9s11-3 11-9V3h-4.500v13.500h-3V3h-3.500v13.500h-3V3h-3.500v13.500h-3V3z', G.steel, 'sh')}
${R(27.5, 25, 9, 7, 1.5, G.steel, 'vol', 2.6)}</g>
<g transform="rotate(-24 22 26)">${R(15, 6, 10, 40, 2, G.gold, 'vol')}${L('M18 11v28', '#fff', 2, 0.7)}</g>`,

  // Porte-monnaie de cuir à fermoir doré, capsules qui débordent
  porteMonnaie: `${cap(22, 15, 10)}${cap(42, 13, 10, '#ffc93a', '#c9861a')}
${P('M6 30c0-7 5-11 11-11h30c6 0 11 4 11 11v18c0 7-5 12-11 12H17C11 60 6 55 6 48z', G.leather, 'sh')}
${P('M6 32c8-6 44-6 52 0v-2c0-7-5-11-11-11H17C11 19 6 23 6 30z', '#7a4424', 'sh', 3)}
${C(27, 20, 4.5, G.gold, 'ball', 2.2)}${C(37, 20, 4.5, G.gold, 'ball', 2.2)}
${L('M13 39v12', '#fff', 3, 0.45)}${L('M20 51c6 2.500 18 2.500 24 0', K, 2, 0.35)}`,

  // Tabouret de bar chromé, assise rouge, pancarte « réservé »
  tabouret: `${L('M19 20L11 60M45 20l8 40M26 22l-2 38M38 22l2 38', K, 6.5, 1)}${L('M19 20L11 60M45 20l8 40M26 22l-2 38M38 22l2 38', '#c2c8d0', 3.4, 1)}
${L('M14 46h36', K, 6.5, 1)}${L('M14 46h36', '#c2c8d0', 3.4, 1)}
${P('M10 13c0-4 10-7 22-7s22 3 22 7v5c0 4-10 7-22 7s-22-3-22-7z', G.red, 'vol')}
${E(32, 13, 22, 7, '#ff6b55', 'sh', 3)}
${L('M16 12c3-2.500 8-3.500 13-3.800', '#fff', 2.6, 0.7)}
<g transform="rotate(-6 32 36)">${R(17, 29, 30, 13, 2, G.cream, 'sh', 2.4)}${T(32, 39, 7.5, 'RÉSERVÉ', '#d23b2a')}</g>`,

  // Bon de réduction découpé aux ciseaux, « -% »
  bonReduction: `<g transform="rotate(8 32 32)">
${P('M4 14h56v10a5 5 0 0 0 0 10v12H4V34a5 5 0 0 0 0-10z', G.green, 'sh')}
<path d="M9 19h46v24H9z" fill="none" stroke="#fff4dc" stroke-width="1.800" stroke-dasharray="4 3"/>
${T(32, 39.5, 20, '-%', '#fff4dc', 3)}</g>
<g transform="translate(40 44) rotate(-30)">${L('M0 0l14 8M0 8l14-8', K, 5, 1)}${L('M0 0l14 8M0 8l14-8', '#d7dce3', 2.4, 1)}${C(-2, -1, 3.4, 'none', '', 2.4)}${C(-2, 9, 3.4, 'none', '', 2.4)}</g>`,
};

export const itemIcon = (id: ItemId, cls: string) => svg64(cls, ITEM_ICONS[id]);
