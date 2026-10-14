// Gerenciador de música. Cada faixa toca o arquivo feito no Suno em public/music/<id>.mp3;
// se não existir, usa a faixa mais próxima. Mapa e recompensa usam som ambiente (Ambience).
import { Ambience, type AmbienceId } from './Ambience';

export type TrackId =
  | 'menu' | 'story' | 'build' | 'ending'
  | 'world1' | 'world2' | 'world3'
  | 'boss1' | 'boss2' | 'boss3' | 'boss3_final';

const FALLBACK: Record<TrackId, string> = {
  menu: 'music/menu.mp3',
  story: 'music/menu.mp3',
  build: 'music/menu.mp3',
  ending: 'music/menu.mp3',
  world1: 'music/world1.mp3',
  world2: 'music/world1.mp3',
  world3: 'music/world1.mp3',
  boss1: 'music/boss1.mp3',
  boss2: 'music/boss1.mp3',
  boss3: 'music/boss1.mp3',
  boss3_final: 'music/boss1.mp3',
};

// Mixagem: durante as batalhas a música fica mais baixa para os efeitos sonoros aparecerem
const TRACK_GAIN: Record<TrackId, number> = {
  menu: 0.8, story: 0.8, build: 0.7, ending: 0.85,
  world1: 0.45, world2: 0.45, world3: 0.42,
  boss1: 0.5, boss2: 0.5, boss3: 0.5, boss3_final: 0.5,
};

class MusicPlayer {
  volume = 0.6;
  current: HTMLAudioElement | null = null;
  currentId: TrackId | null = null;
  private fades = new Map<HTMLAudioElement, number>();

  private target() {
    return this.currentId ? this.volume * TRACK_GAIN[this.currentId] : 0;
  }

  setVolume(v: number) {
    this.volume = v;
    Ambience.setVolume(v);
    if (this.current && !this.fades.has(this.current)) this.current.volume = this.target();
  }

  play(id: TrackId, fadeMs = 800) {
    Ambience.stop();
    if (this.currentId === id && this.current) {
      if (this.current.paused) this.current.play().catch(() => {});
      return;
    }
    const prev = this.current;
    if (prev) this.fade(prev, 0, fadeMs, () => { prev.pause(); prev.src = ''; });

    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0;
    let triedFallback = false;
    audio.addEventListener('error', () => {
      if (triedFallback) return;
      triedFallback = true;
      audio.src = FALLBACK[id];
      audio.play().catch(() => {});
    });
    audio.src = `music/${id}.mp3`;
    this.current = audio;
    this.currentId = id;
    audio.play().catch(() => { /* aguardando interação do usuário */ });
    this.fade(audio, this.target(), fadeMs);
  }

  /** Troca a música por um som ambiente sintetizado */
  ambient(kind: AmbienceId) {
    this.stop(700);
    Ambience.setVolume(this.volume);
    Ambience.start(kind);
  }

  /** Tenta retomar após a primeira interação (política de autoplay) */
  resume() {
    if (this.current && this.current.paused) this.current.play().catch(() => {});
  }

  stop(fadeMs = 600) {
    const prev = this.current;
    this.current = null;
    this.currentId = null;
    if (prev) this.fade(prev, 0, fadeMs, () => { prev.pause(); prev.src = ''; });
  }

  duck(on: boolean) {
    if (this.current) this.fade(this.current, on ? this.target() * 0.35 : this.target(), 250);
  }

  private fade(a: HTMLAudioElement, to: number, ms: number, done?: () => void) {
    const old = this.fades.get(a);
    if (old) clearInterval(old);
    const from = a.volume;
    const start = performance.now();
    const id = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / Math.max(1, ms));
      a.volume = Math.max(0, Math.min(1, from + (to - from) * t));
      if (t >= 1) {
        clearInterval(id);
        this.fades.delete(a);
        done?.();
      }
    }, 30);
    this.fades.set(a, id);
  }
}

export const Music = new MusicPlayer();
