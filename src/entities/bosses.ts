import Phaser from 'phaser';
import { Enemy, type EnemyCfg } from './Enemy';
import { Sfx } from '../audio/Sfx';
import { DEPTH, GAME_W } from '../config';
import type { ArenaApi } from './api';
import type { BossType } from '../data/types';

const rand = Phaser.Math.FloatBetween;

export abstract class Boss extends Enemy {
  phase = 1;
  baseY: number;
  targetX: number;
  t = 0;
  last = '';
  introTime = 2.2;

  constructor(arena: ArenaApi, public bossKey: BossType, cfg: EnemyCfg, baseY: number) {
    super(arena, GAME_W / 2, -60, { ...cfg, flying: true, kbResist: 1 });
    this.isBoss = true;
    this.baseY = baseY;
    this.targetX = GAME_W / 2;
    this.setDepth(DEPTH.boss);
    this.setCollideWorldBounds(false);
    this.toState('intro', this.introTime);
  }

  get hittable() { return !this.dead && this.state !== 'intro' && this.alpha > 0.5; }

  /** Janelas de punição: o chefe não fere por contato */
  get vulnerable() { return ['tired', 'stuck', 'slashRecover'].includes(this.state); }

  protected pick(options: Array<[string, number]>): string {
    const pool = options.filter(([k]) => k !== this.last);
    const total = pool.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [k, w] of pool) { r -= w; if (r <= 0) { this.last = k; return k; } }
    this.last = pool[0][0];
    return this.last;
  }

  protected minions() {
    return this.arena.allTargets().filter((e) => e.summoned && !e.dead).length;
  }

  /** Paira em direção ao alvo horizontal com balanço senoidal */
  protected hover(dt: number, speed = 70) {
    this.steer(this.targetX, this.baseY + Math.sin(this.t * 1.6) * 8, speed, dt, 3);
  }

  protected doIntro(dt: number) {
    this.y = Phaser.Math.Linear(-60, this.baseY, 1 - Math.max(0, this.stateTime) / this.introTime);
    this.setVelocity(0, 0);
    if (this.stateTime <= 0) {
      Sfx.play('bossRoar');
      this.arena.shake(0.015, 600);
      this.toState('idle', 1.0);
    }
    void dt;
  }

  protected checkPhase(threshold: number, next: number) {
    if (this.phase < next && this.hp / this.maxHp <= threshold) {
      this.phase = next;
      this.onPhase(next);
      return true;
    }
    return false;
  }

  protected onPhase(_p: number) {}

  die() {
    if (this.dead) return;
    this.dead = true;
    this.hp = 0;
    this.body.enable = false;
    this.stunStars?.destroy();
    this.stop();
    this.arena.onEnemyKilled(this);
    // explosões em sequência
    const n = 10;
    for (let i = 0; i < n; i++) {
      this.arena.time.delayedCall(i * 140, () => {
        this.arena.fx('puff', this.x + rand(-30, 30), this.y + rand(-30, 30), { scale: 2.5 });
        Sfx.play(i % 3 === 0 ? 'boom' : 'enemyDie');
        this.setTintFill(i % 2 ? 0xffffff : 0xffd75e);
      });
    }
    this.arena.tweens.add({ targets: this, alpha: 0, delay: n * 140, duration: 600, onComplete: () => this.destroy() });
  }
}

// ======================================================================
// REI OSSÁRIO — Mundo 1
// ======================================================================
class BoneKing extends Boss {
  swoopFrom = 0;
  swoopDir = 1;

  constructor(arena: ArenaApi) {
    super(arena, 'boneking', { tex: 'boneking', hp: 650, body: [28, 44, 18, 10], shards: 0 }, 170);
    this.play('boneking-idle');
  }

  protected onPhase() {
    Sfx.play('bossRoar');
    this.arena.shake(0.02, 700);
    this.arena.flash(0x7a2ab8, 0.4);
    this.arena.banner('O REI SE ENFURECE', 'Fase 2', '#c060ff');
    this.arena.spawnEnemy('crow', 80, 120, { summoned: true });
    this.arena.spawnEnemy('crow', GAME_W - 80, 120, { summoned: true });
  }

