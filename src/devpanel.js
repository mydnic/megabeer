import { state } from './state.js';
import { ENEMY_TYPES } from './config/enemies.js';
import { spawnEnemyById } from './enemies.js';

export function initDevPanel() {
  const btn = document.createElement('button');
  btn.textContent = '🛠';
  btn.title = 'Dev panel';
  btn.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:9999;width:38px;height:38px;border-radius:50%;background:#222;color:#fff;border:2px solid #4cf;cursor:pointer;font-size:18px;opacity:.85';

  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;top:0;right:-260px;width:240px;height:100%;background:rgba(18,18,18,0.94);border-left:2px solid #4cf;z-index:9998;padding:16px;color:#eee;font-family:sans-serif;transition:right .2s ease;overflow-y:auto;box-sizing:border-box';

  const enemyOptions = ENEMY_TYPES.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  panel.innerHTML = `
    <h3 style="margin:0 0 12px 0;color:#4cf;font-size:15px">Dev Panel</h3>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;margin-bottom:14px">
      <input type="checkbox" id="devGodmode"> Godmode
    </label>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;margin-bottom:14px">
      <input type="checkbox" id="devFreeze"> Freeze time
    </label>
    <div style="font-size:13px;margin-bottom:6px;color:#aaa">Spawn enemy</div>
    <select id="devEnemySelect" style="width:100%;margin-bottom:6px;background:#222;color:#eee;border:1px solid #444;padding:4px">
      ${enemyOptions}
    </select>
    <button id="devSpawnBtn" style="width:100%;padding:6px;background:#2a2a2a;color:#4cf;border:1px solid #4cf;cursor:pointer;border-radius:4px">Spawn near player</button>
  `;

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  let open = false;
  btn.onclick = () => {
    open = !open;
    panel.style.right = open ? '0' : '-260px';
  };

  panel.querySelector('#devGodmode').onchange = (e) => {
    state.godmode = e.target.checked;
  };
  panel.querySelector('#devFreeze').onchange = (e) => {
    state.paused = e.target.checked;
  };
  panel.querySelector('#devSpawnBtn').onclick = () => {
    const id = panel.querySelector('#devEnemySelect').value;
    spawnEnemyById(id);
  };
}
