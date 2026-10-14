import Phaser from 'phaser';
import { DEPTH, GAME_W } from '../config';
import { Sfx } from '../audio/Sfx';
import type { ArenaApi } from './api';
import type { EnemyType } from '../data/types';

export interface HitInfo {
  damage: number;
  dirX: number;
  knockback: number;
  crit: boolean;
  source: 'melee' | 'scream' | 'thorns' | 'bleed' | 'shock';
  attackDir: 'fwd' | 'up' | 'down';
  fromX: number;
}

export type HitResult = 'hit' | 'blocked' | 'immune';

export interface EnemyCfg {
  tex: string;
  hp: number;
  body: [number, number, number, number]; // w, h, offsetX, offsetY
  flying?: boolean;
  kbResist?: number;
  contact?: number;
  shards?: number;
}

export abstract class Enemy extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  hp: number;
  maxHp: number;
  flying: boolean;
  kbResist: number;
  contactDamage: number;
  shards: number;
  isBoss = false;
  kind: EnemyType | string = '';
  summoned = false;

  dead = false;
  spawning = 0;
  stun = 0;
  stunCd = 0;
  knock = 0;
  bleedTime = 0;
  bleedAcc = 0;
  weakTime = 0;
  flashTime = 0;
  facing = 1;

  state = 'idle';
  stateTime = 0;
  cooldown = 0;
  stunStars: Phaser.GameObjects.Text | null = null;

  constructor(public arena: ArenaApi, x: number, y: number, cfg: EnemyCfg) {
    super(arena, x, y, cfg.tex, 0);
    arena.add.existing(this);
    arena.physics.add.existing(this);
    this.hp = this.maxHp = cfg.hp;
    this.flying = cfg.flying ?? false;
    this.kbResist = cfg.kbResist ?? 0;
    this.contactDamage = cfg.contact ?? 1;
    this.shards = cfg.shards ?? 3;
    const [w, h, ox, oy] = cfg.body;
    this.body.setSize(w, h).setOffset(ox, oy);
    this.body.setAllowGravity(!this.flying);
    this.setDepth(DEPTH.enemies);
    this.setCollideWorldBounds(true);
  }

  get hittable() { return !this.dead && this.spawning <= 0; }
  get hero() { return this.arena.hero; }
  get speedMul() { return this.weakTime > 0 ? 0.7 : 1; }
  get grounded() { return this.body.blocked.down || this.body.touching.down; }
  get cy() { return this.body.center.y; }

  hurtRect() {
    return new Phaser.Geom.Rectangle(this.body.x, this.body.y, this.body.width, this.body.height);
  }

  toState(s: string, t = 0) {
    this.state = s;
    this.stateTime = t;
  }

  faceHero() {
    this.facing = this.hero.x >= this.x ? 1 : -1;
  }

  dxHero() { return this.hero.x - this.x; }
  dyHero() { return this.hero.centerY - this.cy; }

  /** Move-se suavemente em direção a um ponto (para voadores) */
  steer(tx: number, ty: number, speed: number, dt: number, accel = 4) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = Math.min(speed, d * 3) * this.speedMul;
    const vx = (dx / d) * sp, vy = (dy / d) * sp;
    const k = Math.min(1, accel * dt);
    this.setVelocity(this.body.velocity.x + (vx - this.body.velocity.x) * k, this.body.velocity.y + (vy - this.body.velocity.y) * k);
  }

  /** Retângulo de golpe à frente do inimigo; aplica dano ao herói */
  strike(reach: number, height: number, offsetY = 0, damage = 1) {
    const r = this.facing > 0
      ? new Phaser.Geom.Rectangle(this.x, this.cy - height / 2 + offsetY, reach, height)
      : new Phaser.Geom.Rectangle(this.x - reach, this.cy - height / 2 + offsetY, reach, height);
    const hb = this.hero.body;
    if (Phaser.Geom.Rectangle.Overlaps(r, new Phaser.Geom.Rectangle(hb.x, hb.y, hb.width, hb.height)))
      this.hero.hurt(damage, this.x, 'contact');
  }

  /** Pode ser sobrescrito para bloquear (escudo) */
  protected blocks(_h: HitInfo): boolean { return false; }

  takeHit(h: HitInfo): HitResult {
    if (!this.hittable) return 'immune';
    if (h.source === 'melee' && this.blocks(h)) {
      this.flashTime = 0.05;
      return 'blocked';
    }
    this.hp -= h.damage;
    this.flashTime = 0.07;
    this.arena.floatText(this.x + Phaser.Math.Between(-6, 6), this.body.top - 4, String(h.damage), h.crit ? '#ffd75e' : '#f4f0ff');

    const stats = this.arena.stats;
    if (h.source === 'melee' || h.source === 'shock') {
      if (stats.bleed) this.bleedTime = 3;
      if (stats.weakness) this.weakTime = 1.5;
    }

    if (!this.isBoss && h.knockback > 0) {
      const kb = h.knockback * (1 - this.kbResist);
      this.setVelocityX(h.dirX * kb);
      if (!this.flying && h.attackDir !== 'down') this.setVelocityY(Math.min(this.body.velocity.y, -60 * (1 - this.kbResist)));
      if (this.flying && h.attackDir !== 'fwd') this.setVelocityY(h.attackDir === 'up' ? -kb : kb);
      this.knock = 0.16 * (1 - this.kbResist * 0.5);
    }
    this.onHurt(h);
    if (this.hp <= 0) this.die();
    return 'hit';
  }

  protected onHurt(_h: HitInfo) {}

  scream(dirX: number, damage: number) {
    if (!this.hittable) return;
    this.takeHit({ damage, dirX, knockback: 0, crit: false, source: 'scream', attackDir: 'fwd', fromX: this.hero.x });
    if (this.dead) return;
    if (this.isBoss) {
      if (this.stunCd <= 0) { this.stun = 0.6; this.stunCd = 6; }
      return;
    }
    this.stun = 2;
    this.setVelocity(dirX * 280 * (1 - this.kbResist * 0.6), this.flying ? 0 : -160);
    this.knock = 0.3;
  }

  preUpdate(time: number, delta: number) {
    if (this.arena.frozen) return;
    super.preUpdate(time, delta);
    if (this.dead || this.arena.cutscene) return;
    const dt = Math.min(0.05, delta / 1000);

    if (this.spawning > 0) {
      this.spawning -= dt;
      this.setAlpha(1 - Math.max(0, this.spawning) / 0.5);
      this.setVelocity(0, this.flying ? 0 : this.body.velocity.y);
      return;
    }

    for (const k of ['knock', 'flashTime', 'weakTime', 'stunCd'] as const) this[k] = Math.max(0, this[k] - dt);

    // sangramento: 2 de dano por segundo
    if (this.bleedTime > 0) {
      this.bleedTime -= dt;
      this.bleedAcc += dt;
      if (this.bleedAcc >= 0.5) {
        this.bleedAcc = 0;
        this.hp -= 1;
        this.arena.floatText(this.x, this.body.top - 2, '1', '#e83b3b');
        this.arena.burst(this.x, this.cy, 'px', 0xa8202e, 2, 30);
        if (this.hp <= 0) { this.die(); return; }
      }
    }

    // visual de estado
    if (this.flashTime > 0) this.setTintFill(0xffffff);
    else if (this.weakTime > 0) this.setTint(0xc0a0ff);
    else if (this.bleedTime > 0) this.setTint(0xffb0b0);
    else this.clearTint();

    if (this.stun > 0) {
      this.stun -= dt;
      if (!this.stunStars) {
        this.stunStars = this.arena.add.text(this.x, this.body.top - 8, '*', { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffe45e' }).setOrigin(0.5).setDepth(DEPTH.fx);
      }
      this.stunStars.setPosition(this.x + Math.sin(time / 90) * 6, this.body.top - 8);
      if (this.knock <= 0) {
        this.setVelocityX(this.body.velocity.x * 0.85);
        if (this.flying) this.setVelocityY(this.body.velocity.y * 0.85);
      }
      this.onStunned(dt);
      if (this.stun <= 0) { this.stunStars?.destroy(); this.stunStars = null; }
      return;
    }

    if (this.knock > 0) {
      if (this.flying) {
        this.setVelocity(this.body.velocity.x * 0.9, this.body.velocity.y * 0.9);
      }
      return;
    }

    this.stateTime -= dt;
    this.cooldown -= dt;
    this.think(dt);
    if (!this.isBoss) this.setFlipX(this.facing < 0);
    // mantém voadores dentro da tela
    if (this.flying) this.y = Phaser.Math.Clamp(this.y, 20, this.arena.floorY - 12);
    this.x = Phaser.Math.Clamp(this.x, 8, GAME_W - 8);
  }

  protected onStunned(_dt: number) {}

  abstract think(dt: number): void;

  die() {
    if (this.dead) return;
    this.dead = true;
    this.hp = 0;
    this.stunStars?.destroy();
    this.body.enable = false;
    Sfx.play('enemyDie');
    this.arena.fx('puff', this.x, this.cy, { scale: this.isBoss ? 3 : 1.5 });
    this.arena.onEnemyKilled(this);
    this.setTintFill(0xffffff);
    this.arena.tweens.add({
      targets: this, alpha: 0, duration: 260,
      onComplete: () => this.destroy(),
    });
  }

  destroy(fromScene?: boolean) {
    this.stunStars?.destroy();
    super.destroy(fromScene);
  }
}
