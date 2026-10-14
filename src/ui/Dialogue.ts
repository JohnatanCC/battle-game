import Phaser from 'phaser';
import { GAME_W, GAME_H, DEPTH } from '../config';
import { txt, panel } from './ui';
import { Sfx } from '../audio/Sfx';
import type { Controls } from '../systems/Controls';

/** Caixa de diálogo com nome do orador e máquina de escrever. ENTER avança. */
export class DialogueBox {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private body: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private line = 0;
  private shown = 0;
  private acc = 0;
  done = false;

  constructor(private scene: Phaser.Scene, speaker: string, color: string, private lines: string[], private onDone: () => void) {
    const D = DEPTH.overlay + 5;
    const x = 40, y = GAME_H - 100, w = GAME_W - 80, h = 78;
    this.objs.push(panel(scene, x, y, w, h, { border: Phaser.Display.Color.HexStringToColor(color).color }).setDepth(D));
    const tag = txt(scene, x + 12, y - 6, ` ${speaker} `, { color }).setDepth(D + 2);
    this.objs.push(scene.add.rectangle(tag.x - 2, tag.y - 2, tag.width + 4, tag.height + 4, 0x0b0814).setOrigin(0).setDepth(D + 1), tag);
    this.body = txt(scene, x + 16, y + 16, '', { lineSpacing: 8, wrap: w - 32 }).setDepth(D + 2);
    this.hint = txt(scene, x + w - 12, y + h - 16, '[ENTER]', { origin: [1, 0], color: '#5a4a9a' }).setDepth(D + 2);
    this.objs.push(this.body, this.hint);
  }

  update(dt: number, c: Controls) {
    if (this.done) return;
    const full = this.lines[this.line];
    this.acc += dt;
    if (this.shown < full.length && this.acc > 0.03) {
      this.acc = 0;
      this.shown++;
      if (full[this.shown - 1] !== ' ' && this.shown % 3 === 0) Sfx.play('select');
    }
    this.body.setText(full.slice(0, this.shown));
    this.hint.setVisible(this.shown >= full.length && Math.floor(this.scene.time.now / 400) % 2 === 0);
    if (c.pressed('confirm') || c.pressed('attack')) {
      if (this.shown < full.length) this.shown = full.length;
      else if (this.line + 1 < this.lines.length) { this.line++; this.shown = 0; Sfx.play('confirm'); }
      else this.close();
    }
  }

  close() {
    if (this.done) return;
    this.done = true;
    this.objs.forEach((o) => o.destroy());
    this.onDone();
  }
}
