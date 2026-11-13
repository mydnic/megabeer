import type { Account } from '../app/progress';
import type { Profile } from '../meta/profile';
import { tunasIcon } from './icons';

const TUNAS_ICON = tunasIcon();

const CSS = `
.acc { position: absolute; top: 16px; left: 16px; z-index: 2; display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 8px 12px; max-width: calc(100vw - 32px);
  padding: 10px 12px 10px 10px; border: 3px solid #1a120c; border-radius: 18px; box-sizing: border-box;
  background: rgba(42,22,8,.82); box-shadow: 0 5px 0 #1a120c; color: #f3e6cf; font-family: 'Lilita One', system-ui, sans-serif; }
.acc.off { display: none; }
.acc-ava { grid-row: 1; width: 46px; height: 46px; border-radius: 50%; border: 3px solid #1a120c; background: #5a3a1c; flex: none; object-fit: cover; }
.acc-txt { display: flex; flex-direction: column; min-width: 0; }
.acc-name { font-size: 20px; letter-spacing: .03em; color: #ffc93a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.acc-tunas { display: inline-flex; align-items: center; gap: 4px; margin-left: 8px; color: #8fe07a; } .acc-tunas svg { width: 22px; height: 22px; }
.acc-stats { font-size: 13px; opacity: .8; white-space: nowrap; }
.acc-btns { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 6px; }
.acc-btn { font: inherit; font-size: 15px; letter-spacing: .04em; cursor: pointer; padding: 6px 14px 8px; border: 3px solid #1a120c; border-radius: 13px;
  color: #fff; background: linear-gradient(#7b86ff, #5865f2 60%, #4752c4); box-shadow: 0 4px 0 #1a120c; transition: transform .08s; flex: none; }
.acc-btn.out { color: #f3e6cf; background: rgba(90,58,28,.95); }
.acc-btn:hover, .acc-btn:focus-visible { transform: scale(1.06); outline: none; filter: brightness(1.1); }
.acc-err { position: absolute; top: calc(100% + 8px); left: 0; font-size: 13px; color: #ffb4a0; white-space: nowrap; }
.acc-txt:first-child { grid-column: 1 / -1; }
.acc-mail-form { display: flex; flex-direction: column; gap: 6px; }
.acc-mail { display: flex; gap: 6px; } .acc-mail-form input { font: inherit; font-size: 14px; min-width: 0; flex: 1; padding: 4px 8px; border: 3px solid #1a120c;
  border-radius: 11px; background: #f3e6cf; color: #2a1608; } .acc-btn.mail { color: #2a1608; background: linear-gradient(#ffd45a, #f5a623 60%, #e08a12); }
.acc-ok { font-size: 13px; color: #8fe07a; max-width: 260px; }
@media (max-width: 540px), (max-height: 520px) { .acc { top: 8px; left: 8px; padding: 6px 8px; } .acc-stats { display: none; } .acc-ava { width: 34px; height: 34px; } .acc-name { font-size: 16px; } .acc-btn { font-size: 13px; padding: 4px 10px 6px; } }
`;

const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Le compte sur l'accueil (coin haut gauche) : invité, un bouton « Se connecter avec Discord » ; connecté, l'avatar, le
 * pseudo, la progression (runs, record, kills) et « Se déconnecter ». Caché si le serveur des comptes ne répond pas.
 */
export function createAccountPanel(parent: HTMLElement, cb: { login: () => void; logout: () => void; emailLink: (email: string, name: string) => Promise<string | null> }) {
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

  /** Formulaire email ouvert, et ce qui a été tapé (gardé si l'encart se redessine). */
  let mailOpen = false, mailSent = '', draft = { email: '', name: '' };

  return {
    update(online: boolean, account: Account | null, p: Profile, canLogin = true, canEmail = false) {
      el.classList.toggle('off', !online);
      if (!online) return;
      const guestBtns = [
        canLogin ? '<button class="acc-btn">Se connecter avec Discord</button>' : '',
        canEmail && !mailOpen && !mailSent ? '<button class="acc-btn mail acc-mail-open">Se connecter par email</button>' : '',
        canEmail && mailOpen ? `<form class="acc-mail-form"><input name="name" placeholder="Pseudo" maxlength="24" autocomplete="nickname" value="${esc(draft.name)}">
          <div class="acc-mail"><input name="email" type="email" placeholder="Adresse email" autocomplete="email" value="${esc(draft.email)}"><button class="acc-btn mail">Envoyer</button></div></form>` : '',
        mailSent ? `<div class="acc-ok">Lien envoyé à ${esc(mailSent)} : ouvre-le sur cet appareil.</div>` : '',
      ].join('');
      const stats = p.runs ? `${p.runs} run${p.runs > 1 ? 's' : ''}, record ${time(p.bestTime)}, ${p.totalKills.toLocaleString('fr')} kills` : 'Aucune run pour l\'instant';
      const tunas = `<span class="acc-tunas">${TUNAS_ICON}${p.tunas.toLocaleString('fr')}</span>`;
      el.innerHTML = account
        ? `${account.avatarUrl ? `<img class="acc-ava" src="${esc(account.avatarUrl)}" alt="">` : `<span class="acc-ava"></span>`}<div class="acc-txt"><span class="acc-name">${esc(account.name)} ${tunas}</span><span class="acc-stats">${stats}</span></div><div class="acc-btns"><button class="acc-btn out">Se déconnecter</button></div>`
        : `<div class="acc-txt"><span class="acc-name">Invité ${tunas}</span><span class="acc-stats">${stats}, sur ce navigateur</span></div>${guestBtns ? `<div class="acc-btns">${guestBtns}</div>` : ''}`;
      if (error) el.insertAdjacentHTML('beforeend', `<div class="acc-err">Connexion : ${esc(error)}</div>`);
      error = null;
      const redraw = () => this.update(online, account, p, canLogin, canEmail);
      for (const b of el.querySelectorAll<HTMLElement>('button, input')) b.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter' || b.tagName === 'INPUT') e.stopPropagation(); });
      const main = el.querySelector<HTMLButtonElement>('.acc-btn:not(.mail)');
      main?.addEventListener('click', (e) => { e.stopPropagation(); (account ? cb.logout : cb.login)(); });
      el.querySelector('.acc-mail-open')?.addEventListener('click', (e) => {
        e.stopPropagation();
        mailOpen = true;
        redraw();
        el.querySelector<HTMLInputElement>('input[name=name]')?.focus();
      });
      const form = el.querySelector<HTMLFormElement>('.acc-mail-form');
      const field = (n: string) => (form?.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '';
      form?.addEventListener('input', () => { draft = { email: field('email'), name: field('name') }; });
      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const send = form.querySelector<HTMLButtonElement>('button')!;
        send.disabled = true;
        const why = await cb.emailLink(draft.email.trim(), draft.name.trim());
        if (why) { error = why; send.disabled = false; redraw(); return; }
        mailSent = draft.email.trim();
        mailOpen = false;
        redraw();
      });
    },
  };
}
