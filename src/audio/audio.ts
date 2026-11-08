import { AUDIO as A } from '../config/audio';
import type { VolumeChannel } from '../core/settings';

const sampleUrls = import.meta.glob(['../assets/kenney-impact-sounds/**/*.ogg', '../assets/sfx/*.{wav,ogg,mp3}'], {
  query: '?url', import: 'default', eager: true,
}) as Record<string, string>;

/**
 * Moteur audio (Web Audio) : bus effets et ambiance, échantillons Kenney chargés à la demande,
 * variations de hauteur pour éviter la répétition. Le contexte audio ne démarre qu'après un premier
 * geste du joueur (règle des navigateurs).
 */
export class AudioEngine {
  ctx?: AudioContext;
  sfx?: GainNode;
  ambience?: GainNode;
  music?: GainNode;
  ui?: GainNode;
  /** Volumes du joueur (Options), un gain par canal entre les bus et la sortie. */
  private user: Record<VolumeChannel, number> = { ...A.userVolume };
  private userGain = new Map<VolumeChannel, GainNode>();
  private buffers = new Map<string, AudioBuffer[]>();
  private lastVariant = new Map<string, number>();
  private noise?: AudioBuffer;
  private startCallbacks: ((a: AudioEngine) => void)[] = [];

  constructor() {
    const start = () => {
      if (this.ctx) { void this.ctx.resume(); return; }
      this.init();
    };
    addEventListener('pointerdown', start);
    addEventListener('keydown', start);
  }

  /** Appelé une fois le contexte audio démarré (ambiances). */
  onStart(cb: (a: AudioEngine) => void) {
    if (this.ctx) cb(this);
    else this.startCallbacks.push(cb);
  }

  private init() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = A.master;
    master.connect(ctx.destination);
    for (const ch of ['music', 'fx', 'ui'] as const) {
      const g = ctx.createGain();
      g.gain.value = this.user[ch];
      g.connect(master);
      this.userGain.set(ch, g);
    }
    this.sfx = ctx.createGain();
    this.sfx.gain.value = A.sfx;
    this.sfx.connect(this.userGain.get('fx')!);
    this.ambience = ctx.createGain();
    this.ambience.gain.value = A.ambience;
    this.ambience.connect(this.userGain.get('fx')!);
    this.music = ctx.createGain();
    this.music.gain.value = A.music.volume;
    this.music.connect(this.userGain.get('music')!);
    this.ui = ctx.createGain();
    this.ui.gain.value = A.ui;
    this.ui.connect(this.userGain.get('ui')!);
    // Bruit blanc réutilisable (vent, souffle du saut)
    const n = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = n;
    void this.loadAll();
    for (const cb of this.startCallbacks) cb(this);
    this.startCallbacks.length = 0;
  }

  private async loadAll() {
    const ctx = this.ctx!;
    await Promise.all(Object.entries(sampleUrls).map(async ([path, url]) => {
      const file = path.split('/').pop()!;
      const group = file.replace(/(_\d+)?\.(ogg|wav|mp3)$/, '');
      try {
        const buf = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
        if (!this.buffers.has(group)) this.buffers.set(group, []);
        this.buffers.get(group)!.push(buf);
      } catch { /* son illisible : ignoré */ }
    }));
  }

  get noiseBuffer() { return this.noise; }

  /** Volume du joueur pour un canal (0 à 1), appliqué tout de suite si l'audio tourne. */
  setUserVolume(ch: VolumeChannel, v: number) {
    this.user[ch] = v;
    const g = this.userGain.get(ch);
    if (g && this.ctx) g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03);
  }

  /** Joue une variante au hasard du groupe (sans répéter la précédente), sur le bus effets ou interface. */
  play(group: string, volume: number, rate = 1, pan = 0, bus: 'fx' | 'ui' = 'fx') {
    const ctx = this.ctx, list = this.buffers.get(group);
    const out = bus === 'ui' ? this.ui : this.sfx;
    if (!ctx || !list?.length || !out) return;
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === this.lastVariant.get(group)) i = (i + 1) % list.length;
    this.lastVariant.set(group, i);
    const src = ctx.createBufferSource();
    src.buffer = list[i];
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = volume;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(g).connect(p).connect(out);
    src.start();
  }

  /**
   * Coup de cloche d'église synthétisé : partiels d'une cloche (bourdon, fondamentale, tierce mineure,
   * quinte, nominale...) qui s'éteignent plus ou moins vite, un choc métallique à l'attaque, et une
   * réverbération de nef. `pitch` : fondamentale (Hz).
   */
  bell(volume: number, pitch: number, reverb: number) {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.sfx) return;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = volume;
    // Réverbération : réponse impulsionnelle de bruit qui décroît (calculée une fois)
    if (!this.nave || this.nave.duration !== reverb) {
      const len = Math.floor(ctx.sampleRate * reverb);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      }
      this.nave = ir;
    }
    const conv = ctx.createConvolver();
    conv.buffer = this.nave;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    out.connect(this.sfx);
    out.connect(conv).connect(wet).connect(this.sfx);
    // Partiels : rapport à la fondamentale, amplitude, durée d'extinction (s)
    const partials: [number, number, number][] = [
      [0.5, 0.5, 6], [1, 0.45, 4.5], [1.19, 0.35, 3.5], [1.5, 0.18, 2.5], [2, 0.35, 3],
      [2.51, 0.15, 1.8], [2.66, 0.12, 1.5], [3.01, 0.1, 1.2], [4.07, 0.06, 0.8],
    ];
    for (const [ratio, amp, decay] of partials) {
      // Deux oscillateurs à peine désaccordés : le battement qui fait « vivre » la cloche
      for (const detune of [-1.5, 1.5]) {
        const o = ctx.createOscillator();
        o.frequency.value = pitch * ratio;
        o.detune.value = detune;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp * 0.5, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + decay + 0.05);
      }
    }
    // Choc du battant
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = pitch * 6;
    f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random(), 0.1);
  }

  private nave?: AudioBuffer;

  /** Petit souffle d'impulsion au saut. */
  whoosh(volume: number) {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.sfx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(1400, t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, Math.random() * 1.5, 0.25);
  }
}
