import Phaser from 'phaser';
import { C } from './palette';
import { Px, makeSheet } from './Px';

// ---------- REI OSSÁRIO (64x64) ----------
function boneKing(p: Px, bob: number, pose: 'idle' | 'cast' | 'swoop') {
  const b = bob;
  const lean = pose === 'swoop' ? 4 : 0;
  // manto esfarrapado
  for (let y = 26; y < 60; y++) {
    const w = 10 + Math.floor((y - 26) * 0.55);
    const x = 32 - w + lean;
    p.rect(x, y + b, w * 2, 1, y % 5 === 0 ? C.violet : C.deep);
  }
  p.dither(14 + lean, 40 + b, 12, 20, C.night);
  for (let i = 0; i < 9; i++) p.rect(14 + i * 4 + lean, 58 + b + (i % 2) * 2, 2, 3 - (i % 2), C.deep);
  // gola e costelas
  p.rect(22 + lean, 22 + b, 20, 4, C.violetLight);
  p.rect(26 + lean, 26 + b, 12, 10, C.night);
  for (let i = 0; i < 4; i++) p.rect(27 + lean, 27 + i * 2 + b, 10, 1, C.bone);
  p.rect(31 + lean, 26 + b, 2, 11, C.boneMid);
  // crânio
  const sx = 24 + lean, sy = 8 + b;
  p.rect(sx, sy, 16, 14, C.bone);
  p.rect(sx, sy, 4, 14, C.boneMid);
  p.rect(sx + 4, sy + 5, 4, 4, C.outline);
  p.rect(sx + 10, sy + 5, 4, 4, C.outline);
  p.rect(sx + 5, sy + 6, 2, 2, C.voidLight);
  p.rect(sx + 11, sy + 6, 2, 2, C.voidLight);
  p.rect(sx + 7, sy + 10, 2, 2, C.boneDark);
  p.rect(sx + 3, sy + 13, 10, 3, C.boneMid);
  for (let i = 0; i < 5; i++) p.px(sx + 4 + i * 2, sy + 14, C.outline);
  // coroa
  p.rect(sx - 1, sy - 2, 18, 3, C.gold);
  p.rect(sx - 1, sy - 2, 18, 1, C.goldMid);
  for (let i = 0; i < 4; i++) p.rect(sx + i * 5, sy - 6 + (i % 2), 2, 4, C.gold);
  p.px(sx + 8, sy - 1, C.red);
  // braços e cajado
  if (pose === 'cast') {
    p.thick(22 + lean, 26 + b, 12, 12 + b, 2, C.bone);
    p.thick(42 + lean, 26 + b, 52, 12 + b, 2, C.bone);
    p.rect(52, 2 + b, 2, 56, C.brownDark);
    p.circle(53, 4 + b, 5, C.voidLight);
    p.circle(53, 4 + b, 3, C.white);
    p.circle(11, 10 + b, 3, C.voidLight);
  } else {
    p.thick(22 + lean, 26 + b, 16 + lean, 38 + b, 2, C.bone);
    p.thick(42 + lean, 26 + b, 50 + lean, 34 + b, 2, C.bone);
    p.rect(50 + lean, 8 + b, 2, 50, C.brownDark);
    p.circle(51 + lean, 8 + b, 4, C.void);
    p.circle(51 + lean, 8 + b, 2, C.voidLight);
  }
}

// ---------- SERAFIM GUARDIÃO (80x80) ----------
function seraph(p: Px, flap: number, pose: 'idle' | 'raise' | 'slash' | 'dive') {
  const wingPair = (y: number, len: number, droop: number, col: string, edge: string) => {
    for (let i = 0; i < len; i++) {
      const h = Math.max(2, 7 - Math.floor(i / 3));
      const yy = y + Math.round(droop * (i / len));
      p.rect(40 - 8 - i, yy, 1, h, col);
      p.rect(40 + 8 + i, yy, 1, h, col);
      if (i % 4 === 0) { p.px(40 - 8 - i, yy + h - 1, edge); p.px(40 + 8 + i, yy + h - 1, edge); }
    }
  };
  const f = pose === 'dive' ? 2 : flap;
  // seis asas
  wingPair(10 - f * 2, 26, -10 + f * 4, C.white, C.gold);
  wingPair(26, 28, 2 + f * 2, C.marble, C.goldMid);
  wingPair(42 + f, 22, 10, C.marbleMid, C.goldDark);
  // auréola completa
  p.ring(40, 16, 13, C.gold);
  p.ring(40, 16, 12, C.goldMid);
  // corpo
  p.rect(32, 30, 16, 26, C.gold);
  p.rect(32, 30, 5, 26, C.goldMid);
  p.rect(38, 34, 4, 10, C.white);
  p.rect(36, 38, 8, 2, C.white);
  p.rect(30, 54, 20, 18, C.marble);
  p.rect(30, 54, 6, 18, C.marbleMid);
  p.rect(30, 70, 20, 2, C.gold);
  // cabeça/elmo
  p.rect(34, 12, 12, 16, C.gold);
  p.rect(34, 12, 3, 16, C.goldMid);
  p.rect(37, 18, 9, 4, C.white);
  p.rect(39, 19, 2, 2, C.cyan);
  p.rect(43, 19, 2, 2, C.cyan);
  // espada flamejante
  const blade = (x0: number, y0: number, x1: number, y1: number) => {
    p.thick(x0, y0, x1, y1, 3, C.gold);
    p.line(x0, y0, x1, y1, C.white);
  };
  if (pose === 'raise') { p.rect(46, 26, 6, 3, C.gold); blade(50, 24, 58, 2); }
  else if (pose === 'slash') { p.rect(46, 36, 10, 3, C.gold); blade(56, 38, 77, 50); }
  else if (pose === 'dive') { blade(46, 44, 72, 66); }
  else { p.rect(46, 34, 4, 8, C.goldMid); blade(50, 42, 66, 16); }
}

