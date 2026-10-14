import Phaser from 'phaser';
import { GAME_W, DEPTH } from '../config';
import { txt, panel } from '../ui/ui';
import { Sfx } from '../audio/Sfx';
import type { ArenaScene } from './ArenaScene';

interface Step {
  text: string;
  setup?: () => void;
  done: () => boolean;
}

/** Prólogo jogável: ensina os controles passo a passo antes da primeira horda */
export class Tutorial {
  step = -1;
  delay = 0;
  finished = false;
  private startX = 0;
  private spawned = false;
  private box: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private steps: Step[];

  constructor(private a: ArenaScene) {
    const w = 460, x = (GAME_W - w) / 2, y = 42;
    this.box = panel(a, x, y, w, 48, { border: 0x8ef0ff }).setDepth(DEPTH.hud + 5).setAlpha(0);
    this.label = txt(a, GAME_W / 2, y + 12, '', { origin: [0.5, 0], align: 'center', lineSpacing: 6 }).setDepth(DEPTH.hud + 6);
    const hero = a.hero;
    const floor = a.floorY;
    const clear = () => this.spawned && a.pending <= 0 && a.aliveCount() === 0;
    const spawn = (type: 'skeleton' | 'crow') => {
      this.spawned = false;
      const side = hero.x < GAME_W / 2 ? 1 : -1;
      const x = Phaser.Math.Clamp(hero.x + side * 170, 40, GAME_W - 40);
      a.spawnEnemy(type, x, type === 'crow' ? 170 : floor - 16);
      a.time.delayedCall(700, () => { this.spawned = true; });
    };

    this.steps = [
      {
        text: 'Use A / D ou as SETAS para andar.',
        setup: () => { this.startX = hero.x; },
        done: () => Math.abs(hero.x - this.startX) > 90,
      },
      {
        text: 'ESPAÇO ou Z para pular. Segure para ir mais alto.\nSuba numa plataforma.',
        done: () => hero.grounded && hero.body.bottom < floor - 30,
      },
      {
        text: 'Numa plataforma, BAIXO + PULAR para descer.',
        done: () => hero.grounded && hero.body.bottom >= floor - 2,
      },
      {
        text: 'J / X ou CLIQUE para atacar (o clique mira).\nDestrua o esqueleto!',
        setup: () => spawn('skeleton'),
        done: clear,
      },
      {
        text: 'CIMA + J golpeia para cima. No ar, BAIXO + J\ngolpeia para baixo e te faz quicar.',
        setup: () => spawn('crow'),
        done: clear,
      },
      {
        text: 'Golpes enchem tua ENERGIA (orbes azuis).\nSegure F para gastar 1 carga e curar 1 de vida.',
        setup: () => {
          hero.hp = Math.max(1, hero.stats.maxHp - 1);
          hero.energy = Math.max(hero.energy, 1.05);
          a.flash(0xe83b3b, 0.2);
        },
        done: () => hero.hp >= hero.stats.maxHp,
      },
      {
        text: 'Eles sentem tua luz. Sobrevive!',
        setup: () => a.startWave(0),
        done: () => true,
      },
    ];
    this.next();
  }

  private next() {
    this.step++;
    const s = this.steps[this.step];
    if (!s) return;
    this.label.setText(s.text);
    this.a.tweens.add({ targets: [this.box, this.label], alpha: 1, duration: 250 });
    s.setup?.();
    if (this.step === this.steps.length - 1) {
      this.finished = true;
      this.a.time.delayedCall(2500, () => this.hide());
    }
  }

  private hide() {
    this.a.tweens.add({ targets: [this.box, this.label], alpha: 0, duration: 400 });
  }

  update(dt: number) {
    if (this.finished) return;
    if (this.delay > 0) {
      this.delay -= dt;
      if (this.delay <= 0) this.next();
      return;
    }
    const s = this.steps[this.step];
    if (s && s.done()) {
      Sfx.play('confirm');
      this.a.floatText(this.a.hero.x, this.a.hero.body.top - 6, 'BOM!', '#8ef0ff');
      this.label.setColor('#8ef0ff');
      this.a.time.delayedCall(600, () => this.label.setColor('#f4f0ff'));
      this.delay = 0.7;
    }
  }
}
