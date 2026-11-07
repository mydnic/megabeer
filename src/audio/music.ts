import { AUDIO as A } from '../config/audio';
import type { AudioEngine } from './audio';

const urls = import.meta.glob('../assets/music/*.mp3', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const urlOf = (file: string) => Object.entries(urls).find(([p]) => p.endsWith('/' + file))?.[1];

export type MusicMode = 'explore' | 'combat';

/**
 * Musique en deux modes, avec fondu enchaîné entre morceaux :
 * - exploration : la playlist dans l'ordre, en boucle ;
 * - combat (vague d'ennemis, boss) : un morceau de combat au hasard (jamais le même deux fois de
 *   suite), puis un autre au hasard tant que le combat dure.
 * En quittant le combat, l'exploration reprend au morceau suivant. Lecture en streaming
 * (éléments <audio> branchés sur le bus musique), pour ne pas décoder des fichiers de plusieurs minutes.
 */
export function createMusic(audio: AudioEngine) {
  const M = A.music;
  let mode: MusicMode = 'explore';
  let exploreIndex = 0;
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

  function next() {
    if (mode === 'combat') {
      const list = M.combat;
      let i = Math.floor(Math.random() * list.length);
      if (list.length > 1 && i === lastCombat) i = (i + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
      lastCombat = i;
      play(list[i]);
    } else {
      play(M.playlist[exploreIndex % M.playlist.length]);
      exploreIndex++;
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
