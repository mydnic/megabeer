import { BOSS_HUD as H } from '../config/hud';

const CSS = `
.bsb { position: fixed; left: 50%; transform: translateX(-50%) translateY(-20px); z-index: 10; pointer-events: none; user-select: none;
  font-family: 'Lilita One', system-ui, sans-serif; text-align: center; opacity: 0; transition: opacity .4s, transform .5s cubic-bezier(.2,1.6,.4,1); }
.bsb.on { opacity: 1; transform: translateX(-50%) translateY(0); }
.bsb-name { color: #fff4dc; font-size: 22px; letter-spacing: .5px; text-shadow: 0 2px 0 #1a120c, 0 0 8px rgba(0,0,0,.6); margin-bottom: 4px; }
.bsb-name span { color: #ffb02a; font-size: 15px; margin-left: 8px; }
.bsb-track { position: relative; height: 18px; border-radius: 10px; background: rgba(26,18,12,.85); border: 3px solid #1a120c;
  box-shadow: 0 3px 0 rgba(26,18,12,.5), inset 0 2px 4px rgba(0,0,0,.6); overflow: hidden; }
.bsb-lag { position: absolute; inset: 0; background: #fff4dc; transform-origin: left; transition: transform .6s ease-out .25s; }
.bsb-fill { position: absolute; inset: 0; background: linear-gradient(#ff8a5a, #d23b2a 55%, #8a1c14); transform-origin: left; }
.bsb-fill::after { content: ''; position: absolute; left: 0; right: 0; top: 2px; height: 4px; background: rgba(255,255,255,.35); border-radius: 4px; }
.bsb-mark { position: absolute; top: 0; bottom: 0; width: 3px; background: #1a120c; }
.bsb.p2 .bsb-fill { background: linear-gradient(#ffd25a, #ff6a1a 55%, #a8320c); animation: bsb-rage .5s ease-in-out infinite alternate; }
@keyframes bsb-rage { 100% { filter: brightness(1.35); } }
.bsb.hit .bsb-track { animation: bsb-shake .2s linear; }
@keyframes bsb-shake { 25% { margin-left: -4px } 75% { margin-left: 4px } }
`;

/**
 * Barre de vie du boss en haut de l'écran (GDD : règle commune des boss) : son nom, la phase, la vie qui fond
 * (une traîne claire montre ce qui vient d'être perdu), un trait à la moitié (passage en phase 2).
 */
export function createBossBar() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'bsb';
  el.style.top = `${H.top}px`;
  el.style.width = `${H.width}px`;
  el.innerHTML = `<div class="bsb-name"></div><div class="bsb-track"><div class="bsb-lag"></div><div class="bsb-fill"></div><div class="bsb-mark"></div></div>`;
  document.body.appendChild(el);
  const name = el.querySelector<HTMLElement>('.bsb-name')!;
  const fill = el.querySelector<HTMLElement>('.bsb-fill')!;
  const lag = el.querySelector<HTMLElement>('.bsb-lag')!;
  const mark = el.querySelector<HTMLElement>('.bsb-mark')!;
  let last = -1;

  return {
    /** Montre la barre d'un boss : son nom, et où tombe le passage de phase (part des PV). */
    show(title: string, phaseAt: number) {
      name.innerHTML = title;
      mark.style.left = `${phaseAt * 100}%`;
      el.classList.remove('p2');
      el.classList.add('on');
      last = -1;
    },
    /** Chaque image : part des PV restants, phase. */
    update(ratio: number, phase: number) {
      const k = Math.max(0, Math.min(1, ratio));
      if (k === last) return;
      if (last >= 0 && k < last) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
      last = k;
      fill.style.transform = `scaleX(${k})`;
      lag.style.transform = `scaleX(${k})`;
      el.classList.toggle('p2', phase >= 2);
      name.querySelector('span')?.remove();
      if (phase >= 2) name.insertAdjacentHTML('beforeend', '<span>furieux</span>');
    },
    hide() { el.classList.remove('on'); },
  };
}
