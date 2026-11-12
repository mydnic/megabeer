import { ITEMS, type ItemDef } from '../config/items';
import { RARITIES } from '../config/upgrades';
import { WEAPON_INFO } from '../config/weapons';
import { itemCardText } from '../game/levelUpCards';
import type { Profile } from '../meta/profile';
import { catalog, isStarting, owned, type ShopEntry } from '../meta/shop';
import { weaponIcon, tunasIcon } from './icons';
import { pint, svg64 } from './iconKit';
import { itemIcon } from './itemIcons';

const CSS = `
.shop { position: fixed; inset: 0; z-index: 38; display: flex; flex-direction: column; align-items: center; box-sizing: border-box;
  padding: 18px 16px 16px; font-family: 'Lilita One', system-ui, sans-serif; color: #f3e6cf; transition: opacity .2s;
  background: radial-gradient(ellipse at 50% 20%, rgba(90,52,24,.97), rgba(18,10,5,.98)); }
.shop.off { opacity: 0; pointer-events: none; }
.shop-head { display: flex; align-items: center; gap: 18px; width: min(1100px, 100%); }
.shop-title { font-size: clamp(34px, 5vw, 54px); letter-spacing: .05em; color: #ffc93a; transform: rotate(-2deg);
  text-shadow: -3px 0 #1a120c, 3px 0 #1a120c, 0 -3px #1a120c, 0 3px #1a120c, 0 6px 0 #1a120c; }
.shop-wallet { display: flex; align-items: center; gap: 8px; margin-left: auto; padding: 4px 14px 6px 10px; border: 3px solid #1a120c;
  border-radius: 16px; background: rgba(26,18,12,.7); font-size: 26px; color: #8fe07a; box-shadow: 0 4px 0 #1a120c; }
.shop-wallet svg { width: 32px; height: 32px; }
.shop-close { font: inherit; font-size: 20px; cursor: pointer; padding: 6px 18px 8px; border: 3px solid #1a120c; border-radius: 14px;
  color: #2a1608; background: linear-gradient(#ffd45a, #f5a623 60%, #e08a12); box-shadow: 0 4px 0 #1a120c; }
.shop-body { flex: 1; overflow-y: auto; width: min(1100px, 100%); margin-top: 12px; padding: 4px 6px 24px; box-sizing: border-box; }
.shop h2 { margin: 18px 0 8px; font-weight: normal; font-size: 24px; letter-spacing: .05em; }
.shop h3 { margin: 12px 0 6px; font-weight: normal; font-size: 18px; color: var(--c); text-shadow: 0 2px 0 #1a120c; }
.shop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; }
/* La rareté : un liseré de sa couleur tout autour, et sa pastille en haut à droite */
.shop-card { position: relative; display: grid; grid-template-columns: 52px 1fr; grid-template-rows: auto 1fr auto; column-gap: 10px; padding: 8px 10px 10px;
  border: 3px solid #1a120c; border-radius: 14px; background: linear-gradient(#fff8e2, #f1dcae); color: #2a1608;
  box-shadow: 0 4px 0 #1a120c, inset 0 0 0 3px var(--c); }
.shop-tag { position: absolute; top: -9px; right: 10px; padding: 0 8px 1px; border: 2px solid #1a120c; border-radius: 9px; background: var(--c);
  color: #1a120c; font-size: 12px; letter-spacing: .03em; }
.shop-card svg { grid-row: 1 / 3; width: 52px; height: 52px; }
.shop-card b { font-weight: normal; font-size: 18px; }
.shop-card p { margin: 2px 0 6px; font-size: 13px; line-height: 1.2; }
.shop-card.own { background: linear-gradient(#eef6e2, #d6e8c0); }
.shop-buy { grid-column: 1 / 3; display: flex; align-items: center; justify-content: center; gap: 6px; font: inherit; font-size: 17px;
  cursor: pointer; padding: 4px 10px 6px; border: 3px solid #1a120c; border-radius: 12px; color: #fff; background: linear-gradient(#5fc46a, #2f8a3e);
  box-shadow: 0 3px 0 #1a120c; transition: transform .08s; }
.shop-buy svg { width: 22px; height: 22px; }
.shop-buy:hover, .shop-buy:focus-visible { transform: scale(1.04); outline: 3px solid #ffc93a; outline-offset: 2px; }
.shop-buy.poor { background: linear-gradient(#8a7a6a, #5a4a3a); color: #e8dccb; cursor: default; }
.shop-buy.done { background: none; border-color: transparent; box-shadow: none; color: #2f8a3e; cursor: default; }
.shop-msg { min-height: 22px; margin-top: 6px; font-size: 16px; color: #ffb4a0; }
@media (max-width: 540px) { .shop-head { flex-wrap: wrap; } .shop-grid { grid-template-columns: 1fr; } }
`;

