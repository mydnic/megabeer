const CSS = `
.vic { position: fixed; inset: 0; z-index: 22; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
  pointer-events: none; opacity: 0; transition: opacity .6s; font-family: 'Lilita One', system-ui, sans-serif;
  background: radial-gradient(circle at 50% 45%, rgba(255,201,58,.28), rgba(26,12,4,.82) 70%); }
.vic.on { opacity: 1; pointer-events: auto; }
.vic-rays { position: absolute; left: 50%; top: 42%; width: 1400px; height: 1400px; margin: -700px 0 0 -700px; pointer-events: none; opacity: .35;
  background: repeating-conic-gradient(rgba(255,214,90,.55) 0 8deg, transparent 8deg 22deg); animation: vic-spin 22s linear infinite;
  -webkit-mask: radial-gradient(circle, #000 10%, transparent 60%); mask: radial-gradient(circle, #000 10%, transparent 60%); }
@keyframes vic-spin { to { transform: rotate(360deg); } }
.vic-title { position: relative; font-size: clamp(54px, 11vw, 150px); letter-spacing: .05em; color: #ffd45a; line-height: 1;
  text-shadow: 0 6px 0 #6a3a08, 0 0 40px rgba(255,201,58,.7); }
.vic.on .vic-title { animation: vic-pop .9s cubic-bezier(.2,1.6,.4,1) both; }
@keyframes vic-pop { 0% { transform: scale(.2) rotate(-8deg); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
.vic-sub { position: relative; color: #f3e6cf; font-size: 26px; text-align: center; text-shadow: 0 2px 0 #1a120c; }
.vic-stats { position: relative; color: #f3e6cf; font-size: 22px; text-align: center; line-height: 1.5;
  text-shadow: -2px 0 #1a120c, 2px 0 #1a120c, 0 -2px #1a120c, 0 2px #1a120c; }
.vic-stats b { color: #ffc23a; font-weight: normal; }
.vic-btn { position: relative; font: inherit; font-size: 26px; color: #2a1608; cursor: pointer; padding: 12px 38px 14px;
  border: 3px solid #1a120c; border-radius: 16px; background: linear-gradient(#ffd45a, #f5a623 60%, #e08a12);
  box-shadow: 0 5px 0 #1a120c, inset 0 3px 0 rgba(255,255,255,.45); }
.vic-btn:hover, .vic-btn:focus-visible { transform: scale(1.06); outline: none; }
.vic-hint { position: relative; color: #cdbfa6; font-size: 14px; }
`;

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Écran de victoire (le boss final est tombé) : titre doré, rayons qui tournent, bilan, bouton de retour à l'accueil. */
export function createVictoryScreen(onHome: () => void) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'vic';
  el.innerHTML = `<div class="vic-rays"></div><div class="vic-title">Victoire !</div>
<div class="vic-sub">Le patron est tombé. La tournée est pour toi.</div><div class="vic-stats"></div>
<button class="vic-btn">Retour au comptoir</button><div class="vic-hint">Espace ou A</div>`;
  document.body.appendChild(el);
  const stats = el.querySelector<HTMLElement>('.vic-stats')!;
  el.querySelector('button')!.addEventListener('click', () => onHome());
  return {
    get shown() { return el.classList.contains('on'); },
    show(survived: number, kills: number) {
      stats.innerHTML = `Temps : <b>${fmt(survived)}</b><br>Zombies : <b>${kills}</b>`;
      el.classList.add('on');
    },
    hide() { el.classList.remove('on'); },
  };
}
