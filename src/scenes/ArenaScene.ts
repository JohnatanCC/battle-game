import Phaser from 'phaser';
import { GAME_W, GAME_H, FLOOR_Y, DEPTH } from '../config';
import { Hero } from '../entities/Hero';
import { Enemy } from '../entities/Enemy';
import { createEnemy, FLYING } from '../entities/enemies';
import { createBoss, Boss } from '../entities/bosses';
import { Shot, type ShotOpts } from '../entities/Shot';
import { Hazard, type HazardOpts } from '../entities/Hazard';
import type { ArenaApi } from '../entities/api';
import { Controls } from '../systems/Controls';
import { computeStats, type Stats } from '../state/Stats';
import { Save } from '../state/Save';
import { LEVEL_BY_ID, WORLDS, BOSS_NAMES, BOSS_DIALOGUE } from '../data/worlds';
import { DialogueBox } from '../ui/Dialogue';
import { Tutorial } from './Tutorial';
import type { EnemyType, LevelDef, WorldDef } from '../data/types';
import { Hud } from '../ui/Hud';
import { txt, panel, Menu, dim, fadeIn, goTo } from '../ui/ui';
import { setBackdrop } from '../ui/backdrop';
import { Sfx } from '../audio/Sfx';
import { Music } from '../audio/Music';
import { AMULET_BY_ID, COLOR_FRAME } from '../data/amulets';

type Phase = 'intro' | 'tutorial' | 'between' | 'fight' | 'boss' | 'cleared' | 'dead';

export class ArenaScene extends Phaser.Scene implements ArenaApi {
  hero!: Hero;
  stats!: Stats;
  controls!: Controls;
  floorY = FLOOR_Y;
  world = 1;
  frozen = false;
  /** Durante diálogos: herói e inimigos ficam parados */
  cutscene = false;
  dialogue: DialogueBox | null = null;
  tutorial: Tutorial | null = null;
  subtitle: Phaser.GameObjects.GameObject[] = [];
  bossSpoke = false;
  confirmClose: (() => void) | null = null;

  level!: LevelDef;
  worldDef!: WorldDef;
  enemies!: Phaser.GameObjects.Group;
  shots!: Phaser.Physics.Arcade.Group;
  floor!: Phaser.GameObjects.Zone;
  platforms!: Phaser.Physics.Arcade.StaticGroup;
  hazards: Hazard[] = [];
  boss: Boss | null = null;
  hud!: Hud;

  phase: Phase = 'intro';
  phaseTime = 0;
  waveIndex = -1;
  pending = 0;
  runShards = 0;
  shardObjs: Phaser.Physics.Arcade.Group | null = null;
  amuletPickup: Phaser.GameObjects.Image | null = null;
  hitStopTime = 0;
  paused = false;
  pauseUi: Phaser.GameObjects.GameObject[] = [];
  pauseMenu: Menu | null = null;
  deathMenu: Menu | null = null;
  firstClear = false;

  constructor() { super('Arena'); }

  init(data: { levelId: string }) {
    this.level = LEVEL_BY_ID[data.levelId] ?? LEVEL_BY_ID['1-1'];
    this.worldDef = WORLDS[this.level.world - 1];
    this.world = this.level.world;
    this.hazards = [];
    this.boss = null;
    this.phase = 'intro';
    this.phaseTime = 2.2;
    this.waveIndex = -1;
    this.pending = 0;
    this.runShards = 0;
    this.hitStopTime = 0;
    this.paused = false;
    this.frozen = false;
    this.amuletPickup = null;
    this.pauseMenu = null;
    this.deathMenu = null;
    this.firstClear = !Save.isCleared(this.level.id);
    this.cutscene = false;
    this.dialogue = null;
    this.tutorial = null;
    this.subtitle = [];
    this.bossSpoke = false;
  }

