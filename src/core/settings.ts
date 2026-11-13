import { AUDIO } from '../config/audio';

/** Réglages du joueur, gardés dans le navigateur (localStorage) d'une partie à l'autre. */
export type VolumeChannel = 'music' | 'fx' | 'ui';
/**
 * Graphismes : `quality` auto (léger sur écran tactile, complet sinon), léger ou complet (pris en compte au chargement
 * de la page) ; `shadows` auto (coupées en rendu léger : elles font planter certaines puces de téléphone), oui ou non.
 */
export type Quality = 'auto' | 'leger' | 'complet';
export type ShadowChoice = 'auto' | 'oui' | 'non';
export interface Settings { volume: Record<VolumeChannel, number>; quality: Quality; shadows: ShadowChoice }

const KEY = 'megabeer.settings';
const QUALITIES: readonly Quality[] = ['auto', 'leger', 'complet'];
const SHADOWS: readonly ShadowChoice[] = ['auto', 'oui', 'non'];

export function loadSettings(): Settings {
  const s: Settings = { volume: { ...AUDIO.userVolume }, quality: 'auto', shadows: 'auto' };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    for (const k of Object.keys(s.volume) as VolumeChannel[]) {
      const v = saved.volume?.[k];
      if (typeof v === 'number' && v >= 0 && v <= 1) s.volume[k] = v;
    }
    if (saved.quality && QUALITIES.includes(saved.quality)) s.quality = saved.quality;
    if (saved.shadows && SHADOWS.includes(saved.shadows)) s.shadows = saved.shadows;
  } catch { /* stockage indisponible : réglages par défaut */ }
  return s;
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* stockage indisponible */ }
}
