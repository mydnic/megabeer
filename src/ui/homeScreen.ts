const CSS = `
.home { position: fixed; inset: 0; z-index: 30; display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding-top: 16vh; box-sizing: border-box; gap: 3.2vh; font-family: 'Lilita One', system-ui, sans-serif;
  background: radial-gradient(ellipse at 50% 35%, #5a3418 0%, #2a170b 55%, #120a05 100%); transition: opacity .45s; }
/* Bulles de bière qui montent sans fin, sur deux profondeurs */
.home::before { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .55;
  background: radial-gradient(circle, rgba(255,224,140,.3) 0 3px, transparent 4px) 0 0 / 46px 92px,
    radial-gradient(circle, rgba(255,224,140,.22) 0 5px, transparent 6px) 23px 40px / 138px 184px,
    radial-gradient(circle, rgba(255,214,120,.16) 0 2px, transparent 3px) 12px 23px / 69px 46px;
  animation: home-bubbles 9s linear infinite; }
@keyframes home-bubbles { to { background-position: 0 -184px, 23px -328px, 12px -69px; } }
/* Lueur dorée qui respire derrière le logo */
.home::after { content: ''; position: absolute; left: 50%; top: 20vh; width: 90vmin; aspect-ratio: 2; translate: -50% -50%; pointer-events: none;
  background: radial-gradient(ellipse, rgba(255,201,58,.28), transparent 65%); animation: home-glow 3.2s ease-in-out infinite alternate; }
@keyframes home-glow { to { scale: 1.15; opacity: .6; } }
.home.off { opacity: 0; pointer-events: none; }
.home-logo { position: absolute; top: 7vh; left: 0; right: 0; text-align: center; pointer-events: none;
  font-size: clamp(48px, min(12vw, 20vh), 170px); line-height: 1; letter-spacing: .03em; color: #ffc93a; z-index: 1;
  background: linear-gradient(100deg, transparent 40%, rgba(255,255,255,.9) 50%, transparent 60%) -100% 0 / 300% 100% no-repeat,
    linear-gradient(#fff6c8 12%, #ffd24a 38%, #f59a16 72%, #c96a08 96%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  filter: drop-shadow(-4px 0 #1a120c) drop-shadow(4px 0 #1a120c) drop-shadow(0 -4px #1a120c) drop-shadow(0 4px #1a120c) drop-shadow(0 10px 0 #1a120c);
  transform: rotate(-3deg); animation: home-bob 3.2s ease-in-out infinite, home-shine 4.5s ease-in-out infinite; }
@keyframes home-shine { 0%, 60% { background-position: 200% 0, 0 0; } 100% { background-position: -100% 0, 0 0; } }
@keyframes home-bob { 0%,100% { transform: rotate(-3deg) translateY(0) } 50% { transform: rotate(-2deg) translateY(6px) } }
.home-play { font: inherit; font-size: clamp(30px, 4vw, 44px); letter-spacing: .06em; color: #2a1608; cursor: pointer;
  padding: 14px 64px 18px; border: 4px solid #1a120c; border-radius: 22px;
  background: linear-gradient(#ffd45a, #f5a623 60%, #e08a12); box-shadow: 0 7px 0 #1a120c, inset 0 4px 0 rgba(255,255,255,.45);
  transition: transform .08s; position: relative; z-index: 1; animation: home-pulse 1.6s ease-in-out infinite; }
@keyframes home-pulse { 50% { box-shadow: 0 7px 0 #1a120c, inset 0 4px 0 rgba(255,255,255,.45), 0 0 34px rgba(255,201,58,.8); scale: 1.03; } }
.home-play:hover, .home-play:focus-visible { transform: scale(1.06); outline: none; }
.home-play:active { transform: translateY(4px); box-shadow: 0 3px 0 #1a120c, inset 0 4px 0 rgba(255,255,255,.45); }
.home-options { position: relative; z-index: 1; font: inherit; font-size: 22px; letter-spacing: .05em; color: #f3e6cf; cursor: pointer; margin-top: -2vh;
  padding: 6px 26px 9px; border: 3px solid #1a120c; border-radius: 16px; background: rgba(42,22,8,.75);
  box-shadow: 0 4px 0 #1a120c; transition: transform .08s; }
.home-options:hover, .home-options:focus-visible { transform: scale(1.06); outline: none; background: rgba(90,58,28,.9); }
.home-row { position: relative; z-index: 1; display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
.home-opt { position: absolute; left: 16px; bottom: 16px; margin: 0; }
.home-row .home-options { margin-top: 0; }
.home-shop { color: #8fe07a; }
.home-skills { color: #ffc93a; }
.home-ach { color: #ff9f6a; }
@media (max-height: 520px) { .home { padding-top: 22vh; gap: 2.4vh; } .home-options { font-size: 18px; padding: 4px 18px 7px; } }
`;

/**
 * Écran d'accueil (GDD section 16), séparé du jeu : fond opaque, le monde n'est ni montré ni rendu tant qu'on y est.
 * Logo en haut, Jouer au centre (il ouvre l'écran avant partie : perso, map, difficulté), Boutique, Skills et Succès
 * dessous, Options en bas à gauche ; le compte (haut gauche) et le classement (bas droite) s'y ajoutent.
 */
export function createHomeScreen(onPlay: () => void, onOptions: () => void, onShop: () => void, onSkills: () => void, onAchievements: () => void) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'home';
  el.innerHTML = `<div class="home-logo">MEGABEER</div><button class="home-play">Jouer</button><div class="home-row"><button class="home-options home-shop">Boutique</button><button class="home-options home-skills">Skills</button><button class="home-options home-ach">Succès</button></div><button class="home-options home-opt">Options</button>`;
  document.body.appendChild(el);
  const btn = el.querySelector<HTMLButtonElement>('.home-play')!;
  btn.addEventListener('click', (e) => { e.stopPropagation(); onPlay(); });
  const opt = el.querySelector<HTMLButtonElement>('.home-opt')!;
  opt.addEventListener('click', (e) => { e.stopPropagation(); onOptions(); });
  const shop = el.querySelector<HTMLButtonElement>('.home-shop')!;
  shop.addEventListener('click', (e) => { e.stopPropagation(); onShop(); });
  const skills = el.querySelector<HTMLButtonElement>('.home-skills')!;
  skills.addEventListener('click', (e) => { e.stopPropagation(); onSkills(); });
  const ach = el.querySelector<HTMLButtonElement>('.home-ach')!;
  ach.addEventListener('click', (e) => { e.stopPropagation(); onAchievements(); });
  // Espace sur Options, Boutique ou Skills ouvre le panneau, sans lancer la run
  for (const b of [opt, shop, skills, ach]) b.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter') e.stopPropagation(); });

  return {
    root: el,
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
