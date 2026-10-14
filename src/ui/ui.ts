import Phaser from 'phaser';
import { FONT, GAME_W, GAME_H } from '../config';
import { Sfx } from '../audio/Sfx';
import type { Controls } from '../systems/Controls';

// A fonte Press Start 2P desenha maiúsculas acentuadas no tamanho de minúsculas.
// Para manter o visual limpo, maiúsculas acentuadas são exibidas sem acento.
const UPPER_ACCENTS: Record<string, string> = {
  'Á': 'A', 'À': 'A', 'Â': 'A', 'Ã': 'A', 'É': 'E', 'Ê': 'E', 'Í': 'I',
  'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ú': 'U', 'Ç': 'C',
};
export const pixelSafe = (s: string) => s.replace(/[ÁÀÂÃÉÊÍÓÔÕÚÇ]/g, (c) => UPPER_ACCENTS[c]);

const origSetText = Phaser.GameObjects.Text.prototype.setText;
Phaser.GameObjects.Text.prototype.setText = function (this: Phaser.GameObjects.Text, value: string | string[]) {
  const v = Array.isArray(value) ? value.map((x) => pixelSafe(String(x))) : pixelSafe(String(value ?? ''));
  return origSetText.call(this, v);
};

export interface TextOpts {
  size?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  origin?: [number, number] | number;
  shadow?: boolean;
  wrap?: number;
  lineSpacing?: number;
}

export function txt(scene: Phaser.Scene, x: number, y: number, s: string, o: TextOpts = {}) {
  const t = scene.add.text(Math.round(x), Math.round(y), s, {
    fontFamily: FONT,
    fontSize: `${o.size ?? 8}px`,
    color: o.color ?? '#f4f0ff',
    align: o.align ?? 'left',
    lineSpacing: o.lineSpacing ?? 4,
    wordWrap: o.wrap ? { width: o.wrap } : undefined,
  });
  if (o.shadow !== false) t.setShadow(1, 1, '#0b0814', 0, false, true);
  if (o.origin !== undefined) {
    if (typeof o.origin === 'number') t.setOrigin(o.origin);
    else t.setOrigin(o.origin[0], o.origin[1]);
  }
  return t;
}

/** Painel com borda dupla estilo JRPG 16-bit */
export function panel(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number,
  o: { fill?: number; border?: number; inner?: number; alpha?: number } = {},
) {
  const g = scene.add.graphics();
  const fill = o.fill ?? 0x140c1c;
  const border = o.border ?? 0xe0a030;
  const inner = o.inner ?? 0x3b2d6b;
  g.fillStyle(0x0b0814, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(border, 1).fillRect(x, y, w, h);
  g.fillStyle(0x0b0814, 1).fillRect(x + 2, y + 2, w - 4, h - 4);
  g.fillStyle(inner, 1).fillRect(x + 3, y + 3, w - 6, h - 6);
  g.fillStyle(fill, o.alpha ?? 1).fillRect(x + 4, y + 4, w - 8, h - 8);
  // cantos chanfrados
  g.fillStyle(0x0b0814, 1);
  for (const [cx, cy] of [[x, y], [x + w - 1, y], [x, y + h - 1], [x + w - 1, y + h - 1]]) g.fillRect(cx, cy, 1, 1);
  return g;
}

export function fadeIn(scene: Phaser.Scene, ms = 300) {
  scene.cameras.main.fadeIn(ms, 11, 8, 20);
}

export function goTo(scene: Phaser.Scene, key: string, data?: object, ms = 300) {
  if ((scene as unknown as { _leaving?: boolean })._leaving) return;
  (scene as unknown as { _leaving?: boolean })._leaving = true;
  scene.cameras.main.fadeOut(ms, 11, 8, 20);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    // cenas são reutilizadas pelo Phaser: libera a trava para a próxima visita
    (scene as unknown as { _leaving?: boolean })._leaving = false;
    scene.scene.start(key, data);
  });
}

export interface MenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  color?: string;
}

/** Lista vertical navegável por teclado, gamepad e mouse */
export class Menu {
  index = 0;
  texts: Phaser.GameObjects.Text[] = [];
  cursor: Phaser.GameObjects.Image;
  active = true;

  constructor(
    private scene: Phaser.Scene,
    public x: number,
    public y: number,
    public items: MenuItem[],
    o: { spacing?: number; align?: 'left' | 'center'; size?: number; depth?: number } = {},
  ) {
    const sp = o.spacing ?? 16;
    items.forEach((it, i) => {
      const t = txt(scene, x, y + i * sp, it.label, {
        size: o.size ?? 8,
        color: it.disabled ? '#5a5070' : it.color ?? '#f4f0ff',
        origin: o.align === 'center' ? [0.5, 0] : [0, 0],
      });
      t.setInteractive({ useHandCursor: !it.disabled });
      t.on('pointerover', () => { if (this.active && !it.disabled && this.index !== i) { this.index = i; this.refresh(); Sfx.play('select'); } });
      t.on('pointerdown', () => { if (this.active) { this.index = i; this.refresh(); this.choose(); } });
      if (o.depth !== undefined) t.setDepth(o.depth);
      this.texts.push(t);
    });
    this.cursor = scene.add.image(0, 0, 'cursor').setOrigin(1, 0);
    if (o.depth !== undefined) this.cursor.setDepth(o.depth);
    scene.tweens.add({ targets: this.cursor, x: '-=3', duration: 300, yoyo: true, repeat: -1 });
    while (this.items[this.index]?.disabled && this.index < this.items.length - 1) this.index++;
    this.refresh();
  }

  refresh() {
    this.texts.forEach((t, i) => {
      const it = this.items[i];
      t.setColor(it.disabled ? '#5a5070' : i === this.index ? '#ffd75e' : it.color ?? '#f4f0ff');
    });
    const t = this.texts[this.index];
    if (t) {
      this.scene.tweens.killTweensOf(this.cursor);
      this.cursor.setPosition(Math.round(t.getLeftCenter().x! - 6), Math.round(t.y));
      this.scene.tweens.add({ targets: this.cursor, x: '-=3', duration: 300, yoyo: true, repeat: -1 });
    }
  }

  move(d: number) {
    const n = this.items.length;
    let i = this.index;
    for (let k = 0; k < n; k++) {
      i = (i + d + n) % n;
      if (!this.items[i].disabled) break;
    }
    if (i !== this.index) { this.index = i; this.refresh(); Sfx.play('select'); }
  }

  choose() {
    const it = this.items[this.index];
    if (!it || it.disabled) { Sfx.play('error'); return; }
    Sfx.play('confirm');
    it.onSelect();
  }

  update(c: Controls) {
    if (!this.active) return;
    if (c.pressed('up')) this.move(-1);
    if (c.pressed('down')) this.move(1);
    if (c.pressed('confirm')) this.choose();
  }

  setLabel(i: number, s: string) { this.texts[i]?.setText(s); this.refresh(); }

  setVisible(v: boolean) {
    this.texts.forEach((t) => t.setVisible(v));
    this.cursor.setVisible(v);
    this.active = v;
  }

  destroy() {
    this.texts.forEach((t) => t.destroy());
    this.cursor.destroy();
  }
}

/** Escurecimento de tela cheia */
export function dim(scene: Phaser.Scene, alpha = 0.7, depth = 0) {
  return scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x0b0814, alpha).setOrigin(0).setDepth(depth);
}
