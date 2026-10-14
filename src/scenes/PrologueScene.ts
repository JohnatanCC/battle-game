import Phaser from 'phaser';
import { GAME_W, GAME_H, FLOOR_Y } from '../config';
import { txt, goTo } from '../ui/ui';
import { setBackdrop } from '../ui/backdrop';
import { Controls } from '../systems/Controls';
import { Music } from '../audio/Music';
import { Sfx } from '../audio/Sfx';
import { HEAVEN_FLOOR, FALL_H } from '../gfx/bgArt';
import { HERO_FRAMES } from '../gfx/heroArt';

/**
 * Cinemática de abertura, toda feita com os sprites do jogo:
 *  Ato I   — O Julgamento: nos céus, o Falso Anjo acusa e o Serafim desfere o golpe
 *  Ato II  — A Queda: do céu dourado até a escuridão
 *  Ato III — O Despertar: o impacto no Ossuário e a última faísca
 */
export class PrologueScene extends Phaser.Scene {
  controls!: Controls;
  advance = false;
  done = false;
  capBox!: Phaser.GameObjects.Rectangle;
  capText!: Phaser.GameObjects.Text;
  stage: Phaser.GameObjects.GameObject[] = [];

  constructor() { super('Prologue'); }

  create() {
    this.done = false;
    this.advance = false;
    this.stage = [];
    this.controls = new Controls(this);
    this.controls.swallow();
    setBackdrop(this, 'heaven');
    Music.play('story', 1500);

    this.capBox = this.add.rectangle(0, GAME_H - 62, GAME_W, 62, 0x0b0814, 0.78).setOrigin(0).setDepth(100).setScrollFactor(0).setVisible(false);
    this.capText = txt(this, GAME_W / 2, GAME_H - 50, '', { origin: [0.5, 0], align: 'center', lineSpacing: 8 }).setDepth(101).setScrollFactor(0);
    txt(this, GAME_W - 8, 8, '[ESC] pular', { origin: [1, 0], color: '#5a4a9a' }).setDepth(101).setScrollFactor(0);

    this.run();
  }

  // ------------------------------------------------------------------ utilidades de direção
  private wait(ms: number) {
    return new Promise<void>((r) => this.time.delayedCall(ms, () => r()));
  }

  private tw(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>((r) => this.tweens.add({ ...cfg, onComplete: () => r() }));
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T) { this.stage.push(o); return o; }

  private clearStage() {
    this.stage.forEach((o) => o.destroy());
    this.stage = [];
  }

  /** Legenda com máquina de escrever; ENTER acelera */
  private async caption(text: string, hold = 1700) {
    if (this.done) return;
    this.capBox.setVisible(true);
    this.advance = false;
    for (let i = 1; i <= text.length; i++) {
      if (this.done) return;
      if (this.advance) i = text.length;
      this.capText.setText(text.slice(0, i));
      if (i < text.length) {
        if (text[i - 1] !== ' ' && i % 3 === 0) Sfx.play('select');
        await this.wait(text[i - 1] === '.' || text[i - 1] === ',' ? 140 : 34);
      }
    }
    this.advance = false;
    for (let t = 0; t < hold && !this.advance && !this.done; t += 50) await this.wait(50);
    this.advance = false;
  }

  /** Legenda no topo (quando a ação acontece no chão) ou embaixo */
  private captionAt(top: boolean) {
    this.capBox.setY(top ? 24 : GAME_H - 62);
    this.capText.setY(top ? 36 : GAME_H - 50);
  }

  private hideCaption() {
    this.capBox.setVisible(false);
    this.capText.setText('');
  }

  private flash(color: number, ms = 300) {
    this.cameras.main.flash(ms, (color >> 16) & 255, (color >> 8) & 255, color & 255);
  }

