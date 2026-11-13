import type { Quality, Settings, ShadowChoice, VolumeChannel } from '../core/settings';

const CSS = `
.opt-veil { position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center;
  background: rgba(10,6,3,.55); font-family: 'Lilita One', system-ui, sans-serif; transition: opacity .2s; }
.opt-veil.off { opacity: 0; pointer-events: none; }
.opt { width: min(460px, calc(100vw - 32px)); padding: 22px 26px 26px; border: 4px solid #1a120c; border-radius: 22px;
  background: linear-gradient(#fff4d6, #f3dfb4); box-shadow: 0 8px 0 #1a120c; color: #2a1608; }
.opt h2 { margin: 0 0 14px; text-align: center; font-weight: normal; font-size: 38px; letter-spacing: .05em; color: #ffc93a;
  text-shadow: -3px 0 #1a120c, 3px 0 #1a120c, 0 -3px #1a120c, 0 3px #1a120c, 3px 3px #1a120c, -3px 3px #1a120c,
    3px -3px #1a120c, -3px -3px #1a120c, 0 6px 0 #1a120c; }
.opt h3 { margin: 6px 0 8px; font-weight: normal; font-size: 18px; letter-spacing: .06em; opacity: .7; }
.opt-row { display: grid; grid-template-columns: 7.5em 1fr 3.2em; align-items: center; gap: 12px; margin: 10px 0; font-size: 20px; }
.opt-row output { text-align: right; font-variant-numeric: tabular-nums; }
.opt input[type=range] { -webkit-appearance: none; appearance: none; width: 100%; height: 14px; margin: 0; cursor: pointer;
  border: 3px solid #1a120c; border-radius: 10px;
  background: linear-gradient(90deg, #f5a623 var(--p), #5a3a1c var(--p)); }
.opt input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%;
  background: #fff4d6; border: 3px solid #1a120c; box-shadow: 0 3px 0 #1a120c; }
.opt input[type=range]::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%;
  background: #fff4d6; border: 3px solid #1a120c; box-shadow: 0 3px 0 #1a120c; }
.opt input[type=range]:focus-visible { outline: 3px solid #f5a623; outline-offset: 3px; }
.opt-seg { display: grid; grid-template-columns: 7.5em 1fr; align-items: center; gap: 12px; margin: 10px 0; font-size: 20px; }
.opt-seg div { display: flex; gap: 6px; flex-wrap: wrap; }
.opt-seg button { font: inherit; font-size: 16px; cursor: pointer; padding: 4px 12px 6px; border: 3px solid #1a120c; border-radius: 12px;
  color: #2a1608; background: #f3dfb4; box-shadow: 0 3px 0 #1a120c; }
.opt-seg button.on { background: linear-gradient(#ffd45a, #f5a623 60%, #e08a12); }
.opt-seg button:focus-visible { outline: 3px solid #f5a623; outline-offset: 2px; }
.opt-hint { min-height: 1.2em; font-size: 14px; opacity: .75; text-align: center; }
.opt-close { display: block; margin: 20px auto 0; font: inherit; font-size: 24px; letter-spacing: .05em; color: #2a1608;
  cursor: pointer; padding: 8px 40px 11px; border: 4px solid #1a120c; border-radius: 18px;
  background: linear-gradient(#ffd45a, #f5a623 60%, #e08a12); box-shadow: 0 5px 0 #1a120c, inset 0 3px 0 rgba(255,255,255,.45); }
.opt-close:hover, .opt-close:focus-visible { transform: scale(1.05); outline: none; }
`;

const ROWS: [VolumeChannel, string][] = [['music', 'Musique'], ['fx', 'Effets'], ['ui', 'Interface']];
const QUALITY: [Quality, string][] = [['auto', 'Auto'], ['leger', 'Légère'], ['complet', 'Complète']];
const SHADOWS: [ShadowChoice, string][] = [['auto', 'Auto'], ['oui', 'Oui'], ['non', 'Non']];

