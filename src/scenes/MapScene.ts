import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config';
import { txt, panel, fadeIn, goTo } from '../ui/ui';
import { setBackdrop } from '../ui/backdrop';
import { Controls } from '../systems/Controls';
import { Save } from '../state/Save';
import { Music } from '../audio/Music';
import { Sfx } from '../audio/Sfx';
import { WORLDS, LEVEL_ORDER, LEVEL_BY_ID, ENEMY_NAMES, BOSS_NAMES } from '../data/worlds';
import { AMULET_BY_ID, COLOR_FRAME, COLOR_NAME } from '../data/amulets';
import { WEAPONS } from '../data/weapons';

const BAND_H = 108;
const BAND_TOP = (w: number) => GAME_H - 18 - (w + 1) * BAND_H; // mundo 0 embaixo

function nodePos(world: number, index: number): [number, number] {
  const xs = [70, 140, 210, 140];
  const top = BAND_TOP(world);
  return [xs[index] + (world % 2 ? 40 : 0), top + BAND_H - 24 - index * 22];
}

export class MapScene extends Phaser.Scene {
  controls!: Controls;
  sel = 0;
  cursor!: Phaser.GameObjects.Image;
  info: Phaser.GameObjects.GameObject[] = [];
  nodes: Phaser.GameObjects.Image[] = [];

  constructor() { super('Map'); }

  create() {
    fadeIn(this);
    setBackdrop(this, WORLDS[LEVEL_BY_ID[Save.nextLevel()].world - 1].bg);
    this.controls = new Controls(this);
    this.controls.swallow();
    Music.play('map');
    this.info = [];
    this.nodes = [];

    // faixas de cada mundo com recorte do cenário
    WORLDS.forEach((w, i) => {
      const top = BAND_TOP(i);
      const img = this.add.image(0, top - 130, w.bg).setOrigin(0);
      img.setCrop(0, 130, 300, BAND_H);
      this.add.rectangle(0, top, 300, BAND_H, 0x0b0814, 0.62).setOrigin(0);
      this.add.rectangle(0, top, 300, 1, w.tint, 0.6).setOrigin(0);
      txt(this, 8, top + 6, `MUNDO ${w.id}`, { color: Phaser.Display.Color.IntegerToColor(w.tint).rgba });
      txt(this, 8, top + 18, w.name.toUpperCase(), { color: '#b8b0cc' });
    });
    this.add.rectangle(300, 0, GAME_W - 300, GAME_H, 0x0b0814, 1).setOrigin(0);

    // caminho
    const g = this.add.graphics();
    for (let i = 0; i < LEVEL_ORDER.length - 1; i++) {
      const a = LEVEL_BY_ID[LEVEL_ORDER[i]], b = LEVEL_BY_ID[LEVEL_ORDER[i + 1]];
      const [x0, y0] = nodePos(a.world - 1, a.index - 1);
      const [x1, y1] = nodePos(b.world - 1, b.index - 1);
      const done = Save.isCleared(a.id);
      g.lineStyle(2, done ? 0xe0a030 : 0x3b2d6b, 1);
      for (let k = 0; k <= 10; k += 2) {
        const t0 = k / 10, t1 = Math.min(1, (k + 1) / 10);
        g.lineBetween(x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0, x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1);
      }
    }

    // nós
    LEVEL_ORDER.forEach((id, i) => {
      const l = LEVEL_BY_ID[id];
      const [x, y] = nodePos(l.world - 1, l.index - 1);
      const cleared = Save.isCleared(id), unlocked = Save.isUnlocked(id);
      let frame = 4;
      if (unlocked) frame = l.boss ? 0 : l.amulet ? COLOR_FRAME[AMULET_BY_ID[l.amulet].color] : 3;
      const n = this.add.image(x, y, 'amulet', frame).setScale(l.boss ? 1.5 : 1);
      if (cleared) n.setTint(0xffd75e);
      if (!unlocked) n.setAlpha(0.6);
      n.setInteractive({ useHandCursor: unlocked });
      n.on('pointerdown', () => { if (unlocked) { if (this.sel === i) this.enter(); else { this.sel = i; this.refresh(); } } });
      this.nodes.push(n);
      if (cleared) txt(this, x + 11, y - 4, 'v', { color: '#ffd75e' });
    });

    this.cursor = this.add.image(0, 0, 'cursor').setOrigin(1, 0.5);
    this.sel = LEVEL_ORDER.indexOf(Save.nextLevel());

    txt(this, 310, GAME_H - 26, '[ENTER] lutar  [B/K] build  [ESC] título', { color: '#5a4a9a' });
    this.add.sprite(GAME_W - 70, 10, 'shard').setOrigin(0).play('shard-spin');
    txt(this, GAME_W - 58, 10, String(Save.data.fragments), { color: '#ffd75e' });
    this.input.keyboard!.on('keydown-B', () => goTo(this, 'Build', { back: 'Map' }));
    this.refresh();
  }

