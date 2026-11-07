import { AUDIO } from '../config/audio';

/** Réglages du joueur, gardés dans le navigateur (localStorage) d'une partie à l'autre. */
export type VolumeChannel = 'music' | 'fx' | 'ui';
export interface Settings { volume: Record<VolumeChannel, number> }

const KEY = 'megabeer.settings';

export function loadSettings(): Settings {
  const s: Settings = { volume: { ...AUDIO.userVolume } };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    for (const k of Object.keys(s.volume) as VolumeChannel[]) {
      const v = saved.volume?.[k];
      if (typeof v === 'number' && v >= 0 && v <= 1) s.volume[k] = v;
    }
  } catch { /* stockage indisponible : réglages par défaut */ }
  return s;
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* stockage indisponible */ }
}