  think(dt: number) {
    this.t += dt;
    if (this.state === 'intro') return this.doIntro(dt);
    this.checkPhase(0.5, 2);
    const p2 = this.phase >= 2;
    this.setFlipX(this.hero.x < this.x);

    switch (this.state) {
      case 'idle':
        if (!this.anims.isPlaying) this.play('boneking-idle');
        this.hover(dt);
        if (this.stateTime <= 0) this.chooseAttack();
        break;

      case 'bones':
        this.hover(dt, 30);
        if (this.stateTime <= 0) {
          const n = p2 ? 7 : 5;
          const base = Phaser.Math.Angle.Between(this.x, this.y - 18, this.hero.x, this.hero.centerY);
          for (let i = 0; i < n; i++) {
            const a = base + (i - (n - 1) / 2) * 0.2;
            this.arena.spawnShot({ tex: 'bone', x: this.x, y: this.y - 18, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, spin: 720, breakable: true, radius: 3 });
          }
          Sfx.play('shoot');
          this.endAttack(p2 ? 0.7 : 1.1);
        }
        break;

      case 'spikes':
        this.hover(dt, 30);
        if (this.stateTime <= 0) {
          const offs = p2 ? [-120, -60, 0, 60, 120] : [-70, 0, 70];
          offs.forEach((o, i) => {
            const x = Phaser.Math.Clamp(this.hero.x + o - 15, 0, GAME_W - 30);
            this.arena.spawnHazard({ kind: 'rect', x, y: this.arena.floorY - 38, w: 30, h: 38, warn: 0.7 + i * 0.08, active: 0.45, color: 0xe8e0c8, style: 'spikes', sound: 'boom' });
          });
          this.endAttack(p2 ? 1.0 : 1.4);
        }
        break;

      case 'summon':
        this.hover(dt, 20);
        if (this.stateTime <= 0) {
          this.arena.spawnEnemy('skeleton', Phaser.Math.Clamp(this.hero.x - 120, 30, GAME_W - 30), this.arena.floorY - 16, { summoned: true });
          this.arena.spawnEnemy(p2 ? 'archer' : 'skeleton', Phaser.Math.Clamp(this.hero.x + 120, 30, GAME_W - 30), this.arena.floorY - 16, { summoned: true });
          this.endAttack(1.2);
        }
        break;

      case 'swoopPrep':
        this.steer(this.swoopFrom, 90, 260, dt, 6);
        if (this.stateTime <= 0) {
          this.toState('swoop', 1.3);
          this.setFrame(3); this.stop();
          Sfx.play('dash');
        }
        break;

      case 'swoop': {
        const k = 1 - this.stateTime / 1.3;
        const x = Phaser.Math.Linear(this.swoopFrom, GAME_W - this.swoopFrom, k);
        const y = 90 + Math.sin(k * Math.PI) * (this.arena.floorY - 40 - 90);
        this.setVelocity((x - this.x) / dt, (y - this.y) / dt);
        if (this.stateTime <= 0) { this.setVelocity(0, 0); this.toState('tired', p2 ? 1.0 : 1.6); this.setFrame(0); }
        break;
      }

      case 'tired':
        // pousado e vulnerável
        this.steer(this.x, this.arena.floorY - 36, 240, dt, 6);
        if (this.stateTime <= 0) this.endAttack(0.3);
        break;

      case 'rain':
        this.hover(dt, 20);
        if (this.stateTime <= 0) {
          for (let i = 0; i < 9; i++) {
            const x = rand(30, GAME_W - 30);
            this.arena.spawnShot({ tex: 'bone', x, y: -10, vy: 220, spin: 540, delay: 0.4 + i * 0.12, hitFloor: true, breakable: true, radius: 3 });
          }
          this.endAttack(1.2);
        }
        break;
    }
  }

