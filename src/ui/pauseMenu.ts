const CSS = `
.pause-veil { position: fixed; inset: 0; z-index: 35; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 22px; padding: 16px; box-sizing: border-box; overflow-y: auto;
  background: rgba(10,6,3,.6); font-family: 'Lilita One', system-ui, sans-serif; transition: opacity .15s; }
.pause-veil.off { opacity: 0; pointer-events: none; }
.pause-title { font-size: clamp(48px, 8vw, 90px); line-height: 1; letter-spacing: .05em; color: #ffc93a;
  text-shadow: -4px 0 #1a120c, 4px 0 #1a120c, 0 -4px #1a120c, 0 4px #1a120c, 4px 4px #1a120c, -4px 4px #1a120c,
    4px -4px #1a120c, -4px -4px #1a120c, 0 9px 0 #1a120c; transform: rotate(-2deg); }
.pause-body { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: center; gap: 28px; }
.pause-btns { display: flex; flex-direction: column; gap: 16px; }
.pause-btn { min-width: 260px; font: inherit; font-size: 28px; letter-spacing: .05em; cursor: pointer;
  padding: 9px 30px 12px; border: 4px solid #1a120c; border-radius: 18px; transition: transform .08s;
  color: #f3e6cf; background: rgba(42,22,8,.85); box-shadow: 0 5px 0 #1a120c; }
.pause-btn.main { color: #2a1608; background: linear-gradient(#ffd45a, #f5a623 60%, #e08a12);
  box-shadow: 0 6px 0 #1a120c, inset 0 4px 0 rgba(255,255,255,.45); }
.pause-btn:hover, .pause-btn:focus-visible { transform: scale(1.05); outline: none; }
.pause-btn.quit:hover, .pause-btn.quit:focus-visible { background: #7a2414; }
.pause-stats { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; }
.pause-card { width: 270px; padding: 12px 16px 14px; border: 4px solid #1a120c; border-radius: 18px;
  background: linear-gradient(#fff4d6, #f3dfb4); box-shadow: 0 6px 0 #1a120c; color: #2a1608; }
.pause-card h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font-weight: normal; font-size: 22px; letter-spacing: .03em; }
.pause-card h3 svg { height: 30px; width: auto; }
.pause-card h3 .lvl { margin-left: auto; padding: 1px 9px 2px; border: 2px solid #1a120c; border-radius: 11px;
  background: linear-gradient(#ffd45a, #f5a623); font-size: 15px; }
.pause-row { display: flex; align-items: baseline; gap: 8px; padding: 3px 0; border-top: 2px dotted rgba(42,22,8,.18); font-size: 16px; }
.pause-row:first-of-type { border-top: 0; }
.pause-row .v { margin-left: auto; font-variant-numeric: tabular-nums; }
.pause-row .b { min-width: 52px; text-align: right; font-size: 13px; color: #2f8a3a; }
.pause-row .b.zero { color: rgba(42,22,8,.35); }
`;

/** Une ligne de stats : libellé, valeur affichée, bonus affiché (vide = aucun bonus). */
export type StatRow = [label: string, value: string, bonus: string];
/** Un bloc de stats (le joueur, une arme). */
export type StatGroup = { title: string; icon?: string; level?: number; rows: StatRow[] };

/**
 * Menu pause (Échap en run) : Reprendre, Options, Abandonner (retour à l'accueil, la run est perdue),
 * et les stats actuelles du joueur et des armes équipées. Le monde est figé tant qu'il est ouvert.
 */
export function createPauseMenu(cb: { resume: () => void; options: () => void; quit: () => void; stats: () => StatGroup[] }) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'pause-veil off';
  el.innerHTML = `<div class="pause-title">Pause</div>
    <div class="pause-body">
      <div class="pause-btns">
        <button class="pause-btn main" data-a="resume">Reprendre</button>
        <button class="pause-btn" data-a="options">Options</button>
        <button class="pause-btn quit" data-a="quit">Abandonner</button>
      </div>
      <div class="pause-stats"></div>
    </div>`;
  document.body.appendChild(el);
  const statsEl = el.querySelector<HTMLElement>('.pause-stats')!;
  const buttons = [...el.querySelectorAll<HTMLButtonElement>('button')];
  for (const b of buttons) {
    b.addEventListener('click', (e) => { e.stopPropagation(); (cb[b.dataset.a as 'resume' | 'options' | 'quit'])(); });
    // Espace et Entrée activent le bouton sans piloter le jeu
    b.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter') e.stopPropagation(); });
  }

  function renderStats() {
    statsEl.innerHTML = cb.stats().map((g) => `<div class="pause-card">
      <h3>${g.icon ?? ''}<span>${g.title}</span>${g.level !== undefined ? `<span class="lvl">Niv. ${g.level}</span>` : ''}</h3>
      ${g.rows.map(([l, v, b]) => `<div class="pause-row"><span>${l}</span><span class="v">${v}</span><span class="b${b ? '' : ' zero'}">${b || '-'}</span></div>`).join('')}
    </div>`).join('');
  }

  return {
    get open() { return !el.classList.contains('off'); },
    show() {
      renderStats();
      el.classList.remove('off');
      if (document.pointerLockElement) document.exitPointerLock();
      buttons[0].focus({ preventScroll: true });
    },
    hide() { el.classList.add('off'); },
    /** Remet le focus sur Reprendre (après la fermeture des options). */
    focus() { buttons[0].focus({ preventScroll: true }); },
  };
}
