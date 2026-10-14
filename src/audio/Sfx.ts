// Efeitos sonoros sintetizados em tempo real (estilo chip 16-bit), sem arquivos.

type Wave = OscillatorType | 'noise';

interface Tone {
  wave: Wave;
  f0: number;        // frequência inicial
  f1?: number;       // frequência final (slide)
  dur: number;
  vol?: number;
  delay?: number;
  attack?: number;
  filter?: number;   // passa-baixa
}

class SfxEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  volume = 0.7;
  noiseBuf: AudioBuffer | null = null;
  lastPlay: Record<string, number> = {};

  private ensure() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume * 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  unlock() { this.ensure(); }

  /** Contexto de áudio compartilhado (usado também pelos sons ambientes) */
  context() { return this.ensure(); }

  noise() { this.ensure(); return this.noiseBuf!; }

  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.value = v * 0.5;
  }

  private tone(t: Tone) {
    const ctx = this.ensure();
    if (!this.master || this.volume <= 0) return;
    const start = ctx.currentTime + (t.delay ?? 0);
    const g = ctx.createGain();
    const vol = (t.vol ?? 0.3);
    const atk = t.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
    let node: AudioNode = g;
    if (t.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = t.filter;
      g.connect(f);
      node = f;
    }
    node.connect(this.master);
    if (t.wave === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.playbackRate.setValueAtTime(t.f0 / 1000, start);
      if (t.f1) src.playbackRate.exponentialRampToValueAtTime(Math.max(0.01, t.f1 / 1000), start + t.dur);
      src.connect(g);
      src.start(start);
      src.stop(start + t.dur + 0.05);
    } else {
      const osc = ctx.createOscillator();
      osc.type = t.wave;
      osc.frequency.setValueAtTime(t.f0, start);
      if (t.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, t.f1), start + t.dur);
      osc.connect(g);
      osc.start(start);
      osc.stop(start + t.dur + 0.05);
    }
  }

  /** Evita empilhar o mesmo som no mesmo instante */
  private gate(key: string, ms: number) {
    const now = performance.now();
    if ((this.lastPlay[key] ?? 0) + ms > now) return false;
    this.lastPlay[key] = now;
    return true;
  }

  play(name: SfxName) {
    if (!this.gate(name, 30)) return;
    const fn = SOUNDS[name];
    if (fn) fn((t) => this.tone(t));
  }

  /** Arpejo curto para jingles */
  jingle(notes: number[], step = 0.1, wave: Wave = 'square', vol = 0.18) {
    notes.forEach((n, i) => this.tone({ wave, f0: n, dur: step * 1.6, vol, delay: i * step }));
  }
}

type T = (t: Tone) => void;

