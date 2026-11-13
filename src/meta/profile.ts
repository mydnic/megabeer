import { DIFFICULTIES, type DifficultyId } from '../config/spawn';
import { ACHIEVEMENTS } from '../config/achievements';

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
  /** TUNAS à dépenser (boutique). */
  tunas: number;
  /** TUNAS gagnés depuis le début (dépensés compris). */
  totalTunas: number;
  /** Achats de la boutique (`item:<id>`, `weapon:<id>`, `character:<id>`, voir meta/shop.ts). */
  unlocks: string[];
  /** Skill tree : paliers achetés par ligne (id de la ligne -> nombre de paliers, voir meta/skills.ts). */
  skills: Record<string, number>;
  /** Succès gagnés (ids de config/achievements.ts). */
  achievements: string[];
  /** Difficultés ouvertes (Sobre d'office ; la suivante s'ouvre en tuant l'Abbé dans la précédente). */
  difficulties: DifficultyId[];
  /** Dernière modification (ms depuis 1970) : la plus récente gagne entre deux appareils. */
  updatedAt: number;
};

export const emptyProfile = (): Profile => ({ version: PROFILE_VERSION, runs: 0, bestTime: 0, totalKills: 0, tunas: 0, totalTunas: 0, unlocks: [], skills: {}, achievements: [], difficulties: ['sobre'], updatedAt: 0 });

const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

/** Relit un profil venu du stockage ou du réseau : champs manquants ou faux remis à zéro, jamais d'exception. */
export function readProfile(raw: unknown): Profile {
  const p = emptyProfile();
  if (!raw || typeof raw !== 'object') return p;
  const r = raw as Record<string, unknown>;
  p.runs = Math.floor(count(r.runs));
  p.bestTime = count(r.bestTime);
  p.totalKills = Math.floor(count(r.totalKills));
  p.tunas = Math.floor(count(r.tunas));
  p.totalTunas = Math.max(p.tunas, Math.floor(count(r.totalTunas)));
  p.unlocks = Array.isArray(r.unlocks) ? [...new Set(r.unlocks.filter((u): u is string => typeof u === 'string'))] : [];
  if (r.skills && typeof r.skills === 'object') {
    for (const [k, v] of Object.entries(r.skills as Record<string, unknown>)) if (typeof v === 'number' && v > 0) p.skills[k] = Math.floor(v);
  }
  if (Array.isArray(r.achievements)) p.achievements = ACHIEVEMENTS.map((a) => a.id).filter((id) => (r.achievements as unknown[]).includes(id));
  if (Array.isArray(r.difficulties)) p.difficulties = ORDER.filter((d) => d === 'sobre' || (r.difficulties as unknown[]).includes(d));
  p.updatedAt = count(r.updatedAt);
  return p;
}

const ORDER = Object.keys(DIFFICULTIES) as DifficultyId[];

/**
 * Le profil après une run terminée : ses TUNAS (liasses et bonus de fin) rejoignent la réserve ; l'Abbé tué ouvre la
 * difficulté suivante ; chaque succès nouveau est gardé et rapporte ses TUNAS.
 */
export function recordRun(p: Profile, run: { survived: number; kills: number; tunas: number; difficulty?: DifficultyId; abbe?: boolean; achievements?: readonly string[] }, now: number): Profile {
  const fresh = ACHIEVEMENTS.filter((a) => run.achievements?.includes(a.id) && !p.achievements.includes(a.id));
  const won = Math.max(0, Math.floor(run.tunas)) + fresh.reduce((s, a) => s + a.tunas, 0);
  const next = run.abbe && run.difficulty ? ORDER[ORDER.indexOf(run.difficulty) + 1] : undefined;
  return {
    ...p,
    difficulties: next && !p.difficulties.includes(next) ? ORDER.filter((d) => p.difficulties.includes(d) || d === next) : p.difficulties,
    achievements: [...p.achievements, ...fresh.map((a) => a.id)],
    runs: p.runs + 1,
    bestTime: Math.max(p.bestTime, run.survived),
    totalKills: p.totalKills + run.kills,
    tunas: p.tunas + won,
    totalTunas: p.totalTunas + won,
    updatedAt: now,
  };
}

/**
 * Première connexion depuis un navigateur où l'on a joué en invité : la progression invitée rejoint celle du compte
 * (runs, kills et TUNAS additionnés, meilleur temps gardé, achats réunis), rien n'est perdu.
 */
export function mergeProfiles(account: Profile, guest: Profile, now: number): Profile {
  return {
    version: PROFILE_VERSION,
    runs: account.runs + guest.runs,
    bestTime: Math.max(account.bestTime, guest.bestTime),
    totalKills: account.totalKills + guest.totalKills,
    tunas: account.tunas + guest.tunas,
    totalTunas: account.totalTunas + guest.totalTunas,
    unlocks: [...new Set([...account.unlocks, ...guest.unlocks])],
    difficulties: ORDER.filter((d) => account.difficulties.includes(d) || guest.difficulties.includes(d)),
    achievements: ACHIEVEMENTS.map((a) => a.id).filter((id) => account.achievements.includes(id) || guest.achievements.includes(id)),
    skills: Object.fromEntries([...new Set([...Object.keys(account.skills), ...Object.keys(guest.skills)])].map((k) => [k, Math.max(account.skills[k] ?? 0, guest.skills[k] ?? 0)])),
    updatedAt: now,
  };
}

/** Un profil vide (jamais joué) : rien à rattacher. */
export const isEmpty = (p: Profile) => p.runs === 0 && p.totalKills === 0 && p.tunas === 0 && p.unlocks.length === 0 && !Object.keys(p.skills).length && !p.achievements.length;
