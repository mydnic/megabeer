import { AUDIO as A } from '../config/audio';
import type { AudioEngine } from './audio';

const urls = import.meta.glob('../assets/music/*.mp3', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const urlOf = (file: string) => Object.entries(urls).find(([p]) => p.endsWith('/' + file))?.[1];

/**
 * Musique : enchaîne les morceaux de la playlist (config) en fondu enchaîné. Lecture en streaming
 * (éléments <audio> branchés sur le bus musique), pour ne pas décoder des fichiers de plusieurs minutes.
 */
export function createMusic(audio: AudioEngine) {
  const M = A.music;
  let index = 0;
  let current: { el: HTMLAudioElement; gain: GainNode } | undefined;

  function play(i: number) {
    const ctx = audio.ctx!;
    const url = urlOf(M.playlist[i % M.playlist.length]);
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
    index = i;
  }

  audio.onStart(() => play(0));

  return {
    update() {
      const el = current?.el;
      // Fondu vers le morceau suivant un peu avant la fin
      if (el && el.duration && el.currentTime > el.duration - M.fade) play(index + 1);
    },
  };
}