const SOUNDS = {
  swing: (t: T) => t({ wave: 'noise', f0: 2500, f1: 600, dur: 0.12, vol: 0.18, filter: 3000 }),
  hit: (t: T) => { t({ wave: 'square', f0: 220, f1: 80, dur: 0.1, vol: 0.25 }); t({ wave: 'noise', f0: 1500, f1: 300, dur: 0.08, vol: 0.2 }); },
  crit: (t: T) => { t({ wave: 'square', f0: 880, f1: 220, dur: 0.15, vol: 0.2 }); t({ wave: 'noise', f0: 3000, f1: 400, dur: 0.12, vol: 0.25 }); },
  clang: (t: T) => { t({ wave: 'square', f0: 1400, f1: 1300, dur: 0.18, vol: 0.12 }); t({ wave: 'triangle', f0: 2100, dur: 0.2, vol: 0.1 }); },
  jump: (t: T) => t({ wave: 'square', f0: 260, f1: 520, dur: 0.1, vol: 0.12 }),
  land: (t: T) => t({ wave: 'noise', f0: 600, f1: 200, dur: 0.06, vol: 0.12, filter: 800 }),
  dash: (t: T) => { t({ wave: 'noise', f0: 800, f1: 4000, dur: 0.18, vol: 0.2, filter: 5000 }); t({ wave: 'sine', f0: 400, f1: 1200, dur: 0.15, vol: 0.1 }); },
  hurt: (t: T) => { t({ wave: 'sawtooth', f0: 400, f1: 60, dur: 0.3, vol: 0.25 }); t({ wave: 'noise', f0: 900, f1: 100, dur: 0.25, vol: 0.2 }); },
  dodge: (t: T) => { t({ wave: 'sine', f0: 1200, f1: 2400, dur: 0.15, vol: 0.15 }); t({ wave: 'sine', f0: 1800, f1: 3600, dur: 0.15, vol: 0.08, delay: 0.05 }); },
  healCharge: (t: T) => t({ wave: 'sine', f0: 300, f1: 900, dur: 0.6, vol: 0.08, attack: 0.2 }),
  heal: (t: T) => { [523, 659, 784, 1046].forEach((f, i) => t({ wave: 'triangle', f0: f, dur: 0.2, vol: 0.15, delay: i * 0.06 })); },
  scream: (t: T) => { t({ wave: 'sawtooth', f0: 180, f1: 90, dur: 0.6, vol: 0.25, filter: 1500 }); t({ wave: 'noise', f0: 400, f1: 2000, dur: 0.5, vol: 0.25, filter: 2500 }); t({ wave: 'square', f0: 90, f1: 45, dur: 0.6, vol: 0.15 }); },
  block: (t: T) => { t({ wave: 'triangle', f0: 1600, f1: 800, dur: 0.15, vol: 0.18 }); t({ wave: 'sine', f0: 2400, dur: 0.2, vol: 0.08 }); },
  enemyDie: (t: T) => { t({ wave: 'noise', f0: 1200, f1: 100, dur: 0.35, vol: 0.22 }); t({ wave: 'square', f0: 300, f1: 40, dur: 0.3, vol: 0.12 }); },
  spawn: (t: T) => t({ wave: 'sine', f0: 120, f1: 500, dur: 0.4, vol: 0.12, attack: 0.1 }),
  shoot: (t: T) => t({ wave: 'square', f0: 900, f1: 300, dur: 0.12, vol: 0.08 }),
  magic: (t: T) => { t({ wave: 'sine', f0: 600, f1: 1400, dur: 0.25, vol: 0.12 }); t({ wave: 'triangle', f0: 900, f1: 300, dur: 0.25, vol: 0.08, delay: 0.05 }); },
  charge: (t: T) => t({ wave: 'sawtooth', f0: 100, f1: 600, dur: 0.5, vol: 0.1, filter: 1200, attack: 0.2 }),
  boom: (t: T) => { t({ wave: 'noise', f0: 500, f1: 50, dur: 0.6, vol: 0.35, filter: 1200 }); t({ wave: 'sine', f0: 120, f1: 30, dur: 0.5, vol: 0.3 }); },
  laser: (t: T) => { t({ wave: 'sawtooth', f0: 1200, f1: 1100, dur: 0.4, vol: 0.12, filter: 3000 }); t({ wave: 'square', f0: 600, f1: 580, dur: 0.4, vol: 0.06 }); },
  bossRoar: (t: T) => { t({ wave: 'sawtooth', f0: 110, f1: 55, dur: 1.2, vol: 0.3, filter: 900, attack: 0.1 }); t({ wave: 'noise', f0: 300, f1: 80, dur: 1.1, vol: 0.25, filter: 700 }); },
  pickup: (t: T) => { t({ wave: 'square', f0: 988, dur: 0.07, vol: 0.12 }); t({ wave: 'square', f0: 1318, dur: 0.15, vol: 0.12, delay: 0.07 }); },
  shard: (t: T) => t({ wave: 'triangle', f0: 1760, f1: 2400, dur: 0.08, vol: 0.08 }),
  select: (t: T) => t({ wave: 'square', f0: 660, dur: 0.05, vol: 0.08 }),
  confirm: (t: T) => { t({ wave: 'square', f0: 660, dur: 0.06, vol: 0.1 }); t({ wave: 'square', f0: 990, dur: 0.1, vol: 0.1, delay: 0.06 }); },
  back: (t: T) => { t({ wave: 'square', f0: 500, dur: 0.06, vol: 0.08 }); t({ wave: 'square', f0: 330, dur: 0.1, vol: 0.08, delay: 0.06 }); },
  error: (t: T) => t({ wave: 'square', f0: 140, dur: 0.18, vol: 0.12 }),
  wave: (t: T) => { [392, 523, 659].forEach((f, i) => t({ wave: 'square', f0: f, dur: 0.15, vol: 0.1, delay: i * 0.08 })); },
  victory: (t: T) => { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => t({ wave: 'square', f0: f, dur: i === 5 ? 0.6 : 0.14, vol: 0.12, delay: i * 0.11 })); },
  defeat: (t: T) => { [392, 349, 311, 262].forEach((f, i) => t({ wave: 'triangle', f0: f, dur: i === 3 ? 0.9 : 0.25, vol: 0.18, delay: i * 0.25 })); },
  card: (t: T) => { t({ wave: 'noise', f0: 3000, f1: 1000, dur: 0.1, vol: 0.1, filter: 4000 }); t({ wave: 'triangle', f0: 1200, dur: 0.1, vol: 0.08, delay: 0.04 }); },
  amulet: (t: T) => { [659, 784, 988, 1318, 1568].forEach((f, i) => t({ wave: 'triangle', f0: f, dur: 0.3, vol: 0.12, delay: i * 0.07 })); },
  heartbeat: (t: T) => { t({ wave: 'sine', f0: 70, f1: 40, dur: 0.18, vol: 0.45 }); t({ wave: 'sine', f0: 62, f1: 38, dur: 0.22, vol: 0.35, delay: 0.22 }); },
  shatter: (t: T) => { [2637, 3136, 2349, 3520, 1975].forEach((f, i) => t({ wave: 'triangle', f0: f, f1: f * 0.7, dur: 0.25, vol: 0.09, delay: i * 0.035 })); t({ wave: 'noise', f0: 6000, f1: 2000, dur: 0.25, vol: 0.15 }); },
  whoosh: (t: T) => t({ wave: 'noise', f0: 300, f1: 2500, dur: 0.6, vol: 0.2, filter: 2000, attack: 0.25 }),
  sparkle: (t: T) => { [1568, 2093, 2637].forEach((f, i) => t({ wave: 'sine', f0: f, dur: 0.4, vol: 0.07, delay: i * 0.08 })); },
  bleed: (t: T) => t({ wave: 'noise', f0: 400, f1: 200, dur: 0.05, vol: 0.06, filter: 600 }),
};

export type SfxName = keyof typeof SOUNDS;

export const Sfx = new SfxEngine();
