import { canvas } from './scene.js';

export const keys = {};
addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
// If the window loses focus while a key is physically held, no keyup ever fires —
// the key stays stuck "pressed" (e.g. alt-tabbing away mid-strafe locks movement
// on until the key is pressed again). Clear everything on blur.
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

export const mouse = { yaw: 0, pitch: 0.95 };
const SENSITIVITY = 0.0028;
const PITCH_MIN = 0.35, PITCH_MAX = 1.45;

canvas.addEventListener('click', () => canvas.requestPointerLock());
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas) return;
  mouse.yaw -= e.movementX * SENSITIVITY;
  mouse.pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, mouse.pitch - e.movementY * SENSITIVITY));
});

// Gamepad: standard mapping (Chrome maps DualSense/Xbox pads to this automatically
// over USB or Bluetooth, no library needed). Left stick = movement, right stick =
// camera look, button 0 (Cross/A) = jump in-game / confirm in menus, D-pad = menu
// navigation (dispatched as 'gamepadnav' CustomEvents, consumed by gamepadNav.js —
// this module knows nothing about menu DOM, stays input-only).
// Polled once per rendered frame from main.js's loop() — unconditionally, so menu
// navigation works before a run even starts — since the Gamepad API has no
// stick-movement events; cached Gamepad objects go stale, must re-fetch each frame.
export const gamepadMove = { x: 0, z: 0 };
export const gamepadJump = { pressed: false };
// Square/X (Xbox) — generic "interact" (enter vehicle, open a fût, etc). Exposed
// for future use; nothing consumes it yet since neither the vehicle (issue #8)
// nor fût loot (issue #3) systems exist in-game.
export const gamepadInteract = { pressed: false };
const STICK_DEADZONE = 0.15;
const STICK_LOOK_SPEED = 2.4;
const DPAD_UP = 12, DPAD_DOWN = 13, DPAD_LEFT = 14, DPAD_RIGHT = 15, BTN_CONFIRM = 0, BTN_INTERACT = 2;

function deadzone(v) {
  return Math.abs(v) < STICK_DEADZONE ? 0 : v;
}

const prevPressed = {};
function pressedEdge(gp, idx) {
  const now = !!gp.buttons[idx]?.pressed;
  const was = prevPressed[idx] || false;
  prevPressed[idx] = now;
  return now && !was;
}

function navEvent(dir) {
  window.dispatchEvent(new CustomEvent('gamepadnav', { detail: { dir } }));
}

export function updateGamepad(dt) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  // Gamepad index isn't always 0 — depends on OS connection slot, not plug order.
  const gp = [...pads].find(p => p && p.connected);
  if (!gp) {
    gamepadMove.x = 0;
    gamepadMove.z = 0;
    gamepadJump.pressed = false;
    return;
  }

  gamepadMove.x = deadzone(gp.axes[0] ?? 0);
  gamepadMove.z = deadzone(gp.axes[1] ?? 0);
  gamepadJump.pressed = !!gp.buttons[BTN_CONFIRM]?.pressed;
  gamepadInteract.pressed = !!gp.buttons[BTN_INTERACT]?.pressed;

  const lookX = deadzone(gp.axes[2] ?? 0);
  const lookY = deadzone(gp.axes[3] ?? 0);
  mouse.yaw -= lookX * STICK_LOOK_SPEED * dt;
  mouse.pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, mouse.pitch + lookY * STICK_LOOK_SPEED * dt));

  if (pressedEdge(gp, DPAD_UP)) navEvent('up');
  if (pressedEdge(gp, DPAD_DOWN)) navEvent('down');
  if (pressedEdge(gp, DPAD_LEFT)) navEvent('left');
  if (pressedEdge(gp, DPAD_RIGHT)) navEvent('right');
  if (pressedEdge(gp, BTN_CONFIRM)) navEvent('confirm');
}
