import { ITEMS } from '../config/items';
import { LEVEL_UP_SCREEN as L, RARITIES } from '../config/upgrades';
import { cardText, statCardText, type Card } from '../game/levelUpCards';
import { PUMP_TIERS, STAT_BONUSES } from '../config/pumps';
import { SYNERGIES, WEAPON_INFO } from '../config/weapons';
import { pumpIcon, weaponIcon, itemIcon, chestSvg } from './icons';

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
.lu-card.new { background: linear-gradient(#5a2a12, #2e1408); }
.lu-card.new .lu-eff { font-size: 16px; color: #f3e6cf; }
.lu-syn { margin-top: -2px; padding: 4px 10px; border-radius: 10px; border: 2px solid #1a120c; background: var(--s); color: #2a1608;
  font-size: 14px; line-height: 1.1; box-shadow: 0 3px 0 #1a120c; animation: lu-syn 1.2s ease-in-out infinite alternate; }
.lu-syn small { display: block; font-size: 11px; opacity: .85; }
@keyframes lu-syn { to { box-shadow: 0 3px 0 #1a120c, 0 0 16px var(--s); } }
.lu-hint { color: #cdbfa6; font-size: 15px; letter-spacing: .04em; }
.lu-item { width: 92px; height: 100px; filter: drop-shadow(0 4px 0 rgba(0,0,0,.35)); }
/* Coffre ouvert sous les cartes : elles en sortent une par une */
.lu-chest { position: relative; width: clamp(110px, 16vh, 180px); margin-top: -1vh; }
.lu:not(.chest) .lu-chest { display: none; }
.lu-chest svg { width: 100%; display: block; overflow: visible; position: relative; filter: drop-shadow(0 8px 0 rgba(10,6,4,.6)); }
.lu-chest::before { content: ''; position: absolute; left: 50%; top: 40%; width: 260%; aspect-ratio: 1; translate: -50% -50%; border-radius: 50%;
  background: radial-gradient(circle, var(--c), transparent 60%); opacity: .35; animation: lu-glow 1.6s ease-in-out infinite alternate; }
@keyframes lu-glow { to { opacity: .55; scale: 1.08; } }
.lu.on .lu-chest { animation: lu-chest .4s cubic-bezier(.2,1.6,.4,1) both; }
@keyframes lu-chest { from { transform: translateY(40px) scale(.6); opacity: 0; } }
.lu.on.chest .lu-card { animation: lu-pop var(--pop) cubic-bezier(.25,1.25,.45,1) forwards; }
.lu.chest .lu-card:nth-child(n) { animation-delay: var(--at) !important; }
@keyframes lu-pop { 0% { transform: translate(var(--fx), var(--fy)) scale(.12) rotate(var(--rot)); opacity: 0; }
  12% { opacity: 1; } 100% { transform: translate(0, 0) scale(1) rotate(0); opacity: 1; } }
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
  el.innerHTML = `<div class="lu-title"></div><div class="lu-cards"></div><div class="lu-chest"></div><div class="lu-hint">Clic, 1 2 3, ou flèches et Espace</div>`;
  document.body.appendChild(el);
  const title = el.querySelector<HTMLElement>('.lu-title')!;
  const row = el.querySelector<HTMLElement>('.lu-cards')!;
  const chestEl = el.querySelector<HTMLElement>('.lu-chest')!;
  let selTimer = 0;
  let cards: Card[] = [];
  let sel = 0, open = false, openedAt = 0, lastMoveX = 0;

  function select(i: number) {
    if (i === sel || performance.now() - openedAt < 50) return;
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
    /**
     * `heading` : titre à la place de « N° atteint ! » (pompe, coffre). `chest` : couleur de la rareté
     * d'un coffre, posé ouvert sous les cartes qui en sortent.
     */
    show(level: number, list: Card[], heading?: string, chest?: string) {
      cards = list;
      sel = 0;
      title.textContent = heading ?? `${level}° atteint !`;
      row.innerHTML = '';
      list.forEach((c, i) => {
        const d = document.createElement('div');
        const key = `<div class="lu-key">${i + 1}</div>`;
        if (c.kind === 'weapon') {
          // Nouvelle arme : cadre à part, sa présentation à la place d'un effet chiffré
          const info = WEAPON_INFO[c.weaponId];
          d.className = 'lu-card new';
          d.style.setProperty('--c', L.newWeaponColor);
          d.innerHTML = `${key}<div class="lu-tier">Nouvelle arme</div>${weaponIcon(c.weaponId, 'lu-bottle')}
            <div class="lu-name">${info.name}</div><div class="lu-eff">${info.pitch}</div>${c.synergies.map((s) => {
              const S = SYNERGIES[s];
              return `<div class="lu-syn" style="--s:${S.color}">Synergie : ${S.name}<small>${S.pitch}</small></div>`;
            }).join('')}`;
        } else if (c.kind === 'stat') {
          // Bonus de pompe : cadre et nom de sa rareté, comme les cartes d'arme
          const r = RARITIES[c.rarity];
          const label = STAT_BONUSES.find((b) => b.id === c.stat)!.label;
          d.className = `lu-card t${c.rarity}`;
          d.style.setProperty('--c', r.color);
          d.innerHTML = `${key}<div class="lu-tier">${r.name}</div>${pumpIcon('lu-bottle', PUMP_TIERS[c.tier].color)}
            <div class="lu-name">${label[0].toUpperCase()}${label.slice(1)}</div><div class="lu-eff">${statCardText(c)}</div>`;
        } else if (c.kind === 'item') {
          // Objet de coffre : cadre et nom de la rareté du coffre, son nom et son effet
          const r = RARITIES[c.rarity];
          const def = ITEMS[c.item];
          d.className = `lu-card t${c.rarity}`;
          d.style.setProperty('--c', r.color);
          d.innerHTML = `${key}<div class="lu-tier">${r.name}</div>${itemIcon(c.item, 'lu-item')}
            <div class="lu-name">${def.name}</div><div class="lu-eff">${statCardText({ kind: 'stat', stat: def.stat, value: c.value, rarity: c.rarity, tier: 'bronze' })}</div>`;
        } else {
          const r = RARITIES[c.tier];
          d.className = `lu-card t${c.tier}`;
          d.style.setProperty('--c', r.color);
          d.innerHTML = `${key}<div class="lu-tier">${r.name}</div>${weaponIcon(c.weapon.id, 'lu-bottle')}
            <div class="lu-name">${c.weapon.name}</div><div class="lu-eff">${cardText(c)}</div>`;
        }
        d.addEventListener('mouseenter', () => select(i));
        d.addEventListener('click', (e) => { e.stopPropagation(); pick(i); });
        row.appendChild(d);
      });
      // Coffre : chaque carte part de la bouche du coffre (mesurée avant l'animation)
      el.classList.remove('on');
      el.classList.toggle('chest', !!chest);
      chestEl.innerHTML = chest ? chestSvg('open') : '';
      if (chest) el.style.setProperty('--c', chest);
      let intro = L.introTime;
      if (chest) {
        const C = L.fromChest, m = chestEl.getBoundingClientRect();
        const mx = m.left + m.width / 2, my = m.top + m.height * C.mouth;
        [...row.children].forEach((d, i) => {
          const r = d.getBoundingClientRect(), h = d as HTMLElement;
          // La carte est encore décalée de son état de départ (translateY(40px)) : on mesure son centre au repos
          h.style.setProperty('--fx', `${(mx - (r.left + r.width / 2)).toFixed(0)}px`);
          h.style.setProperty('--fy', `${(my - (r.top + r.height / 2 - 40)).toFixed(0)}px`);
          h.style.setProperty('--rot', `${(i - (list.length - 1) / 2) * -C.spin}deg`);
          h.style.setProperty('--at', `${C.delay + C.stagger * i}s`);
          h.style.setProperty('--pop', `${C.duration}s`);
        });
        intro = C.delay + C.stagger * (list.length - 1) + C.duration;
      }
      void el.offsetWidth;
      el.classList.add('on');
      // La carte choisie ne se soulève qu'une fois l'entrée finie (sa pose écraserait l'animation)
      clearTimeout(selTimer);
      selTimer = window.setTimeout(() => { if (open) row.children[sel]?.classList.add('sel'); }, intro * 1000);
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
