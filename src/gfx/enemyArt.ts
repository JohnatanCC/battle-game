import Phaser from 'phaser';
import { C } from './palette';
import { Px, makeSheet } from './Px';

// Todos os inimigos olham para a direita; o sprite é espelhado em jogo.

// ---------- MUNDO 1: O OSSUÁRIO ----------

function skeletonBase(p: Px, step: number, bob: number) {
  const b = bob;
  // pernas
  const lx = [13, 14, 16, 14][step], rx = [18, 17, 15, 17][step];
  p.rect(lx, 23 + b, 1, 7 - b, C.boneMid);
  p.rect(rx, 23 + b, 1, 7 - b, C.bone);
  p.rect(lx - 1, 29, 3, 1, C.boneMid);
  p.rect(rx, 29, 3, 1, C.bone);
  // pélvis
  p.rect(13, 22 + b, 7, 2, C.boneMid);
  // coluna e costelas
  p.rect(15, 13 + b, 2, 9, C.boneMid);
  for (let i = 0; i < 3; i++) {
    p.rect(13, 15 + i * 2 + b, 7, 1, C.bone);
    p.px(12, 15 + i * 2 + b, C.boneMid);
  }
  // crânio
  p.rect(13, 5 + b, 7, 7, C.bone);
  p.rect(13, 5 + b, 2, 7, C.boneMid);
  p.rect(16, 8 + b, 2, 2, C.outline);
  p.px(17, 8 + b, C.red);
  p.px(19, 8 + b, C.outline);
  p.rect(14, 12 + b, 6, 1, C.boneMid);
  p.px(16, 12 + b, C.outline);
  p.px(18, 12 + b, C.outline);
}

function rustySword(p: Px, x0: number, y0: number, x1: number, y1: number) {
  p.line(x0, y0, x1, y1, C.boneDark);
  p.line(x0, y0 + 1, x1, y1 + 1, C.brown);
}

function buildSkeleton(scene: Phaser.Scene) {
  const fs = [
    ...[0, 1, 2, 3].map((s) => (p: Px) => {
      skeletonBase(p, s, s % 2);
      p.rect(19, 15 + (s % 2), 1, 5, C.bone);
      rustySword(p, 20, 20 + (s % 2), 25, 26);
    }),
    (p: Px) => { // preparo
      skeletonBase(p, 0, 0);
      p.rect(17, 9, 1, 6, C.bone);
      rustySword(p, 17, 8, 10, 2);
    },
    (p: Px) => { // golpe
      skeletonBase(p, 2, 0);
      p.rect(19, 15, 5, 1, C.bone);
      rustySword(p, 24, 15, 31, 16);
    },
    (p: Px) => { // dor
      skeletonBase(p, 1, 1);
      p.rect(11, 12, 1, 5, C.bone);
    },
  ];
  makeSheet(scene, 'skeleton', 32, 32, fs);
}

function buildArcher(scene: Phaser.Scene) {
  const bow = (p: Px, drawn: number) => {
    p.ring(19 - drawn, 16, 7, C.brown, -Math.PI / 2, Math.PI / 2);
    p.line(19 - drawn, 9, 19 - drawn - drawn, 16, C.boneMid);
    p.line(19 - drawn - drawn, 16, 19 - drawn, 23, C.boneMid);
  };
  const hood = (p: Px, b: number) => {
    p.rect(12, 4 + b, 9, 4, C.redDark);
    p.rect(11, 6 + b, 3, 8, C.redDark);
  };
  const fs = [
    (p: Px) => { skeletonBase(p, 0, 0); hood(p, 0); bow(p, 0); },
    (p: Px) => { skeletonBase(p, 2, 1); hood(p, 1); bow(p, 0); },
    (p: Px) => { skeletonBase(p, 0, 0); hood(p, 0); bow(p, 2); p.line(15, 16, 28, 16, C.boneMid); p.px(29, 16, C.silver); },
    (p: Px) => { skeletonBase(p, 0, 0); hood(p, 0); bow(p, 0); },
    (p: Px) => { skeletonBase(p, 1, 1); hood(p, 1); },
  ];
  makeSheet(scene, 'archer', 32, 32, fs);
}

