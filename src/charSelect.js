import { CHARACTERS, CHARACTER_ORDER, DEFAULT_CHARACTER_ID } from './config/characters.js';
import { MAPS, DEFAULT_MAP_ID } from './config/maps.js';
import { WEAPON_TYPES } from './config/weapons.js';
import { showMenu } from './menu.js';

const selectEl = document.getElementById('select');
const charRow = document.getElementById('charRow');
const mapRow = document.getElementById('mapRow');
const btnStart = document.getElementById('btnStart');
const btnSelectBack = document.getElementById('btnSelectBack');

let selectedCharacterId = DEFAULT_CHARACTER_ID;
let selectedMapId = DEFAULT_MAP_ID;

function renderChars() {
  charRow.innerHTML = '';
  for (const id of CHARACTER_ORDER) {
    const c = CHARACTERS[id];
    const weaponLabel = WEAPON_TYPES[c.startWeapon]?.label ?? c.startWeapon;
    const div = document.createElement('div');
    div.className = 'pickCard' + (id === selectedCharacterId ? ' selected' : '');
    div.innerHTML = `
      <div class="swatch" style="background:#${c.color.toString(16).padStart(6, '0')}"></div>
      <h3>${c.name}</h3>
      <p>${c.desc}</p>
      <div class="weapon">🍺 ${weaponLabel}</div>
    `;
    div.onclick = () => { selectedCharacterId = id; renderChars(); };
    charRow.appendChild(div);
  }
}

function renderMaps() {
  mapRow.innerHTML = '';
  for (const m of MAPS) {
    const div = document.createElement('div');
    div.className = 'pickCard'
      + (m.id === selectedMapId ? ' selected' : '')
      + (m.locked ? ' locked' : '');
    div.innerHTML = `<h3>${m.name}</h3><p>${m.desc}</p>`;
    if (!m.locked) div.onclick = () => { selectedMapId = m.id; renderMaps(); };
    mapRow.appendChild(div);
  }
}

export function initCharSelect(onStart) {
  renderChars();
  renderMaps();
  btnStart.onclick = () => {
    selectEl.style.display = 'none';
    onStart(selectedCharacterId, selectedMapId);
  };
  btnSelectBack.onclick = () => {
    selectEl.style.display = 'none';
    showMenu();
  };
}

export function showSelect() {
  renderChars();
  renderMaps();
  selectEl.style.display = 'flex';
}
