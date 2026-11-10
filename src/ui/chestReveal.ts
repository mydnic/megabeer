import { CHEST_OPENING as O } from '../config/hud';
import { RARITIES } from '../config/upgrades';

/**
 * Cadence de l'ouverture d'un coffre, partagée par l'animation et les sons : la roulette des
 * couleurs ralentit (les écarts grandissent) puis s'arrête sur la vraie rareté ; le couvercle saute
 * juste après. Temps en secondes depuis le début.
 */
/** Cadence d'une ouverture donnée : tirée une fois, la même pour l'animation et les sons. */
const cache = new WeakMap<object, ReturnType<typeof makeSchedule>>();
export function revealSchedule(e: { rarity: number; duration: number }) {
  let s = cache.get(e);
  if (!s) cache.set(e, (s = makeSchedule(e.rarity, e.duration)));
  return s;
}

function makeSchedule(rarity: number, duration: number) {
  const stopAt = duration * O.stopAt;
  const n = O.spins + O.spinsPerRarity * rarity;
  const ticks: { t: number; rarity: number }[] = [];
  let prev = -1;
  for (let k = 1; k <= n; k++) {
    // Couleurs au hasard (jamais deux fois la même), la dernière est la vraie
    let r = k === n ? rarity : Math.floor(Math.random() * RARITIES.length);
    if (k < n && r === prev) r = (r + 1) % RARITIES.length;
    prev = r;
    ticks.push({ t: stopAt * (k / n) ** O.slowDown, rarity: r });
  }
  return { ticks, burst: stopAt + O.burstDelay, end: duration };
}

const CSS = `
.cr { position: fixed; inset: 0; z-index: 39; display: none; place-items: center; pointer-events: none; user-select: none;
  font-family: 'Lilita One', system-ui, sans-serif; --c: #f2ece0; }
.cr.on { display: grid; }
.cr-dim { position: absolute; inset: 0; background: radial-gradient(circle at 50% 50%, rgba(26,18,12,.35), rgba(10,6,4,.85));
  animation: cr-in .25s ease-out both; }
.cr.out { animation: cr-out .2s ease-in both; }
@keyframes cr-in { from { opacity: 0 } }
@keyframes cr-out { to { opacity: 0 } }
.cr-stage { position: relative; width: 420px; height: 420px; display: grid; place-items: center; }
.cr-rays { position: absolute; inset: -40px; border-radius: 50%; opacity: .55;
  background: repeating-conic-gradient(from 0deg, var(--c) 0deg 9deg, transparent 9deg 22deg);
  -webkit-mask: radial-gradient(circle, #000 18%, transparent 68%); mask: radial-gradient(circle, #000 18%, transparent 68%);
  animation: cr-spin 6s linear infinite; transition: background .08s; }
.cr.burst .cr-rays { opacity: 1; animation-duration: 2.2s; }
.cr.big .cr-rays { animation-duration: 1.2s; }
@keyframes cr-spin { to { transform: rotate(360deg) } }
.cr-glow { position: absolute; width: 260px; height: 260px; border-radius: 50%; background: radial-gradient(circle, var(--c), transparent 65%);
  opacity: .35; transition: background .08s; }
.cr.burst .cr-glow { animation: cr-glow .6s ease-out both; }
@keyframes cr-glow { 0% { transform: scale(.4); opacity: 1 } 100% { transform: scale(1.6); opacity: .55 } }
.cr-flash { position: absolute; inset: -100vmax; background: var(--c); opacity: 0; }
.cr.burst .cr-flash { animation: cr-flash .45s ease-out; }
@keyframes cr-flash { 0% { opacity: .85 } 100% { opacity: 0 } }
.cr-chest { position: relative; width: 200px; animation: cr-drop .45s cubic-bezier(.3,1.6,.5,1) both; }
@keyframes cr-drop { from { transform: translateY(-260px) scale(.6); opacity: 0 } }
.cr-chest svg { width: 200px; display: block; overflow: visible; filter: drop-shadow(0 10px 0 rgba(10,6,4,.6)); }
.cr-shake.s1 { animation: cr-shake .18s linear infinite; }
.cr-shake.s2 { animation: cr-shake .1s linear infinite; }
.cr-shake.s3 { animation: cr-shake2 .07s linear infinite; }
@keyframes cr-shake { 0%,100% { transform: rotate(0) } 25% { transform: rotate(-3deg) } 75% { transform: rotate(3deg) } }
@keyframes cr-shake2 { 0%,100% { transform: rotate(0) translateY(0) } 25% { transform: rotate(-5deg) translateY(-3px) } 75% { transform: rotate(5deg) translateY(2px) } }
.cr-lid { transform-box: fill-box; transform-origin: 50% 100%; transition: transform .35s cubic-bezier(.2,1.8,.4,1); }
.cr.burst .cr-lid { transform: translate(-18px, -70px) rotate(-28deg); }
.cr-lock { transition: fill .08s; }
.cr-beam { opacity: 0; transition: opacity .2s; }
.cr.burst .cr-beam { opacity: 1; }
.cr-name { position: absolute; top: 330px; font-size: 54px; letter-spacing: .04em; color: var(--c); opacity: 0;
  text-shadow: -4px 0 #1a120c, 4px 0 #1a120c, 0 -4px #1a120c, 0 4px #1a120c, 0 8px 0 #1a120c; }
.cr.burst .cr-name { animation: cr-name .5s cubic-bezier(.2,1.8,.4,1) .08s both; }
@keyframes cr-name { 0% { transform: scale(.2); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
.cr-sparks { position: absolute; inset: 0; }
.cr-spark { position: absolute; left: 50%; top: 50%; width: 12px; height: 12px; margin: -6px; border-radius: 50%;
  background: var(--c); box-shadow: 0 0 10px var(--c); opacity: 0; }
.cr.burst .cr-spark { animation: cr-spark var(--d) cubic-bezier(.1,.7,.3,1) both; }
@keyframes cr-spark { 0% { transform: translate(0,0) scale(1.2); opacity: 1 } 100% { transform: translate(var(--x), var(--y)) scale(.2); opacity: 0 } }
.cr.quake { animation: cr-quake .35s linear; }
@keyframes cr-quake { 0%,100% { transform: translate(0,0) } 20% { transform: translate(-9px,5px) } 40% { transform: translate(8px,-6px) } 60% { transform: translate(-6px,-4px) } 80% { transform: translate(5px,6px) } }
`;

