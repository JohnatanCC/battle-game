import Phaser from 'phaser';
import { C } from './palette';
import { Px, makeSheet, makeTex, frames } from './Px';

function arc(p: Px, cx: number, cy: number, r: number, thick: number, a0: number, a1: number, col: string, edge: string) {
  for (let t = 0; t < thick; t++) p.ring(cx, cy, r - t, t === 0 ? edge : col, a0, a1);
}

export function buildFxArt(scene: Phaser.Scene) {
  // Corte de espada (40x32) — crescente
  makeSheet(scene, 'slash', 40, 32, frames(3, (p, i) => {
    const thick = [4, 5, 2][i];
    const span = [1.6, 2.4, 2.6][i];
    arc(p, 8, 16, 26, thick, -span / 2, span / 2, i === 2 ? C.silverMid : C.white, C.gold);
  }), null);

  // Foice (52x44)
  makeSheet(scene, 'scytheArc', 52, 44, frames(3, (p, i) => {
    const thick = [5, 6, 3][i];
    arc(p, 10, 22, 36, thick, -1.3 - i * 0.2, 1.3 + i * 0.2, i === 2 ? C.violet : C.voidLight, C.white);
  }), null);

  // Estocada da lança (56x12)
  makeSheet(scene, 'thrust', 56, 12, frames(3, (p, i) => {
    const len = [30, 54, 50][i];
    p.rect(0, 5, len, 2, i === 2 ? C.silverMid : C.white);
    p.rect(len - 8, 4, 8, 4, C.gold);
    p.rect(len - 3, 5, 3, 2, C.white);
    if (i < 2) p.rect(4, 3, len - 16, 1, C.silverMid);
  }), null);

  // Soco das manoplas (24x20)
  makeSheet(scene, 'punch', 24, 20, frames(3, (p, i) => {
    p.ring(8 + i * 3, 10, 4 + i * 3, i === 2 ? C.goldMid : C.gold, -1.2, 1.2);
    p.ring(8 + i * 3, 10, 3 + i * 3, C.white, -1, 1);
  }), null);

  // Faísca de impacto
  makeSheet(scene, 'spark', 16, 16, frames(4, (p, i) => {
    const r = [3, 6, 7, 7][i];
    const col = i < 2 ? C.white : C.gold;
    p.rect(8 - r, 7, r * 2, 2, col);
    p.rect(7, 8 - r, 2, r * 2, col);
    if (i < 3) p.circle(8, 8, 2 - Math.floor(i / 2), C.white);
    if (i === 1) { p.line(3, 3, 12, 12, C.gold); p.line(12, 3, 3, 12, C.gold); }
  }), null);

  // Fumaça de morte
  makeSheet(scene, 'puff', 16, 16, frames(4, (p, i) => {
    const r = 3 + i * 1.5;
    p.circle(8, 8, Math.round(r), i < 2 ? C.lilac : C.violet);
    if (i < 3) p.circle(8, 8, Math.round(r - 2), i === 0 ? C.white : C.lilac);
    if (i === 3) p.dither(2, 2, 12, 12, C.deep);
  }), null);

  // Portal de surgimento (24x24)
  makeSheet(scene, 'portal', 24, 24, frames(4, (p, i) => {
    p.ellipse(12, 12, 9, 11, C.voidDark);
    p.ellipse(12, 12, 6, 8, C.void);
    for (let k = 0; k < 3; k++) {
      const a = i * 0.8 + k * 2.1;
      p.rect(Math.round(12 + Math.cos(a) * 5), Math.round(12 + Math.sin(a) * 7), 2, 2, C.voidLight);
    }
    p.ellipse(12, 12, 2, 4, C.black);
  }), null);

  // ---- Projéteis ----
  makeTex(scene, 'bone', 10, 10, (p) => {
    p.rect(2, 4, 6, 2, C.bone);
    p.rect(1, 3, 2, 2, C.bone); p.rect(1, 5, 2, 2, C.boneMid);
    p.rect(7, 3, 2, 2, C.bone); p.rect(7, 5, 2, 2, C.boneMid);
  }, C.outline);
  makeTex(scene, 'arrow', 14, 5, (p) => {
    p.rect(1, 2, 10, 1, C.brown);
    p.rect(10, 1, 3, 3, C.silver);
    p.rect(1, 1, 2, 3, C.redMid);
  }, null);
  makeSheet(scene, 'holyorb', 10, 10, frames(2, (p, i) => {
    p.circle(5, 5, 4, i ? C.gold : C.yellow);
    p.circle(5, 5, 2, C.white);
  }), null);
  makeTex(scene, 'feather', 12, 6, (p) => {
    p.rect(1, 2, 9, 2, C.white);
    p.rect(1, 3, 9, 1, C.marbleMid);
    p.rect(9, 2, 2, 1, C.gold);
    p.rect(0, 2, 1, 1, C.gold);
  }, null);
  makeSheet(scene, 'darkorb', 12, 12, frames(2, (p, i) => {
    p.circle(6, 6, 5, C.voidDark);
    p.circle(6, 6, 4, i ? C.void : C.voidLight);
    p.circle(6, 6, 1, C.white);
  }), null);
  makeTex(scene, 'lance', 6, 26, (p) => {
    p.rect(2, 0, 2, 18, C.gold);
    p.rect(2, 0, 1, 18, C.white);
    p.rect(1, 18, 4, 2, C.goldDark);
    p.rect(2, 20, 2, 6, C.white);
    p.rect(2, 25, 2, 1, C.cyan);
  }, null);
  makeTex(scene, 'spike', 12, 30, (p) => {
    for (let y = 0; y < 30; y++) {
      const w = Math.max(1, Math.round((y / 30) * 5));
      p.rect(6 - w, y, w * 2, 1, y % 6 < 2 ? C.boneMid : C.bone);
    }
    p.rect(4, 26, 4, 2, C.boneDark);
  }, C.outline);
  makeSheet(scene, 'wave', 16, 20, frames(2, (p, i) => {
    for (let y = 0; y < 20; y++) {
      const w = Math.round(2 + Math.sin((y / 20) * Math.PI) * (5 + i));
      p.rect(8 - w, y, w, 1, y % 3 === 0 ? C.white : C.gold);
    }
  }), null);
  makeSheet(scene, 'meteor', 16, 16, frames(2, (p, i) => {
    p.circle(8, 9, 5, C.voidDark);
    p.circle(8, 9, 3, i ? C.void : C.voidLight);
    p.rect(7, 0, 2, 4, C.void);
    p.rect(5, 2, 1, 3, C.voidDark); p.rect(10, 1, 1, 3, C.voidDark);
  }), null);

  // ---- Partículas ----
  makeTex(scene, 'px', 2, 2, (p) => p.rect(0, 0, 2, 2, '#ffffff'));
  makeTex(scene, 'dot', 1, 1, (p) => p.rect(0, 0, 1, 1, '#ffffff'));
  makeTex(scene, 'pfeather', 5, 3, (p) => { p.rect(0, 1, 4, 1, '#ffffff'); p.rect(1, 0, 3, 1, '#ffffff'); p.px(4, 2, '#ffffff'); });
  makeTex(scene, 'glow', 16, 16, (p) => {
    p.circle(8, 8, 7, 'rgba(255,255,255,0.15)');
    p.circle(8, 8, 5, 'rgba(255,255,255,0.3)');
    p.circle(8, 8, 3, 'rgba(255,255,255,0.6)');
  });

  // ---- Interface ----
  makeSheet(scene, 'heart', 11, 10, [
    (p) => { p.rect(1, 1, 3, 2, C.red); p.rect(6, 1, 3, 2, C.red); p.rect(0, 2, 10, 3, C.red); p.rect(1, 5, 8, 2, C.red); p.rect(3, 7, 4, 1, C.red); p.rect(4, 8, 2, 1, C.redMid); p.rect(1, 2, 2, 1, C.white); p.rect(1, 5, 8, 1, C.redMid); },
    (p) => { p.rect(1, 1, 3, 2, C.stoneDark); p.rect(6, 1, 3, 2, C.stoneDark); p.rect(0, 2, 10, 3, C.stoneDark); p.rect(1, 5, 8, 2, C.stoneDark); p.rect(3, 7, 4, 1, C.stoneDark); p.rect(4, 8, 2, 1, C.stoneDark); },
  ], C.outline);
  makeSheet(scene, 'orb', 11, 11, [
    (p) => { p.circle(5, 5, 4, C.night); p.ring(5, 5, 4, C.stone); },
    (p) => { p.circle(5, 5, 4, C.blue); p.circle(5, 6, 3, C.blueMid); p.rect(3, 3, 2, 1, C.cyan); p.px(3, 4, C.white); },
  ], C.outline);
  makeSheet(scene, 'shard', 8, 8, frames(2, (p, i) => {
    p.rect(3, 0, 2, 8, C.gold); p.rect(1, 2, 6, 4, C.gold); p.rect(2, 1, 4, 6, C.gold);
    p.rect(3, 1, 1, 5, i ? C.white : C.yellow);
    p.rect(5, 3, 1, 3, C.goldDark);
  }), C.outline);

  // Amuletos: 0 vermelho, 1 azul, 2 amarelo, 3 slot vazio, 4 bloqueado
  const gem = (p: Px, base: string, mid: string, dark: string, shape: number) => {
    p.ring(8, 8, 6, C.goldDark);
    p.ring(8, 8, 7, C.goldMid);
    p.rect(7, 0, 2, 2, C.gold);
    if (shape === 0) { p.circle(8, 8, 4, base); p.rect(5, 9, 7, 2, mid); p.rect(9, 11, 2, 1, dark); }
    if (shape === 1) { for (let y = -4; y <= 4; y++) p.rect(8 - (4 - Math.abs(y)), 8 + y, (4 - Math.abs(y)) * 2 + 1, 1, y > 0 ? mid : base); }
    if (shape === 2) { p.rect(5, 5, 7, 7, base); p.rect(5, 9, 7, 3, mid); p.rect(11, 5, 1, 7, dark); }
    p.px(6, 6, C.white);
  };
  makeSheet(scene, 'amulet', 16, 16, [
    (p) => gem(p, C.red, C.redMid, C.redDark, 0),
    (p) => gem(p, C.blue, C.blueMid, C.blueDark, 1),
    (p) => gem(p, C.yellow, C.yellowMid, C.goldDark, 2),
    (p) => { p.ring(8, 8, 6, C.stoneMid); p.ring(8, 8, 7, C.stoneDark); },
    (p) => { p.ring(8, 8, 6, C.stoneDark); p.line(5, 5, 11, 11, C.stoneDark); p.line(11, 5, 5, 11, C.stoneDark); },
  ], C.outline);

  // Armas: 0 espada, 1 lança, 2 foice, 3 manoplas
  makeSheet(scene, 'weapon', 16, 16, [
    (p) => { p.line(3, 13, 12, 4, C.silver); p.line(4, 13, 13, 4, C.silverMid); p.rect(2, 10, 5, 2, C.gold); p.rect(1, 13, 3, 2, C.brown); p.px(13, 3, C.white); },
    (p) => { p.line(1, 15, 12, 4, C.brown); p.rect(11, 2, 3, 3, C.silver); p.rect(13, 1, 2, 2, C.white); p.rect(9, 5, 2, 2, C.gold); },
    (p) => { p.line(3, 15, 9, 2, C.brownDark); p.thick(9, 2, 15, 5, 2, C.voidLight); p.rect(14, 6, 1, 3, C.voidLight); p.px(10, 2, C.white); },
    (p) => { p.rect(2, 5, 8, 7, C.gold); p.rect(2, 5, 8, 2, C.yellow); p.rect(10, 6, 3, 5, C.goldMid); p.rect(3, 12, 6, 3, C.goldDark); p.px(4, 7, C.white); },
  ], C.outline);

  makeTex(scene, 'cursor', 8, 8, (p) => { p.rect(0, 0, 2, 8, C.gold); p.rect(2, 1, 2, 6, C.gold); p.rect(4, 2, 2, 4, C.gold); p.rect(6, 3, 1, 2, C.gold); p.rect(0, 0, 1, 8, C.white); }, C.outline);
}
