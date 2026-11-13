import { CHARACTERS, MAPS, type CharacterId } from '../config/characters';
import type { DifficultyId } from '../config/spawn';
import { createDifficultyPicker } from './difficultyPicker';
import { pint, svg64 } from './iconKit';

const CSS = `
.setup { position: fixed; inset: 0; z-index: 31; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2.4vh;
  padding: 16px; box-sizing: border-box; overflow-y: auto; font-family: 'Lilita One', system-ui, sans-serif; color: #f3e6cf;
  background: radial-gradient(ellipse at 50% 35%, #5a3418 0%, #2a170b 55%, #120a05 100%); }
.setup.off { display: none; }
.setup h2 { margin: 0; font-weight: normal; font-size: clamp(22px, 3.4vw, 34px); letter-spacing: .05em; color: #ffc93a; text-shadow: 0 4px 0 #1a120c; }
.setup h3 { margin: 0 0 -1vh; font-weight: normal; font-size: 17px; letter-spacing: .08em; opacity: .7; text-transform: uppercase; }
.setup-row { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
.setup-card { font: inherit; color: inherit; cursor: pointer; width: 210px; padding: 10px 12px 12px; box-sizing: border-box; text-align: center;
  border: 3px solid #1a120c; border-radius: 18px; background: rgba(42,22,8,.8); box-shadow: 0 5px 0 #1a120c; transition: transform .08s;
  display: flex; flex-direction: column; align-items: center; gap: 4px; position: relative; }
.setup-card img, .setup-card .setup-ph { width: 110px; height: 110px; object-fit: contain; }
.setup-card b { font-weight: normal; font-size: 20px; color: #ffc93a; }
.setup-card p { margin: 0; font-size: 13px; line-height: 1.25; opacity: .85; }
.setup-card.on { background: linear-gradient(rgba(255,212,90,.35), rgba(42,22,8,.85)); border-color: #ffc93a; box-shadow: 0 5px 0 #1a120c, 0 0 22px rgba(255,201,58,.45); }
.setup-card.locked { cursor: default; filter: grayscale(.85) brightness(.7); }
.setup-card.locked p.setup-lock { color: #ffb4a0; opacity: 1; }
.setup-card:hover:not(.locked), .setup-card:focus-visible { transform: scale(1.04); outline: none; }
.setup-card.map { width: 280px; }
.setup .diff, .setup .diff-hint { margin: 0; }
.setup-go { display: flex; gap: 16px; align-items: center; margin-top: 1vh; }
.setup-back { font: inherit; font-size: 20px; letter-spacing: .05em; color: #f3e6cf; cursor: pointer; padding: 8px 24px 10px; border: 3px solid #1a120c;
  border-radius: 16px; background: rgba(42,22,8,.8); box-shadow: 0 4px 0 #1a120c; transition: transform .08s; }
.setup-play { font: inherit; font-size: clamp(26px, 3.4vw, 38px); letter-spacing: .06em; color: #2a1608; cursor: pointer; padding: 10px 54px 14px;
  border: 4px solid #1a120c; border-radius: 22px; background: linear-gradient(#ffd45a, #f5a623 60%, #e08a12);
  box-shadow: 0 7px 0 #1a120c, inset 0 4px 0 rgba(255,255,255,.45); transition: transform .08s; }
.setup-back:hover, .setup-back:focus-visible, .setup-play:hover, .setup-play:focus-visible { transform: scale(1.06); outline: none; }
@media (max-height: 560px) {
  .setup { gap: 1.2vh; justify-content: flex-start; }
  .setup-card { width: 170px; padding: 6px 8px 8px; } .setup-card img, .setup-card .setup-ph { width: 64px; height: 64px; }
  .setup-card p { font-size: 11px; } .setup-card.map { width: 220px; } .setup h3 { font-size: 13px; margin: 0; }
}
`;

const PINT = svg64('', pint(17, 10, 1, -8));
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const ORDER = Object.keys(CHARACTERS) as CharacterId[];

/** Ce que l'écran avant partie sait du joueur : persos ouverts (et comment ouvrir les autres), difficultés ouvertes. */
export type SetupState = {
  /** Pourquoi le perso est fermé (null : ouvert). */
  lockedBy: (id: CharacterId) => string | null;
  character: CharacterId;
  difficulties: readonly DifficultyId[];
  difficulty: DifficultyId;
};

