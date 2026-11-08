const CSS = `
.load { position: fixed; inset: 0; z-index: 32; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 16px; font-family: 'Lilita One', system-ui, sans-serif; color: #f3e6cf;
  background: radial-gradient(ellipse at 50% 35%, #5a3418 0%, #2a170b 55%, #120a05 100%); }
.load.off { display: none; }
.load-text { font-size: 26px; letter-spacing: .05em; text-shadow: 0 3px 0 #1a120c; }
.load-bar { width: min(420px, 70vw); height: 22px; border: 3px solid #1a120c; border-radius: 13px; background: #3a2418;
  box-shadow: 0 3px 0 rgba(26,18,12,.55), inset 0 3px 6px rgba(0,0,0,.45); overflow: hidden; }
.load-fill { height: 100%; width: 0; background: linear-gradient(#ffd36a, #f5a623 55%, #d9870f); transition: width .15s ease-out; }
`;

/** Petit écran de chargement entre Jouer et l'arrivée sur la planète (génération de la map). */
export function createLoadingScreen() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'load off';
  el.innerHTML = '<div class="load-text">On remplit la planète...</div><div class="load-bar"><div class="load-fill"></div></div>';
  document.body.appendChild(el);
  const fill = el.querySelector<HTMLElement>('.load-fill')!;

  return {
    show() { fill.style.width = '0'; el.classList.remove('off'); },
    /** Avancement de 0 à 1. */
    progress(k: number) { fill.style.width = `${Math.round(k * 100)}%`; },
    hide() { el.classList.add('off'); },
  };
}
