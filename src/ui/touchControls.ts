import { TOUCH } from '../config/hud';
import { addTouchLook, touch } from '../core/input';

const CSS = `
.touch { position: fixed; inset: 0; z-index: 4; touch-action: none; user-select: none; -webkit-user-select: none; }
.touch.off { display: none; }
.touch-stick { position: absolute; width: calc(var(--r) * 2); height: calc(var(--r) * 2); margin: calc(var(--r) * -1) 0 0 calc(var(--r) * -1);
  border-radius: 50%; border: 3px solid rgba(26,18,12,.6); background: rgba(243,230,207,.14); pointer-events: none; display: none; }
.touch-stick.on { display: block; }
.touch-knob { position: absolute; left: 50%; top: 50%; width: 46%; height: 46%; translate: -50% -50%; border-radius: 50%;
  border: 3px solid #1a120c; background: radial-gradient(circle at 40% 35%, #ffe39a, #f5a623 70%); box-shadow: 0 3px 0 #1a120c; }
.touch-btn { position: absolute; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 3px solid #1a120c;
  font-family: 'Lilita One', system-ui, sans-serif; color: #2a1608; box-shadow: 0 4px 0 #1a120c; touch-action: none; }
.touch-btn.down { translate: 0 3px; box-shadow: 0 1px 0 #1a120c; filter: brightness(1.15); }
.touch-jump { right: calc(24px + env(safe-area-inset-right)); bottom: 28px; width: 84px; height: 84px; font-size: 17px;
  background: linear-gradient(#ffd45a, #f5a623 60%, #e08a12); }
.touch-act { right: calc(122px + env(safe-area-inset-right)); bottom: 22px; width: 60px; height: 60px; font-size: 14px;
  background: linear-gradient(#bff0a8, #8fe07a 60%, #5fb44a); }
.touch-pause { right: calc(12px + env(safe-area-inset-right)); top: 50%; translate: 0 -50%; width: 44px; height: 44px; font-size: 18px; color: #f3e6cf;
  background: rgba(42,22,8,.8); }
.touch-pause.down { translate: 0 calc(-50% + 3px); }
.touch-rotate { position: fixed; inset: 0; z-index: 200; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
  background: #120a05; color: #ffc93a; font-family: 'Lilita One', system-ui, sans-serif; font-size: 26px; text-align: center; padding: 24px; }
.touch-rotate span { width: 44px; height: 76px; border: 5px solid #ffc93a; border-radius: 10px; animation: touch-turn 1.6s ease-in-out infinite; }
@keyframes touch-turn { 0%, 30% { rotate: 0deg } 60%, 100% { rotate: -90deg } }
@media (orientation: portrait) { .touch-rotate { display: flex; } }
/* Petit écran : l'interface (pensée pour un écran de bureau) est réduite d'un bloc ; ni la 3D ni les commandes tactiles */
html.is-touch body > :not(canvas:not(.mm)):not(.touch):not(.touch-rotate) { zoom: var(--ui-zoom, 1); }
/* La minimap monte en haut à droite : le bas droit est aux pouces (Saut, Action) */
html.is-touch canvas.mm { top: 18px !important; bottom: auto !important; }
`;

/**
 * Commandes tactiles (téléphone en paysage, GDD section 16) : moitié gauche de l'écran, un joystick qui apparaît sous le
 * pouce ; moitié droite, glisser pour tourner la caméra ; boutons Saut, Action (coffres, cloches, porte) et Pause. En
 * portrait, un écran demande de tourner le téléphone. Écrit dans `touch` (core/input.ts), lu comme le clavier.
 */
