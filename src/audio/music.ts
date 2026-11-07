import { AUDIO as A } from '../config/audio';
import type { AudioEngine } from './audio';

const urls = import.meta.glob('../assets/music/*.mp3', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const urlOf = (file: string) => Object.entries(urls).find(([p]) => p.endsWith('/' + file))?.[1];

export type MusicMode = 'explore' | 'combat';

/**
 * Musique en deux modes, avec fondu enchaîné entre morceaux. Dans chaque mode, les morceaux sont
 * tirés au hasard dans leur liste, jamais le même deux fois de suite :
 * - exploration : la playlist ;
 * - combat (vague d'ennemis, boss) : la liste combat. Lecture en streaming
 * (éléments <audio> branchés sur le bus musique), pour ne pas décoder des fichiers de plusieurs minutes.
 */
export function createMusic(audio: AudioEngine) {
  const M = A.music;
  let mode: MusicMode = 'explore';
  let lastExplore = -1;
  let lastCombat = -1;
  let current: { el: HTMLAudioElement; gain: GainNode } | undefined;

  function play(file: string) {
    const ctx = audio.ctx!;
    const url = urlOf(file);
    if (!url) return;
    const el = new Audio(url);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    ctx.createMediaElementSource(el).connect(gain).connect(audio.music!);
    void el.play();
    const t = ctx.currentTime;
    gain.gain.linearRampToValueAtTime(1, t + M.fade);
    if (current) {
      const old = current;
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + M.fade);
      setTimeout(() => { old.el.pause(); old.gain.disconnect(); }, M.fade * 1000 + 100);
    }
    current = { el, gain };
  }

  /** Indice au hasard dans une liste, jamais le même que le précédent. */
  function pick(n: number, last: number) {
    let i = Math.floor(Math.random() * n);
    if (n > 1 && i === last) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
    return i;
  }

  function next() {
    if (mode === 'combat') {
      lastCombat = pick(M.combat.length, lastCombat);
      play(M.combat[lastCombat]);
    } else {
      lastExplore = pick(M.playlist.length, lastExplore);
      play(M.playlist[lastExplore]);
    }
  }

  audio.onStart(() => next());

  return {
    get mode() { return mode; },
    /** Passe en combat (vague, boss) ou revient à l'exploration ; sans effet si le mode ne change pas. */
    setMode(m: MusicMode) {
      if (m === mode) return;
      mode = m;
      if (audio.ctx) next();
    },
    update() {
      const el = current?.el;
      // Fondu vers le morceau suivant un peu avant la fin
      if (el && el.duration && el.currentTime > el.duration - M.fade) next();
    },
  };
}