  private cast(state: string, t: number) {
    this.toState(state, t);
    this.stop();
    this.setFrame(2);
    Sfx.play('charge');
  }

  private chooseAttack() {
    const p2 = this.phase >= 2;
    const pool: Array<[string, number]> = [['bones', 3], ['spikes', 3], ['swoop', 2]];
    if (this.minions() < 2) pool.push(['summon', 1.5]);
    if (p2) pool.push(['rain', 2]);
    const a = this.pick(pool);
    if (a === 'bones') this.cast('bones', 0.65);
    else if (a === 'spikes') this.cast('spikes', 0.5);
    else if (a === 'summon') this.cast('summon', 0.8);
    else if (a === 'rain') this.cast('rain', 0.6);
    else {
      this.swoopFrom = this.hero.x < GAME_W / 2 ? GAME_W - 70 : 70;
      this.toState('swoopPrep', 0.9);
    }
  }

  private endAttack(rest: number) {
    this.toState('idle', rest);
    this.targetX = rand(120, GAME_W - 120);
    this.play('boneking-idle');
  }
}

// ======================================================================
// SERAFIM GUARDIÃO — Mundo 2
// ======================================================================
class Seraph extends Boss {
  aim = new Phaser.Math.Vector2();
  volleys = 0;

  constructor(arena: ArenaApi) {
    super(arena, 'seraph', { tex: 'seraph', hp: 900, body: [30, 50, 25, 14], shards: 0 }, 140);
    this.play('seraph-idle');
  }

  protected onPhase() {
    Sfx.play('bossRoar');
    this.arena.shake(0.02, 700);
    this.arena.flash(0xffd75e, 0.4);
    this.arena.banner('OS OLHOS SE ABREM', 'Fase 2', '#ffd75e');
    for (let i = 0; i < 5; i++) {
      this.arena.spawnShot({
        tex: 'holyorb', anim: 'holyorb-spin', x: this.x, y: this.y, life: 9999, radius: 4,
        orbit: { cx: () => this.x, cy: () => this.y, r: 62, speed: 1.6, angle: (i / 5) * Math.PI * 2 },
      });
    }
  }

