import Phaser from 'phaser';
import { Enemy, type HitInfo } from './Enemy';
import { Sfx } from '../audio/Sfx';
import type { ArenaApi } from './api';
import type { EnemyType } from '../data/types';
import { GAME_W } from '../config';

const rand = Phaser.Math.FloatBetween;

// ======================= MUNDO 1 =======================

class Skeleton extends Enemy {
  constructor(a: ArenaApi, x: number, y: number) {
    super(a, x, y, { tex: 'skeleton', hp: 30, body: [12, 24, 10, 7], shards: 3 });
    this.play('skeleton-walk');
    this.toState('walk');
  }
  think() {
    const dx = this.dxHero();
    switch (this.state) {
      case 'walk':
        this.faceHero();
        if (!this.anims.isPlaying) this.play('skeleton-walk');
        this.setVelocityX(this.facing * 44 * this.speedMul);
        if (Math.abs(dx) < 36 && Math.abs(this.dyHero()) < 34 && this.cooldown <= 0) {
          this.toState('windup', 0.45);
          this.stop(); this.setFrame(4);
          this.setVelocityX(0);
        }
        break;
      case 'windup':
        this.setVelocityX(0);
        if (this.stateTime <= 0) { this.toState('slash', 0.18); this.setFrame(5); Sfx.play('swing'); this.setVelocityX(this.facing * 60); }
        break;
      case 'slash':
        this.strike(32, 22);
        if (this.stateTime <= 0) { this.toState('recover', 0.5); this.setVelocityX(0); }
        break;
      case 'recover':
        this.setVelocityX(0);
        if (this.stateTime <= 0) { this.toState('walk'); this.cooldown = 0.6; }
        break;
    }
  }
}

class Archer extends Enemy {
  constructor(a: ArenaApi, x: number, y: number) {
    super(a, x, y, { tex: 'archer', hp: 24, body: [12, 24, 10, 7], shards: 3 });
    this.play('archer-walk');
    this.toState('move');
    this.cooldown = rand(1, 2);
  }
  think() {
    this.faceHero();
    const dist = Math.abs(this.dxHero());
    switch (this.state) {
      case 'move': {
        let vx = 0;
        if (dist < 120) vx = -this.facing * 38;
        else if (dist > 230) vx = this.facing * 38;
        if (this.x < 30 || this.x > GAME_W - 30) vx = 0;
        this.setVelocityX(vx * this.speedMul);
        if (!this.anims.isPlaying) this.play('archer-walk');
        if (this.cooldown <= 0) { this.toState('draw', 0.65); this.stop(); this.setFrame(2); this.setVelocityX(0); Sfx.play('charge'); }
        break;
      }
      case 'draw':
        this.setVelocityX(0);
        if (Math.floor(this.stateTime * 10) % 2 === 0) this.setTintFill(0xffe45e);
        if (this.stateTime <= 0) {
          const ang = Phaser.Math.Angle.Between(this.x, this.cy - 2, this.hero.x, this.hero.centerY);
          this.arena.spawnShot({ tex: 'arrow', x: this.x + this.facing * 10, y: this.cy - 2, vx: Math.cos(ang) * 200, vy: Math.sin(ang) * 200, breakable: true, faceVelocity: true, radius: 2 });
          Sfx.play('shoot');
          this.setFrame(3);
          this.toState('after', 0.4);
        }
        break;
      case 'after':
        if (this.stateTime <= 0) { this.toState('move'); this.cooldown = rand(2.0, 2.8); }
        break;
    }
  }
}

class Zombie extends Enemy {
  constructor(a: ArenaApi, x: number, y: number) {
    super(a, x, y, { tex: 'zombie', hp: 55, body: [14, 22, 10, 9], kbResist: 0.5, shards: 4 });
    this.play('zombie-walk');
    this.toState('walk');
  }
  think() {
    const dx = this.dxHero();
    switch (this.state) {
      case 'walk':
        this.faceHero();
        if (!this.anims.isPlaying) this.play('zombie-walk');
        this.setVelocityX(this.facing * 26 * this.speedMul);
        if (Math.abs(dx) < 100 && this.cooldown <= 0 && this.grounded) {
          this.toState('crouch', 0.5); this.stop(); this.setFrame(4); this.setVelocityX(0);
        }
        break;
      case 'crouch':
        this.setVelocityX(0);
        if (this.stateTime <= 0) {
          this.toState('lunge', 0.25); this.setFrame(5);
          this.setVelocity(this.facing * 210 * this.speedMul, -170);
          Sfx.play('swing');
        }
        break;
      case 'lunge':
        if (this.stateTime <= 0 && this.grounded) { this.toState('recover', 0.7); this.setVelocityX(0); this.setFrame(0); }
        break;
      case 'recover':
        this.setVelocityX(this.body.velocity.x * 0.8);
        if (this.stateTime <= 0) { this.toState('walk'); this.cooldown = 1.2; }
        break;
    }
  }
}

