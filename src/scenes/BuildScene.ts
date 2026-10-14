import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config';
import { txt, panel, fadeIn, goTo } from '../ui/ui';
import { setBackdrop } from '../ui/backdrop';
import { Controls } from '../systems/Controls';
import { Save } from '../state/Save';
import { Music } from '../audio/Music';
import { computeStats } from '../state/Stats';
import { Sfx } from '../audio/Sfx';
import { ABILITY_NAME } from '../ui/Hud';
import { AMULETS, AMULET_BY_ID, COLOR_FRAME, COLOR_NAME, COLOR_HEX } from '../data/amulets';
import { WEAPONS } from '../data/weapons';
import { CARD_BY_ID, RARITY_COLOR } from '../data/cards';
import type { AmuletColor, WeaponId } from '../data/types';

type Entry = { kind: 'weapon'; id: WeaponId } | { kind: 'amulet'; id: string };

export class BuildScene extends Phaser.Scene {
  controls!: Controls;
  entries: Entry[] = [];
  sel = 0;
  dyn: Phaser.GameObjects.GameObject[] = [];
  back: { scene: string; levelId?: string } = { scene: 'Map' };

  constructor() { super('Build'); }

  init(data: { back?: string; levelId?: string }) {
    this.back = { scene: data.back ?? 'Map', levelId: data.levelId };
    this.sel = 0;
  }

  create() {
    fadeIn(this);
    setBackdrop(this, 'titlebg');
    Music.play('build');
    this.controls = new Controls(this);
    this.controls.swallow();
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x140c1c).setOrigin(0);
    this.add.image(0, 0, 'titlebg').setOrigin(0).setAlpha(0.15);
    txt(this, 12, 10, 'BUILD', { size: 16, color: '#ffd75e' });
    txt(this, GAME_W - 8, 14, '[ENTER] equipar   [ESC] voltar', { color: '#5a4a9a', origin: [1, 0] });