/**
 * Panneau Options : volumes musique, effets et interface ; graphismes (qualité, prise en compte au chargement de la
 * page, et ombres, tout de suite). Chaque changement est appliqué via les rappels et sauvegardé via `onSave`. Échap ou
 * Fermer le referme.
 */
export function createOptionsPanel(settings: Settings, onVolume: (ch: VolumeChannel, v: number) => void, onSave: () => void,
  gfx: { shadows: (c: ShadowChoice) => void; quality: (q: Quality) => void; qualityNow: () => string }) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const veil = document.createElement('div');
  veil.className = 'opt-veil off';
  veil.innerHTML = `<div class="opt" role="dialog" aria-label="Options"><h2>Options</h2><h3>Son</h3>${
    ROWS.map(([ch, label]) => `<label class="opt-row"><span>${label}</span><input type="range" min="0" max="100" step="1" data-ch="${ch}"><output></output></label>`).join('')
  }<h3>Graphismes</h3>
    <div class="opt-seg"><span>Qualité</span><div data-g="quality">${QUALITY.map(([v, l]) => `<button data-v="${v}">${l}</button>`).join('')}</div></div>
    <div class="opt-seg"><span>Ombres</span><div data-g="shadows">${SHADOWS.map(([v, l]) => `<button data-v="${v}">${l}</button>`).join('')}</div></div>
    <div class="opt-hint"></div><button class="opt-close">Fermer</button></div>`;
  document.body.appendChild(veil);

  const sliders = [...veil.querySelectorAll<HTMLInputElement>('input[type=range]')];
  const paint = (s: HTMLInputElement) => {
    s.style.setProperty('--p', `${s.value}%`);
    s.nextElementSibling!.textContent = `${s.value} %`;
  };
  for (const s of sliders) {
    const ch = s.dataset.ch as VolumeChannel;
    s.value = String(Math.round(settings.volume[ch] * 100));
    paint(s);
    s.addEventListener('input', () => {
      paint(s);
      settings.volume[ch] = Number(s.value) / 100;
      onVolume(ch, settings.volume[ch]);
    });
    s.addEventListener('change', onSave);
    // Les touches ne pilotent pas le jeu pendant qu'on règle
    s.addEventListener('keydown', (e) => { if (e.code !== 'Escape') e.stopPropagation(); });
  }

  // Graphismes : boutons à choix unique
  const hint = veil.querySelector<HTMLElement>('.opt-hint')!;
  const paintSeg = () => {
    for (const g of veil.querySelectorAll<HTMLElement>('[data-g]')) {
      const cur = g.dataset.g === 'quality' ? settings.quality : settings.shadows;
      for (const b of g.querySelectorAll<HTMLElement>('button')) b.classList.toggle('on', b.dataset.v === cur);
    }
  };
  for (const b of veil.querySelectorAll<HTMLButtonElement>('[data-g] button')) {
    b.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter') e.stopPropagation(); });
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const v = b.dataset.v!;
      if (b.parentElement!.dataset.g === 'quality') {
        settings.quality = v as Quality;
        gfx.quality(settings.quality);
        hint.textContent = `Qualité ${gfx.qualityNow()} en ce moment : le changement s'applique au prochain chargement`;
      } else {
        settings.shadows = v as ShadowChoice;
        gfx.shadows(settings.shadows);
      }
      paintSeg();
      onSave();
    });
  }
  paintSeg();

  let onClose: (() => void) | undefined;
  const close = () => {
    if (veil.classList.contains('off')) return;
    veil.classList.add('off');
    onSave();
    onClose?.();
  };
  veil.querySelector('.opt-close')!.addEventListener('click', (e) => { e.stopPropagation(); close(); });
  veil.addEventListener('click', (e) => { if (e.target === veil) close(); });
  // Échap ferme le panneau, et seulement lui (le menu pause dessous reste ouvert)
  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || veil.classList.contains('off')) return;
    e.stopImmediatePropagation();
    close();
  });

  return {
    root: veil,
    get open() { return !veil.classList.contains('off'); },
    show(whenClosed?: () => void) {
      onClose = whenClosed;
      veil.classList.remove('off');
      sliders[0].focus({ preventScroll: true });
    },
    close,
  };
}
