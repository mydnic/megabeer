import { HEALTH_HUD as H } from '../config/player';
import type { Health } from '../player/health';
import { ensureIconDefs, G, P } from './iconKit';

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Lilita+One&display=swap');
.hp-wrap { position: fixed; top: 18px; left: 26px; width: min(320px, 60vw); pointer-events: none; user-select: none;
  font-family: 'Lilita One', system-ui, sans-serif; z-index: 10; }
.hp-bar { position: relative; height: 26px; border: 3px solid #1a120c; border-radius: 15px; background: #3a2418;
  box-shadow: 0 3px 0 rgba(26,18,12,.55), inset 0 3px 6px rgba(0,0,0,.45); overflow: hidden; }
.hp-trail, .hp-fill { position: absolute; inset: 0 auto 0 0; border-radius: 12px; }
.hp-trail { background: #ffe0a8; }
.hp-fill { background: linear-gradient(#ff7a55, #e0301e 55%, #b01a12); overflow: hidden; transition: filter .25s; }
/* Reflets en biais qui glissent dans la barre */
.hp-fill::before { content: ''; position: absolute; inset: 0 -40px; opacity: .16;
  background: repeating-linear-gradient(115deg, #fff 0 10px, transparent 10px 26px); animation: hp-slide 1.6s linear infinite; }
@keyframes hp-slide { to { transform: translateX(28.7px); } }
.hp-wrap.hit .hp-fill { animation: hp-flash .3s ease-out; }
@keyframes hp-flash { 0% { filter: brightness(3) saturate(.2); } 100% { filter: none; } }
/* PV bas : la barre bat comme un coeur ; soin : éclat vert */
.hp-wrap.low .hp-bar { animation: hp-beat .55s ease-in-out infinite; }
@keyframes hp-beat { 0%, 100% { transform: scale(1); } 30% { transform: scale(1.045); box-shadow: 0 3px 0 rgba(26,18,12,.55), 0 0 16px #ff3a20, inset 0 3px 6px rgba(0,0,0,.45); } }
.hp-wrap.heal .hp-fill { animation: hp-heal .5s ease-out; }
@keyframes hp-heal { 0% { filter: brightness(1.8) hue-rotate(95deg); } 100% { filter: none; } }
/* Coeur qui bat au bout de la barre */
.hp-heart { position: absolute; left: -12px; top: -8px; width: 42px; height: 42px; z-index: 2; animation: hp-heart 1.1s ease-in-out infinite;
  filter: drop-shadow(0 3px 0 rgba(26,18,12,.6)); }
.hp-wrap.low .hp-heart { animation-duration: .55s; }
@keyframes hp-heart { 0%, 100% { transform: scale(1); } 12% { transform: scale(1.16); } 24% { transform: scale(1); } 36% { transform: scale(1.1); } 48% { transform: scale(1); } }
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
  ensureIconDefs();
  wrap.innerHTML = `<div class="hp-bar"><div class="hp-trail"></div><div class="hp-fill"></div><div class="hp-text"></div></div>
    <svg class="hp-heart" viewBox="0 0 64 64">${P('M32 56C12 42 5 32 5 21C5 12 12 6 20 6c5 0 9.500 2.500 12 7c2.500-4.500 7-7 12-7c8 0 15 6 15 15c0 11-7 21-27 35z', G.red, 'ball', 4)}
    <path d="M15 20c1-4.500 4-7 8-7.500" stroke="#fff" stroke-opacity=".85" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;
  document.body.appendChild(wrap);
  const fill = wrap.querySelector<HTMLElement>('.hp-fill')!;
  const trail = wrap.querySelector<HTMLElement>('.hp-trail')!;
  const text = wrap.querySelector<HTMLElement>('.hp-text')!;
  const vignette = document.createElement('div');
  vignette.className = 'hp-vignette';
  document.body.appendChild(vignette);

  let shown = -1, trailRatio = 1, trailWait = 0, t = 0;

  return {
    /** Masquée sur l'écran d'accueil. */
    setVisible(v: boolean) {
      wrap.style.display = v ? '' : 'none';
      if (!v) vignette.style.opacity = '0';
    },
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
        // Soin net (pas la régénération au fil de l'eau) : éclat vert
        if (shown >= 0 && health.hp - shown >= H.healFlash) { wrap.classList.remove('heal'); void wrap.offsetWidth; wrap.classList.add('heal'); }
        wrap.classList.toggle('low', r < H.lowRatio && !health.dead);
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