  think(dt: number) {
    this.t += dt;
    if (this.state === 'intro') return this.doIntro(dt);
    this.checkPhase(0.5, 2);
    const p2 = this.phase >= 2;
    if (this.state !== 'dive') this.setFlipX(this.hero.x < this.x);

    switch (this.state) {
      case 'idle':
        if (!this.anims.isPlaying) this.play('seraph-idle');
        this.hover(dt, 90);
        if (this.stateTime <= 0) this.chooseAttack();
        break;

      case 'descend':
        this.steer(this.targetX, this.arena.floorY - 46, 260, dt, 6);
        if (this.stateTime <= 0) { this.toState('raise', 0.45); this.stop(); this.setFrame(2); Sfx.play('charge'); this.setVelocity(0, 0); }
        break;

      case 'raise':
        this.setVelocity(0, 0);
        if (this.stateTime <= 0) {
          this.setFrame(3);
          Sfx.play('boom');
          this.arena.shake(0.012, 200);
          const y = this.arena.floorY - 10;
          for (const d of [-1, 1]) {
            this.arena.spawnShot({ tex: 'wave', anim: 'wave-run', x: this.x + d * 20, y, vx: d * 175, radius: 6, life: 5 });
            if (p2) this.arena.spawnShot({ tex: 'wave', anim: 'wave-run', x: this.x + d * 20, y, vx: d * 175, radius: 6, life: 5, delay: 0.55 });
          }
          this.endAttack(0.9);
        }
        break;

      case 'lances':
        this.hover(dt, 30);
        if (this.stateTime <= 0) {
          const n = p2 ? 9 : 6;
          const xs = [this.hero.x];
          for (let i = 1; i < n; i++) xs.push(rand(20, GAME_W - 20));
          xs.forEach((x, i) => {
            const delay = 0.55 + i * 0.1;
            this.arena.spawnHazard({ kind: 'rect', x: x - 3, y: 0, w: 6, h: this.arena.floorY, warn: delay, active: 0, damage: 0, color: 0xffd75e, sound: 'none' });
            this.arena.spawnShot({ tex: 'lance', x, y: -16, vy: 520, delay, hitFloor: true, radius: 3 });
          });
          this.endAttack(1.4);
        }
        break;

      case 'diveUp':
        this.steer(this.targetX, 50, 300, dt, 6);
        if (this.stateTime <= 0) {
          this.setVelocity(0, 0);
          const ang = Phaser.Math.Angle.Between(this.x, this.y, this.hero.x, this.hero.centerY);
          this.aim.setToPolar(ang, 400);
          this.arena.spawnHazard({ kind: 'line', x0: this.x, y0: this.y, x1: this.x + Math.cos(ang) * 600, y1: this.y + Math.sin(ang) * 600, warn: 0.6, active: 0, damage: 0, color: 0xffd75e, sound: 'none' });
          Sfx.play('charge');
          this.toState('diveAim', 0.6);
          this.stop(); this.setFrame(2);
        }
        break;

      case 'diveAim':
        this.setVelocity(0, 0);
        if (this.stateTime <= 0) { this.toState('dive', 1.5); this.setFrame(4); Sfx.play('dash'); this.setFlipX(this.aim.x < 0); }
        break;

      case 'dive':
        this.setVelocity(this.aim.x, this.aim.y);
        if (this.y >= this.arena.floorY - 44 || this.x < 30 || this.x > GAME_W - 30 || this.stateTime <= 0) {
          this.setVelocity(0, 0);
          Sfx.play('boom');
          this.arena.shake(0.015, 250);
          this.toState('stuck', p2 ? 0.9 : 1.4);
          this.setFrame(3);
        }
        break;

      case 'stuck':
        this.setVelocity(0, 0);
        if (this.stateTime <= 0) this.endAttack(0.4);
        break;

      case 'feathers':
        this.hover(dt, 30);
        if (this.stateTime <= 0) {
          const base = Phaser.Math.Angle.Between(this.x, this.y, this.hero.x, this.hero.centerY);
          for (let i = -3; i <= 3; i++) {
            const a = base + i * 0.16;
            this.arena.spawnShot({ tex: 'feather', x: this.x, y: this.y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, faceVelocity: true, radius: 2 });
          }
          Sfx.play('shoot');
          this.volleys++;
          if (p2 && this.volleys < 2) { this.toState('feathers', 0.4); break; }
          this.volleys = 0;
          this.endAttack(1.0);
        }
        break;
    }
  }

  private chooseAttack() {
    const a = this.pick([['wave', 3], ['lances', 2.5], ['dive', 2.5], ['feathers', 2.5]]);
    if (a === 'wave') {
      this.targetX = Phaser.Math.Clamp(this.hero.x + (Math.random() < 0.5 ? -110 : 110), 60, GAME_W - 60);
      this.toState('descend', 0.9);
    } else if (a === 'lances') {
      this.toState('lances', 0.5); this.stop(); this.setFrame(2); Sfx.play('charge');
    } else if (a === 'dive') {
      this.targetX = this.hero.x < GAME_W / 2 ? GAME_W - 80 : 80;
      this.toState('diveUp', 0.9);
    } else {
      this.toState('feathers', 0.5); this.stop(); this.setFrame(2); Sfx.play('charge');
    }
  }

  private endAttack(rest: number) {
    this.toState('idle', rest * (this.phase >= 2 ? 0.75 : 1));
    this.targetX = rand(120, GAME_W - 120);
    this.play('seraph-idle');
  }
}

// ======================================================================
// O FALSO ANJO — Mundo 3 (chefe final)
// ======================================================================
class FalseAngel extends Boss {
  spiralA = 0;
  spiralT = 0;

