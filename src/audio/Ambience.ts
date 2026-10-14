import { Sfx } from './Sfx';

// Sons ambientes sintetizados em tempo real (sem arquivo), para telas sem música.
//  - map:    vento distante, um zumbido grave e sinos esparsos ao longe
//  - reward: acorde suave de santuário e cintilar de sinos de cristal

export type AmbienceId = 'map' | 'reward';

const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];

class AmbiencePlayer {
  volume = 0.5;
  kind: AmbienceId | null = null;
  private out: GainNode | null = null;
  private sources: Array<OscillatorNode | AudioBufferSourceNode> = [];
  private timer = 0;

  setVolume(v: number) {
    this.volume = v;
    const ctx = Sfx.context();
    if (this.out) this.out.gain.setTargetAtTime(this.level(), ctx.currentTime, 0.2);
  }

  private level() { return this.volume * 0.35; }

  start(kind: AmbienceId) {
    if (this.kind === kind) return;
    this.stop(400);
    const ctx = Sfx.context();
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.linearRampToValueAtTime(this.level(), ctx.currentTime + 2);
    out.connect(ctx.destination);
    this.out = out;
    this.kind = kind;
    if (kind === 'map') this.buildMap(ctx, out);
    else this.buildReward(ctx, out);
  }

  stop(fadeMs = 800) {
    window.clearTimeout(this.timer);
    const out = this.out, sources = this.sources;
    this.out = null;
    this.sources = [];
    this.kind = null;
    if (!out) return;
    const ctx = Sfx.context();
    out.gain.cancelScheduledValues(ctx.currentTime);
    out.gain.setValueAtTime(out.gain.value, ctx.currentTime);
    out.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fadeMs / 1000);
    window.setTimeout(() => {
      sources.forEach((s) => { try { s.stop(); } catch { /* já parado */ } });
      out.disconnect();
    }, fadeMs + 100);
  }

  // ---------------------------------------------------------------- mapa
  private buildMap(ctx: AudioContext, out: GainNode) {
    // vento: ruído filtrado com filtro e volume oscilando devagar
    const noise = ctx.createBufferSource();
    noise.buffer = Sfx.noise();
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 420;
    band.Q.value = 0.8;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.35;
    this.lfo(ctx, 0.07, 220, band.frequency);
    this.lfo(ctx, 0.11, 0.18, windGain.gain);
    noise.connect(band).connect(windGain).connect(out);
    noise.start();
    this.sources.push(noise);

    // zumbido grave
    for (const [f, v] of [[55, 0.12], [82.4, 0.07]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = v;
      o.connect(g).connect(out);
      o.start();
      this.sources.push(o);
    }

    // sinos distantes
    const bell = () => {
      if (this.kind !== 'map' || !this.out) return;
      const f = PENTA[Math.floor(Math.random() * 5)] / 2;
      this.chime(ctx, out, f, 0.08, 3.5);
      this.timer = window.setTimeout(bell, 4000 + Math.random() * 5000);
    };
    this.timer = window.setTimeout(bell, 2500);
  }

  // ---------------------------------------------------------------- recompensa
  private buildReward(ctx: AudioContext, out: GainNode) {
    // acorde de santuário (Dó maior com nona), com leve tremolo
    const pad = ctx.createGain();
    pad.gain.value = 0.16;
    this.lfo(ctx, 0.2, 0.05, pad.gain);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    pad.connect(lp).connect(out);
    for (const f of [130.81, 196, 261.63, 329.63, 587.33]) {
      for (const detune of [-4, 4]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = f > 400 ? 0.05 : 0.1;
        o.connect(g).connect(pad);
        o.start();
        this.sources.push(o);
      }
    }

    // cintilar de cristal
    const sparkle = () => {
      if (this.kind !== 'reward' || !this.out) return;
      const f = PENTA[Math.floor(Math.random() * PENTA.length)];
      this.chime(ctx, out, f, 0.06, 2.2);
      if (Math.random() < 0.4) this.chime(ctx, out, f * 1.5, 0.03, 1.8, 0.12);
      this.timer = window.setTimeout(sparkle, 1200 + Math.random() * 2200);
    };
    this.timer = window.setTimeout(sparkle, 800);
  }

  // ---------------------------------------------------------------- utilidades
  private chime(ctx: AudioContext, out: GainNode, freq: number, vol: number, decay: number, delay = 0) {
    const t = ctx.currentTime + delay;
    for (const [mult, v] of [[1, 1], [2.76, 0.3]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * v, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + decay + 0.1);
    }
  }

  private lfo(ctx: AudioContext, rate: number, depth: number, param: AudioParam) {
    const o = ctx.createOscillator();
    o.frequency.value = rate;
    const g = ctx.createGain();
    g.gain.value = depth;
    o.connect(g).connect(param);
    o.start();
    this.sources.push(o);
  }
}

export const Ambience = new AmbiencePlayer();
