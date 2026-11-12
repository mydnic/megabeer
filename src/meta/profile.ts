// Progression du joueur d'une run à l'autre (GDD section 14) : ce qui est sauvegardé, dans le navigateur pour un invité,
// en ligne pour un compte Discord. Pur : ni navigateur ni réseau, testé tel quel.

/** Version du format : à monter quand un champ change de sens, avec sa migration dans `readProfile`. */
export const PROFILE_VERSION = 1;

export type Profile = {
  version: number;
  /** Runs terminées (mort ou abandon). */
  runs: number;
  /** Plus long temps survécu (s). */
  bestTime: number;
  /** Ennemis tués, toutes runs confondues. */
  totalKills: number;
  /** Dernière modification (ms depuis 1970) : la plus récente gagne entre deux appareils. */
  updatedAt: number;
};

export const emptyProfile = (): Profile => ({ version: PROFILE_VERSION, runs: 0, bestTime: 0, totalKills: 0, updatedAt: 0 });

const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

/** Relit un profil venu du stockage ou du réseau : champs manquants ou faux remis à zéro, jamais d'exception. */
export function readProfile(raw: unknown): Profile {
  const p = emptyProfile();
  if (!raw || typeof raw !== 'object') return p;
  const r = raw as Record<string, unknown>;
  p.runs = Math.floor(count(r.runs));
  p.bestTime = count(r.bestTime);
  p.totalKills = Math.floor(count(r.totalKills));
  p.updatedAt = count(r.updatedAt);
  return p;
}

/** Le profil après une run terminée. */
export function recordRun(p: Profile, run: { survived: number; kills: number }, now: number): Profile {
  return {
    ...p,
    runs: p.runs + 1,
    bestTime: Math.max(p.bestTime, run.survived),
    totalKills: p.totalKills + run.kills,
    updatedAt: now,
  };
}

/**
 * Première connexion depuis un navigateur où l'on a joué en invité : la progression invitée rejoint celle du compte
 * (runs et kills additionnés, meilleur temps gardé), rien n'est perdu.
 */
export function mergeProfiles(account: Profile, guest: Profile, now: number): Profile {
  return {
    version: PROFILE_VERSION,
    runs: account.runs + guest.runs,
    bestTime: Math.max(account.bestTime, guest.bestTime),
    totalKills: account.totalKills + guest.totalKills,
    updatedAt: now,
  };
}

/** Un profil vide (jamais joué) : rien à rattacher. */
export const isEmpty = (p: Profile) => p.runs === 0 && p.totalKills === 0;
