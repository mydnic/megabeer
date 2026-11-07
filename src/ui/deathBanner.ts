import { DEATH_BANNER as D } from '../config/player';

const CSS = `
.death-band { position: fixed; left: 0; right: 0; top: 50%; transform: translateY(-50%); height: 190px; pointer-events: none;
  display: flex; align-items: center; justify-content: center; z-index: 20; opacity: 0;
  background: linear-gradient(rgba(8,4,2,0) 0%, rgba(8,4,2,.82) 22%, rgba(8,4,2,.82) 78%, rgba(8,4,2,0) 100%); }
.death-text { font-family: 'Lilita One', system-ui, sans-serif; font-size: clamp(52px, 11vw, 132px); letter-spacing: .08em;
  color: #d6261a; line-height: 1; white-space: nowrap;
  text-shadow: 0 0 28px rgba(214,38,26,.45), 0 4px 0 #3a0a06; }
`;

/**
 * Bandeau de mort, façon « YOU DIED » / « WASTED » : bande sombre en travers de l'écran, gros texte
 * rouge qui apparaît après la chute et se resserre lentement.
 */
export function createDeathBanner() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const band = document.createElement('div');
  band.className = 'death-band';
  band.innerHTML = `<div class="death-text"></div>`;
  document.body.appendChild(band);
  const text = band.querySelector<HTMLElement>('.death-text')!;
  text.textContent = D.text;

  return {
    /** t : temps réel depuis la mort (s), -1 si vivant. */
    update(t: number) {
      if (t < D.delay) { band.style.opacity = '0'; return; }
      const k = Math.min(1, (t - D.delay) / D.fadeIn);
      band.style.opacity = String(k);
      // Le texte arrive un peu plus grand et se resserre lentement
      const s = D.scaleFrom + (1 - D.scaleFrom) * (1 - Math.exp(-(t - D.delay) * D.settle));
      text.style.transform = `scale(${s})`;
    },
  };
}
