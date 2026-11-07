import { HEALTH_HUD as H } from '../config/player';
import type { Health } from '../player/health';

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Lilita+One&display=swap');
.hp-wrap { position: fixed; top: 18px; left: 18px; width: min(320px, 60vw); pointer-events: none; user-select: none;
  font-family: 'Lilita One', system-ui, sans-serif; z-index: 10; }
.hp-bar { position: relative; height: 26px; border: 3px solid #1a120c; border-radius: 15px; background: #3a2418;
  box-shadow: 0 3px 0 rgba(26,18,12,.55), inset 0 3px 6px rgba(0,0,0,.45); overflow: hidden; }
.hp-trail, .hp-fill { position: absolute; inset: 0 auto 0 0; border-radius: 12px; }
.hp-trail { background: #ffe0a8; }
.hp-fill { background: linear-gradient(#ff6a48, #e0301e 55%, #b81d14); }
.hp-fill::after { content: ''; position: absolute; left: 8px; right: 8px; top: 3px; height: 6px; border-radius: 4px;
  background: rgba(255,255,255,.35); }
.hp-text { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #fff;
  font-size: 17px; letter-spacing: .5px; line-height: 1;
  text-shadow: -2px 0 #1a120c, 2px 0 #1a120c, 0 -2px #1a120c, 0 2px #1a120c, 2px 2px #1a120c, -2px 2px #1a120c; }
.hp-wrap.hit { animation: hp-shake .28s ease-out; }
@keyframes hp-shake { 0% { transform: translate(0,0) } 20% { transform: translate(-5px,2px) } 40% { transform: translate(5px,-2px) }
  60% { transform: translate(-3px,1px) } 80% { transform: translate(2px,0) } 100% { transform: translate(0,0) } }
.hp-vignette { position: fixed; inset: 0; pointer-events: none; z-index: 9; opacity: 0;
  background: radial-gradient(ellipse at center, rgba(160,0,0,0) 45%, rgba(170,8,0,.55) 78%, rgba(120,0,0,.95) 100%); }
`;

/** Barre de PV (haut gauche) et bord d'écran rouge quand les PV sont bas. */
export function createHealthHud(health: Health) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.className = 'hp-wrap';
  wrap.innerHTML = '<div class="hp-bar"><div class="hp-trail"></div><div class="hp-fill"></div><div class="hp-text"></div></div>';
  document.body.appendChild(wrap);
  const fill = wrap.querySelector<HTMLElement>('.hp-fill')!;
  const trail = wrap.querySelector<HTMLElement>('.hp-trail')!;
  const text = wrap.querySelector<HTMLElement>('.hp-text')!;
  const vignette = document.createElement('div');
  vignette.className = 'hp-vignette';
  document.body.appendChild(vignette);

  let shown = -1, trailRatio = 1, trailWait = 0, t = 0;

  return {
    /** Petit tremblement de la barre quand un coup est encaissé. */
    hit() {
      wrap.classList.remove('hit');
      void wrap.offsetWidth; // relance l'animation
      wrap.classList.add('hit');
      trailWait = H.trailDelay;
    },
    update(dt: number) {
      t += dt;
      const r = health.ratio;
      if (health.hp !== shown) {
        shown = health.hp;
        fill.style.width = `${r * 100}%`;
        text.textContent = `${Math.ceil(health.hp)} / ${health.max}`;
      }
      // Barre fantôme : reste un instant sur l'ancienne valeur puis descend
      if (trailRatio < r) trailRatio = r;
      else if (trailWait > 0) trailWait -= dt;
      else trailRatio = Math.max(r, trailRatio - H.trailSpeed * dt);
      trail.style.width = `${trailRatio * 100}%`;
      // Bord rouge : apparaît sous le seuil, plus fort et plus rapide quand on approche de 0
      const low = r < H.lowRatio ? 0.35 + 0.65 * (1 - r / H.lowRatio) : 0;
      const pulse = 0.75 + 0.25 * Math.sin(t * Math.PI * 2 * H.pulseRate * (1 + low));
      vignette.style.opacity = String(health.dead ? 0 : low * H.vignetteMax * pulse);
    },
  };
}