export function createTouchControls() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'touch off';
  el.innerHTML = `<div class="touch-stick" style="--r:${TOUCH.stickRadius}px"><div class="touch-knob"></div></div>
    <div class="touch-btn touch-act">Action</div><div class="touch-btn touch-jump">Saut</div><div class="touch-btn touch-pause">II</div>`;
  document.body.appendChild(el);
  const rotate = document.createElement('div');
  rotate.className = 'touch-rotate';
  rotate.innerHTML = '<span></span>Tourne ton téléphone<br>pour jouer en paysage';
  document.body.appendChild(rotate);

  const stick = el.querySelector<HTMLElement>('.touch-stick')!;
  const knob = el.querySelector<HTMLElement>('.touch-knob')!;
  let stickId = -1, lookId = -1, sx = 0, sy = 0, lx = 0, ly = 0;

  function reset() {
    stickId = lookId = -1;
    touch.moveX = touch.moveY = 0;
    touch.jump = touch.action = false;
    stick.classList.remove('on');
    for (const b of el.querySelectorAll('.touch-btn')) b.classList.remove('down');
  }

  el.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).classList.contains('touch-btn')) return;
    if (e.clientX < innerWidth / 2 && stickId < 0) {
      stickId = e.pointerId; sx = e.clientX; sy = e.clientY;
      stick.style.left = `${sx}px`; stick.style.top = `${sy}px`;
      knob.style.left = knob.style.top = '50%';
      stick.classList.add('on');
    } else if (lookId < 0) {
      lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
    }
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) {
      const R = TOUCH.stickRadius;
      let dx = e.clientX - sx, dy = e.clientY - sy;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx *= R / len; dy *= R / len; }
      knob.style.left = `${50 + (dx / R) * 50}%`; knob.style.top = `${50 + (dy / R) * 50}%`;
      const m = Math.min(1, len / R);
      const k = m < TOUCH.deadzone ? 0 : (m - TOUCH.deadzone) / (1 - TOUCH.deadzone) / (m || 1);
      touch.moveX = (dx / R) * k;
      touch.moveY = (-dy / R) * k;
    } else if (e.pointerId === lookId) {
      addTouchLook((e.clientX - lx) * TOUCH.lookSensitivity, (e.clientY - ly) * TOUCH.lookSensitivity);
      lx = e.clientX; ly = e.clientY;
    }
  });
  const up = (e: PointerEvent) => {
    if (e.pointerId === stickId) { stickId = -1; touch.moveX = touch.moveY = 0; stick.classList.remove('on'); }
    if (e.pointerId === lookId) lookId = -1;
  };
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);

  const hold = (cls: string, set: (v: boolean) => void) => {
    const b = el.querySelector<HTMLElement>(cls)!;
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      b.classList.add('down');
      set(true);
      try { b.setPointerCapture(e.pointerId); } catch { /* doigt déjà levé */ }
    });
    const release = () => { b.classList.remove('down'); set(false); };
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
  };
  hold('.touch-jump', (v) => { touch.jump = v; });
  hold('.touch-act', (v) => { touch.action = v; });
  hold('.touch-pause', (v) => { if (v) touch.pause = true; });

  // Premier toucher : plein écran et paysage verrouillé, là où le navigateur le permet (pas sur iPhone)
  addEventListener('pointerdown', () => {
    const d = document.documentElement;
    if (document.fullscreenElement || !d.requestFullscreen) return;
    d.requestFullscreen({ navigationUI: 'hide' }).then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
      .catch(() => {});
  }, { once: true });

  // Taille de l'interface : celle d'un écran de bureau, ramenée à la hauteur (ou la largeur) du téléphone
  const fit = () => {
    const z = Math.max(TOUCH.uiZoom.min, Math.min(1, innerHeight / TOUCH.uiZoom.height, innerWidth / TOUCH.uiZoom.width));
    document.documentElement.style.setProperty('--ui-zoom', z.toFixed(3));
  };
  fit();
  addEventListener('resize', fit);

  return {
    /** Visibles pendant la run, hors menus. */
    setVisible(v: boolean) {
      if (el.classList.contains('off') === !v) return;
      el.classList.toggle('off', !v);
      if (!v) reset();
    },
  };
}
