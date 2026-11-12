import type { Account } from '../app/progress';
import type { Profile } from '../meta/profile';
import { tunasIcon } from './icons';

const TUNAS_ICON = tunasIcon();

const CSS = `
.acc { position: absolute; top: 16px; left: 16px; z-index: 2; display: flex; align-items: center; gap: 12px; max-width: calc(100vw - 32px);
  padding: 10px 12px 10px 10px; border: 3px solid #1a120c; border-radius: 18px; box-sizing: border-box;
  background: rgba(42,22,8,.82); box-shadow: 0 5px 0 #1a120c; color: #f3e6cf; font-family: 'Lilita One', system-ui, sans-serif; }
.acc.off { display: none; }
.acc-ava { width: 46px; height: 46px; border-radius: 50%; border: 3px solid #1a120c; background: #5a3a1c; flex: none; object-fit: cover; }
.acc-txt { display: flex; flex-direction: column; min-width: 0; }
.acc-name { font-size: 20px; letter-spacing: .03em; color: #ffc93a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.acc-tunas { display: inline-flex; align-items: center; gap: 4px; margin-left: 8px; color: #8fe07a; } .acc-tunas svg { width: 22px; height: 22px; }
.acc-stats { font-size: 13px; opacity: .8; white-space: nowrap; }
.acc-btn { font: inherit; font-size: 15px; letter-spacing: .04em; cursor: pointer; padding: 6px 14px 8px; border: 3px solid #1a120c; border-radius: 13px;
  color: #fff; background: linear-gradient(#7b86ff, #5865f2 60%, #4752c4); box-shadow: 0 4px 0 #1a120c; transition: transform .08s; flex: none; }
.acc-btn.out { color: #f3e6cf; background: rgba(90,58,28,.95); }
.acc-btn:hover, .acc-btn:focus-visible { transform: scale(1.06); outline: none; filter: brightness(1.1); }
.acc-err { position: absolute; top: calc(100% + 8px); left: 0; font-size: 13px; color: #ffb4a0; white-space: nowrap; }
@media (max-width: 540px) { .acc { top: 8px; right: 8px; left: 8px; } .acc-stats { white-space: normal; } }
`;

const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Le compte sur l'accueil (coin haut gauche) : invité, un bouton « Se connecter avec Discord » ; connecté, l'avatar, le
 * pseudo, la progression (runs, record, kills) et « Se déconnecter ». Caché si le serveur des comptes ne répond pas.
 */
export function createAccountPanel(parent: HTMLElement, cb: { login: () => void; logout: () => void }) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'acc off';
  parent.appendChild(el);
  // Retour d'une connexion ratée (?connexion=...) : affiché une fois, puis retiré de l'adresse
  const params = new URLSearchParams(location.search);
  let error = params.get('connexion');
  if (error) { params.delete('connexion'); history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}`); }

  return {
    update(online: boolean, account: Account | null, p: Profile, canLogin = true) {
      el.classList.toggle('off', !online);
      if (!online) return;
      const stats = p.runs ? `${p.runs} run${p.runs > 1 ? 's' : ''}, record ${time(p.bestTime)}, ${p.totalKills.toLocaleString('fr')} kills` : 'Aucune run pour l\'instant';
      const tunas = `<span class="acc-tunas">${TUNAS_ICON}${p.tunas.toLocaleString('fr')}</span>`;
      el.innerHTML = account
        ? `<img class="acc-ava" src="${esc(account.avatarUrl)}" alt=""><div class="acc-txt"><span class="acc-name">${esc(account.name)} ${tunas}</span><span class="acc-stats">${stats}</span></div><button class="acc-btn out">Se déconnecter</button>`
        : `<div class="acc-txt"><span class="acc-name">Invité ${tunas}</span><span class="acc-stats">${stats}, sur ce navigateur</span></div>${canLogin ? '<button class="acc-btn">Se connecter avec Discord</button>' : ''}`;
      if (error) el.insertAdjacentHTML('beforeend', `<div class="acc-err">Connexion : ${esc(error)}</div>`);
      error = null;
      const btn = el.querySelector<HTMLButtonElement>('.acc-btn');
      if (!btn) return;
      btn.addEventListener('click', (e) => { e.stopPropagation(); (account ? cb.logout : cb.login)(); });
      btn.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter') e.stopPropagation(); });
    },
  };
}
