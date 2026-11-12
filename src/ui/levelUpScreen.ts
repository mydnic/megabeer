import { ITEMS } from '../config/items';
import { LEVEL_UP_SCREEN as L, RARITIES } from '../config/upgrades';
import { cardText, itemCardText, statCardText, type Card } from '../game/levelUpCards';
import { PUMP_TIERS, STAT_BONUSES } from '../config/pumps';
import { SYNERGIES, WEAPON_INFO } from '../config/weapons';
import { pumpIcon, weaponIcon, itemIcon, chestSvg } from './icons';

const OUTLINE = '-2px 0 #1a120c, 2px 0 #1a120c, 0 -2px #1a120c, 0 2px #1a120c';
const CSS = `
.lu { position: fixed; inset: 0; z-index: 40; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4vh; background: radial-gradient(ellipse at center, rgba(20,10,4,.55), rgba(10,5,2,.85)); font-family: 'Lilita One', system-ui, sans-serif;
  opacity: 0; pointer-events: none; transition: opacity .2s; overflow: hidden; }
.lu.on { opacity: 1; pointer-events: auto; }
/* Rayons qui tournent lentement derrière tout l'écran, de la couleur de l'occasion */
.lu::before { content: ''; position: absolute; left: 50%; top: 48%; width: 170vmax; aspect-ratio: 1; translate: -50% -50%; pointer-events: none;
  background: repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--c, #ffc93a) 16%, transparent) 0deg 6deg, transparent 6deg 18deg);
  -webkit-mask: radial-gradient(circle, #000 0, transparent 52%); mask: radial-gradient(circle, #000 0, transparent 52%);
  animation: lu-rays 50s linear infinite; }
@keyframes lu-rays { to { rotate: 360deg; } }
.lu > * { position: relative; }
.lu-title { color: #ffc93a; font-size: clamp(34px, 5vw, 60px); letter-spacing: .03em; transform: rotate(-2deg);
  background: linear-gradient(#fff3b0 10%, #ffc93a 45%, #f08a12 90%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  filter: drop-shadow(-3px 0 #1a120c) drop-shadow(3px 0 #1a120c) drop-shadow(0 -3px #1a120c) drop-shadow(0 3px #1a120c) drop-shadow(0 6px 0 #1a120c); }
.lu.on .lu-title { animation: lu-title .5s cubic-bezier(.2,1.7,.4,1) both, lu-title-idle 2.4s ease-in-out .5s infinite; }
@keyframes lu-title { from { transform: rotate(-9deg) scale(.3); opacity: 0; } }
@keyframes lu-title-idle { 50% { transform: rotate(-1deg) scale(1.035); } }
.lu-cards { display: flex; gap: clamp(12px, 2.5vw, 34px); flex-wrap: wrap; justify-content: center; padding: 0 16px; }
.lu-card { --c: #fff; position: relative; width: clamp(170px, 19vw, 240px); padding: 18px 16px 22px; border-radius: 20px; cursor: pointer;
  background: linear-gradient(#573620, #2c1a10 72%); border: 4px solid var(--c);
  box-shadow: 0 7px 0 #1a120c, 0 0 0 3px #1a120c, inset 0 2px 0 rgba(255,255,255,.2), inset 0 -22px 34px rgba(0,0,0,.28);
  display: flex; flex-direction: column; align-items: center; gap: 10px; color: #f3e6cf; text-align: center;
  transform: translateY(40px) scale(.9); opacity: 0; transition: transform .14s cubic-bezier(.2,1.5,.4,1), box-shadow .14s; }
.lu.on .lu-card { animation: lu-in .42s cubic-bezier(.2,1.4,.4,1) forwards; }
.lu-card:nth-child(2) { animation-delay: .07s !important; } .lu-card:nth-child(3) { animation-delay: .14s !important; }
@keyframes lu-in { 0% { transform: translateY(70px) scale(.7) rotate(calc((var(--i) - 1) * 7deg)); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
.lu-card.sel { transform: translateY(-12px) scale(1.07) !important;
  box-shadow: 0 13px 0 #1a120c, 0 0 0 3px #1a120c, 0 0 38px var(--c), inset 0 2px 0 rgba(255,255,255,.3), inset 0 -22px 34px rgba(0,0,0,.2); }
/* Reflet qui balaie la carte quand elle est choisie (en boucle sur les Légendaires) */
.lu-shine { position: absolute; inset: 0; border-radius: 16px; overflow: hidden; pointer-events: none; }
.lu-shine::before { content: ''; position: absolute; inset: -20% -60%; translate: -120% 0;
  background: linear-gradient(115deg, transparent 40%, rgba(255,250,225,.5) 50%, transparent 60%); }
.lu-card.sel .lu-shine::before { animation: lu-sweep .65s ease-out; }
.lu-card.t4 .lu-shine::before { animation: lu-sweep 1.9s ease-in-out infinite; }
@keyframes lu-sweep { to { translate: 120% 0; } }
.lu-tier { font-size: 15px; letter-spacing: .1em; text-transform: uppercase; color: var(--c); text-shadow: ${OUTLINE}; }
/* Présentoir de l'icône : halo de la couleur de la rareté, fins rayons qui tournent, icône qui flotte */
.lu-art { position: relative; width: 124px; height: 106px; display: grid; place-items: center; }
.lu-art::before { content: ''; position: absolute; width: 112px; aspect-ratio: 1; border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--c) 60%, transparent) 0, color-mix(in srgb, var(--c) 18%, transparent) 42%, transparent 68%);
  animation: lu-halo 2.2s ease-in-out infinite alternate; }
.lu-art::after { content: ''; position: absolute; width: 150px; aspect-ratio: 1; border-radius: 50%; opacity: .5;
  background: repeating-conic-gradient(from 0deg, var(--c) 0deg 5deg, transparent 5deg 30deg);
  -webkit-mask: radial-gradient(circle, transparent 26%, #000 34%, transparent 66%); mask: radial-gradient(circle, transparent 26%, #000 34%, transparent 66%);
  animation: lu-rays 16s linear infinite; }
@keyframes lu-halo { to { scale: 1.14; opacity: .75; } }
.lu-art svg { position: relative; z-index: 1; filter: drop-shadow(0 5px 0 rgba(0,0,0,.4)); animation: lu-float 2.6s ease-in-out infinite; animation-delay: calc(var(--i) * -.85s); }
@keyframes lu-float { 0%, 100% { transform: translateY(2px) rotate(-2.500deg); } 50% { transform: translateY(-5px) rotate(2.500deg); } }
.lu-card.sel .lu-art svg { animation: lu-cheer .5s cubic-bezier(.2,1.6,.4,1), lu-float 2.6s ease-in-out .5s infinite; }
@keyframes lu-cheer { 0% { transform: scale(1); } 40% { transform: scale(1.28) rotate(-9deg); } 100% { transform: translateY(2px) rotate(-2.500deg); } }
.lu-bottle { width: 46px; height: 100px; }
.lu-item { width: 96px; height: 96px; }
.lu-name { font-size: 26px; color: #fff; text-shadow: 0 3px 0 rgba(0,0,0,.35); } .lu-lvl { font-size: 15px; color: #cdbfa6; margin-top: -8px; }
.lu-eff { font-size: 20px; color: var(--c); line-height: 1.15; min-height: 46px; display: flex; align-items: center; text-shadow: ${OUTLINE}; }
.lu-key { position: absolute; top: -14px; left: -14px; width: 30px; height: 30px; border-radius: 50%; background: #1a120c; color: #f3e6cf;
  display: flex; align-items: center; justify-content: center; font-size: 16px; border: 3px solid var(--c); z-index: 2; }
.lu-card.t2, .lu-card.t3 { background: linear-gradient(#56354a, #2a1520 72%); }
.lu-card.t4 { background: linear-gradient(#6a4e12, #2e1f06 72%); }
/* Dingue et Légendaire : petites étoiles qui scintillent autour de l'icône */
.lu-tw { position: absolute; z-index: 2; width: 14px; aspect-ratio: 1; background: #fff; opacity: 0;
  clip-path: polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%); animation: lu-tw 1.6s ease-in-out infinite; }
.lu-card:not(.t3):not(.t4) .lu-tw { display: none; }
.lu-tw:nth-of-type(1) { left: 6px; top: 10px; } .lu-tw:nth-of-type(2) { right: 4px; top: 30px; animation-delay: .5s; width: 10px; }
.lu-tw:nth-of-type(3) { left: 22px; bottom: 6px; animation-delay: 1s; width: 11px; }
@keyframes lu-tw { 0%, 100% { opacity: 0; scale: .3; rotate: 0deg; } 50% { opacity: 1; scale: 1; rotate: 90deg; } }
.lu-card.new { background: linear-gradient(#6a3214, #2e1408 72%); }
.lu-card.new .lu-eff { font-size: 16px; color: #f3e6cf; }
.lu-syn { margin-top: -2px; padding: 4px 10px; border-radius: 10px; border: 2px solid #1a120c; background: var(--s); color: #2a1608;
  font-size: 14px; line-height: 1.1; box-shadow: 0 3px 0 #1a120c; animation: lu-syn 1.2s ease-in-out infinite alternate; }
.lu-syn small { display: block; font-size: 11px; opacity: .85; }
@keyframes lu-syn { to { box-shadow: 0 3px 0 #1a120c, 0 0 16px var(--s); } }
.lu-hint { color: #cdbfa6; font-size: 15px; letter-spacing: .04em; }
/* Coffre ouvert sous les cartes : elles en sortent une par une */
.lu-chest { position: relative; width: clamp(110px, 16vh, 180px); margin-top: -1vh; }
.lu:not(.chest) .lu-chest { display: none; }
.lu-chest .ch-ray { display: none; }
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
/* Choix fait : la carte prise s'envole dans un éclat, les autres retombent, le jeu reprend derrière */
.lu.leave { pointer-events: none; background: transparent; transition: background .3s; }
.lu.leave::before, .lu.leave .lu-title, .lu.leave .lu-hint, .lu.leave .lu-chest { opacity: 0; transition: opacity .18s; animation: none; }
.lu.leave .lu-card { animation: lu-drop .28s ease-in forwards; }
.lu.leave .lu-card.picked { animation: lu-take ${L.outTime}s cubic-bezier(.3,0,.3,1) forwards; z-index: 3; }
.lu.leave .lu-card:nth-child(n) { animation-delay: 0s !important; }
@keyframes lu-drop { 0% { transform: none; opacity: 1; } 100% { transform: translateY(70px) scale(.8) rotate(calc((var(--i) - 1) * 9deg)); opacity: 0; } }
@keyframes lu-take { 0% { transform: translateY(-12px) scale(1.07); opacity: 1; filter: brightness(1); }
  30% { transform: translateY(-26px) scale(1.2); opacity: 1; filter: brightness(1.9); }
  100% { transform: translateY(-120px) scale(.55); opacity: 0; filter: brightness(2.4); } }
`;