class Crow extends Enemy {
  side = Math.random() < 0.5 ? -1 : 1;
  t = Math.random() * 10;
  diveV = new Phaser.Math.Vector2();
  constructor(a: ArenaApi, x: number, y: number) {
    super(a, x, y, { tex: 'crow', hp: 16, body: [14, 8, 5, 4], flying: true, shards: 2 });
    this.play('crow-fly');
    this.toState('hover');
    this.cooldown = rand(1.5, 3);
  }
  think(dt: number) {
    this.t += dt;
    switch (this.state) {
      case 'hover': {
        if (!this.anims.isPlaying) this.play('crow-fly');
        const tx = this.hero.x + this.side * 80, ty = this.hero.centerY - 80 + Math.sin(this.t * 3) * 10;
        this.steer(tx, ty, 120, dt);
        this.faceHero();
        if (this.cooldown <= 0) { this.toState('tell', 0.45); this.setVelocity(0, 0); }
        break;
      }
      case 'tell':
        this.faceHero();
        this.x += Math.sin(this.t * 60) * 0.6;
        if (Math.floor(this.stateTime * 12) % 2 === 0) this.setTintFill(0xe83b3b);
        if (this.stateTime <= 0) {
          const ang = Phaser.Math.Angle.Between(this.x, this.y, this.hero.x, this.hero.centerY);
          this.diveV.setToPolar(ang, 240 * this.speedMul);
          this.toState('dive', 0.9); this.stop(); this.setFrame(2);
          Sfx.play('dash');
        }
        break;
      case 'dive':
        this.setVelocity(this.diveV.x, this.diveV.y);
        this.facing = this.diveV.x >= 0 ? 1 : -1;
        if (this.stateTime <= 0 || this.y > this.arena.floorY - 16) {
          this.toState('hover'); this.cooldown = rand(2, 3.2); this.side *= -1;
        }
        break;
    }
  }
}

// ======================= MUNDO 2 =======================

class WingedKnight extends Enemy {
  side = Math.random() < 0.5 ? -1 : 1;
  t = Math.random() * 10;
  aim = new Phaser.Math.Vector2();
  charges = 0;
  constructor(a: ArenaApi, x: number, y: number, public profane = false) {
    super(a, x, y, { tex: profane ? 'profane' : 'knight', hp: profane ? 85 : 60, body: [14, 22, 11, 4], flying: true, kbResist: 0.3, shards: 5 });
    this.play(profane ? 'profane-fly' : 'knight-fly');
    this.toState('hover');
    this.cooldown = rand(1.5, 2.5);
  }
  think(dt: number) {
    this.t += dt;
    const anim = this.profane ? 'profane-fly' : 'knight-fly';
    switch (this.state) {
      case 'hover': {
        if (!this.anims.isPlaying) this.play(anim);
        this.steer(this.hero.x + this.side * 120, this.hero.centerY - 60 + Math.sin(this.t * 2) * 12, 110, dt, 3);
        this.faceHero();
        if (this.cooldown <= 0) this.beginAim();
        break;
      }
      case 'aim':
        this.setVelocity(0, 0);
        this.faceHero();
        if (this.stateTime <= 0) {
          this.toState('charge', 0.55); this.setFrame(3);
          this.setVelocity(this.aim.x, this.aim.y);
          Sfx.play('dash');
        }
        break;
      case 'charge':
        this.setVelocity(this.aim.x, this.aim.y);
        this.facing = this.aim.x >= 0 ? 1 : -1;
        if (this.stateTime <= 0 || this.y >= this.arena.floorY - 14) {
          if (this.profane && this.charges < 1) { this.charges++; this.beginAim(0.35); break; }
          this.toState('recover', 0.6); this.setFrame(4); this.charges = 0;
        }
        break;
      case 'recover':
        this.setVelocity(this.body.velocity.x * 0.9, -30);
        if (this.stateTime <= 0) { this.toState('hover'); this.cooldown = rand(2.2, 3.2); this.side *= -1; this.play(anim); }
        break;
    }
  }
  private beginAim(t = 0.6) {
    this.toState('aim', t);
    this.stop(); this.setFrame(2);
    const tx = this.hero.x, ty = this.hero.centerY;
    const ang = Phaser.Math.Angle.Between(this.x, this.y, tx, ty);
    this.aim.setToPolar(ang, (this.profane ? 360 : 300) * this.speedMul);
    this.arena.spawnHazard({ kind: 'line', x0: this.x, y0: this.y, x1: this.x + Math.cos(ang) * 260, y1: this.y + Math.sin(ang) * 260, warn: t, active: 0, damage: 0, color: this.profane ? 0xc060ff : 0xffd75e, sound: 'none' });
    Sfx.play('charge');
  }
}

