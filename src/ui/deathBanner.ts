import { DEATH_BANNER as D } from '../config/player';

const CSS = `
.death-band { position: fixed; left: 0; right: 0; top: 50%; transform: translateY(-50%); height: 190px; pointer-events: none;
  display: flex; align-items: center; justify-content: center; z-index: 20; opacity: 0;
  background: linear-gradient(rgba(8,4,2,0) 0%, rgba(8,4,2,.82) 22%, rgba(8,4,2,.82) 78%, rgba(8,4,2,0) 100%); }
.death-text { font-family: 'Lilita One', system-ui, sans-serif; font-size: clamp(34px, 8vw, 120px); letter-spacing: .06em;
  text-transform: uppercase; color: #d6261a; line-height: 1; white-space: nowrap;
  text-shadow: 0 0 28px rgba(214,38,26,.45), 0 4px 0 #3a0a06; }
.death-end { position: fixed; left: 0; right: 0; top: calc(50% + 110px); display: flex; flex-direction: column;
  align-items: center; gap: 18px; z-index: 21; opacity: 0; pointer-events: none; transition: opacity .5s, transform .5s;
  transform: translateY(12px); font-family: 'Lilita One', system-ui, sans-serif; }
.death-end.on { opacity: 1; pointer-events: auto; transform: translateY(0); }
.death-time { color: #f3e6cf; font-size: 24px; letter-spacing: .04em;
  text-shadow: -2px 0 #1a120c, 2px 0 #1a120c, 0 -2px #1a120c, 0 2px #1a120c; }
.death-time b { color: #ffc23a; font-weight: normal; }
.death-btn { font: inherit; font-size: 26px; letter-spacing: .05em; color: #2a1608; cursor: pointer;
  padding: 12px 38px 14px; border: 3px solid #1a120c; border-radius: 16px;
  background: linear-gradient(#ffd45a, #f5a623 60%, #e08a12); box-shadow: 0 5px 0 #1a120c, inset 0 3px 0 rgba(255,255,255,.45);
  transition: transform .08s; }
.death-btn:hover, .death-btn:focus-visible { transform: scale(1.06); outline: none; }
.death-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 #1a120c, inset 0 3px 0 rgba(255,255,255,.45); }
.death-hint { color: #cdbfa6; font-size: 14px; letter-spacing: .04em; opacity: .85;
  text-shadow: -1px 0 #1a120c, 1px 0 #1a120c, 0 -1px #1a120c, 0 1px #1a120c; }
`;

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Écran de mort : bandeau façon « YOU DIED » / « WASTED » (bande sombre, gros texte rouge qui se
 * resserre), puis le bilan de la run et le bouton Rejouer.
 */
export function createDeathBanner(onContinue: () => void) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const band = document.createElement('div');
  band.className = 'death-band';
  band.innerHTML = `<div class="death-text"></div>`;
  document.body.appendChild(band);
  const text = band.querySelector<HTMLElement>('.death-text')!;
  text.textContent = D.text;

  const end = document.createElement('div');
  end.className = 'death-end';
  end.innerHTML = `<div class="death-time"></div><button class="death-btn">Continuer</button><div class="death-hint">Espace ou A</div>`;
  document.body.appendChild(end);
  const time = end.querySelector<HTMLElement>('.death-time')!;
  const btn = end.querySelector<HTMLButtonElement>('.death-btn')!;
  btn.addEventListener('click', (e) => { e.stopPropagation(); onContinue(); });

  let shown = false;
  return {
    /** Vrai quand le bilan et le bouton sont affichés (Rejouer possible). */
    get ready() { return shown; },
    /** t : temps réel depuis la mort (s), -1 si vivant ; survived : durée de la run (s). */
    update(t: number, survived: number) {
      if (t < D.delay) {
        band.style.opacity = '0';
        if (shown) { end.classList.remove('on'); shown = false; }
        return;
      }
      const k = Math.min(1, (t - D.delay) / D.fadeIn);
      band.style.opacity = String(k);
      // Le texte arrive un peu plus grand et se resserre lentement
      const s = D.scaleFrom + (1 - D.scaleFrom) * (1 - Math.exp(-(t - D.delay) * D.settle));
      text.style.transform = `scale(${s})`;
      if (!shown && t >= D.endDelay) {
        shown = true;
        time.innerHTML = `Tu as tenu <b>${fmt(survived)}</b>`;
        end.classList.add('on');
        // La souris est libérée pour cliquer sur le bouton
        if (document.pointerLockElement) document.exitPointerLock();
        btn.focus({ preventScroll: true });
      }
    },
  };
}
