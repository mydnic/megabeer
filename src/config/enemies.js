// Enemy database. Pure data — no three.js/DOM code here.
// r: collision radius (also drives visual scale, see src/enemyModels.js), hp/speed/dmg:
// combat stats, xp: dropped on death, color: material tint (only visible on Kenney
// skins today — Quaternius models are tinted too but their bake already carries a
// distinct look, so tint is closer to neutral for those).
// model: which rig+skin to render, resolved in src/enemyModels.js (VARIANTS).
//   kenney_zombieA / kenney_zombieC — Kenney FBX rig, 2 skin textures
//   quat_basic / quat_chubby / quat_arm / quat_ribcage — Quaternius glTF, own rig each
// unlockAt: game-time in seconds after which this type can start spawning (see
// spawnEnemy in src/enemies.js — picks randomly among all types already unlocked).
// Edit this per-entry to retime the roster; no other constant governs pacing.
// effects: extension point for special behaviors (e.g. {type:'onDeath', action:'explode', radius:3, dmg:20}).
// Not consumed by any system yet — add handling in src/enemies.js updateEnemies/removeDeadEnemies when needed.
export const ENEMY_TYPES = [
  {
    id: 'zombie',
    name: 'Zombie',
    r: 0.7, hp: 9, speed: 2.8, dmg: 8, xp: 2,
    color: 0x9fbf7a, model: 'kenney_zombieA',
    unlockAt: 0,
    effects: [],
  },
  {
    id: 'zombie_fast',
    name: 'Zombie rapide',
    r: 0.6, hp: 14, speed: 4.6, dmg: 6, xp: 3,
    color: 0xb8cf8a, model: 'kenney_zombieA',
    unlockAt: 60,
    effects: [],
  },
  {
    id: 'zombie_wanderer',
    name: 'Zombie errant',
    r: 0.75, hp: 16, speed: 2.4, dmg: 9, xp: 3,
    color: 0xffffff, model: 'quat_basic',
    unlockAt: 120,
    effects: [],
  },
  {
    id: 'zombie_onearm',
    name: 'Zombie manchot',
    r: 0.65, hp: 20, speed: 3.6, dmg: 5, xp: 4,
    color: 0xffffff, model: 'quat_arm',
    unlockAt: 180,
    effects: [],
  },
  {
    id: 'zombie_fat',
    name: 'Zombie corpulent',
    r: 0.95, hp: 55, speed: 1.8, dmg: 15, xp: 5,
    color: 0x7a9a5a, model: 'kenney_zombieC',
    unlockAt: 240,
    effects: [],
  },
  {
    id: 'zombie_skeletal',
    name: 'Zombie décharné',
    r: 0.6, hp: 10, speed: 5.2, dmg: 12, xp: 5,
    color: 0xffffff, model: 'quat_ribcage',
    unlockAt: 300,
    effects: [],
  },
  {
    id: 'zombie_bloated',
    name: 'Zombie ventru',
    r: 1.0, hp: 80, speed: 1.3, dmg: 18, xp: 7,
    color: 0xffffff, model: 'quat_chubby',
    unlockAt: 360,
    effects: [],
  },
  {
    id: 'zombie_tank',
    name: 'Zombie tank',
    r: 1.2, hp: 150, speed: 1.5, dmg: 24, xp: 12,
    color: 0x4a5f3a, model: 'kenney_zombieC',
    unlockAt: 420,
    effects: [],
  },
];
