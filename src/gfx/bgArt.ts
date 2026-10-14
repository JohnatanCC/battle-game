import Phaser from 'phaser';
import { C } from './palette';
import { Px, makeTex, makeSheet } from './Px';
import { GAME_W as W, GAME_H as H, FLOOR_Y } from '../config';

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Degradê em faixas com transição pontilhada (dithering) */
function gradient(p: Px, colors: string[], y0: number, y1: number) {
  const band = (y1 - y0) / colors.length;
  colors.forEach((c, i) => p.rect(0, Math.round(y0 + i * band), W, Math.ceil(band) + 1, c));
  for (let i = 1; i < colors.length; i++) {
    const y = Math.round(y0 + i * band);
    p.dither(0, y - 3, W, 2, colors[i]);
    p.sparse(0, y - 5, W, 2, colors[i]);
    p.dither(0, y, W, 2, colors[i - 1], 1);
  }
}

function stars(p: Px, r: () => number, n: number, maxY: number, cols: string[]) {
  for (let i = 0; i < n; i++) p.px(Math.floor(r() * W), Math.floor(r() * maxY), cols[i % cols.length]);
}

// ---------------- MUNDO 1 — O OSSUÁRIO ----------------
function ossuary(p: Px) {
  const r = rng(11);
  gradient(p, [C.black, C.night, C.night, C.deep, C.violet], 0, FLOOR_Y);
  // parede distante da caverna
  for (let x = 0; x < W; x++) {
    const h = 60 + Math.sin(x * 0.03) * 20 + Math.sin(x * 0.11) * 8;
    p.rect(x, FLOOR_Y - h - 40, 1, h + 40, C.night);
  }
  p.sparse(0, FLOOR_Y - 120, W, 30, C.deep);
  // estalactites
  for (let x = 0; x < W; x += 6 + Math.floor(r() * 14)) {
    const len = 10 + Math.floor(r() * 45);
    for (let y = 0; y < len; y++) {
      const w = Math.max(1, Math.round((1 - y / len) * 5));
      p.rect(x - w, y, w * 2, 1, y < len * 0.4 ? C.black : C.night);
    }
  }
  // correntes penduradas
  for (const cx of [0.18, 0.42, 0.58, 0.82].map((f) => Math.round(f * W))) {
    const len = 40 + Math.floor(r() * 60);
    for (let y = 0; y < len; y += 3) { p.rect(cx, y, 1, 2, C.stoneDark); p.px(cx + 1, y + 1, C.stoneMid); }
    p.rect(cx - 2, len, 5, 3, C.stoneMid);
  }
  // pilares de crânios com velas
  for (const px of [0.06, 0.3, 0.7, 0.94].map((f) => Math.round(f * W))) {
    const top = FLOOR_Y - 120 - Math.floor(r() * 20);
    p.rect(px - 10, top, 20, FLOOR_Y - top, C.stoneDark);
    p.rect(px - 10, top, 4, FLOOR_Y - top, C.night);
    for (let y = top + 6; y < FLOOR_Y - 6; y += 9) {
      for (let k = -1; k <= 1; k++) {
        const sx = px + k * 6 - 2;
        p.rect(sx, y, 5, 4, C.boneDark);
        p.px(sx + 1, y + 1, C.outline); p.px(sx + 3, y + 1, C.outline);
        p.rect(sx + 1, y + 4, 3, 1, C.stoneMid);
      }
    }
    // vela
    p.rect(px - 2, top - 8, 4, 8, C.bone);
    p.rect(px - 1, top - 12, 2, 4, C.gold);
    p.px(px, top - 13, C.white);
    p.sparse(px - 14, top - 24, 28, 20, C.goldDark);
  }
  // montes de ossos no fundo
  for (let i = 0; i < 14; i++) {
    const bx = Math.floor(r() * W), bw = 12 + Math.floor(r() * 26);
    p.ellipse(bx, FLOOR_Y, bw, 6 + Math.floor(r() * 6), C.stoneDark);
    for (let k = 0; k < 5; k++) p.rect(bx - bw / 2 + Math.floor(r() * bw), FLOOR_Y - 4 - Math.floor(r() * 5), 3, 1, C.boneDark);
  }
}

