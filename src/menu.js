import { meta, isPurchased, buyWeapon } from './meta.js';
import { WEAPON_DEFS } from './weapons.js';

const SHOP_ITEMS = [
  { id: 'keg', cost: 50, desc: 'Un fût qui roule et écrase tout' },
  { id: 'puddle', cost: 80, desc: 'Flaque AOE, dégâts sur la durée' },
  { id: 'coaster', cost: 120, desc: 'Shuriken tranchant, transperce' },
];

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
  for (const item of SHOP_ITEMS) {
    const def = WEAPON_DEFS[item.id];
    const owned = isPurchased(item.id);
    const div = document.createElement('div');
    div.className = 'shopCard';
    div.innerHTML = `<h3>${def.label}</h3><p>${item.desc}</p><div class="cost">${owned ? 'Débloqué' : item.cost + ' TUNAS'}</div>`;
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = owned ? 'Possédé' : 'Débloquer';
    btn.disabled = owned || meta.tunas < item.cost;
    btn.onclick = () => {
      if (buyWeapon(item.id, item.cost)) { refreshTunas(); renderShop(); }
    };
    div.appendChild(btn);
    shopList.appendChild(div);
  }
}

export function initMenu(onPlay) {
  refreshTunas();
  btnPlay.onclick = () => { menuEl.style.display = 'none'; onPlay(); };
  btnShop.onclick = () => {
    renderShop();
    refreshTunas();
    menuEl.style.display = 'none';
    shopEl.style.display = 'flex';
  };
  btnShopBack.onclick = () => {
    shopEl.style.display = 'none';
    menuEl.style.display = 'flex';
    refreshTunas();
  };
}

export function showMenu() {
  refreshTunas();
  menuEl.style.display = 'flex';
}
