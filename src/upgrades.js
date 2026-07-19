import { player } from './player.js';
import { state } from './state.js';
import { overlay, centerEl, choicesEl } from './dom.js';
import { isPurchased } from './meta.js';

const STAT_UPGRADES = [
  { name: 'Bière plus forte', desc: '+30% dégâts', apply: () => player.dmg *= 1.3 },
  { name: 'Tournée rapide', desc: '+20% cadence de lancer', apply: () => player.atkSpeed *= 1.2 },
  { name: 'Godasses de bar', desc: '+15% vitesse de déplacement', apply: () => player.speed *= 1.15 },
  { name: 'Deux mains', desc: '+1 bouteille par lancer', apply: () => player.projCount += 1 },
  { name: 'Bonne descente', desc: '+25 PV max, soigne', apply: () => { player.maxHp += 25; player.hp = player.maxHp; } },
  { name: 'Aimant à capsules', desc: '+50% portée de ramassage', apply: () => player.pickupRange *= 1.5 },
  { name: 'Bras de catapulte', desc: '+25% vitesse des projectiles', apply: () => player.projSpeed *= 1.25 },
];

const UNLOCKABLE_WEAPONS = [
  { id: 'keg', name: 'Fût qui roule', desc: 'Débloque le fût: roule et écrase tout sur son passage' },
  { id: 'puddle', name: 'Flaque de bière', desc: 'Débloque la flaque: dégâts de zone sur la durée' },
  { id: 'coaster', name: 'Dessous de verre', desc: 'Débloque le shuriken: transperce plusieurs zombies' },
];

function buildPool() {
  const pool = [...STAT_UPGRADES];
  for (const w of UNLOCKABLE_WEAPONS) {
    if (isPurchased(w.id) && !player.unlockedWeapons.has(w.id)) {
      pool.push({ name: w.name, desc: w.desc, apply: () => player.unlockedWeapons.add(w.id) });
    }
  }
  return pool;
}

export function pickUpgrades() {
  state.paused = true;
  if (document.pointerLockElement) document.exitPointerLock();
  overlay.style.display = 'flex';
  centerEl.style.display = 'none';
  choicesEl.innerHTML = '';
  const pool = buildPool().sort(() => Math.random() - 0.5).slice(0, 3);
  for (const u of pool) {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<h3>${u.name}</h3><p>${u.desc}</p>`;
    div.onclick = () => { u.apply(); overlay.style.display = 'none'; state.paused = false; };
    choicesEl.appendChild(div);
  }
}
