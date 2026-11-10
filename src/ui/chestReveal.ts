import { CHEST_OPENING as O } from '../config/hud';
import { RARITIES } from '../config/upgrades';
import { chestSvg } from './icons';

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
/* Ouverture : le coffre s'écrase puis bondit, deux ondes de choc partent, le halo du dedans gonfle */
.cr.burst .cr-chest { animation: cr-jump .55s cubic-bezier(.3,1.5,.5,1) both; }
@keyframes cr-jump { 0% { transform: scale(1.18,.78) translateY(14px) } 35% { transform: scale(.92,1.14) translateY(-34px) } 70% { transform: scale(1.05,.96) translateY(0) } 100% { transform: none } }
.cr-ring { position: absolute; width: 160px; height: 160px; border-radius: 50%; border: 10px solid var(--c); opacity: 0; box-shadow: 0 0 30px var(--c), inset 0 0 30px var(--c); }
.cr.burst .cr-ring { animation: cr-ring .7s cubic-bezier(.1,.7,.3,1) both; }
.cr.burst .cr-ring.r2 { animation-delay: .12s; animation-duration: .9s; }
@keyframes cr-ring { 0% { transform: scale(.3); opacity: 1; border-width: 14px } 100% { transform: scale(4.2); opacity: 0; border-width: 1px } }
.cr .ch-beam.ch-ray { opacity: 0; transform: scaleY(.2); transition: opacity .25s, transform .5s cubic-bezier(.2,1.6,.4,1); }
.cr.burst .ch-beam.ch-ray { opacity: 1; transform: scaleY(1); animation: cr-raypulse 1.2s ease-in-out .5s infinite alternate; }
@keyframes cr-raypulse { to { transform: scaleY(1.08) scaleX(1.05); } }
.cr-shake.s1 { animation: cr-shake .18s linear infinite; }
.cr-shake.s2 { animation: cr-shake .1s linear infinite; }
.cr-shake.s3 { animation: cr-shake2 .07s linear infinite; }
@keyframes cr-shake { 0%,100% { transform: rotate(0) } 25% { transform: rotate(-3deg) } 75% { transform: rotate(3deg) } }
@keyframes cr-shake2 { 0%,100% { transform: rotate(0) translateY(0) } 25% { transform: rotate(-5deg) translateY(-3px) } 75% { transform: rotate(5deg) translateY(2px) } }
.cr .ch-lid { transition: transform .3s cubic-bezier(.2,1.8,.4,1), opacity .22s ease-in .06s; }
.cr.burst .ch-lid { transform: translate(-10px, -60px) rotate(-14deg); opacity: 0; }
.cr .ch-open { transform: scaleY(0); transition: transform .38s cubic-bezier(.2,1.8,.4,1) .05s; }
.cr.burst .ch-open { opacity: 1; transform: scaleY(1); }
.cr .ch-beam { transition: opacity .2s; }
.cr.burst .ch-beam { opacity: 1; }
.cr-name { position: absolute; top: 330px; font-size: 54px; letter-spacing: .04em; color: var(--c); opacity: 0;
  text-shadow: -4px 0 #1a120c, 4px 0 #1a120c, 0 -4px #1a120c, 0 4px #1a120c, 0 8px 0 #1a120c; }
.cr.burst .cr-name { animation: cr-name .5s cubic-bezier(.2,1.8,.4,1) .08s both, cr-name-idle .9s ease-in-out .6s infinite alternate; }
@keyframes cr-name-idle { to { transform: scale(1.07) rotate(-1.5deg); } }
@keyframes cr-name { 0% { transform: scale(.2); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
.cr-sparks { position: absolute; inset: 0; }
.cr-spark { position: absolute; left: 50%; top: 50%; width: var(--s, 12px); height: var(--s, 12px); margin: calc(var(--s, 12px) / -2); border-radius: 50%;
  background: radial-gradient(circle, #fff 0 25%, var(--c) 60%); box-shadow: 0 0 12px var(--c); opacity: 0; }
.cr-spark.star { border-radius: 0; box-shadow: none; background: linear-gradient(#fff, var(--c)); filter: drop-shadow(0 0 6px var(--c));
  clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%); }
.cr.burst .cr-spark { animation: cr-spark var(--d) cubic-bezier(.1,.7,.3,1) both; }
@keyframes cr-spark { 0% { transform: translate(0,0) scale(1.4) rotate(0); opacity: 1 } 60% { opacity: 1 }
  100% { transform: translate(var(--x), calc(var(--y) + 60px)) scale(.15) rotate(var(--r)); opacity: 0 } }
.cr.quake { animation: cr-quake .35s linear; }
@keyframes cr-quake { 0%,100% { transform: translate(0,0) } 20% { transform: translate(-9px,5px) } 40% { transform: translate(8px,-6px) } 60% { transform: translate(-6px,-4px) } 80% { transform: translate(5px,6px) } }
`;

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
  el.innerHTML = `<div class="cr-dim"></div><div class="cr-flash"></div><div class="cr-stage"><div class="cr-rays"></div><div class="cr-glow"></div><div class="cr-ring"></div><div class="cr-ring r2"></div>
    <div class="cr-chest"><div class="cr-shake">${chestSvg('')}</div></div><div class="cr-sparks"></div><div class="cr-name"></div></div>`;
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
        const star = Math.random() < 0.45, size = star ? 16 + Math.random() * 16 : 7 + Math.random() * 9;
        return `<i class="cr-spark${star ? ' star' : ''}" style="--x:${(Math.cos(a) * d).toFixed(0)}px;--y:${(Math.sin(a) * d).toFixed(0)}px;--d:${(0.7 + Math.random() * 0.6).toFixed(2)}s;--s:${size.toFixed(0)}px;--r:${(Math.random() * 540 - 270).toFixed(0)}deg"></i>`;
      }).join('');
      const { ticks, burst } = schedule;
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
    },
    /** Le jeu a fini la révélation (l'écran de choix s'ouvre) : fondu de sortie. Suivre le noyau plutôt
     * qu'une minuterie évite un trou sans rien à l'écran si les images ralentissent. */
    finish() {
      if (!el.classList.contains('on')) return;
      el.classList.add('out');
      later(O.fadeOut, stop);
    },
    stop,
  };
}