  create() {
    fadeIn(this);
    setBackdrop(this, this.worldDef.bg);
    this.stats = computeStats();
    this.controls = new Controls(this);
    this.controls.swallow();
    this.physics.world.setBounds(0, -400, GAME_W, GAME_H + 400);
    this.physics.world.resume();
    this.anims.resumeAll();

    this.buildStage();

    this.hero = new Hero(this, 80, FLOOR_Y - 20, this.stats, Save.heroTexture());
    this.enemies = this.add.group();
    this.shots = this.physics.add.group({ allowGravity: false });
    this.shardObjs = this.physics.add.group();

    // colisões
    this.physics.add.collider(this.hero, this.floor);
    this.physics.add.collider(this.hero, this.platforms, undefined, () => this.hero.dropTimer <= 0 && this.hero.body.velocity.y >= 0, this);
    this.physics.add.collider(this.enemies, this.floor, undefined, (e) => !(e as unknown as Enemy).flying, this);
    this.physics.add.collider(this.enemies, this.platforms, undefined, (e) => !(e as unknown as Enemy).flying && (e as unknown as Enemy).body.velocity.y >= 0, this);
    this.physics.add.collider(this.shardObjs, this.floor);
    this.physics.add.overlap(this.hero, this.enemies, (_h, e) => {
      const en = e as unknown as Enemy;
      if (en.hittable && en.contactDamage > 0 && en.stun <= 0) this.hero.hurt(en.contactDamage, en.x, 'contact');
    });
    this.physics.add.overlap(this.hero, this.shots, (_h, s) => {
      const shot = s as Shot;
      if (!shot.armed) return;
      const r = this.hero.hurt(shot.damage, shot.x, 'projectile');
      if (r !== 'ignored') { this.fx('spark', shot.x, shot.y); shot.destroy(); }
    });
    this.physics.add.overlap(this.hero, this.shardObjs, (_h, s) => this.collectShard(s as Phaser.Physics.Arcade.Sprite));

    const label = this.level.tutorial ? `Prólogo  ${this.level.name}` : `${this.level.id}  ${this.level.name}`;
    this.hud = new Hud(this, this.hero, label);
    this.hud.setShards(0);

    Music.play(this.level.boss ? this.worldDef.bossMusic : this.worldDef.music);
    if (this.level.tutorial) this.banner('PRÓLOGO', 'Despertar', '#ffd75e');
    else this.banner(this.level.boss ? BOSS_NAMES[this.level.boss].name : this.level.name,
      this.level.boss ? BOSS_NAMES[this.level.boss].title : `${this.worldDef.name}  -  ${this.level.id}`,
      this.level.boss ? '#e83b3b' : '#ffd75e');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.hazards.forEach((h) => h.destroy());
      this.hazards = [];
    });
  }

  // ------------------------------------------------------------------ cenário
  private buildStage() {
    const w = this.worldDef;
    this.add.image(0, 0, w.bg).setOrigin(0).setDepth(DEPTH.bg);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x0b0814, 0.28).setOrigin(0).setDepth(DEPTH.bg + 1);

    // partículas ambientes
    const amb = w.ambient;
    this.add.particles(0, 0, amb.tex, {
      x: { min: 0, max: GAME_W },
      y: amb.dir === 'up' ? GAME_H : -10,
      lifespan: 9000,
      speedY: amb.dir === 'up' ? { min: -25, max: -8 } : { min: 10, max: 25 },
      speedX: { min: -8, max: 8 },
      alpha: { start: 0.7, end: 0 },
      rotate: amb.tex === 'pfeather' ? { min: 0, max: 360 } : 0,
      tint: amb.tint,
      frequency: 260,
      quantity: 1,
    }).setDepth(DEPTH.bgFx);

    // chão
    this.add.tileSprite(0, FLOOR_Y, GAME_W, 16, `${w.tiles}_0`).setOrigin(0).setDepth(DEPTH.platforms);
    this.add.tileSprite(0, FLOOR_Y + 16, GAME_W, GAME_H - FLOOR_Y - 16, `${w.tiles}_1`).setOrigin(0).setDepth(DEPTH.platforms);
    this.floor = this.add.zone(GAME_W / 2, FLOOR_Y + 40, GAME_W + 200, 80);
    this.physics.add.existing(this.floor, true);

    // plataformas atravessáveis por baixo
    this.platforms = this.physics.add.staticGroup();
    for (const p of this.level.platforms) {
      this.add.tileSprite(p.x, p.y, p.w, 6, `${w.tiles}_2`).setOrigin(0).setDepth(DEPTH.platforms);
      const z = this.add.zone(p.x + p.w / 2, p.y + 3, p.w, 6);
      this.physics.add.existing(z, true);
      const b = z.body as Phaser.Physics.Arcade.StaticBody;
      b.checkCollision.down = false;
      b.checkCollision.left = false;
      b.checkCollision.right = false;
      this.platforms.add(z);
    }
  }

  // ------------------------------------------------------------------ API para entidades
  /** Cópias das listas: seguro destruir itens enquanto se percorre */
  allTargets(): Enemy[] {
    const list = [...(this.enemies.getChildren() as unknown as Enemy[])];
    return this.boss && !this.boss.dead ? [...list, this.boss] : list;
  }

  shotList(): Shot[] { return [...(this.shots.getChildren() as Shot[])]; }

  spawnShot(o: ShotOpts) {
    const s = new Shot(this, o);
    this.shots.add(s);
    s.body.setAllowGravity(false);
    s.setVelocity(s.armed ? o.vx ?? 0 : 0, s.armed ? o.vy ?? 0 : 0);
    return s;
  }

  spawnHazard(o: HazardOpts) {
    const h = new Hazard(this, o);
    this.hazards.push(h);
    return h;
  }

  spawnEnemy(type: EnemyType, x: number, y: number, opts: { noPortal?: boolean; summoned?: boolean } = {}) {
    this.pending++;
    const make = () => {
      this.pending--;
      if (this.phase === 'dead' || this.phase === 'cleared') return;
      const e = createEnemy(this, type, x, y);
      e.summoned = !!opts.summoned;
      e.spawning = 0.5;
      e.setAlpha(0);
      this.enemies.add(e);
    };
    if (opts.noPortal) { make(); return; }
    const portal = this.add.sprite(x, y, 'portal').play('fx-portal').setDepth(DEPTH.enemies - 1).setScale(0.2);
    this.tweens.add({ targets: portal, scale: 1.3, duration: 250, ease: 'Back.Out' });
    Sfx.play('spawn');
    this.time.delayedCall(650, () => {
      make();
      this.tweens.add({ targets: portal, scale: 0, alpha: 0, duration: 300, onComplete: () => portal.destroy() });
    });
  }

  onEnemyKilled(e: Enemy) {
    this.hero.onKill();
    if (e.isBoss) { this.onBossDefeated(e as Boss); return; }
    const n = e.summoned ? 1 : Math.ceil(e.shards * this.stats.fragmentMult);
    for (let i = 0; i < n; i++) this.dropShard(e.x, e.cy);
    this.enemies.remove(e);
  }

  onHeroDeath() {
    this.phase = 'dead';
    Sfx.play('defeat');
    Music.stop(1200);
    this.cameras.main.flash(300, 232, 59, 59);
    this.time.timeScale = 1;
    Save.data.deaths++;
    const kept = Math.floor(this.runShards / 2);
    Save.data.fragments += kept;
    Save.persist();
    this.time.delayedCall(1400, () => this.showDeath(kept));
  }

  // ------------------------------------------------------------------ efeitos
  fx(key: string, x: number, y: number, opts: { tint?: number; scale?: number; depth?: number } = {}) {
    const s = this.add.sprite(x, y, key).setDepth(opts.depth ?? DEPTH.fx).setScale(opts.scale ?? 1);
    if (opts.tint !== undefined) s.setTint(opts.tint);
    s.play(`fx-${key}`);
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
  }

  ring(x: number, y: number, radius: number, color: number, ms: number) {
    const c = this.add.circle(x, y, radius).setStrokeStyle(2, color, 1).setDepth(DEPTH.fx).setScale(0.1);
    this.tweens.add({ targets: c, scale: 1, alpha: 0, duration: ms, ease: 'Cubic.Out', onComplete: () => c.destroy() });
  }

  burst(x: number, y: number, tex: string, tint: number, n: number, speed = 80) {
    for (let i = 0; i < n; i++) {
      const p = this.add.image(x, y, tex).setTint(tint).setDepth(DEPTH.fx);
      const a = Math.random() * Math.PI * 2, d = speed * (0.4 + Math.random() * 0.6);
      this.tweens.add({
        targets: p, x: x + Math.cos(a) * d * 0.4, y: y + Math.sin(a) * d * 0.4 + 6, alpha: 0, angle: Phaser.Math.Between(-180, 180),
        duration: 400 + Math.random() * 300, onComplete: () => p.destroy(),
      });
    }
  }

  healParticle(x: number, y: number) {
    const p = this.add.image(x + Phaser.Math.Between(-10, 10), y + 10, 'px').setTint(0x8ef0ff).setDepth(DEPTH.fx);
    this.tweens.add({ targets: p, y: y - 20, alpha: 0, duration: 600, onComplete: () => p.destroy() });
  }

  floatText(x: number, y: number, s: string, color = '#f4f0ff') {
    const t = txt(this, x, y, s, { color, origin: [0.5, 1] }).setDepth(DEPTH.fx + 5);
    this.tweens.add({ targets: t, y: y - 14, alpha: 0, duration: 650, ease: 'Cubic.Out', onComplete: () => t.destroy() });
  }

  shake(intensity: number, ms: number) {
    if (Save.settings.shake) this.cameras.main.shake(ms, intensity);
  }

  flash(color: number, alpha: number) {
    const r = this.add.rectangle(0, 0, GAME_W, GAME_H, color, alpha).setOrigin(0).setDepth(DEPTH.overlay - 1);
    this.tweens.add({ targets: r, alpha: 0, duration: 260, onComplete: () => r.destroy() });
  }

  hitStop(ms: number) {
    this.hitStopTime = Math.max(this.hitStopTime, ms / 1000);
  }

  banner(title: string, sub?: string, color = '#ffd75e') {
    const y = 110;
    const bar = this.add.rectangle(0, y - 10, GAME_W, sub ? 48 : 34, 0x0b0814, 0.75).setOrigin(0).setDepth(DEPTH.overlay);
    const t = txt(this, GAME_W / 2, y, title, { size: 16, color, origin: [0.5, 0] }).setDepth(DEPTH.overlay + 1);
    const s = sub ? txt(this, GAME_W / 2, y + 22, sub, { color: '#b8b0cc', origin: [0.5, 0] }).setDepth(DEPTH.overlay + 1) : null;
    const items = [bar, t, ...(s ? [s] : [])];
    items.forEach((o) => o.setAlpha(0));
    this.tweens.add({ targets: items, alpha: 1, duration: 250 });
    this.tweens.add({ targets: items, alpha: 0, delay: 1900, duration: 400, onComplete: () => items.forEach((o) => o.destroy()) });
  }

  // ------------------------------------------------------------------ fragmentos
  private dropShard(x: number, y: number) {
    const s = this.physics.add.sprite(x, y, 'shard').play('shard-spin');
    this.shardObjs!.add(s);
    s.setDepth(DEPTH.fx - 1);
    s.setVelocity(Phaser.Math.Between(-80, 80), Phaser.Math.Between(-200, -100));
    s.setBounce(0.4);
    s.setDrag(60, 0);
    s.setData('age', 0);
    s.setCollideWorldBounds(true);
  }

  private collectShard(s: Phaser.Physics.Arcade.Sprite) {
    if ((s.getData('age') ?? 0) < 0.3 || this.hero.dead) return;
    s.destroy();
    this.runShards++;
    this.hud.setShards(this.runShards);
    Sfx.play('shard');
  }

  private updateShards(dt: number) {
    for (const o of this.shardObjs!.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
      const age = (o.getData('age') ?? 0) + dt;
      o.setData('age', age);
      if (age > 0.6 && !this.hero.dead) {
        // atraídos pelo herói
        const b = o.body as Phaser.Physics.Arcade.Body;
        b.setAllowGravity(false);
        this.physics.moveTo(o, this.hero.x, this.hero.centerY, 260 + age * 120);
      }
    }
  }

  // ------------------------------------------------------------------ fluxo de ondas
  aliveCount() {
    return (this.enemies.getChildren() as unknown as Enemy[]).filter((e) => !e.dead && !e.summoned).length;
  }

  startWave(i: number) {
    const waves = this.level.waves!;
    this.waveIndex = i;
    this.phase = 'fight';
    this.hud.setWave(this.level.tutorial ? 'HORDA' : `ONDA ${i + 1}/${waves.length}`);
    Sfx.play('wave');
    waves[i].forEach((type, k) => {
      this.time.delayedCall(k * 380, () => {
        if (this.phase === 'dead') return;
        const [x, y] = this.spawnPoint(type);
        this.spawnEnemy(type, x, y);
      });
    });
    this.pending += waves[i].length; // reserva até os timers dispararem
    this.time.delayedCall(waves[i].length * 380 + 10, () => { this.pending -= waves[i].length; });
  }

  private spawnPoint(type: EnemyType): [number, number] {
    const flying = FLYING.includes(type);
    for (let tries = 0; tries < 20; tries++) {
      const x = Phaser.Math.Between(40, GAME_W - 40);
      if (Math.abs(x - this.hero.x) < 150) continue;
      return [x, flying ? Phaser.Math.Between(100, 190) : FLOOR_Y - 16];
    }
    const x = this.hero.x < GAME_W / 2 ? GAME_W - 60 : 60;
    return [x, flying ? 140 : FLOOR_Y - 16];
  }

  private startBoss() {
    this.phase = 'boss';
    this.boss = createBoss(this, this.level.boss!);
    this.physics.add.overlap(this.hero, this.boss, () => {
      const b = this.boss;
      if (b && b.hittable && !b.vulnerable && b.stun <= 0) this.hero.hurt(b.contactDamage, b.x, 'contact');
    });
    this.hud.setWave('');
  }

  /** Chamado quando o chefe termina de entrar: ele fala antes da luta */
  onBossReady() {
    const b = this.boss;
    if (!b || this.bossSpoke) return;
    this.bossSpoke = true;
    const lines = BOSS_DIALOGUE[b.bossKey]?.intro ?? [];
    const start = () => {
      this.cutscene = false;
      this.dialogue = null;
      this.controls.swallow();
      Sfx.play('bossRoar');
      this.shake(0.015, 600);
    };
    if (!lines.length) { start(); return; }
    this.cutscene = true;
    this.hero.setVelocityX(0);
    Music.duck(true);
    const color = b.bossKey === 'seraph' ? '#ffd75e' : b.bossKey === 'boneking' ? '#c060ff' : '#e83b3b';
    this.dialogue = new DialogueBox(this, BOSS_NAMES[b.bossKey].name, color, lines, () => {
      Music.duck(false);
      start();
    });
  }

  /** Fala curta do chefe durante a luta (não pausa o jogo) */
  bossSay(text: string) {
    this.subtitle.forEach((o) => o.destroy());
    const y = GAME_H - 56;
    const t = txt(this, GAME_W / 2, y, text, { origin: [0.5, 0], color: '#ffd75e', align: 'center' }).setDepth(DEPTH.overlay);
    const bg = this.add.rectangle(GAME_W / 2, y + t.height / 2, t.width + 16, t.height + 8, 0x0b0814, 0.75).setDepth(DEPTH.overlay - 1);
    this.subtitle = [bg, t];
    this.tweens.add({ targets: this.subtitle, alpha: 0, delay: 3200, duration: 500, onComplete: () => { bg.destroy(); t.destroy(); } });
  }

  private onBossDefeated(b: Boss) {
    const line = BOSS_DIALOGUE[b.bossKey]?.defeat;
    if (line) this.bossSay(line);
    this.phase = 'cleared';
    for (const e of this.allTargets()) if (!e.dead && !e.isBoss) e.die();
    this.clearThreats();
    this.hero.invuln = 99;
    Music.stop(800);
    this.shake(0.02, 1500);
    this.time.delayedCall(1700, () => {
      Sfx.play('victory');
      if (b.bossKey === 'falseangel') {
        this.banner('O TRONO É TEU', 'O falso anjo foi derrubado', '#ffd75e');
        this.time.delayedCall(3200, () => this.finishLevel());
      } else {
        this.banner('CHEFE DERROTADO', BOSS_NAMES[b.bossKey].name, '#ffd75e');
        this.time.delayedCall(2400, () => this.finishLevel());
      }
    });
  }

  private clearThreats() {
    for (const s of this.shotList()) s.destroy();
    this.hazards.forEach((h) => h.destroy());
    this.hazards = [];
  }

  private onCleared() {
    this.phase = 'cleared';
    this.hud.setWave('');
    this.clearThreats();
    Sfx.play('victory');
    Music.duck(true);
    if (this.level.tutorial) this.banner('DESPERTAR CONCLUÍDO', 'Tua ascensão começa agora', '#8ef0ff');
    else this.banner('ARENA PURIFICADA', this.firstClear && this.level.amulet ? 'Recolha o fragmento do teu poder' : undefined, '#8ef0ff');
    if (this.firstClear && this.level.amulet) {
      const a = AMULET_BY_ID[this.level.amulet];
      const img = this.physics.add.image(GAME_W / 2, -20, 'amulet', COLOR_FRAME[a.color]).setDepth(DEPTH.fx);
      (img.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      img.setVelocityY(70);
      const glow = this.add.image(img.x, img.y, 'glow').setScale(2.5).setDepth(DEPTH.fx - 1).setTint(0xffd75e);
      this.tweens.add({ targets: glow, scale: 3.2, alpha: 0.5, duration: 600, yoyo: true, repeat: -1 });
      img.setData('glow', glow);
      this.amuletPickup = img;
    } else {
      this.time.delayedCall(2200, () => this.finishLevel());
    }
  }

  private updateAmulet() {
    const a = this.amuletPickup as Phaser.Physics.Arcade.Image | null;
    if (!a || !a.active) return;
    const glow = a.getData('glow') as Phaser.GameObjects.Image;
    if (a.y >= FLOOR_Y - 30) { a.setVelocityY(0); a.y = FLOOR_Y - 30 + Math.sin(this.time.now / 300) * 3; }
    glow.setPosition(a.x, a.y);
    if (Phaser.Math.Distance.Between(a.x, a.y, this.hero.x, this.hero.centerY) < 22) {
      Sfx.play('amulet');
      this.flash(0xffd75e, 0.5);
      glow.destroy();
      a.destroy();
      this.amuletPickup = null;
      this.time.delayedCall(600, () => this.finishLevel());
    }
  }

  private finishLevel() {
    if (this.phase === 'dead') return;
    if (this.level.tutorial) { this.completePrologue(this.runShards + this.level.fragments); return; }
    goTo(this, 'Reward', { levelId: this.level.id, shards: this.runShards, firstClear: this.firstClear }, 500);
  }

  private completePrologue(shards: number) {
    Save.data.tutorialDone = true;
    Save.data.fragments += shards;
    Save.persist();
    goTo(this, 'Map', {}, 700);
  }

  /** Chamado pelo Falso Anjo ao entrar na fase final */
  onFinalPhase() {
    Music.play('boss3_final', 400);
    this.cameras.main.setBackgroundColor('#000000');
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x3a0f5e, 0.35).setOrigin(0).setDepth(DEPTH.bg + 2);
  }

  // ------------------------------------------------------------------ pausa
  private togglePause() {
    if (this.phase === 'dead') return;
    this.paused = !this.paused;
    if (this.paused) {
      this.physics.world.pause();
      this.anims.pauseAll();
      this.tweens.pauseAll();
      this.time.paused = true;
      Music.duck(true);
      Sfx.play('back');
      this.openPauseMenu();
    } else {
      this.closePauseMenu();
      this.physics.world.resume();
      this.anims.resumeAll();
      this.tweens.resumeAll();
      this.time.paused = false;
      Music.duck(false);
      this.controls.swallow();
    }
  }

  private openPauseMenu() {
    const D = DEPTH.overlay + 10;
    const items: Phaser.GameObjects.GameObject[] = [];
    items.push(dim(this, 0.7, D));
    items.push(panel(this, GAME_W / 2 - 110, 90, 220, 170).setDepth(D + 1));
    items.push(txt(this, GAME_W / 2, 104, 'PAUSA', { size: 16, origin: [0.5, 0], color: '#ffd75e' }).setDepth(D + 2));
    const vol = (v: number) => '='.repeat(Math.round(v * 10)).padEnd(10, '-');
    this.pauseMenu = new Menu(this, GAME_W / 2 - 80, 136, [
      { label: 'Continuar', onSelect: () => this.togglePause() },
      { label: `Música  ${vol(Save.settings.music)}`, onSelect: () => this.cycleVolume('music') },
      { label: `Efeitos ${vol(Save.settings.sfx)}`, onSelect: () => this.cycleVolume('sfx') },
      { label: 'Reiniciar arena', onSelect: () => this.confirm('Reiniciar a arena?', () => { this.unpauseClean(); this.scene.restart({ levelId: this.level.id }); }) },
      this.level.tutorial
        ? { label: 'Pular tutorial', onSelect: () => this.confirm('Pular o prólogo?', () => { this.unpauseClean(); this.completePrologue(this.level.fragments); }) }
        : { label: 'Voltar ao mapa', onSelect: () => this.confirm('Abandonar a arena?', () => { this.unpauseClean(); goTo(this, 'Map'); }) },
    ], { depth: D + 2, spacing: 18 });
    this.pauseUi = items;
  }

  /** Pergunta de confirmação dentro da pausa */
  private confirm(question: string, yes: () => void) {
    const D = DEPTH.overlay + 20;
    const main = this.pauseMenu;
    main?.setVisible(false);
    const box = panel(this, GAME_W / 2 - 130, 140, 260, 84, { border: 0xe83b3b }).setDepth(D);
    const q = txt(this, GAME_W / 2, 152, question, { origin: [0.5, 0], color: '#ffd75e' }).setDepth(D + 1);
    const warn = txt(this, GAME_W / 2, 166, 'O progresso desta arena se perde.', { origin: [0.5, 0], color: '#8a7cc8' }).setDepth(D + 1);
    const close = () => { m.destroy(); box.destroy(); q.destroy(); warn.destroy(); this.pauseMenu = main; main?.setVisible(true); this.confirmClose = null; this.controls.swallow(); };
    this.confirmClose = close;
    const m: Menu = new Menu(this, GAME_W / 2 - 20, 186, [
      { label: 'Não', onSelect: () => close() },
      { label: 'Sim', onSelect: () => { close(); yes(); } },
    ], { depth: D + 1, spacing: 14 });
    this.pauseMenu = m;
    this.controls.swallow();
  }

  private cycleVolume(kind: 'music' | 'sfx') {
    const s = Save.settings;
    s[kind] = Math.round(((s[kind] + 0.1) % 1.05) * 10) / 10;
    if (kind === 'music') Music.setVolume(s.music); else Sfx.setVolume(s.sfx);
    Save.persistSettings();
    const vol = (v: number) => '='.repeat(Math.round(v * 10)).padEnd(10, '-');
    this.pauseMenu?.setLabel(kind === 'music' ? 1 : 2, kind === 'music' ? `Música  ${vol(s.music)}` : `Efeitos ${vol(s.sfx)}`);
  }

  private unpauseClean() {
    this.time.paused = false;
    this.tweens.resumeAll();
    this.anims.resumeAll();
    this.physics.world.resume();
    Music.duck(false);
  }

  private closePauseMenu() {
    this.pauseMenu?.destroy();
    this.pauseMenu = null;
    this.pauseUi.forEach((o) => o.destroy());
    this.pauseUi = [];
  }

  private showDeath(kept: number) {
    const D = DEPTH.overlay + 10;
    dim(this, 0.75, D);
    txt(this, GAME_W / 2, 100, 'VOCÊ CAIU', { size: 24, origin: [0.5, 0], color: '#e83b3b' }).setDepth(D + 1);
    txt(this, GAME_W / 2, 140, 'Mas a ascensão não termina aqui.', { origin: [0.5, 0], color: '#b8b0cc' }).setDepth(D + 1);
    txt(this, GAME_W / 2, 156, `Fragmentos preservados: ${kept}`, { origin: [0.5, 0], color: '#ffd75e' }).setDepth(D + 1);
    this.deathMenu = new Menu(this, GAME_W / 2 - 70, 196, [
      { label: 'Tentar novamente', onSelect: () => this.scene.restart({ levelId: this.level.id }) },
      { label: 'Montar build', onSelect: () => goTo(this, 'Build', { back: 'Arena', levelId: this.level.id }) },
      { label: 'Voltar ao mapa', onSelect: () => goTo(this, 'Map') },
    ], { depth: D + 2, spacing: 18 });
    this.controls.swallow();
  }

  // ------------------------------------------------------------------ loop
  update(_t: number, delta: number) {
    this.controls.update();
    const dt = Math.min(0.05, delta / 1000);

    if (this.deathMenu) { this.deathMenu.update(this.controls); return; }
    if (!this.paused && this.controls.pressed('pause') && this.phase !== 'dead') { this.togglePause(); return; }
    if (this.paused) {
      this.pauseMenu?.update(this.controls);
      if (this.controls.pressed('back') || this.controls.pressed('pause')) {
        if (this.confirmClose) this.confirmClose();
        else this.togglePause();
      }
      return;
    }

    // congelamento de impacto (hit-stop)
    if (this.hitStopTime > 0) {
      this.hitStopTime -= dt;
      if (!this.frozen) { this.frozen = true; this.physics.world.pause(); this.anims.pauseAll(); }
      if (this.hitStopTime > 0) return;
      this.frozen = false;
      this.physics.world.resume();
      this.anims.resumeAll();
    }

    if (this.dialogue) {
      this.dialogue.update(dt, this.controls);
      this.hero.setVelocityX(0);
      this.hud.update(this.boss && !this.boss.dead ? this.boss : null);
      return;
    }

    this.hero.tick(dt, this.controls);
    this.tutorial?.update(dt);
    for (const h of this.hazards) h.update(dt);
    this.hazards = this.hazards.filter((h) => !h.dead);
    this.updateShards(dt);
    this.updateAmulet();
    this.hud.update(this.boss && !this.boss.dead ? this.boss : null);

    this.phaseTime -= dt;
    switch (this.phase) {
      case 'intro':
        if (this.phaseTime <= 0) {
          if (this.level.boss) this.startBoss();
          else if (this.level.tutorial) { this.phase = 'tutorial'; this.hud.setWave('PRÓLOGO'); this.tutorial = new Tutorial(this); }
          else this.startWave(0);
        }
        break;
      case 'fight':
        if (this.pending <= 0 && this.aliveCount() === 0) {
          const waves = this.level.waves!;
          if (this.waveIndex + 1 < waves.length) { this.phase = 'between'; this.phaseTime = 1.4; }
          else this.onCleared();
        }
        break;
      case 'between':
        if (this.phaseTime <= 0) this.startWave(this.waveIndex + 1);
        break;
    }
  }
}
