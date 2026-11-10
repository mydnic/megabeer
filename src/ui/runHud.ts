import { RUN_HUD as R } from '../config/hud';

const CSS = `
.run-hud { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 10; pointer-events: none;
  user-select: none; display: flex; flex-direction: column; align-items: center; gap: 4px;
  font-family: 'Lilita One', system-ui, sans-serif; color: #fff; }
.run-time { font-size: 40px; line-height: 1; letter-spacing: .04em; font-variant-numeric: tabular-nums;
  text-shadow: -3px 0 #1a120c, 3px 0 #1a120c, 0 -3px #1a120c, 0 3px #1a120c, 3px 3px #1a120c, -3px 3px #1a120c,
    3px -3px #1a120c, -3px -3px #1a120c, 0 6px 0 #1a120c; }
.run-time.closing { color: #ff6a48; }
.run-kills { display: flex; align-items: center; gap: 6px; padding: 2px 12px 3px 8px; border-radius: 14px;
  background: rgba(26,18,12,.55); font-size: 20px; line-height: 1; font-variant-numeric: tabular-nums;
  text-shadow: -2px 0 #1a120c, 2px 0 #1a120c, 0 -2px #1a120c, 0 2px #1a120c; }
.run-kills svg { width: 22px; height: 22px; flex: none; }
.run-kills.pop, .run-coins.pop { animation: run-pop .22s ease-out; }
.run-row { display: flex; gap: 8px; }
.run-coins { display: flex; align-items: center; gap: 6px; padding: 2px 12px 3px 8px; border-radius: 14px;
  background: rgba(26,18,12,.55); font-size: 20px; line-height: 1; font-variant-numeric: tabular-nums; color: #ffd23a;
  text-shadow: -2px 0 #1a120c, 2px 0 #1a120c, 0 -2px #1a120c, 0 2px #1a120c; }
.run-coins svg { width: 22px; height: 22px; flex: none; }
@keyframes run-pop { 0% { transform: scale(1) } 40% { transform: scale(1.18) } 100% { transform: scale(1) } }
`;

/** Tête de zombie (crâne vert) pour le compteur de kills. */
const SKULL = `<svg viewBox="0 0 24 24"><path d="M12 2C6.9 2 3.5 5.6 3.5 10.2c0 2.9 1.3 4.8 3 5.9V19a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2.9c1.7-1.1 3-3 3-5.9C20.5 5.6 17.1 2 12 2z" fill="#8fc45a" stroke="#1a120c" stroke-width="2"/><circle cx="8.6" cy="11" r="2.3" fill="#1a120c"/><circle cx="15.4" cy="11" r="2.3" fill="#1a120c"/><path d="M10 17v3M14 17v3" stroke="#1a120c" stroke-width="1.6"/></svg>`;

/** Capsule de bière dorée (Pièces) : jupe crantée, dessus bombé. */
const CAPSULE = `<svg viewBox="0 0 24 24"><path d="M12 1.6l1.6 1.5 2.1-.6.8 2 2.2.4-.1 2.2 1.8 1.3-1 1.9 1 1.9-1.8 1.3.1 2.2-2.2.4-.8 2-2.1-.6L12 22.4l-1.6-1.5-2.1.6-.8-2-2.2-.4.1-2.2-1.8-1.3 1-1.9-1-1.9 1.8-1.3-.1-2.2 2.2-.4.8-2 2.1.6z" fill="#ffd23a" stroke="#1a120c" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="5.6" fill="#ffe680" stroke="#b8860b" stroke-width="1.2"/><path d="M9.4 10.2a3.4 3.4 0 0 1 3.4-2.2" stroke="#fff8" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`;

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
