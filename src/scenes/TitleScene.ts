import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config';
import { txt, panel, Menu, fadeIn, goTo, dim } from '../ui/ui';
import { setBackdrop } from '../ui/backdrop';
import { Controls, CONTROL_HELP } from '../systems/Controls';
import { Save } from '../state/Save';
import { Music } from '../audio/Music';
import { Sfx } from '../audio/Sfx';

export class TitleScene extends Phaser.Scene {
  controls!: Controls;
  menu!: Menu;
  sub: Menu | null = null;
  subUi: Phaser.GameObjects.GameObject[] = [];

  constructor() { super('Title'); }

  create() {
    fadeIn(this, 600);
    setBackdrop(this, 'titlebg');
    this.controls = new Controls(this);
    this.controls.swallow();
    this.sub = null;
    this.subUi = [];
    Save.load();
    Music.play('menu');

    this.add.image(0, 0, 'titlebg').setOrigin(0);
    this.add.particles(0, 0, 'px', {
      x: { min: 0, max: GAME_W }, y: -4, lifespan: 8000,
      speedY: { min: 8, max: 22 }, speedX: { min: -6, max: 6 },
      alpha: { start: 0.9, end: 0 }, tint: [0xffd75e, 0xffffff, 0xe0a030], frequency: 120,
    });

    // título
    const title = txt(this, GAME_W / 2, 70, 'TRONO CAÍDO', { size: 32, color: '#ffd75e', origin: [0.5, 0] });
    title.setShadow(2, 2, '#5e1024', 0, false, true);
    txt(this, GAME_W / 2, 112, 'A ASCENSÃO DO EXILADO', { color: '#b8b0cc', origin: [0.5, 0] });
    this.tweens.add({ targets: title, y: 66, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // herói olhando para o trono
    const skin = Save.heroTexture();
    const hero = this.add.sprite(GAME_W / 2, GAME_H - 52, skin, 0).setScale(2).play(`${skin}-idle`);
    const glow = this.add.image(hero.x, hero.y - 30, 'glow').setScale(2).setTint(0xffd75e).setAlpha(0.4);
    this.tweens.add({ targets: glow, alpha: 0.1, duration: 1200, yoyo: true, repeat: -1 });

    const has = Save.hasGame();
    this.menu = new Menu(this, GAME_W / 2 - 64, 160, [
      { label: 'Continuar', disabled: !has, onSelect: () => this.continueGame() },
      { label: 'Novo jogo', onSelect: () => (has ? this.confirmNew() : this.startNew()) },
      { label: 'Controles', onSelect: () => this.showControls() },
      { label: 'Opções', onSelect: () => this.showOptions() },
    ], { spacing: 18 });

    txt(this, GAME_W - 6, GAME_H - 12, 'v0.1', { color: '#5a4a9a', origin: [1, 0] });
  }

  private startNew() {
    Save.newGame();
    goTo(this, 'Prologue', {}, 800);
  }

  private continueGame() {
    // quem ainda não passou do prólogo volta para ele
    if (!Save.data.tutorialDone && Save.data.cleared.length === 0) goTo(this, 'Arena', { levelId: 'prologue' });
    else goTo(this, 'Map');
  }

  private closeSub() {
    this.sub?.destroy();
    this.sub = null;
    this.subUi.forEach((o) => o.destroy());
    this.subUi = [];
    this.menu.setVisible(true);
    this.controls.swallow();
  }

  private openSub(w: number, h: number, title: string) {
    this.menu.setVisible(false);
    const x = (GAME_W - w) / 2, y = (GAME_H - h) / 2;
    this.subUi.push(dim(this, 0.6, 50), panel(this, x, y, w, h).setDepth(51), txt(this, GAME_W / 2, y + 12, title, { origin: [0.5, 0], color: '#ffd75e' }).setDepth(52));
    return { x, y };
  }

  private confirmNew() {
    const { y } = this.openSub(300, 110, 'NOVO JOGO');
    this.subUi.push(txt(this, GAME_W / 2, y + 34, 'Isso apaga o progresso atual.', { origin: [0.5, 0], color: '#e83b3b' }).setDepth(52));
    this.sub = new Menu(this, GAME_W / 2 - 50, y + 62, [
      { label: 'Apagar e começar', onSelect: () => this.startNew() },
      { label: 'Cancelar', onSelect: () => this.closeSub() },
    ], { depth: 52, spacing: 16 });
  }

  private showControls() {
    const { x, y } = this.openSub(380, 200, 'CONTROLES');
    CONTROL_HELP.forEach(([a, k], i) => {
      this.subUi.push(txt(this, x + 20, y + 36 + i * 16, a, { color: '#b8b0cc' }).setDepth(52));
      this.subUi.push(txt(this, x + 170, y + 36 + i * 16, k).setDepth(52));
    });
    this.subUi.push(txt(this, GAME_W / 2, y + 176, 'Gamepad suportado', { origin: [0.5, 0], color: '#8a7cc8' }).setDepth(52));
    this.sub = new Menu(this, -100, -100, [{ label: '', onSelect: () => this.closeSub() }], { depth: 52 });
    this.sub.cursor.setVisible(false);
  }

  private showOptions() {
    const { y } = this.openSub(300, 150, 'OPÇÕES');
    const s = Save.settings;
    const vol = (v: number) => '='.repeat(Math.round(v * 10)).padEnd(10, '-');
    const labels = () => [
      `Música   ${vol(s.music)}`,
      `Efeitos  ${vol(s.sfx)}`,
      `Tremor de tela: ${s.shake ? 'SIM' : 'NÃO'}`,
      'Tela cheia',
      'Voltar',
    ];
    const refresh = () => labels().forEach((l, i) => this.sub?.setLabel(i, l));
    const l = labels();
    this.sub = new Menu(this, GAME_W / 2 - 110, y + 40, [
      { label: l[0], onSelect: () => { s.music = Math.round(((s.music + 0.1) % 1.05) * 10) / 10; Music.setVolume(s.music); Save.persistSettings(); refresh(); } },
      { label: l[1], onSelect: () => { s.sfx = Math.round(((s.sfx + 0.1) % 1.05) * 10) / 10; Sfx.setVolume(s.sfx); Save.persistSettings(); refresh(); } },
      { label: l[2], onSelect: () => { s.shake = !s.shake; Save.persistSettings(); refresh(); } },
      { label: l[3], onSelect: () => { if (this.scale.isFullscreen) this.scale.stopFullscreen(); else this.scale.startFullscreen(); } },
      { label: l[4], onSelect: () => this.closeSub() },
    ], { depth: 52, spacing: 16 });
  }

  update() {
    this.controls.update();
    if (this.sub) {
      this.sub.update(this.controls);
      if (this.controls.pressed('back')) { Sfx.play('back'); this.closeSub(); }
      return;
    }
    this.menu.update(this.controls);
  }
}