const TUNAS = tunasIcon();
/** Le Buveur : sa pinte. */
const BUVEUR = svg64('', pint(17, 10, 1, -8));
const WEAPON_COLOR = '#f5a623';
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * La boutique (accueil, bouton Boutique) : les TUNAS du joueur, puis trois rayons, Persos, Armes et Objets (par rareté).
 * Un article débloqué l'est pour toutes les runs suivantes. Souris, clavier ou manette (croix, A pour acheter, B pour
 * revenir : navigation commune des menus).
 */
export function createShopScreen(cb: { buy: (key: string) => boolean; profile: () => Profile; onClose: () => void }) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'shop off';
  el.innerHTML = `<div class="shop-head"><div class="shop-title">Boutique</div><div class="shop-wallet">${TUNAS}<span></span></div><button class="shop-close">Fermer</button></div>
    <div class="shop-msg"></div><div class="shop-body"></div>`;
  document.body.appendChild(el);
  const wallet = el.querySelector<HTMLElement>('.shop-wallet span')!;
  const body = el.querySelector<HTMLElement>('.shop-body')!;
  const msg = el.querySelector<HTMLElement>('.shop-msg')!;
  el.querySelector('.shop-close')!.addEventListener('click', (e) => { e.stopPropagation(); close(); });
  // L'article choisi à la manette reste visible
  el.addEventListener('focusin', (e) => (e.target as HTMLElement).scrollIntoView({ block: 'nearest' }));
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && !el.classList.contains('off')) { e.stopImmediatePropagation(); close(); } });

  function card(e: ShopEntry, p: Profile) {
    const have = owned(p, e.key);
    const poor = !have && p.tunas < e.price;
    const btn = have ? `<button class="shop-buy done" disabled>${isStarting(e.key) ? 'De base' : 'Débloqué'}</button>`
      : `<button class="shop-buy${poor ? ' poor' : ''}" data-k="${e.key}">${TUNAS}${e.price}</button>`;
    const box = (color: string, tag: string, icon: string, name: string, text: string) =>
      `<div class="shop-card${have ? ' own' : ''}" style="--c:${color}">${tag ? `<span class="shop-tag">${tag}</span>` : ''}${icon}<b>${esc(name)}</b><p>${esc(text)}</p>${btn}</div>`;
    if (e.kind === 'item') {
      const r = RARITIES[e.rarity];
      return box(r.color, r.name, itemIcon(e.item, ''), (ITEMS[e.item] as ItemDef).name, itemCardText({ kind: 'item', item: e.item, rarity: e.rarity }));
    }
    if (e.kind === 'weapon') return box(WEAPON_COLOR, '', weaponIcon(e.weapon, ''), WEAPON_INFO[e.weapon].name, WEAPON_INFO[e.weapon].pitch);
    return box(WEAPON_COLOR, '', BUVEUR, e.name, e.pitch);
  }

  function render() {
    const p = cb.profile();
    wallet.textContent = p.tunas.toLocaleString('fr');
    const all = catalog();
    const section = (title: string, list: ShopEntry[]) => `<h2>${title}</h2><div class="shop-grid">${list.map((e) => card(e, p)).join('')}</div>`;
    const items = all.filter((e): e is Extract<ShopEntry, { kind: 'item' }> => e.kind === 'item');
    const byRarity = RARITIES.map((r, i) => {
      const list = items.filter((e) => e.rarity === i);
      return list.length ? `<h3 style="--c:${r.color}">${r.name}</h3><div class="shop-grid">${list.map((e) => card(e, p)).join('')}</div>` : '';
    }).join('');
    body.innerHTML = section('Persos', all.filter((e) => e.kind === 'character'))
      + section('Armes', all.filter((e) => e.kind === 'weapon'))
      + `<h2>Objets</h2>${byRarity}`;
    for (const b of body.querySelectorAll<HTMLButtonElement>('.shop-buy[data-k]')) {
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const key = b.dataset.k!;
        if (cb.buy(key)) { msg.textContent = ''; render(); body.querySelector<HTMLElement>('.shop-buy[data-k]')?.focus({ preventScroll: true }); }
        else msg.textContent = 'Pas assez de TUNAS';
      });
      b.addEventListener('keydown', (ev) => { if (ev.code === 'Space' || ev.code === 'Enter') ev.stopPropagation(); });
    }
  }

  let onClose = cb.onClose;
  function close() {
    if (el.classList.contains('off')) return;
    el.classList.add('off');
    onClose();
  }

  return {
    root: el,
    get open() { return !el.classList.contains('off'); },
    show(whenClosed?: () => void) {
      if (whenClosed) onClose = whenClosed;
      msg.textContent = '';
      render();
      el.classList.remove('off');
      (el.querySelector<HTMLElement>('.shop-buy[data-k]') ?? el.querySelector<HTMLElement>('.shop-close'))!.focus({ preventScroll: true });
    },
    /** Les TUNAS ont changé (fin de run, connexion) : réaffiche si ouverte. */
    refresh() { if (!el.classList.contains('off')) render(); },
    close,
  };
}
