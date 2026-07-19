import { state } from './state.js';
import { player } from './player.js';
import { meta } from './meta.js';
import { overlay, centerEl, choicesEl, hpTxt, hpFillIn, barFill, lvEl, timeEl, killsEl, tunasHudEl } from './dom.js';

export function updateHud() {
  timeEl.textContent = Math.floor(state.gameTime);
  killsEl.textContent = state.killCount;
  hpTxt.textContent = Math.max(0, Math.ceil(player.hp)) + '/' + player.maxHp;
  hpFillIn.style.width = Math.max(0, player.hp / player.maxHp * 100) + '%';
  lvEl.textContent = player.level;
  barFill.style.width = (player.xp / player.xpNext * 100) + '%';
  tunasHudEl.textContent = meta.tunas;
}

export function endGame(win) {
  if (state.gameOver) return;
  state.paused = true;
  state.gameOver = true;
  if (document.pointerLockElement) document.exitPointerLock();

  const earned = state.tunasEarnedThisRun;

  overlay.style.display = 'flex';
  choicesEl.innerHTML = '';
  centerEl.style.display = 'block';
  centerEl.innerHTML = win
    ? `TU AS SURVÉCU À LA NUIT !<br><span style="font-size:16px">Zombies: ${state.killCount} — +${earned} TUNAS</span>`
    : `TU ES MORT, BU PAR LES ZOMBIES<br><span style="font-size:16px">Temps: ${Math.floor(state.gameTime)}s — Zombies: ${state.killCount} — +${earned} TUNAS</span>`;

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Retour au menu';
  btn.style.marginTop = '20px';
  btn.onclick = () => location.reload();
  centerEl.appendChild(btn);
}