/** Coffre vu de face : corps, ferrures, serrure de la couleur tirée ; couvercle à part (il saute) ; faisceau dedans. */
const CHEST = `<svg viewBox="0 0 120 110">
<path class="cr-beam" d="M28 52L6 -60h108L92 52z" style="fill: var(--c)" opacity=".5"/>
<ellipse class="cr-beam" cx="60" cy="54" rx="34" ry="7" fill="#fff8"/>
<path d="M12 52h96v48H12z" fill="#8a5230" stroke="#1a120c" stroke-width="4" stroke-linejoin="round"/>
<path d="M30 52v48M90 52v48" stroke="#6a6e75" stroke-width="9"/>
<path d="M12 64h96" stroke="#5e3820" stroke-width="3"/>
<g class="cr-lid"><path d="M10 52c0-20 22-32 50-32s50 12 50 32z" fill="#9a5f36" stroke="#1a120c" stroke-width="4" stroke-linejoin="round"/>
<path d="M30 25v27M90 25v27" stroke="#6a6e75" stroke-width="9"/><path d="M20 40c6-9 18-13 28-14" stroke="#fff6" stroke-width="4" fill="none" stroke-linecap="round"/></g>
<rect class="cr-lock" x="50" y="44" width="20" height="22" rx="3" style="fill: var(--c)" stroke="#1a120c" stroke-width="3.5"/>
<circle cx="60" cy="53" r="3" fill="#1a120c"/><path d="M60 55v6" stroke="#1a120c" stroke-width="3"/>
</svg>`;

/**
 * Ouverture d'un coffre façon lootbox, par-dessus le jeu figé : le coffre tombe, tremble de plus en
 * plus fort pendant qu'une roulette de couleurs (les raretés) tourne puis ralentit ; elle s'arrête sur
 * la vraie rareté, le couvercle saute dans un éclair de sa couleur, gerbe d'étincelles et nom de la
 * rareté. Plus elle est haute, plus le suspense dure et plus ça explose. L'écran de choix suit.
 */
export function createChestReveal() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'cr';
  el.innerHTML = `<div class="cr-dim"></div><div class="cr-flash"></div><div class="cr-stage"><div class="cr-rays"></div><div class="cr-glow"></div>
    <div class="cr-chest"><div class="cr-shake">${CHEST}</div></div><div class="cr-sparks"></div><div class="cr-name"></div></div>`;
  document.body.appendChild(el);
  const chest = el.querySelector<HTMLElement>('.cr-shake')!;
  const name = el.querySelector<HTMLElement>('.cr-name')!;
  const sparks = el.querySelector<HTMLElement>('.cr-sparks')!;
  let timers: number[] = [];
  const later = (s: number, f: () => void) => timers.push(window.setTimeout(f, s * 1000));
  const color = (r: number) => el.style.setProperty('--c', RARITIES[r].color);

  function stop() {
    for (const t of timers) clearTimeout(t);
    timers = [];
    el.className = 'cr';
    chest.className = 'cr-shake';
  }

  return {
    /** Joue l'ouverture (cadence `schedule`, la même que les sons). */
    play(rarity: number, schedule: ReturnType<typeof revealSchedule>) {
      stop();
      el.className = 'cr on';
      void el.offsetWidth;
      color(schedule.ticks[0]?.rarity ?? rarity);
      name.textContent = `${RARITIES[rarity].name} !`;
      // Étincelles : plus nombreuses et plus loin quand la rareté monte
      const n = O.sparks + O.sparksPerRarity * rarity;
      sparks.innerHTML = Array.from({ length: n }, () => {
        const a = Math.random() * Math.PI * 2, d = (120 + Math.random() * 160) * (1 + rarity * 0.2);
        return `<i class="cr-spark" style="--x:${(Math.cos(a) * d).toFixed(0)}px;--y:${(Math.sin(a) * d).toFixed(0)}px;--d:${(0.6 + Math.random() * 0.5).toFixed(2)}s"></i>`;
      }).join('');
      const { ticks, burst, end } = schedule;
      ticks.forEach((k, i) => later(k.t, () => {
        color(k.rarity);
        // Le coffre tremble de plus en plus à l'approche de l'ouverture
        const p = i / ticks.length;
        chest.className = `cr-shake ${p < 0.35 ? 's1' : p < 0.75 ? 's2' : 's3'}`;
      }));
      later(burst, () => {
        color(rarity);
        chest.className = 'cr-shake';
        el.classList.add('burst');
        if (rarity >= O.bigFrom) el.classList.add('big', 'quake');
      });
      later(end - O.fadeOut, () => el.classList.add('out'));
      later(end, stop);
    },
    stop,
  };
}
