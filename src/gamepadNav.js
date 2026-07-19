// Generic D-pad menu navigation. A screen hands over rows of focusable elements
// (buttons/cards); D-pad up/down move between rows, left/right move within the
// current row, confirm (X/A, see input.js) clicks the focused element. Decoupled
// from the pad itself — listens for 'gamepadnav' CustomEvents dispatched by
// input.js's updateGamepad(), so this module knows nothing about button indices.
let active = null;

function clampActive() {
  active.r = Math.max(0, Math.min(active.rows.length - 1, active.r));
  active.c = Math.max(0, Math.min(active.rows[active.r].length - 1, active.c));
}

function refresh() {
  if (!active) return;
  active.rows.flat().forEach(el => el.classList.remove('gpFocus'));
  clampActive();
  active.rows[active.r][active.c]?.classList.add('gpFocus');
}

// rows: array of arrays of HTMLElements. Empty rows are dropped automatically.
export function setGamepadNavRows(rows) {
  const filtered = rows.filter(r => r.length > 0);
  active = filtered.length ? { rows: filtered, r: 0, c: 0 } : null;
  refresh();
}

export function clearGamepadNav() {
  if (active) active.rows.flat().forEach(el => el.classList.remove('gpFocus'));
  active = null;
}

addEventListener('gamepadnav', (e) => {
  if (!active) return;
  const { dir } = e.detail;
  if (dir === 'up') active.r--;
  else if (dir === 'down') active.r++;
  else if (dir === 'left') active.c--;
  else if (dir === 'right') active.c++;
  else if (dir === 'confirm') { active.rows[active.r]?.[active.c]?.click(); return; }
  refresh();
});
