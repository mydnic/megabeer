const CSS = `
.pause-veil { position: fixed; inset: 0; z-index: 35; display: flex; align-items: center; justify-content: center;
  padding: 16px; box-sizing: border-box; overflow-y: auto;
  background: rgba(10,6,3,.62); font-family: 'Lilita One', system-ui, sans-serif; transition: opacity .15s; }
.pause-veil.off { opacity: 0; pointer-events: none; }
/* Boutons au centre de l'écran, cartes de stats dans la colonne de droite */
.pause-grid { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 28px; width: 100%; margin: auto; }
.pause-center { grid-column: 2; display: flex; flex-direction: column; align-items: center; gap: 14px; }
.pause-cards { grid-column: 3; justify-self: start; display: flex; flex-direction: column; gap: 10px; }
.pause-title { margin-bottom: 4px; font-size: clamp(48px, 7vw, 84px); line-height: 1; letter-spacing: .05em; color: #ffc93a;
  text-shadow: -4px 0 #1a120c, 4px 0 #1a120c, 0 -4px #1a120c, 0 4px #1a120c, 4px 4px #1a120c, -4px 4px #1a120c,
    4px -4px #1a120c, -4px -4px #1a120c, 0 9px 0 #1a120c; transform: rotate(-2deg); }
.pause-btn { width: 250px; font: inherit; font-size: 26px; letter-spacing: .05em; cursor: pointer;
  padding: 8px 24px 11px; border: 4px solid #1a120c; border-radius: 18px; transition: transform .08s;
  color: #f3e6cf; background: rgba(42,22,8,.88); box-shadow: 0 5px 0 #1a120c; }
.pause-btn.main { color: #2a1608; background: linear-gradient(#ffd45a, #f5a623 60%, #e08a12);
  box-shadow: 0 6px 0 #1a120c, inset 0 4px 0 rgba(255,255,255,.45); }
.pause-btn:hover, .pause-btn:focus-visible { transform: scale(1.05); outline: none; }
.pause-btn.quit:hover, .pause-btn.quit:focus-visible { background: #7a2414; }
.pause-card { width: 500px; box-sizing: border-box; padding: 7px 12px 8px; border: 3px solid #1a120c; border-radius: 14px;
  background: linear-gradient(#fff4d6, #f3dfb4); box-shadow: 0 4px 0 #1a120c; color: #2a1608; }
.pause-card h3 { display: flex; align-items: center; gap: 7px; margin: 0 0 3px; font-weight: normal; font-size: 17px; letter-spacing: .03em; }
.pause-card h3 svg { height: 22px; width: auto; }
.pause-card h3 .lvl { margin-left: auto; padding: 0 7px 1px; border: 2px solid #1a120c; border-radius: 10px;
  background: linear-gradient(#ffd45a, #f5a623); font-size: 12px; }
.pause-rows { display: grid; grid-template-columns: 1fr 1fr; column-gap: 18px; }
.pause-row { display: flex; align-items: baseline; gap: 5px; padding: 1px 0; border-top: 2px dotted rgba(42,22,8,.16);
  font-size: 13px; white-space: nowrap; }
.pause-row:nth-child(-n+2) { border-top: 0; }
.pause-row .v { margin-left: auto; font-variant-numeric: tabular-nums; }
.pause-row .b { min-width: 34px; text-align: right; font-size: 11.5px; color: #2f8a3a; }
.pause-row .b.zero { color: rgba(42,22,8,.3); }
.pause-card.empty { padding: 8px 12px; background: rgba(26,18,12,.35); border: 3px dashed rgba(243,230,207,.35); box-shadow: none;
  color: rgba(243,230,207,.55); font-size: 15px; letter-spacing: .04em; text-align: center; }
@media (max-width: 1320px) {
  .pause-grid { grid-template-columns: 1fr; justify-items: center; }
  .pause-center, .pause-cards { grid-column: 1; justify-self: center; }
}
@media (max-width: 540px) {
  .pause-card { width: calc(100vw - 32px); }
  .pause-rows { grid-template-columns: 1fr; }
}
`;

/** Une ligne de stats : libellé, valeur affichée, bonus affiché (vide = aucun bonus). */
export type StatRow = [label: string, value: string, bonus: string];
/** Un bloc de stats (le joueur, une arme). */
export type StatGroup = { title: string; icon?: string; level?: number; rows: StatRow[] };
/** Ce que la pause affiche : le joueur, puis les emplacements d'armes (null = libre). */
export type PauseStats = { player: StatGroup; weapons: (StatGroup | null)[] };

/**
 * Menu pause (Échap en run) : titre et boutons au centre de l'écran (Reprendre, Options, Abandonner),
 * et à droite une colonne de cartes : stats du joueur, puis les 4 emplacements d'armes.
 * Le monde est figé tant qu'il est ouvert.
 */
export function createPauseMenu(cb: { resume: () => void; options: () => void; quit: () => void; stats: () => PauseStats }) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'pause-veil off';
  el.innerHTML = `<div class="pause-grid">
      <div class="pause-center">
        <div class="pause-title">Pause</div>
        <button class="pause-btn main" data-a="resume">Reprendre</button>
        <button class="pause-btn" data-a="options">Options</button>
        <button class="pause-btn quit" data-a="quit">Abandonner</button>
      </div>
      <div class="pause-cards"></div>
    </div>`;
  document.body.appendChild(el);
  const cards = el.querySelector<HTMLElement>('.pause-cards')!;
  const buttons = [...el.querySelectorAll<HTMLButtonElement>('button')];
  for (const b of buttons) {
    b.addEventListener('click', (e) => { e.stopPropagation(); (cb[b.dataset.a as 'resume' | 'options' | 'quit'])(); });
    // Espace et Entrée activent le bouton sans piloter le jeu
    b.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter') e.stopPropagation(); });
  }

  const card = (g: StatGroup | null) => !g ? '<div class="pause-card empty">Emplacement libre</div>' : `<div class="pause-card">
    <h3>${g.icon ?? ''}<span>${g.title}</span>${g.level !== undefined ? `<span class="lvl">Niv. ${g.level}</span>` : ''}</h3>
    <div class="pause-rows">${g.rows.map(([l, v, b]) => `<div class="pause-row"><span>${l}</span><span class="v">${v}</span><span class="b${b ? '' : ' zero'}">${b || '-'}</span></div>`).join('')}</div>
  </div>`;

  function renderStats() {
    const s = cb.stats();
    cards.innerHTML = [s.player, ...s.weapons].map(card).join('');
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