function zombieBase(p: Px, step: number, crouch: number) {
  const y = crouch;
  const lx = [12, 14, 17, 14][step], rx = [18, 16, 13, 16][step];
  p.rect(lx, 23 + y, 3, 7 - y, C.brownDark);
  p.rect(rx, 23 + y, 3, 7 - y, C.brown);
  p.rect(rx, 29, 4, 1, C.greenDark);
  // corpo curvado
  p.rect(11, 13 + y, 10, 11, C.brown);
  p.rect(11, 13 + y, 3, 11, C.brownDark);
  p.rect(14, 16 + y, 4, 3, C.green); // pele exposta
  p.px(16, 20 + y, C.greenMid);
  p.rect(12, 22 + y, 2, 2, C.greenMid); // farrapo
  // cabeça projetada à frente
  p.rect(16, 6 + y, 8, 8, C.green);
  p.rect(16, 6 + y, 2, 8, C.greenMid);
  p.rect(16, 5 + y, 5, 2, C.greenDark);
  p.rect(21, 8 + y, 2, 2, C.yellow);
  p.px(22, 9 + y, C.redDark);
  p.rect(19, 12 + y, 5, 1, C.redDark);
}

function buildZombie(scene: Phaser.Scene) {
  const arms = (p: Px, y: number, reach: number) => {
    p.rect(19, 15 + y, 7 + reach, 2, C.green);
    p.rect(19, 15 + y, 2, 2, C.brown);
    p.px(26 + reach, 16 + y, C.greenDark);
    p.rect(18, 18 + y, 6 + reach, 2, C.greenMid);
  };
  const fs = [
    ...[0, 1, 2, 3].map((s) => (p: Px) => { zombieBase(p, s, s % 2); arms(p, s % 2, 0); }),
    (p: Px) => { zombieBase(p, 1, 3); arms(p, 3, -3); },
    (p: Px) => { zombieBase(p, 0, 0); arms(p, -1, 4); },
    (p: Px) => { zombieBase(p, 1, 1); arms(p, -3, -2); },
  ];
  makeSheet(scene, 'zombie', 32, 32, fs);
}

function buildCrow(scene: Phaser.Scene) {
  const body = (p: Px, dive = false) => {
    p.ellipse(12, 9, 5, 3, C.night);
    p.rect(8, 8, 6, 2, C.violet);
    p.rect(16, 6, 4, 4, C.night);
    p.px(18, 7, C.red);
    p.rect(20, 8, 3, 1, C.goldDark);
    if (!dive) { p.rect(3, 8, 4, 2, C.night); p.px(2, 9, C.night); }
  };
  const fs = [
    (p: Px) => { body(p); p.rect(8, 2, 3, 6, C.night); p.rect(10, 1, 3, 6, C.violet); p.rect(6, 1, 2, 3, C.night); },
    (p: Px) => { body(p); p.rect(8, 11, 3, 4, C.night); p.rect(10, 11, 3, 3, C.violet); },
    (p: Px) => { body(p, true); p.rect(4, 7, 6, 2, C.violet); p.rect(2, 6, 4, 2, C.night); },
    (p: Px) => { body(p); p.rect(6, 3, 3, 4, C.lilac); },
  ];
  makeSheet(scene, 'crow', 24, 16, fs);
}

// ---------- MUNDO 2: OS ÁTRIOS DOURADOS ----------

interface KnightPal { armor: string; armorMid: string; armorDark: string; wing: string; wingShade: string; visor: string; spear: string; }
const GOLD_KNIGHT: KnightPal = { armor: C.gold, armorMid: C.goldMid, armorDark: C.goldDark, wing: C.white, wingShade: C.marbleMid, visor: C.cyan, spear: C.silver };
const PROFANE_KNIGHT: KnightPal = { armor: C.stoneMid, armorMid: C.stoneDark, armorDark: C.night, wing: C.voidDark, wingShade: C.night, visor: C.red, spear: C.voidLight };

