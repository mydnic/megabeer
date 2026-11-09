import { WEAPON_HUD as W } from '../config/hud';

const CSS = `
.wpn { position: fixed; top: 58px; left: 18px; z-index: 10; display: flex; gap: 8px; pointer-events: none; user-select: none;
  font-family: 'Lilita One', system-ui, sans-serif; }
.wpn-slot { position: relative; width: 48px; height: 48px; border: 3px solid #1a120c; border-radius: 12px;
  background: rgba(58,36,24,.85); box-shadow: 0 3px 0 rgba(26,18,12,.55), inset 0 3px 6px rgba(0,0,0,.4);
  display: flex; align-items: center; justify-content: center; }
.wpn-slot.empty { background: rgba(26,18,12,.35); border-style: dashed; border-color: rgba(26,18,12,.7); box-shadow: none; }
.wpn-icon { height: 36px; width: auto; }
.wpn-lvl { position: absolute; right: -7px; bottom: -7px; min-width: 22px; height: 22px; padding: 0 4px; border-radius: 11px;
  border: 2px solid #1a120c; background: linear-gradient(#ffd45a, #f5a623); color: #2a1608; font-size: 13px; line-height: 18px;
  text-align: center; box-sizing: border-box; }
.wpn-slot.syn { border-color: var(--s); box-shadow: 0 3px 0 rgba(26,18,12,.55), 0 0 10px var(--s), inset 0 3px 6px rgba(0,0,0,.4); }
.wpn-link { position: absolute; left: -8px; top: -8px; width: 20px; height: 20px; border-radius: 50%; border: 2px solid #1a120c;
  background: var(--s); display: flex; align-items: center; justify-content: center; }
.wpn-link svg { width: 13px; height: 13px; }
.wpn-slot.pop { animation: wpn-pop .45s cubic-bezier(.2,1.6,.4,1); }
@keyframes wpn-pop { 0% { transform: scale(1) } 40% { transform: scale(1.3) rotate(-6deg) } 100% { transform: scale(1) } }
`;

/** `synergy` : couleur de la synergie active dont l'arme fait partie (liseré et maillon). */
export type WeaponSlot = { id: string; icon: string; level: number; synergy?: string };

/** Maillon de chaîne : les armes liées par une synergie. */
const LINK = `<svg viewBox="0 0 16 16"><path d="M6.5 9.5l3-3M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1M9 11.5l-1 1a2.8 2.8 0 0 1-4-4l1-1" stroke="#1a120c" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;

/**
 * Emplacements d'armes (sous les PV) : 4 cases (GDD section 6), l'icône de chaque arme équipée
 * avec son niveau, les cases libres en pointillés. L'arme qui monte de niveau fait un petit saut.
 */
export function createWeaponHud() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'wpn';
  document.body.appendChild(el);
  const slots: HTMLDivElement[] = [];
  for (let i = 0; i < W.slots; i++) {
    const s = document.createElement('div');
    s.className = 'wpn-slot empty';
    el.appendChild(s);
    slots.push(s);
  }
  const shown: (string | null)[] = slots.map(() => null);

  return {
    setVisible(v: boolean) { el.style.display = v ? '' : 'none'; },
    update(weapons: WeaponSlot[]) {
      slots.forEach((s, i) => {
        const w = weapons[i];
        const key = w ? `${w.id}:${w.level}:${w.synergy ?? ''}` : '';
        if (key === shown[i]) return;
        const prev = shown[i]?.split(':');
        const levelUp = !!w && prev?.[0] === w.id && w.level > Number(prev[1]);
        shown[i] = key;
        s.classList.toggle('empty', !w);
        s.classList.toggle('syn', !!w?.synergy);
        if (w?.synergy) s.style.setProperty('--s', w.synergy);
        s.innerHTML = w ? `${w.icon}<div class="wpn-lvl">${w.level}</div>${w.synergy ? `<div class="wpn-link">${LINK}</div>` : ''}` : '';
        if (levelUp) {
          s.classList.remove('pop');
          void s.offsetWidth;
          s.classList.add('pop');
        }
      });
    },
  };
}
