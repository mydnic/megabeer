// Enemy database. Pure data — no three.js/DOM code here.
// r: collision radius, hp/speed/dmg: combat stats, xp: dropped on death, color: body tint.
// effects: extension point for special behaviors (e.g. {type:'onDeath', action:'explode', radius:3, dmg:20}).
// Not consumed by any system yet — add handling in src/enemies.js updateEnemies/removeDeadEnemies when needed.
export const ENEMY_TYPES = [
  {
    id: 'zombie',
    name: 'Zombie',
    r: 0.7, hp: 9, speed: 2.8, dmg: 8, xp: 2,
    color: 0x6b8f4e,
    effects: [],
  },
  {
    id: 'zombie_fat',
    name: 'Zombie corpulent',
    r: 0.95, hp: 55, speed: 1.8, dmg: 15, xp: 5,
    color: 0x4f6b3a,
    effects: [],
  },
  {
    id: 'zombie_fast',
    name: 'Zombie rapide',
    r: 0.6, hp: 14, speed: 4.6, dmg: 6, xp: 3,
    color: 0x8a9e3f,
    effects: [],
  },
  {
    id: 'zombie_tank',
    name: 'Zombie tank',
    r: 1.2, hp: 150, speed: 1.5, dmg: 24, xp: 12,
    color: 0x39492a,
    effects: [],
  },
];

// Index into ENEMY_TYPES by game-time tier (see spawnEnemy in src/enemies.js).
// tier N unlocks ENEMY_TYPES[0..N] as possible random picks.
export const ENEMY_TIER_SECONDS = 45;
