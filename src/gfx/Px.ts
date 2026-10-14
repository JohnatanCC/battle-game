import Phaser from 'phaser';
import { C } from './palette';

/** Pincel de pixels: desenha primitivas alinhadas à grade num canvas 2D. */
export class Px {
  constructor(public ctx: CanvasRenderingContext2D, public ox = 0, public oy = 0) {}

  rect(x: number, y: number, w: number, h: number, c: string) {
    if (w <= 0 || h <= 0) return;
    this.ctx.fillStyle = c;
    this.ctx.fillRect(Math.round(this.ox + x), Math.round(this.oy + y), Math.round(w), Math.round(h));
  }

  px(x: number, y: number, c: string) {
    this.rect(x, y, 1, 1, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Linha grossa (w pixels) */
  thick(x0: number, y0: number, x1: number, y1: number, w: number, c: string) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      this.rect(Math.round(x - w / 2), Math.round(y - w / 2), w, w, c);
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: string) {
    for (let y = -ry; y <= ry; y++) {
      const span = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.01))));
      this.rect(cx - span, cy + y, span * 2 + 1, 1, c);
    }
  }

  circle(cx: number, cy: number, r: number, c: string) {
    this.ellipse(cx, cy, r, r, c);
  }

  ring(cx: number, cy: number, r: number, c: string, from = 0, to = Math.PI * 2) {
    const steps = Math.max(12, Math.round(r * 8));
    for (let i = 0; i <= steps; i++) {
      const a = from + (to - from) * (i / steps);
      this.px(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), c);
    }
  }

  /** Preenche com padrão xadrez (dithering clássico de 16-bit) */
  dither(x: number, y: number, w: number, h: number, c: string, phase = 0) {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++)
        if ((i + j + phase) % 2 === 0) this.px(x + i, y + j, c);
  }

  /** Dithering esparso (1 a cada 4 pixels) */
  sparse(x: number, y: number, w: number, h: number, c: string) {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++)
        if (i % 2 === 0 && (j + (i % 4 === 0 ? 0 : 1)) % 2 === 0) this.px(x + i, y + j, c);
  }
}

/** Contorna todo pixel opaco com uma borda escura (visual de sprite 16-bit). */
export function outline(ctx: CanvasRenderingContext2D, w: number, h: number, color = C.outline) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  const marks: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) marks.push(x, y);
    }
  ctx.fillStyle = color;
  for (let i = 0; i < marks.length; i += 2) ctx.fillRect(marks[i], marks[i + 1], 1, 1);
}

export type DrawFn = (p: Px, frame: number) => void;

/**
 * Gera uma spritesheet em memória: cada função desenha um quadro fw×fh.
 * Quadros ficam acessíveis como frame 0..n-1.
 */
export function makeSheet(
  scene: Phaser.Scene,
  key: string,
  fw: number,
  fh: number,
  frames: DrawFn[],
  outlineColor: string | null = C.outline,
) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, fw * frames.length, fh)!;
  const sheetCtx = tex.getContext();
  const tmp = document.createElement('canvas');
  tmp.width = fw;
  tmp.height = fh;
  const tctx = tmp.getContext('2d', { willReadFrequently: true })!;
  frames.forEach((fn, i) => {
    tctx.clearRect(0, 0, fw, fh);
    fn(new Px(tctx), i);
    if (outlineColor) outline(tctx, fw, fh, outlineColor);
    sheetCtx.drawImage(tmp, i * fw, 0);
    tex.add(i, 0, i * fw, 0, fw, fh);
  });
  tex.refresh();
  return tex;
}

/** Textura única */
export function makeTex(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (p: Px) => void,
  outlineColor: string | null = null,
) {
  return makeSheet(scene, key, w, h, [(p) => draw(p)], outlineColor);
}

/** Variação simples: repete uma função de desenho com parâmetro de quadro. */
export function frames(n: number, fn: DrawFn): DrawFn[] {
  return Array.from({ length: n }, (_, i) => (p: Px) => fn(p, i));
}
