import { VEHICLE_HUD as H } from '../config/hud';

const CSS = `
.vhd { position: fixed; left: 50%; transform: translateX(-50%) translateY(20px); z-index: 10; pointer-events: none; user-select: none;
  font-family: 'Lilita One', system-ui, sans-serif; text-align: center; opacity: 0; transition: opacity .3s, transform .4s cubic-bezier(.2,1.6,.4,1); }
.vhd.on { opacity: 1; transform: translateX(-50%) translateY(0); }
.vhd-name { color: #fff4dc; font-size: 20px; text-shadow: 0 2px 0 #1a120c, 0 0 8px rgba(0,0,0,.6); margin-bottom: 4px; }
.vhd-name span { color: #ffc93a; margin-left: 8px; }
.vhd-track { position: relative; height: 14px; border-radius: 8px; background: rgba(26,18,12,.85); border: 3px solid #1a120c; overflow: hidden; }
.vhd-hp { position: absolute; inset: 0; background: linear-gradient(#8fe07a, #3fae3a 55%, #1f6e22); transform-origin: left; }
.vhd.low .vhd-hp { background: linear-gradient(#ff8a5a, #d23b2a 55%, #8a1c14); }
.vhd-time { margin-top: 4px; height: 6px; border-radius: 4px; background: rgba(26,18,12,.7); overflow: hidden; }
.vhd-time div { height: 100%; background: #ffc93a; transform-origin: left; }
.vhd.hit .vhd-track { animation: vhd-shake .2s linear; }
@keyframes vhd-shake { 25% { margin-left: -4px } 75% { margin-left: 4px } }
`;

/** Jauges du véhicule conduit, en bas de l'écran : son nom, ses PV, le temps qui reste (barre et secondes). */
export function createVehicleHud() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'vhd';
  el.style.bottom = `${H.bottom}px`;
  el.style.width = `${H.width}px`;
  el.innerHTML = `<div class="vhd-name"></div><div class="vhd-track"><div class="vhd-hp"></div></div><div class="vhd-time"><div></div></div>`;
  document.body.appendChild(el);
  const name = el.querySelector<HTMLElement>('.vhd-name')!;
  const hp = el.querySelector<HTMLElement>('.vhd-hp')!;
  const time = el.querySelector<HTMLElement>('.vhd-time div')!;
  let title = '', lastHp = -1, lastSec = -1;
  return {
    show(vehicleName: string) { title = vehicleName; lastHp = -1; lastSec = -1; el.classList.add('on'); },
    /** Chaque image : part des PV, part du temps qui reste, secondes restantes. */
    update(hpRatio: number, timeRatio: number, secondsLeft: number) {
      const sec = Math.ceil(secondsLeft);
      if (sec !== lastSec) { lastSec = sec; name.innerHTML = `${title}<span>${sec} s</span>`; }
      if (hpRatio !== lastHp) {
        if (lastHp >= 0 && hpRatio < lastHp) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
        lastHp = hpRatio;
        hp.style.transform = `scaleX(${Math.max(0, hpRatio)})`;
        el.classList.toggle('low', hpRatio < 0.3);
      }
      time.style.transform = `scaleX(${Math.max(0, timeRatio)})`;
    },
    hide() { el.classList.remove('on'); },
  };
}
