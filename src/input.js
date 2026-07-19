import { canvas } from './scene.js';

export const keys = {};
addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

export const mouse = { yaw: 0, pitch: 0.95 };
const SENSITIVITY = 0.0028;
const PITCH_MIN = 0.35, PITCH_MAX = 1.45;

canvas.addEventListener('click', () => canvas.requestPointerLock());
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas) return;
  mouse.yaw -= e.movementX * SENSITIVITY;
  mouse.pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, mouse.pitch - e.movementY * SENSITIVITY));
});
