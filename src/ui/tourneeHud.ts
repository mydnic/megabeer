import { TOURNEE_HUD as H } from '../config/hud';
import { TOURNEES, type TourneeId } from '../config/tournees';
import { TOURNEE_IDS } from '../game/tournees';
import { tourneeIcon } from './tourneeIcons';

const CSS = `
.tnh { position: fixed; left: 50%; transform: translateX(-50%); z-index: 10; display: flex; pointer-events: none; user-select: none;
  font-family: 'Lilita One', system-ui, sans-serif; }
.tnh-b { position: relative; border-radius: 50%; display: grid; place-items: center; box-sizing: border-box;
  background: conic-gradient(var(--c) calc(var(--k) * 360deg), rgba(26,18,12,.75) 0);
  box-shadow: 0 3px 0 rgba(26,18,12,.55), 0 0 0 2px #1a120c; animation: tnh-in .45s cubic-bezier(.2,1.6,.4,1); }
.tnh-b::before { content: ''; position: absolute; inset: 4px; border-radius: 50%;
  background: radial-gradient(circle at 50% 35%, rgba(96,62,40,.97), rgba(44,28,18,.95) 78%); box-shadow: inset 0 0 0 2px #1a120c; }
.tnh-b svg { position: relative; width: 74%; height: 74%; filter: drop-shadow(0 2px 0 rgba(0,0,0,.35)); }
.tnh-t { position: absolute; bottom: -9px; left: 50%; transform: translateX(-50%); padding: 0 5px; border-radius: 8px; font-size: 12px;
  line-height: 16px; background: #f3e6cf; color: #2a1608; border: 2px solid #1a120c; }
.tnh-b.low { animation: tnh-low .5s ease-in-out infinite alternate; }
@keyframes tnh-in { 0% { transform: scale(.2) rotate(-40deg); } 100% { transform: scale(1); } }
@keyframes tnh-low { 100% { transform: scale(.9); filter: brightness(1.5); } }
`;

/**
 * Tournées du bar en cours, sous le chrono : une pastille par tournée, son icône au milieu, un anneau de sa
 * couleur qui se vide avec le temps qu'il reste, et les secondes. Elle bat quand il n'en reste presque plus.
 */
export function createTourneeHud() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'tnh';
  el.style.top = `${H.top}px`;
  el.style.gap = `${H.gap}px`;
  document.body.appendChild(el);
  const badges = new Map<TourneeId, { b: HTMLElement; t: HTMLElement }>();

  return {
    setVisible(v: boolean) { el.style.display = v ? '' : 'none'; },
    /** Décale les pastilles vers le bas (px), pour laisser la place à la barre d'un boss. */
    setOffset(px: number) { el.style.top = `${H.top + px}px`; },
    /** Chaque image : le temps qu'il reste à chaque tournée (0 : inactive). */
    update(left: (id: TourneeId) => number) {
      for (const id of TOURNEE_IDS) {
        const s = left(id);
        let badge = badges.get(id);
        if (s <= 0) {
          if (badge) { badge.b.remove(); badges.delete(id); }
          continue;
        }
        if (!badge) {
          const b = document.createElement('div');
          b.className = 'tnh-b';
          b.style.width = b.style.height = `${H.size}px`;
          b.style.setProperty('--c', `#${TOURNEES[id].color.toString(16).padStart(6, '0')}`);
          b.innerHTML = `${tourneeIcon(id, '')}<div class="tnh-t"></div>`;
          el.appendChild(b);
          badge = { b, t: b.querySelector<HTMLElement>('.tnh-t')! };
          badges.set(id, badge);
        }
        badge.b.style.setProperty('--k', String(s / TOURNEES[id].duration));
        badge.t.textContent = `${Math.ceil(s)}`;
        badge.b.classList.toggle('low', s < H.lowAt);
      }
    },
    clear() { for (const { b } of badges.values()) b.remove(); badges.clear(); },
  };
}
