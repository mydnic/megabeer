import { AUDIO as A } from '../config/audio';

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
    this.sfx = ctx.createGain();
    this.sfx.gain.value = A.sfx;
    this.sfx.connect(master);
    this.ambience = ctx.createGain();
    this.ambience.gain.value = A.ambience;
    this.ambience.connect(master);
    this.music = ctx.createGain();
    this.music.gain.value = A.music.volume;
    this.music.connect(master);
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

  /** Joue une variante au hasard du groupe (sans répéter la précédente). */
  play(group: string, volume: number, rate = 1, pan = 0) {
    const ctx = this.ctx, list = this.buffers.get(group);
    if (!ctx || !list?.length || !this.sfx) return;
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
    src.connect(g).connect(p).connect(this.sfx);
    src.start();
  }

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