/** Icône d'une carte sur son présentoir (halo, rayons, étoiles). */
const art = (icon: string) => `<div class="lu-art"><i class="lu-tw"></i><i class="lu-tw"></i><i class="lu-tw"></i>${icon}</div>`;

/**
 * Écran de level-up : le jeu est en pause, 3 cartes au choix. Souris, clavier (1 2 3, flèches,
 * Entrée / Espace) ou manette (stick ou croix directionnelle, X ou A pour valider). La couleur du cadre dit la rareté.
 */
export function createLevelUpScreen(onPick: (card: Card) => void, onHover: () => void) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'lu';
  el.innerHTML = `<div class="lu-title"></div><div class="lu-cards"></div><div class="lu-chest"></div><div class="lu-hint">Clic, 1 2 3, ou flèches et Espace ; manette : croix et X</div>`;
  document.body.appendChild(el);
  const title = el.querySelector<HTMLElement>('.lu-title')!;
  const row = el.querySelector<HTMLElement>('.lu-cards')!;
  const chestEl = el.querySelector<HTMLElement>('.lu-chest')!;
  let selTimer = 0, leaveTimer = 0;
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
    // Sortie : la carte prise s'envole, les autres retombent ; le jeu a déjà repris dessous
    clearTimeout(selTimer);
    [...row.children].forEach((c, k) => { c.classList.remove('sel'); c.classList.toggle('picked', k === i); });
    el.classList.add('leave');
    clearTimeout(leaveTimer);
    leaveTimer = window.setTimeout(() => el.classList.remove('on', 'leave'), L.outTime * 1000);
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
      clearTimeout(leaveTimer);
      title.textContent = heading ?? `${level}° atteint !`;
      row.innerHTML = '';
      list.forEach((c, i) => {
        const d = document.createElement('div');
        const key = `<div class="lu-shine"></div><div class="lu-key">${i + 1}</div>`;
        if (c.kind === 'weapon') {
          // Nouvelle arme : cadre à part, sa présentation à la place d'un effet chiffré
          const info = WEAPON_INFO[c.weaponId];
          d.className = 'lu-card new';
          d.style.setProperty('--c', L.newWeaponColor);
          d.innerHTML = `${key}<div class="lu-tier">Nouvelle arme</div>${art(weaponIcon(c.weaponId, 'lu-bottle'))}
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
          d.innerHTML = `${key}<div class="lu-tier">${r.name}</div>${art(pumpIcon('lu-bottle', PUMP_TIERS[c.tier].color))}
            <div class="lu-name">${label[0].toUpperCase()}${label.slice(1)}</div><div class="lu-eff">${statCardText(c)}</div>`;
        } else if (c.kind === 'item') {
          // Objet de coffre : cadre et nom de la rareté du coffre, son nom et son effet
          const r = RARITIES[c.rarity];
          const def = ITEMS[c.item];
          d.className = `lu-card t${c.rarity}`;
          d.style.setProperty('--c', r.color);
          d.innerHTML = `${key}<div class="lu-tier">${r.name}</div>${art(itemIcon(c.item, 'lu-item'))}
            <div class="lu-name">${def.name}</div><div class="lu-eff">${itemCardText(c)}</div>`;
        } else {
          const r = RARITIES[c.tier];
          d.className = `lu-card t${c.tier}`;
          d.style.setProperty('--c', r.color);
          d.innerHTML = `${key}<div class="lu-tier">${r.name}</div>${art(weaponIcon(c.weapon.id, 'lu-bottle'))}
            <div class="lu-name">${c.weapon.name}</div><div class="lu-eff">${cardText(c)}</div>`;
        }
        d.style.setProperty('--i', String(i));
        d.addEventListener('mouseenter', () => select(i));
        d.addEventListener('click', (e) => { e.stopPropagation(); pick(i); });
        row.appendChild(d);
      });
      // Coffre : chaque carte part de la bouche du coffre (mesurée avant l'animation)
      el.classList.remove('on', 'leave');
      el.classList.toggle('chest', !!chest);
      chestEl.innerHTML = chest ? chestSvg('open') : '';
      if (chest) el.style.setProperty('--c', chest);
      else el.style.removeProperty('--c');
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
    hide() { open = false; clearTimeout(leaveTimer); el.classList.remove('on', 'leave'); },
  };
}
