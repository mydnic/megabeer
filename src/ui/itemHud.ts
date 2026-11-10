import { ITEM_HUD as H } from '../config/hud';
import type { ItemId } from '../config/items';
import { RARITIES } from '../config/upgrades';
import { itemIcon } from './icons';

const CSS = `
.itm { position: fixed; left: 18px; z-index: 10; display: flex; flex-wrap: wrap; pointer-events: none; user-select: none;
  font-family: 'Lilita One', system-ui, sans-serif; }
.itm-slot { position: relative; border: 3px solid var(--c); border-radius: 10px;
  background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--c) 30%, rgba(96,62,40,.95)), rgba(44,28,18,.92) 78%);
  box-shadow: 0 3px 0 rgba(26,18,12,.55), 0 0 0 2px #1a120c, inset 0 2px 0 rgba(255,255,255,.2), inset 0 -5px 7px rgba(0,0,0,.35);
  display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.itm-slot svg { width: 84%; height: 84%; filter: drop-shadow(0 2px 0 rgba(0,0,0,.35)); }
.itm-slot::after { content: ''; position: absolute; inset: -3px; border-radius: 10px; border: 4px solid var(--c); opacity: 0; pointer-events: none; }
.itm-slot.pop::after { animation: itm-ring .6s ease-out; }
@keyframes itm-ring { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(2.2); opacity: 0; } }
.itm-n { position: absolute; right: -8px; bottom: -8px; min-width: 20px; height: 20px; padding: 0 4px; border-radius: 10px;
  border: 2px solid #1a120c; background: #f3e6cf; color: #2a1608; font-size: 12px; line-height: 16px; text-align: center; box-sizing: border-box; }
.itm-slot.pop { animation: itm-pop .5s cubic-bezier(.2,1.6,.4,1); }
@keyframes itm-pop { 0% { transform: scale(.2) rotate(30deg); filter: brightness(3); } 45% { transform: scale(1.45) rotate(-10deg); filter: brightness(1.6); } 70% { transform: scale(.92) rotate(4deg); } 100% { transform: scale(1); filter: none; } }
`;

/**
 * Objets ramassés dans les coffres, sous les armes : une case par objet, cadre de la couleur de sa
 * meilleure rareté, nombre d'exemplaires en pastille. L'objet qui vient d'arriver fait un saut.
 */
export function createItemHud() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'itm';
  el.style.top = `${H.top}px`;
  el.style.gap = `${H.gap}px`;
  el.style.maxWidth = `${H.perRow * (H.size + H.gap)}px`;
  document.body.appendChild(el);
  let shown = '';

  return {
    setVisible(v: boolean) { el.style.display = v ? '' : 'none'; },
    update(items: readonly { item: ItemId; rarity: number }[]) {
      // Regroupés par objet, dans l'ordre d'arrivée
      const groups = new Map<ItemId, { n: number; rarity: number }>();
      for (const it of items) {
        const g = groups.get(it.item);
        if (g) { g.n++; g.rarity = Math.max(g.rarity, it.rarity); } else groups.set(it.item, { n: 1, rarity: it.rarity });
      }
      const key = [...groups].map(([id, g]) => `${id}:${g.n}:${g.rarity}`).join('|');
      if (key === shown) return;
      const before = new Map(shown ? shown.split('|').map((s) => [s.split(':')[0], s] as const) : []);
      shown = key;
      el.innerHTML = '';
      for (const [id, g] of groups) {
        const s = document.createElement('div');
        s.className = 'itm-slot';
        s.style.width = s.style.height = `${H.size}px`;
        s.style.setProperty('--c', RARITIES[g.rarity].color);
        s.innerHTML = `${itemIcon(id, '')}${g.n > 1 ? `<div class="itm-n">x${g.n}</div>` : ''}`;
        if (before.get(id) !== `${id}:${g.n}:${g.rarity}`) s.classList.add('pop');
        el.appendChild(s);
      }
    },
  };
}