  constructor(arena: ArenaApi) {
    super(arena, 'falseangel', { tex: 'falseangel', hp: 1400, body: [36, 64, 30, 16], shards: 0 }, 150);
    this.introTime = 3;
    this.toState('intro', this.introTime);
    this.play('falseangel-idle');
  }

  private get idleAnim() { return this.phase >= 2 ? 'falseangel-idle2' : 'falseangel-idle'; }
  private get castFrame() { return this.phase >= 2 ? 5 : 2; }

  protected onPhase(p: number) {
    Sfx.play('bossRoar');
    this.arena.shake(0.025, 900);
    if (p === 2) {
      this.arena.flash(0xffffff, 0.8);
      this.arena.banner('A MÁSCARA SE PARTE', 'Fase 2', '#c060ff');
      this.play('falseangel-idle2');
    } else {
      this.arena.flash(0x7a2ab8, 0.8);
      this.arena.banner('DESESPERO', 'Fase final', '#e83b3b');
      (this.arena as unknown as { onFinalPhase?: () => void }).onFinalPhase?.();
    }
    this.toState('idle', 1.2);
  }

  think(dt: number) {
    this.t += dt;
    if (this.state === 'intro') return this.doIntro(dt);
    if (this.checkPhase(0.65, 2) || this.checkPhase(0.3, 3)) return;
    this.setFlipX(false);

    switch (this.state) {
      case 'idle':
        if (!this.anims.isPlaying) this.play(this.idleAnim);
        this.hover(dt, 70);
        if (this.stateTime <= 0) this.chooseAttack();
        break;

      case 'pillars':
        this.hover(dt, 20);
        if (this.stateTime <= 0) {
          const n = this.phase >= 2 ? 6 : 4;
          const sweep = this.phase >= 2 && Math.random() < 0.5;
          const xs: number[] = [];
          if (sweep) for (let i = 0; i < 8; i++) xs.push(40 + i * ((GAME_W - 80) / 7));
          else { xs.push(this.hero.x); for (let i = 1; i < n; i++) xs.push(rand(20, GAME_W - 20)); }
          xs.forEach((x, i) => this.arena.spawnHazard({
            kind: 'rect', x: x - 13, y: 0, w: 26, h: this.arena.floorY, warn: sweep ? 0.6 + i * 0.15 : 0.9, active: 0.45,
            color: this.phase >= 2 ? 0xc060ff : 0xffd75e, style: 'pillar', sound: 'laser',
          }));
          this.endAttack(1.3);
        }
        break;

      case 'halo':
        this.hover(dt, 20);
        if (this.stateTime <= 0) {
          const p2 = this.phase >= 2;
          const n = p2 ? 16 : 12;
          for (let ring = 0; ring < (p2 ? 2 : 1); ring++)
            for (let i = 0; i < n; i++) {
              const a = (i / n) * Math.PI * 2 + ring * (Math.PI / n);
              this.arena.spawnShot({
                tex: p2 ? 'darkorb' : 'holyorb', anim: p2 ? 'darkorb-spin' : 'holyorb-spin',
                x: this.x, y: this.y - 10, vx: Math.cos(a) * 95, vy: Math.sin(a) * 95, delay: ring * 0.45, radius: 3,
              });
            }
          Sfx.play('magic');
          this.endAttack(1.2);
        }
        break;

      case 'vanish':
        this.setVelocity(0, 0);
        this.setAlpha(Math.max(0, this.stateTime / 0.4));
        if (this.stateTime <= 0) {
          const side = this.hero.x < GAME_W / 2 ? 1 : -1;
          this.setPosition(Phaser.Math.Clamp(this.hero.x + side * 90, 60, GAME_W - 60), this.arena.floorY - 58);
          this.toState('appear', 0.3);
          this.stop(); this.setFrame(this.castFrame);
        }
        break;

      case 'appear': {
        this.setAlpha(1 - this.stateTime / 0.3);
        if (this.stateTime <= 0) {
          this.setAlpha(1);
          const dir = this.hero.x < this.x ? -1 : 1;
          const w = 190;
          this.arena.spawnHazard({
            kind: 'rect', x: dir > 0 ? this.x : this.x - w, y: this.arena.floorY - 40, w, h: 40,
            warn: 0.5, active: 0.2, color: 0xc060ff, style: 'blade', sound: 'boom',
            onActivate: () => this.arena.shake(0.01, 150),
          });
          this.toState('slashRecover', 1.2);
        }
        break;
      }

      case 'slashRecover':
        this.setVelocity(0, 0);
        if (this.stateTime <= 0) this.endAttack(0.4);
        break;

      case 'summon':
        this.hover(dt, 20);
        if (this.stateTime <= 0) {
          this.arena.spawnEnemy('voideye', 100, 110, { summoned: true });
          this.arena.spawnEnemy(this.phase >= 2 ? 'fallen' : 'voideye', GAME_W - 100, 110, { summoned: true });
          this.endAttack(1.0);
        }
        break;

      case 'meteors':
        this.hover(dt, 20);
        if (this.stateTime <= 0) {
          for (let i = 0; i < 10; i++) {
            const x = i === 0 ? this.hero.x : rand(20, GAME_W - 20);
            this.arena.spawnShot({ tex: 'meteor', anim: 'meteor-spin', x, y: -16, vy: 190, delay: i * 0.18, hitFloor: true, radius: 5 });
          }
          this.endAttack(1.4);
        }
        break;

      case 'laser':
        this.hover(dt, 20);
        if (this.stateTime <= 0) {
          const y = this.hero.centerY;
          this.arena.spawnHazard({ kind: 'rect', x: 0, y: y - 7, w: GAME_W, h: 14, warn: 0.85, active: 0.4, color: 0xc060ff, style: 'pillar', sound: 'laser' });
          this.endAttack(1.3);
        }
        break;

      case 'spiral':
        this.setVelocity(0, 0);
        this.spiralT -= dt;
        if (this.spiralT <= 0) {
          this.spiralT = 0.17;
          this.spiralA += 0.33;
          for (let k = 0; k < 3; k++) {
            const a = this.spiralA + (k / 3) * Math.PI * 2;
            this.arena.spawnShot({ tex: 'darkorb', anim: 'darkorb-spin', x: this.x, y: this.y - 10, vx: Math.cos(a) * 95, vy: Math.sin(a) * 95, radius: 3 });
          }
          Sfx.play('shoot');
        }
        if (this.stateTime <= 0) this.endAttack(0.8);
        break;
    }
  }