class Ofanim extends Enemy {
  t = Math.random() * 10;
  side = Math.random() < 0.5 ? -1 : 1;
  constructor(a: ArenaApi, x: number, y: number, public voidEye = false) {
    super(a, x, y, { tex: voidEye ? 'voideye' : 'ofanim', hp: voidEye ? 55 : 45, body: [14, 14, 5, 5], flying: true, shards: 4 });
    this.play(voidEye ? 'voideye-idle' : 'ofanim-idle');
    this.toState('float');
    this.cooldown = rand(1.5, 2.5);
  }
  think(dt: number) {
    this.t += dt;
    const idle = this.voidEye ? 'voideye-idle' : 'ofanim-idle';
    switch (this.state) {
      case 'float': {
        if (!this.anims.isPlaying) this.play(idle);
        const tx = Phaser.Math.Clamp(this.hero.x + this.side * 140, 30, GAME_W - 30);
        this.steer(tx, this.hero.centerY - 90 + Math.sin(this.t * 1.5) * 20, 60, dt, 2);
        this.faceHero();
        if (this.cooldown <= 0) {
          this.toState('charge', this.voidEye ? 0.3 : 0.55); this.stop(); this.setFrame(2); this.setVelocity(0, 0);
          Sfx.play('charge');
          if (this.voidEye) this.aimLaser();
        }
        break;
      }
      case 'charge':
        this.setVelocity(0, 0);
        if (this.stateTime <= 0) {
          if (!this.voidEye) this.fireOrbs();
          this.toState('after', this.voidEye ? 1.1 : 0.5);
        }
        break;
      case 'after':
        this.setVelocity(0, 0);
        if (this.stateTime <= 0) { this.toState('float'); this.cooldown = rand(2.4, 3.2); this.side *= -1; this.play(idle); }
        break;
    }
  }
  private fireOrbs() {
    const base = Phaser.Math.Angle.Between(this.x, this.y, this.hero.x, this.hero.centerY);
    for (const off of [-0.28, 0, 0.28]) {
      this.arena.spawnShot({ tex: 'holyorb', anim: 'holyorb-spin', x: this.x, y: this.y, vx: Math.cos(base + off) * 100, vy: Math.sin(base + off) * 100, radius: 3 });
    }
    Sfx.play('magic');
  }
  private aimLaser() {
    const ang = Phaser.Math.Angle.Between(this.x, this.y, this.hero.x, this.hero.centerY);
    const len = 800;
    this.arena.spawnHazard({
      kind: 'line', x0: this.x, y0: this.y, x1: this.x + Math.cos(ang) * len, y1: this.y + Math.sin(ang) * len,
      thick: 6, warn: 0.8, active: 0.3, color: 0xc060ff, sound: 'laser',
    });
  }
}

class Sentinel extends Enemy {
  turnDelay = 0;
  constructor(a: ArenaApi, x: number, y: number) {
    super(a, x, y, { tex: 'sentinel', hp: 80, body: [14, 24, 9, 7], kbResist: 0.8, shards: 5 });
    this.play('sentinel-walk');
    this.toState('walk');
  }
  protected blocks(h: HitInfo) {
    // escudo frontal bloqueia golpes horizontais vindos da frente
    if (h.attackDir !== 'fwd' || this.state === 'recover' || this.state === 'thrust') return false;
    const attackerInFront = Math.sign(h.fromX - this.x) === this.facing;
    if (attackerInFront) {
      this.setFrame(4);
      this.arena.fx('spark', this.x + this.facing * 12, this.cy - 4, { tint: 0xffd75e });
    }
    return attackerInFront;
  }
  think(dt: number) {
    const want = this.hero.x >= this.x ? 1 : -1;
    if (want !== this.facing && this.state === 'walk') {
      this.turnDelay += dt;
      if (this.turnDelay > 0.7) { this.facing = want; this.turnDelay = 0; }
    } else this.turnDelay = 0;
    switch (this.state) {
      case 'walk':
        if (!this.anims.isPlaying) this.play('sentinel-walk');
        this.setVelocityX(this.facing * 24 * this.speedMul);
        if (Math.abs(this.dxHero()) < 48 && Math.abs(this.dyHero()) < 30 && this.cooldown <= 0 && want === this.facing) {
          this.toState('windup', 0.5); this.stop(); this.setFrame(2); this.setVelocityX(0);
        }
        break;
      case 'windup':
        this.setVelocityX(0);
        if (this.stateTime <= 0) { this.toState('thrust', 0.22); this.setFrame(3); Sfx.play('swing'); this.setVelocityX(this.facing * 90); }
        break;
      case 'thrust':
        this.strike(44, 12, 2);
        if (this.stateTime <= 0) { this.toState('recover', 0.8); this.setVelocityX(0); this.setFrame(5); }
        break;
      case 'recover':
        this.setVelocityX(0);
        if (this.stateTime <= 0) { this.toState('walk'); this.cooldown = 1.0; }
        break;
    }
  }
}

