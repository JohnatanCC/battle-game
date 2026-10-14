import Phaser from 'phaser';
import { DEPTH } from '../config';
import type { ArenaApi } from './api';
import { Sfx } from '../audio/Sfx';

export interface HazardOpts {
  kind: 'rect' | 'line';
  x?: number; y?: number; w?: number; h?: number;            // rect
  x0?: number; y0?: number; x1?: number; y1?: number; thick?: number; // linha
  warn: number;           // tempo de aviso (s)
  active: number;         // tempo causando dano (s)
  damage?: number;
  color: number;
  style?: 'pillar' | 'spikes' | 'beam' | 'blade' | 'plain';
  sound?: 'laser' | 'boom' | 'magic' | 'none';
  onActivate?: () => void;
}

/** Área de dano com aviso prévio (telegraph). Desenhada com Graphics. */
export class Hazard {
  g: Phaser.GameObjects.Graphics;
  t = 0;
  dead = false;
  sprites: Phaser.GameObjects.Image[] = [];

  constructor(public arena: ArenaApi, public o: HazardOpts) {
    this.g = arena.add.graphics().setDepth(DEPTH.telegraph);
  }

  get activeNow() { return this.t >= this.o.warn && this.t < this.o.warn + this.o.active; }

  update(dt: number) {
    if (this.dead) return;
    const was = this.activeNow;
    this.t += dt;
    if (!was && this.activeNow) this.activate();
    if (this.t >= this.o.warn + this.o.active) { this.destroy(); return; }
    this.draw();
    if (this.activeNow && (this.o.damage ?? 1) > 0) this.checkHero();
  }

  private activate() {
    const o = this.o;
    o.onActivate?.();
    if (o.sound !== 'none') Sfx.play(o.sound ?? 'magic');
    if (o.style === 'spikes' && o.kind === 'rect') {
      const n = Math.max(1, Math.floor(o.w! / 10));
      for (let i = 0; i < n; i++) {
        const s = this.arena.add.image(o.x! + 5 + i * 10, o.y! + o.h!, 'spike').setOrigin(0.5, 1).setDepth(DEPTH.enemies + 1);
        s.setScale(1, 0.1);
        this.arena.tweens.add({ targets: s, scaleY: o.h! / 30, duration: 80 });
        this.sprites.push(s);
      }
      this.arena.shake(0.004, 100);
    }
  }

  private draw() {
    const o = this.o, g = this.g;
    g.clear();
    const warning = this.t < o.warn;
    const blink = Math.floor(this.t * 14) % 2 === 0;
    if (o.kind === 'rect') {
      const { x, y, w, h } = o as Required<HazardOpts>;
      if (warning) {
        const k = this.t / o.warn;
        g.fillStyle(o.color, 0.08 + k * 0.15).fillRect(x, y, w, h);
        g.lineStyle(1, o.color, blink ? 0.9 : 0.4).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        if (o.style === 'spikes') g.fillStyle(o.color, 0.8).fillRect(x, y + h - 2, w, 2);
      } else if (o.style !== 'spikes') {
        const fade = 1 - (this.t - o.warn) / o.active;
        g.fillStyle(o.color, 0.35 * fade + 0.2).fillRect(x - 2, y, w + 4, h);
        g.fillStyle(0xffffff, 0.9 * fade + 0.1).fillRect(x + w * 0.25, y, w * 0.5, h);
      }
    } else {
      const { x0, y0, x1, y1 } = o as Required<HazardOpts>;
      const thick = o.thick ?? 6;
      if (warning) {
        g.lineStyle(1, o.color, blink ? 0.9 : 0.35).lineBetween(x0, y0, x1, y1);
      } else {
        const fade = 1 - (this.t - o.warn) / o.active;
        g.lineStyle(thick + 4, o.color, 0.4 * fade + 0.2).lineBetween(x0, y0, x1, y1);
        g.lineStyle(thick, o.color, 0.9).lineBetween(x0, y0, x1, y1);
        g.lineStyle(Math.max(1, thick / 3), 0xffffff, 1).lineBetween(x0, y0, x1, y1);
      }
    }
  }

  private checkHero() {
    const hero = this.arena.hero;
    if (hero.dead) return;
    const hb = hero.body;
    const r = new Phaser.Geom.Rectangle(hb.x, hb.y, hb.width, hb.height);
    let hit = false;
    if (this.o.kind === 'rect') {
      hit = Phaser.Geom.Rectangle.Overlaps(r, new Phaser.Geom.Rectangle(this.o.x!, this.o.y!, this.o.w!, this.o.h!));
    } else {
      const line = new Phaser.Geom.Line(this.o.x0!, this.o.y0!, this.o.x1!, this.o.y1!);
      const grown = new Phaser.Geom.Rectangle(r.x - (this.o.thick ?? 6) / 2, r.y - (this.o.thick ?? 6) / 2, r.width + (this.o.thick ?? 6), r.height + (this.o.thick ?? 6));
      hit = Phaser.Geom.Intersects.LineToRectangle(line, grown);
    }
    if (hit) hero.hurt(this.o.damage ?? 1, this.o.kind === 'rect' ? this.o.x! + this.o.w! / 2 : this.o.x0!, 'hazard');
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    this.g.destroy();
    for (const s of this.sprites) {
      this.arena.tweens.add({ targets: s, scaleY: 0, duration: 120, onComplete: () => s.destroy() });
    }
  }
}
