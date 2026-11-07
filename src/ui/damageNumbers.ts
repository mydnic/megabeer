import * as THREE from 'three';
import { DAMAGE_NUMBERS as D } from '../config/fx';

const CSS = `
.dmg { position: fixed; left: 0; top: 0; pointer-events: none; z-index: 8; font-family: 'Lilita One', system-ui, sans-serif;
  font-size: ${D.size}px; color: ${D.color}; white-space: nowrap; will-change: transform, opacity;
  text-shadow: -2px 0 #1a120c, 2px 0 #1a120c, 0 -2px #1a120c, 0 2px #1a120c, 2px 2px #1a120c, -2px 2px #1a120c; }
.dmg.crit { color: ${D.critColor}; font-size: ${Math.round(D.size * D.critScale)}px; z-index: 9;
  text-shadow: -3px 0 #1a120c, 3px 0 #1a120c, 0 -3px #1a120c, 0 3px #1a120c, 3px 3px #1a120c, -3px 3px #1a120c; }
`;

/** Chiffres de dégâts qui jaillissent au-dessus des zombies touchés, montent et s'effacent. */
export function createDamageNumbers(camera: THREE.Camera) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  type Num = { el: HTMLDivElement; pos: THREE.Vector3; up: THREE.Vector3; t: number; dx: number; active: boolean };
  const pool: Num[] = [];
  const p = new THREE.Vector3();

  return {
    spawn(pos: THREE.Vector3, value: number, crit = false) {
      if (!D.enabled) return;
      let n = pool.find((x) => !x.active);
      if (!n) {
        if (pool.length >= D.max) n = pool.reduce((a, b) => (a.t > b.t ? a : b));
        else {
          const el = document.createElement('div');
          el.className = 'dmg';
          document.body.appendChild(el);
          n = { el, pos: new THREE.Vector3(), up: new THREE.Vector3(), t: 0, dx: 0, active: false };
          pool.push(n);
        }
      }
      n.el.textContent = String(Math.round(value)) + (crit ? D.critSuffix : '');
      n.el.classList.toggle('crit', crit);
      n.pos.copy(pos);
      n.up.copy(pos).normalize();
      n.t = 0;
      n.dx = (Math.random() * 2 - 1) * D.jitter;
      n.active = true;
      n.el.style.display = '';
    },
    update(dt: number) {
      const w = innerWidth, h = innerHeight;
      for (const n of pool) {
        if (!n.active) continue;
        n.t += dt;
        const k = n.t / D.life;
        if (k >= 1) { n.active = false; n.el.style.display = 'none'; continue; }
        p.copy(n.pos).addScaledVector(n.up, D.rise * (1 - (1 - k) * (1 - k))).project(camera);
        if (p.z > 1) { n.el.style.display = 'none'; continue; }
        n.el.style.display = '';
        // Apparition en « pop », puis fondu sur la fin
        const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.7 : 1.3 - Math.min(0.3, (k - 0.15) * 1.2);
        const x = (p.x * 0.5 + 0.5) * w + n.dx, y = (-p.y * 0.5 + 0.5) * h;
        n.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${pop.toFixed(3)})`;
        n.el.style.opacity = String(k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1);
      }
    },
    clear() { for (const n of pool) { n.active = false; n.el.style.display = 'none'; } },
  };
}
