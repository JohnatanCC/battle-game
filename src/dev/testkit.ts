// Ferramentas de teste carregadas apenas em desenvolvimento (npm run dev).
// Permitem simular quadros e um "piloto automático" pelo console do navegador:
//   __sim(600)          avança 600 quadros
//   __auto(3000)        joga sozinho por 3000 quadros (invencível)
//   __state()           resumo do estado da arena
import type Phaser from 'phaser';
import type { ArenaScene } from '../scenes/ArenaScene';

type W = Window & Record<string, unknown>;

export function installTestkit(game: Phaser.Game) {
  const w = window as unknown as W;
  let t = performance.now();
  const step = () => { t += 16.667; game.step(t, 16.667); };
  const arena = () => {
    const act = game.scene.getScenes(true).map((s) => s.scene.key);
    return act.includes('Arena') ? (game.scene.getScene('Arena') as ArenaScene) : null;
  };
  const key = (type: 'keydown' | 'keyup', k: string) => {
    const map: Record<string, [string, string, number]> = {
      left: ['a', 'KeyA', 65], right: ['d', 'KeyD', 68], up: ['w', 'KeyW', 87], down: ['s', 'KeyS', 83],
      jump: ['z', 'KeyZ', 90], attack: ['j', 'KeyJ', 74], skill1: ['k', 'KeyK', 75], heal: ['f', 'KeyF', 70],
      enter: ['Enter', 'Enter', 13], esc: ['Escape', 'Escape', 27],
    };
    const [kk, code, keyCode] = map[k];
    window.dispatchEvent(new KeyboardEvent(type, { key: kk, code, keyCode, bubbles: true }));
  };

  w.__sim = (frames: number) => { for (let i = 0; i < frames; i++) step(); return w.__state && (w.__state as () => string)(); };
  w.__tap = (k: string, frames = 30) => {
    key('keydown', k); for (let i = 0; i < 3; i++) step();
    key('keyup', k); for (let i = 0; i < frames; i++) step();
    return game.scene.getScenes(true).map((s) => s.scene.key).join(',');
  };
  w.__state = () => {
    const a = arena();
    if (!a) return JSON.stringify({ active: game.scene.getScenes(true).map((s) => s.scene.key) });
    return JSON.stringify({
      level: a.level.id, phase: a.phase, wave: a.waveIndex, shards: a.runShards,
      enemies: a.allTargets().filter((e) => !e.isBoss).map((e) => `${e.kind}:${e.hp}:${e.state}`),
      shots: a.shots.getChildren().length, hazards: a.hazards.length,
      boss: a.boss ? { st: a.boss.state, hp: a.boss.hp, ph: a.boss.phase, x: Math.round(a.boss.x), y: Math.round(a.boss.y) } : null,
      hero: { x: Math.round(a.hero.x), y: Math.round(a.hero.y), hp: a.hero.hp, en: +a.hero.energy.toFixed(2) },
    });
  };
  w.__auto = (frames: number, god = true) => {
    const held = new Set<string>();
    const set = (k: string, on: boolean) => {
      if (on && !held.has(k)) { key('keydown', k); held.add(k); }
      if (!on && held.has(k)) { key('keyup', k); held.delete(k); }
    };
    const log: string[] = [];
    for (let i = 0; i < frames; i++) {
      const a = arena();
      if (a && a.hero && !a.hero.dead) {
        if (god) { a.hero.invuln = Math.max(a.hero.invuln, 0.05); a.hero.hp = a.hero.stats.maxHp; }
        const targets = a.allTargets().filter((e) => !e.dead && e.hittable);
        let tx: number | null = null, ty = 0;
        const pick = a.amuletPickup as Phaser.GameObjects.Image | null;
        if (pick) { tx = pick.x; ty = pick.y; }
        else if (targets.length) {
          const tg = targets.sort((p, q) => Math.abs(p.x - a.hero.x) - Math.abs(q.x - a.hero.x))[0];
          tx = tg.x; ty = tg.body!.center.y;
        }
        if (tx !== null) {
          const dx = tx - a.hero.x;
          set('right', dx > 16); set('left', dx < -16);
          const above = ty < a.hero.centerY - 28;
          set('up', above);
          set('jump', above && i % 40 < 22);
          set('attack', Math.abs(dx) < 54 && i % 10 < 3);
        } else ['left', 'right', 'jump', 'attack', 'up'].forEach((k) => set(k, false));
      }
      step();
      if (i % 300 === 0) log.push((w.__state as () => string)());
    }
    ['left', 'right', 'jump', 'attack', 'up'].forEach((k) => set(k, false));
    log.push((w.__state as () => string)());
    return log.join('\n');
  };
}
