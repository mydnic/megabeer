import { LEVEL_UP_SCREEN as L, RARITIES } from '../config/upgrades';
import { cardText, type Card } from '../game/levelUpCards';

import { blondeIcon } from './icons';

const BOTTLE_SVG = blondeIcon('lu-bottle');

const CSS = `
.lu { position: fixed; inset: 0; z-index: 40; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4vh; background: radial-gradient(ellipse at center, rgba(20,10,4,.55), rgba(10,5,2,.85)); font-family: 'Lilita One', system-ui, sans-serif;
  opacity: 0; pointer-events: none; transition: opacity .2s; }
.lu.on { opacity: 1; pointer-events: auto; }
.lu-title { color: #ffc93a; font-size: clamp(34px, 5vw, 60px); letter-spacing: .03em; transform: rotate(-2deg);
  text-shadow: -4px 0 #1a120c, 4px 0 #1a120c, 0 -4px #1a120c, 0 4px #1a120c, 4px 4px #1a120c, -4px 4px #1a120c, 0 8px 0 #1a120c; }
.lu-cards { display: flex; gap: clamp(12px, 2.5vw, 34px); flex-wrap: wrap; justify-content: center; padding: 0 16px; }
.lu-card { --c: #fff; position: relative; width: clamp(170px, 19vw, 240px); padding: 18px 16px 22px; border-radius: 20px; cursor: pointer;
  background: linear-gradient(#4a2e1c, #2c1a10); border: 4px solid var(--c); box-shadow: 0 7px 0 #1a120c, 0 0 0 3px #1a120c;
  display: flex; flex-direction: column; align-items: center; gap: 10px; color: #f3e6cf; text-align: center;
  transform: translateY(40px) scale(.9); opacity: 0; transition: transform .12s, box-shadow .12s; }
.lu.on .lu-card { animation: lu-in .38s cubic-bezier(.2,1.4,.4,1) forwards; }
.lu-card:nth-child(2) { animation-delay: .07s !important; } .lu-card:nth-child(3) { animation-delay: .14s !important; }
@keyframes lu-in { to { transform: translateY(0) scale(1); opacity: 1; } }
.lu-card.sel { transform: translateY(-10px) scale(1.06) !important; box-shadow: 0 12px 0 #1a120c, 0 0 0 3px #1a120c, 0 0 34px var(--c); }
.lu-tier { font-size: 15px; letter-spacing: .1em; text-transform: uppercase; color: var(--c);
  text-shadow: -2px 0 #1a120c, 2px 0 #1a120c, 0 -2px #1a120c, 0 2px #1a120c; }
.lu-bottle { width: 46px; height: 100px; filter: drop-shadow(0 4px 0 rgba(0,0,0,.35)); }
.lu-name { font-size: 26px; color: #fff; } .lu-lvl { font-size: 15px; color: #cdbfa6; margin-top: -8px; }
.lu-eff { font-size: 20px; color: var(--c); line-height: 1.15; min-height: 46px; display: flex; align-items: center;
  text-shadow: -2px 0 #1a120c, 2px 0 #1a120c, 0 -2px #1a120c, 0 2px #1a120c; }
.lu-key { position: absolute; top: -14px; left: -14px; width: 30px; height: 30px; border-radius: 50%; background: #1a120c; color: #f3e6cf;
  display: flex; align-items: center; justify-content: center; font-size: 16px; border: 3px solid var(--c); }
.lu-card.t2, .lu-card.t3 { background: linear-gradient(#4b2f3e, #2a1520); }
.lu-card.t4 { background: linear-gradient(#5a4210, #2e1f06); }
.lu-card.t4::after { content: ''; position: absolute; inset: 0; border-radius: 16px; pointer-events: none;
  background: linear-gradient(115deg, transparent 30%, rgba(255,240,180,.35) 45%, transparent 60%) -200% 0 / 300% 100%;
  animation: lu-shine 1.8s linear infinite; }
@keyframes lu-shine { to { background-position: 200% 0; } }
.lu-hint { color: #cdbfa6; font-size: 15px; letter-spacing: .04em; }
`;

/**
 * Écran de level-up : le jeu est en pause, 3 cartes au choix. Souris, clavier (1 2 3, flèches,
 * Entrée / Espace) ou manette (stick / croix, A). La couleur du cadre dit la rareté.
 */
export function createLevelUpScreen(onPick: (card: Card) => void, onHover: () => void) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'lu';
  el.innerHTML = `<div class="lu-title"></div><div class="lu-cards"></div><div class="lu-hint">Clic, 1 2 3, ou flèches et Espace</div>`;
  document.body.appendChild(el);
  const title = el.querySelector<HTMLElement>('.lu-title')!;
  const row = el.querySelector<HTMLElement>('.lu-cards')!;
  let cards: Card[] = [];
  let sel = 0, open = false, openedAt = 0, lastMoveX = 0;

  function select(i: number) {
    if (i === sel) return;
    sel = (i + cards.length) % cards.length;
    [...row.children].forEach((c, k) => c.classList.toggle('sel', k === sel));
    onHover();
  }
  function pick(i: number) {
    if (!open || performance.now() - openedAt < L.inputDelay * 1000) return;
    open = false;
    el.classList.remove('on');
    onPick(cards[i]);
  }
  addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.code === 'Digit1' || e.code === 'Numpad1') pick(0);
    else if (e.code === 'Digit2' || e.code === 'Numpad2') pick(1);
    else if (e.code === 'Digit3' || e.code === 'Numpad3') pick(2);
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') select(sel - 1);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') select(sel + 1);
    else if (e.code === 'Enter') pick(sel);
  });

  return {
    get open() { return open; },
    show(level: number, list: Card[]) {
      cards = list;
      sel = 0;
      title.textContent = `${level}° atteint !`;
      row.innerHTML = '';
      list.forEach((c, i) => {
        const r = RARITIES[c.tier];
        const d = document.createElement('div');
        d.className = `lu-card t${c.tier}${i === 0 ? ' sel' : ''}`;
        d.style.setProperty('--c', r.color);
        d.innerHTML = `<div class="lu-key">${i + 1}</div><div class="lu-tier">${r.name}</div>${BOTTLE_SVG}
          <div class="lu-name">Blonde</div><div class="lu-eff">${cardText(c)}</div>`;
        d.addEventListener('mouseenter', () => select(i));
        d.addEventListener('click', (e) => { e.stopPropagation(); pick(i); });
        row.appendChild(d);
      });
      // Relance l'animation d'entrée
      el.classList.remove('on');
      void el.offsetWidth;
      el.classList.add('on');
      open = true;
      openedAt = performance.now();
      if (document.pointerLockElement) document.exitPointerLock();
    },
    /** Manette et Espace : appelée chaque frame avec l'entrée du jeu. */
    input(moveX: number, confirm: boolean) {
      if (!open) return;
      const dir = moveX > 0.5 ? 1 : moveX < -0.5 ? -1 : 0;
      if (dir && dir !== lastMoveX) select(sel + dir);
      lastMoveX = dir;
      if (confirm) pick(sel);
    },
    hide() { open = false; el.classList.remove('on'); },
  };
}
