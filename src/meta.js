const KEY = 'megabeer_save_v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* corrupted save, start fresh */ }
  return { tunas: 0, purchased: [] };
}

export const meta = load();

export function save() {
  localStorage.setItem(KEY, JSON.stringify(meta));
}

export function addTunas(n) {
  meta.tunas += Math.floor(n);
  save();
}

export function isPurchased(id) {
  return meta.purchased.includes(id);
}

export function buyWeapon(id, cost) {
  if (meta.tunas < cost || isPurchased(id)) return false;
  meta.tunas -= cost;
  meta.purchased.push(id);
  save();
  return true;
}
