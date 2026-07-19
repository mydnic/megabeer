// Character database. One entry per playable character.
// baseStats seed the `player` object at run start (see src/player.js).
// To add a character: add an entry here, then wire selection UI to set the active id.
export const CHARACTERS = {
  default: {
    id: 'default',
    name: 'Buveur',
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
};

export const DEFAULT_CHARACTER_ID = 'default';
