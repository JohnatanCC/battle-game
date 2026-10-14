import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config';
import { txt, fadeIn, goTo } from '../ui/ui';
import { Controls } from '../systems/Controls';
import { Save } from '../state/Save';
import { Music } from '../audio/Music';
import { Sfx } from '../audio/Sfx';

export const INTRO_PAGES = [
  'Antes do tempo, tu eras a Chama do Trono,\no primeiro entre os que guardam os céus.',
  'Mas um dos teus, um anjo de rosto dourado,\nsussurrou mentiras aos ouvidos do reino.',
  'Tua coroa foi partida. Tuas asas, arrancadas.\nE foste lançado às profundezas.',
  'Despertas agora entre ossos e corvos.\nAinda resta uma faísca de divindade em ti.',
  'Recolhe teus amuletos. Recupera teu poder.\nSobe, mundo após mundo...',
  '...e derruba o Falso Anjo\nque se senta no teu trono.',
];

export const ENDING_PAGES = [
  'A máscara dourada se desfaz em cinzas.\nO usurpador cai do alto do trono.',
  'Os céus silenciam. Os anjos que te julgaram\nbaixam suas lanças.',
  'Tua auréola se refaz, ainda rachada,\nmas brilhando como nunca.',
  'Tu, que foste lançado ao abismo,\nsubiste cada degrau com as próprias mãos.',
  'O trono é teu outra vez.\nQue os céus se lembrem do preço da queda.',
];

/** Cena de texto com efeito máquina de escrever. Reutilizada no final. */
export class StoryScene extends Phaser.Scene {
  controls!: Controls;
  pages: string[] = [];
  page = 0;
  shown = 0;
  body!: Phaser.GameObjects.Text;
  hint!: Phaser.GameObjects.Text;
  next = 'Map';
  acc = 0;

  constructor(key = 'Story') { super(key); }

  init(data: { pages?: string[]; next?: string }) {
    this.pages = data.pages ?? INTRO_PAGES;
    this.next = data.next ?? 'Map';
    this.page = 0;
    this.shown = 0;
    this.acc = 0;
  }

  create() {
    fadeIn(this, 800);
    this.controls = new Controls(this);
    this.controls.swallow();
    Music.play(this.pages === ENDING_PAGES ? 'ending' : 'story');
    this.add.image(0, 0, 'titlebg').setOrigin(0).setAlpha(0.35);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x0b0814, 0.5).setOrigin(0);
    this.body = txt(this, GAME_W / 2, GAME_H / 2 - 20, '', { origin: [0.5, 0], align: 'center', lineSpacing: 10 });
    this.hint = txt(this, GAME_W / 2, GAME_H - 30, '[ENTER] continuar    [ESC] pular', { origin: [0.5, 0], color: '#5a4a9a' });
  }

  update(_t: number, delta: number) {
    this.controls.update();
    if (this.controls.pressed('back') && !this.controls.pressed('confirm')) return this.finish();
    const full = this.pages[this.page];
    this.acc += delta;
    if (this.shown < full.length && this.acc > 28) {
      this.acc = 0;
      this.shown++;
      if (full[this.shown - 1] !== ' ' && this.shown % 2 === 0) Sfx.play('select');
    }
    this.body.setText(full.slice(0, this.shown));
    if (this.controls.pressed('confirm')) {
      if (this.shown < full.length) this.shown = full.length;
      else if (this.page + 1 < this.pages.length) { this.page++; this.shown = 0; }
      else this.finish();
    }
  }

  private finish() {
    if (this.next === 'Map') { Save.data.introSeen = true; Save.persist(); }
    goTo(this, this.next, {}, 700);
  }
}
