import { AUDIO as A } from '../config/audio';
import type { AudioEngine } from './audio';

const urls = import.meta.glob('../assets/music/**/*.{mp3,ogg}', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const urlOf = (file: string) => Object.entries(urls).find(([p]) => p.endsWith('/' + file))?.[1];
/** Morceaux d'un dossier de src/assets/music/ (ex. "abbaye", "boss/abbe") : il suffit d'y déposer un fichier. */
const tracksIn = (folder: string) => Object.entries(urls).filter(([p]) => p.includes(`/music/${folder}/`)).map(([, u]) => u);
const randomOf = (list: string[]) => (list.length ? list[Math.floor(Math.random() * list.length)] : undefined);

/**
 * Musique avec fondu enchaîné entre morceaux. Lecture en streaming (éléments <audio> branchés sur le
 * bus musique), pour ne pas décoder des fichiers de plusieurs minutes. Chaque morceau tourne en boucle.
 * - Menu (accueil) : le morceau du menu.
 * - Run : UN morceau tiré au hasard dans music/<map>/ au début de la run, jusqu'à la fin de la run.
 * - Boss (ou élite spécial) : à son apparition, un morceau tiré au hasard dans music/boss/<id>/
 *   (music/boss/default/ si ce dossier n'existe pas ou est vide), par-dessus la run ; à sa mort, la
 *   musique de la run reprend.
 */
export function createMusic(audio: AudioEngine) {
  const M = A.music;
  let runTrack: string | undefined; // url du morceau de la run en cours
  let bossTrack: string | undefined; // url du morceau du boss en cours
  let current: { el: HTMLAudioElement; gain: GainNode } | undefined;

  function play(url: string | undefined) {
    const ctx = audio.ctx!;
    if (!url) return;
    const el = new Audio(url);
    el.loop = true;
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

  /** Joue ce qui doit l'être maintenant : boss, sinon run, sinon menu. */
  function refresh() {
    if (audio.ctx) play(bossTrack ?? runTrack ?? urlOf(M.menu));
  }

  audio.onStart(() => refresh());

  return {
    /** Un boss est-il en cours (musique de boss) ? */
    get boss() { return bossTrack !== undefined; },
    /** Début de run : tire un morceau du dossier de la map (sinon garde la musique du menu). */
    startRun(map: string) {
      runTrack = randomOf(tracksIn(map));
      bossTrack = undefined;
      refresh();
    },
    /** Fin de run (retour à l'accueil) : retour à la musique du menu. */
    endRun() {
      runTrack = undefined;
      bossTrack = undefined;
      refresh();
    },
    /** Apparition d'un boss ou élite spécial : un morceau de son dossier, au hasard. */
    startBoss(id: string) {
      const own = tracksIn(`boss/${id}`);
      bossTrack = randomOf(own.length ? own : tracksIn('boss/default'));
      if (bossTrack) refresh();
    },
    /** Mort du boss : la musique de la run reprend. */
    endBoss() {
      if (!bossTrack) return;
      bossTrack = undefined;
      refresh();
    },
  };
}
