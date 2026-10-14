import Phaser from 'phaser';
import { DEPTH } from '../config';
import { HERO_FRAMES } from '../gfx/heroArt';
import { Sfx } from '../audio/Sfx';
import type { Stats } from '../state/Stats';
import type { Controls } from '../systems/Controls';
import type { ArenaApi } from './api';
import type { Enemy } from './Enemy';
import type { AbilityId } from '../data/types';

const JUMP_V = 365;
const MAX_FALL = 430;
const DASH_SPEED = 330;
const DASH_TIME = 0.16;
const SCREAM_RADIUS = 130;

type AttackDir = 'fwd' | 'up' | 'down';

/** Projétil do herói (Lâmina Espectral e lanças do Juízo) */
interface Bolt {
  sprite: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  hit: Set<object>;
}

export class Hero extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  stats: Stats;
  hp: number;
  energy = 0;
  facing = 1;
  dead = false;

  invuln = 0;
  attackCd = 0;
  attackActive = 0;
  attackPose = 0;
  attackDir: AttackDir = 'fwd';
  hitSet = new Set<object>();
  combo = 0;
  comboTimer = 0;

  coyote = 0;
  jumpBuffer = 0;
  jumpsUsed = 0;
  dropTimer = 0;
  wasGrounded = true;

  dashTime = 0;
  dashCd = 0;
  dashDir = 1;
  airDashed = false;
  ghostTimer = 0;

  screamCd = 0;
  screamPose = 0;

  healing = false;
  healProgress = 0;
  healFx = 0;

  knockback = 0;
  regenTimer = 0;
  kills = 0;
  cheatUsed = false;
  abilityCd = 0;
  bolts: Bolt[] = [];

  shieldRing: Phaser.GameObjects.Arc;
  weaponFx: Phaser.GameObjects.Sprite | null = null;

  constructor(public arena: ArenaApi, x: number, y: number, stats: Stats, public skin = 'hero') {
    super(arena, x, y, skin, 0);
    arena.add.existing(this);
    arena.physics.add.existing(this);
    this.stats = stats;
    this.hp = stats.maxHp;
    this.energy = 0;
    this.setDepth(DEPTH.hero);
    this.body.setSize(10, 22).setOffset(11, 9);
    this.body.setMaxVelocityY(MAX_FALL);
    this.setCollideWorldBounds(true);
    this.play(`${skin}-idle`);

    this.shieldRing = arena.add.circle(x, y, 16).setStrokeStyle(1, 0x8ef0ff, 0.8).setDepth(DEPTH.hero + 1).setVisible(false);
  }

  get grounded() { return this.body.blocked.down || this.body.touching.down; }
  get dashing() { return this.dashTime > 0; }
  get shieldActive() { return this.stats.shield && this.hp >= this.stats.maxHp; }
  get centerY() { return this.body.center.y; }

  // ------------------------------------------------------------------ update
  tick(dt: number, c: Controls) {
    this.shieldRing.setPosition(this.x, this.body.center.y);
    if (this.dead) { this.shieldRing.setVisible(false); return; }

    for (const k of ['invuln', 'attackCd', 'attackActive', 'attackPose', 'coyote', 'jumpBuffer', 'dropTimer',
      'dashCd', 'screamCd', 'screamPose', 'knockback', 'comboTimer', 'abilityCd'] as const) {
      this[k] = Math.max(0, this[k] - dt);
    }

    this.updateRegen(dt);
    this.updateBolts(dt);

    const grounded = this.grounded;
    if (grounded) {
      if (!this.wasGrounded && this.body.velocity.y >= 0) Sfx.play('land');
      this.coyote = 0.1;
      this.jumpsUsed = 0;
      this.airDashed = false;
    }
    this.wasGrounded = grounded;

    // --- Investida em andamento ---
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.body.setAllowGravity(false);
      this.setVelocity(this.dashDir * DASH_SPEED, 0);
      this.ghostTimer -= dt;
      if (this.ghostTimer <= 0) { this.ghostTimer = 0.025; this.spawnGhost(); }
      if (this.dashTime <= 0) {
        this.body.setAllowGravity(true);
        this.setVelocityX(this.dashDir * this.stats.moveSpeed * 0.6);
      }
      this.checkAttackHits();
      this.updatePose();
      return;
    }

    // --- Cura canalizada ---
    const canHeal = grounded && this.hp < this.stats.maxHp && this.energy >= this.stats.spellCost - 1e-6 && this.attackActive <= 0;
    if (c.down('heal') && canHeal && this.knockback <= 0) {
      if (!this.healing) { this.healing = true; this.healProgress = 0; Sfx.play('healCharge'); }
      this.healProgress += dt;
      this.healFx -= dt;
      if (this.healFx <= 0) { this.healFx = 0.06; this.arena.healParticle(this.x, this.body.center.y); }
      if (this.healProgress >= this.stats.healTime) {
        this.energy -= this.stats.spellCost;
        this.hp = Math.min(this.stats.maxHp, this.hp + 1);
        this.healProgress = 0;
        Sfx.play('heal');
        this.arena.floatText(this.x, this.y - 26, '+1', '#8ef0ff');
        this.arena.flash(0x8ef0ff, 0.15);
        if (this.hp >= this.stats.maxHp || this.energy < this.stats.spellCost) this.healing = false;
      }
    } else if (this.healing) {
      this.healing = false;
      this.healProgress = 0;
    }

    // --- Movimento horizontal ---
    let ix = 0;
    if (c.down('left')) ix -= 1;
    if (c.down('right')) ix += 1;
    if (this.knockback > 0) {
      // mantém o empurrão
    } else if (this.healing) {
      this.setVelocityX(0);
    } else {
      this.setVelocityX(ix * this.stats.moveSpeed);
      if (ix !== 0 && this.attackActive <= 0) this.facing = ix;
    }

    // --- Pulo ---
    if (c.pressed('jump')) this.jumpBuffer = 0.12;
    if (this.jumpBuffer > 0 && !this.healing) {
      if (c.down('down') && grounded && this.onPlatform()) {
        this.dropTimer = 0.25;
        this.jumpBuffer = 0;
        this.y += 2;
      } else if (this.coyote > 0) {
        this.doJump(1);
      } else if (this.stats.doubleJump && this.jumpsUsed < 1) {
        this.jumpsUsed = 1;
        this.doJump(0.9);
        this.arena.burst(this.x, this.body.bottom, 'pfeather', 0xffffff, 6);
      }
    }
    if (c.released('jump') && this.body.velocity.y < 0) this.setVelocityY(this.body.velocity.y * 0.45);

    // --- Ataque ---
    const click = c.click;
    if ((c.pressed('attack') || click) && this.attackCd <= 0 && !this.healing) {
      let dir: AttackDir;
      if (click) {
        // mira com o mouse: ataca na direção do cursor
        const dx = click.x - this.x, dy = click.y - this.body.center.y;
        if (dy < -Math.abs(dx) * 1.1) dir = 'up';
        else if (dy > Math.abs(dx) * 1.1 && !grounded) dir = 'down';
        else { dir = 'fwd'; this.facing = dx >= 0 ? 1 : -1; }
      } else {
        dir = c.down('up') ? 'up' : c.down('down') && !grounded ? 'down' : 'fwd';
      }
      this.startAttack(dir);
    }
    this.checkAttackHits();
    this.updateWeaponFx();

    // --- Habilidades ---
    if (c.pressed('dash') && this.stats.dash) this.dash();
    if (c.pressed('skill1')) this.useAbility(this.stats.abilities[0]);
    if (c.pressed('skill2')) this.useAbility(this.stats.abilities[1]);

    this.shieldRing.setVisible(this.shieldActive && this.energy >= this.stats.maxEnergy * 0.1);
    if (this.shieldRing.visible) this.shieldRing.setAlpha(0.5 + Math.sin(this.arena.time.now / 120) * 0.3);

    this.updatePose();
  }

  private updateRegen(dt: number) {
    if (this.stats.regenEvery <= 0) return;
    if (this.hp >= this.stats.maxHp) { this.regenTimer = 0; return; }
    this.regenTimer += dt;
    if (this.regenTimer >= this.stats.regenEvery) {
      this.regenTimer = 0;
      this.hp = Math.min(this.stats.maxHp, this.hp + 1);
      Sfx.play('heal');
      this.arena.floatText(this.x, this.y - 26, '+1', '#ff7a8a');
    }
  }

  private onPlatform() {
    return this.body.bottom < this.arena.floorY - 2;
  }

  private doJump(mult: number) {
    this.setVelocityY(-JUMP_V * mult);
    this.coyote = 0;
    this.jumpBuffer = 0;
    Sfx.play('jump');
  }

  // ------------------------------------------------------------------ ataque
  private startAttack(dir: AttackDir) {
    const w = this.stats.weapon;
    this.attackDir = dir;
    this.attackCd = this.stats.attackCooldown;
    this.attackActive = 0.11;
    this.attackPose = Math.min(0.2, this.stats.attackCooldown * 0.8);
    this.hitSet.clear();
    Sfx.play('swing');

    if (w.comboShock) {
      this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
      this.comboTimer = 0.55;
    }

    this.weaponFx?.destroy();
    const fx = this.arena.add.sprite(this.x, this.y, w.fx).setDepth(DEPTH.hero + 2);
    if (w.fx === 'slash') fx.setOrigin(0.2, 0.5);
    else if (w.fx === 'scytheArc') fx.setOrigin(10 / 52, 0.5);
    else if (w.fx === 'thrust') fx.setOrigin(0, 0.5);
    else fx.setOrigin(0.15, 0.5);
    fx.play(`fx-${w.fx}`);
    fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => { fx.destroy(); if (this.weaponFx === fx) this.weaponFx = null; });
    this.weaponFx = fx;
    this.updateWeaponFx();
  }

  private updateWeaponFx() {
    const fx = this.weaponFx;
    if (!fx || !fx.active) return;
    const cy = this.body.center.y - 2;
    if (this.attackDir === 'fwd') {
      fx.setPosition(this.x + this.facing * 4, cy).setAngle(0).setScale(this.facing * this.stats.reach, 1);
    } else if (this.attackDir === 'up') {
      fx.setPosition(this.x, cy - 6).setScale(this.stats.reach, this.facing).setAngle(-90);
    } else {
      fx.setPosition(this.x, cy + 6).setScale(this.stats.reach, this.facing).setAngle(90);
    }
  }

  private hitbox(): Phaser.Geom.Rectangle {
    const base = this.stats.weapon;
    const w = { ...base, reach: base.reach * this.stats.reach };
    const cx = this.x, cy = this.body.center.y;
    if (this.attackDir === 'up') return new Phaser.Geom.Rectangle(cx - w.height / 2, cy - 10 - w.reach, w.height, w.reach + 4);
    if (this.attackDir === 'down') return new Phaser.Geom.Rectangle(cx - w.height / 2, cy + 4, w.height, w.reach);
    if (w.backHit) {
      const back = w.reach * 0.55;
      return this.facing > 0
        ? new Phaser.Geom.Rectangle(cx - back, cy - w.height / 2 - 2, w.reach + back, w.height)
        : new Phaser.Geom.Rectangle(cx - w.reach, cy - w.height / 2 - 2, w.reach + back, w.height);
    }
    return this.facing > 0
      ? new Phaser.Geom.Rectangle(cx + 2, cy - w.height / 2 - 2, w.reach, w.height)
      : new Phaser.Geom.Rectangle(cx - 2 - w.reach, cy - w.height / 2 - 2, w.reach, w.height);
  }

  /** Dano final de um golpe contra um alvo */
  rollDamage(base: number, target?: Enemy) {
    let dmg = base * this.stats.damageMult;
    if (this.stats.lastStand > 0 && this.hp === 1) dmg *= 1 + this.stats.lastStand;
    if (target && target.weakTime > 0) dmg *= 1.15;
    const crit = Math.random() < this.stats.crit;
    if (crit) dmg *= 2;
    return { dmg: Math.max(1, Math.round(dmg)), crit };
  }

  private checkAttackHits() {
    if (this.attackActive <= 0) return;
    const box = this.hitbox();
    const w = this.stats.weapon;
    let landed = false;

    for (const e of this.arena.allTargets()) {
      if (this.hitSet.has(e) || e.dead || !e.hittable) continue;
      if (!Phaser.Geom.Rectangle.Overlaps(box, e.hurtRect())) continue;
      this.hitSet.add(e);
      const base = this.attackDir === 'down' ? this.stats.damage * (1 + this.stats.pogoBonus) : this.stats.damage;
      const { dmg, crit } = this.rollDamage(base, e);
      if (crit && this.stats.critEnergy > 0) this.gainEnergy(this.stats.critEnergy);
      const dirX = this.attackDir === 'fwd' ? (e.x >= this.x ? 1 : -1) : Math.sign(e.x - this.x) || this.facing;
      const res = e.takeHit({ damage: dmg, dirX, knockback: w.knockback, crit, source: 'melee', attackDir: this.attackDir, fromX: this.x });
      if (res !== 'immune') {
        landed = true;
        if (res === 'hit') this.gainEnergy(this.stats.energyPerHit);
        this.arena.fx('spark', (e.x + this.x) / 2 + dirX * 8, Math.min(box.bottom, Math.max(box.top, e.body!.center.y)));
        Sfx.play(res === 'blocked' ? 'clang' : crit ? 'crit' : 'hit');
        if (res === 'blocked') this.applyRecoil(-dirX, 160);
      }
    }

    // Golpes também quebram projéteis frágeis
    for (const s of this.arena.shotList()) {
      if (!s.breakable || this.hitSet.has(s)) continue;
      if (Phaser.Geom.Rectangle.Overlaps(box, s.getBounds())) {
        this.hitSet.add(s);
        this.arena.fx('spark', s.x, s.y);
        Sfx.play('clang');
        s.destroy();
        landed = true;
      }
    }

    if (landed) {
      this.arena.hitStop(45);
      if (this.attackDir === 'down') {
        this.setVelocityY(-300);
        this.jumpsUsed = 0;
        this.airDashed = false;
      } else if (this.attackDir === 'fwd' && this.grounded && !w.backHit) {
        this.applyRecoil(-this.facing, 70);
      }
      if (w.comboShock && this.combo >= 3) {
        this.combo = 0;
        this.shockwave();
      }
    }
  }

  private shockwave() {
    const cx = this.x + this.facing * 20, cy = this.body.center.y;
    this.arena.ring(cx, cy, 44, 0xffd75e, 220);
    this.arena.shake(0.006, 120);
    for (const e of this.arena.allTargets()) {
      if (e.dead || !e.hittable) continue;
      if (Phaser.Math.Distance.Between(cx, cy, e.x, e.body!.center.y) > 50) continue;
      const { dmg, crit } = this.rollDamage(this.stats.damage * 1.5, e);
      e.takeHit({ damage: dmg, dirX: Math.sign(e.x - this.x) || this.facing, knockback: 260, crit, source: 'shock', attackDir: 'fwd', fromX: this.x });
    }
    this.gainEnergy(this.stats.energyPerHit);
  }

  private applyRecoil(dir: number, force: number) {
    this.setVelocityX(dir * force);
    this.knockback = 0.08;
  }

  gainEnergy(n: number) {
    this.energy = Math.min(this.stats.maxEnergy, this.energy + n);
  }

  // ------------------------------------------------------------------ habilidades
  private useAbility(ab: AbilityId | undefined) {
    if (!ab || this.healing) return;
    if (ab === 'dash') this.dash();
    else if (ab === 'scream') this.scream();
    else if (ab === 'spectral') this.spectral();
    else if (ab === 'judgment') this.judgment();
  }

  private spend(cost: number) {
    if (this.energy < cost - 1e-6) {
      Sfx.play('error');
      this.arena.floatText(this.x, this.y - 30, 'SEM ENERGIA', '#8a7cc8');
      return false;
    }
    this.energy -= cost;
    return true;
  }

  /** Lâmina Espectral: corte de luz que atravessa inimigos */
  private spectral() {
    if (this.abilityCd > 0 || !this.spend(this.stats.spellCost * 0.5)) return;
    this.abilityCd = 0.35;
    this.attackPose = 0.15;
    this.attackDir = 'fwd';
    const click = this.arena.controls.click;
    if (click) this.facing = click.x >= this.x ? 1 : -1;
    const dmg = Math.round(this.stats.damage * this.stats.damageMult * 1.5);
    const s = this.arena.add.image(this.x + this.facing * 12, this.body.center.y - 2, 'spectral').setDepth(DEPTH.hero + 2).setFlipX(this.facing < 0);
    this.bolts.push({ sprite: s, vx: this.facing * 380, vy: 0, life: 0.9, damage: dmg, hit: new Set() });
    Sfx.play('magic');
  }

  /** Juízo Final: 8 lanças de luz em círculo */
  private judgment() {
    if (this.abilityCd > 0 || !this.spend(this.stats.spellCost * 2)) return;
    this.abilityCd = 1;
    this.screamPose = 0.4;
    this.invuln = Math.max(this.invuln, 0.4);
    const cx = this.x, cy = this.body.center.y;
    const dmg = Math.round(22 * this.stats.damageMult + this.stats.damage);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const s = this.arena.add.image(cx, cy, 'lance').setDepth(DEPTH.hero + 2).setRotation(a - Math.PI / 2);
      this.bolts.push({ sprite: s, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, life: 0.8, damage: dmg, hit: new Set() });
    }
    this.arena.ring(cx, cy, 70, 0xffd75e, 300);
    this.arena.flash(0xffd75e, 0.25);
    this.arena.shake(0.01, 200);
    Sfx.play('boom');
    Sfx.play('sparkle');
  }

  private updateBolts(dt: number) {
    for (const b of this.bolts) {
      b.life -= dt;
      b.sprite.x += b.vx * dt;
      b.sprite.y += b.vy * dt;
      const r = b.sprite.getBounds();
      for (const e of this.arena.allTargets()) {
        if (e.dead || !e.hittable || b.hit.has(e)) continue;
        if (!Phaser.Geom.Rectangle.Overlaps(r, e.hurtRect())) continue;
        b.hit.add(e);
        const { dmg, crit } = this.rollDamage(b.damage / this.stats.damageMult, e);
        e.takeHit({ damage: dmg, dirX: Math.sign(b.vx) || 1, knockback: 120, crit, source: 'shock', attackDir: 'fwd', fromX: b.sprite.x - b.vx });
        this.arena.fx('spark', e.x, e.cy, { tint: 0x8ef0ff });
        Sfx.play('hit');
      }
      if (b.life <= 0) b.sprite.destroy();
      else if (b.life < 0.15) b.sprite.setAlpha(b.life / 0.15);
    }
    this.bolts = this.bolts.filter((b) => b.life > 0);
  }

  /** Cura direta (corações, ondas) */
  healBy(n: number, color = '#ff7a8a') {
    if (this.dead || this.hp >= this.stats.maxHp) return false;
    this.hp = Math.min(this.stats.maxHp, this.hp + n);
    Sfx.play('heal');
    this.arena.floatText(this.x, this.y - 26, `+${n}`, color);
    return true;
  }

  private dash() {
    if (this.dashCd > 0 || this.healing || (!this.grounded && this.airDashed)) return;
    let dir = this.facing;
    const c = this.arena.controls;
    if (c.down('left')) dir = -1;
    if (c.down('right')) dir = 1;
    this.facing = dir;
    this.dashDir = dir;
    this.dashTime = DASH_TIME;
    this.dashCd = this.stats.dashCooldown;
    this.invuln = Math.max(this.invuln, DASH_TIME + 0.06);
    if (!this.grounded) this.airDashed = true;
    this.knockback = 0;
    Sfx.play('dash');
  }

  private scream() {
    if (this.screamCd > 0) return;
    const cost = this.stats.spellCost;
    if (this.energy < cost - 1e-6) {
      Sfx.play('error');
      this.arena.floatText(this.x, this.y - 30, 'SEM ENERGIA', '#8a7cc8');
      return;
    }
    this.energy -= cost;
    this.screamCd = 0.8;
    this.screamPose = 0.35;
    this.invuln = Math.max(this.invuln, 0.3);
    Sfx.play('scream');
    const cx = this.x, cy = this.body.center.y;
    this.arena.ring(cx, cy, SCREAM_RADIUS, 0x8ef0ff, 350);
    this.arena.ring(cx, cy, SCREAM_RADIUS * 0.7, 0xffffff, 280);
    this.arena.shake(0.01, 250);
    for (const e of this.arena.allTargets()) {
      if (e.dead) continue;
      const d = Phaser.Math.Distance.Between(cx, cy, e.x, e.body!.center.y);
      if (d > SCREAM_RADIUS) continue;
      e.scream(Math.sign(e.x - cx) || 1, 6);
    }
    for (const s of this.arena.shotList()) {
      if (Phaser.Math.Distance.Between(cx, cy, s.x, s.y) <= SCREAM_RADIUS) {
        this.arena.fx('spark', s.x, s.y);
        s.destroy();
      }
    }
  }

  // ------------------------------------------------------------------ dano recebido
  /** Retorna true se o golpe foi absorvido (dano ou bloqueio) */
  hurt(damage: number, fromX: number, kind: 'contact' | 'projectile' | 'hazard'): 'hit' | 'blocked' | 'ignored' {
    if (this.dead || this.invuln > 0 || this.dashing) return 'ignored';

    if (kind === 'projectile' && this.shieldActive) {
      const cost = this.stats.maxEnergy * 0.1;
      if (this.energy >= cost) {
        this.energy -= cost;
        Sfx.play('block');
        this.arena.ring(this.x, this.body.center.y, 22, 0x8ef0ff, 180);
        return 'blocked';
      }
    }

    if (Math.random() < this.stats.dodge) {
      this.invuln = 0.5;
      Sfx.play('dodge');
      this.arena.floatText(this.x, this.y - 30, 'ANULADO!', '#8ef0ff');
      return 'blocked';
    }

    this.hp -= damage;
    this.healing = false;
    this.healProgress = 0;
    this.invuln = 1.1 * this.stats.invulnMult;
    if (this.hp <= 0 && this.stats.cheatDeath && !this.cheatUsed) {
      // Lágrima do Serafim: sobrevive ao golpe fatal
      this.cheatUsed = true;
      this.hp = 1;
      this.invuln = 2;
      Sfx.play('sparkle');
      this.arena.floatText(this.x, this.y - 34, 'LÁGRIMA DO SERAFIM!', '#8ef0ff');
      this.arena.flash(0x8ef0ff, 0.5);
    }
    this.knockback = 0.2;
    this.dashTime = 0;
    this.body.setAllowGravity(true);
    const dir = Math.sign(this.x - fromX) || -this.facing;
    this.setVelocity(dir * 170, -170);
    Sfx.play('hurt');
    this.arena.hitStop(110);
    this.arena.shake(0.012, 180);
    this.arena.flash(0xe83b3b, 0.25);

    if (this.stats.thorns > 0) {
      this.arena.ring(this.x, this.body.center.y, 70, 0xe83b3b, 250);
      for (const e of this.arena.allTargets()) {
        if (e.dead || !e.hittable) continue;
        if (Phaser.Math.Distance.Between(this.x, this.body.center.y, e.x, e.body!.center.y) < 70)
          e.takeHit({ damage: this.stats.thorns, dirX: Math.sign(e.x - this.x) || 1, knockback: 150, crit: false, source: 'thorns', attackDir: 'fwd', fromX: this.x });
      }
    }

    if (this.hp <= 0) this.die();
    return 'hit';
  }

  private die() {
    this.hp = 0;
    this.dead = true;
    this.setVelocity(0, -120);
    this.weaponFx?.destroy();
    this.stop();
    this.setFrame(HERO_FRAMES.dead);
    this.setAlpha(1);
    this.arena.onHeroDeath();
  }

  onKill() {
    this.kills++;
    if (this.stats.killEnergy > 0) this.gainEnergy(this.stats.killEnergy);
    if (this.stats.killHeal > 0 && this.kills % this.stats.killHeal === 0 && this.hp < this.stats.maxHp) {
      this.hp++;
      Sfx.play('heal');
      this.arena.floatText(this.x, this.y - 26, '+1', '#ff7a8a');
    }
  }

  // ------------------------------------------------------------------ visual
  private spawnGhost() {
    const g = this.arena.add.image(this.x, this.y, this.skin, this.frame.name)
      .setFlipX(this.flipX).setTint(0x8ef0ff).setAlpha(0.6).setDepth(DEPTH.hero - 1);
    this.arena.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
  }

  private pose(frame: number) {
    if (this.anims.isPlaying) this.stop();
    if (this.frame.name !== String(frame)) this.setFrame(frame);
  }

  private loop(key: string) {
    if (this.anims.currentAnim?.key !== key || !this.anims.isPlaying) this.play(key);
  }

  private updatePose() {
    this.setFlipX(this.facing < 0);
    // piscar durante invulnerabilidade por dano
    if (this.invuln > 0 && this.knockback <= 0 && !this.dashing && this.screamPose <= 0) {
      this.setAlpha(Math.floor(this.invuln * 16) % 2 === 0 ? 0.35 : 1);
    } else this.setAlpha(1);

    if (this.knockback > 0.1 && this.invuln > 0.5) return this.pose(HERO_FRAMES.hurt);
    if (this.dashing) return this.pose(HERO_FRAMES.dash);
    if (this.screamPose > 0) return this.pose(HERO_FRAMES.scream);
    if (this.healing) return this.pose(HERO_FRAMES.heal);
    if (this.attackPose > 0) {
      if (this.attackDir === 'up') return this.pose(HERO_FRAMES.attackUp);
      if (this.attackDir === 'down') return this.pose(HERO_FRAMES.attackDown);
      return this.pose(HERO_FRAMES.strike);
    }
    if (!this.grounded) return this.pose(this.body.velocity.y < 0 ? HERO_FRAMES.jump : HERO_FRAMES.fall);
    if (Math.abs(this.body.velocity.x) > 5) return this.loop(`${this.skin}-run`);
    this.loop(`${this.skin}-idle`);
  }

  destroy(fromScene?: boolean) {
    this.bolts.forEach((b) => b.sprite.destroy());
    this.bolts = [];
    this.weaponFx?.destroy();
    this.shieldRing?.destroy();
    super.destroy(fromScene);
  }
}