function knightBody(p: Px, k: KnightPal, flap: number, lean: number) {
  // asas
  if (flap === 0) {
    p.rect(2, 4, 10, 3, k.wing); p.rect(4, 7, 9, 3, k.wing); p.rect(6, 10, 7, 2, k.wingShade); p.rect(1, 3, 4, 2, k.wingShade);
  } else {
    p.rect(3, 14, 10, 3, k.wing); p.rect(1, 17, 9, 3, k.wingShade); p.rect(6, 12, 7, 2, k.wing);
  }
  const x = 11 + lean;
  // pernas/saia de placas
  p.rect(x + 1, 22, 3, 6, k.armorMid); p.rect(x + 5, 22, 3, 7, k.armor);
  p.rect(x, 19, 10, 4, k.armorDark);
  // torso
  p.rect(x, 11, 10, 9, k.armor);
  p.rect(x, 11, 3, 9, k.armorMid);
  p.rect(x + 4, 13, 2, 4, k.armorDark);
  // elmo
  p.rect(x + 2, 3, 8, 8, k.armor);
  p.rect(x + 2, 3, 2, 8, k.armorMid);
  p.rect(x + 5, 6, 5, 2, k.armorDark);
  p.rect(x + 6, 6, 3, 1, k.visor);
  p.rect(x + 4, 1, 3, 2, C.red); // pluma
}

function buildKnight(scene: Phaser.Scene, key: string, k: KnightPal) {
  const spear = (p: Px, x0: number, y0: number, x1: number, y1: number) => {
    p.line(x0, y0, x1, y1, C.brown);
    p.thick(x1, y1, x1, y1, 2, k.spear);
  };
  const fs = [
    (p: Px) => { knightBody(p, k, 0, 0); spear(p, 20, 26, 26, 4); },
    (p: Px) => { knightBody(p, k, 1, 0); spear(p, 20, 27, 26, 5); },
    (p: Px) => { knightBody(p, k, 0, -1); spear(p, 6, 17, 22, 15); p.px(23, 15, k.spear); },
    (p: Px) => { knightBody(p, k, 1, 2); spear(p, 14, 16, 30, 16); p.rect(29, 15, 2, 3, k.spear); },
    (p: Px) => { knightBody(p, k, 1, -2); },
  ];
  makeSheet(scene, key, 32, 32, fs);
}

interface EyePal { white: string; shade: string; iris: string; irisDark: string; ring: string; ringDark: string; }
const OFANIM: EyePal = { white: C.white, shade: C.marbleMid, iris: C.blue, irisDark: C.blueDark, ring: C.gold, ringDark: C.goldDark };
const VOID_EYE: EyePal = { white: C.lilac, shade: C.violet, iris: C.red, irisDark: C.redDark, ring: C.voidLight, ringDark: C.void };

function buildEye(scene: Phaser.Scene, key: string, e: EyePal) {
  const eye = (p: Px, rot: number, open: number, glow: boolean) => {
    // anéis girando
    p.ring(12, 12, 10, e.ringDark);
    for (let i = 0; i < 6; i++) {
      const a = rot + (i / 6) * Math.PI * 2;
      p.rect(Math.round(12 + Math.cos(a) * 10) - 1, Math.round(12 + Math.sin(a) * 10) - 1, 2, 2, e.ring);
    }
    p.circle(12, 12, 7, e.white);
    p.rect(6, 15, 13, 3, e.shade);
    p.circle(13, 12, open, glow ? C.white : e.iris);
    p.circle(13, 12, Math.max(1, open - 2), e.irisDark);
    p.px(11, 9, C.white);
  };
  const fs = [
    (p: Px) => eye(p, 0, 4, false),
    (p: Px) => eye(p, 0.5, 4, false),
    (p: Px) => eye(p, 0.25, 5, true),
    (p: Px) => { eye(p, 0.1, 2, false); p.rect(5, 11, 15, 2, e.shade); },
  ];
  makeSheet(scene, key, 24, 24, fs);
}

