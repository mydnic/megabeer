import { AUDIO } from '../config/audio';
import type { VehicleId } from '../config/vehicles';
import type { AudioEngine } from './audio';

/**
 * Bruit de moteur du véhicule conduit, synthétisé (aucun échantillon de moteur dans les packs) : deux dents de scie
 * légèrement désaccordées, un filtre passe-bas, un ronflement lent. Le régime monte avec la vitesse.
 */
export function createVehicleEngine(audio: AudioEngine) {
  const E = AUDIO.engine;
  let nodes: { a: OscillatorNode; b: OscillatorNode; lfo: OscillatorNode; filter: BiquadFilterNode; gain: GainNode; base: number; cutoff: number } | null = null;

  const stop = () => {
    const ctx = audio.ctx;
    if (!nodes || !ctx) { nodes = null; return; }
    const n = nodes, t = ctx.currentTime;
    n.gain.gain.cancelScheduledValues(t);
    n.gain.gain.setTargetAtTime(0, t, E.fade / 3);
    for (const o of [n.a, n.b, n.lfo]) o.stop(t + E.fade);
    nodes = null;
  };

  return {
    /** Démarre le moteur du véhicule `kind`. */
    start(kind: VehicleId) {
      stop();
      const ctx = audio.ctx;
      if (!ctx || !audio.sfx) return;
      const V = E.vehicles[kind], t = ctx.currentTime;
      const a = ctx.createOscillator(), b = ctx.createOscillator();
      a.type = b.type = 'sawtooth';
      a.frequency.value = V.base;
      b.frequency.value = V.base * E.detune;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = V.cutoff;
      filter.Q.value = 2;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.setTargetAtTime(E.volume, t, 0.1);
      // Ronflement : le volume tremble à quelques battements par seconde
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.frequency.value = E.rumble;
      depth.gain.value = E.volume * 0.35;
      lfo.connect(depth).connect(gain.gain);
      a.connect(filter); b.connect(filter);
      filter.connect(gain).connect(audio.sfx);
      a.start(t); b.start(t); lfo.start(t);
      nodes = { a, b, lfo, filter, gain, base: V.base, cutoff: V.cutoff };
    },
    /** Chaque pas : `speedRatio` = vitesse / vitesse max (0 à 1), le régime et le filtre suivent. */
    update(speedRatio: number) {
      const ctx = audio.ctx;
      if (!nodes || !ctx) return;
      const t = ctx.currentTime, k = 1 + E.rev * Math.min(1, Math.max(0, speedRatio));
      nodes.a.frequency.setTargetAtTime(nodes.base * k, t, E.smooth);
      nodes.b.frequency.setTargetAtTime(nodes.base * E.detune * k, t, E.smooth);
      nodes.filter.frequency.setTargetAtTime(nodes.cutoff * (0.8 + 0.6 * (k - 1)), t, E.smooth);
    },
    stop,
  };
}