/**
 * L'écran avant la partie (bouton Jouer de l'accueil) : le perso, la map, la difficulté, puis Jouer lance la run. Retour
 * (ou Échap, ou B à la manette) revient à l'accueil. Souris, clavier ou manette (navigation commune des menus).
 */
export function createSetupScreen(cb: {
  play: (character: CharacterId, difficulty: DifficultyId) => void;
  back: () => void;
  portrait: (id: string) => string | null;
  pickCharacter: (id: CharacterId) => void;
  pickDifficulty: (id: DifficultyId) => void;
}) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'setup off';
  el.innerHTML = `<h2>Avant de partir</h2><h3>Perso</h3><div class="setup-row setup-chars"></div><h3>Map</h3><div class="setup-row setup-maps"></div>
    <h3>Difficulté</h3><div class="setup-diff"></div><div class="setup-go"><button class="setup-back">Retour</button><button class="setup-play">Jouer</button></div>`;
  document.body.appendChild(el);
  const chars = el.querySelector<HTMLElement>('.setup-chars')!;
  const maps = el.querySelector<HTMLElement>('.setup-maps')!;
  const diffBox = el.querySelector<HTMLElement>('.setup-diff')!;
  const anchor = document.createElement('span');
  diffBox.appendChild(anchor);
  const difficulty = createDifficultyPicker(diffBox, anchor, (d) => cb.pickDifficulty(d));
  diffBox.style.display = 'flex';
  diffBox.style.flexDirection = 'column';
  diffBox.style.alignItems = 'center';
  diffBox.style.gap = '6px';
  const playBtn = el.querySelector<HTMLButtonElement>('.setup-play')!;
  const stop = (b: HTMLElement) => b.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter') e.stopPropagation(); });
  playBtn.addEventListener('click', (e) => { e.stopPropagation(); if (state) cb.play(state.character, difficulty.selected); });
  const backBtn = el.querySelector<HTMLButtonElement>('.setup-back')!;
  backBtn.addEventListener('click', (e) => { e.stopPropagation(); close(); });
  stop(backBtn);
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && !el.classList.contains('off')) { e.stopImmediatePropagation(); close(); } });

  let state: SetupState | null = null;

  function render() {
    if (!state) return;
    const s = state;
    chars.innerHTML = ORDER.map((id) => {
      const C = CHARACTERS[id], lock = s.lockedBy(id), face = cb.portrait(id);
      return `<button class="setup-card${id === s.character ? ' on' : ''}${lock ? ' locked' : ''}" data-c="${id}">${face ? `<img src="${face}" alt="">` : `<span class="setup-ph">${PINT}</span>`}
        <b>${esc(C.name)}</b><p${lock ? ' class="setup-lock"' : ''}>${esc(lock ?? C.pitch)}</p></button>`;
    }).join('');
    maps.innerHTML = Object.values(MAPS).map((m) => `<button class="setup-card map on"><b>${esc(m.name)}</b><p>${esc(m.pitch)}</p></button>`).join('');
    for (const b of chars.querySelectorAll<HTMLButtonElement>('[data-c]')) {
      stop(b);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = b.dataset.c as CharacterId;
        if (s.lockedBy(id)) return;
        s.character = id;
        cb.pickCharacter(id);
        render();
        chars.querySelector<HTMLElement>(`[data-c="${id}"]`)?.focus({ preventScroll: true });
      });
    }
    for (const b of maps.querySelectorAll<HTMLButtonElement>('button')) { stop(b); b.addEventListener('click', (e) => e.stopPropagation()); }
  }

  function close() {
    if (el.classList.contains('off')) return;
    el.classList.add('off');
    cb.back();
  }

  return {
    root: el,
    get open() { return !el.classList.contains('off'); },
    show(s: SetupState) {
      state = { ...s, character: s.lockedBy(s.character) ? 'buveur' : s.character };
      difficulty.update(s.difficulties, s.difficulty);
      render();
      el.classList.remove('off');
      playBtn.focus({ preventScroll: true });
    },
    /** Ferme sans revenir à l'accueil (la run démarre). */
    hide() { el.classList.add('off'); },
    close,
    /** Un portrait vient d'être rendu. */
    refresh() { if (state && !el.classList.contains('off')) render(); },
  };
}
