import { emptyProfile, isEmpty, mergeProfiles, readProfile, recordRun, type Profile } from '../meta/profile';
import { buy } from '../meta/shop';
import { buySkill } from '../meta/skills';
import { DIFFICULTIES, type DifficultyId } from '../config/spawn';

const DIFF_KEY = 'megabeer.difficulty';

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
    async recordRun(run: { survived: number; kills: number; tunas: number; difficulty: DifficultyId; abbe: boolean; achievements: readonly string[] }) {
      profile = recordRun(profile, run, Date.now());
      changed();
      await save();
    },

    /** Achat en boutique : les TUNAS sont retirés et l'article débloqué, sauvegardé tout de suite. Faux si impossible. */
    buy(key: string) {
      const next = buy(profile, key, Date.now());
      if (!next) return false;
      profile = next;
      changed();
      void save();
      return true;
    },

    /** Difficulté choisie sur l'accueil (gardée dans le navigateur). */
    get difficulty(): DifficultyId {
      try { const d = localStorage.getItem(DIFF_KEY) as DifficultyId | null; return d && d in DIFFICULTIES ? d : 'sobre'; } catch { return 'sobre'; }
    },
    set difficulty(d: DifficultyId) { try { localStorage.setItem(DIFF_KEY, d); } catch { /* stockage indisponible */ } },

    /** Outils de dev : des TUNAS en plus, pour tester la boutique. */
    devAddTunas(n: number) {
      profile = { ...profile, tunas: profile.tunas + n, totalTunas: profile.totalTunas + n, updatedAt: Date.now() };
      changed();
      void save();
    },

    /** Achat du palier suivant d'une ligne du skill tree, sauvegardé tout de suite. Faux si impossible. */
    buySkill(line: string) {
      const next = buySkill(profile, line, Date.now());
      if (!next) return false;
      profile = next;
      changed();
      void save();
      return true;
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
