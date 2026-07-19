import { state } from './state.js';

export function initDevPanel() {
  const btn = document.createElement('button');
  btn.textContent = '🛠';
  btn.title = 'Dev panel';
  btn.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:9999;width:38px;height:38px;border-radius:50%;background:#222;color:#fff;border:2px solid #4cf;cursor:pointer;font-size:18px;opacity:.85';

  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;top:0;right:-260px;width:240px;height:100%;background:rgba(18,18,18,0.94);border-left:2px solid #4cf;z-index:9998;padding:16px;color:#eee;font-family:sans-serif;transition:right .2s ease;overflow-y:auto;box-sizing:border-box';
  panel.innerHTML = `
    <h3 style="margin:0 0 12px 0;color:#4cf;font-size:15px">Dev Panel</h3>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
      <input type="checkbox" id="devGodmode"> Godmode
    </label>
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
}
