import Phaser from 'phaser';
import { C } from './palette';
import { Px, makeSheet } from './Px';

// Quadros do herói (32x32, virado para a direita, pés em y=30)
export const HERO_FRAMES = {
  idle: [0, 1],
  run: [2, 3, 4, 5],
  jump: 6,
  fall: 7,
  windup: 8,
  strike: 9,
  attackUp: 10,
  attackDown: 11,
  hurt: 12,
  dash: 13,
  heal: 14,
  dead: 15,
  scream: 16,
};

type Arm = 'idle' | 'windup' | 'strike' | 'up' | 'down' | 'spread' | 'heal' | 'hurt' | 'dash';
type Legs = 'stand' | 'run0' | 'run1' | 'run2' | 'run3' | 'jump' | 'fall' | 'kneel' | 'dash';

interface Pose {
  bob?: number;
  legs: Legs;
  arm: Arm;
  wing?: 0 | 1 | 2;
  eyeClosed?: boolean;
  lean?: number;
}

function leg(p: Px, x: number, top: number, len: number, far: boolean) {
  const cloth = far ? C.deep : C.violet;
  const boot = far ? C.outline : C.brownDark;
  p.rect(x, top, 3, len - 2, cloth);
  p.rect(x, top + len - 2, 3, 2, boot);
  if (!far) p.px(x + 2, top + len - 2, C.brown);
}

function drawLegs(p: Px, legs: Legs) {
  const hip = 23;
  switch (legs) {
    case 'stand': leg(p, 13, hip, 8, true); leg(p, 17, hip, 8, false); break;
    case 'run0': leg(p, 11, hip, 8, true); leg(p, 19, hip, 8, false); break;
    case 'run1': leg(p, 14, hip, 6, true); leg(p, 16, hip, 8, false); break;
    case 'run2': leg(p, 19, hip, 8, true); leg(p, 11, hip, 8, false); break;
    case 'run3': leg(p, 16, hip, 8, true); leg(p, 14, hip, 6, false); break;
    case 'jump': leg(p, 12, hip, 6, true); leg(p, 17, hip - 1, 6, false); break;
    case 'fall': leg(p, 12, hip, 8, true); leg(p, 18, hip, 7, false); break;
    case 'kneel': leg(p, 11, hip + 3, 5, true); p.rect(16, hip + 4, 6, 3, C.violet); p.rect(20, hip + 5, 3, 2, C.brownDark); break;
    case 'dash': leg(p, 8, hip, 7, true); leg(p, 11, hip + 1, 7, false); break;
  }
}

function drawWing(p: Px, bob: number, mode: 0 | 1 | 2) {
  // Asa única e esfarrapada nas costas
  const rows = mode === 1 ? [2, 4, 6, 7, 7, 6, 4, 2] : mode === 2 ? [7, 7, 6, 5, 3] : [3, 5, 6, 7, 7, 6, 5, 3, 2];
  const top = (mode === 1 ? 8 : mode === 2 ? 14 : 12) + bob;
  const rootX = 13;
  rows.forEach((w, i) => {
    const xs = mode === 2 ? rootX - w - 2 : rootX - w;
    p.rect(xs, top + i, w, 1, i % 3 === 2 ? C.silverMid : C.white);
    p.px(xs, top + i, C.silverMid);
  });
  // penas rasgadas
  const tip = top + rows.length;
  p.px(rootX - 4, tip, C.silverMid);
  p.px(rootX - 6, tip - 1, C.silverDark);
  p.px(rootX - 2, tip + 1, C.silverDark);
}

function drawHead(p: Px, bob: number, eyeClosed = false, lean = 0) {
  const hx = 13 + lean, hy = 7 + bob;
  // cabelo longo prateado atrás
  p.rect(hx - 1, hy, 3, 8, C.silverMid);
  p.rect(hx, hy - 1, 7, 3, C.silver);
  // rosto
  p.rect(hx + 1, hy + 1, 6, 6, C.skin);
  p.rect(hx + 1, hy + 5, 6, 1, C.skinShade);
  p.rect(hx, hy + 1, 2, 3, C.silver);
  // olho brilhante
  if (eyeClosed) p.rect(hx + 4, hy + 3, 2, 1, C.skinShade);
  else { p.px(hx + 5, hy + 3, C.cyan); p.px(hx + 4, hy + 3, C.blueDark); }
  // auréola rachada
  p.rect(hx - 1, hy - 4, 2, 1, C.gold);
  p.rect(hx + 1, hy - 5, 3, 1, C.gold);
  p.px(hx + 5, hy - 5, C.goldMid);
  p.rect(hx + 6, hy - 4, 2, 1, C.goldDark);
}

function drawBody(p: Px, bob: number, lean = 0) {
  const x = 12 + lean, y = 14 + bob;
  // capa
  p.rect(x - 2, y, 3, 11, C.violet);
  p.rect(x - 3, y + 8, 2, 4, C.deep);
  // túnica
  p.rect(x, y, 9, 10, C.white);
  p.rect(x, y, 2, 10, C.silverMid);
  p.rect(x - 1, y + 8, 11, 3, C.white);
  p.rect(x - 1, y + 10, 11, 1, C.gold);
  // cinto
  p.rect(x, y + 6, 9, 1, C.goldMid);
  p.px(x + 6, y + 6, C.gold);
  // ombreira
  p.rect(x + 5, y, 4, 2, C.silver);
  p.px(x + 8, y + 1, C.silverMid);
}