    this.entries = [
      ...Save.data.weapons.map((id) => ({ kind: 'weapon' as const, id })),
      ...AMULETS.filter((a) => Save.data.amulets.includes(a.id)).map((a) => ({ kind: 'amulet' as const, id: a.id })),
    ];
    this.draw();
  }

  private draw() {
    this.dyn.forEach((o) => o.destroy());
    this.dyn = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => { this.dyn.push(o); return o; };

    // ---- slots equipados ----
    add(panel(this, 8, 32, 300, 92));
    add(txt(this, 18, 42, 'EQUIPADO', { color: '#8a7cc8' }));
    const w = WEAPONS[Save.data.weapon];
    add(this.add.image(26, 66, 'weapon', w.icon));
    add(txt(this, 40, 62, w.name));
    (['red', 'blue', 'yellow'] as AmuletColor[]).forEach((c, ci) => {
      const y = 84 + ci * 13;
      add(txt(this, 18, y, COLOR_NAME[c].slice(0, 3).toUpperCase(), { color: COLOR_HEX[c] }));
      const slots = Save.slots(c);
      const eq = Save.data.equipped[c];
      for (let s = 0; s < slots; s++) {
        const id = eq[s];
        add(this.add.image(60 + s * 18, y + 3, 'amulet', id ? COLOR_FRAME[c] : 3).setScale(0.75));
        if (id && s === 0) add(txt(this, 60 + slots * 18, y, AMULET_BY_ID[id].name, { color: '#b8b0cc' }));
      }
    });

    // ---- inventário ----
    add(panel(this, 8, 130, 300, 222));
    add(txt(this, 18, 140, 'INVENTÁRIO', { color: '#8a7cc8' }));
    if (this.entries.length === 0) add(txt(this, 18, 160, 'Vazio.', { color: '#5a5070' }));
    this.entries.forEach((e, i) => {
      const y = 158 + i * 14;
      const isSel = i === this.sel;
      if (e.kind === 'weapon') {
        const wd = WEAPONS[e.id];
        add(this.add.image(26, y + 3, 'weapon', wd.icon).setScale(0.75));
        const on = Save.data.weapon === e.id;
        add(txt(this, 40, y, `${wd.name}${on ? '  [E]' : ''}`, { color: isSel ? '#ffd75e' : on ? '#8ef0ff' : '#f4f0ff' }));
      } else {
        const a = AMULET_BY_ID[e.id];
        add(this.add.image(26, y + 3, 'amulet', COLOR_FRAME[a.color]).setScale(0.75));
        const on = Save.isEquipped(a.id);
        add(txt(this, 40, y, `${a.name}${on ? '  [E]' : ''}`, { color: isSel ? '#ffd75e' : on ? '#8ef0ff' : '#f4f0ff' }));
      }
      if (isSel) add(this.add.image(16, y + 3, 'cursor').setOrigin(1, 0.5));
    });

    // ---- descrição ----
    add(panel(this, 316, 32, GAME_W - 324, 150));
    const e = this.entries[this.sel];
    if (e) {
      if (e.kind === 'weapon') {
        const wd = WEAPONS[e.id];
        add(txt(this, 326, 42, wd.name, { color: '#ffd75e' }));
        add(txt(this, 326, 56, 'ARMA', { color: '#8a7cc8' }));
        wd.desc.forEach((d, i) => add(txt(this, 326, 76 + i * 12, d)));
      } else {
        const a = AMULET_BY_ID[e.id];
        add(txt(this, 326, 42, a.name, { color: COLOR_HEX[a.color] }));
        add(txt(this, 326, 56, `AMULETO ${COLOR_NAME[a.color].toUpperCase()}`, { color: '#8a7cc8' }));
        a.desc.forEach((d, i) => add(txt(this, 326, 76 + i * 12, d)));
        add(txt(this, 326, 76 + a.desc.length * 12 + 8, `"${a.flavor}"`, { color: '#8a7cc8', wrap: 290 }));
      }
    }

    // ---- atributos ----
    const st = computeStats();
    add(panel(this, 316, 188, GAME_W - 324, 164));
    add(txt(this, 326, 198, 'ATRIBUTOS', { color: '#8a7cc8' }));
    const pct = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
    const lines: Array<[string, string]> = [
      ['Vida', String(st.maxHp)],
      ['Energia', String(st.maxEnergy)],
      ['Dano', `${Math.round(st.damage * st.damageMult)}`],
      ['Golpes/s', (1 / st.attackCooldown).toFixed(1)],
      ['Movimento', pct(st.moveSpeed / 115 - 1)],
      ['Cura', `${st.healTime.toFixed(2)}s`],
      ['Energia/golpe', pct(st.energyPerHit / 0.25 - 1)],
      ['Habilidades', [...(st.dash ? ['dash'] : []), ...st.abilities].map((a) => ABILITY_NAME[a]).join(', ') || '-'],
    ];
    lines.forEach(([k, v], i) => {
      add(txt(this, 326, 214 + i * 12, k, { color: '#b8b0cc' }));
      add(txt(this, GAME_W - 18, 214 + i * 12, v, { origin: [1, 0] }));
    });
    const cards = Object.entries(Save.data.cards);
    add(txt(this, 326, 316, `CARTAS (${cards.reduce((s, [, n]) => s + n, 0)})`, { color: '#8a7cc8' }));
    const names = cards.map(([id, n]) => ({ s: `${CARD_BY_ID[id]?.name ?? id}${n > 1 ? ' x' + n : ''}`, r: CARD_BY_ID[id]?.rarity ?? 'common' }));
    let cx = 326, cy = 330;
    for (const n of names) {
      const t = add(txt(this, cx, cy, n.s, { color: Phaser.Display.Color.IntegerToColor(RARITY_COLOR[n.r]).rgba }));
      cx += t.width + 8;
      if (cx > GAME_W - 30) { cx = 326; cy += 10; }
    }
  }

  private activate() {
    const e = this.entries[this.sel];
    if (!e) return;
    if (e.kind === 'weapon') Save.data.weapon = e.id;
    else Save.toggleEquip(e.id);
    Save.persist();
    Sfx.play('confirm');
    this.draw();
  }

  update() {
    this.controls.update();
    const c = this.controls;
    const n = this.entries.length;
    if (n && c.pressed('up')) { this.sel = (this.sel - 1 + n) % n; Sfx.play('select'); this.draw(); }
    if (n && c.pressed('down')) { this.sel = (this.sel + 1) % n; Sfx.play('select'); this.draw(); }
    if (c.pressed('confirm')) this.activate();
    else if (c.pressed('back')) {
      Sfx.play('back');
      if (this.back.scene === 'Arena') goTo(this, 'Arena', { levelId: this.back.levelId });
      else goTo(this, 'Map');
    }
  }
}