  // ------------------------------------------------------------------ roteiro
  private async run() {
    // atalho de desenvolvimento: ?scene=Prologue&act=2 (ou 3)
    const act = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('act') ?? 1) : 1;
    if (act <= 1) await this.actJudgment();
    if (this.done) return;
    if (act <= 2) await this.actFall();
    if (this.done) return;
    await this.actAwakening();
    if (this.done) return;
    this.finish();
  }

  // ATO I — O JULGAMENTO ---------------------------------------------
  private async actJudgment() {
    const cam = this.cameras.main;
    cam.fadeIn(1500, 11, 8, 20);
    this.keep(this.add.image(0, 0, 'heaven').setOrigin(0));
    const motes = this.keep(this.add.particles(0, 0, 'px', {
      x: { min: 150, max: GAME_W }, y: GAME_H, lifespan: 6000, speedY: { min: -30, max: -12 },
      alpha: { start: 0.8, end: 0 }, tint: [0xffd75e, 0xffffff], frequency: 140,
    }));
    void motes;

    const feetY = HEAVEN_FLOOR - 28; // herói em escala 2
    const hero = this.keep(this.add.sprite(300, feetY, 'hero_divine', HERO_FRAMES.heal).setScale(2));
    const glow = this.keep(this.add.image(300, feetY - 26, 'glow').setScale(2.5).setTint(0xffd75e).setAlpha(0.5));
    this.tweens.add({ targets: glow, alpha: 0.25, duration: 900, yoyo: true, repeat: -1 });

    const knights = [180, 470].map((x, i) => {
      const k = this.keep(this.add.sprite(x, 150 + i * 6, 'knight').play('knight-fly').setScale(1.25).setAlpha(0.85));
      k.setFlipX(x > 300);
      this.tweens.add({ targets: k, y: k.y - 6, duration: 1200 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      return k;
    });
    void knights;

    await this.caption('Nos Céus Altos, tu eras a Chama do Trono,\no mais fiel entre os guardiões da luz.');

    // o herói se levanta diante do trono vazio
    hero.play('hero_divine-idle');
    await this.wait(500);

    // o Falso Anjo surge ao lado do trono
    const fa = this.keep(this.add.sprite(440, HEAVEN_FLOOR - 52, 'falseangel', 0).setAlpha(0).play('falseangel-idle'));
    Sfx.play('magic');
    this.tw({ targets: fa, alpha: 1, duration: 1400 });
    await this.caption('Mas um anjo de máscara dourada\nsussurrou mentiras aos ouvidos do reino.');

    // acusação
    fa.stop();
    fa.setFrame(2);
    Sfx.play('charge');
    const accuse = this.keep(this.add.image(fa.x - 30, fa.y - 26, 'glow').setScale(1.5).setTint(0xe83b3b).setAlpha(0.9));
    this.tweens.add({
      targets: accuse, scale: 3, alpha: 0.3, duration: 500, yoyo: true, repeat: 2,
      onComplete: () => this.tweens.add({ targets: accuse, alpha: 0, duration: 400, onComplete: () => accuse.destroy() }),
    });
    await this.caption('E o reino, enganado, te julgou culpado.', 1300);

    // o Serafim desce sobre o herói
    const seraph = this.keep(this.add.sprite(360, -60, 'seraph', 0).play('seraph-idle').setFlipX(true));
    Sfx.play('whoosh');
    await this.tw({ targets: seraph, y: 150, duration: 1100, ease: 'Cubic.Out' });
    this.hideCaption();
    seraph.stop();
    seraph.setFrame(2);
    Sfx.play('charge');
    hero.stop();
    hero.setFrame(HERO_FRAMES.idle[0]);
    await this.wait(900);

    // O GOLPE
    seraph.setFrame(3);
    Sfx.play('boom');
    Sfx.play('shatter');
    this.flash(0xffffff, 500);
    cam.shake(500, 0.02);
    glow.destroy();
    hero.setTexture('hero', HERO_FRAMES.hurt);
    // cacos da auréola
    for (let i = 0; i < 8; i++) {
      const s = this.keep(this.add.image(hero.x, hero.y - 30, 'px').setTint(0xffd75e).setScale(1.5));
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      this.tweens.add({ targets: s, x: s.x + Math.cos(a) * 70, y: s.y + Math.sin(a) * 50 + 40, alpha: 0, angle: 360, duration: 900, ease: 'Quad.Out' });
    }
    // penas arrancadas
    for (let i = 0; i < 26; i++) {
      const f = this.keep(this.add.image(hero.x - 10, hero.y - 6, 'pfeather').setScale(1.5).setTint(i % 3 ? 0xffffff : 0xb8b0cc));
      const a = Math.PI + (Math.random() - 0.5) * 2;
      const d = 40 + Math.random() * 120;
      this.tweens.add({ targets: f, x: f.x + Math.cos(a) * d, y: f.y + Math.sin(a) * d * 0.5 + 60, angle: Math.random() * 720, alpha: 0, duration: 1500 + Math.random() * 800, ease: 'Sine.Out' });
    }
    Sfx.play('hurt');

    // o herói é arremessado para fora da borda das nuvens
    Sfx.play('whoosh');
    this.tweens.add({ targets: hero, angle: -200, duration: 1300 });
    await this.tw({ targets: hero, x: 110, y: feetY - 60, duration: 650, ease: 'Quad.Out' });
    this.caption('Tua auréola, partida. Tuas asas, arrancadas.', 900);
    await this.tw({ targets: hero, x: 70, y: GAME_H + 60, duration: 750, ease: 'Quad.In' });

    // o usurpador toma o trono
    seraph.setFrame(0);
    seraph.play('seraph-idle');
    fa.play('falseangel-idle');
    await this.tw({ targets: fa, x: 540, y: HEAVEN_FLOOR - 90, duration: 1500, ease: 'Sine.InOut' });
    Sfx.play('bossRoar');
    await this.wait(1400);
    cam.fadeOut(600, 255, 244, 208);
    await this.wait(650);
  }

  // ATO II — A QUEDA ---------------------------------------------------
  private async actFall() {
    this.clearStage();
    this.hideCaption();
    setBackdrop(this, 'fallbg');
    const cam = this.cameras.main;
    cam.setBounds(0, 0, GAME_W, FALL_H);
    cam.scrollY = 0;
    cam.fadeIn(700, 255, 244, 208);
    this.keep(this.add.image(0, 0, 'fallbg').setOrigin(0));

    // rastros de vento passando para cima
    this.keep(this.add.particles(0, 0, 'px', {
      x: { min: 0, max: GAME_W }, y: GAME_H + 10, lifespan: 700, speedY: { min: -900, max: -600 },
      scaleX: 0.5, scaleY: { min: 3, max: 8 }, alpha: { start: 0.35, end: 0 }, frequency: 35, tint: 0xffffff,
    }).setScrollFactor(0));
    // penas que ficam para trás
    this.keep(this.add.particles(0, 0, 'pfeather', {
      x: { min: 300, max: 340 }, y: 150, lifespan: 2400, speedY: { min: -200, max: -90 }, speedX: { min: -50, max: 50 },
      rotate: { min: 0, max: 360 }, alpha: { start: 0.9, end: 0 }, scale: 1.5, frequency: 110, tint: [0xffffff, 0xb8b0cc],
    }).setScrollFactor(0));

    const hero = this.keep(this.add.sprite(GAME_W / 2, 150, 'hero', HERO_FRAMES.hurt).setScale(2).setScrollFactor(0));
    this.tweens.add({ targets: hero, angle: -720, duration: 8000 });
    this.tweens.add({ targets: hero, x: hero.x + 18, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    // cacos dourados caindo junto
    for (let i = 0; i < 3; i++) {
      const s = this.keep(this.add.image(GAME_W / 2 - 30 + i * 30, 110 + i * 14, 'px').setTint(0xffd75e).setScale(2).setScrollFactor(0));
      this.tweens.add({ targets: s, y: s.y - 40 - i * 20, alpha: 0.2, duration: 3000 + i * 800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }

    Sfx.play('whoosh');
    this.tweens.add({ targets: cam, scrollY: FALL_H - GAME_H, duration: 8200, ease: 'Sine.In' });
    const gusts = this.time.addEvent({ delay: 1300, loop: true, callback: () => Sfx.play('whoosh') });
    await this.caption('E foste lançado às profundezas.', 1200);
    await this.caption('Caíste por dias... ou por séculos.', 1400);
    await this.wait(1600);
    gusts.remove();
    this.hideCaption();
    cam.fadeOut(300, 0, 0, 0);
    await this.wait(350);
  }

  // ATO III — O DESPERTAR ---------------------------------------------
  private async actAwakening() {
    this.clearStage();
    this.captionAt(true);
    setBackdrop(this, 'bg1');
    const cam = this.cameras.main;
    cam.setBounds(0, 0, GAME_W, GAME_H);
    cam.scrollY = 0;
    this.keep(this.add.image(0, 0, 'bg1').setOrigin(0));
    this.keep(this.add.tileSprite(0, FLOOR_Y, GAME_W, 16, 'tiles1_0').setOrigin(0));
    this.keep(this.add.tileSprite(0, FLOOR_Y + 16, GAME_W, GAME_H - FLOOR_Y - 16, 'tiles1_1').setOrigin(0));
    const dark = this.keep(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x0b0814, 0.55).setOrigin(0));
    cam.fadeIn(200, 0, 0, 0);

    // o impacto
    const groundY = FLOOR_Y - 28;
    const hero = this.keep(this.add.sprite(GAME_W / 2, -60, 'hero', HERO_FRAMES.fall).setScale(2).setAngle(-30));
    await this.tw({ targets: hero, y: groundY, angle: 0, duration: 380, ease: 'Quad.In' });
    hero.setFrame(HERO_FRAMES.dead);
    Sfx.play('boom');
    Sfx.play('hurt');
    cam.shake(600, 0.03);
    this.flash(0xffffff, 200);
    const puff = this.add.sprite(hero.x, FLOOR_Y - 8, 'puff').setScale(4).setAlpha(0.8).play('fx-puff');
    puff.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => puff.destroy());
    for (let i = 0; i < 10; i++) {
      const b = this.keep(this.add.image(hero.x, FLOOR_Y - 6, 'bone').setAngle(Math.random() * 360));
      const dx = (Math.random() - 0.5) * 300;
      this.tweens.add({ targets: b, x: b.x + dx, duration: 900, ease: 'Linear' });
      this.tweens.add({ targets: b, y: FLOOR_Y - 60 - Math.random() * 60, duration: 420, ease: 'Quad.Out', yoyo: true, hold: 0 });
      this.tweens.add({ targets: b, angle: b.angle + 540, duration: 900 });
    }
    await this.wait(1800);

    // corvos pousam para observar
    const crowSpots = [210, 400, 455];
    const crows = crowSpots.map((x, i) => {
      const c = this.keep(this.add.sprite(GAME_W + 30 + i * 40, 60 + i * 20, 'crow').play('crow-fly').setFlipX(true));
      this.tweens.add({
        targets: c, x, y: FLOOR_Y - 8, duration: 1600 + i * 300, ease: 'Sine.Out',
        onComplete: () => { c.stop(); c.setFrame(0); c.setFlipX(x > hero.x); },
      });
      return c;
    });
    await this.caption('No fundo do abismo, entre ossos e corvos...', 1400);

    // batimentos e a faísca
    const spark = this.keep(this.add.image(hero.x + 16, groundY + 14, 'glow').setScale(0.5).setTint(0xffd75e).setAlpha(0));
    for (let i = 0; i < 3; i++) {
      Sfx.play('heartbeat');
      // a faísca cresce a cada batida
      this.tweens.add({ targets: spark, alpha: 0.35 + i * 0.25, duration: 150 });
      this.tweens.add({ targets: spark, scale: { from: 1.8 + i * 0.8, to: 1 + i * 0.5 }, duration: 700, ease: 'Quad.Out' });
      this.tweens.add({ targets: dark, alpha: 0.55 - (i + 1) * 0.1, duration: 400 });
      await this.wait(950);
    }
    await this.caption('...uma última faísca ainda arde.', 1200);

    // o caído se ergue
    hero.setFrame(HERO_FRAMES.heal);
    Sfx.play('sparkle');
    this.tweens.add({ targets: spark, x: hero.x, y: groundY - 26, alpha: 0.9, scale: 2, duration: 700 });
    await this.wait(1200);
    hero.play('hero-idle');
    Sfx.play('sparkle');
    const halo = this.add.sprite(hero.x - 2, groundY - 30, 'spark').setTint(0xffd75e).setScale(1.5).play('fx-spark');
    halo.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => halo.destroy());
    // os corvos fogem
    crows.forEach((c, i) => {
      c.play('crow-fly');
      c.setFlipX(c.x < hero.x);
      this.tweens.add({ targets: c, x: c.x < hero.x ? -40 : GAME_W + 40, y: -30, duration: 1100 + i * 150, delay: i * 120, ease: 'Quad.In' });
    });
    Sfx.play('whoosh');
    this.hideCaption();
    await this.wait(1300);

    // cartão de título
    const t1 = this.keep(txt(this, GAME_W / 2, 110, 'PRÓLOGO', { origin: [0.5, 0], color: '#8a7cc8' }).setAlpha(0));
    const t2 = this.keep(txt(this, GAME_W / 2, 126, 'DESPERTAR', { size: 24, origin: [0.5, 0], color: '#ffd75e' }).setAlpha(0));
    (t2 as Phaser.GameObjects.Text).setShadow(2, 2, '#5e1024', 0, false, true);
    await this.tw({ targets: [t1, t2], alpha: 1, duration: 900 });
    await this.wait(1800);
  }

  private finish() {
    if (this.done) return;
    this.done = true;
    this.cameras.main.setBounds(0, 0, GAME_W, GAME_H);
    goTo(this, 'Story', { next: 'Arena', nextData: { levelId: 'prologue' } }, 900);
  }

  update() {
    this.controls.update();
    if (this.done) return;
    if (this.controls.pressed('confirm')) this.advance = true;
    if (this.controls.pressed('pause')) { Sfx.play('back'); this.finish(); }
  }
}