// ---------- O FALSO ANJO (96x96) ----------
function falseAngel(p: Px, flap: number, cast: boolean, broken: boolean) {
  // asas cobertas de olhos
  for (let i = 0; i < 4; i++) {
    const y = 18 + i * 12 + (flap ? (i % 2 ? 2 : -2) : 0);
    const len = 34 - i * 4;
    for (let j = 0; j < len; j++) {
      const h = 9 - Math.floor(j / 6);
      const col = broken && j % 7 === 3 ? C.void : j % 5 === 0 ? C.marbleMid : C.white;
      p.rect(48 - 12 - j, y - Math.floor(j / 4), 1, h, col);
      p.rect(48 + 12 + j, y - Math.floor(j / 4), 1, h, col);
    }
    p.rect(48 - 22 - i * 2, y - 2, 3, 2, broken ? C.voidLight : C.red);
    p.rect(48 + 20 + i * 2, y - 2, 3, 2, broken ? C.voidLight : C.red);
  }
  // auréola em coroa de espinhos
  p.ring(48, 20, 18, C.gold);
  p.ring(48, 20, 17, C.goldMid);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    p.px(Math.round(48 + Math.cos(a) * 21), Math.round(20 + Math.sin(a) * 21), C.gold);
  }
  // túnica
  for (let y = 36; y < 92; y++) {
    const w = 9 + Math.floor((y - 36) * 0.3);
    p.rect(48 - w, y, w * 2, 1, C.white);
    p.rect(48 - w, y, 3, 1, C.marbleMid);
  }
  p.rect(38, 36, 20, 3, C.gold);
  p.rect(46, 39, 4, 50, C.gold);
  if (broken) {
    p.line(42, 40, 36, 80, C.black); p.line(54, 44, 60, 88, C.black);
    p.line(43, 41, 37, 81, C.void); p.dither(36, 70, 24, 20, C.voidDark);
  }
  // cabeça e máscara
  p.rect(40, 14, 16, 20, C.gold);
  p.rect(40, 14, 4, 20, C.goldMid);
  p.rect(43, 22, 4, 2, C.outline); p.rect(50, 22, 4, 2, C.outline);
  p.px(44, 22, broken ? C.voidLight : C.cyan); p.px(51, 22, broken ? C.voidLight : C.cyan);
  p.rect(46, 29, 4, 1, C.goldDark);
  if (broken) {
    // metade da máscara caiu: por baixo, o rosto do próprio herói
    p.rect(48, 15, 8, 18, C.skin);
    p.rect(48, 29, 8, 2, C.skinShade);
    p.rect(48, 12, 10, 5, C.silver);
    p.rect(55, 15, 3, 13, C.silverMid);
    p.rect(50, 21, 2, 1, C.blueDark);
    p.px(52, 21, C.cyan);
    p.rect(50, 26, 3, 1, C.skinShade);
    // borda rachada da máscara e lágrimas negras
    p.line(48, 13, 47, 33, C.black);
    for (let y = 15; y < 33; y += 3) p.px(48, y, C.goldDark);
    p.rect(51, 23, 1, 7, C.void);
    p.rect(44, 25, 1, 6, C.void);
  }
  // braços
  if (cast) {
    p.thick(38, 40, 22, 26, 3, C.white);
    p.thick(58, 40, 74, 26, 3, C.white);
    p.circle(20, 24, 4, broken ? C.voidLight : C.gold);
    p.circle(76, 24, 4, broken ? C.voidLight : C.gold);
    p.circle(20, 24, 2, C.white); p.circle(76, 24, 2, C.white);
  } else {
    p.thick(38, 40, 32, 60, 3, C.white);
    p.thick(58, 40, 64, 60, 3, C.white);
    p.rect(30, 60, 4, 3, C.skin); p.rect(62, 60, 4, 3, C.skin);
  }
}

export function buildBossArt(scene: Phaser.Scene) {
  makeSheet(scene, 'boneking', 64, 64, [
    (p) => boneKing(p, 0, 'idle'),
    (p) => boneKing(p, 1, 'idle'),
    (p) => boneKing(p, 0, 'cast'),
    (p) => boneKing(p, 0, 'swoop'),
  ]);
  makeSheet(scene, 'seraph', 80, 80, [
    (p) => seraph(p, 0, 'idle'),
    (p) => seraph(p, 1, 'idle'),
    (p) => seraph(p, 0, 'raise'),
    (p) => seraph(p, 1, 'slash'),
    (p) => seraph(p, 0, 'dive'),
  ]);
  makeSheet(scene, 'falseangel', 96, 96, [
    (p) => falseAngel(p, 0, false, false),
    (p) => falseAngel(p, 1, false, false),
    (p) => falseAngel(p, 0, true, false),
    (p) => falseAngel(p, 0, false, true),
    (p) => falseAngel(p, 1, false, true),
    (p) => falseAngel(p, 0, true, true),
  ]);
}
