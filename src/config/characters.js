// Character database. One entry per playable character, selected on the pre-run
// screen (src/charSelect.js). baseStats + startWeapon seed the `player` object via
// initPlayer() in src/player.js. To add a character: add an entry + list it in
// CHARACTER_ORDER — the select screen reads that order, nothing else to wire.
export const CHARACTERS = {
  default: {
    id: 'default',
    name: 'Buveur',
    desc: 'Le classique. Lance des bouteilles, encaisse, avance.',
    color: 0x44ccff,
    baseStats: {
      hp: 100,
      speed: 9,
      dmg: 10,
      atkSpeed: 1.0,
      projSpeed: 26,
      projCount: 1,
      pickupRange: 5,
    },
    startWeapon: 'beer',
  },
  santa: {
    id: 'santa',
    name: 'Père Noël',
    desc: 'Costaud, un peu lent. Démarre avec une Stout bien tassée.',
    color: 0xcc3333,
    baseStats: {
      hp: 115,
      speed: 8,
      dmg: 10,
      atkSpeed: 1.0,
      projSpeed: 24,
      projCount: 1,
      pickupRange: 5,
    },
    startWeapon: 'stout',
  },
  crado: {
    id: 'crado',
    name: 'Le Crado',
    desc: 'Rapide, fragile. Démarre avec une flaque de vomi toxique.',
    color: 0x6b7a4a,
    baseStats: {
      hp: 85,
      speed: 9.6,
      dmg: 9,
      atkSpeed: 1.0,
      projSpeed: 26,
      projCount: 1,
      pickupRange: 6,
    },
    startWeapon: 'vomit',
  },
};

export const CHARACTER_ORDER = ['default', 'santa', 'crado'];
export const DEFAULT_CHARACTER_ID = 'default';
