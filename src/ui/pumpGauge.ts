import { PUMP_GAUGE as G } from '../config/hud';
import { PUMP_TIERS } from '../config/pumps';
import type { Pump } from '../game/pumps';

const CSS = `
.pg { position: fixed; left: 50%; bottom: 92px; transform: translateX(-50%) scale(.6); opacity: 0; z-index: 11; pointer-events: none;
  display: flex; flex-direction: column; align-items: center; gap: 4px; font-family: 'Lilita One', system-ui, sans-serif;
  transition: opacity .2s, transform .25s cubic-bezier(.2,1.6,.4,1); }
.pg.on { opacity: 1; transform: translateX(-50%) scale(1); }
.pg.out { opacity: .55; }
.pg-name { font-size: 18px; letter-spacing: .05em; color: var(--c);
  text-shadow: -2px 0 #1a120c, 2px 0 #1a120c, 0 -2px #1a120c, 0 2px #1a120c, 0 4px 0 #1a120c; }
.pg-hint { height: 18px; font-size: 15px; color: #ffd0a0; text-shadow: -2px 0 #1a120c, 2px 0 #1a120c, 0 -2px #1a120c, 0 2px #1a120c; }
.pg svg { width: 64px; height: 92px; filter: drop-shadow(0 4px 0 rgba(26,18,12,.6)); }
.pg-bubble { animation: pg-rise 1.1s linear infinite; }
@keyframes pg-rise { from { transform: translateY(0); opacity: .9 } to { transform: translateY(-46px); opacity: 0 } }
.pg.out .pg-bubble { animation-play-state: paused; opacity: 0; }
`;

/**
 * Jauge de la pompe à bière en cours (au-dessus de la barre d'alcoolémie) : une pinte qui se remplit
 * de bière, avec sa mousse et ses bulles, et le nom de la pompe dans sa couleur. Hors de la zone, la
 * pinte pâlit et on rappelle au joueur de revenir, pendant qu'elle se vide.
 */
export function createPumpGauge() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'pg';
  // Pinte : verre (contour), bière qui monte (rectangle découpé par la forme du verre), mousse, bulles
  el.innerHTML = `<div class="pg-name"></div>
    <svg viewBox="0 0 64 92"><defs><clipPath id="pg-glass"><path d="M8 6h48l-5 80H13z"/></clipPath></defs>
      <path d="M8 6h48l-5 80H13z" fill="rgba(255,255,255,.18)"/>
      <g clip-path="url(#pg-glass)">
        <rect class="pg-beer" x="0" y="86" width="64" height="0" fill="#e8a01c"/>
        <rect class="pg-foam" x="0" y="80" width="64" height="7" fill="#fff4dc"/>
        <circle class="pg-bubble" cx="22" cy="82" r="1.8" fill="#fff6" style="animation-delay:0s"/>
        <circle class="pg-bubble" cx="36" cy="84" r="1.4" fill="#fff6" style="animation-delay:.4s"/>
        <circle class="pg-bubble" cx="44" cy="80" r="1.6" fill="#fff6" style="animation-delay:.75s"/>
      </g>
      <path d="M8 6h48l-5 80H13z" fill="none" stroke="#1a120c" stroke-width="4" stroke-linejoin="round"/>
      <path d="M15 14l3 62" stroke="#fff8" stroke-width="3" stroke-linecap="round"/>
    </svg>
    <div class="pg-hint"></div>`;
  document.body.appendChild(el);
  const name = el.querySelector<HTMLElement>('.pg-name')!;
  const hint = el.querySelector<HTMLElement>('.pg-hint')!;
  const beer = el.querySelector<SVGRectElement>('.pg-beer')!;
  const foam = el.querySelector<SVGRectElement>('.pg-foam')!;
  const bubbles = [...el.querySelectorAll<SVGCircleElement>('.pg-bubble')];
  let shown: Pump | null = null;

  return {
    /** Chaque image : la pompe suivie (ou rien) et si le joueur est dans sa zone. */
    update(pump: Pump | null, filling: boolean) {
      el.classList.toggle('on', !!pump);
      if (!pump) { shown = null; return; }
      if (pump !== shown) {
        shown = pump;
        const T = PUMP_TIERS[pump.tier];
        name.textContent = `Pompe en ${T.name}`;
        el.style.setProperty('--c', `#${T.color.toString(16).padStart(6, '0')}`);
      }
      el.classList.toggle('out', !filling);
      hint.textContent = filling ? '' : G.outHint;
      // La bière monte du fond du verre (y 86) jusqu'au bord (y 6), la mousse la coiffe
      const h = Math.max(0, Math.min(1, pump.fill)) * 80;
      beer.setAttribute('y', String(86 - h));
      beer.setAttribute('height', String(h));
      foam.setAttribute('y', String(86 - h - 6));
      foam.style.display = pump.fill > 0.02 ? '' : 'none';
      for (const b of bubbles) b.style.display = pump.fill > 0.1 ? '' : 'none';
    },
    hide() { el.classList.remove('on'); shown = null; },
  };
}