function sword(p: Px, x0: number, y0: number, x1: number, y1: number) {
  p.line(x0, y0, x1, y1, C.silver);
  const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
  // brilho paralelo
  p.line(x0 + (dy !== 0 ? 1 : 0), y0 + (dx !== 0 ? 1 : 0), x1 + (dy !== 0 ? 1 : 0), y1 + (dx !== 0 ? 1 : 0), C.silverMid);
  p.px(x1, y1, C.white);
}

function drawArm(p: Px, arm: Arm, bob: number) {
  const sx = 19, sy = 15 + bob;
  switch (arm) {
    case 'idle':
      p.rect(sx, sy, 2, 5, C.white);
      p.rect(sx, sy + 5, 2, 1, C.skin);
      p.rect(sx - 1, sy + 6, 4, 1, C.goldMid);
      sword(p, sx + 1, sy + 7, sx + 5, sy + 14);
      break;
    case 'windup':
      p.rect(sx - 2, sy - 4, 2, 5, C.white);
      p.rect(sx - 2, sy - 5, 2, 1, C.skin);
      p.rect(sx - 4, sy - 6, 4, 1, C.goldMid);
      sword(p, sx - 3, sy - 7, sx - 11, sy - 12);
      break;
    case 'strike':
      p.rect(sx, sy + 1, 5, 2, C.white);
      p.rect(sx + 5, sy + 1, 1, 2, C.skin);
      p.rect(sx + 6, sy, 1, 4, C.goldMid);
      sword(p, sx + 7, sy + 1, sx + 11, sy + 1);
      break;
    case 'up':
      p.rect(sx - 1, sy - 6, 2, 6, C.white);
      p.rect(sx - 1, sy - 7, 2, 1, C.skin);
      p.rect(sx - 2, sy - 8, 4, 1, C.goldMid);
      sword(p, sx - 1, sy - 9, sx - 1, sy - 14);
      break;
    case 'down':
      p.rect(sx, sy, 2, 6, C.white);
      p.rect(sx, sy + 6, 2, 1, C.skin);
      p.rect(sx - 1, sy + 7, 4, 1, C.goldMid);
      sword(p, sx, sy + 8, sx, sy + 15);
      break;
    case 'spread':
      p.rect(sx, sy, 6, 2, C.white);
      p.rect(sx + 6, sy, 1, 2, C.skin);
      p.rect(6, sy, 6, 2, C.silverMid);
      p.rect(5, sy, 1, 2, C.skin);
      break;
    case 'heal':
      p.rect(sx - 3, sy + 2, 4, 2, C.white);
      p.rect(sx, sy + 1, 2, 2, C.skin);
      p.circle(sx + 2, sy + 1, 1, C.cyan);
      break;
    case 'hurt':
      p.rect(sx, sy - 3, 2, 4, C.white);
      p.rect(sx + 1, sy - 4, 2, 1, C.skin);
      sword(p, sx + 3, sy - 5, sx + 8, sy - 9);
      break;
    case 'dash':
      p.rect(sx - 2, sy + 2, 6, 2, C.white);
      sword(p, sx - 3, sy + 3, sx - 10, sy + 4);
      break;
  }
}

function drawHero(p: Px, pose: Pose) {
  const bob = pose.bob ?? 0;
  const lean = pose.lean ?? 0;
  drawWing(p, bob, pose.wing ?? 0);
  drawLegs(p, pose.legs);
  drawBody(p, bob, lean);
  drawHead(p, bob, pose.eyeClosed, lean);
  drawArm(p, pose.arm, bob);
}

function drawDead(p: Px) {
  // caído de lado
  p.rect(4, 26, 6, 4, C.silverMid); // asa
  p.rect(8, 25, 12, 5, C.white);
  p.rect(8, 29, 12, 1, C.gold);
  p.rect(20, 25, 6, 5, C.skin);
  p.rect(20, 24, 7, 2, C.silver);
  p.rect(24, 27, 1, 1, C.skinShade);
  p.rect(2, 27, 6, 3, C.violet);
  p.line(10, 22, 18, 22, C.silver);
  p.rect(27, 22, 2, 1, C.goldDark);
}

export function buildHeroArt(scene: Phaser.Scene) {
  const poses: Array<Pose | 'dead'> = [
    { legs: 'stand', arm: 'idle' },
    { legs: 'stand', arm: 'idle', bob: 1 },
    { legs: 'run0', arm: 'idle', bob: 0 },
    { legs: 'run1', arm: 'idle', bob: -1 },
    { legs: 'run2', arm: 'idle', bob: 0 },
    { legs: 'run3', arm: 'idle', bob: -1 },
    { legs: 'jump', arm: 'idle', wing: 1, bob: -1 },
    { legs: 'fall', arm: 'idle', wing: 1 },
    { legs: 'stand', arm: 'windup' },
    { legs: 'run0', arm: 'strike', lean: 1 },
    { legs: 'stand', arm: 'up' },
    { legs: 'jump', arm: 'down', wing: 1 },
    { legs: 'fall', arm: 'hurt', eyeClosed: true, lean: -1 },
    { legs: 'dash', arm: 'dash', wing: 2, lean: 1, bob: 1 },
    { legs: 'kneel', arm: 'heal', bob: 3, eyeClosed: true },
    'dead',
    { legs: 'stand', arm: 'spread', wing: 1 },
  ];
  makeSheet(scene, 'hero', 32, 32, poses.map((pose) => (p: Px) => {
    if (pose === 'dead') drawDead(p);
    else drawHero(p, pose);
  }));
}
