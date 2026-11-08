const CSS = `
.home { position: fixed; inset: 0; z-index: 30; display: flex; flex-direction: column; align-items: center;
  justify-content: flex-end; padding-bottom: 14vh; gap: 4vh; font-family: 'Lilita One', system-ui, sans-serif;
  background: radial-gradient(ellipse at 50% 35%, #5a3418 0%, #2a170b 55%, #120a05 100%); transition: opacity .45s; }
.home::before { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .5;
  background: radial-gradient(circle, rgba(255,214,120,.22) 0 3px, transparent 4px) 0 0 / 46px 46px,
    radial-gradient(circle, rgba(255,214,120,.14) 0 2px, transparent 3px) 23px 23px / 46px 46px; }
.home.off { opacity: 0; pointer-events: none; }
.home-logo { position: absolute; top: 9vh; left: 0; right: 0; text-align: center; pointer-events: none;
  font-size: clamp(56px, 13vw, 170px); line-height: .9; letter-spacing: .03em; color: #ffc93a;
  text-shadow: 0 -6px 0 #fff4d6, -5px 0 #1a120c, 5px 0 #1a120c, 0 -5px #1a120c, 0 5px #1a120c,
    5px 5px #1a120c, -5px 5px #1a120c, 5px -5px #1a120c, -5px -5px #1a120c, 0 12px 0 #1a120c;
  transform: rotate(-3deg); animation: home-bob 3.2s ease-in-out infinite; }
@keyframes home-bob { 0%,100% { transform: rotate(-3deg) translateY(0) } 50% { transform: rotate(-2deg) translateY(6px) } }
.home-play { font: inherit; font-size: clamp(30px, 4vw, 44px); letter-spacing: .06em; color: #2a1608; cursor: pointer;
  padding: 14px 64px 18px; border: 4px solid #1a120c; border-radius: 22px;
  background: linear-gradient(#ffd45a, #f5a623 60%, #e08a12); box-shadow: 0 7px 0 #1a120c, inset 0 4px 0 rgba(255,255,255,.45);
  transition: transform .08s; }
.home-play:hover, .home-play:focus-visible { transform: scale(1.06); outline: none; }
.home-play:active { transform: translateY(4px); box-shadow: 0 3px 0 #1a120c, inset 0 4px 0 rgba(255,255,255,.45); }
.home-options { font: inherit; font-size: 22px; letter-spacing: .05em; color: #f3e6cf; cursor: pointer; margin-top: -2vh;
  padding: 6px 26px 9px; border: 3px solid #1a120c; border-radius: 16px; background: rgba(42,22,8,.75);
  box-shadow: 0 4px 0 #1a120c; transition: transform .08s; }
.home-options:hover, .home-options:focus-visible { transform: scale(1.06); outline: none; background: rgba(90,58,28,.9); }
.home-hint { color: #f3e6cf; font-size: 16px; letter-spacing: .04em; margin-top: -2vh;
  text-shadow: -2px 0 #1a120c, 2px 0 #1a120c, 0 -2px #1a120c, 0 2px #1a120c; }
`;

/**
 * Écran d'accueil provisoire (GDD section 16), séparé du jeu : fond opaque, le monde n'est ni montré
 * ni rendu tant qu'on y est ; la run (et le Buveur sur la planète) commence avec Jouer. Sera remplacé
 * par l'accueil dans l'espace. Boutons : Jouer, Options ; les autres (boutique, skill tree, persos...)
 * apparaîtront au fil des déblocages.
 */
export function createHomeScreen(onPlay: () => void, onOptions: () => void) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'home';
  el.innerHTML = `<div class="home-logo">MEGABEER</div><button class="home-play">Jouer</button><div class="home-hint">Espace ou A</div><button class="home-options">Options</button>`;
  document.body.appendChild(el);
  const btn = el.querySelector<HTMLButtonElement>('.home-play')!;
  btn.addEventListener('click', (e) => { e.stopPropagation(); onPlay(); });
  const opt = el.querySelector<HTMLButtonElement>('.home-options')!;
  opt.addEventListener('click', (e) => { e.stopPropagation(); onOptions(); });
  // Espace sur Options ouvre le panneau, sans lancer la run
  opt.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter') e.stopPropagation(); });

  return {
    get visible() { return !el.classList.contains('off'); },
    show() {
      el.classList.remove('off');
      if (document.pointerLockElement) document.exitPointerLock();
      btn.focus({ preventScroll: true });
    },
    hide() { el.classList.add('off'); },
    /** Remet le focus sur Jouer (après la fermeture d'un panneau). */
    focus() { btn.focus({ preventScroll: true }); },
  };
}