function buildSentinel(scene: Phaser.Scene) {
  const body = (p: Px, step: number) => {
    const lx = [12, 14][step % 2], rx = [17, 15][step % 2];
    p.rect(lx, 22, 3, 8, C.goldDark); p.rect(rx, 22, 3, 8, C.goldMid);
    p.rect(11, 11, 10, 12, C.marble); p.rect(11, 11, 3, 12, C.marbleMid);
    p.rect(11, 19, 10, 2, C.gold);
    p.rect(12, 3, 8, 8, C.gold); p.rect(12, 3, 2, 8, C.goldMid);
    p.rect(15, 6, 5, 1, C.outline); p.rect(16, 6, 2, 1, C.cyan);
    p.rect(13, 1, 6, 2, C.goldMid);
  };
  const shield = (p: Px, x: number) => {
    p.rect(x, 9, 6, 16, C.gold); p.rect(x, 9, 2, 16, C.goldMid);
    p.rect(x + 2, 13, 2, 7, C.white); p.rect(x + 1, 15, 4, 2, C.white);
  };
  const spear = (p: Px, x: number, y: number, len: number) => {
    p.rect(x, y, len, 1, C.brown); p.rect(x + len, y - 1, 3, 3, C.silver);
  };
  const fs = [
    (p: Px) => { body(p, 0); spear(p, 8, 17, 10); shield(p, 20); },
    (p: Px) => { body(p, 1); spear(p, 8, 18, 10); shield(p, 20); },
    (p: Px) => { body(p, 0); spear(p, 3, 17, 10); shield(p, 18); },
    (p: Px) => { body(p, 1); shield(p, 14); spear(p, 18, 17, 10); },
    (p: Px) => { body(p, 0); shield(p, 21); p.rect(27, 8, 2, 18, C.white); },
    (p: Px) => { body(p, 1); shield(p, 18); },
  ];
  makeSheet(scene, 'sentinel', 32, 32, fs);
}

// ---------- MUNDO 3: O TRONO USURPADO ----------

function buildFallen(scene: Phaser.Scene) {
  const body = (p: Px, flap: number, bob: number) => {
    // asas negras com olhos
    const wy = flap ? 12 : 4;
    p.rect(1, wy, 11, 4, C.night); p.rect(3, wy + 4, 10, 4, C.voidDark); p.rect(6, wy + 8, 6, 3, C.night);
    p.px(5, wy + 2, C.red); p.px(9, wy + 5, C.red);
    // corpo
    p.rect(12, 13 + bob, 8, 10, C.night);
    p.rect(12, 13 + bob, 8, 2, C.goldDark);
    p.rect(11, 22 + bob, 10, 6, C.voidDark);
    p.rect(13, 27, 2, 3, C.night); p.rect(17, 27, 2, 3, C.night);
    // máscara dourada rachada
    p.rect(13, 4 + bob, 7, 8, C.gold);
    p.rect(13, 4 + bob, 2, 8, C.goldMid);
    p.rect(16, 7 + bob, 3, 1, C.outline);
    p.px(17, 7 + bob, C.red);
    p.line(18, 4 + bob, 15, 11 + bob, C.goldDark);
    // auréola negra
    p.rect(12, 1 + bob, 9, 1, C.voidLight);
  };
  const blade = (p: Px, x0: number, y0: number, x1: number, y1: number) => {
    p.line(x0, y0, x1, y1, C.voidLight);
    p.line(x0, y0 + 1, x1, y1 + 1, C.void);
  };
  const fs = [
    (p: Px) => { body(p, 0, 0); blade(p, 20, 20, 24, 28); },
    (p: Px) => { body(p, 1, 1); blade(p, 20, 21, 24, 29); },
    (p: Px) => { body(p, 0, 0); blade(p, 18, 10, 9, 2); },
    (p: Px) => { body(p, 1, 0); blade(p, 20, 16, 31, 15); p.rect(22, 12, 8, 1, C.voidLight); p.rect(22, 20, 7, 1, C.void); },
    (p: Px) => { body(p, 1, 1); },
  ];
  makeSheet(scene, 'fallen', 32, 32, fs);
}

export function buildEnemyArt(scene: Phaser.Scene) {
  buildSkeleton(scene);
  buildArcher(scene);
  buildZombie(scene);
  buildCrow(scene);
  buildKnight(scene, 'knight', GOLD_KNIGHT);
  buildKnight(scene, 'profane', PROFANE_KNIGHT);
  buildEye(scene, 'ofanim', OFANIM);
  buildEye(scene, 'voideye', VOID_EYE);
  buildSentinel(scene);
  buildFallen(scene);
}
