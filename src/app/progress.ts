import { emptyProfile, isEmpty, mergeProfiles, readProfile, recordRun, type Profile } from '../meta/profile';

/** Joueur connecté (compte Discord), tel que le renvoie /api/me. */
export type Account = { id: string; name: string; avatarUrl: string };

const GUEST_KEY = 'megabeer.profile';

function readGuest(): Profile {
  try { return readProfile(JSON.parse(localStorage.getItem(GUEST_KEY) ?? 'null')); } catch { return emptyProfile(); }
}
function writeGuest(p: Profile | null) {
  try { if (p) localStorage.setItem(GUEST_KEY, JSON.stringify(p)); else localStorage.removeItem(GUEST_KEY); } catch { /* stockage indisponible */ }
}

async function api<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(path, { credentials: 'same-origin', ...init });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch { return null; }
}

/**
 * La progression du joueur côté navigateur : invité, elle reste dans le navigateur (localStorage) ; connecté avec
 * Discord, elle est sauvegardée en ligne (Worker /api, base D1). À la première connexion, la progression invitée de
 * ce navigateur rejoint celle du compte. Sans serveur (hébergement statique, hors ligne), le jeu reste en invité.
 */
export function createProgress() {
  let account: Account | null = null;
  let profile = readGuest();
  /** Le serveur des comptes répond (sinon : invité seulement, pas de bouton de connexion). */
  let online = false;
  /** La connexion Discord est configurée côté serveur. */
  let canLogin = false;
  const listeners: (() => void)[] = [];
  const changed = () => { for (const f of listeners) f(); };

  async function save() {
    if (!account) { writeGuest(profile); return; }
    const r = await api<{ ok: boolean }>('/api/save', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: profile }) });
    if (!r) console.warn('[progress] sauvegarde en ligne impossible, réessai à la prochaine run');
  }

  return {
    get account() { return account; },
    get profile() { return profile; },
    get online() { return online; },
    get canLogin() { return canLogin; },
    onChange(f: () => void) { listeners.push(f); },

    /** Au lancement : qui est connecté, et sa progression (avec la progression invitée rattachée la première fois). */
    async init() {
      const me = await api<{ user: Account | null; login: boolean }>('/api/me');
      online = me !== null;
      canLogin = !!me?.login;
      account = me?.user ?? null;
      if (account) {
        const remote = await api<{ save: { data: unknown } | null }>('/api/save');
        profile = readProfile(remote?.save?.data);
        const guest = readGuest();
        if (!isEmpty(guest)) {
          profile = mergeProfiles(profile, guest, Date.now());
          await save();
          writeGuest(null);
        }
      }
      changed();
    },

    /** Fin de run : elle compte dans la progression, sauvegardée tout de suite. */
    async recordRun(run: { survived: number; kills: number; tunas: number }) {
      profile = recordRun(profile, run, Date.now());
      changed();
      await save();
    },

    login() { location.href = '/api/auth/discord'; },
    async logout() {
      await api('/api/logout', { method: 'POST' });
      account = null;
      profile = readGuest();
      changed();
    },
  };
}

export type Progress = ReturnType<typeof createProgress>;
