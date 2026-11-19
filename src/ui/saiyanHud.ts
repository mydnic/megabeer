import { SAIYAN } from '../config/saiyan';
import { SAIYAN_HUD as H } from '../config/hud';

const CSS = `
.ssj { position: fixed; z-index: 10; pointer-events: none; user-select: none; font-family: 'Lilita One', system-ui, sans-serif; display: none; }
.ssj.on { display: block; }
.ssj-title { color: #fff4dc; font-size: 16px; text-shadow: 0 2px 0 #1a120c; margin-bottom: 3px; }
.ssj-title b { color: var(--aura, #ffd23a); font-weight: normal; }
.ssj-track { position: relative; height: 16px; border-radius: 9px; background: rgba(26,18,12,.85); border: 3px solid #1a120c; overflow: hidden; display: flex; }
.ssj-seg { position: relative; flex: 1; border-right: 2px solid #1a120c; }
.ssj-seg:last-child { border-right: 0; }
.ssj-seg div { position: absolute; inset: 0; transform-origin: left; transform: scaleX(0); }
.ssj-hint { color: #ffc93a; font-size: 14px; text-shadow: 0 2px 0 #1a120c; margin-top: 3px; }
.ssj.ready .ssj-hint { animation: ssj-pulse .9s ease-in-out infinite alternate; }
@keyframes ssj-pulse { 100% { color: #fff4dc; } }
.ssj.active .ssj-track { box-shadow: 0 0 12px var(--aura, #ffd23a); }
/* Transformé : une seule barre, de la couleur du palier, qui se vide de 100 % à 0 */
.ssj-one { position: absolute; inset: 0; background: var(--aura, #ffd23a); transform-origin: left; display: none; }
.ssj.active .ssj-one { display: block; }
.ssj.active .ssj-seg { visibility: hidden; }
`;

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/**
 * Jauge de colère (Super Saiyan), en bas à gauche, une fois le Sang Saiyan pris : un segment par palier (chacun se
 * remplit jusqu'à son seuil), le plus haut palier atteint et la touche pour se transformer ; transformé, une seule barre de
 * la couleur du palier qui se vide avec le temps qui reste.
 */
export function createSaiyanHud(keyHint: () => string) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'ssj';
  el.style.left = `${H.left}px`;
  el.style.bottom = `${H.bottom}px`;
  el.style.width = `${H.width}px`;
  el.innerHTML = `<div class="ssj-title"></div><div class="ssj-track">${SAIYAN.tiers.map(() => '<div class="ssj-seg"><div></div></div>').join('')}<div class="ssj-one"></div></div><div class="ssj-hint"></div>`;
  document.body.appendChild(el);
  const title = el.querySelector<HTMLElement>('.ssj-title')!;
  const hint = el.querySelector<HTMLElement>('.ssj-hint')!;
  const fills = [...el.querySelectorAll<HTMLElement>('.ssj-seg div')];
  const one = el.querySelector<HTMLElement>('.ssj-one')!;
  fills.forEach((f, i) => { f.style.background = hex(SAIYAN.tiers[i].aura); });
  let last = '';
  return {
    /** Chaque image : visible ou non, points de jauge, palier en cours (0 : aucun), temps qui reste (s). */
    update(visible: boolean, points: number, reached: number, tier: number, left: number, duration: number = SAIYAN.duration) {
      el.classList.toggle('on', visible);
      if (!visible) return;
      const T = SAIYAN.thresholds;
      if (tier > 0) one.style.transform = `scaleX(${Math.max(0, left / duration)})`;
      else fills.forEach((f, i) => {
        const lo = i === 0 ? 0 : T[i - 1];
        f.style.transform = `scaleX(${Math.max(0, Math.min(1, (points - lo) / (T[i] - lo)))})`;
      });
      const shown = tier || reached;
      el.style.setProperty('--aura', hex(SAIYAN.tiers[Math.max(0, shown - 1)].aura));
      el.classList.toggle('ready', tier === 0 && reached > 0);
      el.classList.toggle('active', tier > 0);
      const key = `${tier}|${reached}|${Math.ceil(left)}|${keyHint()}`;
      if (key === last) return;
      last = key;
      if (tier > 0) { title.innerHTML = `<b>${SAIYAN.tiers[tier - 1].name}</b>`; hint.textContent = `${Math.ceil(left)} s`; }
      else if (reached > 0) { title.innerHTML = `Colère : <b>${SAIYAN.tiers[reached - 1].name}</b>`; hint.textContent = `${keyHint()} : se transformer`; }
      else { title.textContent = 'Colère'; hint.textContent = 'Tue et encaisse pour la remplir'; }
    },
  };
}
