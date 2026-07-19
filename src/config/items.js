// Passive item database — the level-up upgrade pool (src/upgrades.js applies these
// generically via applyPassiveItem). Each item mutates one player stat.
// op: 'mult' multiplies the stat, 'add' adds to it.
// healFull: when true, also sets player.hp = player.maxHp after applying (used by maxHp items).
export const PASSIVE_ITEMS = [
  { id: 'stronger_beer', name: 'Bière plus forte', desc: '+30% dégâts', stat: 'dmg', op: 'mult', value: 1.3 },
  { id: 'quick_hands', name: 'Tournée rapide', desc: '+20% cadence de lancer', stat: 'atkSpeed', op: 'mult', value: 1.2 },
  { id: 'bar_shoes', name: 'Godasses de bar', desc: '+15% vitesse de déplacement', stat: 'speed', op: 'mult', value: 1.15 },
  { id: 'two_hands', name: 'Deux mains', desc: '+1 bouteille par lancer', stat: 'projCount', op: 'add', value: 1 },
  { id: 'good_sip', name: 'Bonne descente', desc: '+25 PV max, soigne', stat: 'maxHp', op: 'add', value: 25, healFull: true },
  { id: 'cap_magnet', name: 'Aimant à capsules', desc: '+50% portée de ramassage', stat: 'pickupRange', op: 'mult', value: 1.5 },
  { id: 'catapult_arm', name: 'Bras de catapulte', desc: '+25% vitesse des projectiles', stat: 'projSpeed', op: 'mult', value: 1.25 },
];
