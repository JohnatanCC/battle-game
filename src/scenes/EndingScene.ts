import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config';
import { txt, fadeIn, goTo } from '../ui/ui';
import { setBackdrop } from '../ui/backdrop';
import { Controls } from '../systems/Controls';
import { Save } from '../state/Save';
import { Music } from '../audio/Music';
import { CARD_BY_ID } from '../data/cards';

/** Créditos e estatísticas finais */
export class EndingScene extends Phaser.Scene {
  controls!: Controls;
  ready = 0;

  constructor() { super('Ending'); }

  create() {
    fadeIn(this, 1200);
    setBackdrop(this, 'titlebg');
    this.controls = new Controls(this);
    this.controls.swallow();
    this.ready = 1.5;
    Music.play('ending');
    Save.data.finished = true;
    Save.persist();

    this.add.image(0, 0, 'titlebg').setOrigin(0);
    this.add.particles(0, 0, 'pfeather', {
      x: { min: 0, max: GAME_W }, y: -6, lifespan: 9000, speedY: { min: 12, max: 26 }, speedX: { min: -10, max: 10 },
      rotate: { min: 0, max: 360 }, alpha: { start: 1, end: 0 }, frequency: 140,
    });
    const hero = this.add.sprite(GAME_W / 2, 64, 'hero', 0).setScale(2).play('hero-idle');
    this.add.image(hero.x, hero.y - 24, 'glow').setScale(3).setTint(0xffd75e).setAlpha(0.5);

    txt(this, GAME_W / 2, 110, 'FIM', { size: 32, color: '#ffd75e', origin: [0.5, 0] });
    txt(this, GAME_W / 2, 150, 'O exilado retomou o Trono Caído.', { origin: [0.5, 0], color: '#b8b0cc' });

    const d = Save.data;
    const cards = Object.entries(d.cards).map(([id, n]) => `${CARD_BY_ID[id]?.name ?? id}${n > 1 ? ' x' + n : ''}`);
    const lines = [
      `Quedas: ${d.deaths}`,
      `Amuletos: ${d.amulets.length}/9`,
      `Fragmentos: ${d.fragments}`,
      `Cartas: ${cards.length}`,
    ];
    lines.forEach((l, i) => txt(this, GAME_W / 2, 186 + i * 14, l, { origin: [0.5, 0] }));
    txt(this, GAME_W / 2, 260, 'Música: faixas originais feitas no Suno', { origin: [0.5, 0], color: '#8a7cc8' });
    txt(this, GAME_W / 2, 274, 'Arte e código: gerados para este jogo', { origin: [0.5, 0], color: '#8a7cc8' });
    txt(this, GAME_W / 2, GAME_H - 30, '[ENTER] voltar ao título', { origin: [0.5, 0], color: '#5a4a9a' });
  }

  update(_t: number, delta: number) {
    this.controls.update();
    this.ready -= delta / 1000;
    if (this.ready <= 0 && this.controls.pressed('confirm')) goTo(this, 'Title', {}, 800);
  }
}
