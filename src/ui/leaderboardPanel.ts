import type { LeaderboardEntry } from '../app/progress';
import { CHARACTERS } from '../config/characters';
import { DIFFICULTIES } from '../config/spawn';

const CSS = `
.lb { position: absolute; right: 16px; bottom: 16px; z-index: 2; width: min(330px, 40vw); box-sizing: border-box; padding: 10px 12px 12px;
  border: 3px solid #1a120c; border-radius: 18px; background: rgba(42,22,8,.82); box-shadow: 0 5px 0 #1a120c; color: #f3e6cf;
  font-family: 'Lilita One', system-ui, sans-serif; }
.lb.off { display: none; }
.lb-title { font-size: 20px; letter-spacing: .05em; color: #ffc93a; margin: 0 0 6px 2px; }
.lb-list { display: flex; flex-direction: column; gap: 3px; }
.lb-row { display: grid; grid-template-columns: 24px 26px 1fr auto; align-items: center; gap: 7px; padding: 2px 6px; border-radius: 10px; font-size: 15px; }
.lb-row.me { background: rgba(255,201,58,.22); outline: 2px solid rgba(255,201,58,.6); }
.lb-rank { text-align: right; opacity: .75; }
.lb-row:nth-child(1) .lb-rank { color: #ffd45a; opacity: 1; } .lb-row:nth-child(2) .lb-rank { color: #dfe6ee; opacity: 1; } .lb-row:nth-child(3) .lb-rank { color: #e0975a; opacity: 1; }
.lb-ava { width: 24px; height: 24px; border-radius: 50%; border: 2px solid #1a120c; background: #5a3a1c; object-fit: cover; box-sizing: border-box;
  display: flex; align-items: center; justify-content: center; font-size: 13px; color: #ffc93a; }
.lb-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lb-sub { display: block; font-size: 11px; opacity: .6; letter-spacing: .02em; }
.lb-kills { color: #8fe07a; text-align: right; white-space: nowrap; }
.lb-empty, .lb-foot { font-size: 13px; opacity: .75; padding: 2px 4px; }
.lb-foot { margin-top: 6px; }
@media (max-height: 520px) { .lb-row { font-size: 13px; padding: 1px 6px; } .lb-sub { display: none; } .lb-title { font-size: 16px; margin-bottom: 3px; } }
`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const label = <T extends Record<string, { name?: string; label?: string }>>(table: T, id: string) => {
  const e = (table as Record<string, { name?: string; label?: string }>)[id];
  return e ? (e.name ?? e.label ?? id) : id;
};

/**
 * Le leaderboard de l'accueil (coin bas droit) : les 10 meilleures runs en kills, tous joueurs confondus, la ligne du
 * joueur connecté mise en avant. Caché si le serveur ne répond pas (hors ligne, hébergement statique).
 */
export function createLeaderboardPanel(parent: HTMLElement) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'lb off';
  parent.appendChild(el);

  return {
    root: el,
    /** `entries` null : serveur injoignable (panneau caché). `guest` : invite à se connecter pour y figurer. */
    update(entries: readonly LeaderboardEntry[] | null, guest: boolean) {
      el.classList.toggle('off', entries === null);
      if (!entries) return;
      const rows = entries.map((e) => {
        const ava = e.avatarUrl ? `<img class="lb-ava" src="${esc(e.avatarUrl)}" alt="">` : `<span class="lb-ava">${esc(e.name.slice(0, 1).toUpperCase())}</span>`;
        const sub = `${label(CHARACTERS, e.character)}, ${label(DIFFICULTIES, e.difficulty)}, ${time(e.survived)}`;
        return `<div class="lb-row${e.me ? ' me' : ''}"><span class="lb-rank">${e.rank}</span>${ava}<span class="lb-name">${esc(e.name)}<span class="lb-sub">${esc(sub)}</span></span><span class="lb-kills">${e.kills.toLocaleString('fr')}</span></div>`;
      }).join('');
      el.innerHTML = `<div class="lb-title">Classement (kills)</div><div class="lb-list">${rows || '<div class="lb-empty">Personne pour l\'instant : à toi de jouer !</div>'}</div>`
        + (guest ? '<div class="lb-foot">Connecte-toi pour entrer au classement</div>' : '');
    },
  };
}
