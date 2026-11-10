import { RUN_HUD as R } from '../config/hud';
import { capsuleIcon } from './icons';
import { P } from './iconKit';

const CAPSULE = capsuleIcon();

const CSS = `
.run-hud { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 10; pointer-events: none;
  user-select: none; display: flex; flex-direction: column; align-items: center; gap: 4px;
  font-family: 'Lilita One', system-ui, sans-serif; color: #fff; }
.run-time { font-size: 40px; line-height: 1; letter-spacing: .04em; font-variant-numeric: tabular-nums;
  text-shadow: -3px 0 #1a120c, 3px 0 #1a120c, 0 -3px #1a120c, 0 3px #1a120c, 3px 3px #1a120c, -3px 3px #1a120c,
    3px -3px #1a120c, -3px -3px #1a120c, 0 6px 0 #1a120c; }
.run-time.closing { color: #ff6a48; animation: run-closing 1s ease-in-out infinite; }
@keyframes run-closing { 50% { transform: scale(1.06); color: #ffb09a; } }
.run-kills { display: flex; align-items: center; gap: 6px; padding: 2px 12px 3px 8px; border-radius: 14px;
  background: linear-gradient(rgba(58,36,24,.8), rgba(26,18,12,.7)); border: 2px solid #1a120c; box-shadow: inset 0 2px 0 rgba(255,255,255,.12), 0 3px 0 rgba(26,18,12,.45); font-size: 20px; line-height: 1; font-variant-numeric: tabular-nums;
  text-shadow: -2px 0 #1a120c, 2px 0 #1a120c, 0 -2px #1a120c, 0 2px #1a120c; }
.run-kills svg { width: 22px; height: 22px; flex: none; }
.run-kills.pop, .run-coins.pop { animation: run-pop .26s cubic-bezier(.2,1.6,.4,1); }
.run-coins.pop svg { animation: run-flip .4s ease-out; }
@keyframes run-flip { 0% { transform: rotateY(0) scale(1.5); } 100% { transform: rotateY(360deg) scale(1); } }
.run-kills.pop svg { animation: run-nod .26s ease-out; }
@keyframes run-nod { 40% { transform: rotate(-18deg) scale(1.3); } }
.run-row { display: flex; gap: 8px; }
.run-coins { display: flex; align-items: center; gap: 6px; padding: 2px 12px 3px 8px; border-radius: 14px;
  background: linear-gradient(rgba(58,36,24,.8), rgba(26,18,12,.7)); border: 2px solid #1a120c; box-shadow: inset 0 2px 0 rgba(255,255,255,.12), 0 3px 0 rgba(26,18,12,.45); font-size: 20px; line-height: 1; font-variant-numeric: tabular-nums; color: #ff6a5a;
  text-shadow: -2px 0 #1a120c, 2px 0 #1a120c, 0 -2px #1a120c, 0 2px #1a120c; }
.run-coins svg { width: 22px; height: 22px; flex: none; }
@keyframes run-pop { 0% { transform: scale(1) } 40% { transform: scale(1.22) } 100% { transform: scale(1) } }
`;

/** Tête de zombie (crâne vert) pour le compteur de kills. */
const SKULL = `<svg viewBox="0 0 24 24">${P('M12 2C6.900 2 3.500 5.600 3.500 10.200c0 2.900 1.300 4.800 3 5.900V19a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2.900c1.700-1.100 3-3 3-5.900C20.500 5.600 17.100 2 12 2z', '#9ad45e', 'ball', 2)}<circle cx="8.600" cy="11" r="2.400" fill="#1a120c"/><circle cx="15.400" cy="11" r="2.400" fill="#1a120c"/><circle cx="9.300" cy="10.300" r=".8" fill="#e2362e"/><circle cx="16.100" cy="10.300" r=".8" fill="#e2362e"/><path d="M10 17v3M14 17v3M12 14.200v1.300" stroke="#1a120c" stroke-width="1.600" stroke-linecap="round"/></svg>`;



/** Chrono de la run (temps de jeu, figé en pause), compteur de zombies tués et Pièces en poche, en haut au centre. */
export function createRunHud() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'run-hud';
  el.innerHTML = `<div class="run-time">00:00</div><div class="run-row"><div class="run-kills">${SKULL}<span>0</span></div><div class="run-coins">${CAPSULE}<span>0</span></div></div>`;
  document.body.appendChild(el);
  const time = el.querySelector<HTMLElement>('.run-time')!;
  const kills = el.querySelector<HTMLElement>('.run-kills')!;
  const killsText = kills.querySelector('span')!;
  const coins = el.querySelector<HTMLElement>('.run-coins')!;
  const coinsText = coins.querySelector('span')!;
  let shownSec = -1, shownKills = -1, lastPop = 0, shownCoins = -1;

  return {
    setVisible(v: boolean) { el.style.display = v ? '' : 'none'; },
    update(runTime: number, killCount: number, coinCount: number) {
      if (coinCount !== shownCoins) {
        if (coinCount > shownCoins && shownCoins >= 0) { coins.classList.remove('pop'); void coins.offsetWidth; coins.classList.add('pop'); }
        shownCoins = coinCount;
        coinsText.textContent = coinCount.toLocaleString('fr');
      }
      const s = Math.floor(runTime);
      if (s !== shownSec) {
        shownSec = s;
        time.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
        time.classList.toggle('closing', runTime >= R.closingTime);
      }
      if (killCount !== shownKills) {
        const now = performance.now() / 1000;
        if (killCount > shownKills && shownKills >= 0 && now - lastPop > R.killPopGap) {
          lastPop = now;
          kills.classList.remove('pop');
          void kills.offsetWidth;
          kills.classList.add('pop');
        }
        shownKills = killCount;
        killsText.textContent = killCount.toLocaleString('fr');
      }
    },
  };
}
