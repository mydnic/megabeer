import { AUDIO as A } from '../config/audio';
import type { AudioEngine } from './audio';

const urls = import.meta.glob('../assets/music/**/*.{mp3,ogg}', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const urlOf = (file: string) => Object.entries(urls).find(([p]) => p.endsWith('/' + file))?.[1];
/** Morceaux du dossier d'une map (src/assets/music/<map>/) : il suffit d'y déposer un fichier. */
const mapTracks = (map: string) => Object.entries(urls).filter(([p]) => p.includes(`/music/${map}/`)).map(([, u]) => u);

export type MusicMode = 'explore' | 'combat';

/**
 * Musique avec fondu enchaîné entre morceaux. Lecture en streaming (éléments <audio> branchés sur le
 * bus musique), pour ne pas décoder des fichiers de plusieurs minutes.
 * - Menu (accueil) : le morceau du menu, en boucle.
 * - Run : UN morceau tiré au hasard dans le dossier de la map au début de la run, joué en boucle
 *   jusqu'à la fin de la run.
 * - Combat (vague d'ennemis, boss) : la liste combat, par-dessus le reste.
 */
export function createMusic(audio: AudioEngine) {
  const M = A.music;
  let mode: MusicMode = 'explore';
  let lastCombat = -1;
  let runTrack: string | undefined; // url du morceau de la run en cours
  let current: { el: HTMLAudioElement; gain: GainNode } | undefined;

  function play(url: string | undefined, loop = false) {
    const ctx = audio.ctx!;
    if (!url) return;
    const el = new Audio(url);
    el.loop = loop;
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
      play(urlOf(M.combat[lastCombat]));
    } else {
      play(runTrack ?? urlOf(M.menu), true);
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
    /** Début de run : tire un morceau du dossier de la map (sinon garde la musique du menu). */
    startRun(map: string) {
      const list = mapTracks(map);
      runTrack = list.length ? list[Math.floor(Math.random() * list.length)] : undefined;
      mode = 'explore';
      if (audio.ctx && runTrack) next();
    },
    /** Fin de run (retour à l'accueil) : retour à la musique du menu. */
    endRun() {
      if (!runTrack) return;
      runTrack = undefined;
      mode = 'explore';
      if (audio.ctx) next();
    },
    update() {
      const el = current?.el;
      // Fondu vers le morceau suivant un peu avant la fin (sauf morceau en boucle)
      if (el && !el.loop && el.duration && el.currentTime > el.duration - M.fade) next();
    },
  };
}
