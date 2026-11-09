import { AUDIO as A } from '../config/audio';
import type { AudioEngine } from './audio';

/**
 * Ambiances synthétisées (aucun fichier) : vent permanent qui souffle par rafales, oiseaux le jour,
 * chouette la nuit. Le mélange suit le facteur jour/nuit sous le joueur. Seulement pendant une partie :
 * sur l'écran d'accueil, la planète n'est pas chargée, l'ambiance est coupée (fondu).
 */
export function createAmbience(audio: AudioEngine) {
  let day = 1;
  let started = false;
  let dayBus: GainNode | undefined, nightBus: GainNode | undefined, bus: GainNode | undefined;
  let nextBird = 0, nextOwl = 0;

  audio.onStart((a) => {
    const ctx = a.ctx!;
    // Bus de l'ambiance : coupé hors partie, en fondu
    bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(a.ambience!);
    const out = bus;
    // --- Vent : bruit blanc filtré, rafales lentes
    const wind = ctx.createBufferSource();
    wind.buffer = a.noiseBuffer!;
    wind.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const wg = ctx.createGain();
    wg.gain.value = A.wind.volume;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = A.wind.volume * 0.6;
    lfo.connect(lfoGain).connect(wg.gain);
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.11;
    const lfo2Gain = ctx.createGain();
    lfo2Gain.gain.value = 160;
    lfo2.connect(lfo2Gain).connect(lp.frequency);
    wind.connect(lp).connect(wg).connect(out);
    wind.start(); lfo.start(); lfo2.start();

    dayBus = ctx.createGain();
    dayBus.connect(out);
    nightBus = ctx.createGain();
    nightBus.connect(out);

    started = true;
  });

  /** Gazouillis : 2 à 5 notes rapides qui glissent. */
  function bird(a: AudioEngine) {
    const ctx = a.ctx!;
    const t = ctx.currentTime;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(dayBus!);
    const base = 2400 + Math.random() * 1800;
    const notes = 2 + Math.floor(Math.random() * 4);
    for (let k = 0; k < notes; k++) {
      const t0 = t + k * (0.09 + Math.random() * 0.05);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const f = base * (0.85 + Math.random() * 0.4);
      o.frequency.setValueAtTime(f, t0);
      o.frequency.exponentialRampToValueAtTime(f * (Math.random() < 0.5 ? 1.35 : 0.75), t0 + 0.07);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(A.birds.volume, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
      o.connect(g).connect(pan);
      o.start(t0);
      o.stop(t0 + 0.1);
    }
  }

  /** Chouette : « hou... hou-hou » grave avec un léger vibrato. */
  function owl(a: AudioEngine) {
    const ctx = a.ctx!;
    const t = ctx.currentTime;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.4 - 0.7;
    pan.connect(nightBus!);
    [[0, 0.5], [0.75, 0.22], [1.05, 0.55]].forEach(([dt, len]) => {
      const t0 = t + dt;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(390, t0);
      o.frequency.linearRampToValueAtTime(350, t0 + len);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(A.owl.volume, t0 + 0.06);
      g.gain.setValueAtTime(A.owl.volume, t0 + len - 0.08);
      g.gain.linearRampToValueAtTime(0, t0 + len);
      o.connect(g).connect(pan);
      o.start(t0);
      o.stop(t0 + len + 0.05);
    });
  }

  return {
    /** dayFactor : 1 en plein jour, 0 en pleine nuit ; inGame : une partie est en cours (sinon silence). */
    update(dayFactor: number, inGame: boolean) {
      day = dayFactor;
      if (!started || !audio.ctx) return;
      const t = audio.ctx.currentTime;
      bus!.gain.setTargetAtTime(inGame ? 1 : 0, t, A.ambienceFade);
      if (!inGame) return;
      dayBus!.gain.setTargetAtTime(day, t, 0.5);
      nightBus!.gain.setTargetAtTime(1 - day, t, 0.5);
      if (t > nextBird) {
        nextBird = t + A.birds.everyMin + Math.random() * (A.birds.everyMax - A.birds.everyMin);
        if (day > 0.3) bird(audio);
      }
      if (t > nextOwl) {
        nextOwl = t + A.owl.everyMin + Math.random() * (A.owl.everyMax - A.owl.everyMin);
        if (day < 0.3) owl(audio);
      }
    },
  };
}
