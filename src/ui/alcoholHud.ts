import type { Progression } from '../player/progression';

const CSS = `
.alc { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); width: min(720px, 72vw); height: 46px;
  display: flex; align-items: center; pointer-events: none; z-index: 10; font-family: 'Lilita One', system-ui, sans-serif; }
.alc-deg { position: relative; z-index: 2; flex: none; width: 58px; height: 58px; border-radius: 50%; margin-right: -14px;
  background: radial-gradient(circle at 35% 28%, #fff8dc, #ffcf4a 42%, #c98a12 85%); border: 3px solid #1a120c;
  box-shadow: 0 4px 0 #1a120c, inset 0 -5px 8px rgba(120,60,0,.35), inset 0 3px 3px rgba(255,255,255,.6); display: flex; align-items: center; justify-content: center;
  color: #2a1608; font-size: 22px; letter-spacing: -.02em; }
.alc-deg.pop { animation: alc-pop .55s cubic-bezier(.2,1.6,.4,1); }
/* Niveau gagné : un anneau doré part de la pastille */
.alc-deg::after { content: ''; position: absolute; inset: -3px; border-radius: 50%; border: 5px solid #ffe27a; opacity: 0; pointer-events: none; }
.alc-deg.pop::after { animation: alc-ring .7s ease-out; }
@keyframes alc-ring { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(3.2); opacity: 0; border-width: 1px; } }
.alc.up .alc-bar { animation: alc-flash .6s ease-out; }
@keyframes alc-flash { 0% { filter: brightness(2.4); box-shadow: 0 3px 0 rgba(26,18,12,.55), 0 0 26px #ffd36a; } 100% { filter: none; } }
@keyframes alc-pop { 0% { transform: scale(1) } 35% { transform: scale(1.5) rotate(-12deg) } 65% { transform: scale(.92) rotate(4deg) } 100% { transform: scale(1) } }
.alc-bar { position: relative; flex: 1; height: 24px; border: 3px solid #1a120c; border-radius: 0 14px 14px 0; background: #3a2418;
  box-shadow: 0 3px 0 rgba(26,18,12,.55), inset 0 3px 6px rgba(0,0,0,.45); overflow: hidden; }
.alc-fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(#ffdc7a, #f5a623 55%, #d07c0a);
  transition: width .18s ease-out; overflow: hidden; box-shadow: 4px 0 12px rgba(255,211,106,.7); }
/* Bulles qui montent dans la bière, reflet qui passe */
.alc-fill::before { content: ''; position: absolute; inset: 0; opacity: .55;
  background: radial-gradient(circle, #fff 0 1.500px, transparent 2px) 0 0 / 22px 24px, radial-gradient(circle, #fff 0 1px, transparent 1.500px) 11px 9px / 17px 24px;
  animation: alc-bubbles 1.4s linear infinite; }
@keyframes alc-bubbles { to { background-position: 0 -24px, 11px -15px; } }
.alc-bar::after { content: ''; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(105deg, transparent 42%, rgba(255,255,255,.35) 50%, transparent 58%) -150% 0 / 250% 100% no-repeat; animation: alc-shine 3.2s ease-in-out infinite; }
@keyframes alc-shine { 0%, 55% { background-position: -150% 0; } 100% { background-position: 250% 0; } }
.alc-fill::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 6px;
  background: radial-gradient(circle at 6px 6px, #fffaf0 5px, transparent 6px) 0 -2px / 12px 10px repeat-x; opacity: .9; }
.alc-label { position: absolute; inset: 0; display: flex; align-items: center; padding-left: 26px; color: #fff;
  font-size: 13px; letter-spacing: .08em; text-transform: uppercase;
  text-shadow: -1px 0 #1a120c, 1px 0 #1a120c, 0 -1px #1a120c, 0 1px #1a120c; }
`;

/** Barre d'alcoolémie (XP) en bas de l'écran, avec le degré (niveau) dans une pastille. */
export function createAlcoholHud(prog: Progression) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'alc';
  el.innerHTML = '<div class="alc-deg"></div><div class="alc-bar"><div class="alc-fill"></div><div class="alc-label">Alcoolémie</div></div>';
  document.body.appendChild(el);
  const deg = el.querySelector<HTMLElement>('.alc-deg')!;
  const fill = el.querySelector<HTMLElement>('.alc-fill')!;
  let shownLevel = -1, shownRatio = -1;

  return {
    setVisible(v: boolean) { el.style.display = v ? '' : 'none'; },
    update() {
      if (prog.level !== shownLevel) {
        if (shownLevel > 0 && prog.level > shownLevel) {
          deg.classList.remove('pop');
          void deg.offsetWidth;
          deg.classList.add('pop');
          el.classList.remove('up');
          void el.offsetWidth;
          el.classList.add('up');
        }
        shownLevel = prog.level;
        deg.textContent = `${prog.level}°`;
      }
      const r = Math.min(1, prog.ratio);
      if (Math.abs(r - shownRatio) > 0.001) { shownRatio = r; fill.style.width = `${r * 100}%`; }
    },
  };
}