// ---------------- MUNDO 2 — OS ÁTRIOS DOURADOS ----------------
function atrium(p: Px) {
  const r = rng(22);
  gradient(p, [C.deep, C.violet, C.violetLight, '#b0607a', '#e08a5a', C.goldMid, C.gold], 0, FLOOR_Y - 20);
  stars(p, r, 40, 50, [C.lilac, C.white]);
  // sol divino
  p.circle(W / 2, 240, 60, '#ffe9a0');
  p.circle(W / 2, 240, 50, C.yellow);
  p.circle(W / 2, 240, 38, C.white);
  for (let k = 0; k < 3; k++) p.ring(W / 2, 240, 66 + k * 7, C.gold);
  // nuvens
  for (let i = 0; i < 13; i++) {
    const cx = Math.floor(r() * W), cy = 150 + Math.floor(r() * 120), cw = 30 + Math.floor(r() * 40);
    p.ellipse(cx, cy, cw, 5, C.lilac);
    p.ellipse(cx + 6, cy - 3, Math.round(cw * 0.6), 4, C.marbleMid);
    p.rect(cx - cw, cy + 3, cw * 2, 2, C.violetLight);
  }
  // torres distantes
  for (const tx of [0.12, 0.2, 0.8, 0.88].map((f) => Math.round(f * W))) {
    const top = 90 + Math.floor(r() * 60);
    p.rect(tx - 6, top, 12, FLOOR_Y - top, C.violetLight);
    p.ellipse(tx, top, 8, 6, C.violetLight);
    p.rect(tx - 1, top - 14, 2, 10, C.gold);
    p.rect(tx - 2, top + 10, 4, 6, C.lilac);
  }
  // colunas de mármore
  for (const cx of [0.04, 0.25, 0.75, 0.96].map((f) => Math.round(f * W))) {
    p.rect(cx - 9, 30, 18, FLOOR_Y - 30, C.marble);
    p.rect(cx - 9, 30, 4, FLOOR_Y - 30, C.marbleMid);
    p.rect(cx + 6, 30, 3, FLOOR_Y - 30, C.marbleDark);
    for (let k = -5; k <= 5; k += 4) p.rect(cx + k, 36, 1, FLOOR_Y - 46, C.marbleMid);
    p.rect(cx - 13, 22, 26, 8, C.gold);
    p.rect(cx - 13, 22, 26, 2, C.yellow);
    p.rect(cx - 12, FLOOR_Y - 10, 24, 10, C.goldMid);
  }
  // balaustrada
  p.rect(0, FLOOR_Y - 26, W, 4, C.marble);
  p.rect(0, FLOOR_Y - 22, W, 1, C.marbleDark);
  for (let x = 4; x < W; x += 10) { p.rect(x, FLOOR_Y - 22, 4, 22, C.marbleMid); p.rect(x, FLOOR_Y - 22, 1, 22, C.marble); }
}

// ---------------- MUNDO 3 — O TRONO USURPADO ----------------
function throne(p: Px) {
  const r = rng(33);
  gradient(p, [C.black, C.black, C.redDark, C.blood, C.crimson, C.redMid], 0, FLOOR_Y);
  // lua de sangue
  p.circle(W / 2, 60, 34, C.redMid);
  p.circle(W / 2, 60, 30, C.red);
  p.circle(W / 2 + 8, 54, 22, C.crimson);
  p.ring(W / 2, 60, 38, C.redDark);
  // rachaduras do vazio no céu
  for (let i = 0; i < 6; i++) {
    let x = Math.floor(r() * W), y = Math.floor(r() * 60);
    for (let k = 0; k < 14; k++) {
      const nx = x + Math.floor(r() * 9) - 4, ny = y + 3 + Math.floor(r() * 4);
      p.line(x, y, nx, ny, C.void); x = nx; y = ny;
    }
  }
  // trono colossal
  const tx = W / 2;
  p.rect(tx - 40, 70, 80, FLOOR_Y - 70, C.black);
  p.rect(tx - 50, 120, 100, 16, C.black);
  p.rect(tx - 54, 110, 12, FLOOR_Y - 110, C.black);
  p.rect(tx + 42, 110, 12, FLOOR_Y - 110, C.black);
  for (let i = 0; i < 5; i++) p.rect(tx - 40 + i * 18, 58 - (i % 2) * 8, 6, 14, C.black);
  p.rect(tx - 41, 70, 82, 2, C.goldDark);
  p.rect(tx - 51, 120, 102, 2, C.goldDark);
  // olho no trono
  p.ellipse(tx, 95, 12, 6, C.redDark);
  p.ellipse(tx, 95, 4, 5, C.red);
  p.rect(tx - 1, 92, 2, 6, C.black);
  // pilares quebrados
  for (const cx of [0.07, 0.22, 0.78, 0.93].map((f) => Math.round(f * W))) {
    const top = 90 + Math.floor(r() * 60);
    p.rect(cx - 10, top, 20, FLOOR_Y - top, C.stoneDark);
    p.rect(cx - 10, top, 4, FLOOR_Y - top, C.night);
    p.rect(cx - 12, FLOOR_Y - 12, 24, 12, C.goldDark);
    for (let k = 0; k < 6; k++) p.rect(cx - 10 + k * 4, top - Math.floor(r() * 8), 4, 8, C.stoneDark);
    p.line(cx - 4, top + 10, cx + 3, top + 50, C.void);
  }
  // detritos flutuantes
  for (let i = 0; i < 10; i++) {
    const dx = Math.floor(r() * W), dy = 30 + Math.floor(r() * 150), s = 2 + Math.floor(r() * 5);
    p.rect(dx, dy, s, s - 1, C.stoneDark);
    p.px(dx, dy, C.stoneMid);
  }
}