  private refresh() {
    this.info.forEach((o) => o.destroy());
    this.info = [];
    const id = LEVEL_ORDER[this.sel];
    const l = LEVEL_BY_ID[id];
    const w = WORLDS[l.world - 1];
    const n = this.nodes[this.sel];
    this.cursor.setPosition(n.x - n.displayWidth / 2 - 2, n.y);
    this.tweens.killTweensOf(this.cursor);
    this.tweens.add({ targets: this.cursor, x: '-=3', duration: 300, yoyo: true, repeat: -1 });

    const X = 312;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => { this.info.push(o); return o; };
    add(panel(this, 306, 24, GAME_W - 314, 300));
    add(txt(this, X + 6, 36, `${w.name.toUpperCase()}  ${l.id}`, { color: '#8a7cc8' }));
    add(txt(this, X + 6, 52, l.name, { size: 8, color: '#ffd75e' }));
    add(txt(this, X + 6, 66, w.subtitle, { color: '#b8b0cc', wrap: 290 }));

    let y = 96;
    if (l.boss) {
      const b = BOSS_NAMES[l.boss];
      add(txt(this, X + 6, y, 'CHEFE', { color: '#e83b3b' }));
      add(txt(this, X + 6, y + 14, `${b.name}`, { color: '#f4f0ff' }));
      add(txt(this, X + 6, y + 26, b.title, { color: '#b8b0cc' }));
      y += 48;
      if (l.bossWeapon) {
        add(txt(this, X + 6, y, 'RECOMPENSA', { color: '#8ef0ff' }));
        add(this.add.image(X + 14, y + 20, 'weapon', WEAPONS[l.bossWeapon].icon));
        add(txt(this, X + 28, y + 16, WEAPONS[l.bossWeapon].name));
        y += 40;
      }
    } else {
      add(txt(this, X + 6, y, 'ARENA  - 3 ondas', { color: '#e83b3b' }));
      const kinds = [...new Set(l.waves!.flat())].map((k) => ENEMY_NAMES[k]);
      kinds.forEach((k, i) => add(txt(this, X + 14, y + 14 + i * 12, `- ${k}`, { color: '#b8b0cc' })));
      y += 22 + kinds.length * 12;
      if (l.amulet) {
        const a = AMULET_BY_ID[l.amulet];
        const got = Save.data.amulets.includes(a.id);
        add(txt(this, X + 6, y, got ? 'AMULETO (obtido)' : 'RECOMPENSA', { color: '#8ef0ff' }));
        add(this.add.image(X + 14, y + 20, 'amulet', COLOR_FRAME[a.color]));
        add(txt(this, X + 28, y + 12, a.name));
        add(txt(this, X + 28, y + 24, `Amuleto ${COLOR_NAME[a.color]}`, { color: '#b8b0cc' }));
        y += 42;
        a.desc.forEach((d, i) => add(txt(this, X + 6, y + i * 12, d, { color: '#f4f0ff' })));
        y += a.desc.length * 12 + 6;
      }
    }
    const state = Save.isCleared(id) ? 'CONCLUÍDO - rejogar dá fragmentos' : 'Vença para receber 1 carta';
    add(txt(this, X + 6, 300, state, { color: Save.isCleared(id) ? '#ffd75e' : '#8a7cc8' }));
  }

  private move(d: number) {
    let i = this.sel + d;
    if (i < 0 || i >= LEVEL_ORDER.length || !Save.isUnlocked(LEVEL_ORDER[i])) { Sfx.play('error'); return; }
    this.sel = i;
    Sfx.play('select');
    this.refresh();
  }

  private enter() {
    Sfx.play('confirm');
    goTo(this, 'Arena', { levelId: LEVEL_ORDER[this.sel] }, 400);
  }

  update() {
    this.controls.update();
    const c = this.controls;
    if (c.pressed('up') || c.pressed('right')) this.move(1);
    if (c.pressed('down') || c.pressed('left')) this.move(-1);
    if (c.pressed('confirm')) this.enter();
    else if (c.pressed('skill1')) goTo(this, 'Build', { back: 'Map' });
    else if (c.pressed('pause')) goTo(this, 'Title');
  }
}
