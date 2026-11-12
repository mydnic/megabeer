import { PAD_NAV as N } from '../config/hud';
import type { InputState } from '../core/input';

/**
 * Navigation des menus à la manette (et aux flèches) : haut et bas passent d'un bouton ou d'un curseur à l'autre, gauche
 * et droite règlent le curseur choisi, A clique le bouton choisi, B revient en arrière. Les menus n'ont rien à faire de
 * plus que fournir leur conteneur : l'ordre est celui des éléments dans la page.
 */
export function createPadNav() {
  let held = '', wait = 0;

  /** Direction appuyée à cette image (avec répétition quand on la maintient), ou '' . */
  function direction(dt: number, x: number, y: number) {
    const dir = Math.abs(y) >= Math.abs(x)
      ? (y > N.threshold ? 'up' : y < -N.threshold ? 'down' : '')
      : (x > N.threshold ? 'right' : x < -N.threshold ? 'left' : '');
    if (dir !== held) { held = dir; wait = N.repeatDelay; return dir; }
    if (!dir) return '';
    wait -= dt;
    if (wait > 0) return '';
    wait = N.repeatEvery;
    return dir;
  }

  const focus = (el: HTMLElement) => el.focus({ preventScroll: true, focusVisible: true } as FocusOptions);

  return {
    /**
     * À chaque image où un menu est ouvert : `root` est le menu au premier plan (null : aucun), `back` ce que fait B.
     * Rend vrai si A a été utilisé par le menu.
     */
    update(dt: number, input: InputState, root: HTMLElement | null, back?: () => void) {
      const dir = direction(dt, input.moveX, input.moveY);
      if (!root) return false;
      const items = [...root.querySelectorAll<HTMLElement>('button, input[type=range]')].filter((e) => e.offsetParent !== null);
      if (!items.length) return false;
      const active = document.activeElement as HTMLElement | null;
      const i = active ? items.indexOf(active) : -1;
      if (dir === 'up' || dir === 'down') {
        const step = dir === 'down' ? 1 : -1;
        focus(items[i < 0 ? 0 : (i + step + items.length) % items.length]);
      } else if ((dir === 'left' || dir === 'right') && active instanceof HTMLInputElement && i >= 0) {
        const v = Math.min(Number(active.max), Math.max(Number(active.min), Number(active.value) + (dir === 'right' ? N.sliderStep : -N.sliderStep)));
        if (String(v) !== active.value) {
          active.value = String(v);
          active.dispatchEvent(new Event('input'));
          active.dispatchEvent(new Event('change'));
        }
      }
      if (input.backPressed && back) back();
      if (input.jumpPressed) {
        if (i < 0) { focus(items[0]); return true; }
        if (active instanceof HTMLButtonElement) active.click();
        return true;
      }
      return false;
    },
  };
}
