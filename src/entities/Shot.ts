import Phaser from 'phaser';
import { DEPTH, GAME_W } from '../config';
import type { ArenaApi } from './api';

export interface ShotOpts {
  tex: string;
  anim?: string;
  frame?: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  damage?: number;
  life?: number;
  spin?: number;            // graus por segundo
  gravity?: number;
  breakable?: boolean;      // pode ser destruído com a arma
  hitFloor?: boolean;       // some ao tocar o chão
  radius?: number;
  tint?: number;
  faceVelocity?: boolean;
  accel?: number;           // multiplicador de velocidade por segundo
  orbit?: { cx: () => number; cy: () => number; r: number; speed: number; angle: number };
  delay?: number;           // fica parado/invisível até disparar
}

export class Shot extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  damage: number;
  life: number;
  breakable: boolean;
  o: ShotOpts;
  armed = true;

  constructor(public arena: ArenaApi, o: ShotOpts) {
    super(arena, o.x, o.y, o.tex, o.frame ?? 0);
    this.o = o;
    arena.add.existing(this);
    arena.physics.add.existing(this);
    this.damage = o.damage ?? 1;
    this.life = o.life ?? 6;
    this.breakable = o.breakable ?? false;
    this.setDepth(DEPTH.projectiles);
    this.body.setAllowGravity(false);
    const r = o.radius ?? Math.max(2, Math.min(this.width, this.height) / 2 - 1);
    this.body.setCircle(r, this.width / 2 - r, this.height / 2 - r);
    if (o.anim) this.play(o.anim);
    if (o.tint !== undefined) this.setTint(o.tint);
    if (o.delay && o.delay > 0) {
      this.armed = false;
      this.setAlpha(0.35);
      this.setVelocity(0, 0);
    } else {
      this.setVelocity(o.vx ?? 0, o.vy ?? 0);
    }
    this.orient();
  }

  private orient() {
    if (this.o.faceVelocity) {
      const v = this.body.velocity;
      if (v.lengthSq() > 1) this.setRotation(Math.atan2(v.y, v.x));
    }
  }

  preUpdate(time: number, delta: number) {
    if (this.arena.frozen) return;
    super.preUpdate(time, delta);
    const dt = delta / 1000;
    if (!this.armed) {
      this.o.delay! -= dt;
      if (this.o.delay! <= 0) {
        this.armed = true;
        this.setAlpha(1);
        this.setVelocity(this.o.vx ?? 0, this.o.vy ?? 0);
        this.orient();
      }
      return;
    }
    this.life -= dt;
    const o = this.o;
    if (o.orbit) {
      o.orbit.angle += o.orbit.speed * dt;
      this.setPosition(o.orbit.cx() + Math.cos(o.orbit.angle) * o.orbit.r, o.orbit.cy() + Math.sin(o.orbit.angle) * o.orbit.r);
    }
    if (o.gravity) this.body.velocity.y += o.gravity * dt;
    if (o.accel) this.body.velocity.scale(Math.pow(o.accel, dt));
    if (o.spin) this.angle += o.spin * dt;
    this.orient();
    const out = this.x < -40 || this.x > GAME_W + 40 || this.y > this.arena.floorY + 60 || this.y < -200;
    if (o.hitFloor && this.y >= this.arena.floorY - 2) {
      this.arena.fx('spark', this.x, this.arena.floorY - 4);
      this.destroy();
      return;
    }
    if (this.life <= 0 || (out && !o.orbit)) this.destroy();
  }
}
