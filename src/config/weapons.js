// Weapon database. Pure data — gameplay numbers only. Mesh/geometry creation and
// firing logic live in src/weapons.js (the "system" that reads this config).
//
// unlockCard: shown as a level-up pick once the weapon is purchased in the TUNAS shop.
// shop: cost/description shown in the TUNAS shop (src/menu.js). Omit both for starter weapons.
// effects: extension point for special projectile behaviors (e.g. burn, slow). Unused today.
export const WEAPON_TYPES = {
  beer: {
    id: 'beer',
    label: 'Lancer de bière',
    cooldown: 1.0,
    range: 16,
    dmgMult: 1.0,
    projectile: { pierce: 1, speedMult: 1.0, spin: 0 },
    effects: [],
  },
  coaster: {
    id: 'coaster',
    label: 'Dessous de verre',
    cooldown: 1.6,
    range: 16,
    dmgMult: 0.65,
    projectile: { pierce: 3, speedMult: 1.3, spin: 22, spinAxis: 'y' },
    unlockCard: { name: 'Dessous de verre', desc: 'Débloque le shuriken: transperce plusieurs zombies' },
    shop: { cost: 120, desc: 'Shuriken tranchant, transperce' },
    effects: [],
  },
  keg: {
    id: 'keg',
    label: 'Fût qui roule',
    cooldown: 3.5,
    range: Infinity,
    dmgMult: 1.8,
    projectile: { pierce: 99, speedMult: 0.55, spin: 14, spinAxis: 'x', life: 2.6 },
    unlockCard: { name: 'Fût qui roule', desc: 'Débloque le fût: roule et écrase tout sur son passage' },
    shop: { cost: 50, desc: 'Un fût qui roule et écrase tout' },
    effects: [],
  },
  puddle: {
    id: 'puddle',
    label: 'Flaque de bière',
    cooldown: 4.0,
    range: Infinity,
    dmgMult: 0.5,
    aoe: { radius: 3.2, duration: 3.0, tickInterval: 0.4 },
    unlockCard: { name: 'Flaque de bière', desc: 'Débloque la flaque: dégâts de zone sur la durée' },
    shop: { cost: 80, desc: 'Flaque AOE, dégâts sur la durée' },
    effects: [],
  },
  // Character-exclusive starters — no unlockCard/shop (not obtainable any other way).
  stout: {
    id: 'stout',
    label: 'Bière Stout',
    cooldown: 1.3,
    range: 16,
    dmgMult: 1.8,
    projectile: { pierce: 1, speedMult: 0.85, spin: 0 },
    effects: [],
  },
  vomit: {
    id: 'vomit',
    label: 'Flaque de vomi',
    cooldown: 4.0,
    range: Infinity,
    dmgMult: 0.5,
    aoe: { radius: 3.0, duration: 3.5, tickInterval: 0.4 },
    effects: [],
  },
};

// Beer variants rolled per shot by the 'beer' weapon. Higher-abv types unlock
// gradually over the run (see pickBeerType in src/weapons.js).
export const BEER_TYPES = [
  { name: 'Blonde', color: 0xf2c14e, dmgMult: 1.0 },
  { name: 'Kriek', color: 0xb0304f, dmgMult: 1.15 },
  { name: 'Brune', color: 0x4a2c14, dmgMult: 1.3 },
  { name: 'Triple', color: 0xffcc33, dmgMult: 1.6 },
];
