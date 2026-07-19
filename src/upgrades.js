import { player } from './player.js';
import { state } from './state.js';
import { overlay, centerEl, choicesEl } from './dom.js';
import { isPurchased } from './meta.js';
import { PASSIVE_ITEMS } from './config/items.js';
import { WEAPON_TYPES } from './config/weapons.js';
import { setGamepadNavRows } from './gamepadNav.js';
import { shuffle } from './util.js';

function applyPassiveItem(item) {
  const current = player[item.stat];
  player[item.stat] = item.op === 'mult' ? current * item.value : current + item.value;
  if (item.healFull) player.hp = player.maxHp;
}

function buildPool() {
  const pool = PASSIVE_ITEMS.map(item => ({
    name: item.name,
    desc: item.desc,
    apply: () => applyPassiveItem(item),
  }));
  for (const cfg of Object.values(WEAPON_TYPES)) {
    if (cfg.unlockCard && isPurchased(cfg.id) && !player.unlockedWeapons.has(cfg.id)) {
      pool.push({
        name: cfg.unlockCard.name,
        desc: cfg.unlockCard.desc,
        apply: () => player.unlockedWeapons.add(cfg.id),
      });
    }
  }
  return pool;
}

// Call this on every level gained (not pickUpgrades directly) — queues the pick
// screen instead of showing it immediately, so a multi-level XP gain doesn't have
// a later pickUpgrades() call wipe out an earlier one before the player could
// choose (choicesEl.innerHTML = '' used to silently drop a pending upgrade).
export function requestUpgrade() {
  state.pendingLevelUps++;
  if (!state.paused) showNextUpgrade();
}

function showNextUpgrade() {
  if (state.pendingLevelUps <= 0) return;

  state.paused = true;
  if (document.pointerLockElement) document.exitPointerLock();
  overlay.style.display = 'flex';
  centerEl.style.display = 'none';
  choicesEl.innerHTML = '';

  const pool = shuffle(buildPool()).slice(0, 3);
  for (const u of pool) {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<h3>${u.name}</h3><p>${u.desc}</p>`;
    div.onclick = () => {
      u.apply();
      state.pendingLevelUps--;
      if (state.pendingLevelUps > 0) {
        showNextUpgrade();
      } else {
        overlay.style.display = 'none';
        state.paused = false;
      }
    };
    choicesEl.appendChild(div);
  }
  setGamepadNavRows([[...choicesEl.children]]);
}
