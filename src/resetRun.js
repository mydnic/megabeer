import { state } from './state.js';
import { overlay, centerEl, choicesEl } from './dom.js';
import { clearEnemies } from './enemies.js';
import { clearBullets } from './projectiles.js';
import { clearOrbs } from './xp.js';
import { clearPuddles } from './puddles.js';
import { clearTunasDrops } from './tunas.js';
import { showMenu } from './menu.js';

// Ends a run and returns to the main menu without a full page reload (previously
// a "Retour au menu" click did location.reload() — cheap but throws away the
// whole loaded scene/asset state and shows a blank flash). Each entity module
// owns removing its own scene objects (and disposing per-instance-unique
// geometry/material, see puddles.js) — this just orchestrates them + resets
// run-scoped state and hands control back to the menu screen.
export function resetRun() {
  clearEnemies();
  clearBullets();
  clearOrbs();
  clearPuddles();
  clearTunasDrops();

  state.gameTime = 0;
  state.killCount = 0;
  state.paused = false;
  state.gameOver = false;
  state.started = false;
  state.spawnTimer = 0;
  state.pendingLevelUps = 0;
  state.tunasEarnedThisRun = 0;

  overlay.style.display = 'none';
  centerEl.innerHTML = '';
  choicesEl.innerHTML = '';

  showMenu();
}
