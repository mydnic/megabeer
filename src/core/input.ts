// Entrées clavier, souris et manette, réunies en un seul état lu par le jeu.
// Les touches utilisent la position physique (event.code) : ZQSD sur AZERTY = WASD sur QWERTY.

export const settings = {
  /** Zone morte des sticks et des gâchettes (GDD section 16, réglable dans les options). */
  stickDeadzone: 0.15,
  triggerDeadzone: 0.1,
};

export type InputState = {
  moveX: number; moveY: number;
  lookX: number; lookY: number; // stick droit, -1 à 1
  mouseDX: number; mouseDY: number; // pixels depuis la dernière lecture
  zoom: number; // crans de molette
  jump: boolean; jumpPressed: boolean;
  /** Touche d'action (E, bouton X de la manette) : ouvrir un coffre. */
  action: boolean; actionPressed: boolean;
};

const keys = new Set<string>();
let mouseDX = 0, mouseDY = 0, wheel = 0, prevJump = false, prevAction = false;
let canvas: HTMLElement | null = null;

export function initInput(el: HTMLElement) {
  canvas = el;
  addEventListener('keydown', (e) => { keys.add(e.code); });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  el.addEventListener('click', () => { el.requestPointerLock?.()?.catch?.(() => {}); });
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas) return;
    mouseDX += e.movementX; mouseDY += e.movementY;
  });
  addEventListener('wheel', (e) => { wheel += Math.sign(e.deltaY); }, { passive: true });
}

export const isKeyDown = (code: string) => keys.has(code);

function deadzone(a: number, dz: number) {
  const m = Math.abs(a);
  return m < dz ? 0 : (Math.sign(a) * (m - dz)) / (1 - dz);
}

export function readInput(): InputState {
  let mx = 0, my = 0, lx = 0, ly = 0, jump = false, action = false;
  if (keys.has('KeyW') || keys.has('ArrowUp')) my += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) my -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
  if (keys.has('Space')) jump = true;
  if (keys.has('KeyE')) action = true;

  // Manette ignorée quand la fenêtre n'a pas le focus (le navigateur la lit quand même en arrière-plan)
  const pads = document.hasFocus() ? navigator.getGamepads?.() ?? [] : [];
  for (const gp of pads) {
    if (!gp || !gp.connected) continue;
    const dz = settings.stickDeadzone;
    mx += deadzone(gp.axes[0] ?? 0, dz);
    my -= deadzone(gp.axes[1] ?? 0, dz);
    if (gp.mapping === 'standard') {
      lx += deadzone(gp.axes[2] ?? 0, dz);
      ly += deadzone(gp.axes[3] ?? 0, dz);
    }
    if (gp.buttons[0]?.pressed) jump = true;
    if (gp.buttons[2]?.pressed) action = true;
    break; // une seule manette (jeu solo)
  }

  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  const state: InputState = {
    moveX: mx, moveY: my, lookX: lx, lookY: ly,
    mouseDX, mouseDY, zoom: wheel,
    jump, jumpPressed: jump && !prevJump,
    action, actionPressed: action && !prevAction,
  };
  prevJump = jump;
  prevAction = action;
  mouseDX = mouseDY = wheel = 0;
  return state;
}
