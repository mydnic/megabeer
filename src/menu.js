import { meta, isPurchased, buyWeapon } from './meta.js';
import { WEAPON_TYPES } from './config/weapons.js';
import { setGamepadNavRows } from './gamepadNav.js';

const SHOP_ITEMS = Object.values(WEAPON_TYPES).filter(cfg => cfg.shop);

const menuEl = document.getElementById('menu');
const shopEl = document.getElementById('shop');
const menuTunas = document.getElementById('menuTunas');
const shopTunas = document.getElementById('shopTunas');
const shopList = document.getElementById('shopList');
const btnPlay = document.getElementById('btnPlay');
const btnShop = document.getElementById('btnShop');
const btnShopBack = document.getElementById('btnShopBack');

function refreshTunas() {
  menuTunas.textContent = meta.tunas;
  shopTunas.textContent = meta.tunas;
}

function renderShop() {
  shopList.innerHTML = '';
  for (const cfg of SHOP_ITEMS) {
    const owned = isPurchased(cfg.id);
    const div = document.createElement('div');
    div.className = 'shopCard';
    div.innerHTML = `<h3>${cfg.label}</h3><p>${cfg.shop.desc}</p><div class="cost">${owned ? 'Débloqué' : cfg.shop.cost + ' TUNAS'}</div>`;
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = owned ? 'Possédé' : 'Débloquer';
    btn.disabled = owned || meta.tunas < cfg.shop.cost;
    btn.onclick = () => {
      if (buyWeapon(cfg.id, cfg.shop.cost)) { refreshTunas(); renderShop(); setGamepadNavRows(shopNavRows()); }
    };
    div.appendChild(btn);
    shopList.appendChild(div);
  }
}

function shopNavRows() {
  return [[...shopList.querySelectorAll('button')], [btnShopBack]];
}

export function initMenu(onPlay) {
  refreshTunas();
  setGamepadNavRows([[btnPlay], [btnShop]]);
  btnPlay.onclick = () => { menuEl.style.display = 'none'; onPlay(); };
  btnShop.onclick = () => {
    renderShop();
    refreshTunas();
    menuEl.style.display = 'none';
    shopEl.style.display = 'flex';
    setGamepadNavRows(shopNavRows());
  };
  btnShopBack.onclick = () => {
    shopEl.style.display = 'none';
    menuEl.style.display = 'flex';
    refreshTunas();
    setGamepadNavRows([[btnPlay], [btnShop]]);
  };
}

export function showMenu() {
  refreshTunas();
  menuEl.style.display = 'flex';
  setGamepadNavRows([[btnPlay], [btnShop]]);
}