// ======================= MUNDO 3 =======================

class Fallen extends Enemy {
  t = Math.random() * 10;
  constructor(a: ArenaApi, x: number, y: number) {
    super(a, x, y, { tex: 'fallen', hp: 70, body: [14, 24, 10, 5], flying: true, kbResist: 0.4, shards: 6 });
    this.play('fallen-idle');
    this.toState('drift');
    this.cooldown = rand(1.2, 2.2);
  }
  think(dt: number) {
    this.t += dt;
    switch (this.state) {
      case 'drift':
        if (!this.anims.isPlaying) this.play('fallen-idle');
        this.faceHero();
        this.steer(this.hero.x - this.facing * 90, this.hero.centerY - 50 + Math.sin(this.t * 2) * 14, 80, dt, 2);
        if (this.cooldown <= 0) {
          if (Math.random() < 0.6) { this.toState('vanish', 0.3); Sfx.play('magic'); }
          else { this.toState('cast', 0.5); this.stop(); this.setFrame(2); Sfx.play('charge'); }
        }
        break;
      case 'vanish':
        this.setVelocity(0, 0);
        this.setAlpha(Math.max(0, this.stateTime / 0.3));
        if (this.stateTime <= 0) {
          const side = this.hero.facing > 0 ? -1 : 1; // aparece atrás do herói
          this.setPosition(Phaser.Math.Clamp(this.hero.x + side * 34, 20, GAME_W - 20), this.hero.centerY - 4);
          this.faceHero();
          this.toState('appear', 0.25);
        }
        break;
      case 'appear':
        this.setAlpha(1 - this.stateTime / 0.25);
        if (this.stateTime <= 0) { this.setAlpha(1); this.toState('windup', 0.35); this.stop(); this.setFrame(2); }
        break;
      case 'windup':
        this.setVelocity(0, 0);
        if (Math.floor(this.stateTime * 14) % 2 === 0) this.setTintFill(0xc060ff);
        if (this.stateTime <= 0) { this.toState('slash', 0.18); this.setFrame(3); Sfx.play('swing'); }
        break;
      case 'slash':
        this.strike(38, 26);
        if (this.stateTime <= 0) { this.toState('recover', 0.6); }
        break;
      case 'cast':
        this.setVelocity(0, 0);
        if (this.stateTime <= 0) {
          const base = Phaser.Math.Angle.Between(this.x, this.y, this.hero.x, this.hero.centerY);
          for (let i = -2; i <= 2; i++) {
            const a = base + i * 0.22;
            this.arena.spawnShot({ tex: 'darkorb', anim: 'darkorb-spin', x: this.x, y: this.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, radius: 3 });
          }
          Sfx.play('magic');
          this.toState('recover', 0.5);
        }
        break;
      case 'recover':
        this.setVelocity(this.body.velocity.x * 0.9, -20);
        if (this.stateTime <= 0) { this.toState('drift'); this.cooldown = rand(1.8, 2.8); this.play('fallen-idle'); }
        break;
    }
  }
}

export function createEnemy(arena: ArenaApi, type: EnemyType, x: number, y: number): Enemy {
  let e: Enemy;
  switch (type) {
    case 'skeleton': e = new Skeleton(arena, x, y); break;
    case 'archer': e = new Archer(arena, x, y); break;
    case 'zombie': e = new Zombie(arena, x, y); break;
    case 'crow': e = new Crow(arena, x, y); break;
    case 'knight': e = new WingedKnight(arena, x, y); break;
    case 'profane': e = new WingedKnight(arena, x, y, true); break;
    case 'ofanim': e = new Ofanim(arena, x, y); break;
    case 'voideye': e = new Ofanim(arena, x, y, true); break;
    case 'sentinel': e = new Sentinel(arena, x, y); break;
    case 'fallen': e = new Fallen(arena, x, y); break;
  }
  e.kind = type;
  return e;
}

export const FLYING: EnemyType[] = ['crow', 'knight', 'profane', 'ofanim', 'voideye', 'fallen'];
