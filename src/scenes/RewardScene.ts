import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config';
import { txt, panel, fadeIn, goTo } from '../ui/ui';
import { setBackdrop } from '../ui/backdrop';
import { Controls } from '../systems/Controls';
import { Save } from '../state/Save';
import { Music } from '../audio/Music';
import { Sfx } from '../audio/Sfx';
import { LEVEL_BY_ID } from '../data/worlds';
import { AMULET_BY_ID, COLOR_FRAME, COLOR_NAME, COLOR_HEX } from '../data/amulets';
import { WEAPONS } from '../data/weapons';
import { CARDS, RARITY_WEIGHT, RARITY_NAME, RARITY_COLOR, CAT_NAME } from '../data/cards';
import type { CardDef, CardCat, LevelDef } from '../data/types';
import { ENDING_PAGES } from './StoryScene';

type Step = 'summary' | 'amulet' | 'weapon' | 'cards';

const CARD_W = 196, CARD_H = 200, CARD_GAP = 10;

export class RewardScene extends Phaser.Scene {
  controls!: Controls;
  level!: LevelDef;
  steps: Step[] = [];
  step = 0;
  dyn: Phaser.GameObjects.GameObject[] = [];
  offer: CardDef[] = [];
  cardSel = 0;
  row = 0; // 0 = cartas, 1 = botões
  btnSel = 0;
  rerolls = 0;
  done = false;
  earned = { shards: 0, bonus: 0 };
  isFinal = false;

  constructor() { super('Reward'); }

  init(data: { levelId: string; shards: number; firstClear: boolean }) {
    this.level = LEVEL_BY_ID[data.levelId];
    this.isFinal = this.level.boss === 'falseangel';
    this.step = 0;
    this.rerolls = 0;
    this.done = false;
    this.cardSel = 1;
    this.row = 0;
    this.btnSel = 0;
    this.dyn = [];

    const bonus = data.firstClear ? this.level.fragments : Math.round(this.level.fragments / 3);
    this.earned = { shards: data.shards, bonus };
    Save.data.fragments += data.shards + bonus;

    this.steps = ['summary'];
    if (data.firstClear) {
      if (!Save.isCleared(this.level.id)) Save.data.cleared.push(this.level.id);
      if (this.level.amulet) { Save.grantAmulet(this.level.amulet); this.steps.push('amulet'); }
      if (this.level.bossWeapon) { Save.grantWeapon(this.level.bossWeapon); this.steps.push('weapon'); }
      if (!this.isFinal) this.steps.push('cards');
    }
    Save.persist();
  }

