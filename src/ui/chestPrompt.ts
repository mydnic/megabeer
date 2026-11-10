import { CHEST_PROMPT as P } from '../config/chests';
import { CHEST_HUD as H } from '../config/hud';

const CSS = `
.chp { position: fixed; left: 50%; bottom: ${H.bottom}px; transform: translateX(-50%) scale(.7); opacity: 0; z-index: 11;
  pointer-events: none; user-select: none; display: flex; align-items: center; gap: 10px; padding: 6px 14px 7px 8px;
  border-radius: 16px; background: rgba(26,18,12,.7); font-family: 'Lilita One', system-ui, sans-serif; color: #fff4dc;
  font-size: 20px; transition: opacity .15s, transform .2s cubic-bezier(.2,1.6,.4,1); }
.chp.on { opacity: 1; transform: translateX(-50%) scale(1); }
.chp-key { min-width: 30px; height: 30px; padding: 0 6px; display: grid; place-items: center; border-radius: 8px;
  background: #fff4dc; color: #1a120c; font-size: 17px; box-shadow: 0 3px 0 #1a120c; }
.chp-price { display: flex; align-items: center; gap: 4px; color: #ff6a5a; }
.chp-price.poor { color: #8a7a70; text-decoration: line-through; }
.chp.shake { animation: chp-shake ${H.shake}s linear; }
@keyframes chp-shake { 0%,100% { margin-left: 0 } 20% { margin-left: -10px } 40% { margin-left: 9px } 60% { margin-left: -6px } 80% { margin-left: 4px } }
`;

/**
 * Rappel près d'un coffre fermé : « [E / X] Ouvrir le coffre » et son prix en capsules (barré et gris
 * s'il en manque). Tremble quand on appuie sans pouvoir payer.
 */
export function createChestPrompt(capsule: string) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'chp';
  el.innerHTML = `<div class="chp-key">${P.key} / ${P.pad}</div><div>${P.open}</div><div class="chp-price">${capsule}<span></span></div>`;
  document.body.appendChild(el);
  const price = el.querySelector<HTMLElement>('.chp-price')!;
  const priceText = price.querySelector('span')!;

  return {
    /** Chaque image : le prix si un coffre est à portée (null sinon), et les capsules en poche. */
    update(cost: number | null, coins: number) {
      el.classList.toggle('on', cost !== null);
      if (cost === null) return;
      priceText.textContent = cost === 0 ? 'Gratuit' : String(cost);
      price.classList.toggle('poor', coins < cost);
    },
    /** Il manque des capsules : le rappel tremble. */
    deny() { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); },
  };
}
