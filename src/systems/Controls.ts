import Phaser from 'phaser';

export type Action =
  | 'left' | 'right' | 'up' | 'down'
  | 'jump' | 'attack' | 'dash' | 'skill1' | 'skill2' | 'heal'
  | 'pause' | 'confirm' | 'back';

const KEYS: Record<Action, string[]> = {
  left: ['A', 'LEFT'],
  right: ['D', 'RIGHT'],
  up: ['W', 'UP'],
  down: ['S', 'DOWN'],
  jump: ['SPACE', 'Z'],
  attack: ['J', 'X'],
  dash: ['SHIFT'],
  skill1: ['K', 'C'],
  skill2: ['L', 'V'],
  heal: ['F', 'H'],
  pause: ['ESC', 'P'],
  confirm: ['ENTER', 'SPACE', 'J', 'Z'],
  back: ['ESC', 'BACKSPACE', 'K', 'X'],
};

// Botões do gamepad no mapeamento padrão
const PAD: Partial<Record<Action, number[]>> = {
  jump: [0], attack: [2], dash: [5, 7], skill1: [1], skill2: [4], heal: [3],
  pause: [9], confirm: [0], back: [1],
  up: [12], down: [13], left: [14], right: [15],
};

export const CONTROL_HELP: Array<[string, string]> = [
  ['Mover', 'A/D  ou  setas'],
  ['Pular', 'ESPAÇO  ou  Z'],
  ['Atacar', 'J / X  ou  CLIQUE (mira)'],
  ['Investida', 'SHIFT'],
  ['Habilidade 1', 'K  ou  C'],
  ['Habilidade 2', 'L  ou  V'],
  ['Curar (segurar)', 'F  ou  H'],
  ['Descer plataforma', 'baixo + pular'],
  ['Pausa', 'ESC  ou  P'],
];

export class Controls {
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private prev = new Map<Action, boolean>();
  private cur = new Map<Action, boolean>();
  private clickQueued: { x: number; y: number } | null = null;
  /** Clique esquerdo deste quadro (posição no mundo), para atacar mirando com o mouse */
  click: { x: number; y: number } | null = null;

  constructor(private scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    const names = new Set(Object.values(KEYS).flat());
    for (const n of names) this.keys[n] = kb.addKey(n, true, false);
    scene.input.mouse?.disableContextMenu();
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (p.leftButtonDown()) this.clickQueued = { x: p.worldX, y: p.worldY };
    });
  }

  private raw(a: Action): boolean {
    if (KEYS[a].some((k) => this.keys[k]?.isDown)) return true;
    const pad = this.scene.input.gamepad?.pad1;
    if (pad) {
      if (PAD[a]?.some((b) => pad.buttons[b]?.pressed)) return true;
      const ax = pad.axes.length > 0 ? pad.axes[0].getValue() : 0;
      const ay = pad.axes.length > 1 ? pad.axes[1].getValue() : 0;
      if (a === 'left' && ax < -0.4) return true;
      if (a === 'right' && ax > 0.4) return true;
      if (a === 'up' && ay < -0.5) return true;
      if (a === 'down' && ay > 0.5) return true;
    }
    return false;
  }

  /** Chamar uma vez por frame, no início do update */
  update() {
    for (const a of Object.keys(KEYS) as Action[]) {
      this.prev.set(a, this.cur.get(a) ?? false);
      this.cur.set(a, this.raw(a));
    }
    this.click = this.clickQueued;
    this.clickQueued = null;
  }

  down(a: Action) { return this.cur.get(a) ?? false; }
  pressed(a: Action) { return (this.cur.get(a) ?? false) && !(this.prev.get(a) ?? false); }
  released(a: Action) { return !(this.cur.get(a) ?? false) && (this.prev.get(a) ?? false); }

  /** Ignora teclas já seguradas ao entrar numa tela */
  swallow() {
    for (const a of Object.keys(KEYS) as Action[]) {
      const v = this.raw(a);
      this.prev.set(a, v);
      this.cur.set(a, v);
    }
    this.click = null;
    this.clickQueued = null;
  }
}