  create() {
    fadeIn(this);
    setBackdrop(this, 'titlebg');
    this.controls = new Controls(this);
    this.controls.swallow();
    Music.ambient('reward');
    this.add.image(0, 0, 'titlebg').setOrigin(0).setAlpha(0.4);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x0b0814, 0.55).setOrigin(0);
    this.add.particles(0, 0, 'px', {
      x: { min: 0, max: GAME_W }, y: GAME_H + 4, lifespan: 7000, speedY: { min: -30, max: -10 },
      alpha: { start: 0.8, end: 0 }, tint: [0xffd75e, 0x8ef0ff], frequency: 160,
    });
    this.offer = this.rollCards();
    this.showStep();
  }

  private clear() {
    this.dyn.forEach((o) => o.destroy());
    this.dyn = [];
  }

  private add2<T extends Phaser.GameObjects.GameObject>(o: T) { this.dyn.push(o); return o; }

  private showStep() {
    this.clear();
    const s = this.steps[this.step];
    if (s === 'summary') this.drawSummary();
    else if (s === 'amulet') this.drawAmulet();
    else if (s === 'weapon') this.drawWeapon();
    else this.drawCards();
  }

  private drawSummary() {
    const a = this.add2.bind(this);
    a(panel(this, GAME_W / 2 - 150, 80, 300, 170));
    a(txt(this, GAME_W / 2, 96, 'VITÓRIA', { size: 16, color: '#ffd75e', origin: [0.5, 0] }));
    a(txt(this, GAME_W / 2, 122, `${this.level.id}  ${this.level.name}`, { color: '#b8b0cc', origin: [0.5, 0] }));
    const rows: Array<[string, number]> = [['Coletados', this.earned.shards], ['Bônus da arena', this.earned.bonus]];
    rows.forEach(([k, v], i) => {
      a(txt(this, GAME_W / 2 - 120, 150 + i * 16, k, { color: '#b8b0cc' }));
      a(txt(this, GAME_W / 2 + 120, 150 + i * 16, `+${v}`, { color: '#ffd75e', origin: [1, 0] }));
    });
    a(this.add.sprite(GAME_W / 2 - 116, 190 + 4, 'shard').play('shard-spin'));
    a(txt(this, GAME_W / 2 - 104, 190, 'Fragmentos', { color: '#f4f0ff' }));
    a(txt(this, GAME_W / 2 + 120, 190, String(Save.data.fragments), { color: '#ffd75e', origin: [1, 0] }));
    a(txt(this, GAME_W / 2, 226, '[ENTER] continuar', { color: '#5a4a9a', origin: [0.5, 0] }));
  }

  private drawAmulet() {
    const am = AMULET_BY_ID[this.level.amulet!];
    const a = this.add2.bind(this);
    Sfx.play('amulet');
    a(panel(this, GAME_W / 2 - 220, 26, 440, 312));
    a(txt(this, GAME_W / 2, 40, 'FRAGMENTO DE PODER RECUPERADO', { color: '#8ef0ff', origin: [0.5, 0] }));
    const icon = a(this.add.image(GAME_W / 2, 86, 'amulet', COLOR_FRAME[am.color]).setScale(3));
    this.tweens.add({ targets: icon, y: 80, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    a(txt(this, GAME_W / 2, 118, am.name, { color: COLOR_HEX[am.color], origin: [0.5, 0] }));
    a(txt(this, GAME_W / 2, 132, `Amuleto ${COLOR_NAME[am.color]}`, { color: '#8a7cc8', origin: [0.5, 0] }));
    let y = 154;
    am.desc.forEach((d) => { a(txt(this, GAME_W / 2, y, d, { origin: [0.5, 0] })); y += 12; });
    y += 10;
    a(txt(this, GAME_W / 2, y, '"' + am.flavor + '"', { color: '#8a7cc8', origin: [0.5, 0], align: 'center', wrap: 400 }));
    const eq = Save.isEquipped(am.id);
    a(txt(this, GAME_W / 2, 280, eq ? 'Equipado automaticamente.' : 'Slot cheio: troque na tela de Build.', { color: eq ? '#8ef0ff' : '#e0a030', origin: [0.5, 0] }));
    if (am.ability && eq) a(txt(this, GAME_W / 2, 294, am.ability === 'dash' ? 'Use a investida com [SHIFT]' : 'Use a habilidade com [K]', { color: '#ffd75e', origin: [0.5, 0] }));
    a(txt(this, GAME_W / 2, 316, '[ENTER] continuar', { color: '#5a4a9a', origin: [0.5, 0] }));
  }

  private drawWeapon() {
    const w = WEAPONS[this.level.bossWeapon!];
    const a = this.add2.bind(this);
    Sfx.play('amulet');
    a(panel(this, GAME_W / 2 - 170, 70, 340, 210));
    a(txt(this, GAME_W / 2, 84, 'ARMA OBTIDA', { color: '#ffd75e', origin: [0.5, 0] }));
    a(this.add.image(GAME_W / 2, 128, 'weapon', w.icon).setScale(3));
    a(txt(this, GAME_W / 2, 160, w.name, { color: '#ffd75e', origin: [0.5, 0] }));
    w.desc.forEach((d, i) => a(txt(this, GAME_W / 2, 180 + i * 12, d, { origin: [0.5, 0] })));
    a(txt(this, GAME_W / 2, 236, 'Troque de arma na tela de Build.', { color: '#8a7cc8', origin: [0.5, 0] }));
    a(txt(this, GAME_W / 2, 256, '[ENTER] continuar', { color: '#5a4a9a', origin: [0.5, 0] }));
  }

  // ------------------------------------------------------------------ cartas
  private rollCards(): CardDef[] {
    const pool = CARDS.filter((c) => Save.cardCount(c.id) < c.max && !(c.weapon && Save.data.weapons.includes(c.weapon)));
    const out: CardDef[] = [];
    // sorteio ponderado pela raridade, opcionalmente restrito a uma categoria
    const draw = (cat?: CardCat) => {
      const cand = pool.filter((c) => !cat || c.cat === cat);
      if (!cand.length) return;
      const total = cand.reduce((s, c) => s + RARITY_WEIGHT[c.rarity], 0);
      let r = Math.random() * total;
      let pick = cand[cand.length - 1];
      for (const c of cand) { r -= RARITY_WEIGHT[c.rarity]; if (r <= 0) { pick = c; break; } }
      out.push(pick);
      pool.splice(pool.indexOf(pick), 1);
    };
    // sempre 1 de ataque, 1 de defesa e 1 livre
    draw('atk');
    draw('def');
    while (out.length < 3 && pool.length > 0) draw();
    return Phaser.Utils.Array.Shuffle(out);
  }

  private rerollCost() { return 15 + this.rerolls * 10; }

  private cardIcon(c: CardDef, x: number, y: number) {
    if (c.weapon) return this.add.image(x, y, 'weapon', WEAPONS[c.weapon].icon).setScale(2);
    if (c.mods?.slotRed) return this.add.image(x, y, 'amulet', 0).setScale(2);
    if (c.mods?.slotBlue) return this.add.image(x, y, 'amulet', 1).setScale(2);
    if (c.mods?.slotYellow) return this.add.image(x, y, 'amulet', 2).setScale(2);
    if (c.mods?.maxHp && c.mods.maxHp > 0) return this.add.image(x, y, 'heart', 0).setScale(2);
    if (c.mods?.maxEnergy) return this.add.image(x, y, 'orb', 1).setScale(2);
    return this.add.image(x, y, 'glow').setScale(1.5).setTint(RARITY_COLOR[c.rarity]);
  }

  private drawCards() {
    const a = this.add2.bind(this);
    a(txt(this, GAME_W / 2, 16, 'ESCOLHA UMA CARTA', { size: 16, color: '#ffd75e', origin: [0.5, 0] }));
    a(txt(this, GAME_W / 2, 38, 'Ela fica com você até o fim da jornada.', { color: '#8a7cc8', origin: [0.5, 0] }));
    const x0 = (GAME_W - (CARD_W * 3 + CARD_GAP * 2)) / 2;
    if (this.offer.length === 0) a(txt(this, GAME_W / 2, 150, 'Nenhuma carta restante.', { origin: [0.5, 0] }));
    this.offer.forEach((c, i) => {
      const x = x0 + i * (CARD_W + CARD_GAP), y = 58;
      const sel = this.row === 0 && i === this.cardSel;
      const col = RARITY_COLOR[c.rarity];
      a(panel(this, x, sel ? y - 6 : y, CARD_W, CARD_H, { border: sel ? 0xffd75e : col, inner: col, fill: c.rarity === 'cursed' ? 0x1e0f2a : 0x140c1c }));
      const yy = sel ? y - 6 : y;
      a(txt(this, x + CARD_W / 2, yy + 12, `${CAT_NAME[c.cat]} - ${RARITY_NAME[c.rarity]}`, { origin: [0.5, 0], color: Phaser.Display.Color.IntegerToColor(col).rgba }));
      a(this.cardIcon(c, x + CARD_W / 2, yy + 50));
      a(txt(this, x + CARD_W / 2, yy + 78, c.name, { origin: [0.5, 0], color: sel ? '#ffd75e' : '#f4f0ff' }));
      c.desc.forEach((d, k) => a(txt(this, x + CARD_W / 2, yy + 100 + k * 12, d, { origin: [0.5, 0], color: '#b8b0cc' })));
      const owned = Save.cardCount(c.id);
      if (c.max > 1) a(txt(this, x + CARD_W / 2, yy + CARD_H - 20, `${owned}/${c.max}`, { origin: [0.5, 0], color: '#5a4a9a' }));
      const zone = a(this.add.zone(x, y, CARD_W, CARD_H).setOrigin(0).setInteractive({ useHandCursor: true }));
      zone.on('pointerover', () => { if (this.row !== 0 || this.cardSel !== i) { this.row = 0; this.cardSel = i; Sfx.play('select'); this.showStep(); } });
      zone.on('pointerdown', () => this.pick(i));
    });
    const cost = this.rerollCost();
    const can = Save.data.fragments >= cost;
    const btns = [`Rerrolar (${cost})`, 'Pular (+10)'];
    btns.forEach((b, i) => {
      const sel = this.row === 1 && this.btnSel === i;
      const t = a(txt(this, GAME_W / 2 + (i === 0 ? -90 : 90), 276, b, {
        origin: [0.5, 0], color: sel ? '#ffd75e' : i === 0 && !can ? '#5a5070' : '#f4f0ff',
      }));
      t.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.row = 1; this.btnSel = i; this.pressButton(); });
      if (sel) a(this.add.image(t.x - t.width / 2 - 6, t.y + 4, 'cursor').setOrigin(1, 0.5));
    });
    a(this.add.sprite(GAME_W / 2 - 18, 304, 'shard').play('shard-spin'));
    a(txt(this, GAME_W / 2 - 8, 300, String(Save.data.fragments), { color: '#ffd75e' }));
    a(txt(this, GAME_W / 2, GAME_H - 18, '<- -> escolher   [ENTER] confirmar   baixo: opções', { color: '#5a4a9a', origin: [0.5, 0] }));
  }

  private pick(i: number) {
    if (this.done) return;
    const c = this.offer[i];
    if (!c) return;
    this.done = true;
    Save.grantCard(c.id);
    Save.persist();
    Sfx.play('card');
    Sfx.play('amulet');
    this.cameras.main.flash(250, 255, 215, 94);
    this.time.delayedCall(700, () => this.finish());
  }

  private pressButton() {
    if (this.done) return;
    if (this.btnSel === 0) {
      const cost = this.rerollCost();
      if (Save.data.fragments < cost) { Sfx.play('error'); return; }
      Save.data.fragments -= cost;
      this.rerolls++;
      Save.persist();
      Sfx.play('card');
      this.offer = this.rollCards();
      this.row = 0;
      this.showStep();
    } else {
      this.done = true;
      Save.data.fragments += 10;
      Save.persist();
      Sfx.play('confirm');
      this.finish();
    }
  }

  private finish() {
    if (this.isFinal) goTo(this, 'Story', { pages: ENDING_PAGES, next: 'Ending' }, 800);
    else goTo(this, 'Map', {}, 500);
  }

  private nextStep() {
    Sfx.play('confirm');
    if (this.step + 1 < this.steps.length) { this.step++; this.showStep(); }
    else { this.done = true; this.finish(); }
  }

  update() {
    this.controls.update();
    if (this.done) return;
    const c = this.controls;
    if (this.steps[this.step] !== 'cards') {
      if (c.pressed('confirm')) this.nextStep();
      return;
    }
    let changed = false;
    if (this.row === 0) {
      if (c.pressed('left')) { this.cardSel = (this.cardSel + this.offer.length - 1) % Math.max(1, this.offer.length); changed = true; }
      if (c.pressed('right')) { this.cardSel = (this.cardSel + 1) % Math.max(1, this.offer.length); changed = true; }
      if (c.pressed('down')) { this.row = 1; changed = true; }
      if (c.pressed('confirm')) { this.pick(this.cardSel); return; }
    } else {
      if (c.pressed('left') || c.pressed('right')) { this.btnSel = 1 - this.btnSel; changed = true; }
      if (c.pressed('up')) { this.row = 0; changed = true; }
      if (c.pressed('confirm')) { this.pressButton(); return; }
    }
    if (changed) { Sfx.play('select'); this.showStep(); }
  }
}