// ---------------- TELA DE TÍTULO ----------------
function titleBg(p: Px) {
  const r = rng(7);
  gradient(p, [C.black, C.night, C.deep, C.violet, C.violetLight], 0, H);
  stars(p, r, 120, 160, [C.lilac, C.white, C.gold]);
  // feixe de luz do trono no alto
  for (let y = 0; y < H; y++) {
    const w = 10 + y * 0.25;
    p.sparse(W / 2 - w, y, w * 2, 1, C.goldDark);
  }
  // trono distante
  p.rect(W / 2 - 10, 34, 20, 18, C.gold);
  p.rect(W / 2 - 14, 46, 28, 4, C.goldMid);
  p.rect(W / 2 - 6, 28, 12, 8, C.yellow);
  p.circle(W / 2, 24, 3, C.white);
  // nuvens douradas
  for (let i = 0; i < 12; i++) {
    const cx = Math.floor(r() * W), cy = 50 + Math.floor(r() * 30), cw = 20 + Math.floor(r() * 30);
    p.ellipse(cx, cy, cw, 4, C.goldDark);
    p.ellipse(cx + 4, cy - 2, Math.round(cw * 0.5), 3, C.goldMid);
  }
  // abismo
  for (let x = 0; x < W; x++) {
    const h = 30 + Math.sin(x * 0.05) * 10 + Math.sin(x * 0.17) * 5;
    p.rect(x, H - h, 1, h, C.black);
  }
}

// ---------------- TILES ----------------
function tiles1(p: Px, kind: number) {
  if (kind === 0) {
    p.rect(0, 0, 16, 16, C.stoneMid);
    p.rect(0, 0, 16, 2, C.stone);
    p.rect(0, 8, 16, 1, C.stoneDark); p.rect(7, 0, 1, 8, C.stoneDark); p.rect(12, 8, 1, 8, C.stoneDark);
    p.rect(2, 3, 3, 2, C.boneDark); p.px(2, 3, C.boneMid);
  } else if (kind === 1) {
    p.rect(0, 0, 16, 16, C.stoneDark);
    p.rect(0, 7, 16, 1, C.night); p.rect(5, 0, 1, 7, C.night); p.rect(11, 8, 1, 8, C.night);
    p.px(3, 11, C.boneDark);
  } else {
    p.rect(0, 0, 16, 6, C.stoneMid);
    p.rect(0, 0, 16, 1, C.stone);
    p.rect(0, 5, 16, 1, C.stoneDark);
    p.rect(9, 1, 1, 4, C.stoneDark);
    p.rect(2, 2, 3, 1, C.boneMid);
  }
}
function tiles2(p: Px, kind: number) {
  if (kind === 0) {
    p.rect(0, 0, 16, 16, C.marble);
    p.rect(0, 0, 16, 2, C.gold); p.rect(0, 2, 16, 1, C.goldDark);
    p.rect(0, 15, 16, 1, C.marbleMid); p.rect(15, 3, 1, 13, C.marbleMid);
    p.line(3, 6, 8, 11, C.marbleMid);
  } else if (kind === 1) {
    p.rect(0, 0, 16, 16, C.marbleMid);
    p.rect(0, 15, 16, 1, C.marbleDark); p.rect(15, 0, 1, 16, C.marbleDark);
    p.px(5, 5, C.gold); p.px(10, 10, C.gold);
  } else {
    p.rect(0, 0, 16, 6, C.marble);
    p.rect(0, 0, 16, 1, C.yellow);
    p.rect(0, 4, 16, 2, C.gold);
    p.rect(0, 5, 16, 1, C.goldDark);
  }
}
function tiles3(p: Px, kind: number) {
  if (kind === 0) {
    p.rect(0, 0, 16, 16, C.night);
    p.rect(0, 0, 16, 2, C.goldDark); p.rect(0, 2, 16, 1, C.black);
    p.line(2, 4, 6, 12, C.crimson); p.line(6, 12, 10, 14, C.redDark);
    p.rect(15, 3, 1, 13, C.black);
  } else if (kind === 1) {
    p.rect(0, 0, 16, 16, C.black);
    p.rect(15, 0, 1, 16, C.night);
    p.px(8, 6, C.redDark);
  } else {
    p.rect(0, 0, 16, 6, C.stoneDark);
    p.rect(0, 0, 16, 1, C.goldMid);
    p.rect(0, 5, 16, 1, C.black);
    p.line(4, 1, 7, 5, C.crimson);
  }
}

export function buildBackgrounds(scene: Phaser.Scene) {
  makeTex(scene, 'bg1', W, H, ossuary);
  makeTex(scene, 'bg2', W, H, atrium);
  makeTex(scene, 'bg3', W, H, throne);
  makeTex(scene, 'titlebg', W, H, titleBg);
  const sets: Array<[string, (p: Px, k: number) => void]> = [['tiles1', tiles1], ['tiles2', tiles2], ['tiles3', tiles3]];
  for (const [key, fn] of sets) {
    makeSheet(scene, key, 16, 16, [0, 1, 2].map((k) => (p: Px) => fn(p, k)), null);
    // texturas avulsas para TileSprite
    for (const k of [0, 1, 2]) makeTex(scene, `${key}_${k}`, 16, k === 2 ? 6 : 16, (p) => fn(p, k));
  }
}