  private cast(state: string, t: number) {
    this.toState(state, t);
    this.stop();
    this.setFrame(this.castFrame);
    Sfx.play('charge');
  }

  private chooseAttack() {
    const pool: Array<[string, number]> = [['pillars', 3], ['halo', 3], ['slash', 2.5]];
    if (this.minions() < 2 && this.phase < 3) pool.push(['summon', this.phase === 1 ? 1.2 : 0.8]);
    if (this.phase >= 2) pool.push(['meteors', 2.5], ['laser', 2.5]);
    if (this.phase >= 3) pool.push(['spiral', 3]);
    const a = this.pick(pool);
    if (a === 'slash') { this.toState('vanish', 0.4); Sfx.play('magic'); }
    else if (a === 'spiral') { this.cast('spiral', 3.0); this.targetX = GAME_W / 2; }
    else this.cast(a, a === 'halo' ? 0.6 : 0.5);
  }

  private endAttack(rest: number) {
    const mult = this.phase === 3 ? 0.55 : this.phase === 2 ? 0.75 : 1;
    this.toState('idle', rest * mult);
    this.targetX = rand(120, GAME_W - 120);
    this.play(this.idleAnim);
  }
}

export function createBoss(arena: ArenaApi, type: BossType): Boss {
  switch (type) {
    case 'boneking': return new BoneKing(arena);
    case 'seraph': return new Seraph(arena);
    case 'falseangel': return new FalseAngel(arena);
  }
}
