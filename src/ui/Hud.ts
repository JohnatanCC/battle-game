import Phaser from 'phaser';
import { DEPTH, GAME_W, GAME_H } from '../config';
import { txt } from './ui';
import type { Hero } from '../entities/Hero';
import type { Boss } from '../entities/bosses';
import { BOSS_NAMES } from '../data/worlds';

export const ABILITY_NAME: Record<string, string> = { dash: 'INVESTIDA', scream: 'GRITO', spectral: 'LÂMINA', judgment: 'JUÍZO' };
const ABILITY_COST: Record<string, number> = { scream: 1, spectral: 0.5, judgment: 2 };

export class Hud {
  hearts: Phaser.GameObjects.Image[] = [];
  orbsEmpty: Phaser.GameObjects.Image[] = [];
  orbsFull: Phaser.GameObjects.Image[] = [];
  abilityTexts: Phaser.GameObjects.Text[] = [];
  slots: string[] = [];
  shardText: Phaser.GameObjects.Text;
  waveText: Phaser.GameObjects.Text;
  levelText: Phaser.GameObjects.Text;
  healBar: Phaser.GameObjects.Graphics;
  bossBar: Phaser.GameObjects.Graphics;
  bossName: Phaser.GameObjects.Text;
  bossShown = 0;
  lastHp = -1;
  lastMax = -1;
  shake = 0;

  constructor(private scene: Phaser.Scene, private hero: Hero, levelLabel: string) {
    const D = DEPTH.hud;
    this.rebuildHearts();
    for (let i = 0; i < hero.stats.maxEnergy; i++) {
      this.orbsEmpty.push(scene.add.image(10 + i * 13, 26, 'orb', 0).setOrigin(0).setDepth(D));
      this.orbsFull.push(scene.add.image(10 + i * 13, 26, 'orb', 1).setOrigin(0).setDepth(D + 1));
    }
    this.slots = [...(hero.stats.dash ? ['dash'] : []), ...hero.stats.abilities];
    let k = 0;
    this.slots.forEach((ab, i) => {
      const key = ab === 'dash' ? 'SHIFT' : k++ === 0 ? 'K' : 'L';
      this.abilityTexts.push(txt(scene, 10, 42 + i * 11, `[${key}] ${ABILITY_NAME[ab]}`, { color: '#8ef0ff' }).setDepth(D));
    });
    scene.add.sprite(GAME_W - 70, 10, 'shard', 0).setOrigin(0).setDepth(D).play('shard-spin');
    this.shardText = txt(scene, GAME_W - 58, 10, '0', { color: '#ffd75e' }).setDepth(D);
    this.levelText = txt(scene, GAME_W - 8, 24, levelLabel, { color: '#8a7cc8', origin: [1, 0] }).setDepth(D);
    this.waveText = txt(scene, GAME_W / 2, 10, '', { origin: [0.5, 0], color: '#f4f0ff' }).setDepth(D);
    this.healBar = scene.add.graphics().setDepth(DEPTH.fx);
    this.bossBar = scene.add.graphics().setDepth(D).setVisible(false);
    this.bossName = txt(scene, GAME_W / 2, GAME_H - 30, '', { origin: [0.5, 0], color: '#ffd75e' }).setDepth(D + 1).setVisible(false);
  }

  private rebuildHearts() {
    this.hearts.forEach((h) => h.destroy());
    this.hearts = [];
    for (let i = 0; i < this.hero.stats.maxHp; i++)
      this.hearts.push(this.scene.add.image(10 + i * 12, 10, 'heart', 0).setOrigin(0).setDepth(DEPTH.hud));
  }

  setWave(s: string) { this.waveText.setText(s); }
  setShards(n: number) { this.shardText.setText(String(n)); }

  update(boss: Boss | null) {
    const h = this.hero;
    if (h.stats.maxHp !== this.lastMax) { this.rebuildHearts(); this.lastMax = h.stats.maxHp; }
    if (h.hp < this.lastHp) this.shake = 0.3;
    this.lastHp = h.hp;
    this.shake = Math.max(0, this.shake - 1 / 60);
    this.hearts.forEach((img, i) => {
      img.setFrame(i < h.hp ? 0 : 1);
      img.y = 10 + (this.shake > 0 && i === h.hp ? Math.round(Math.sin(this.shake * 60) * 2) : 0);
    });
    // energia: cada orbe preenche de baixo para cima
    this.orbsFull.forEach((img, i) => {
      const fill = Phaser.Math.Clamp(h.energy - i, 0, 1);
      const px = Math.round(fill * 11);
      img.setCrop(0, 11 - px, 11, px);
      img.setAlpha(fill >= 1 ? 1 : 0.7);
    });
    this.slots.forEach((ab, i) => {
      const t = this.abilityTexts[i];
      if (!t) return;
      const ready = ab === 'dash'
        ? h.dashCd <= 0
        : (ab === 'scream' ? h.screamCd <= 0 : h.abilityCd <= 0) && h.energy >= h.stats.spellCost * (ABILITY_COST[ab] ?? 1) - 1e-6;
      t.setColor(ready ? '#8ef0ff' : '#4a4262');
    });

    // barra de cura sobre o herói
    this.healBar.clear();
    if (h.healing) {
      const k = h.healProgress / h.stats.healTime;
      const x = h.x - 12, y = h.body.top - 10;
      this.healBar.fillStyle(0x0b0814, 1).fillRect(x - 1, y - 1, 26, 5);
      this.healBar.fillStyle(0x8ef0ff, 1).fillRect(x, y, Math.round(24 * k), 3);
    }

    // barra do chefe
    if (boss) {
      if (!this.bossBar.visible) {
        this.bossBar.setVisible(true);
        this.bossName.setVisible(true).setText(BOSS_NAMES[boss.bossKey].name);
      }
      this.bossShown = Phaser.Math.Linear(this.bossShown || boss.maxHp, boss.hp, 0.08);
      const w = 360, x = (GAME_W - w) / 2, y = GAME_H - 16;
      const g = this.bossBar.clear();
      g.fillStyle(0x0b0814, 1).fillRect(x - 3, y - 3, w + 6, 10);
      g.fillStyle(0xe0a030, 1).fillRect(x - 2, y - 2, w + 4, 8);
      g.fillStyle(0x140c1c, 1).fillRect(x, y, w, 4);
      g.fillStyle(0xffffff, 1).fillRect(x, y, Math.round(w * Math.max(0, this.bossShown) / boss.maxHp), 4);
      g.fillStyle(0xe83b3b, 1).fillRect(x, y, Math.round(w * Math.max(0, boss.hp) / boss.maxHp), 4);
      g.fillStyle(0xff8a8a, 1).fillRect(x, y, Math.round(w * Math.max(0, boss.hp) / boss.maxHp), 1);
    } else if (this.bossBar.visible) {
      this.bossBar.setVisible(false);
      this.bossName.setVisible(false);
    }
  }
}
