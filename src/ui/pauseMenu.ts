const CSS = `
.pause-veil { position: fixed; inset: 0; z-index: 35; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 18px; background: rgba(10,6,3,.6); font-family: 'Lilita One', system-ui, sans-serif;
  transition: opacity .15s; }
.pause-veil.off { opacity: 0; pointer-events: none; }
.pause-title { margin-bottom: 10px; font-size: clamp(48px, 8vw, 90px); letter-spacing: .05em; color: #ffc93a;
  text-shadow: -4px 0 #1a120c, 4px 0 #1a120c, 0 -4px #1a120c, 0 4px #1a120c, 4px 4px #1a120c, -4px 4px #1a120c,
    4px -4px #1a120c, -4px -4px #1a120c, 0 9px 0 #1a120c; transform: rotate(-2deg); }
.pause-btn { min-width: 260px; font: inherit; font-size: 28px; letter-spacing: .05em; cursor: pointer;
  padding: 9px 30px 12px; border: 4px solid #1a120c; border-radius: 18px; transition: transform .08s;
  color: #f3e6cf; background: rgba(42,22,8,.85); box-shadow: 0 5px 0 #1a120c; }
.pause-btn.main { color: #2a1608; background: linear-gradient(#ffd45a, #f5a623 60%, #e08a12);
  box-shadow: 0 6px 0 #1a120c, inset 0 4px 0 rgba(255,255,255,.45); }
.pause-btn:hover, .pause-btn:focus-visible { transform: scale(1.05); outline: none; }
.pause-btn.quit:hover, .pause-btn.quit:focus-visible { background: #7a2414; }
`;

/**
 * Menu pause (Échap en run) : Reprendre, Options, Abandonner (retour à l'accueil, la run est perdue).
 * Le monde est figé tant qu'il est ouvert.
 */
export function createPauseMenu(cb: { resume: () => void; options: () => void; quit: () => void }) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'pause-veil off';
  el.innerHTML = `<div class="pause-title">Pause</div>
    <button class="pause-btn main" data-a="resume">Reprendre</button>
    <button class="pause-btn" data-a="options">Options</button>
    <button class="pause-btn quit" data-a="quit">Abandonner</button>`;
  document.body.appendChild(el);
  const buttons = [...el.querySelectorAll<HTMLButtonElement>('button')];
  for (const b of buttons) {
    b.addEventListener('click', (e) => { e.stopPropagation(); cb[b.dataset.a as keyof typeof cb](); });
    // Espace et Entrée activent le bouton sans piloter le jeu
    b.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter') e.stopPropagation(); });
  }

  return {
    get open() { return !el.classList.contains('off'); },
    show() {
      el.classList.remove('off');
      if (document.pointerLockElement) document.exitPointerLock();
      buttons[0].focus({ preventScroll: true });
    },
    hide() { el.classList.add('off'); },
    /** Remet le focus sur Reprendre (après la fermeture des options). */
    focus() { buttons[0].focus({ preventScroll: true }); },
  };
}
