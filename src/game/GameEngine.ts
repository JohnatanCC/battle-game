export let ZOOM = 0.65;
export let ROOM_WIDTH = 1900;
export let ROOM_HEIGHT = 1000;
export let FLOOR_Y = 900;

export function resizeGame(w: number, h: number) {
  const screenRatio = w / h;
  if (screenRatio > 1.8) {
      // Ultrawide: Zoom in to lock the maximum horizontal play area to match 16:9
      ZOOM = w / 2953;
  } else {
      ZOOM = 0.65;
  }
  ROOM_WIDTH = w / ZOOM;
  ROOM_HEIGHT = h / ZOOM;
  FLOOR_Y = ROOM_HEIGHT - 120;
}

const GRAVITY = 2200;
const JUMP_FORCE = -850;
const MOVE_SPEED = 400;
const ATTACK_DURATION = 0.15;
const ATTACK_COOLDOWN = 0.35;
const ATTACK_RANGE = 150;
const KNOCKBACK_FORCE_ENEMY = 600;
const KNOCKBACK_FORCE_PLAYER = 300;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function checkRectOverlap(r1: Rect, r2: Rect) {
  return (
    r1.x < r2.x + r2.width &&
    r1.x + r1.width > r2.x &&
    r1.y < r2.y + r2.height &&
    r1.y + r1.height > r2.y
  );
}

const hexToRgbCache: Record<string, number[]> = {};
function hexToRgb(hex: string): number[] {
    if (hexToRgbCache[hex]) return hexToRgbCache[hex];
    const match = hex.match(/.{2}/g);
    const res = match ? match.map(x => parseInt(x, 16)) : [0, 0, 0];
    hexToRgbCache[hex] = res;
    return res;
}

function lerpColor(c1: string, c2: string, t: number): string {
    const rgb1 = hexToRgb(c1.substring(1));
    const rgb2 = hexToRgb(c2.substring(1));
    const r = Math.round(rgb1[0] + (rgb2[0] - rgb1[0]) * t);
    const g = Math.round(rgb1[1] + (rgb2[1] - rgb1[1]) * t);
    const b = Math.round(rgb1[2] + (rgb2[2] - rgb1[2]) * t);
    return `rgb(${r},${g},${b})`;
}

export class GameEngine {
  audioBuffers: Record<string, AudioBuffer> = {};
  projectileLoopNode: any = null;
  projectileGainNode: GainNode | null = null;
  bossHitSoundCooldown: number = 0;
  
  sfxVolume: number = 0.7;

  async loadSounds() {
      // no-op, we'll load on the fly or just assume they are there
  }

  audioPools: Record<string, HTMLAudioElement[]> = {};
  
  playBuffer(name: string, loop: boolean = false, volume: number = 0.4): { source: any, gain: any } | null {
      if (this.sfxVolume <= 0) {
          return {
              source: { stop: () => {} },
              gain: null
          };
      }
      if (!this.audioPools[name]) {
          this.audioPools[name] = [];
      }
      
      let audio = this.audioPools[name].find(a => a.paused || a.ended);
      if (!audio) {
          audio = new Audio(`${name}.mp3`);
          this.audioPools[name].push(audio);
          
          if (this.audioPools[name].length > 5) {
              audio = this.audioPools[name].shift()!;
              this.audioPools[name].push(audio);
          }
      }

      audio.loop = loop;
      audio.volume = Math.max(0, Math.min(1, volume * this.sfxVolume));
      audio.currentTime = 0;
      audio.play().catch(e => {
          this.logDebug('Audio play err: ' + e);
      });
      return {
          source: { stop: () => { audio.pause(); audio.currentTime = 0; } },
          gain: null
      };
  }

  setSfxVolume(volume: number) {
      this.sfxVolume = Math.max(0, Math.min(1, volume));
      if (this.sfxGainNode && this.audioCtx) {
          try {
              this.sfxGainNode.gain.setValueAtTime(this.sfxVolume, this.audioCtx.currentTime);
          } catch {
              this.sfxGainNode.gain.value = this.sfxVolume;
          }
      }
      for (const pool of Object.values(this.audioPools)) {
          for (const audio of pool) {
              if (!audio.paused) {
                  audio.volume = Math.max(0, Math.min(1, 0.4 * this.sfxVolume));
              }
          }
      }
  }

  canvas: HTMLCanvasElement;
  character: 'knight' | 'witch' = 'knight';
  ctx: CanvasRenderingContext2D;
  lastTime: number = 0;
  animationId: number = 0;
  isPaused: boolean = false;
  bossSubtitleText: string = '';
  bossSubtitleTimer: number = 0;

  gameMode: 'devastated_path' | 'battle' | 'tutorial' = 'battle';
  mobs: Array<any> = [];
  hordeWave: number = 0;
  hordeTimer: number = 2.0;
  hordeMobsRemaining: number = 0;
  hordeState: 'waiting' | 'spawning' | 'cleared' = 'waiting';

  retroMode: boolean = false;
  offscreenCanvas?: HTMLCanvasElement;
  offscreenCtx?: CanvasRenderingContext2D;
  hitEffectTimer: number = 0;
  screenShakeTimer: number = 0;
  screenShakeIntensity: number = 0;
  lavaLevel: number = 0;
  lavaDelayTimer: number = 0;
  phase3TransitionTimer: number = 0;
  phase3LavaTimer: number = 30;
  phase3Active: boolean = false;
  platforms: Array<{x: number, y: number, width: number, height: number, targetY: number, currentY: number}> = [
      {x: 200, y: FLOOR_Y - 250, width: 250, height: 20, targetY: FLOOR_Y - 250, currentY: FLOOR_Y - 250},
      {x: 1450, y: FLOOR_Y - 250, width: 250, height: 20, targetY: FLOOR_Y - 250, currentY: FLOOR_Y - 250},
      {x: 825, y: FLOOR_Y - 450, width: 250, height: 20, targetY: FLOOR_Y - 450, currentY: FLOOR_Y - 450},
      {x: 2075, y: FLOOR_Y - 450, width: 250, height: 20, targetY: FLOOR_Y - 450, currentY: FLOOR_Y - 450}
  ];
  bossTeleportTimer: number = 0;

  keys = { left: false, right: false, up: false, down: false, attack: false, secondary: false, secondaryHeld: false };
  mouse = { clicked: false, isDown: false, x: 0, y: 0, rightClicked: false, rightDown: false };

  player: any = {
    x: 200, y: FLOOR_Y - 45, vx: 0, vy: 0,
    width: 60, height: 90,
    hp: 8, maxHp: 8,
    facingRight: true,
    isAttacking: false,
    attackTimer: 0,
    attackCooldownTimer: 0,
    invulnerableTimer: 0,
    knockbackTimer: 0,
    isGrounded: false,
    hasDoubleJumped: false,
    doubleJumpFlipTimer: 0,
    walkAnim: 0,
    attackAngle: 0,
    swordType: 'normal' as 'normal' | 'dream',
    comboCount: 0,
    comboTimer: 0,
    vitalCharges: 0,
    damageDealtTracker: 0,
    healingTimer: 0,
    buffTimer: 0,
    chargeCooldown: 0,
    witchShotsFired: 0, isDead: false,
    isDashing: false, dashDir: {x: 1, y: 0},
    dashTimer: 0,
    dashDuration: 0,
    intangibleTimer: 0,
    slowFallTimer: 0,
    boomerangTimer: 0,
    jumpBufferTimer: 0,
    coyoteTimer: 0,
    isShielding: false
  };

  enemy: any = {
    x: 1200, y: -800, vx: 0, vy: 0, // Starts high up
    
    width: 180, height: 260,
    hp: 750, maxHp: 750,
    shieldHp: 350, maxShieldHp: 350,
    facingRight: false,
    invulnerableTimer: 0,
    knockbackTimer: 0,
    state: 'intro',
    stateTimer: 10,
    attackStep: 0,
    animTime: 0,
    attackTargetX: 0,
    attackTargetY: 0,
    isGrounded: false,
    legShootTimer: 3,
    scale: 1,
    phase: 1,
    transitionTimer: 0,
    nextState: '',
    nextStateText: '',
    teleportTimer: 0,
    teleportTargetX: 0,
    teleportTargetY: 0
  };

  eyeMiniBoss: any = {
    x: ROOM_WIDTH / 2, y: 150,
    hp: 500, maxHp: 500,
    activeTimer: 0,
    cooldownTimer: 20,
    isActive: false,
    state: 'idle',
    fireTimer: 0,
    pillarX: 0,
    invulnerableTimer: 0,
    shieldHp: 2,
    maxShieldHp: 2,
    shieldActive: true,
    shieldDownTimer: 0
  };

  projectiles: any[] = [];
  fallingEyes: any[] = [];
  tentacles: any[] = [];
  phase3EyeSpawnTimer: number = 5.0;
  playerProjectiles: any[] = [];
  aoes: any[] = [];
  meteors: any[] = [];
  
  masks: any[] = [];
  maskSpawnTimer: number = 20;

  particles: any[] = [];
  judgmentLasers: any[] = [];
  wallTentacles: any[] = [];

  bgScrollX: number = 0;
  devastatedTimer: number = 0;
  lightningEventTimer: number = 0;
  environmentalLightnings: Array<{x: number, timer: number}> = [];

  onPlayerHpChange?: (hp: number) => void;
  onGameOver?: () => void;
  onEnemyHpChange?: (hp: number, maxHp: number) => void;
  onVitalChargesChange?: (charges: number) => void;
  onIntroFinish?: () => void;


  startPhase3() {
      this.enemy.phase = 3;
      this.enemy.hp = 0;
      this.enemy.state = 'dead_phase3';
      this.phase3Active = true;
      
      this.projectiles = [];
      this.fallingEyes = [];
      this.tentacles = [];
      this.aoes = [];
      this.meteors = [];
      this.masks = [
          {x: ROOM_WIDTH * 0.7, y: FLOOR_Y - 200, hp: 50, maxHp: 50, state: 'idle', vx: 0, vy: 0, width: 45, height: 60, hoverOffset: 0, type: 'gold', teleportTimer: 7}
      ];
      this.playerProjectiles = [];
      this.particles = [];
      
      this.player.hp = this.player.maxHp;
      this.player.vitalCharges = 0;
      this.player.x = ROOM_WIDTH * 0.5 + 110; // Center of the middle lower platform
      this.player.y = -100; // High up so they land safely on platforms
      this.player.vy = 0;
      this.eyeMiniBoss.cooldownTimer = 2.0; // Start attacking quickly
      
      this.eyeMiniBoss.isActive = false;
      this.eyeMiniBoss.hp = 500;
      this.eyeMiniBoss.maxHp = 500;
      this.eyeMiniBoss.state = 'idle';
      this.eyeMiniBoss.x = 1200;
      this.eyeMiniBoss.y = 150;
      this.eyeMiniBoss.shieldActive = true;
      this.eyeMiniBoss.shieldHp = 2;
      
      this.phase3EyeSpawnTimer = 20.0;
      this.phase3LavaTimer = 30.0;
      this.lavaLevel = 0.0;
      
      this.platforms = [
          // 3 Lower Platforms
          {x: ROOM_WIDTH * 0.2, y: FLOOR_Y - 220, width: 220, height: 20, targetY: FLOOR_Y - 220, currentY: FLOOR_Y - 220},
          {x: ROOM_WIDTH * 0.5, y: FLOOR_Y - 220, width: 220, height: 20, targetY: FLOOR_Y - 220, currentY: FLOOR_Y - 220},
          {x: ROOM_WIDTH * 0.8, y: FLOOR_Y - 220, width: 220, height: 20, targetY: FLOOR_Y - 220, currentY: FLOOR_Y - 220},
          // 3 Higher Platforms
          {x: ROOM_WIDTH * 0.35, y: FLOOR_Y - 450, width: 200, height: 20, targetY: FLOOR_Y - 450, currentY: FLOOR_Y - 450},
          {x: ROOM_WIDTH * 0.65, y: FLOOR_Y - 450, width: 200, height: 20, targetY: FLOOR_Y - 450, currentY: FLOOR_Y - 450},
          {x: ROOM_WIDTH * 0.9, y: FLOOR_Y - 500, width: 180, height: 20, targetY: FLOOR_Y - 500, currentY: FLOOR_Y - 500}
      ];
      
      if (this.onPlayerHpChange) this.onPlayerHpChange(this.player.hp);
      if (this.onVitalChargesChange) this.onVitalChargesChange(this.player.vitalCharges);
      this.notifyHpChange();
      
      this.bossSubtitleText = '"I AM THE TRUTH"';
      this.bossSubtitleTimer = 3.0;
  }

  notifyHpChange(overrideHp?: number) {
      if (this.onEnemyHpChange) {
          let maxHp = this.enemy.phase >= 3 ? 800 : 750;
          if (overrideHp !== undefined) {
              this.onEnemyHpChange(overrideHp, maxHp);
              return;
          }
          const extra = (this.enemy.phase === 3 && this.eyeMiniBoss.hp > 0) ? this.eyeMiniBoss.hp : 0;
          let hp = Math.max(0, this.enemy.hp) + extra;
          if (hp <= 0 && this.enemy.state !== 'dead') {
              hp = 1; // Keep UI alive until fully dead animation completes
          }
          this.onEnemyHpChange(Math.max(0, hp), maxHp);
      }
  }

  audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  ambientGain: GainNode | null = null;
  ambientStarted = false;
  sfxGainNode: GainNode | null = null;

  initSfxGainNode() {
      if (!this.sfxGainNode && this.audioCtx) {
          try {
              this.sfxGainNode = this.audioCtx.createGain();
              this.sfxGainNode.gain.value = this.sfxVolume;
              this.sfxGainNode.connect(this.audioCtx.destination);
          } catch (e) {
              console.error('Failed to init sfxGainNode', e);
          }
      }
  }

  dealDamage(amount: number) {
      this.player.damageDealtTracker += amount;
      while (this.player.damageDealtTracker >= 50) {
          this.player.damageDealtTracker -= 50;
          if (this.player.vitalCharges < 5) {
              this.player.vitalCharges++;
              if (this.onVitalChargesChange) this.onVitalChargesChange(this.player.vitalCharges);
          }
      }
  }

  speakVoiceLine(text: string, isPhase2: boolean) {
      if (!window.speechSynthesis || this.sfxVolume <= 0) return;
      
      // Stop any current speech
      window.speechSynthesis.cancel();
      
      // Clean up the text (remove quotes)
      const cleanText = text.replace(/["']/g, '');
      
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'en-US';
      
      if (isPhase2) {
          utterance.pitch = 0.2; // deep, monstrous
          utterance.rate = 0.8;  // slower
          utterance.volume = Math.max(0, Math.min(1, 1.0 * this.sfxVolume));
      } else {
          utterance.pitch = 0.8; // slightly deep but majestic
          utterance.rate = 0.9;
          utterance.volume = Math.max(0, Math.min(1, 0.8 * this.sfxVolume));
      }
      
      // Try to find a female voice
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(v => v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Google US English'));
      if (femaleVoice) {
          utterance.voice = femaleVoice;
      }
      
      window.speechSynthesis.speak(utterance);
  }

  playSound(type: string) {
      if (this.sfxVolume <= 0) return;
      if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
      }
      this.initSfxGainNode();
      const osc = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(this.sfxGainNode || this.audioCtx.destination);

      if (type === 'player_attack') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(300, this.audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 0.15);
          gainNode.gain.setValueAtTime(0.4, this.audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.15);
          osc.start();
          osc.stop(this.audioCtx.currentTime + 0.15);
      } else if (type === 'boss_attack') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(200, this.audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(50, this.audioCtx.currentTime + 0.3);
          gainNode.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.3);
          osc.start();
          osc.stop(this.audioCtx.currentTime + 0.3);
      } else if (type === 'hit') {
          osc.type = 'square';
          osc.frequency.setValueAtTime(150, this.audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(50, this.audioCtx.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.4, this.audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
          osc.start();
          osc.stop(this.audioCtx.currentTime + 0.1);
      } else if (type === 'dash') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, this.audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(1200, this.audioCtx.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.4, this.audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
          osc.start();
          osc.stop(this.audioCtx.currentTime + 0.1);
      } else if (type === 'player_hit') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(400, this.audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(50, this.audioCtx.currentTime + 0.25);
          
          const osc2 = this.audioCtx.createOscillator();
          osc2.type = 'square';
          osc2.frequency.setValueAtTime(150, this.audioCtx.currentTime);
          osc2.frequency.exponentialRampToValueAtTime(30, this.audioCtx.currentTime + 0.25);
          osc2.connect(gainNode);
          osc2.start();
          osc2.stop(this.audioCtx.currentTime + 0.25);

          gainNode.gain.setValueAtTime(0.5, this.audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.25);
          osc.start();
          osc.stop(this.audioCtx.currentTime + 0.25);
      } else if (type === 'error') {
          osc.type = 'square';
          osc.frequency.setValueAtTime(120, this.audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(110, this.audioCtx.currentTime + 0.15);
          gainNode.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.15);
          osc.start();
          osc.stop(this.audioCtx.currentTime + 0.15);
      }
  }

  constructor(canvas: HTMLCanvasElement, character: 'knight' | 'witch' = 'knight', mode: 'devastated_path' | 'battle' | 'tutorial' = 'battle', initialSfxVolume: number = 0.7) {
    this.sfxVolume = initialSfxVolume;
    this.initSfxGainNode();
    this.character = character;
    if (character === 'witch') {
        this.player.maxHp = 6;
        this.player.hp = 6;
    }
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.gameMode = mode;
    
    if (this.gameMode === 'devastated_path') {
        this.enemy.state = 'hidden';
        this.enemy.hp = 0;
    }


  }

  pause() {
    this.isPaused = true;
    cancelAnimationFrame(this.animationId);
    this.keys = { left: false, right: false, up: false, down: false, attack: false, secondary: false, secondaryHeld: false };
    this.mouse.isDown = false;
    this.mouse.rightDown = false;
  }

  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.animationId = requestAnimationFrame(this.loop);
  }

  start() {
    this.lastTime = performance.now();
    this.isPaused = false;
    this.loop(this.lastTime);
  }

  stop() {
    this.isPaused = true;
    cancelAnimationFrame(this.animationId);
    if (this.projectileLoopNode) {
        this.projectileLoopNode.stop();
        this.projectileLoopNode = null;
        this.projectileGainNode = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
        this.audioCtx.close();
    }
  }

  handleKeyDown = (e: KeyboardEvent) => {
    if (this.isPaused) return;
    if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
    }
    if (e.key === 'a' || e.key === 'ArrowLeft') this.keys.left = true;
    if (e.key === 's' || e.key === 'ArrowDown') this.keys.down = true;
    if (e.key === 'd' || e.key === 'ArrowRight') this.keys.right = true;
    if (e.key === 'w' || e.key === 'ArrowUp' || e.key === ' ') { this.keys.up = true; this.player.jumpBufferTimer = 0.15; }
    if (e.key === 'x' || e.key === 'X') this.keys.attack = true;

    if (e.key === 'c' || e.key === 'C') {
        this.keys.secondary = true; this.keys.secondaryHeld = true;
    }
    if (e.key === 'f' || e.key === 'F') {
        if (this.player.vitalCharges >= 1 && this.player.chargeCooldown <= 0 && this.player.healingTimer <= 0 && this.player.hp < this.player.maxHp) {
            this.player.vitalCharges -= 1;
            this.player.healingTimer = 1.5;
            this.player.chargeCooldown = 3;
                        if (this.onVitalChargesChange) this.onVitalChargesChange(this.player.vitalCharges);
            this.spawnAbsorbParticles(this.player.x, this.player.y);
            
            if (this.character === 'witch') {
                // Grande explosão que causa 10 dano e destrói projéteis
                this.aoes.push({
                    type: 'void_blast',
                    x: this.player.x,
                    y: this.player.y - this.player.height/2,
                    radius: 400,
                    timer: 0.3,
                    maxTimer: 0.3
                });
                for (let i = this.projectiles.length - 1; i >= 0; i--) {
                    const p = this.projectiles[i];
                    if (Math.hypot(p.x - this.player.x, p.y - (this.player.y - this.player.height/2)) < 400) {
                        this.projectiles.splice(i, 1);
                        this.spawnHitParticles(p.x, p.y, 0);
                    }
                }
                // Damage boss
                if (this.enemy.hp > 0 && Math.hypot(this.enemy.x - this.player.x, this.enemy.y - this.player.y) < 400) {
                    this.enemy.hp -= 10;
                    this.dealDamage(10);
                    this.notifyHpChange();
                }
            }
        }
    }
    if (e.key === 'v' || e.key === 'V') {
        if (this.player.vitalCharges >= 1 && this.player.chargeCooldown <= 0) {
            this.player.vitalCharges -= 1;
            if (this.character === 'witch') {
                this.player.boomerangTimer = 3;
            } else {
                this.player.buffTimer = 3;
            }
            this.player.chargeCooldown = 3;
            if (this.onVitalChargesChange) this.onVitalChargesChange(this.player.vitalCharges);
                    }
    }
    
    // Cheat / Debug: Skip Phase
    if (e.key === 'p' || e.key === 'P') {
        if (this.enemy.phase === 1) {
            this.enemy.hp = 375;
        } else if (this.enemy.phase === 2) {
            this.startPhase3();
        } else if (this.enemy.phase >= 3) {
            if (this.eyeMiniBoss) {
                this.eyeMiniBoss.hp = 0;
                this.eyeMiniBoss.state = 'dead';
                this.eyeMiniBoss.shieldActive = false;
            }
        }
        this.notifyHpChange();
    }
    if (e.key === 'Shift') {
        if (this.player.dashTimer <= 0) {
            this.player.isDashing = true;
            this.player.dashDuration = 0.2; // Slightly shorter duration for faster feel
            this.player.dashTimer = 0.6; // Reduced by 0.4s
            this.player.intangibleTimer = 0.6; // Match reduced cooldown
            this.playSound('dash'); 
            
            let dx = 0;
            if (this.keys.left) dx = -1;
            if (this.keys.right) dx = 1;
            
            if (dx === 0) {
                dx = this.player.facingRight ? 1 : -1;
            }
            // Force horizontal dash to prevent accidental downward dashes
            this.player.dashDir = {x: dx, y: 0};
        }
    }
  };

  handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'c' || e.key === 'C') { this.keys.secondaryHeld = false; this.keys.secondary = false; }
    if (e.key === 'a' || e.key === 'ArrowLeft') this.keys.left = false;
    if (e.key === 's' || e.key === 'ArrowDown') this.keys.down = false;
    if (e.key === 'd' || e.key === 'ArrowRight') this.keys.right = false;
    if (e.key === 'w' || e.key === 'ArrowUp' || e.key === ' ') { this.keys.up = false; if (this.player.vy < 0) this.player.vy *= 0.5; }
    if (e.key === 'x' || e.key === 'X') this.keys.attack = false;
  };

  handleMouseDown = (e: MouseEvent) => {
    if (this.isPaused) return;
    if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
    }
    if (e.button === 0) {
        this.mouse.isDown = true;
        this.mouse.clicked = true;
    } else if (e.button === 2) {
        this.mouse.rightDown = true;
        this.mouse.rightClicked = true;
    }
  };
  
  handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };
  
  handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
        this.mouse.isDown = false;
    } else if (e.button === 2) {
        this.mouse.rightDown = false;
    }
  };

  handleMouseMove = (e: MouseEvent) => {
    if (this.isPaused) return;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    this.mouse.x = ((e.clientX - rect.left) * scaleX) / ZOOM;
    this.mouse.y = ((e.clientY - rect.top) * scaleY) / ZOOM;
  };

  startAmbientAudio() {
      if (!this.audioCtx || this.ambientStarted) return;
      this.ambientStarted = true;
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      
      this.initSfxGainNode();
      this.ambientGain = this.audioCtx.createGain();
      this.ambientGain.gain.value = 0; // fade in later
      this.ambientGain.connect(this.sfxGainNode || this.audioCtx.destination);
      this.ambientGain.gain.linearRampToValueAtTime(0.6, this.audioCtx.currentTime + 3);

      // Bubbling lava (Low freq noise + LFO)
      const bufferSize = this.audioCtx.sampleRate * 2;
      const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
      }
      const noise = this.audioCtx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;
      
      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 200;
      
      const bubbleLfo = this.audioCtx.createOscillator();
      bubbleLfo.type = 'sine';
      bubbleLfo.frequency.value = 3;
      const bubbleGain = this.audioCtx.createGain();
      bubbleGain.gain.value = 100;
      bubbleLfo.connect(bubbleGain);
      bubbleGain.connect(filter.frequency);
      bubbleLfo.start();
      
      noise.connect(filter);
      const noiseGain = this.audioCtx.createGain();
      noiseGain.gain.value = 0.4;
      filter.connect(noiseGain);
      noiseGain.connect(this.ambientGain);
      noise.start();

      // Guttural tentacle noises (Sawtooth + Lowpass + LFO)
      const gutOsc = this.audioCtx.createOscillator();
      gutOsc.type = 'sawtooth';
      gutOsc.frequency.value = 40;
      
      const gutFilter = this.audioCtx.createBiquadFilter();
      gutFilter.type = 'lowpass';
      gutFilter.frequency.value = 150;
      
      const gutLfo = this.audioCtx.createOscillator();
      gutLfo.type = 'sine';
      gutLfo.frequency.value = 0.5;
      const gutLfoGain = this.audioCtx.createGain();
      gutLfoGain.gain.value = 100;
      gutLfo.connect(gutLfoGain);
      gutLfoGain.connect(gutFilter.frequency);
      gutLfo.start();
      
      const gutAmpLfo = this.audioCtx.createOscillator();
      gutAmpLfo.type = 'sine';
      gutAmpLfo.frequency.value = 0.2;
      const gutAmpGain = this.audioCtx.createGain();
      gutAmpGain.gain.value = 0;
      gutOsc.connect(gutFilter);
      gutFilter.connect(gutAmpGain);
      gutAmpGain.connect(this.ambientGain);
      
      gutAmpLfo.connect(gutAmpGain.gain);
      gutAmpLfo.start();
      gutOsc.start();
  }

  update(dt: number) {
    if (this.gameMode === 'devastated_path') {
        // --- HORDE LOGIC ---
        if (this.hordeState === 'waiting') {
            this.hordeTimer -= dt;
            if (this.hordeTimer <= 0) {
                this.hordeWave++;
                this.hordeState = 'spawning';
                this.hordeMobsRemaining = 2 + this.hordeWave * 2;
            }
        } else if (this.hordeState === 'spawning') {
            this.hordeTimer -= dt;
            if (this.hordeTimer <= 0 && this.hordeMobsRemaining > 0) {
                const isFlying = Math.random() < 0.3;
                let spawnX = this.player.x + (Math.random() > 0.5 ? 400 : -400) + (Math.random() * 200 - 100);
                if (spawnX < 100) spawnX = 100;
                
                if (isFlying) {
                    this.mobs.push({
                        type: 'abyssal_ray',
                        x: spawnX,
                        y: FLOOR_Y - 300 - Math.random() * 100,
                        width: 90, height: 60,
                        hp: 8 + this.hordeWave * 3,
                        maxHp: 8 + this.hordeWave * 3,
                        vx: 0, vy: 0,
                        hitTimer: 0,
                        state: 'hovering',
                        hoverTimer: 2.0,
                        hoverTargetX: spawnX,
                        hoverTargetY: FLOOR_Y - 300
                    });
                } else {
                    this.mobs.push({
                        type: 'void_cultist',
                        x: spawnX,
                        y: FLOOR_Y - 60, 
                        width: 75, height: 120,
                        hp: 15 + this.hordeWave * 4,
                        maxHp: 15 + this.hordeWave * 4,
                        vx: 0, vy: 0,
                        hitTimer: 0,
                        attackCooldown: 2.0,
                        state: 'idle',
                        animTimer: 0
                    });
                }
                
                this.hordeMobsRemaining--;
                this.hordeTimer = 1.0 + Math.random() * 0.5;
                
                if (this.hordeMobsRemaining <= 0) {
                    this.hordeState = 'cleared';
                }
            }
        } else if (this.hordeState === 'cleared') {
            if (this.mobs.length === 0) {
                this.hordeState = 'waiting';
                this.hordeTimer = 5.0; // Wait 5 seconds before next wave
            }
        }
        // --- END HORDE LOGIC ---

        this.devastatedTimer += dt;
        if (this.devastatedTimer >= 30) {
            this.lightningEventTimer = 5.0; // 5 seconds of lightning storm
            this.devastatedTimer = 0;
            if (true) this.playSound('explosion_sound'); // thunder effect
        }
        
        if (this.lightningEventTimer > 0) {
            this.lightningEventTimer -= dt;
            // Spawn random environmental lightnings
            if (Math.random() < 3 * dt) { // ~3 per second during the storm
                this.environmentalLightnings.push({
                    x: this.player.x + (Math.random() - 0.5) * 1200,
                    timer: 1.0 // 1s warning before strike
                });
            }
        }
        
        // Update lightnings
        for (let i = this.environmentalLightnings.length - 1; i >= 0; i--) {
            let l = this.environmentalLightnings[i];
            let oldTimer = l.timer;
            l.timer -= dt;
            
            // Strike frame
            if (oldTimer >= 0.2 && l.timer < 0.2) {
                if (true) this.playSound('player_hit'); // mini thunder
                this.screenShakeTimer = 0.2; 
                this.screenShakeIntensity = 10;
                
                // Damage check
                if (Math.abs(this.player.x - l.x) < 80 && this.player.invulnerableTimer <= 0 && this.player.intangibleTimer <= 0) {
                    this.player.hp -= 1;
                    if (this.onPlayerHpChange) this.onPlayerHpChange(this.player.hp);
                    this.player.invulnerableTimer = 3.0;
                    this.hitEffectTimer = 0.5;
                    this.screenShakeIntensity = 15;
                    if (true) this.playSound('player_hit');
                }
            }
            if (l.timer <= 0) {
                this.environmentalLightnings.splice(i, 1);
            }
        }
    }

    if (this.bossHitSoundCooldown > 0) this.bossHitSoundCooldown -= dt;
    
    // Manage projectile sound loop
    const totalProjectiles = this.projectiles.length + this.meteors.length + this.playerProjectiles.length;
    if (totalProjectiles > 0) {
        if (!this.projectileLoopNode && true) {
            const res = this.playBuffer('projectsound', true, 0.2);
            if (res) {
                this.projectileLoopNode = res.source;
                this.projectileGainNode = res.gain;
            }
        }
    } else {
        if (this.projectileLoopNode) {
            this.projectileLoopNode.stop();
            this.projectileLoopNode = null;
            this.projectileGainNode = null;
        }
    }

    if (this.player.hp <= 0) {
        if (!this.player.isDead) {
            this.player.isDead = true;
            setTimeout(() => { if (this.onGameOver) this.onGameOver(); }, 2000);
        }
        if (this.projectileLoopNode) {
            this.projectileLoopNode.stop();
            this.projectileLoopNode = null;
            this.projectileGainNode = null;
        }
        return; // Game over
    }

    // Background scrolling removed, parallax is tied to player.x

    // --- Timers ---
    if (this.player.attackTimer > 0) {
        let speed = 1;
        if (this.player.buffTimer > 0) speed = this.character === 'witch' ? 1.5 : 2.0;
        this.player.attackTimer -= dt * speed;
    } else {
        this.player.isAttacking = false;
    }
    if (this.player.attackCooldownTimer > 0) this.player.attackCooldownTimer -= dt;
    if (this.player.invulnerableTimer > 0) this.player.invulnerableTimer -= dt;
    if (this.player.knockbackTimer > 0) this.player.knockbackTimer -= dt;
    if (this.player.slowFallTimer > 0) this.player.slowFallTimer -= dt;
    if (this.player.boomerangTimer > 0) this.player.boomerangTimer -= dt;
    if (this.player.jumpBufferTimer > 0) this.player.jumpBufferTimer -= dt;
    if (this.player.coyoteTimer > 0) this.player.coyoteTimer -= dt;

    if (this.player.chargeCooldown > 0) this.player.chargeCooldown -= dt;
    if (this.player.buffTimer > 0) this.player.buffTimer -= dt;


    
    if (this.player.healingTimer > 0) {
        // Continuous absorbing particles
        if (Math.random() < 0.4) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 80;
            this.particles.push({
                x: this.player.x + Math.cos(angle) * distance,
                y: this.player.y - 30 + Math.sin(angle) * distance,
                vx: -Math.cos(angle) * 150,
                vy: -Math.sin(angle) * 150,
                life: distance / 150,
                color: '#d8b4fe'
            });
        }
        
        this.player.healingTimer -= dt;
        if (this.player.healingTimer <= 0) {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
            if (this.onPlayerHpChange) this.onPlayerHpChange(this.player.hp);
            
            // Energy explosion
            for (let i = 0; i < 20; i++) {
                const angle = (Math.PI * 2 / 20) * i;
                this.particles.push({
                    x: this.player.x,
                    y: this.player.y - 30,
                    vx: Math.cos(angle) * 350,
                    vy: Math.sin(angle) * 350,
                    life: 0.3 + Math.random() * 0.3,
                    color: '#fef08a'
                });
            }
            if (true) this.playSound('hit'); 
        }
    }

    if (this.enemy.invulnerableTimer > 0) this.enemy.invulnerableTimer -= dt;
    if (this.enemy.knockbackTimer > 0) this.enemy.knockbackTimer -= dt;
    this.enemy.stateTimer -= dt;
    if (this.enemy.transitionTimer > 0) this.enemy.transitionTimer -= dt;
    if (this.bossSubtitleTimer > 0) this.bossSubtitleTimer -= dt;


    // --- Update Mobs AI ---
    for (let i = this.mobs.length - 1; i >= 0; i--) {
        const m = this.mobs[i];
        if (m.hitTimer > 0) m.hitTimer -= dt;
        

        let playerIsAttacking = this.player.isAttacking && this.player.attackTimer > 0.05;
        let playerAttackDir = this.player.facingRight ? 1 : -1;

        if (m.type === 'void_cultist') {
            const dirX = Math.sign(this.player.x - m.x);
            const dist = Math.abs(this.player.x - m.x);
            
            m.animTimer += dt;
            
            if (m.state === 'idle') {
                if (dist > 350) {
                    m.vx = dirX * 100; // Walk towards player
                } else if (dist < 200) {
                    m.vx = -dirX * 80; // Back away
                } else {
                    m.vx = 0;
                }
                
                if (m.attackCooldown === undefined) m.attackCooldown = 2.0;
                m.attackCooldown -= dt;
                
                if (m.attackCooldown <= 0) {
                    m.state = 'casting';
                    m.attackCooldown = 1.0;
                    m.vx = 0;
                }
            } else if (m.state === 'casting') {
                m.attackCooldown -= dt;
                if (m.attackCooldown <= 0) {
                    // Fire 3-way spread or homing
                    const angleToPlayer = Math.atan2(this.player.y - m.y, this.player.x - m.x);
                    for (let i = -1; i <= 1; i++) {
                        const spreadAngle = angleToPlayer + (i * 0.25);
                        this.projectiles.push({
                            x: m.x, y: m.y - 20,
                            vx: Math.cos(spreadAngle) * 400,
                            vy: Math.sin(spreadAngle) * 400,
                            radius: 10,
                            color: '#fbbf24', // Yellow magic
                            type: 'magic',
                            damage: 2,
                            life: 3.0
                        });
                    }
                    if (true) this.playSound('boss_attack');
                    
                    // Teleport away if player is too close
                    if (dist < 150) {
                        m.x = this.player.x + (Math.random() > 0.5 ? 400 : -400);
                        if (m.x < 100) m.x = 100;
                        this.spawnHitParticles(m.x, m.y, 0, 15);
                    }
                    
                    m.state = 'idle';
                    m.attackCooldown = 3.0 + Math.random() * 2.0;
                }
            }

            m.x += m.vx * dt;

            // Player collision
            const mRect = { x: m.x - m.width/2, y: m.y - m.height/2, width: m.width, height: m.height };
            const pRect = { x: this.player.x - this.player.width/2, y: this.player.y - this.player.height/2, width: this.player.width, height: this.player.height };
            if (this.player.invulnerableTimer <= 0 && this.player.knockbackTimer <= 0) {
                if (mRect.x < pRect.x + pRect.width && mRect.x + mRect.width > pRect.x &&
                    mRect.y < pRect.y + pRect.height && mRect.y + mRect.height > pRect.y) {
                    this.player.hp -= 2;
                    this.player.invulnerableTimer = 3.0;
                    this.player.knockbackTimer = 0.2;
                    this.player.vx = Math.sign(this.player.x - m.x) * 300;
                    if (this.onPlayerHpChange) this.onPlayerHpChange(this.player.hp);
                    if (true) this.playSound('hit');
                }
            }
        } else if (m.type === 'abyssal_ray') {
            m.animTimer = (m.animTimer || 0) + dt;
            
            if (m.state === 'hovering') {
                m.hoverTimer -= dt;
                
                // Track player position horizontally
                m.hoverTargetX = this.player.x;
                m.hoverTargetY = Math.min(FLOOR_Y - 250, this.player.y - 200);
                
                m.vx = (m.hoverTargetX - m.x) * 2.0;
                m.vy = (m.hoverTargetY - m.y) * 2.0;
                
                if (m.hoverTimer <= 0) {
                    m.state = 'diving';
                    m.diveTargetX = this.player.x;
                    m.diveTargetY = FLOOR_Y - 20;
                    m.hoverTimer = 2.0; // recovery time
                    
                    const dx = m.diveTargetX - m.x;
                    const dy = m.diveTargetY - m.y;
                    const dist = Math.hypot(dx, dy);
                    m.vx = (dx / dist) * 800; // fast dive
                    m.vy = (dy / dist) * 800;
                    if (true) this.playBuffer('destruction_sound', false, 0.3);
                }
            } else if (m.state === 'diving') {
                if (m.y >= FLOOR_Y - 40) {
                    m.state = 'recovering';
                    m.vy = -300;
                    m.vx *= 0.5;
                    this.spawnHitParticles(m.x, FLOOR_Y, 0, 10);
                }
            } else if (m.state === 'recovering') {
                m.hoverTimer -= dt;
                m.vy *= 0.95; // decelerate upwards
                if (m.hoverTimer <= 0 || m.y < FLOOR_Y - 300) {
                    m.state = 'hovering';
                    m.hoverTimer = 2.0 + Math.random();
                }
            }
            
            m.x += m.vx * dt;
            m.y += m.vy * dt;
            
            // Collision with player
            const mRect = { x: m.x - m.width/2, y: m.y - m.height/2, width: m.width, height: m.height };
            const pRect = { x: this.player.x - this.player.width/2, y: this.player.y - this.player.height/2, width: this.player.width, height: this.player.height };
            if (this.player.invulnerableTimer <= 0 && this.player.knockbackTimer <= 0) {
                if (mRect.x < pRect.x + pRect.width && mRect.x + mRect.width > pRect.x &&
                    mRect.y < pRect.y + pRect.height && mRect.y + mRect.height > pRect.y) {
                    this.player.hp -= 2;
                    this.player.invulnerableTimer = 3.0;
                    this.player.knockbackTimer = 0.2;
                    this.player.vx = Math.sign(this.player.x - m.x) * 400;
                    if (this.onPlayerHpChange) this.onPlayerHpChange(this.player.hp);
                    if (true) this.playSound('hit');
                }
            }
        }
    }


    if (this.player.dashTimer > 0) this.player.dashTimer -= dt;
    if (this.player.intangibleTimer > 0) this.player.intangibleTimer -= dt;
    if (this.screenShakeTimer > 0) this.screenShakeTimer -= dt;
    if (this.hitEffectTimer > 0) this.hitEffectTimer -= dt;
    if (this.player.doubleJumpFlipTimer > 0) this.player.doubleJumpFlipTimer -= dt;
    if (this.bossTeleportTimer > 0) this.bossTeleportTimer -= dt;
    
    // Update Lava and Platforms
    if (this.enemy.phase === 2) {
        if (this.lavaDelayTimer > 0) {
            this.lavaDelayTimer -= dt;
        } else if (this.lavaLevel < 1.0) {
            this.lavaLevel += dt / 20.0; // Fills up over 20 seconds
            if (this.lavaLevel > 1.0) this.lavaLevel = 1.0;
        }
    } else if (this.enemy.phase === 3) {
        this.lavaLevel = 0; // Remover lava que sobe
        this.phase3LavaTimer = 30.0;
        
        // Let platforms stay as created in phase 3
    }
    
    for (const plat of this.platforms) {
        if (plat.currentY < plat.targetY) {
            plat.currentY += dt * 50; // Platforms fall at 50px/s
            if (plat.currentY > plat.targetY) plat.currentY = plat.targetY;
        }
    }
    
    // Lava removed damage, now handled as slow in movement code

    if (this.player.healingTimer > 0) {
        this.player.isDashing = false;
        this.player.vx = 0;
        this.player.vy = 0;
      this.eyeMiniBoss.cooldownTimer = 2.0; // Start attacking quickly // Freeze in mid-air while healing
    } else if (this.player.dashDuration > 0) {
        this.player.dashDuration -= dt;
        // Increase dash distance significantly
        const dashSpeed = MOVE_SPEED * 3.5;
        this.player.vx = this.player.dashDir.x * dashSpeed;
        this.player.vy = this.player.dashDir.y * dashSpeed;
        
        if (this.player.dashDir.y === 0) {
            this.player.vy = 0;
      this.eyeMiniBoss.cooldownTimer = 2.0; // Start attacking quickly // Suspend gravity for horizontal dash
        }
    } else {
        this.player.isDashing = false;
        // --- Player Physics & Input ---
        let currentGravity = GRAVITY;
        if (this.character === 'witch' && this.player.slowFallTimer > 0 && this.player.vy > 0) {
            currentGravity *= 0.8;
        }
        if (this.enemy.phase >= 3 && this.player.vy > 0) {
            currentGravity = GRAVITY * 0.45; // floaty fall in phase 3
        }
        this.player.vy += currentGravity * dt;

        if (this.player.knockbackTimer <= 0) {
          let currentMoveSpeed = MOVE_SPEED;
          // Phase 2 floor slow (30%)
          if (this.enemy.phase === 2 && this.lavaLevel > 0 && this.player.y + this.player.height/2 >= FLOOR_Y - (this.lavaLevel * 50)) {
              currentMoveSpeed *= 0.7;
          }

          if (this.eyeMiniBoss && this.eyeMiniBoss.isActive && this.eyeMiniBoss.state === 'invocation_lock') {
              this.player.vx = 0;
              // Ignore movement inputs
          } else if (this.keys.left) {
            this.player.vx = -currentMoveSpeed;
            if (!this.player.isAttacking) this.player.facingRight = false;
          } else if (this.keys.right) {
            this.player.vx = currentMoveSpeed;
            if (!this.player.isAttacking) this.player.facingRight = true;
          } else {
            this.player.vx = 0;
          }
          
          // Lunge forward slightly when attacking for fluid combat
          if (this.player.isAttacking && this.player.attackTimer === ATTACK_DURATION) {
             this.player.vx += Math.cos(this.player.attackAngle) * 200;
          }

          if (this.player.jumpBufferTimer > 0 && !(this.eyeMiniBoss && this.eyeMiniBoss.isActive && this.eyeMiniBoss.state === 'invocation_lock')) {
            if (this.player.isGrounded || this.player.coyoteTimer > 0) {
                this.player.vy = JUMP_FORCE;
                this.player.isGrounded = false;
                this.player.coyoteTimer = 0;
                this.player.jumpBufferTimer = 0;
                this.keys.up = false;
            } else if (!this.player.hasDoubleJumped) {
                this.player.vy = JUMP_FORCE * 0.9;
                this.player.hasDoubleJumped = true;
                this.player.doubleJumpFlipTimer = 0.4;
                this.player.jumpBufferTimer = 0;
                this.keys.up = false;
            }
          }
        } else {
          // Friction during knockback
          this.player.vx *= 0.95; 
        }
    }

    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;

    // Floor collision
    let groundedOnPlatform = false;
    if (this.player.vy >= 0) {
        const time = Date.now() / 1000;
        for (let i = 0; i < this.platforms.length; i++) {
            const plat = this.platforms[i];
            const floatOffset = Math.sin(time * 2 + i) * 5;
            const actualY = plat.currentY + floatOffset;
            
            if (this.player.y + this.player.height/2 <= actualY + 15 && 
                this.player.y + this.player.height/2 + this.player.vy * dt >= actualY &&
                this.player.x + this.player.width/2 > plat.x &&
                this.player.x - this.player.width/2 < plat.x + plat.width) {
                
                this.player.y = actualY - this.player.height/2;
                this.player.vy = 0;
      this.eyeMiniBoss.cooldownTimer = 2.0; // Start attacking quickly
                groundedOnPlatform = true;
                break;
            }
        }
    }

    if (groundedOnPlatform) {
        this.player.isGrounded = true;
        this.player.hasDoubleJumped = false;
    } else if (this.player.y > FLOOR_Y - this.player.height / 2) {
      if (this.enemy.phase === 3) {
          if (this.player.y > FLOOR_Y + 150) {
              this.player.x = ROOM_WIDTH * 0.5 + 110;
              this.player.y = -100;
              this.player.vy = 0;
              this.player.hasDoubleJumped = false;
              if (this.player.invulnerableTimer <= 0 && this.player.intangibleTimer <= 0) {
                  this.player.hp -= 1;
                  if (this.onPlayerHpChange) this.onPlayerHpChange(this.player.hp);
                  this.player.invulnerableTimer = 3.0;
                  this.hitEffectTimer = 0.5; this.screenShakeTimer = 0.2; this.screenShakeIntensity = 8;
                  if (true) this.playSound('player_hit');
              }
          }
      } else {
          this.player.y = FLOOR_Y - this.player.height / 2;
          this.player.vy = 0;
      this.eyeMiniBoss.cooldownTimer = 2.0; // Start attacking quickly
          this.player.isGrounded = true;
          this.player.hasDoubleJumped = false;
      }
    } else {
      if (this.player.isGrounded) this.player.coyoteTimer = 0.15;
      this.player.isGrounded = false;
    }
    
    // Wall collision
    if (this.player.x < this.player.width / 2) this.player.x = this.player.width / 2;
    if (this.player.x > ROOM_WIDTH - this.player.width / 2) this.player.x = ROOM_WIDTH - this.player.width / 2;

    // Animation
    if (this.player.isGrounded && Math.abs(this.player.vx) > 10) {
      this.player.walkAnim = (this.player.walkAnim + dt * 15) % (Math.PI * 2);
    } else {
      this.player.walkAnim = 0;
    }


    if (this.player.voidCooldown > 0) this.player.voidCooldown -= dt;

    if (this.character === 'witch') {
        if (this.keys.secondary || this.mouse.rightClicked) {
            this.keys.secondary = false;
            this.mouse.rightClicked = false;
            if (this.player.vitalCharges >= 1 && this.player.chargeCooldown <= 0) {
            this.player.vitalCharges -= 1;
            this.player.chargeCooldown = 3;
            if (this.onVitalChargesChange) this.onVitalChargesChange(this.player.vitalCharges);
            this.player.slowFallTimer = 2.0;
            this.player.boomerangTimer = 5.0; // 5 seconds of boomerang
            
            // Teleport to mouse coordinates
            this.player.x = this.mouse.x;
            this.player.y = Math.min(this.mouse.y, FLOOR_Y - this.player.height/2);
            
            // Heal 1 HP
            if (this.player.hp < this.player.maxHp) {
                this.player.hp += 1;
                if (this.onPlayerHpChange) this.onPlayerHpChange(this.player.hp);
                this.spawnAbsorbParticles(this.player.x, this.player.y);
            }
            // AoE explosion destroying projectiles
            this.aoes.push({
                type: 'void_blast',
                x: this.player.x,
                y: this.player.y - this.player.height/2,
                radius: 300,
                timer: 0.2,
                maxTimer: 0.2
            });
            // destroy enemy projectiles
            for (let i = this.projectiles.length - 1; i >= 0; i--) {
                const p = this.projectiles[i];
                if (Math.hypot(p.x - this.player.x, p.y - (this.player.y - this.player.height/2)) < 300) {
                    this.projectiles.splice(i, 1);
                    this.spawnHitParticles(p.x, p.y, 0);
                }
            }
            if (true) this.playBuffer('magic', false, 0.25);
            } else {
                this.playSound('error');
            }
        }
    } else {
        // Knight Shield
        if (this.keys.secondaryHeld || this.mouse.rightDown) {
            this.player.isShielding = true;
        } else {
            this.player.isShielding = false;
        }
    }

    // --- Attack Logic ---
    if ((this.keys.attack || this.mouse.clicked || this.mouse.isDown) && this.player.attackCooldownTimer <= 0 && this.player.healingTimer <= 0 && !this.player.isShielding) {
      const isKeyboardAttack = this.keys.attack;
      this.keys.attack = false; // consume key
      this.mouse.clicked = false;
      this.player.isAttacking = true;
      this.player.attackTimer = ATTACK_DURATION;
      if (this.player.buffTimer > 0) {
          this.player.attackCooldownTimer = this.character === 'witch' ? (ATTACK_COOLDOWN / 1.5) : (ATTACK_COOLDOWN * 0.5);
      } else {
          this.player.attackCooldownTimer = ATTACK_COOLDOWN;
      }
      
      if (this.character === 'witch') {
          this.playBuffer('magic', false, 0.15);
      } else if (this.player.swordType === 'dream' && true) {
          this.playBuffer('dreams_sword_sound', false, 0.10);
      } else {
          this.playSound('player_attack');
      }

      // A direção do ataque sempre segue o mouse
      const dx = this.mouse.x - this.player.x;
      const dy = this.mouse.y - (this.player.y - this.player.height/2);
      
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
          this.player.attackAngle = this.player.facingRight ? 0 : Math.PI;
      } else {
          this.player.attackAngle = Math.atan2(dy, dx);
          this.player.facingRight = dx >= 0;
      }

      if (this.character === 'witch') {
          const isBoomerang = this.player.boomerangTimer > 0;
          this.playerProjectiles.push({
              x: this.player.x,
              y: this.player.y - this.player.height / 2,
              vx: Math.cos(this.player.attackAngle) * (isBoomerang ? 1600 : 1200),
              vy: Math.sin(this.player.attackAngle) * (isBoomerang ? 1600 : 1200),
              angle: this.player.attackAngle,
              radius: isBoomerang ? 15 : 12,
              damage: 3,
              lifeTime: isBoomerang ? 2.5 : 1.5,
              maxLifeTime: isBoomerang ? 2.5 : 1.5,
              piercing: true,
              type: 'dream',
              boomerang: isBoomerang
          });
          this.player.witchShotsFired++;
          if (this.player.witchShotsFired % 20 === 0) {
              this.player.buffTimer = 3.0;
          }
      } else {
          // Knight melee logic
          if (this.player.buffTimer > 0) {
              this.playerProjectiles.push({
                  x: this.player.x,
                  y: this.player.y - this.player.height / 2,
                  vx: Math.cos(this.player.attackAngle) * 1500, 
                  vy: Math.sin(this.player.attackAngle) * 1500, 
                  angle: this.player.attackAngle,
                  radius: 8,
                  damage: 2,
                  lifeTime: 0.5,
                  piercing: false,
                  type: 'light_beam'
              });
          }
      }
      
      // Normal sword/staff melee attack (Applies to both characters)
          const hitX = this.player.x + Math.cos(this.player.attackAngle) * (ATTACK_RANGE * 0.6);
          const hitY = (this.player.y - this.player.height / 2) + Math.sin(this.player.attackAngle) * (ATTACK_RANGE * 0.6);
          const hitRadius = ATTACK_RANGE * 0.7;
          
          // Check fallingEyes (Phase 3)
          if (this.enemy.phase === 3) {
              for (let i = this.fallingEyes.length - 1; i >= 0; i--) {
                  const eye = this.fallingEyes[i];
                  const dx = hitX - eye.x;
                  const dy = hitY - eye.y;
                  if (Math.hypot(dx, dy) < hitRadius + 15) {
                      // Hit eye!
                      this.fallingEyes.splice(i, 1);
                      this.spawnHitParticles(eye.x, eye.y, this.player.attackAngle);
                      if (true) this.playBuffer('destruction_sound', false, 0.4);
                      
                      // Damage boss
                      if (this.eyeMiniBoss.hp > 0) {
                          this.eyeMiniBoss.hp -= 5;
                          this.dealDamage(5);
                          this.notifyHpChange();
                          // If died by eye hit
                          if (this.eyeMiniBoss.hp <= 0 && this.eyeMiniBoss.state !== 'dead') {
                      this.eyeMiniBoss.hp = 0;
                      this.eyeMiniBoss.state = 'dead';
                      this.spawnHitParticles(this.eyeMiniBoss.x, this.eyeMiniBoss.y, 0, 50);
                      if (this.enemy.hp <= 0) {
                          this.enemy.state = 'death_anim_2';
                          this.enemy.stateTimer = 5.0;
                          this.bossSubtitleText = '"VERDADE... DESFEITA..."';
                          this.bossSubtitleTimer = 5.0;
                          this.screenShakeTimer = 5.0;
                          this.screenShakeIntensity = 15;
                          this.fallingEyes = [];
                          this.tentacles = [];
                          if (true) this.playBuffer('destruction_sound', false, 1.0);
                      }
                  }
                      }
                  }
              }
          }

          const eRect: Rect = {
            x: this.enemy.x - this.enemy.width / 2,
            y: this.enemy.y - this.enemy.height / 2,
            width: this.enemy.width,
            height: this.enemy.height
          };

          const testX = Math.max(eRect.x, Math.min(hitX, eRect.x + eRect.width));
          const testY = Math.max(eRect.y, Math.min(hitY, eRect.y + eRect.height));
          const distX = hitX - testX;
          const distY = hitY - testY;
          const distance = Math.sqrt((distX*distX) + (distY*distY));

          if (this.enemy.hp > 0 && distance <= hitRadius && this.enemy.invulnerableTimer <= 0) {
            if (this.bossHitSoundCooldown <= 0) {
                if (true) this.playSound('hit');
                else this.playSound('hit');
                this.bossHitSoundCooldown = 0.5;
            }
            
            let dmg = 5; // Dano da espada
            if (this.enemy.phase >= 2) {
                dmg = 3; // Resistencia a mais na fase 2 e 3
            }
            
            if (this.enemy.phase === 1 && this.enemy.shieldHp > 0) {
                this.enemy.shieldHp -= dmg;
                dmg = Math.max(0, dmg - 1);
                if (this.enemy.shieldHp <= 0) {
                    this.enemy.shieldHp = 0;
                    this.playBuffer('destruction_sound', false, 0.5);
                    this.spawnHitParticles(this.enemy.x, this.enemy.y, 0, 30);
                }
            }
            
            this.enemy.hp -= dmg;
            this.dealDamage(dmg);
            this.enemy.invulnerableTimer = 0.2;
            
            if (this.enemy.state === 'idle') {
                this.enemy.knockbackTimer = 0.2;
                this.enemy.vx = Math.cos(this.player.attackAngle) * KNOCKBACK_FORCE_ENEMY;
                this.enemy.vy = Math.sin(this.player.attackAngle) * KNOCKBACK_FORCE_ENEMY - 150;
            }

            this.player.knockbackTimer = 0.15;
            this.player.vx = -Math.cos(this.player.attackAngle) * KNOCKBACK_FORCE_PLAYER;
            this.player.vy = -Math.sin(this.player.attackAngle) * KNOCKBACK_FORCE_PLAYER - 100;

            // Pogo bounce
            if (Math.sin(this.player.attackAngle) > 0.5) {
                this.player.vy = JUMP_FORCE * 0.9;
            }

            this.spawnHitParticles(this.enemy.x, this.enemy.y, Math.cos(this.player.attackAngle));
            this.notifyHpChange();
          }

          // Mini Boss hit detection
          if (this.enemy.phase === 3 && this.eyeMiniBoss.hp > 0 && this.eyeMiniBoss.invulnerableTimer <= 0) {
              const eyeRect = { x: this.eyeMiniBoss.x - 200, y: this.eyeMiniBoss.y - 100, width: 400, height: 200 };
              const eyeTestX = Math.max(eyeRect.x, Math.min(hitX, eyeRect.x + eyeRect.width));
              const eyeTestY = Math.max(eyeRect.y, Math.min(hitY, eyeRect.y + eyeRect.height));
              const eyeDistX = hitX - eyeTestX;
              const eyeDistY = hitY - eyeTestY;
              
              if (Math.sqrt((eyeDistX*eyeDistX) + (eyeDistY*eyeDistY)) <= hitRadius) {
                  if (this.bossHitSoundCooldown <= 0) {
                      if (true) this.playSound('hit');
                      else this.playSound('hit');
                      this.bossHitSoundCooldown = 0.5;
                  }
                  if (false) {
                  } else {
                      let dmg = 5;
                      if (this.enemy.phase >= 2) {
                          dmg = 3;
                      }
                      this.eyeMiniBoss.hp -= dmg;
                      this.dealDamage(dmg);
                  }
                  this.eyeMiniBoss.invulnerableTimer = 0.2;
                  this.notifyHpChange();
                  if (this.eyeMiniBoss.hp <= 0 && this.eyeMiniBoss.state !== 'dead') {
                      this.eyeMiniBoss.hp = 0;
                      this.eyeMiniBoss.state = 'dead';
                      this.spawnHitParticles(this.eyeMiniBoss.x, this.eyeMiniBoss.y, 0, 50);
                      
                      if (this.enemy.hp <= 0) {
                          this.enemy.state = 'death_anim_2';
                          this.enemy.stateTimer = 5.0;
                          this.bossSubtitleText = '"VERDADE... DESFEITA..."';
                          this.bossSubtitleTimer = 5.0;
                          this.screenShakeTimer = 5.0;
                          this.screenShakeIntensity = 15;
                          this.fallingEyes = [];
                          this.tentacles = [];
                          if (true) this.playBuffer('destruction_sound', false, 1.0);
                      }
                  }
                  
                  // Pogo bounce
                  if (Math.sin(this.player.attackAngle) > 0.5) {
                      this.player.vy = JUMP_FORCE * 0.9;
                  }
                  
                  this.spawnHitParticles(this.eyeMiniBoss.x, this.eyeMiniBoss.y, Math.cos(this.player.attackAngle));
              }
          }

          // Falling eyes hit detection
          for (let i = 0; i < this.fallingEyes.length; i++) {
              const eye = this.fallingEyes[i];
              if (Math.hypot(hitX - eye.x, hitY - eye.y) <= hitRadius) {
                  this.fallingEyes.splice(i, 1);
                  this.spawnHitParticles(eye.x, eye.y, Math.cos(this.player.attackAngle));
                  if (true) this.playSound('hit');
                  i--;
              }
          }
          
          // Mobs hit detection (Melee)
          for (let i = 0; i < this.mobs.length; i++) {
              const m = this.mobs[i];
              const mRect = { x: m.x - m.width/2, y: m.y - m.height/2, width: m.width, height: m.height };
              const mTestX = Math.max(mRect.x, Math.min(hitX, mRect.x + mRect.width));
              const mTestY = Math.max(mRect.y, Math.min(hitY, mRect.y + mRect.height));
              const mDist = Math.hypot(hitX - mTestX, hitY - mTestY);
              if (mDist <= hitRadius) {
                  if (this.bossHitSoundCooldown <= 0) {
                      if (true) this.playSound('hit');
                      else this.playSound('hit');
                      this.bossHitSoundCooldown = 0.5;
                  }
                  
                  const dmg = (this.enemy.phase >= 2) ? 3 : 5;
                  m.hp -= dmg;
                  m.hitTimer = 0.2;
                  this.dealDamage(dmg);
                  this.spawnHitParticles(m.x, m.y, Math.cos(this.player.attackAngle));
                  
                  if (Math.sin(this.player.attackAngle) > 0.5) {
                      this.player.vy = JUMP_FORCE * 0.9;
                  }
                  
                  if (m.hp <= 0) {
                      this.spawnHitParticles(m.x, m.y, 0, 20);
                      this.mobs.splice(i, 1);
                      i--;
                  }
              }
          }

          // Masks hit detection
          for (let i = 0; i < this.masks.length; i++) {
              const m = this.masks[i];
              if (m.state === 'idle') {
                  const mRect = { x: m.x - m.width/2, y: m.y - m.height/2, width: m.width, height: m.height };
                  const mTestX = Math.max(mRect.x, Math.min(hitX, mRect.x + mRect.width));
                  const mTestY = Math.max(mRect.y, Math.min(hitY, mRect.y + mRect.height));
                  const mDist = Math.hypot(hitX - mTestX, hitY - mTestY);
                  if (mDist <= hitRadius) {
                      if (this.bossHitSoundCooldown <= 0) {
                          if (true) this.playSound('hit');
                          else this.playSound('hit');
                          this.bossHitSoundCooldown = 0.5;
                      }
                      const dmg = 5;
                      m.hp -= dmg;
                      this.dealDamage(dmg);
                      
                      if (Math.sin(this.player.attackAngle) > 0.5) {
                          this.player.vy = JUMP_FORCE * 0.9;
                      }
                      
                      this.spawnHitParticles(m.x, m.y, Math.cos(this.player.attackAngle));
                      
                      if (m.hp <= 0) {
                          if (m.type === 'gold') {
                              for (let k = 0; k < 12; k++) {
                                  const angle = (Math.PI * 2 / 12) * k;
                                  this.projectiles.push({
                                      x: m.x, y: m.y,
                                      vx: Math.cos(angle) * 250,
                                      vy: Math.sin(angle) * 250,
                                      radius: 12, hp: 1, life: 10,
                                      type: 'blast', color: '#fbbf24', neutral: true
                                  });
                              }
                              this.player.buffTimer = 3.0; // Attack speed boost
                              this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1); // Heal 1 HP
                              if (this.onPlayerHpChange) this.onPlayerHpChange(this.player.hp);
                              this.masks.splice(i, 1);
                              i--;
                              continue;
                          }
                          m.state = 'flying';
                          if (true) {
    const r = Math.floor(Math.random() * 3) + 1;
    this.playBuffer('attacksound_' + r);
} else {
    this.playSound('boss_attack');
}
                      }
                  }
              }
          }

          // Check projectiles hit
          for (let i = 0; i < this.projectiles.length; i++) {
              const p = this.projectiles[i];
              const pxDist = p.x - hitX;
              const pyDist = p.y - hitY;
              if (Math.sqrt(pxDist*pxDist + pyDist*pyDist) <= hitRadius + p.radius) {
                  p.hp -= 1;
                  this.spawnHitParticles(p.x, p.y, Math.cos(this.player.attackAngle));
                  
                  // Recoil
                  this.player.knockbackTimer = 0.15;
                  this.player.vx = -Math.cos(this.player.attackAngle) * KNOCKBACK_FORCE_PLAYER;
                  this.player.vy = -Math.sin(this.player.attackAngle) * KNOCKBACK_FORCE_PLAYER - 100;
                  if (Math.sin(this.player.attackAngle) > 0.5) {
                      this.player.vy = JUMP_FORCE * 0.9;
                  }
              }
          }
    }

    // --- Enemy AI & Physics ---
    if (this.enemy.hp <= 0 && this.enemy.phase === 2 && this.enemy.state !== 'death_anim_1' && this.enemy.state !== 'death_anim_2' && this.enemy.state !== 'dead' && this.enemy.state !== 'transition_phase3') {
          this.enemy.hp = 0;
          this.enemy.invulnerableTimer = 15.0;
          this.enemy.state = 'death_anim_1';
          this.enemy.stateTimer = 5.0;
          this.enemy.vy = -300; // Small bump up
          this.bossSubtitleText = '"IMPOSSÍVEL... MINHA LUZ..."';
          this.bossSubtitleTimer = 5.0;
          this.screenShakeTimer = 5.0;
          this.screenShakeIntensity = 12;
          this.projectiles = [];
          this.aoes = [];
          this.meteors = [];
          this.masks = [];
          this.playerProjectiles = [];
          if (true) this.playBuffer('destruction_sound', false, 1.0);
          this.notifyHpChange(); 
    }
    
    if (this.enemy.state !== 'hidden' && (this.enemy.hp > 0 || this.enemy.state === 'death_anim_1' || this.enemy.state === 'death_anim_2' || this.enemy.state === 'transition_phase3' || this.enemy.phase === 3)) {
      if (false) {
      } else if (this.enemy.hp <= 375 && this.enemy.phase === 1) {
          this.enemy.phase = 2;
          this.enemy.hp = 375;
          this.notifyHpChange();
          this.enemy.state = 'transition';
          this.lavaDelayTimer = 20.0;
          this.enemy.transitionTimer = 10.0;
          this.enemy.invulnerableTimer = 15.0;
          this.bossSubtitleText = '"THE ANGEL OF DARKNESS AWAKENS"';
          this.bossSubtitleTimer = 10.0;
          this.speakVoiceLine(this.bossSubtitleText, true);
          if (true) {
              this.playBuffer('boss_transition');
          } else {
              this.playSound('boss_attack');
          }
      }

      this.enemy.animTime += dt;
      
      if (this.enemy.state === 'death_anim_2') {
          this.enemy.stateTimer -= dt;
          if (Math.random() < 0.3) {
             this.spawnHitParticles(this.eyeMiniBoss.x + (Math.random()-0.5)*100, this.eyeMiniBoss.y + (Math.random()-0.5)*100, 0);
          }
          if (this.enemy.stateTimer <= 0) {
              this.eyeMiniBoss.hp = 0;
              this.enemy.hp = 0;
              this.enemy.phase = 4;
              this.enemy.state = 'dead';
              this.notifyHpChange(0);
              setTimeout(() => { if (this.onGameOver) this.onGameOver(); }, 2000);
          }
} else if (this.enemy.state === 'death_anim_1') {
          this.enemy.stateTimer -= dt;
          this.enemy.vy += GRAVITY * 0.2 * dt;
          this.enemy.y += this.enemy.vy * dt;
          if (this.enemy.y > FLOOR_Y - 50) this.enemy.y = FLOOR_Y - 50;
          
          if (Math.random() < 0.2) {
             this.spawnHitParticles(this.enemy.x + (Math.random()-0.5)*200, this.enemy.y + (Math.random()-0.5)*200, 0);
          }
          if (this.enemy.stateTimer <= 0) {
              this.enemy.state = 'transition_phase3';
              this.enemy.stateTimer = 3.0;
              this.bossSubtitleText = '"THE EYE OF ANGEL"';
              this.bossSubtitleTimer = 4.0;
              this.player.vy = -500;
          }
      } else if (this.enemy.state === 'transition_phase3') {
          this.enemy.stateTimer -= dt;
          this.player.y -= dt * 100; // Float up
          this.player.vy = 0;
      this.eyeMiniBoss.cooldownTimer = 2.0; // Start attacking quickly
          this.player.invulnerableTimer = 3.0;
          
          if (this.enemy.stateTimer <= 0) {
              this.startPhase3();
          }
      } else if (this.enemy.hp <= 0 && this.enemy.phase === 3 && this.enemy.state !== 'dead_phase3' && this.enemy.state !== 'death_anim_2' && this.enemy.state !== 'dead') {
          this.enemy.hp = 0;
          this.enemy.state = 'dead_phase3';
          this.spawnHitParticles(this.enemy.x, this.enemy.y, 0, 50);
          if (this.eyeMiniBoss.hp <= 0) {
              this.enemy.state = 'death_anim_2';
              this.enemy.stateTimer = 5.0;
              this.bossSubtitleText = '"VERDADE... DESFEITA..."';
              this.bossSubtitleTimer = 5.0;
              this.screenShakeTimer = 5.0;
              this.screenShakeIntensity = 15;
              this.fallingEyes = [];
              this.tentacles = [];
              if (true) this.playBuffer('destruction_sound', false, 1.0);
          }
      } else if (this.enemy.state === 'intro') {
          
          // Slowly descend from -800 to (FLOOR_Y - 150) over 10 seconds
          // Target y = FLOOR_Y - 150 (approx 450). Start y = -800. Distance = 1250. 
          // 1250 / 10 = 125 pixels per second.
          this.enemy.vy = 125; 
          this.enemy.y += this.enemy.vy * dt;
          
          if (this.enemy.y >= FLOOR_Y - 150 || this.enemy.stateTimer <= 0) {
              this.enemy.y = FLOOR_Y - 150;
              this.enemy.vy = 0;
              this.enemy.state = 'intro_landing';
              this.enemy.stateTimer = 3.0; // Rest after landing
              this.bossSubtitleText = "THE FALLEN ANGEL DESCENDS";
              this.bossSubtitleTimer = 3.0;
              this.speakVoiceLine(this.bossSubtitleText, false);
              
              // Removed intro sound
              
              // Big impact explosion
              this.aoes.push({
                  type: 'holy_nova',
                  x: this.enemy.x, y: FLOOR_Y, radius: 600, 
                  timer: 0.05, maxTimer: 0.05 // Explode almost instantly
              });
              
              // Screen shake logic (we can just add a simple knockback to player if close)
              if (Math.abs(this.player.x - this.enemy.x) < 500) {
                  this.player.vx = Math.sign(this.player.x - this.enemy.x) * 1500;
                  this.player.vy = -600;
              }
          }
      } else if (this.enemy.state === 'intro_landing') {
          this.enemy.vx = 0;
          if (this.enemy.stateTimer <= 0) {
              this.enemy.state = 'idle';
              this.enemy.stateTimer = 2.0;
              if (this.onIntroFinish) this.onIntroFinish();
          }
      } else if (this.enemy.state === 'transition') {
          // move to center
          this.enemy.vx = (ROOM_WIDTH / 2 - this.enemy.x) * 2;
          this.enemy.vy = (FLOOR_Y - 300 - this.enemy.y) * 2;
          if (this.enemy.transitionTimer <= 0) {
              this.enemy.state = 'idle';
                    this.enemy.stateTimer = this.enemy.phase === 3 ? 2.5 : (this.enemy.phase === 2 ? 4.5 : 4.0);
              // Push player back
              this.player.vx = -1000;
              this.player.vy = -500;
              this.playSound('hit');
              // Create massive knockback blast
              this.aoes.push({
                  type: 'abyssal_nova',
                  x: this.enemy.x, y: this.enemy.y,
                  radius: 800, timer: 1.0, maxTimer: 1.0
              });
          }
      }

      if (this.enemy.state !== 'transition') {
          if (this.enemy.knockbackTimer > 0) {
              this.enemy.vy += GRAVITY * dt;
      } else {
         if (this.enemy.state === 'idle') {
             const dist = this.player.x - this.enemy.x;
             this.enemy.vx = Math.sign(dist) * (this.enemy.phase >= 2 ? MOVE_SPEED * 0.05 : MOVE_SPEED * 0.3);
             this.enemy.facingRight = dist > 0;
             
             const targetY = (this.enemy.phase === 3 ? FLOOR_Y - 450 : FLOOR_Y - 200) + Math.sin(this.enemy.animTime * 2) * 20;
             this.enemy.vy = (targetY - this.enemy.y) * 4; // Smooth approach and bob
             
             if (this.enemy.stateTimer <= 0) {
                 const attacksP1 = [
                     { state: 'divine_light', text: '"BEHOLD MY LIGHT!"' },
                     { state: 'heavens_break', text: '"CRUMBLE BENEATH HEAVEN!"' },
                     { state: 'meteor_shower', text: '"RAIN OF STARS!"' },
                     { state: 'holy_nova', text: '"REPENT!"' },
                     { state: 'holy_cross', text: '"THE CROSS JUDGES YOU!"' },
                     { state: 'smite', text: '"DIVINE WRATH!"' }
                 ];
                 const attacksP2 = [
                     { state: 'blood_rain', text: '"BLEED FROM THE SKY!"' },
                     { state: 'void_gaze', text: '"I SEE EVERYTHING!"' },
                     { state: 'abyssal_nova', text: '"EMBRACE THE DARK!"' },
                     { state: 'shadow_strike', text: '"PERISH!"' }
                 ];
                 const attacks = this.enemy.phase >= 2 ? attacksP2 : attacksP1;
                 const chosen = attacks[Math.floor(Math.random() * attacks.length)];
                 this.enemy.nextState = chosen.state;
                 this.enemy.nextStateText = chosen.text;
                 this.enemy.state = 'teleport';
                 this.enemy.teleportTimer = 1.0;
                 this.enemy.teleportTargetX = Math.max(300, Math.min(ROOM_WIDTH - 300, this.player.x + (Math.random() > 0.5 ? 400 : -400)));
                 this.enemy.teleportTargetY = this.enemy.phase === 3 ? FLOOR_Y - 450 - Math.random() * 100 : FLOOR_Y - 300 - Math.random() * 200;
                 if (true) this.playBuffer('destruction_sound', false, 0.5); // Teleport sound
             }
         } else if (this.enemy.state === 'dead_phase3') {
             this.enemy.scale = (this.enemy.scale === undefined ? 1 : this.enemy.scale) - dt * 1.5;
             if (this.enemy.scale < 0) this.enemy.scale = 0;
             this.enemy.vx = 0;
             this.enemy.vy += GRAVITY * 0.2 * dt;
             if (this.enemy.y > FLOOR_Y - 50) {
                 this.enemy.y = FLOOR_Y - 50;
                 this.enemy.vy = 0;
             }
             if (this.eyeMiniBoss.hp <= 0) {
                 this.enemy.state = 'death_anim_2';
                 this.enemy.stateTimer = 5.0;
                 this.bossSubtitleText = '"VERDADE... DESFEITA..."';
                 this.bossSubtitleTimer = 5.0;
                 this.screenShakeTimer = 5.0;
                 this.screenShakeIntensity = 15;
                 this.fallingEyes = [];
                 this.tentacles = [];
                 if (true) this.playBuffer('destruction_sound', false, 1.0);
             }
         } else if (this.enemy.state === 'teleport') {
             this.enemy.teleportTimer -= dt;
             // Boss fades out in first 0.5s, moves, fades in next 0.5s
             if (this.enemy.teleportTimer <= 0.5 && this.enemy.teleportTimer + dt > 0.5) {
                 this.enemy.x = this.enemy.teleportTargetX;
                 this.enemy.y = this.enemy.teleportTargetY;
             }
             if (this.enemy.teleportTimer <= 0) {
                 this.enemy.state = this.enemy.nextState;
                 this.bossSubtitleText = this.enemy.nextStateText;
                 this.bossSubtitleTimer = 1.5;
                 this.speakVoiceLine(this.bossSubtitleText, this.enemy.phase === 2);
                 this.enemy.stateTimer = this.enemy.phase === 3 ? 2.5 : 2.5;
                 this.enemy.attackStep = 0;
             }
         } else if (this.enemy.state === 'holy_nova') {
             if (this.enemy.attackStep === 0) {
                 this.enemy.vx = 0;
                 this.enemy.vy = 0;
                 if (this.bossSubtitleTimer <= 0) {
                     this.enemy.attackStep = 1;
                     this.enemy.vy = -400; // Go up
                     this.enemy.attackTargetY = FLOOR_Y - 350; // Hover height
                 }
             } else if (this.enemy.attackStep === 1) {
                 if (this.enemy.y <= this.enemy.attackTargetY) {
                     this.enemy.y = this.enemy.attackTargetY;
                     this.enemy.vy = 0;
                     this.enemy.vx = 0;
                     this.enemy.attackStep = 2;
                     this.enemy.stateTimer = 2.0; // Charge up time
                     if (true) {
    const r = Math.floor(Math.random() * 3) + 1;
    this.playBuffer('attacksound_' + r);
} else {
    this.playSound('boss_attack');
}
                     
                     // Create visual charge-up AoE (doesn't damage directly, just for visuals/warning)
                     this.aoes.push({
                         type: 'holy_nova',
                         x: this.enemy.x, y: this.enemy.y,
                         radius: 300, timer: 2.0, maxTimer: 2.0
                     });
                 }
             } else if (this.enemy.attackStep === 2) {
                 if (this.enemy.stateTimer <= 0) {
                     this.enemy.attackStep = 3;
                     this.playSound('hit'); // explosion sound
                     // Release 30 projectiles
                     for (let i = 0; i < 30; i++) {
                         const angle = Math.random() * Math.PI * 2;
                         const speed = 200 + Math.random() * 200;
                         this.projectiles.push({
                             type: 'blast',
                             color: '#bae6fd', // blue/yellowish
                             x: this.enemy.x,
                             y: this.enemy.y,
                             vx: Math.cos(angle) * speed,
                             vy: Math.sin(angle) * speed,
                             radius: 10, hp: 1, life: 5
                         });
                     }
                     this.enemy.stateTimer = 1.0;
                 }
             } else if (this.enemy.attackStep === 3) {
                 if (this.enemy.stateTimer <= 0) {
                     this.enemy.state = 'idle';
                    this.enemy.stateTimer = this.enemy.phase >= 2 ? 4.5 : 4.0;
                 }
             }
         } else if (this.enemy.state === 'stunned') {
             this.enemy.vx = 0;
             this.enemy.vy = 0;
             if (this.enemy.stateTimer <= 0) {
                 this.enemy.state = 'idle';
                 this.enemy.stateTimer = this.enemy.phase >= 2 ? 4.5 : 4.0;
             }
         } else if (this.enemy.state === 'divine_light') {
             if (this.enemy.attackStep === 0) {
                 this.enemy.vx = 0;
                 this.enemy.vy = 0;
                 if (this.bossSubtitleTimer <= 0) {
                     this.enemy.attackStep = 1; // marked as initialized
                     if (true) {
    const r = Math.floor(Math.random() * 3) + 1;
    this.playBuffer('attacksound_' + r);
} else {
    this.playSound('boss_attack');
}
                     this.screenShakeTimer = 0.3;
                     this.screenShakeIntensity = 12;
                     const numProj = 7 + Math.floor(Math.random() * 8); // 7 to 14 projectiles
                     for (let i = 0; i < numProj; i++) {
                         const angle = -Math.PI/2 + (Math.random() - 0.5) * Math.PI; 
                         this.projectiles.push({
                             x: this.enemy.x, y: this.enemy.y,
                             vx: Math.cos(angle) * 300, vy: Math.sin(angle) * 300,
                             radius: 12, hp: 1, life: 5
                         });
                     }
                 }
             }
             this.enemy.vx = 0;
             if (this.enemy.stateTimer <= 0) {
                 this.enemy.state = 'idle';
                    this.enemy.stateTimer = this.enemy.phase >= 2 ? 4.5 : 4.0;
             }
         } else if (this.enemy.state === 'heavens_break') {
             if (this.enemy.attackStep === 0) {
                 this.enemy.vx = 0;
                 this.enemy.vy = 0;
                 if (this.bossSubtitleTimer <= 0) {
                     this.enemy.attackStep = 1;
                     if (true) {
    const r = Math.floor(Math.random() * 3) + 1;
    this.playBuffer('attacksound_' + r);
} else {
    this.playSound('boss_attack');
}
                     this.enemy.attackTargetX = this.player.x;
                     this.enemy.vx = 0;
                     this.enemy.vy = 0;
                     this.enemy.stateTimer = 0.5; // wind up
                 }
             } else if (this.enemy.attackStep === 1) {
                 if (this.enemy.stateTimer <= 0) {
                     this.enemy.attackStep = 2;
                     if (true) {
    const r = Math.floor(Math.random() * 3) + 1;
    this.playBuffer('attacksound_' + r);
} else {
    this.playSound('boss_attack');
}
                     // create blast
                     this.aoes.push({
                         type: 'heavens_break',
                         x: this.enemy.attackTargetX, y: FLOOR_Y,
                         radius: 250, timer: 2.0, maxTimer: 2.0 // 2 seconds explosion
                     });
                     this.enemy.stateTimer = 2.0; // wait for explosion
                 }
             } else if (this.enemy.attackStep === 2) {
                 if (this.enemy.stateTimer <= 0) {
                     this.enemy.state = 'idle';
                    this.enemy.stateTimer = this.enemy.phase >= 2 ? 4.5 : 4.0;
                 }
             }
         } else if (this.enemy.state === 'meteor_shower') {
             if (this.enemy.attackStep === 0) {
                 this.enemy.vx = 0;
                 this.enemy.vy = 0;
                 if (this.bossSubtitleTimer <= 0) {
                     this.enemy.attackStep = 1; // initialized
                     if (true) {
    const r = Math.floor(Math.random() * 3) + 1;
    this.playBuffer('attacksound_' + r);
} else {
    this.playSound('boss_attack');
}
                     for (let i = 0; i < 15; i++) {
                         this.meteors.push({
                             x: Math.random() * ROOM_WIDTH,
                             y: -Math.random() * 1000 - 200,
                             vx: (Math.random() - 0.5) * 50,
                             vy: 150 + Math.random() * 150,
                             radius: 15 + Math.random() * 10, exploded: false
                         });
                     }
                 }
             }
             this.enemy.vx = 0;
             if (this.enemy.stateTimer <= 0) {
                 this.enemy.state = 'idle';
                    this.enemy.stateTimer = this.enemy.phase >= 2 ? 4.5 : 4.0;
             }
         } else if (this.enemy.state === 'blood_rain') {
             if (this.enemy.attackStep === 0) {
                 this.enemy.vx = 0;
                 this.enemy.vy = 0;
                 if (this.bossSubtitleTimer <= 0) {
                     this.enemy.attackStep = 1; // initialized
                     if (true) {
    const r = Math.floor(Math.random() * 3) + 1;
    this.playBuffer('attacksound_' + r);
} else {
    this.playSound('boss_attack');
}
                     for (let i = 0; i < 30; i++) {
                         this.projectiles.push({
                             type: 'blood',
                             x: Math.random() * ROOM_WIDTH,
                             y: -Math.random() * 1000 - 200,
                             vx: 0,
                             vy: 600 + Math.random() * 200,
                             radius: 12, hp: 1, life: 5
                         });
                     }
                 }
             }
             this.enemy.vx = 0;
             if (this.enemy.stateTimer <= 0) {
                 this.enemy.state = 'idle';
                    this.enemy.stateTimer = this.enemy.phase >= 2 ? 4.5 : 4.0;
             }
         } else if (this.enemy.state === 'void_gaze') {
             if (this.enemy.attackStep === 0) {
                 this.enemy.vx = 0;
                 this.enemy.vy = 0;
                 if (this.bossSubtitleTimer <= 0) {
                     this.enemy.attackStep = 1;
                     this.enemy.stateTimer = 1.0;
                 }
             } else if (this.enemy.attackStep >= 1 && this.enemy.attackStep <= 3) {
                 if (this.enemy.stateTimer <= 0) {
                     if (true) {
    const r = Math.floor(Math.random() * 3) + 1;
    this.playBuffer('attacksound_' + r);
} else {
    this.playSound('boss_attack');
}
                     this.aoes.push({
                         type: 'heavens_break', // Reusing visuals but we can change color in draw
                         x: this.player.x, y: FLOOR_Y,
                         radius: 150, timer: 1.0, maxTimer: 1.0
                     });
                     this.enemy.attackStep++;
                     this.enemy.stateTimer = 1.5;
                 }
             } else if (this.enemy.attackStep === 4) {
                 if (this.enemy.stateTimer <= 0) {
                     this.enemy.state = 'idle';
                    this.enemy.stateTimer = this.enemy.phase >= 2 ? 4.5 : 4.0;
                 }
             }
         } else if (this.enemy.state === 'abyssal_nova') {
             if (this.enemy.attackStep === 0) {
                 this.enemy.vx = 0;
                 this.enemy.vy = 0;
                 if (this.bossSubtitleTimer <= 0) {
                     this.enemy.attackStep = 1;
                     this.enemy.vy = -600; // Go up fast
                     this.enemy.attackTargetY = FLOOR_Y - 350; // Hover height
                 }
             } else if (this.enemy.attackStep === 1) {
                 if (this.enemy.y <= this.enemy.attackTargetY) {
                     this.enemy.y = this.enemy.attackTargetY;
                     this.enemy.vy = 0;
                     this.enemy.vx = 0;
                     this.enemy.attackStep = 2;
                     this.enemy.stateTimer = 0.5; // very fast wind up
                 }
             } else if (this.enemy.attackStep === 2) {
                 if (this.enemy.stateTimer <= 0) {
                     this.enemy.attackStep = 3;
                     this.playSound('hit'); // explosion sound
                     this.aoes.push({
                         type: 'abyssal_nova',
                         x: this.enemy.x, y: this.enemy.y,
                         radius: 1200, timer: 0.8, maxTimer: 0.8
                     });
                     for (let i = 0; i < 40; i++) {
                         const angle = Math.random() * Math.PI * 2;
                         const speed = 400 + Math.random() * 300;
                         this.projectiles.push({
                             type: 'blast',
                             color: '#991b1b', // dark red
                             x: this.enemy.x,
                             y: this.enemy.y,
                             vx: Math.cos(angle) * speed,
                             vy: Math.sin(angle) * speed,
                             radius: 10, hp: 1, life: 5
                         });
                     }
                     this.enemy.stateTimer = 1.0;
                 }
             } else if (this.enemy.attackStep === 3) {
                 if (this.enemy.stateTimer <= 0) {
                     this.enemy.state = 'idle';
                    this.enemy.stateTimer = this.enemy.phase >= 2 ? 4.5 : 4.0;
                 }
             }

         } else if (this.enemy.state === 'shadow_strike') {
             if (this.enemy.attackStep === 0) {
                 this.enemy.vx = 0;
                 this.enemy.vy = 0;
                 if (this.bossSubtitleTimer <= 0) {
                     this.enemy.attackStep = 1;
                     this.enemy.vy = -800;
                     this.enemy.attackTargetY = -200; // Off screen
                 }
             } else if (this.enemy.attackStep === 1) {
                 if (this.enemy.y <= this.enemy.attackTargetY) {
                     this.enemy.vy = 0;
                     this.enemy.x = this.player.x;
                     this.enemy.attackStep = 2;
                     this.enemy.stateTimer = 0.5;
                 }
             } else if (this.enemy.attackStep === 2) {
                 this.enemy.x = this.player.x; // Track player
                 if (this.enemy.stateTimer <= 0) {
                     this.enemy.attackStep = 3;
                     this.enemy.vy = 1500; // Dive down
                     if (true) {
    const r = Math.floor(Math.random() * 3) + 1;
    this.playBuffer('attacksound_' + r);
} else {
    this.playSound('boss_attack');
}
                 }
             } else if (this.enemy.attackStep === 3) {
                 if (this.enemy.y >= FLOOR_Y - 150) {
                     this.enemy.y = FLOOR_Y - 150;
                     this.enemy.vy = 0;
                     this.playSound('hit');
                     this.aoes.push({
                         type: 'heavens_break',
                         x: this.enemy.x, y: FLOOR_Y,
                         radius: 300, timer: 1.0, maxTimer: 1.0
                     });
                     this.enemy.attackStep = 4;
                     this.enemy.stateTimer = 1.0;
                 }
             } else if (this.enemy.attackStep === 4) {
                 if (this.enemy.stateTimer <= 0) {
                     this.enemy.state = 'idle';
                    this.enemy.stateTimer = this.enemy.phase >= 2 ? 4.5 : 4.0;
                 }
             }
         } else if (this.enemy.state === 'holy_cross') {
             if (this.enemy.attackStep === 0) {
                 this.enemy.vx = 0;
                 this.enemy.vy = 0;
                 if (this.bossSubtitleTimer <= 0) {
                     this.enemy.attackStep = 1;
                     this.enemy.stateTimer = 1.0;
                     if (true) {
    const r = Math.floor(Math.random() * 3) + 1;
    this.playBuffer('attacksound_' + r);
} else {
    this.playSound('boss_attack');
}
                     // horizontal laser
                     this.aoes.push({
                         type: 'laser_h',
                         x: 0, y: this.enemy.y,
                         width: ROOM_WIDTH, height: 100,
                         timer: 1.0, maxTimer: 1.0
                     });
                     // vertical laser
                     this.aoes.push({
                         type: 'laser_v',
                         x: this.enemy.x, y: 0,
                         width: 100, height: ROOM_HEIGHT,
                         timer: 1.0, maxTimer: 1.0
                     });
                 }
             } else if (this.enemy.attackStep === 1) {
                 if (this.enemy.stateTimer <= 0) {
                     this.enemy.state = 'idle';
                    this.enemy.stateTimer = this.enemy.phase >= 2 ? 4.5 : 4.0;
                 }
             }
         } else if (this.enemy.state === 'smite') {
             if (this.enemy.attackStep === 0) {
                 this.enemy.vx = 0;
                 this.enemy.vy = 0;
                 if (this.bossSubtitleTimer <= 0) {
                     this.enemy.attackStep = 1;
                     this.enemy.stateTimer = 0.5;
                 }
             } else if (this.enemy.attackStep >= 1 && this.enemy.attackStep <= 5) {
                 if (this.enemy.stateTimer <= 0) {
                     if (true) {
    const r = Math.floor(Math.random() * 3) + 1;
    this.playBuffer('attacksound_' + r);
} else {
    this.playSound('boss_attack');
}
                     this.screenShakeTimer = 0.2;
                     this.screenShakeIntensity = 10;
                     this.aoes.push({
                         type: 'heavens_break', // Reusing visuals
                         x: this.player.x, y: FLOOR_Y,
                         radius: 100, timer: 0.5, maxTimer: 0.5
                     });
                     this.enemy.attackStep++;
                     this.enemy.stateTimer = 0.8;
                 }
             } else if (this.enemy.attackStep === 6) {
                 if (this.enemy.stateTimer <= 0) {
                     this.enemy.state = 'idle';
                    this.enemy.stateTimer = this.enemy.phase >= 2 ? 4.5 : 4.0;
                 }
             }
         }

      }
      }

      this.enemy.x += this.enemy.vx * dt;
      this.enemy.y += this.enemy.vy * dt;

      if (isNaN(this.enemy.x)) {
          this.enemy.x = ROOM_WIDTH / 2;
          this.enemy.vx = 0;
      }
      if (isNaN(this.enemy.y)) {
          this.enemy.y = FLOOR_Y - 200;
          this.enemy.vy = 0;
      }
      if (this.enemy.phase === 3) {
          // In phase 3, enemy is dead, skip normal AI
          // Wait, the eyeMiniBoss logic is right after this, so we should let it run
      }
      
      if (this.enemy.y > FLOOR_Y - 50) {
          this.enemy.y = FLOOR_Y - 50;
          this.enemy.vy = 0;
      }

      if (this.enemy.x < this.enemy.width / 2) this.enemy.x = this.enemy.width / 2;
      if (this.enemy.x > ROOM_WIDTH - this.enemy.width / 2) this.enemy.x = ROOM_WIDTH - this.enemy.width / 2;

      // Phase 3 Falling Eyes
      if (this.enemy.phase === 3) {
          this.phase3EyeSpawnTimer -= dt;
          if (this.phase3EyeSpawnTimer <= 0) {
              this.phase3EyeSpawnTimer = 20.0;
              const numEyes = 6 + Math.floor(Math.random() * 5); // 6 to 10
              for (let i = 0; i < numEyes; i++) {
                  const angle = Math.random() * Math.PI * 2;
                  this.fallingEyes.push({
                      x: ROOM_WIDTH / 2, // portal center
                      y: ROOM_HEIGHT / 2 - 100,
                      vx: Math.cos(angle) * 200,
                      vy: Math.sin(angle) * 200,
                      targetTimer: 1.0 // wait 1s before chasing
                  });
              }
              if (true) {
                 const r = Math.floor(Math.random() * 3) + 1;
                 this.playBuffer('attacksound_' + r);
              }
          }
          
          for (let i = this.fallingEyes.length - 1; i >= 0; i--) {
              const eye = this.fallingEyes[i];
              eye.targetTimer -= dt;
              if (eye.targetTimer > 0) {
                  eye.vy += GRAVITY * 0.1 * dt;
              } else {
                  const dx = this.player.x - eye.x;
                  const dy = this.player.y - eye.y;
                  const dist = Math.hypot(dx, dy) + 1;
                  eye.vx += (dx / dist) * 800 * dt;
                  eye.vy += (dy / dist) * 800 * dt;
                  const speed = Math.hypot(eye.vx, eye.vy);
                  if (speed > 350) {
                      eye.vx = (eye.vx / speed) * 350;
                      eye.vy = (eye.vy / speed) * 350;
                  }
              }
              eye.x += eye.vx * dt;
              eye.y += eye.vy * dt;
              
              const dx = this.player.x - eye.x;
              const dy = this.player.y - eye.y;
              if (Math.hypot(dx, dy) < 40 && this.player.invulnerableTimer <= 0 && this.player.intangibleTimer <= 0) {
                  if (this.player.healingTimer <= 0) {
                      this.player.hp -= 1; this.hitEffectTimer = 0.5; this.screenShakeTimer = 0.2; this.screenShakeIntensity = 8;
                      this.player.invulnerableTimer = 3.0;
                      this.playSound('player_hit');
                      if (this.onPlayerHpChange) this.onPlayerHpChange(this.player.hp);
                  }
                  this.fallingEyes.splice(i, 1);
                  continue;
              }
              if (eye.y > ROOM_HEIGHT + 200 || eye.x < -200 || eye.x > ROOM_WIDTH + 200) {
                  this.fallingEyes.splice(i, 1);
              }
          }
      }
      
      // Eye Mini Boss Dead Physics
      if (this.eyeMiniBoss.state === 'dead') {
          this.eyeMiniBoss.scale = (this.eyeMiniBoss.scale === undefined ? 1 : this.eyeMiniBoss.scale) - dt * 1.5;
          if (this.eyeMiniBoss.scale < 0) this.eyeMiniBoss.scale = 0;
          this.eyeMiniBoss.y += GRAVITY * 0.2 * dt;
      }

      // Eye Mini Boss Logic
      if (this.enemy.phase === 3 && this.eyeMiniBoss.hp > 0 && this.phase3Active) {
          if (this.eyeMiniBoss.invulnerableTimer > 0) this.eyeMiniBoss.invulnerableTimer -= dt;
          

          
          if (!this.eyeMiniBoss.isActive) {
              this.eyeMiniBoss.cooldownTimer -= dt * 1.5;
              // slowly return to center/top
              this.eyeMiniBoss.x += (ROOM_WIDTH / 2 - this.eyeMiniBoss.x) * 2 * dt;
              this.eyeMiniBoss.y += (FLOOR_Y - 500 - this.eyeMiniBoss.y) * 2 * dt;
              
              if (this.eyeMiniBoss.cooldownTimer <= 0) {
                  this.eyeMiniBoss.isActive = true;
                  this.eyeMiniBoss.attackType = Math.floor(Math.random() * 6);
                  
                  if (this.eyeMiniBoss.attackType === 0) {
                      this.eyeMiniBoss.state = 'tentacles_prepare';
                      this.eyeMiniBoss.attackTimer = 1.0;
                      this.tentacles = [
                          { x: ROOM_WIDTH * 0.15, baseY: FLOOR_Y + 50, timeOffset: 0 },
                          { x: ROOM_WIDTH * 0.5, baseY: FLOOR_Y + 50, timeOffset: Math.PI / 2 },
                          { x: ROOM_WIDTH * 0.85, baseY: FLOOR_Y + 50, timeOffset: Math.PI }
                      ];
                      this.bossSubtitleText = '"THE DEPTHS AWAKEN"';
                      this.bossSubtitleTimer = 3.0;
                  } else if (this.eyeMiniBoss.attackType === 1) {
                      this.eyeMiniBoss.state = 'suck_move';
                      this.eyeMiniBoss.targetX = Math.random() > 0.5 ? 200 : ROOM_WIDTH - 200;
                      this.eyeMiniBoss.targetY = FLOOR_Y - 200;
                      this.eyeMiniBoss.attackTimer = 1.0; // Time to move
                  } else if (this.eyeMiniBoss.attackType === 2) {
                      this.eyeMiniBoss.state = 'laser_move';
                      this.eyeMiniBoss.targetX = Math.random() > 0.5 ? 200 : ROOM_WIDTH - 200;
                      this.eyeMiniBoss.targetY = 50;
                      this.eyeMiniBoss.side = this.eyeMiniBoss.targetX < ROOM_WIDTH / 2 ? 1 : -1;
                      this.eyeMiniBoss.attackTimer = 1.0; // Time to move
                  } else if (this.eyeMiniBoss.attackType === 3) {
                      this.eyeMiniBoss.state = 'judgment_move';
                      this.eyeMiniBoss.targetX = ROOM_WIDTH / 2;
                      this.eyeMiniBoss.targetY = 50;
                      this.eyeMiniBoss.attackTimer = 1.0;
                      this.judgmentLasers = [];
                      for (let i = 0; i < 5; i++) {
                          this.judgmentLasers.push({
                              x: this.eyeMiniBoss.x, y: this.eyeMiniBoss.y,
                              targetX: (ROOM_WIDTH / 5) * i + 100, targetY: FLOOR_Y,
                              sweepSpeed: (i % 2 === 0 ? 1 : -1) * (300 + Math.random() * 300)
                          });
                      }
                      this.bossSubtitleText = '"JULGAMENTO"';
                      this.bossSubtitleTimer = 2.0;
                  } else if (this.eyeMiniBoss.attackType === 4) {
                      this.eyeMiniBoss.state = 'invocation_lock';
                      this.eyeMiniBoss.attackTimer = 5.0;
                      this.bossSubtitleText = '"PRESO NA CARNE"';
                      this.bossSubtitleTimer = 2.0;
                  } else if (this.eyeMiniBoss.attackType === 5) {
                      this.eyeMiniBoss.state = 'wall_tentacles';
                      this.eyeMiniBoss.attackTimer = 10.0;
                      this.wallTentacles = [
                          {side: -1, y: FLOOR_Y - 200, state: 'extend', timer: 1, maxTimer: 1},
                          {side: 1, y: FLOOR_Y - 400, state: 'extend', timer: 1, maxTimer: 1}
                      ];
                      this.bossSubtitleText = '"RAÍZES DO ABISMO"';
                      this.bossSubtitleTimer = 2.0;
                  }
                  this.playBuffer('attacksound_' + (Math.floor(Math.random() * 3) + 1));
              }
          } else {
              if (this.eyeMiniBoss.state === 'tentacles_prepare') {
                  this.eyeMiniBoss.attackTimer -= dt;
                  if (this.eyeMiniBoss.attackTimer <= 0) {
                      this.eyeMiniBoss.state = 'tentacles_active';
                      this.eyeMiniBoss.attackTimer = 6.0;
                  }
              } else if (this.eyeMiniBoss.state === 'tentacles_active') {
                  this.eyeMiniBoss.attackTimer -= dt;
                  if (this.eyeMiniBoss.attackTimer <= 0) {
                      this.eyeMiniBoss.isActive = false;
                      this.eyeMiniBoss.state = 'idle';
                      this.eyeMiniBoss.cooldownTimer = 1.0; // Wait 3s before next attack
                      this.tentacles = [];
                  }
              } else if (this.eyeMiniBoss.state === 'suck_move') {
                  this.eyeMiniBoss.x += (this.eyeMiniBoss.targetX - this.eyeMiniBoss.x) * 5 * dt;
                  this.eyeMiniBoss.y += (this.eyeMiniBoss.targetY - this.eyeMiniBoss.y) * 5 * dt;
                  this.eyeMiniBoss.attackTimer -= dt;
                  if (this.eyeMiniBoss.attackTimer <= 0) {
                      this.eyeMiniBoss.state = 'sucking';
                      this.eyeMiniBoss.attackTimer = 3.0; // Suck for 3s
                      this.bossSubtitleText = '"CONSUME"';
                      this.bossSubtitleTimer = 2.0;
                      this.screenShakeTimer = 3.0;
                      this.screenShakeIntensity = 5;
                  }
              } else if (this.eyeMiniBoss.state === 'sucking') {
                  this.eyeMiniBoss.attackTimer -= dt;
                  const dx = this.eyeMiniBoss.x - this.player.x;
                  const dy = this.eyeMiniBoss.y - this.player.y;
                  const dist = Math.hypot(dx, dy);
                  if (dist > 0 && dist < 2000) {
                      // Instead of using vx/vy which gets overridden by movement keys, directly drag the player position!
                      const pullSpeed = Math.max(150, 700 - dist * 0.2); // Stronger pull when closer
                      this.player.x += (dx / dist) * pullSpeed * dt;
                      this.player.y += (dy / dist) * pullSpeed * dt;
                  }
                  
                  // Damage player if they touch the mouth
                  if (Math.abs(dx) < 120 && Math.abs(this.player.y - this.eyeMiniBoss.y) < 120 && this.player.invulnerableTimer <= 0 && this.player.intangibleTimer <= 0) {
                      if (this.player.healingTimer <= 0) {
                          this.player.hp -= 1; this.hitEffectTimer = 0.5; this.screenShakeTimer = 0.2; this.screenShakeIntensity = 12;
                          this.player.invulnerableTimer = 3.0;
                          this.playSound('player_hit');
                          if (this.onPlayerHpChange) this.onPlayerHpChange(this.player.hp);
                          
                          this.player.vx = -Math.sign(dx) * 1000;
                          this.player.vy = -Math.sign(dy) * 1000;
                      }
                  }
                  
                  if (this.eyeMiniBoss.attackTimer <= 0) {
                      this.eyeMiniBoss.isActive = false;
                      this.eyeMiniBoss.state = 'idle';
                      this.eyeMiniBoss.cooldownTimer = 1.5;
                  }
              } else if (this.eyeMiniBoss.state === 'laser_move') {
                  this.eyeMiniBoss.x += (this.eyeMiniBoss.targetX - this.eyeMiniBoss.x) * 6 * dt;
                  this.eyeMiniBoss.y += (this.eyeMiniBoss.targetY - this.eyeMiniBoss.y) * 6 * dt;
                  this.eyeMiniBoss.attackTimer -= dt;
                  if (this.eyeMiniBoss.attackTimer <= 0) {
                      this.eyeMiniBoss.state = 'laser_fire';
                      this.eyeMiniBoss.attackTimer = 1.5; // Shoot for 1.5s
                      this.screenShakeTimer = 1.5;
                      this.screenShakeIntensity = 15;
                  }
              } else if (this.eyeMiniBoss.state === 'laser_fire') {
                  this.eyeMiniBoss.attackTimer -= dt;
                  
                  // Beam logic
                  const sweepProgress = 1.0 - (this.eyeMiniBoss.attackTimer / 1.5);
                  const startAngle = this.eyeMiniBoss.side === 1 ? Math.PI * 0.6 : Math.PI * 0.4;
                  const endAngle = this.eyeMiniBoss.side === 1 ? Math.PI * 0.1 : Math.PI * 0.9;
                  const angle = startAngle + (endAngle - startAngle) * sweepProgress;
                  const lx = Math.cos(angle);
                  const ly = Math.sin(angle);
                  const px = this.player.x - this.eyeMiniBoss.x;
                  const py = this.player.y - this.eyeMiniBoss.y;
                  const projLength = px * lx + py * ly;
                  if (projLength > 0) {
                      const d2Line = Math.abs(-ly * px + lx * py);
                      if (d2Line < 80 && this.player.invulnerableTimer <= 0 && this.player.intangibleTimer <= 0) {
                          if (this.player.healingTimer <= 0) {
                              this.player.hp -= 1; this.hitEffectTimer = 0.5; this.screenShakeTimer = 0.2; this.screenShakeIntensity = 12;
                              this.player.invulnerableTimer = 3.0;
                              this.playSound('player_hit');
                              if (this.onPlayerHpChange) this.onPlayerHpChange(this.player.hp);
                          }
                      }
                  }
                  
                  if (this.eyeMiniBoss.attackTimer <= 0) {
                      this.eyeMiniBoss.isActive = false;
                      this.eyeMiniBoss.state = 'idle';
                      this.eyeMiniBoss.cooldownTimer = 0.5;
                  }
              } else if (this.eyeMiniBoss.state === 'judgment_move') {
                  this.eyeMiniBoss.x += (this.eyeMiniBoss.targetX - this.eyeMiniBoss.x) * 6 * dt;
                  this.eyeMiniBoss.y += (this.eyeMiniBoss.targetY - this.eyeMiniBoss.y) * 6 * dt;
                  this.eyeMiniBoss.attackTimer -= dt;
                  if (this.eyeMiniBoss.attackTimer <= 0) {
                      this.eyeMiniBoss.state = 'judgment_prepare';
                      this.eyeMiniBoss.attackTimer = 1.5;
                  }
                  for (const laser of this.judgmentLasers) {
                      laser.x = this.eyeMiniBoss.x;
                      laser.y = this.eyeMiniBoss.y;
                  }
              } else if (this.eyeMiniBoss.state === 'judgment_prepare') {
                  this.eyeMiniBoss.attackTimer -= dt;
                  for (const laser of this.judgmentLasers) {
                      laser.x = this.eyeMiniBoss.x;
                      laser.y = this.eyeMiniBoss.y;
                      laser.targetX += laser.sweepSpeed * dt;
                      if (laser.targetX < 0) laser.sweepSpeed *= -1;
                      if (laser.targetX > ROOM_WIDTH) laser.sweepSpeed *= -1;
                  }
                  if (this.eyeMiniBoss.attackTimer <= 0) {
                      this.eyeMiniBoss.state = 'judgment_fire';
                      this.eyeMiniBoss.attackTimer = 1.0;
                      this.screenShakeTimer = 1.0;
                      this.screenShakeIntensity = 10;
                  }
              } else if (this.eyeMiniBoss.state === 'judgment_fire') {
                  this.eyeMiniBoss.attackTimer -= dt;
                  for (const laser of this.judgmentLasers) {
                      laser.x = this.eyeMiniBoss.x;
                      laser.y = this.eyeMiniBoss.y;
                      laser.targetX += laser.sweepSpeed * dt;
                      if (laser.targetX < 0) laser.sweepSpeed *= -1;
                      if (laser.targetX > ROOM_WIDTH) laser.sweepSpeed *= -1;
                  }
                  
                  for (const laser of this.judgmentLasers) {
                      const angle = Math.atan2(laser.targetY - laser.y, laser.targetX - laser.x);
                      const lx = Math.cos(angle);
                      const ly = Math.sin(angle);
                      const px = this.player.x - this.eyeMiniBoss.x;
                      const py = this.player.y - this.eyeMiniBoss.y;
                      const projLength = px * lx + py * ly;
                      if (projLength > 0) {
                          const d2Line = Math.abs(-ly * px + lx * py);
                          if (d2Line < 40 && this.player.invulnerableTimer <= 0 && this.player.intangibleTimer <= 0) {
                              if (this.player.healingTimer <= 0) {
                                  this.player.hp -= 1; this.hitEffectTimer = 0.5; this.screenShakeTimer = 0.2; this.screenShakeIntensity = 10;
                                  this.player.invulnerableTimer = 3.0;
                                  this.playSound('player_hit');
                                  if (this.onPlayerHpChange) this.onPlayerHpChange(this.player.hp);
                              }
                          }
                      }
                  }
                  if (this.eyeMiniBoss.attackTimer <= 0) {
                      this.eyeMiniBoss.isActive = false;
                      this.eyeMiniBoss.state = 'idle';
                      this.eyeMiniBoss.cooldownTimer = 0.5;
                      this.judgmentLasers = [];
                  }
              } else if (this.eyeMiniBoss.state === 'invocation_lock') {
                  this.eyeMiniBoss.attackTimer -= dt;
                  // Freeze player movement but allow attack
                  this.player.vx = 0;
                  if (this.player.vy < 0) this.player.vy = 0;
      this.eyeMiniBoss.cooldownTimer = 2.0; // Start attacking quickly // stop jump
                  // spawn blockable/destroyable projectiles from the eye
                  if (Math.random() < 8 * dt) { // approx 8 per second
                      const angle = Math.atan2(this.player.y - this.eyeMiniBoss.y, this.player.x - this.eyeMiniBoss.x) + (Math.random()-0.5)*0.5;
                      this.projectiles.push({
                          type: 'blood', // Looks cool
                          color: '#991b1b', // dark red
                          x: this.eyeMiniBoss.x, y: this.eyeMiniBoss.y,
                          vx: Math.cos(angle) * 600, vy: Math.sin(angle) * 600,
                          radius: 10, hp: 1, life: 5
                      });
                  }
                  if (this.eyeMiniBoss.attackTimer <= 0) {
                      this.eyeMiniBoss.isActive = false;
                      this.eyeMiniBoss.state = 'idle';
                      this.eyeMiniBoss.cooldownTimer = 1.0;
                  }
              } else if (this.eyeMiniBoss.state === 'wall_tentacles') {
                  this.eyeMiniBoss.attackTimer -= dt;
                  
                  for (const tent of this.wallTentacles) {
                      if (tent.state === 'extend') {
                          tent.timer -= dt;
                          if (tent.timer <= 0) { tent.state = 'active'; tent.timer = 3; tent.maxTimer = 3; }
                      } else if (tent.state === 'active') {
                          tent.timer -= dt;
                          // Damage check
                          const tX = tent.side === -1 ? 0 : ROOM_WIDTH;
                          const dx = this.player.x - tX;
                          const dy = this.player.y - tent.y;
                          if (Math.abs(dx) < 600 && Math.abs(dy) < 80 && this.player.invulnerableTimer <= 0 && this.player.intangibleTimer <= 0) {
                              if (this.player.healingTimer <= 0) {
                                  this.player.hp -= 1; this.hitEffectTimer = 0.5; this.screenShakeTimer = 0.2; this.screenShakeIntensity = 10;
                                  this.player.invulnerableTimer = 3.0;
                                  this.playSound('player_hit');
                                  if (this.onPlayerHpChange) this.onPlayerHpChange(this.player.hp);
                              }
                          }
                          if (tent.timer <= 0) { tent.state = 'retract'; tent.timer = 1; tent.maxTimer = 1; }
                      } else if (tent.state === 'retract') {
                          tent.timer -= dt;
                          if (tent.timer <= 0) {
                              // Relocate
                              tent.state = 'extend';
                              tent.timer = 1; tent.maxTimer = 1;
                              tent.y = FLOOR_Y - 100 - Math.random() * 500;
                              tent.side = Math.random() > 0.5 ? -1 : 1;
                          }
                      }
                  }
                  if (this.eyeMiniBoss.attackTimer <= 0) {
                      this.eyeMiniBoss.isActive = false;
                      this.eyeMiniBoss.state = 'idle';
                      this.eyeMiniBoss.cooldownTimer = 1.0;
                      this.wallTentacles = [];
                  }
              }
          }
      }

      // Leg face shooting logic
      if (this.enemy.phase < 3 && this.enemy.hp > 0 && this.enemy.state !== 'dead' && this.enemy.state !== 'death_anim_1' && this.enemy.state !== 'death_anim_2') {
          this.enemy.legShootTimer -= dt;
          if (this.enemy.legShootTimer <= 0) {
          this.enemy.legShootTimer = this.enemy.phase === 1 ? 5 : 3; // Reset timer
          if (true) {
    const r = Math.floor(Math.random() * 3) + 1;
    this.playBuffer('attacksound_' + r);
} else {
    this.playSound('boss_attack');
}
          
          // Shoot from left leg
          const leftLegX = this.enemy.x - 20;
          const leftLegY = this.enemy.y + 60;
          const distL = Math.hypot(this.player.x - leftLegX, this.player.y - leftLegY);
          this.projectiles.push({
              x: leftLegX, y: leftLegY,
              vx: ((this.player.x - leftLegX) / distL) * 200, 
              vy: ((this.player.y - leftLegY) / distL) * 200,
              radius: 8, hp: 1, life: 5
          });

          // Shoot from right leg
          const rightLegX = this.enemy.x + 20;
          const rightLegY = this.enemy.y + 60;
          const distR = Math.hypot(this.player.x - rightLegX, this.player.y - rightLegY);
          this.projectiles.push({
              x: rightLegX, y: rightLegY,
              vx: ((this.player.x - rightLegX) / distR) * 200, 
              vy: ((this.player.y - rightLegY) / distR) * 200,
              radius: 8, hp: 1, life: 5
          });
      }
      }


      // Mask Mechanic
      if ((this.enemy.phase === 2 && this.enemy.hp > 0 && this.enemy.state !== 'dead') || (this.enemy.phase === 3 && this.eyeMiniBoss.hp > 0)) {
          this.maskSpawnTimer -= dt;
          if (this.maskSpawnTimer <= 0 && this.masks.length === 0) {
              this.maskSpawnTimer = 20;
              // Spawn 4 masks
              const positions = [
                  {x: ROOM_WIDTH * 0.15, y: FLOOR_Y - 150},
                  {x: ROOM_WIDTH * 0.85, y: FLOOR_Y - 150},
                  {x: ROOM_WIDTH * 0.25, y: FLOOR_Y - 350},
                  {x: ROOM_WIDTH * 0.75, y: FLOOR_Y - 350},
                  {x: ROOM_WIDTH * 0.40, y: FLOOR_Y - 500},
                  {x: ROOM_WIDTH * 0.60, y: FLOOR_Y - 500},
                  {x: ROOM_WIDTH * 0.1, y: FLOOR_Y - 450},
                  {x: ROOM_WIDTH * 0.9, y: FLOOR_Y - 450}
              ];
              for (const pos of positions) {
                  this.masks.push({
                      x: pos.x, y: pos.y,
                      hp: 40, maxHp: 40,
                      state: 'idle',
                      vx: 0, vy: 0,
                      width: 40, height: 60,
                      hoverOffset: Math.random() * Math.PI * 2
                  });
              }
              // One gold mask
              this.masks.push({
                  x: ROOM_WIDTH * 0.5, y: FLOOR_Y - 400,
                  hp: 50, maxHp: 50,
                  state: 'idle',
                  vx: 0, vy: 0,
                  width: 45, height: 60,
                  hoverOffset: Math.random() * Math.PI * 2,
                  type: 'gold',
                  teleportTimer: 7
              });
          }
      }
      
      for (let i = this.masks.length - 1; i >= 0; i--) {
          const m = this.masks[i];
          if (m.state === 'idle') {
              // Hover
              m.y += Math.sin(this.enemy.animTime * 2 + m.hoverOffset) * 20 * dt;
              if (m.type === 'gold') {
                  if (m.teleportTimer === undefined) m.teleportTimer = 7;
                  m.teleportTimer -= dt;
                  if (m.teleportTimer <= 0) {
                      m.teleportTimer = 7;
                      m.x = ROOM_WIDTH * 0.1 + Math.random() * ROOM_WIDTH * 0.8;
                      m.y = FLOOR_Y - 200 - Math.random() * 300;
                  }
              }
          } else if (m.state === 'flying') {
              // Fly towards boss
              const target = this.enemy.phase === 3 ? this.eyeMiniBoss : this.enemy;
              const dx = target.x - m.x;
              const dy = target.y - m.y;
              const dist = Math.hypot(dx, dy);
              if (dist < 50) {
                  if (this.enemy.phase === 3) {
                      this.eyeMiniBoss.hp -= 30;
                      this.dealDamage(30);
                      this.playSound('hit');
                  } else {
                      this.enemy.hp -= 30;
                      this.dealDamage(30);
                      this.playSound('hit');
                  }
                  this.spawnHitParticles(m.x, m.y, 0);
                  this.notifyHpChange();
                  this.masks.splice(i, 1);
                  continue;
              } else {
                  m.vx = (dx / dist) * 800;
                  m.vy = (dy / dist) * 800;
                  m.x += m.vx * dt;
                  m.y += m.vy * dt;
              }
          }
      }

      // Enemy damages player
      const pRect: Rect = {
        x: this.player.x - this.player.width / 2,
        y: this.player.y - this.player.height / 2,
        width: this.player.width,
        height: this.player.height
      };
      const eRect: Rect = {
        x: this.enemy.x - this.enemy.width / 2,
        y: this.enemy.y - this.enemy.height / 2,
        width: this.enemy.width,
        height: this.enemy.height
      };

      if (checkRectOverlap(pRect, eRect) && this.player.invulnerableTimer <= 0 && this.player.intangibleTimer <= 0) {
        this.playSound('player_hit');
        this.player.hp -= 1; this.hitEffectTimer = 0.5; this.screenShakeTimer = 0.2; this.screenShakeIntensity = 8; 
        this.player.invulnerableTimer = 3.0;
        this.player.knockbackTimer = 0.25;
        this.player.vx = (this.player.x < this.enemy.x) ? -KNOCKBACK_FORCE_ENEMY : KNOCKBACK_FORCE_ENEMY;
        this.player.vy = -400;
        if (this.onPlayerHpChange) this.onPlayerHpChange(this.player.hp);
      }
    }

    const pRect: Rect = {
        x: this.player.x - this.player.width / 2,
        y: this.player.y - this.player.height / 2,
        width: this.player.width,
        height: this.player.height
    };

    // --- Player Projectiles ---
    for (let i = this.playerProjectiles.length - 1; i >= 0; i--) {
        const p = this.playerProjectiles[i];
        if (p.type !== 'dream' && p.type !== 'light_beam') {
            p.vy += (p.piercing ? GRAVITY * 0.5 : GRAVITY) * dt;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.lifeTime -= dt;
        
        let removed = false;

        if (p.boomerang) {
            const dx = this.player.x - p.x;
            const dy = (this.player.y - this.player.height/2) - p.y;
            const dist = Math.hypot(dx, dy);
            
            if (p.lifeTime < p.maxLifeTime * 0.6) {
                const accel = 3500 * dt;
                p.vx += (dx / dist) * accel;
                p.vy += (dy / dist) * accel;
                
                if (dist < 50) {
                    removed = true;
                    this.playerProjectiles.splice(i, 1);
                    continue;
                }
            } else {
                p.vx *= (1 - 2.5 * dt);
                p.vy *= (1 - 2.5 * dt);
            }
        }
        
        // check hit enemy projectiles
        if (p.piercing) {
            for (let j = this.projectiles.length - 1; j >= 0; j--) {
                const ep = this.projectiles[j];
                const dx = p.x - ep.x;
                const dy = p.y - ep.y;
                if (Math.hypot(dx, dy) < p.radius + ep.radius) {
                    this.projectiles.splice(j, 1);
                    this.spawnHitParticles(ep.x, ep.y, 0);
                    if (true) this.playBuffer('destruction_sound', false, 0.4);
                    // Continue piercing
                }
            }
        }
        
        // check fallingEyes
        if (this.enemy.phase === 3 && !removed) {
            for (let j = this.fallingEyes.length - 1; j >= 0; j--) {
                const eye = this.fallingEyes[j];
                const dx = p.x - eye.x;
                const dy = p.y - eye.y;
                if (Math.hypot(dx, dy) < p.radius + 15) {
                    this.fallingEyes.splice(j, 1);
                    this.spawnHitParticles(eye.x, eye.y, p.angle || 0);
                    if (true) this.playBuffer('destruction_sound', false, 0.4);
                    
                    if (this.eyeMiniBoss.hp > 0) {
                        this.eyeMiniBoss.hp -= 5;
                        this.dealDamage(5);
                        this.notifyHpChange();
                        if (this.eyeMiniBoss.hp <= 0 && this.eyeMiniBoss.state !== 'dead') {
                      this.eyeMiniBoss.hp = 0;
                      this.eyeMiniBoss.state = 'dead';
                      this.spawnHitParticles(this.eyeMiniBoss.x, this.eyeMiniBoss.y, 0, 50);
                      if (this.enemy.hp <= 0) {
                          this.enemy.state = 'death_anim_2';
                          this.enemy.stateTimer = 5.0;
                          this.bossSubtitleText = '"VERDADE... DESFEITA..."';
                          this.bossSubtitleTimer = 5.0;
                          this.screenShakeTimer = 5.0;
                          this.screenShakeIntensity = 15;
                          this.fallingEyes = [];
                          this.tentacles = [];
                          if (true) this.playBuffer('destruction_sound', false, 1.0);
                      }
                  }
                    }
                    if (!p.piercing) {
                        removed = true;
                        this.playerProjectiles.splice(i, 1);
                        break;
                    }
                }
            }
        }

        // hit floor
        if (p.y > FLOOR_Y && !removed) {
            this.playerProjectiles.splice(i, 1);
            this.spawnHitParticles(p.x, FLOOR_Y, 0);
            removed = true;
        }
        
        if (!removed && this.enemy.hp > 0 && this.enemy.invulnerableTimer <= 0) {
            const eRect: Rect = {
                x: this.enemy.x - this.enemy.width / 2,
                y: this.enemy.y - this.enemy.height / 2,
                width: this.enemy.width,
                height: this.enemy.height
            };
            const testX = Math.max(eRect.x, Math.min(p.x, eRect.x + eRect.width));
            const testY = Math.max(eRect.y, Math.min(p.y, eRect.y + eRect.height));
            const distX = p.x - testX;
            const distY = p.y - testY;
            if (Math.sqrt(distX*distX + distY*distY) < p.radius) {
                if (this.bossHitSoundCooldown <= 0) {
                    if (true) this.playSound('hit');
                    else this.playSound('hit');
                    this.bossHitSoundCooldown = 0.5;
                }
                
                let actualDmg = p.damage;
                if (this.enemy.phase >= 2 && p.type === 'dream') {
                    actualDmg = 0.5;
                }
                
                if (this.enemy.phase === 1 && this.enemy.shieldHp > 0) {
                    this.enemy.shieldHp -= actualDmg;
                    actualDmg = Math.max(0, actualDmg - 1);
                    if (this.enemy.shieldHp <= 0) {
                        this.enemy.shieldHp = 0;
                        this.playBuffer('destruction_sound', false, 0.5);
                        this.spawnHitParticles(this.enemy.x, this.enemy.y, 0, 30);
                    }
                }
                
                this.enemy.hp -= actualDmg;
                this.dealDamage(actualDmg);
                this.enemy.invulnerableTimer = 0.2;
                if (this.enemy.state === 'idle') {
                    this.enemy.knockbackTimer = 0.1;
                    // Minor knockback
                    this.enemy.vx = Math.cos(p.angle || 0) * (KNOCKBACK_FORCE_ENEMY * 0.3);
                    this.enemy.vy = Math.sin(p.angle || 0) * (KNOCKBACK_FORCE_ENEMY * 0.3);
                }
                this.spawnHitParticles(p.x, p.y, Math.cos(p.angle || 0));
                this.notifyHpChange();
                
                if (p.boomerang && !p.exploded) {
                    p.exploded = true;
                    this.aoes.push({
                        type: 'void_blast',
                        x: p.x,
                        y: p.y,
                        radius: 120,
                        timer: 0.2,
                        maxTimer: 0.2
                    });
                    if (this.enemy.hp > 0 && Math.hypot(this.enemy.x - p.x, this.enemy.y - p.y) < 120) {
                        this.enemy.hp -= 1;
                        this.dealDamage(1);
                    }
                    if (this.eyeMiniBoss && this.eyeMiniBoss.hp > 0 && Math.hypot(this.eyeMiniBoss.x - p.x, this.eyeMiniBoss.y - p.y) < 150) {
                        this.eyeMiniBoss.hp -= 1;
                        this.dealDamage(1);
                    }
                }
                if (!p.piercing) {
                    this.playerProjectiles.splice(i, 1);
                    removed = true;
                }
            }
        }
        
        // Masks hit detection for projectiles
        if (!removed) {
            for (let j = this.mobs.length - 1; j >= 0; j--) {
                const m = this.mobs[j];
                const testX = Math.max(m.x - m.width/2, Math.min(p.x, m.x + m.width/2));
                const testY = Math.max(m.y - m.height/2, Math.min(p.y, m.y + m.height/2));
                const distX = p.x - testX;
                const distY = p.y - testY;
                if (Math.hypot(distX, distY) < p.radius) {
                    m.hp -= p.damage;
                    m.hitTimer = 0.2;
                    this.dealDamage(p.damage);
                    this.spawnHitParticles(p.x, p.y, Math.cos(p.angle || 0));
                    if (true) this.playSound('hit');
                    if (m.hp <= 0) {
                        this.spawnHitParticles(m.x, m.y, 0, 20);
                        this.mobs.splice(j, 1);
                    }
                    if (!p.piercing) {
                        removed = true;
                        this.playerProjectiles.splice(i, 1);
                        break;
                    }
                }
            }
        }
        
        if (!removed) {
            for (let j = 0; j < this.masks.length; j++) {
                const m = this.masks[j];
                if (m.state === 'idle') {
                    const mRect = { x: m.x - m.width/2, y: m.y - m.height/2, width: m.width, height: m.height };
                    const testX = Math.max(mRect.x, Math.min(p.x, mRect.x + mRect.width));
                    const testY = Math.max(mRect.y, Math.min(p.y, mRect.y + mRect.height));
                    const distX = p.x - testX;
                    const distY = p.y - testY;
                    if (Math.sqrt(distX*distX + distY*distY) < p.radius) {
                        let actualDmg = p.damage;
                        if (this.enemy.phase >= 2 && p.type === 'dream') {
                            actualDmg = 0.5;
                        }
                        m.hp -= actualDmg;
                        this.dealDamage(actualDmg);
                        this.spawnHitParticles(p.x, p.y, Math.cos(p.angle || 0));
                        if (true) this.playSound('hit');
                        
                        if (m.hp <= 0) {
                          if (m.type === 'gold') {
                              for (let k = 0; k < 12; k++) {
                                  const angle = (Math.PI * 2 / 12) * k;
                                  this.projectiles.push({
                                      x: m.x, y: m.y,
                                      vx: Math.cos(angle) * 250,
                                      vy: Math.sin(angle) * 250,
                                      radius: 12, hp: 1, life: 10,
                                      type: 'blast', color: '#fbbf24', neutral: true
                                  });
                              }
                              this.player.buffTimer = 3.0; // Attack speed boost
                              this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1); // Heal 1 HP
                              if (this.onPlayerHpChange) this.onPlayerHpChange(this.player.hp);
                              this.masks.splice(j, 1);
                              j--;
                              break;
                          }
                          m.state = 'flying';
                            if (true) {
                                const r = Math.floor(Math.random() * 3) + 1;
                                this.playBuffer('attacksound_' + r);
                            } else {
                                this.playSound('boss_attack');
                            }
                        }
                        
                        if (!p.piercing) {
                            if (p.boomerang && !p.exploded) {
                    p.exploded = true;
                    this.aoes.push({
                        type: 'void_blast',
                        x: p.x,
                        y: p.y,
                        radius: 120,
                        timer: 0.2,
                        maxTimer: 0.2
                    });
                    if (this.enemy.hp > 0 && Math.hypot(this.enemy.x - p.x, this.enemy.y - p.y) < 120) {
                        this.enemy.hp -= 1;
                        this.dealDamage(1);
                    }
                    if (this.eyeMiniBoss && this.eyeMiniBoss.hp > 0 && Math.hypot(this.eyeMiniBoss.x - p.x, this.eyeMiniBoss.y - p.y) < 150) {
                        this.eyeMiniBoss.hp -= 1;
                        this.dealDamage(1);
                    }
                }
                if (!p.piercing) {
                    this.playerProjectiles.splice(i, 1);
                    removed = true;
                }
                            break;
                        }
                    }
                }
            }
        }

        if (!removed) {
            for (let j = 0; j < this.fallingEyes.length; j++) {
                const eye = this.fallingEyes[j];
                if (Math.hypot(p.x - eye.x, p.y - eye.y) < p.radius + 15) {
                    this.fallingEyes.splice(j, 1);
                    this.spawnHitParticles(eye.x, eye.y, Math.cos(p.angle || 0));
                    if (p.boomerang && !p.exploded) {
                    p.exploded = true;
                    this.aoes.push({
                        type: 'void_blast',
                        x: p.x,
                        y: p.y,
                        radius: 120,
                        timer: 0.2,
                        maxTimer: 0.2
                    });
                    if (this.enemy.hp > 0 && Math.hypot(this.enemy.x - p.x, this.enemy.y - p.y) < 120) {
                        this.enemy.hp -= 1;
                        this.dealDamage(1);
                    }
                    if (this.eyeMiniBoss && this.eyeMiniBoss.hp > 0 && Math.hypot(this.eyeMiniBoss.x - p.x, this.eyeMiniBoss.y - p.y) < 150) {
                        this.eyeMiniBoss.hp -= 1;
                        this.dealDamage(1);
                    }
                }
                if (!p.piercing) {
                    this.playerProjectiles.splice(i, 1);
                    removed = true;
                }
                    if (true) this.playSound('hit');
                    break;
                }
            }
        }
        
        if (!removed && this.enemy.phase === 3 && this.eyeMiniBoss.hp > 0 && this.eyeMiniBoss.invulnerableTimer <= 0) {
            const eyeRect = { x: this.eyeMiniBoss.x - 200, y: this.eyeMiniBoss.y - 100, width: 400, height: 200 };
            const eyeTestX = Math.max(eyeRect.x, Math.min(p.x, eyeRect.x + eyeRect.width));
            const eyeTestY = Math.max(eyeRect.y, Math.min(p.y, eyeRect.y + eyeRect.height));
            const eyeDistX = p.x - eyeTestX;
            const eyeDistY = p.y - eyeTestY;
            if (Math.sqrt(eyeDistX*eyeDistX + eyeDistY*eyeDistY) < p.radius) {
                if (this.bossHitSoundCooldown <= 0) {
                    if (true) this.playSound('hit');
                    else this.playSound('hit');
                    this.bossHitSoundCooldown = 0.5;
                }
                if (false) {
                } else {
                    let actualDmg = p.damage;
                    if (this.enemy.phase >= 2 && p.type === 'dream') {
                        actualDmg = 0.5;
                    }
                    this.eyeMiniBoss.hp -= actualDmg;
                    this.dealDamage(actualDmg);
                }
                this.eyeMiniBoss.invulnerableTimer = 0.2;
                this.spawnHitParticles(p.x, p.y, Math.cos(p.angle || 0));
                this.notifyHpChange();
                if (this.eyeMiniBoss.hp <= 0 && this.eyeMiniBoss.state !== 'dead') {
                      this.eyeMiniBoss.hp = 0;
                      this.eyeMiniBoss.state = 'dead';
                      this.spawnHitParticles(this.eyeMiniBoss.x, this.eyeMiniBoss.y, 0, 50);
                      if (this.enemy.hp <= 0) {
                          this.enemy.state = 'death_anim_2';
                          this.enemy.stateTimer = 5.0;
                          this.bossSubtitleText = '"VERDADE... DESFEITA..."';
                          this.bossSubtitleTimer = 5.0;
                          this.screenShakeTimer = 5.0;
                          this.screenShakeIntensity = 15;
                          this.fallingEyes = [];
                          this.tentacles = [];
                          if (true) this.playBuffer('destruction_sound', false, 1.0);
                      }
                  }
                
                if (p.boomerang && !p.exploded) {
                    p.exploded = true;
                    this.aoes.push({
                        type: 'void_blast',
                        x: p.x,
                        y: p.y,
                        radius: 120,
                        timer: 0.2,
                        maxTimer: 0.2
                    });
                    if (this.enemy.hp > 0 && Math.hypot(this.enemy.x - p.x, this.enemy.y - p.y) < 120) {
                        this.enemy.hp -= 1;
                        this.dealDamage(1);
                    }
                    if (this.eyeMiniBoss && this.eyeMiniBoss.hp > 0 && Math.hypot(this.eyeMiniBoss.x - p.x, this.eyeMiniBoss.y - p.y) < 150) {
                        this.eyeMiniBoss.hp -= 1;
                        this.dealDamage(1);
                    }
                }
                if (!p.piercing) {
                    this.playerProjectiles.splice(i, 1);
                    removed = true;
                }
            }
        }

        if (!removed && p.lifeTime <= 0) {
            this.playerProjectiles.splice(i, 1);
        }
    }

    // --- Divine Projectiles ---
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        p.life -= dt;
        
        // Physics / Homing logic
        if (p.type === 'bone') {
            p.vy += 800 * dt; // Gravity for bone
        } else if (p.type === 'laser') {
            // Goes straight down, no homing
        } else if (p.type !== 'blood' && p.type !== 'blast') {
            const angleToPlayer = Math.atan2(this.player.y - p.y, this.player.x - p.x);
            const currentAngle = Math.atan2(p.vy, p.vx);
            let angleDiff = angleToPlayer - currentAngle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            const turnSpeed = 2.0; 
            const newAngle = currentAngle + Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnSpeed * dt);
            const speed = 250;
            p.vx = Math.cos(newAngle) * speed;
            p.vy = Math.sin(newAngle) * speed;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.life <= 0 || p.hp <= 0) {
            if (p.hp <= 0 && true) this.playBuffer('destruction_sound', false, 0.4);
            this.projectiles.splice(i, 1);
            continue;
        }

        if (p.neutral) {
            const target = this.enemy.phase === 3 ? this.eyeMiniBoss : this.enemy;
            const bdx = p.x - target.x;
            const bdy = p.y - target.y;
            if (Math.hypot(bdx, bdy) < p.radius + 60) {
                if (this.enemy.phase === 3) {
                     this.eyeMiniBoss.hp -= 5;
                } else {
                     this.enemy.hp -= 5;
                }
                this.dealDamage(5);
                this.spawnHitParticles(p.x, p.y, 0);
                this.projectiles.splice(i, 1);
                this.notifyHpChange();
                continue;
            }
        }
        
        // Damage Player
        const dx = p.x - this.player.x;
        const dy = p.y - this.player.y;
        if (Math.sqrt(dx*dx + dy*dy) < p.radius + 30 && this.player.invulnerableTimer <= 0 && this.player.intangibleTimer <= 0) {
            if (this.player.healingTimer > 0 || this.player.isShielding) {
                // Shield gives vital charges
                if (this.player.isShielding) {
                    this.dealDamage(50); // dealDamage(50) = 1 vital charge
                }
                // Reflect
                p.vx = -p.vx;
                p.vy = -p.vy;
                p.life = 5.0;
                this.playerProjectiles.push({
                   x: p.x, y: p.y,
                   vx: p.vx * 1.5, vy: p.vy * 1.5,
                   angle: Math.atan2(p.vy, p.vx),
                   radius: p.radius, damage: 15,
                   color: '#d8b4fe', type: 'normal',
                   piercing: true
                });
                this.projectiles.splice(i, 1);
                this.spawnHitParticles(p.x, p.y, 0);
                if (true) this.playBuffer('destruction_sound', false, 0.4);
            } else {
                this.playSound('player_hit');
                this.player.hp -= 1; this.hitEffectTimer = 0.5; this.screenShakeTimer = 0.2; this.screenShakeIntensity = 8; 
                this.player.invulnerableTimer = 3.0;
                
                if (this.onPlayerHpChange) this.onPlayerHpChange(this.player.hp);
                this.projectiles.splice(i, 1);
            }
        }
    }

    // --- Heavens Break AoE ---
    for (let i = this.aoes.length - 1; i >= 0; i--) {
        const a = this.aoes[i];
        a.timer -= dt;
        
        if (a.timer <= 0 && !a.exploded) {
            a.exploded = true;
            this.screenShakeTimer = 0.5;
            this.screenShakeIntensity = 25;
            // Explode!
            let hit = false;
            if (a.type === 'laser_h' || a.type === 'laser_v') {
                const aRect = { x: a.type === 'laser_v' ? a.x - a.width/2 : a.x, y: a.type === 'laser_h' ? a.y - a.height/2 : a.y, width: a.width, height: a.height };
                const pRect = { x: this.player.x - this.player.width/2, y: this.player.y - this.player.height, width: this.player.width, height: this.player.height };
                if (checkRectOverlap(aRect, pRect)) {
                    hit = true;
                }
            } else if (a.type === 'heavens_break' || a.type === 'divine_ray') {
                // Heavens break is a vertical beam from the sky
                const dx = Math.abs(a.x - this.player.x);
                // Hit if within horizontal radius and player is anywhere above or at the floor level where it hits
                if (dx < a.radius && this.player.y <= a.y) {
                    hit = true;
                }
            } else if (a.type !== 'void_blast') {
                const dx = a.x - this.player.x;
                const dy = a.y - this.player.y;
                if (Math.sqrt(dx*dx + dy*dy) < a.radius) {
                    hit = true;
                }
            }

            if (hit && this.player.invulnerableTimer <= 0 && this.player.intangibleTimer <= 0) {
                this.playSound('player_hit');
                this.player.hp -= 1; this.hitEffectTimer = 0.5; this.screenShakeTimer = 0.2; this.screenShakeIntensity = 8; 
                this.player.invulnerableTimer = 3.0;
                if (this.onPlayerHpChange) this.onPlayerHpChange(this.player.hp);
            }
        }
        
        if (a.exploded) {
            let duration = a.duration || 0.3;
            if (a.type === 'divine_ray') {
                if (Math.abs(a.x - this.player.x) < a.radius && this.player.invulnerableTimer <= 0 && this.player.intangibleTimer <= 0) {
                    this.playSound('player_hit');
                    this.player.hp -= 2; this.hitEffectTimer = 0.5; this.screenShakeTimer = 0.2; this.screenShakeIntensity = 8;
                    this.player.invulnerableTimer = 2.5;
                    if (this.onPlayerHpChange) this.onPlayerHpChange(this.player.hp);
                }
                if (Math.abs(a.x - this.enemy.x) < a.radius && this.enemy.invulnerableTimer <= 0 && this.enemy.hp > 0) {
                    this.enemy.hp -= 2;
                    this.dealDamage(2);
                    this.enemy.invulnerableTimer = 0.5;
                    this.notifyHpChange();
                }
            }
            if (a.timer <= -duration) {
                this.aoes.splice(i, 1);
            }
        }
    }

    // --- Meteor Shower ---
    for (let i = this.meteors.length - 1; i >= 0; i--) {
        const m = this.meteors[i];
        m.vy += GRAVITY * 0.5 * dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        
        if (m.y >= FLOOR_Y) {
            // Explode on ground
            m.y = FLOOR_Y;
            m.exploded = true;
            const dx = m.x - this.player.x;
            const dy = m.y - this.player.y;
            if (Math.sqrt(dx*dx + dy*dy) < m.radius * 3 && this.player.invulnerableTimer <= 0 && this.player.intangibleTimer <= 0) {
                this.playSound('player_hit');
                this.player.hp -= 1; this.hitEffectTimer = 0.5; this.screenShakeTimer = 0.2; this.screenShakeIntensity = 8; 
                this.player.invulnerableTimer = 3.0;
                if (this.onPlayerHpChange) this.onPlayerHpChange(this.player.hp);
            }
            this.spawnHitParticles(m.x, m.y, 0); // Explosion particles
            this.meteors.splice(i, 1);
        }
    }

    // --- Particles ---
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  spawnHitParticles(x: number, y: number, dir: number, count: number = 10) {
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 30,
        vx: dir * (300 + Math.random() * 300) + (Math.random() - 0.5) * 150,
        vy: (Math.random() - 0.8) * 400,
        life: 0.2 + Math.random() * 0.3,
        color: '#fde047'
      });
    }
  }

  spawnAbsorbParticles(x: number, y: number) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 50 + Math.random() * 50;
      this.particles.push({
        x: x + Math.cos(angle) * distance,
        y: y - 45 + Math.sin(angle) * distance,
        vx: -Math.cos(angle) * 100, // moves towards center
        vy: -Math.sin(angle) * 100,
        life: 0.5 + Math.random() * 0.5,
        color: '#a855f7' // purple for dream energy
      });
    }
  }

  debugLogs: string[] = [];
  logDebug(msg: string) {
      this.debugLogs.push(msg);
      if (this.debugLogs.length > 5) this.debugLogs.shift();
  }
  
  draw() {
    this.ctx.save();
    this.ctx.scale(ZOOM, ZOOM);
    let ctx = this.ctx;
    const PIXEL_SCALE = 4;
     
    
    if (this.retroMode) {
        if (!this.offscreenCanvas) {
            this.offscreenCanvas = document.createElement('canvas');
            this.offscreenCtx = this.offscreenCanvas.getContext('2d')!;
        }
        
        this.offscreenCanvas.width = Math.max(1, Math.floor(ROOM_WIDTH / PIXEL_SCALE));
        this.offscreenCanvas.height = Math.max(1, Math.floor(ROOM_HEIGHT / PIXEL_SCALE));
        
        ctx = this.offscreenCtx!;
        ctx.save();
        ctx.scale(1 / PIXEL_SCALE, 1 / PIXEL_SCALE);
    }
    ctx.clearRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    ctx.save();
    if (this.screenShakeTimer > 0) {
        const intensity = this.screenShakeIntensity * Math.min(1, this.screenShakeTimer / 0.5);
        ctx.translate((Math.random() - 0.5) * intensity, (Math.random() - 0.5) * intensity);
    }

    if (this.gameMode === 'devastated_path') {
        this.drawDevastatedPath(ctx);
    } else if (this.enemy.phase < 3) {
    // Background: Celestial Sky
    const bgGradient = ctx.createLinearGradient(0, 0, 0, ROOM_HEIGHT);
    let transitionProgress = 0;
    if (this.enemy.phase >= 2) {
        if (this.enemy.state === 'transition') {
            transitionProgress = 1 - (this.enemy.transitionTimer / 10.0);
        } else {
            transitionProgress = 1;
        }
    }
    
    bgGradient.addColorStop(0, lerpColor('#020617', '#2a0000', transitionProgress));
    bgGradient.addColorStop(0.5, lerpColor('#0f172a', '#4a0000', transitionProgress));
    bgGradient.addColorStop(1, lerpColor('#0284c7', '#7a0000', transitionProgress));
    
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

    // Push the horizon further up so the player appears lower down on the floor grid
    const horizonY = FLOOR_Y - 180;

    // --- Parallax 1: Glowing Swirls / Waves ---
    const p1Scroll = (this.player.x * 0.01);
    ctx.save();
    ctx.strokeStyle = this.enemy.phase >= 2 ? 'rgba(220, 38, 38, 0.15)' : 'rgba(59, 130, 246, 0.25)';
    ctx.lineWidth = 6;
    for (let j = 0; j < 3; j++) {
        ctx.beginPath();
        for (let i = 0; i <= ROOM_WIDTH; i += 50) {
            const waveY = horizonY - 250 + Math.sin((i + p1Scroll * 2 + j * 250) * 0.003) * 80 + Math.cos((i + p1Scroll * 2) * 0.007) * 40;
            if (i === 0) ctx.moveTo(i, waveY);
            else ctx.lineTo(i, waveY);
        }
        ctx.stroke();
    }
    // Add intricate runic pattern
    ctx.strokeStyle = this.enemy.phase >= 2 ? 'rgba(185, 28, 28, 0.3)' : 'rgba(147, 197, 253, 0.3)';
    ctx.lineWidth = 3;
    for(let i = -400; i <= ROOM_WIDTH + 400; i += 300) {
        const sx = i - (p1Scroll % 300);
        ctx.beginPath();
        ctx.arc(sx, horizonY - 150, 60, 0, Math.PI);
        ctx.arc(sx + 60, horizonY - 150, 60, Math.PI, Math.PI*2);
        ctx.stroke();
    }
    ctx.restore();

    // --- Parallax 1.5: Dense Dark Back Clouds ---
    const p15Scroll = (this.enemy.animTime * 10) + (this.player.x * 0.02);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 40;
    ctx.globalAlpha = 0.7;
    const darkCloudColor = this.enemy.phase >= 2 ? '#450a0a' : '#1e3a8a'; // Very dark red / Very dark blue
    const darkClouds = [
        { x: -100, y: horizonY - 250, scale: 1.5 },
        { x: 400, y: horizonY - 120, scale: 1.3 },
        { x: 900, y: horizonY - 300, scale: 1.6 },
        { x: 1500, y: horizonY - 180, scale: 1.4 },
        { x: 2100, y: horizonY - 280, scale: 1.5 },
    ];
    darkClouds.forEach((c, idx) => {
        const cx = (c.x - p15Scroll * (0.5 + idx * 0.05)) % (ROOM_WIDTH + 1000);
        const finalX = cx < -500 ? cx + ROOM_WIDTH + 1000 : cx;
        
        ctx.fillStyle = darkCloudColor;
        ctx.beginPath();
        ctx.arc(finalX, c.y, 60 * c.scale, Math.PI, 0);
        ctx.arc(finalX + 60 * c.scale, c.y - 15 * c.scale, 75 * c.scale, Math.PI, 0);
        ctx.arc(finalX + 135 * c.scale, c.y + 15 * c.scale, 45 * c.scale, Math.PI, 0);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(finalX - 60 * c.scale, c.y);
        ctx.lineTo(finalX + 180 * c.scale, c.y + 15 * c.scale);
        ctx.quadraticCurveTo(finalX + 60 * c.scale, c.y + 45 * c.scale, finalX - 60 * c.scale, c.y);
        ctx.fill();
    });
    ctx.restore();

    // --- Parallax 2: Moving Clouds with Script ---
    // Make clouds move over time slightly, and parallax smoothly
    const p2Scroll = (this.enemy.animTime * 20) + (this.player.x * 0.04);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 30;
    ctx.globalAlpha = 0.8;
    const cloudColor = this.enemy.phase >= 2 ? '#7f1d1d' : '#fef08a';
    const scriptColor = this.enemy.phase >= 2 ? '#450a0a' : '#b45309';
    const clouds = [
        { x: 100, y: horizonY - 300, scale: 1 },
        { x: 700, y: horizonY - 150, scale: 0.8 },
        { x: 1200, y: horizonY - 350, scale: 1.2 },
        { x: 1800, y: horizonY - 200, scale: 0.9 },
    ];
    clouds.forEach((c, idx) => {
        const cx = (c.x - p2Scroll * (0.8 + idx * 0.1)) % (ROOM_WIDTH + 800);
        const finalX = cx < -400 ? cx + ROOM_WIDTH + 800 : cx;
        
        ctx.fillStyle = cloudColor;
        ctx.beginPath();
        ctx.arc(finalX, c.y, 40 * c.scale, Math.PI, 0);
        ctx.arc(finalX + 40 * c.scale, c.y - 10 * c.scale, 50 * c.scale, Math.PI, 0);
        ctx.arc(finalX + 90 * c.scale, c.y + 10 * c.scale, 30 * c.scale, Math.PI, 0);
        ctx.fill();
        
        // Add rounded bottom
        ctx.beginPath();
        ctx.moveTo(finalX - 40 * c.scale, c.y);
        ctx.lineTo(finalX + 120 * c.scale, c.y + 10 * c.scale);
        ctx.quadraticCurveTo(finalX + 40 * c.scale, c.y + 30 * c.scale, finalX - 40 * c.scale, c.y);
        ctx.fill();

        // Scribble text
        ctx.strokeStyle = scriptColor;
        ctx.lineWidth = 2 * c.scale;
        ctx.beginPath();
        ctx.moveTo(finalX - 20 * c.scale, c.y - 10 * c.scale);
        ctx.bezierCurveTo(finalX + 20 * c.scale, c.y - 20 * c.scale, finalX, c.y + 10 * c.scale, finalX + 40 * c.scale, c.y - 5 * c.scale);
        ctx.bezierCurveTo(finalX + 60 * c.scale, c.y - 15 * c.scale, finalX + 50 * c.scale, c.y + 5 * c.scale, finalX + 80 * c.scale, c.y - 10 * c.scale);
        ctx.stroke();
    });
    ctx.restore();

    // --- Parallax 3: Pillars ---
    const p3Scroll = (this.player.x * 0.08);
    for(let i = -250; i < ROOM_WIDTH + 500; i += 250) {
        const x = i - (p3Scroll % 250);
        
        const isBroken = this.enemy.phase >= 2 && (i % 500 === 0);
        const colHeight = isBroken ? horizonY - 200 : horizonY - 50;
        const colY = isBroken ? 200 : 50;

        const pillarGrad = ctx.createLinearGradient(x, 0, x + 80, 0);
        if (this.enemy.phase >= 2) {
            pillarGrad.addColorStop(0, '#1e293b');
            pillarGrad.addColorStop(0.5, '#475569');
            pillarGrad.addColorStop(0.8, '#334155');
            pillarGrad.addColorStop(1, '#0f172a');
        } else {
            pillarGrad.addColorStop(0, '#94a3b8');
            pillarGrad.addColorStop(0.5, '#f8fafc');
            pillarGrad.addColorStop(0.8, '#e2e8f0');
            pillarGrad.addColorStop(1, '#cbd5e1');
        }
        ctx.fillStyle = pillarGrad;
        ctx.fillRect(x, colY, 80, colHeight); 
        
        if (!isBroken) {
            ctx.fillStyle = this.enemy.phase >= 2 ? '#b45309' : '#fbbf24';
            ctx.fillRect(x - 10, colY, 100, 20); 
            
            ctx.fillStyle = this.enemy.phase >= 2 ? '#475569' : '#e2e8f0';
            ctx.beginPath();
            ctx.arc(x + 40, colY, 40, Math.PI, 0);
            ctx.fill();
            
            ctx.strokeStyle = this.enemy.phase >= 2 ? '#334155' : '#fbbf24';
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.arc(x + 40, colY, 40, Math.PI, 0);
            ctx.stroke();
        } else {
            // Jagged broken top
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.moveTo(x, colY);
            ctx.lineTo(x + 20, colY - 50);
            ctx.lineTo(x + 40, colY + 10);
            ctx.lineTo(x + 60, colY - 30);
            ctx.lineTo(x + 80, colY);
            ctx.fill();
        }
        
        // Base gold cap
        ctx.fillStyle = this.enemy.phase >= 2 ? '#b45309' : '#fbbf24';
        ctx.fillRect(x - 10, horizonY - 20, 100, 20);
    }

        // --- Floor Perspective (Horizon at horizonY, Player at FLOOR_Y) ---
    // Fill background for floor
    ctx.fillStyle = lerpColor('#f8fafc', '#2a0a0a', transitionProgress);
    ctx.fillRect(0, horizonY, ROOM_WIDTH, ROOM_HEIGHT - horizonY);
    
    // Fade floor into lava based on lavaLevel
    if (this.lavaLevel > 0) {
        ctx.save();
        const lavaGrad = ctx.createLinearGradient(0, horizonY, 0, ROOM_HEIGHT);
        lavaGrad.addColorStop(0, `rgba(239, 68, 68, ${this.lavaLevel})`); // red-500
        lavaGrad.addColorStop(0.5, `rgba(185, 28, 28, ${this.lavaLevel})`); // red-700
        lavaGrad.addColorStop(1, `rgba(69, 10, 10, ${this.lavaLevel})`); // red-950
        
        ctx.fillStyle = lavaGrad;
        ctx.fillRect(0, horizonY, ROOM_WIDTH, ROOM_HEIGHT - horizonY);
        
        // 2.5D Lava Waves
        ctx.strokeStyle = `rgba(252, 165, 165, ${this.lavaLevel * 0.4})`; // red-300
        const time = Date.now() / 300;
        for(let i = 1; i < 15; i++) {
            const y = horizonY + Math.pow(i, 1.55) * 5;
            if(y < ROOM_HEIGHT) {
                ctx.lineWidth = i * 0.5;
                ctx.beginPath();
                for (let lx = 0; lx <= ROOM_WIDTH; lx += 40) {
                    const waveOffset = Math.sin(lx * 0.02 + time + i) * (i * 0.5) * this.lavaLevel;
                    if (lx === 0) ctx.moveTo(lx, y + waveOffset);
                    else ctx.lineTo(lx, y + waveOffset);
                }
                ctx.stroke();
            }
        }
        
        // Lava glow on horizon
        ctx.fillStyle = `rgba(239, 68, 68, ${this.lavaLevel * 0.3})`;
        ctx.fillRect(0, horizonY - 20, ROOM_WIDTH, 20);
        ctx.restore();
    }
    
    // Checkered perspective lines
    ctx.strokeStyle = lerpColor('#cbd5e1', '#4a0a0a', transitionProgress);
    ctx.lineWidth = 3;
    const floorScroll = (this.player.x * 0.15); // smooth scroll for floor
    
    // Vertical radiating lines
    const vpX = ROOM_WIDTH / 2;
    for(let i = -ROOM_WIDTH * 4; i < ROOM_WIDTH * 5; i += 150) {
        const bottomX = i - (floorScroll % 150);
        ctx.beginPath();
        ctx.moveTo(vpX, horizonY);
        ctx.lineTo(bottomX, ROOM_HEIGHT);
        ctx.stroke();
    }
    
    // Horizontal lines getting further apart
    for(let i = 1; i < 18; i++) {
        const y = horizonY + Math.pow(i, 1.45) * 5;
        if(y < ROOM_HEIGHT) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(ROOM_WIDTH, y);
            ctx.stroke();
        }
    }
    
    // Creepy Eyes and Tentacles in Lava
    if (this.lavaLevel > 0) {
        ctx.save();
        const t = Date.now() / 300;
        
        // Eyes
        for (let i = 0; i < 20; i++) {
            // pseudorandom positions based on index
            const x = ((i * 137) % ROOM_WIDTH);
            const rawY = ((i * 97) % (ROOM_HEIGHT - horizonY));
            const y = horizonY + rawY;
            
            // scaling based on perspective
            const scale = 0.5 + (rawY / (ROOM_HEIGHT - horizonY)) * 1.5;
            
            ctx.globalAlpha = this.lavaLevel * (0.3 + Math.sin(t + i)*0.7);
            ctx.fillStyle = '#450a0a'; // eye socket
            ctx.beginPath();
            ctx.ellipse(x, y, 15 * scale, 8 * scale, 0, 0, Math.PI*2);
            ctx.fill();
            
            ctx.fillStyle = '#fca5a5';
            ctx.beginPath();
            ctx.ellipse(x, y, 12 * scale, 6 * scale, 0, 0, Math.PI*2);
            ctx.fill();
            
            ctx.fillStyle = '#000000'; // pupil
            const dx = this.player.x - x;
            const dy = this.player.y - y;
            const dist = Math.sqrt(dx*dx + dy*dy) || 1;
            const px = (dx / dist) * 3 * scale;
            const py = (dy / dist) * 1.5 * scale;
            ctx.beginPath();
            ctx.arc(x + px, y + py, 3 * scale, 0, Math.PI*2);
            ctx.fill();
        }
        
        // Tentacles
        ctx.globalAlpha = this.lavaLevel;
        ctx.strokeStyle = '#7f1d1d';
        ctx.lineCap = 'round';
        for(let i = 0; i < 12; i++) {
            const tx = ((i * 223) % ROOM_WIDTH);
            const ty = horizonY + ((i * 151) % (ROOM_HEIGHT - horizonY)) + 10;
            const scale = 0.5 + ((ty - horizonY) / (ROOM_HEIGHT - horizonY)) * 2;
            
            const sway = Math.sin(t + i) * 20 * scale;
            const height = (30 + Math.sin(t * 0.5 + i) * 30) * scale;
            
            ctx.lineWidth = 8 * scale;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.quadraticCurveTo(tx + sway, ty - height/2, tx + sway*1.5, ty - height);
            ctx.stroke();
            
            // suction cups
            ctx.fillStyle = '#fca5a5';
            ctx.beginPath();
            ctx.arc(tx + sway*0.5, ty - height*0.3, 1.5 * scale, 0, Math.PI*2);
            ctx.arc(tx + sway*1.0, ty - height*0.7, 1.5 * scale, 0, Math.PI*2);
            ctx.fill();
        }
        
        ctx.restore();
        
        if (false) {
            ctx.save();
            ctx.translate(this.eyeMiniBoss.x, this.eyeMiniBoss.y);
            const shieldScale = 1.0 + Math.sin(Date.now() / 200) * 0.05;
            ctx.scale(shieldScale, shieldScale);
            
            ctx.beginPath();
            ctx.arc(0, 0, 180, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(167, 139, 250, 0.8)'; // purple-ish shield
            ctx.lineWidth = 6;
            ctx.stroke();
            
            ctx.fillStyle = 'rgba(167, 139, 250, 0.15)';
            ctx.fill();
            
            // Shield HP text
            ctx.fillStyle = 'white';
            ctx.font = '20px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.eyeMiniBoss.shieldHp + " / " + this.eyeMiniBoss.maxShieldHp, 0, 220);
            
            ctx.restore();
        }
    }

    // Horizon edge glow
    ctx.fillStyle = lerpColor('#fbbf24', '#7f1d1d', transitionProgress);
    ctx.fillRect(0, horizonY - 5, ROOM_WIDTH, 10);
    ctx.fillStyle = lerpColor('#d97706', '#450a0a', transitionProgress);
    ctx.fillRect(0, horizonY + 5, ROOM_WIDTH, 5);

    // God rays
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const numRays = 8;
    const rayTime = Date.now() / 2000;
    for (let i = 0; i < numRays; i++) {
        const x = (i * 300 + (rayTime * 50) % 300) % (ROOM_WIDTH + 1000) - 500;
        const angle = Math.PI / 6 + Math.sin(rayTime + i) * 0.05; // Diagonal rays
        const rayWidth = 100 + Math.sin(rayTime * 0.5 + i) * 50;
        
        const grad = ctx.createLinearGradient(x, 0, x + Math.cos(angle) * ROOM_HEIGHT, Math.sin(angle) * ROOM_HEIGHT);
        grad.addColorStop(0, this.enemy.phase >= 2 ? 'rgba(255, 100, 100, 0.15)' : 'rgba(255, 255, 200, 0.15)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + rayWidth, 0);
        ctx.lineTo(x + rayWidth + Math.cos(angle) * ROOM_HEIGHT, Math.sin(angle) * ROOM_HEIGHT);
        ctx.lineTo(x + Math.cos(angle) * ROOM_HEIGHT, Math.sin(angle) * ROOM_HEIGHT);
        ctx.fill();
    }
    
    // Floating particles (Epic atmosphere)
    for (let i = 0; i < 40; i++) {
        const px = ((i * 179 + rayTime * 40) % (ROOM_WIDTH + 200)) - 100;
        const rawY = (i * 313 - rayTime * 60) % ROOM_HEIGHT;
        const py = rawY < 0 ? rawY + ROOM_HEIGHT : rawY;
        const pSize = 2 + Math.sin(rayTime * 2 + i) * 1.5;
        ctx.globalAlpha = Math.max(0, Math.sin(rayTime * 3 + i));
        ctx.fillStyle = this.enemy.phase >= 2 ? '#fca5a5' : '#fef08a';
        ctx.beginPath();
        ctx.arc(px, py, pSize, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    } else {
        // Phase 3 Meat Background
        const timePhase3 = Date.now() / 1000;
        
        // Deep background gradient (pulsating dark crimson)
        const pulseBg = 0.5 + Math.sin(timePhase3 * 1.5) * 0.1;
        const bgGrad = ctx.createLinearGradient(0, 0, 0, ROOM_HEIGHT);
        bgGrad.addColorStop(0, `rgba(40, 5, 5, 1)`);
        bgGrad.addColorStop(1, `rgba(${Math.floor(80 * pulseBg)}, 0, 0, 1)`);
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
        
        // Meat wall base
        ctx.fillStyle = '#5c1010';
        ctx.fillRect(0, 0, ROOM_WIDTH, FLOOR_Y - 50);

        ctx.save();
        
        // Huge organic shapes (muscles / tissue)
        ctx.globalCompositeOperation = 'source-over';
        for(let i=0; i<40; i++) {
            ctx.fillStyle = i % 3 === 0 ? '#8a1c1c' : (i % 3 === 1 ? '#4a0a0a' : '#731313');
            ctx.globalAlpha = 0.5 + Math.sin(timePhase3 + i)*0.1;
            ctx.beginPath();
            const w = 120 + Math.sin(timePhase3 * 0.8 + i) * 30;
            const h = 200 + Math.cos(timePhase3 * 0.7 + i) * 40;
            ctx.ellipse(
                (i * 137) % ROOM_WIDTH,
                (i * 419) % (FLOOR_Y - 50),
                w, h,
                Math.sin(timePhase3 * 0.3 + i), 0, Math.PI*2
            );
            ctx.fill();
        }

        // Throbbing Veins
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 0; i < 15; i++) {
            const startX = (i * 221) % ROOM_WIDTH;
            const startY = (i * 187) % (FLOOR_Y);
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            
            // Vein pulsing color
            const isBlueVein = i % 4 === 0;
            ctx.strokeStyle = isBlueVein ? `rgba(30, 20, 80, ${0.4 + Math.sin(timePhase3*3 + i)*0.2})` : `rgba(130, 10, 10, ${0.6 + Math.sin(timePhase3*4 + i)*0.3})`;
            ctx.lineWidth = 3 + Math.sin(timePhase3*5 + i) * 2;
            
            let currX = startX;
            let currY = startY;
            for(let j=0; j<5; j++) {
                currX += (Math.random() - 0.5) * 200 + (Math.sin(timePhase3 + i + j) * 50);
                currY += (Math.random() - 0.2) * 150;
                ctx.lineTo(currX, currY);
            }
            ctx.stroke();
        }

        // Draw Creepy Eyes looking at player
        ctx.globalAlpha = 1.0;
        for(let i=0; i<18; i++) {
            const eyeX = 100 + (i * 311) % (ROOM_WIDTH - 200);
            const eyeY = 100 + (i * 257) % (FLOOR_Y - 150);
            
            // Eye socket
            ctx.fillStyle = '#2c0404';
            ctx.beginPath();
            ctx.ellipse(eyeX, eyeY, 35, 20 + Math.sin(timePhase3*1.5 + i)*8, 0, 0, Math.PI*2);
            ctx.fill();
            
            // Sclera (reddish white)
            ctx.fillStyle = '#ffcccc';
            ctx.beginPath();
            const eyeOpenness = 12 + Math.sin(timePhase3*2 + i)*6;
            if (eyeOpenness > 0) {
                ctx.ellipse(eyeX, eyeY, 28, eyeOpenness, 0, 0, Math.PI*2);
                ctx.fill();
                
                // Iris/Pupil tracking player
                const angleToPlayer = Math.atan2(this.player.y - eyeY, this.player.x - eyeX);
                const lookDist = Math.min(10, Math.hypot(this.player.y - eyeY, this.player.x - eyeX) * 0.02);
                const pupilX = eyeX + Math.cos(angleToPlayer) * lookDist;
                const pupilY = eyeY + Math.sin(angleToPlayer) * lookDist * (eyeOpenness/28); // Flatten Y based on openness
                
                ctx.fillStyle = i % 3 === 0 ? '#111' : '#facc15'; // Some black, some yellow
                ctx.beginPath();
                ctx.arc(pupilX, pupilY, 6, 0, Math.PI*2);
                ctx.fill();
                
                // Slit pupil for yellow eyes
                if (i % 3 !== 0) {
                    ctx.fillStyle = '#000';
                    ctx.beginPath();
                    ctx.ellipse(pupilX, pupilY, 2, 5, 0, 0, Math.PI*2);
                    ctx.fill();
                }
            }
        }
        
        // Draw Jagged Mouths
        for(let i=0; i<12; i++) {
            const mX = 150 + (i * 401) % (ROOM_WIDTH - 300);
            const mY = 150 + (i * 367) % (FLOOR_Y - 150);
            const open = Math.max(0, Math.sin(timePhase3 * 2.5 + i) * 20);
            
            if (open > 2) {
                // Mouth interior
                ctx.fillStyle = '#0a0000';
                ctx.beginPath();
                ctx.moveTo(mX - 45, mY);
                ctx.quadraticCurveTo(mX, mY - open, mX + 45, mY);
                ctx.quadraticCurveTo(mX, mY + open, mX - 45, mY);
                ctx.fill();
                
                // Teeth
                ctx.fillStyle = '#e5e5e5';
                ctx.beginPath();
                // Top teeth
                for(let t=-30; t<=30; t+=15) {
                    const toothDrop = open * 0.4 * Math.random() + 2;
                    ctx.moveTo(mX + t - 5, mY - open * (1 - Math.abs(t)/45) * 0.5);
                    ctx.lineTo(mX + t, mY - open * (1 - Math.abs(t)/45) * 0.5 + toothDrop);
                    ctx.lineTo(mX + t + 5, mY - open * (1 - Math.abs(t)/45) * 0.5);
                }
                // Bottom teeth
                for(let t=-30; t<=30; t+=15) {
                    const toothRise = open * 0.4 * Math.random() + 2;
                    ctx.moveTo(mX + t - 5, mY + open * (1 - Math.abs(t)/45) * 0.5);
                    ctx.lineTo(mX + t, mY + open * (1 - Math.abs(t)/45) * 0.5 - toothRise);
                    ctx.lineTo(mX + t + 5, mY + open * (1 - Math.abs(t)/45) * 0.5);
                }
                ctx.fill();
                
                // Lips
                ctx.strokeStyle = '#3a0202';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(mX - 45, mY);
                ctx.quadraticCurveTo(mX, mY - open, mX + 45, mY);
                ctx.quadraticCurveTo(mX, mY + open, mX - 45, mY);
                ctx.stroke();
            }
        }
        ctx.restore();

        // Irregular side walls (Stone)
        ctx.fillStyle = '#292524'; // Stone 800
        ctx.beginPath();
        ctx.moveTo(0, 0);
        for(let i=0; i<=ROOM_HEIGHT; i+=50) {
            ctx.lineTo(150 + Math.sin(i*0.02)*60, i);
        }
        ctx.lineTo(0, ROOM_HEIGHT);
        ctx.fill();
        ctx.strokeStyle = '#1c1917';
        ctx.lineWidth = 10;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(ROOM_WIDTH, 0);
        for(let i=0; i<=ROOM_HEIGHT; i+=50) {
            ctx.lineTo(ROOM_WIDTH - 150 + Math.cos(i*0.02)*60, i);
        }
        ctx.lineTo(ROOM_WIDTH, ROOM_HEIGHT);
        ctx.fill();
        ctx.stroke();
        
        // Floor is a giant dark hole - fade at the bottom
        const holeGrad = ctx.createLinearGradient(0, FLOOR_Y - 200, 0, FLOOR_Y + 100);
        holeGrad.addColorStop(0, 'rgba(0,0,0,0)');
        holeGrad.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = holeGrad;
        ctx.fillRect(0, FLOOR_Y - 200, ROOM_WIDTH, 300);
    }
    
    // Draw Platforms
    const time = Date.now() / 1000;
    
    // Spawn floating particles for platforms randomly
    if (this.platforms.length > 0 && Math.random() < 0.2) {
        const randomPlat = this.platforms[Math.floor(Math.random() * this.platforms.length)];
        this.particles.push({
            x: randomPlat.x + Math.random() * randomPlat.width,
            y: randomPlat.currentY + 20,
            vx: (Math.random() - 0.5) * 20,
            vy: 20 + Math.random() * 30, // Move downwards slowly
            life: 0.5 + Math.random() * 1.0,
            color: '#fef08a'
        });
    }

    for (let i = 0; i < this.platforms.length; i++) {
        const plat = this.platforms[i];
        
        // Float animation
        const floatOffset = Math.sin(time * 2 + i) * 5;
        
        // Draw the round platform top
        ctx.save();
        ctx.translate(plat.x + plat.width / 2, plat.currentY + floatOffset);
        
        // The platform is an ellipse
        ctx.fillStyle = this.enemy.phase >= 3 ? '#44403c' : '#f8fafc'; // Stone for phase 3, marble for others
        ctx.beginPath();
        ctx.ellipse(0, 0, plat.width / 2, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Golden rim
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 6;
        ctx.stroke();
        
        // Platform thickness (bottom part of the ellipse)
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.ellipse(0, 8, plat.width / 2, 15, 0, 0, Math.PI, false);
        ctx.lineTo(-plat.width / 2, 0);
        ctx.ellipse(0, 0, plat.width / 2, 15, 0, Math.PI, 0, true);
        ctx.fill();
        
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(0, 8, plat.width / 2, 15, 0, 0, Math.PI, false);
        ctx.stroke();
        
        ctx.restore();
    }

    // Lava drawing moved to floor perspective section

    // Draw playerProjectiles (Dream Sword Arcs)
    for (const p of this.playerProjectiles) {
        ctx.fillStyle = '#c084fc'; // Purple glow
        ctx.shadowColor = '#d8b4fe';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        // trail
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.1, p.y - p.vy * 0.1);
        ctx.strokeStyle = 'rgba(216, 180, 254, 0.8)';
        ctx.lineWidth = p.radius;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // Draw Player
    ctx.save();
    ctx.translate(this.player.x, this.player.y);
    
    // Auras
    if (this.player.buffTimer > 0) {
        ctx.fillStyle = 'rgba(234, 179, 8, 0.3)'; // yellow aura
        ctx.beginPath();
        ctx.ellipse(0, 0, 40, 60, 0, 0, Math.PI*2);
        ctx.fill();
    }
    if (this.player.healingTimer > 0) {
        ctx.fillStyle = 'rgba(168, 85, 247, 0.3)'; // purple aura
        ctx.beginPath();
        ctx.ellipse(0, 0, 40, 60, 0, 0, Math.PI*2);
        ctx.fill();
    }

    // Walk & Jump Bobbing
    let bobY = 0;
    let bodyTilt = 0;
    
    if (this.player.isDashing) {
        bodyTilt = Math.PI / 4; // Lean forward a lot
        ctx.globalAlpha = 0.6; // Ghostly when dashing
        
        // Dash trail effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        for(let i=1; i<=3; i++) {
            ctx.beginPath();
            ctx.arc(-i * 20 * (this.player.facingRight ? 1 : -1), 0, 15, 0, Math.PI*2);
            ctx.fill();
        }
    } else if (!this.player.isGrounded) {
        bobY = this.player.vy < 0 ? 5 : -5;
        bodyTilt = this.player.vy < 0 ? -Math.PI / 12 : Math.PI / 12; // Lean up/down
    } else {
        bobY = Math.abs(Math.sin(this.player.walkAnim)) * 8;
        bodyTilt = Math.sin(this.player.walkAnim) * 0.1;
    }
    
    if (this.player.healingTimer > 0) {
        bobY = Math.sin(this.player.healingTimer * 10) * 4; // Floating heal
    }
    
    // --- Player Body ---
    ctx.save();
    ctx.translate(0, -bobY - 15);
    
    // Double jump flip
    if (this.player.doubleJumpFlipTimer > 0) {
        const flipProgress = 1 - (this.player.doubleJumpFlipTimer / 0.4);
        const flipAngle = flipProgress * Math.PI * 2 * (this.player.facingRight ? 1 : -1);
        ctx.rotate(flipAngle);
    } else {
        ctx.rotate(bodyTilt);
    }
    ctx.scale(1.5, 1.5);
    if (!this.player.facingRight) ctx.scale(-1, 1);
    
    // Hit flash
    if (this.player.invulnerableTimer > 0 && !this.player.isDashing) {
        ctx.globalAlpha = (Math.floor(this.player.invulnerableTimer * 20) % 2 === 0) ? 0.5 : 1.0;
    }

    if (this.character === 'witch') {
        // Legs (gray skin)
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        // Back leg
        ctx.moveTo(-4, -5);
        if (!this.player.isGrounded && !this.player.isDashing) {
            ctx.lineTo(-12, 12);
            ctx.lineTo(-6, 26);
        } else if (this.player.isDashing) {
            ctx.lineTo(-18, 14);
            ctx.lineTo(-28, 18);
        } else {
            ctx.lineTo(-7 + Math.sin(this.player.walkAnim) * 14, 12);
            ctx.lineTo(-5 + Math.sin(this.player.walkAnim) * 18, 30);
        }
        // Front leg
        ctx.moveTo(6, -5);
        if (!this.player.isGrounded && !this.player.isDashing) {
            ctx.lineTo(12, 12);
            ctx.lineTo(6, 28);
        } else if (this.player.isDashing) {
            ctx.lineTo(-4, 16);
            ctx.lineTo(-16, 26);
        } else {
            ctx.lineTo(7 - Math.sin(this.player.walkAnim) * 14, 12);
            ctx.lineTo(5 - Math.sin(this.player.walkAnim) * 18, 30);
        }
        ctx.stroke();

        // Staff on back
        if (!this.player.isAttacking) {
            ctx.save();
            ctx.translate(-14, -12);
            ctx.rotate(-Math.PI / 4.5);
            ctx.fillStyle = '#451a03'; // dark wood
            ctx.fillRect(-1.5, -35, 3, 70);
            
            // Crescent moon gem
            ctx.fillStyle = '#a855f7'; 
            ctx.shadowColor = '#d8b4fe';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(0, -35, 8, -Math.PI/2, Math.PI/2, false);
            ctx.arc(4, -35, 6, Math.PI/2, -Math.PI/2, true);
            ctx.fill();
            ctx.restore();
        }

        // Detailed Cloak
        const cloakTrailX = this.player.isDashing ? -45 : -25 - Math.abs(this.player.vx) * 0.08;
        const cloakTrailY = !this.player.isGrounded ? 10 : 20 + Math.sin(this.player.walkAnim*2)*3;
        
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(10, -32);
        ctx.bezierCurveTo(18, -15, 20, 5, 14, 20); // Front fold
        ctx.lineTo(cloakTrailX, cloakTrailY); // Back tip
        ctx.bezierCurveTo(-22, 0, -18, -25, -12, -32); // Back edge
        ctx.fill();
        
        // Cloak secondary layer (purple trim)
        ctx.fillStyle = '#312e81';
        ctx.beginPath();
        ctx.moveTo(8, -30);
        ctx.bezierCurveTo(15, -15, 16, 5, 12, 18);
        ctx.lineTo(cloakTrailX + 10, cloakTrailY - 5);
        ctx.bezierCurveTo(-15, 0, -14, -22, -10, -30);
        ctx.fill();

        // Glowing trim
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(10, -32);
        ctx.bezierCurveTo(18, -15, 20, 5, 14, 20);
        ctx.lineTo(cloakTrailX, cloakTrailY);
        ctx.stroke();

        // Floating mystical scarf
        const time = Date.now() / 200;
        ctx.strokeStyle = '#e879f9';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, -25);
        ctx.quadraticCurveTo(-25, -30 + Math.sin(time)*5, -35, -20 + Math.cos(time)*5);
        ctx.quadraticCurveTo(-45, -10 + Math.sin(time)*5, -40, 0 + Math.cos(time)*5);
        ctx.stroke();

        // Arms (gray skin)
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(6, -18);
        if (this.player.healingTimer > 0 || this.keys.secondary) {
            ctx.lineTo(14, -35);
        } else if (this.player.isAttacking) {
            const armAngle = this.player.facingRight ? this.player.attackAngle : Math.PI - this.player.attackAngle;
            ctx.lineTo(6 + Math.cos(armAngle)*14, -18 + Math.sin(armAngle)*14);
        } else {
            ctx.lineTo(10 + Math.sin(this.player.walkAnim) * 8, -2 - Math.cos(this.player.walkAnim)*2);
        }
        ctx.stroke();

        // Head / Hood back
        ctx.fillStyle = '#0f172a'; 
        ctx.beginPath();
        ctx.moveTo(-6, -22);
        ctx.bezierCurveTo(-28, -38, -24, -62, -4, -62);
        ctx.bezierCurveTo(18, -62, 24, -45, 18, -32);
        ctx.lineTo(8, -25);
        ctx.lineTo(4, -20);
        ctx.fill();
        
        // Face void
        ctx.fillStyle = '#020617'; 
        ctx.beginPath();
        ctx.moveTo(9, -26);
        ctx.bezierCurveTo(2, -30, -2, -48, 10, -55);
        ctx.bezierCurveTo(16, -48, 18, -36, 9, -26); 
        ctx.fill();

        // Glowing Purple Eyes (More angular/mystical)
        ctx.fillStyle = '#d8b4fe';
        if (this.player.healingTimer > 0) ctx.fillStyle = '#fef08a';
        if (this.player.buffTimer > 0) ctx.fillStyle = '#f87171';
        
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        const eyeScaleY = this.player.isDashing ? 0.3 : 1;
        ctx.moveTo(6, -38);
        ctx.quadraticCurveTo(12, -43 * eyeScaleY, 15, -36 * eyeScaleY);
        ctx.quadraticCurveTo(10, -36 * eyeScaleY, 6, -38);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-1, -38);
        ctx.quadraticCurveTo(5, -42 * eyeScaleY, 7, -37 * eyeScaleY);
        ctx.quadraticCurveTo(3, -36 * eyeScaleY, -1, -38);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Giant Witch Hat
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        // Hat Base
        ctx.moveTo(-20, -58);
        ctx.bezierCurveTo(0, -66, 25, -62, 35, -54);
        ctx.lineTo(25, -52);
        ctx.bezierCurveTo(5, -58, -15, -54, -20, -58);
        ctx.fill();
        
        // Hat Cone
        ctx.beginPath();
        ctx.moveTo(-12, -58);
        ctx.bezierCurveTo(-15, -75, -5, -95, 25, -110); // bent tip
        ctx.bezierCurveTo(15, -85, 12, -70, 16, -58);
        ctx.fill();

        // Hat band
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-11, -61);
        ctx.bezierCurveTo(0, -65, 10, -63, 15, -61);
        ctx.stroke();
        ctx.stroke();

    } else {
        // Legs (More fluid and stylized)
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        // Back leg
        ctx.moveTo(-4, -5);
        if (!this.player.isGrounded && !this.player.isDashing) {
            ctx.lineTo(-12, 12);
            ctx.lineTo(-6, 26);
        } else if (this.player.isDashing) {
            ctx.lineTo(-18, 14);
            ctx.lineTo(-28, 18);
        } else {
            ctx.lineTo(-7 + Math.sin(this.player.walkAnim) * 14, 12);
            ctx.lineTo(-5 + Math.sin(this.player.walkAnim) * 18, 30);
        }
        // Front leg
        ctx.moveTo(6, -5);
        if (!this.player.isGrounded && !this.player.isDashing) {
            ctx.lineTo(12, 12);
            ctx.lineTo(6, 28);
        } else if (this.player.isDashing) {
            ctx.lineTo(-4, 16);
            ctx.lineTo(-16, 26);
        } else {
            ctx.lineTo(7 - Math.sin(this.player.walkAnim) * 14, 12);
            ctx.lineTo(5 - Math.sin(this.player.walkAnim) * 18, 30);
        }
        ctx.stroke();

        // Sword on back
        if (!this.player.isAttacking) {
            ctx.save();
            ctx.translate(-14, -12);
            ctx.rotate(-Math.PI / 4.5);
            ctx.fillStyle = '#cbd5e1'; // blade
            ctx.beginPath();
            ctx.moveTo(-4, 25); ctx.lineTo(-1, -25); ctx.lineTo(1, -25); ctx.lineTo(4, 25);
            ctx.fill();
            ctx.fillStyle = '#1d4ed8'; // crossguard
            ctx.fillRect(-10, 18, 20, 5);
            // gem
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath(); ctx.arc(0, 20, 3, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }

        // Detailed Cloak
        const cloakTrailX = this.player.isDashing ? -45 : -25 - Math.abs(this.player.vx) * 0.08;
        const cloakTrailY = !this.player.isGrounded ? 10 : 20 + Math.sin(this.player.walkAnim*2)*3;
        
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(10, -32);
        ctx.lineTo(-14, -8);
        ctx.lineTo(cloakTrailX, cloakTrailY);
        ctx.fill();

        const gradient = ctx.createLinearGradient(0, -40, 0, 20);
        gradient.addColorStop(0, '#2563eb');
        gradient.addColorStop(1, '#1e3a8a');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(10, -34);
        ctx.bezierCurveTo(16, -20, 16, -5, 14, 14);
        ctx.lineTo(cloakTrailX, cloakTrailY);
        ctx.bezierCurveTo(-20, -10, -16, -25, -12, -34);
        ctx.fill();
        
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(10, -34);
        ctx.bezierCurveTo(16, -20, 16, -5, 14, 14);
        ctx.lineTo(cloakTrailX, cloakTrailY);
        ctx.stroke();

        // Arms (Dynamic swinging)
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(6, -18);
        if (this.player.healingTimer > 0 || this.player.isShielding) {
            ctx.lineTo(14, -32);
        } else if (this.player.isAttacking) {
            const armAngle = this.player.facingRight ? this.player.attackAngle : Math.PI - this.player.attackAngle;
            ctx.lineTo(6 + Math.cos(armAngle)*12, -18 + Math.sin(armAngle)*12);
        } else {
            ctx.lineTo(12 + Math.sin(this.player.walkAnim) * 10, -2 - Math.cos(this.player.walkAnim)*3);
        }
        ctx.stroke();

        // Head / Hood
        ctx.fillStyle = '#1e40af'; 
        ctx.beginPath();
        ctx.moveTo(-6, -22);
        ctx.bezierCurveTo(-25, -38, -22, -58, -4, -58);
        ctx.bezierCurveTo(15, -58, 22, -45, 18, -32);
        ctx.lineTo(8, -25);
        ctx.lineTo(4, -20);
        ctx.fill();

        // Hood trim
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(18, -32);
        ctx.lineTo(8, -25);
        ctx.stroke();

        // Face void
        ctx.fillStyle = '#020617'; 
        ctx.beginPath();
        ctx.moveTo(9, -26);
        ctx.bezierCurveTo(2, -30, 0, -46, 12, -52);
        ctx.bezierCurveTo(16, -46, 18, -36, 9, -26); 
        ctx.fill();

        // Radiant Glowing Eyes
        ctx.fillStyle = '#fef08a';
        if (this.player.healingTimer > 0) ctx.fillStyle = '#d8b4fe';
        if (this.player.buffTimer > 0) ctx.fillStyle = '#f87171';
        
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        const eyeScaleY = this.player.isDashing ? 0.3 : 1;
        ctx.moveTo(6, -38);
        ctx.quadraticCurveTo(12, -43 * eyeScaleY, 15, -36 * eyeScaleY);
        ctx.quadraticCurveTo(10, -36 * eyeScaleY, 6, -38);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(10, -38, 2, 0, Math.PI*2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.shadowBlur = 0;

        // Detailed Crown
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(-4, -54);
        ctx.lineTo(-14, -72);
        ctx.lineTo(-4, -62);
        ctx.lineTo(6, -78);
        ctx.lineTo(12, -62);
        ctx.lineTo(22, -70);
        ctx.lineTo(16, -50);
        ctx.fill();
        
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath(); ctx.moveTo(-4, -54); ctx.lineTo(-14, -72); ctx.lineTo(-8, -64); ctx.fill();
        ctx.beginPath(); ctx.moveTo(6, -60); ctx.lineTo(6, -78); ctx.lineTo(10, -64); ctx.fill();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath(); ctx.arc(6, -62, 2, 0, Math.PI*2); ctx.fill();

        // Diamond Pendant 
        ctx.fillStyle = '#fef08a';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(9, -19);
        ctx.lineTo(14, -12);
        ctx.lineTo(9, -5);
        ctx.lineTo(4, -12);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    
    // Shield
    if (this.character === 'knight' && this.player.isShielding) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.4)'; // Cyan transparent shield
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // A dome shield in front
        ctx.arc(15, -25, 30, -Math.PI/2, Math.PI/2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    ctx.restore(); // end body context

    // --- Player Sword Attack Visuals ---
    ctx.save();
    ctx.translate(0, -this.player.height/2 + 5);
    
    if (this.player.isAttacking) {
        ctx.rotate(this.player.attackAngle);
        
        // Easing out the slash progress for a snappy feel
        const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
        const rawProgress = 1 - (this.player.attackTimer / ATTACK_DURATION);
        const slashProgress = easeOutQuint(rawProgress);
        
        const isDream = this.player.swordType === 'dream';
        
        // Base glowing arc
        ctx.fillStyle = isDream ? `rgba(216, 180, 254, ${1 - rawProgress})` : `rgba(255, 255, 255, ${1 - rawProgress})`;
        ctx.shadowColor = isDream ? '#a855f7' : '#3b82f6';
        ctx.shadowBlur = 25;
        
        ctx.beginPath();
        const sweep = Math.PI * 1.5; // wider arc
        const startAng = -sweep * 0.6;
        const currentAng = startAng + sweep * slashProgress;
        
        ctx.arc(0, 0, ATTACK_RANGE + 15, startAng, currentAng, false);
        ctx.arc(0, 0, Math.max(10, ATTACK_RANGE - (isDream ? 15 : 45)), currentAng, startAng, true);
        ctx.closePath();
        ctx.fill();
        
        // Sharp inner slash line for impact
        ctx.strokeStyle = isDream ? `rgba(255, 255, 255, ${1 - rawProgress})` : `rgba(147, 197, 253, ${1 - rawProgress})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, ATTACK_RANGE, startAng, currentAng, false);
        ctx.stroke();

        ctx.shadowBlur = 0;
    }

    ctx.restore(); // end sword context
    ctx.restore(); // end player context

    // Draw Phase 3 Tentacles and Falling Eyes
    if (this.enemy.phase === 3) {
        ctx.save();
        ctx.strokeStyle = '#270303';
        ctx.fillStyle = '#450a0a';
        ctx.lineWidth = 25;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        for (const tentacle of this.tentacles) {
            const time = this.enemy.animTime * 2 + tentacle.timeOffset;
            let currentX = tentacle.x;
            let currentY = tentacle.baseY;
            ctx.beginPath();
            ctx.moveTo(currentX, currentY);
            let pX = currentX, pY = currentY;
            for (let i = 0; i < 8; i++) {
                currentX += Math.sin(time + i * 0.8) * 30;
                currentY -= 50 + Math.abs(Math.cos(time * 0.5)) * 30;
                ctx.lineTo(currentX, currentY);
                pX = currentX; pY = currentY;
                
                // Damage player if they touch the tentacle
                if (Math.hypot(this.player.x - pX, this.player.y - pY) < 40 && this.player.invulnerableTimer <= 0 && this.player.intangibleTimer <= 0) {
                    if (this.player.healingTimer <= 0) {
                        this.player.hp -= 1; this.hitEffectTimer = 0.5; this.screenShakeTimer = 0.2; this.screenShakeIntensity = 8;
                        this.player.invulnerableTimer = 3.0;
                        this.playSound('player_hit');
                        if (this.onPlayerHpChange) this.onPlayerHpChange(this.player.hp);
                    }
                }
            }
            ctx.stroke();
            
            // Draw suckers
            ctx.fillStyle = '#7f1d1d';
            let suckX = tentacle.x;
            let suckY = tentacle.baseY;
            for (let i = 0; i < 8; i++) {
                suckX += Math.sin(time + i * 0.8) * 30;
                suckY -= 50 + Math.abs(Math.cos(time * 0.5)) * 30;
                ctx.beginPath();
                ctx.arc(suckX + 15, suckY, 6, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // Draw Falling Eyes
        for (const eye of this.fallingEyes) {
            ctx.save();
            ctx.translate(eye.x, eye.y);
            // Wing flaps
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            const flap = Math.sin(this.enemy.animTime * 20) * 0.5;
            ctx.ellipse(-15, 0, 15, 5, flap, 0, Math.PI * 2);
            ctx.ellipse(15, 0, 15, 5, -flap, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#7f1d1d'; // Eye body
            ctx.beginPath();
            ctx.arc(0, 0, 12, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#fef08a'; // Sclera
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#000000'; // Pupil
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        
        ctx.restore();
    }

    // Draw Mobs
    for (const m of this.mobs) {
        ctx.save();
        ctx.translate(m.x, m.y);
        
        // Hit flash
        if (m.hitTimer > 0) {
            ctx.filter = 'brightness(200%)';
        }
          if (m.type === 'void_cultist') {
            const dirX = Math.sign(this.player.x - m.x);
            const floatOffset = Math.sin((m.animTimer || 0) * 3) * 10;
            
            ctx.save();
            ctx.translate(0, floatOffset);
            
            if (dirX < 0) {
                ctx.scale(-1, 1);
            }

            // Light Aura
            const auraGrad = ctx.createRadialGradient(0, -m.height/2, 5, 0, -m.height/2, 40);
            auraGrad.addColorStop(0, 'rgba(253, 224, 71, 0.5)'); // yellow-300
            auraGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
            ctx.fillStyle = auraGrad;
            ctx.beginPath();
            ctx.arc(0, -m.height/2, 50, 0, Math.PI * 2);
            ctx.fill();

            // Tattered Cloak (Body) - White/Yellow theme
            ctx.fillStyle = '#f8fafc'; // slate-50 (Whiteish)
            ctx.strokeStyle = '#fbbf24'; // amber-400
            ctx.lineWidth = 3;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(0, -m.height + 20); // neck
            ctx.quadraticCurveTo(-20, -m.height/2, -25, 0); // left side
            // tattered bottom
            ctx.lineTo(-15, -10);
            ctx.lineTo(-5, 0);
            ctx.lineTo(5, -15);
            ctx.lineTo(15, 0);
            ctx.lineTo(25, -10);
            ctx.quadraticCurveTo(20, -m.height/2, 0, -m.height + 20); // right side
            ctx.fill();
            ctx.stroke();

            // Glowing Orb Head
            ctx.fillStyle = '#1e293b'; // slate-800 for contrast
            ctx.beginPath();
            ctx.arc(0, -m.height + 15, 14, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowColor = '#fef08a'; // yellow-200
            ctx.shadowBlur = m.state === 'casting' ? 30 : 15;
            ctx.fillStyle = m.state === 'casting' ? '#ffffff' : '#fde047'; // yellow-300
            ctx.beginPath();
            ctx.arc(0, -m.height + 15, m.state === 'casting' ? 12 : 8, 0, Math.PI * 2);
            ctx.fill();
            
            // Ghostly hands
            ctx.shadowBlur = 10;
            const handY = m.state === 'casting' ? -m.height + 5 : -m.height/2;
            
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(25, handY, 6, 0, Math.PI*2);
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(-20, handY + 10, 6, 0, Math.PI*2);
            ctx.fill();
            
            ctx.restore();

        } else if (m.type === 'abyssal_ray') {
            const dirX = Math.sign(m.vx);
            const flap = Math.sin((m.animTimer || 0) * (m.state === 'diving' ? 15 : 5));
            
            ctx.save();
            // Tilt based on velocity
            const tilt = Math.atan2(m.vy, m.vx);
            ctx.rotate(tilt);
            
            // Tail
            ctx.strokeStyle = '#450a0a';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-20, 0);
            ctx.quadraticCurveTo(-40, flap * 15, -50, 0);
            ctx.stroke();
            
            // Main Body (Manta Ray shape)
            ctx.fillStyle = '#2a0a0a';
            ctx.strokeStyle = '#7f1d1d';
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(30, 0); // nose
            ctx.quadraticCurveTo(0, 10, -20, 0); // back
            ctx.quadraticCurveTo(0, -10, 30, 0); // top
            ctx.fill();
            ctx.stroke();
            
            // Wings
            ctx.fillStyle = '#1c1917';
            ctx.beginPath();
            ctx.moveTo(10, 0);
            ctx.quadraticCurveTo(-5, 20 * flap, -20, 30 * flap);
            ctx.quadraticCurveTo(-15, 10 * flap, -15, 0);
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(10, 0);
            ctx.quadraticCurveTo(-5, -20 * flap, -20, -30 * flap);
            ctx.quadraticCurveTo(-15, -10 * flap, -15, 0);
            ctx.fill();
            ctx.stroke();
            
            // Multiple eyes on the front/top
            ctx.fillStyle = '#fef08a';
            ctx.shadowColor = '#fef08a';
            ctx.shadowBlur = 5;
            ctx.beginPath();
            ctx.arc(15, -3, 3, 0, Math.PI * 2);
            ctx.arc(15, 3, 3, 0, Math.PI * 2);
            ctx.arc(22, 0, 2, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#000000';
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(16, -3, 1, 0, Math.PI * 2);
            ctx.arc(16, 3, 1, 0, Math.PI * 2);
            ctx.arc(23, 0, 1, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
        
        ctx.restore();
    }
    
    // Draw Enemy
    if (this.enemy.state === 'hidden') {
       // Do not draw enemy
    } else if (this.enemy.hp > 0 || this.enemy.state.startsWith('death_') || this.enemy.state.startsWith('dead') || this.enemy.phase >= 3) {
      if (this.enemy.state === 'intro' || this.enemy.state === 'intro_landing') {
          // Huge pillar of divine light tracking the boss
          ctx.save();
          const lightIntensity = this.enemy.state === 'intro' ? Math.min(1.0, (10 - this.enemy.stateTimer) / 2.0) : (this.enemy.stateTimer / 3.0);
          const grd = ctx.createLinearGradient(this.enemy.x - 300, 0, this.enemy.x + 300, 0);
          grd.addColorStop(0, 'rgba(255, 255, 255, 0)');
          grd.addColorStop(0.5, `rgba(255, 255, 200, ${lightIntensity})`);
          grd.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = grd;
          ctx.fillRect(this.enemy.x - 300, 0, 600, ROOM_HEIGHT);
          ctx.restore();
      }
      
      ctx.save();
      ctx.translate(this.enemy.x, this.enemy.y);
      
      // Draw Phase 1 Shield
      if (this.enemy.phase === 1 && this.enemy.shieldHp > 0) {
          ctx.save();
          const shieldTime = Date.now() / 1000;
          const shieldAlpha = this.enemy.shieldHp / this.enemy.maxShieldHp;
          ctx.globalAlpha = 0.5 * shieldAlpha + 0.3;
          
          const pulse = Math.sin(shieldTime * 4) * 10;
          
          // Inner glowing aura
          ctx.fillStyle = 'rgba(253, 224, 71, 0.15)'; // faint yellow
          ctx.beginPath();
          ctx.arc(0, 0, 160 + pulse, 0, Math.PI * 2);
          ctx.fill();

          ctx.shadowColor = '#fde047';
          ctx.shadowBlur = 25;
          ctx.lineCap = 'round';
          
          // Outer clockwise ring (3 segments)
          ctx.save();
          ctx.rotate(shieldTime);
          ctx.strokeStyle = '#fef08a'; 
          ctx.lineWidth = 6;
          for (let i = 0; i < 3; i++) {
              ctx.beginPath();
              ctx.arc(0, 0, 170 + pulse/2, (i * Math.PI * 2 / 3), (i * Math.PI * 2 / 3) + Math.PI * 0.4);
              ctx.stroke();
          }
          ctx.restore();

          // Inner counter-clockwise ring (2 segments)
          ctx.save();
          ctx.rotate(-shieldTime * 1.5);
          ctx.strokeStyle = '#fde047'; 
          ctx.lineWidth = 4;
          for (let i = 0; i < 2; i++) {
              ctx.beginPath();
              ctx.arc(0, 0, 140 - pulse/2, (i * Math.PI), (i * Math.PI) + Math.PI * 0.6);
              ctx.stroke();
          }
          ctx.restore();
          
          // Orbital energy orbs
          ctx.save();
          ctx.rotate(shieldTime * 2);
          for (let i = 0; i < 4; i++) {
             ctx.rotate(Math.PI / 2);
             ctx.fillStyle = '#ffffff';
             ctx.beginPath();
             ctx.arc(155, 0, 4, 0, Math.PI * 2);
             ctx.fill();
          }
          ctx.restore();

          ctx.restore();
      }
      
      ctx.scale(2.6, 2.6);
      if (!this.enemy.facingRight) ctx.scale(-1, 1);
      
      if (this.enemy.state === 'dead_phase3' && this.enemy.scale !== undefined) {
          ctx.globalAlpha = Math.max(0, this.enemy.scale);
          ctx.scale(this.enemy.scale, this.enemy.scale);
      }
      if (this.enemy.state === 'teleport') {
          let alpha = 1;
          if (this.enemy.teleportTimer > 0.5) {
              alpha = (this.enemy.teleportTimer - 0.5) / 0.5; // 1 to 0
          } else {
              alpha = 1 - (this.enemy.teleportTimer / 0.5); // 0 to 1
          }
          ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      }
      
      // Debug logs
    ctx.save();
    ctx.fillStyle = 'white';
    ctx.font = '16px monospace';
    ctx.textAlign = 'left';
    this.debugLogs.forEach((log, i) => {
        ctx.fillText(log, 10, 20 + i * 20);
    });
    ctx.restore();
    
    // Hit flash
      if (this.enemy.invulnerableTimer > 0) {
          // Less flickering, smoother visual
          ctx.globalAlpha = 0.5 + Math.sin(this.enemy.invulnerableTimer * 30) * 0.3;
      }

      
      // Angel Boss - Drawing Logic
      const isPhase2 = this.enemy.phase >= 2;
      const baseColor = isPhase2 ? '#2a0a0a' : '#ffffff';
      const glowColor = isPhase2 ? '#991b1b' : '#06b6d4';
      const eyeColorP2 = isPhase2 ? '#fca5a5' : '#ffffff';
      const skinColor = isPhase2 ? '#1c1917' : '#f3f4f6';
      const boneColor = isPhase2 ? '#450a0a' : '#e5e7eb';
      const armorColor = isPhase2 ? '#7f1d1d' : '#fbbf24';

      ctx.fillStyle = baseColor; 
      ctx.shadowColor = glowColor; // Cyan or Red glow
      ctx.shadowBlur = isPhase2 ? 50 : 35; // slightly increased glow
      
      let flapAnim = Math.sin(this.enemy.animTime * (isPhase2 ? 8 : 6)) * (isPhase2 ? 0.35 : 0.25); // smoother flap
      let wingSpread = 0;
      
      // Attack-based animations
      let armRaise = 0;
      let haloGlow = isPhase2 ? 30 : 15; // slightly more glow
      let eyeColor = eyeColorP2;
      
      if (this.enemy.state === 'stunned') {
          armRaise = -Math.PI / 8; // Arms hanging down
          wingSpread = -0.1;
          eyeColor = '#000000'; // Lights out
          haloGlow = 0;
          ctx.translate(Math.sin(this.enemy.animTime * 30) * 5, 0); // Shivering
      } else if (this.enemy.state.startsWith('death_') || this.enemy.state === 'dead' || this.enemy.state === 'dead_phase3') {
          flapAnim = -0.6; // Wings completely folded/crushed
          wingSpread = -0.5;
          armRaise = -Math.PI / 4;
          eyeColor = '#000000';
          haloGlow = 0;
          if (this.enemy.state === 'death_anim_1' || this.enemy.state === 'death_anim_2') {
             ctx.translate(Math.sin(this.enemy.animTime * 50) * 8, 0); // Violent shaking
          }
      } else if (this.enemy.state === 'divine_light' || this.enemy.state === 'void_gaze') {
          armRaise = Math.PI / 1.5; // Arms pointing forward
          eyeColor = isPhase2 ? '#ef4444' : '#fef08a';
          haloGlow = 30;
      } else if (this.enemy.state === 'heavens_break' || this.enemy.state === 'shadow_strike') {
          if (this.enemy.attackStep === 1) { // Jumping
              flapAnim = 0.5; // Wings pushed down
              armRaise = Math.PI; // Arms raised up
          } else if (this.enemy.attackStep === 2) { // Plunging
              flapAnim = -0.5; // Wings folded up
              armRaise = -Math.PI / 4; // Arms pointing down
          }
          eyeColor = isPhase2 ? '#b91c1c' : '#fca5a5';
          haloGlow = 35;
      } else if (this.enemy.state === 'meteor_shower' || this.enemy.state === 'blood_rain') {
          armRaise = Math.PI; // Arms raised up to the sky
          wingSpread = 0.35; // Wings spread wide
          eyeColor = isPhase2 ? '#991b1b' : '#fb923c';
          haloGlow = 45;
      } else if (this.enemy.state === 'holy_nova' || this.enemy.state === 'abyssal_nova' || this.enemy.state === 'transition') {
          armRaise = Math.PI * 1.5; // Arms out or up
          wingSpread = 0.55; // Wings wide open
          eyeColor = isPhase2 ? '#7f1d1d' : '#eab308';
          haloGlow = 55;
      }
      
      const drawFeatheredWing = (baseAngle, scaleX, scaleY) => {
          ctx.save();
          ctx.rotate(baseAngle);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          if (isPhase2) {
              // Fleshy tentacles with waving effect
              const wave = Math.sin(this.enemy.animTime * 4 + baseAngle) * 15;
              ctx.bezierCurveTo(30 * scaleX, (10 + wave) * scaleY, 60 * scaleX, (-40 + wave) * scaleY, 110 * scaleX, (-20 - wave) * scaleY);
              ctx.bezierCurveTo(90 * scaleX, (0 - wave) * scaleY, 50 * scaleX, (20 - wave) * scaleY, 0 * scaleX, 10 * scaleY);
          } else {
              ctx.bezierCurveTo(22 * scaleX, -11 * scaleY, 44 * scaleX, -16 * scaleY, 66 * scaleX, -5 * scaleY);
              ctx.bezierCurveTo(77 * scaleX, 0 * scaleY, 88 * scaleX, 11 * scaleY, 93 * scaleX, 27 * scaleY);
              ctx.bezierCurveTo(66 * scaleX, 22 * scaleY, 44 * scaleX, 16 * scaleY, 22 * scaleX, 11 * scaleY);
          }
          ctx.closePath();
          ctx.fill();
          if (!isPhase2) {
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = 1;
              ctx.stroke();
          }
          
          if (isPhase2) {
              // Add eyes to tentacles
              ctx.fillStyle = '#fca5a5';
              const time = this.enemy.animTime;
              for(let k = 1; k <= 3; k++) {
                  const x = 30 * k * scaleX;
                  const y = -5 * scaleY;
                  ctx.beginPath();
                  ctx.ellipse(x, y, 4, 2.5, 0, 0, Math.PI*2);
                  ctx.fill();
                  ctx.fillStyle = '#000000';
                  ctx.beginPath();
                  ctx.arc(x, y, 1.5, 0, Math.PI*2);
                  ctx.fill();
                  ctx.fillStyle = '#fca5a5';
              }
          } else {
              ctx.strokeStyle = glowColor;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(11 * scaleX, 2 * scaleY);
              ctx.bezierCurveTo(33 * scaleX, -2 * scaleY, 55 * scaleX, 0 * scaleY, 77 * scaleX, 11 * scaleY);
              ctx.stroke();
          }
          ctx.restore();
      };

      // In Phase 2 we draw the Eye merged on top
      if (isPhase2) {
         ctx.save();
         ctx.translate(0, -90);
         ctx.scale(0.5, 0.5); // scale down to fit the head
         
         // Base dark fleshy mass
         ctx.fillStyle = '#270303';
         ctx.beginPath();
         ctx.ellipse(0, 0, 90, 45, 0, 0, Math.PI * 2);
         ctx.fill();
         
         // Inner fleshy mass
         ctx.fillStyle = '#5c1616';
         ctx.beginPath();
         ctx.moveTo(-75, 0);
         ctx.bezierCurveTo(-50, -35, 50, -35, 75, 0);
         ctx.bezierCurveTo(50, 35, -50, 35, -75, 0);
         ctx.fill();
         
         // Outer tentacles and veins
         ctx.strokeStyle = '#3f0909';
         ctx.lineWidth = 6;
         ctx.lineCap = 'round';
         ctx.lineJoin = 'round';
         const time = Date.now() / 1000;
         for (let i = 0; i < 14; i++) {
             ctx.beginPath();
             const angle = (i / 14) * Math.PI * 2;
             const startDist = 35;
             const tX = Math.cos(angle);
             const tY = Math.sin(angle);
             ctx.moveTo(tX * startDist, tY * startDist);
             
             // Wriggling tentacles
             const cp1X = tX * 60 + Math.sin(time * 2 + i) * 15;
             const cp1Y = tY * 60 + Math.cos(time * 2 + i) * 15;
             const endX = tX * 85 + Math.sin(time * 3 + i) * 25;
             const endY = tY * 85 + Math.cos(time * 3 + i) * 25;
             
             ctx.quadraticCurveTo(cp1X, cp1Y, endX, endY);
             ctx.stroke();
             
             // Slime drips on bottom tentacles
             if (tY > 0) { 
                  ctx.fillStyle = 'rgba(120, 160, 50, 0.5)';
                  ctx.beginPath();
                  ctx.arc(endX, endY + Math.abs(Math.sin(time * 4 + i)) * 10, 2, 0, Math.PI * 2);
                  ctx.fill();
             }
         }
         
         // Fleshy eye socket
         ctx.fillStyle = '#7f1d1d';
         ctx.beginPath();
         ctx.ellipse(0, 0, 32, 22, 0, 0, Math.PI * 2);
         ctx.fill();

         // Eye tracking logic
         let targetX = this.player.x;
         let targetY = this.player.y;
         // Translate player relative to this scaled position for pupil logic
         // Not strictly accurate mathematically but gives a nice tracking feel
         const dx = (targetX - this.enemy.x) * (this.enemy.facingRight ? -1 : 1);
         const dy = (targetY - this.enemy.y);
         const dist = Math.hypot(dx, dy) + 0.001;
         const pupX = (dx / dist) * 10;
         const pupY = (dy / dist) * 6;

         // The Eye itself (Active in Phase 2)
         ctx.fillStyle = '#fef08a'; // Sickly yellow sclera
         ctx.beginPath();
         ctx.ellipse(0, 0, 28, 18, 0, 0, Math.PI * 2);
         ctx.fill();
         
         ctx.fillStyle = '#991b1b'; // Deep Red iris
         ctx.beginPath();
         ctx.arc(pupX, pupY, 12, 0, Math.PI * 2);
         ctx.fill();
         
         ctx.fillStyle = '#000000'; // Black pupil
         ctx.beginPath();
         ctx.arc(pupX, pupY, 5, 0, Math.PI * 2);
         ctx.fill();
         
         // Eye shine
         ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
         ctx.beginPath();
         ctx.arc(pupX - 4, pupY - 4, 3, 0, Math.PI * 2);
         ctx.fill();

         ctx.restore();
      }




      // Back tentacles for Phase 2
      if (isPhase2) {
          ctx.save();
          ctx.translate(0, -15);
          ctx.strokeStyle = '#450a0a';
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          for (let i = 0; i < 6; i++) {
              const angle = (i / 6) * Math.PI + Math.PI; // spreading upwards/outwards
              const sway = Math.sin(this.enemy.animTime * 3 + i) * 20;
              const len = 60 + Math.sin(this.enemy.animTime * 5 + i) * 10;
              ctx.save();
              ctx.rotate(angle + sway * 0.01);
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.quadraticCurveTo(20, len/2, sway, len);
              ctx.stroke();
              
              // suction cups
              ctx.fillStyle = '#fca5a5';
              ctx.beginPath();
              ctx.arc(10, len/3, 2, 0, Math.PI*2);
              ctx.arc(sway/2 + 5, len*0.6, 1.5, 0, Math.PI*2);
              ctx.fill();
              ctx.restore();
          }
          ctx.restore();
      }

      // Draw wings attached closely to the body
      ctx.save();
      ctx.translate(0, -15); // Anchor point for all wings (upper back)
      
      // Top wings
      drawFeatheredWing(-0.6 - flapAnim - wingSpread, -1.1, 1.1); // Left Top
      drawFeatheredWing(0.6 + flapAnim + wingSpread, 1.1, 1.1);   // Right Top
      
      // Middle wings
      drawFeatheredWing(-0.1 - flapAnim * 0.5 - wingSpread, -0.95, 0.95); // Left Mid
      drawFeatheredWing(0.1 + flapAnim * 0.5 + wingSpread, 0.95, 0.95);   // Right Mid
      
      // Bottom wings
      drawFeatheredWing(0.4 - flapAnim * 0.2, -0.75, 0.85); // Left Bottom
      drawFeatheredWing(-0.4 + flapAnim * 0.2, 0.75, 0.85); // Right Bottom
      
      ctx.restore();
      ctx.shadowBlur = 0; // reset

      // Lower Body (Organic/Monstrous Void)
      ctx.fillStyle = isPhase2 ? '#450a0a' : '#0f172a'; // dark void
      ctx.beginPath();
      // Thicker and more integrated base, slightly pulsing
      const voidPulse = Math.sin(this.enemy.animTime * 3) * 2;
      ctx.moveTo(-15, 0);
      ctx.quadraticCurveTo(-27 - voidPulse, 25, -17, 57);
      ctx.quadraticCurveTo(0, 67 + voidPulse, 17, 57);
      ctx.quadraticCurveTo(27 + voidPulse, 25, 17, 0);
      ctx.fill();
      
      // Glowing cyan veins on lower body
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 1.5;
      const veinOffset = Math.sin(this.enemy.animTime * 4) * 1;
      ctx.beginPath();
      ctx.moveTo(0, 5); 
      ctx.lineTo(-8 + veinOffset, 25); 
      ctx.lineTo(0, 55); 
      ctx.lineTo(12 - veinOffset, 30); 
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-3, 15); ctx.lineTo(-12, 35); ctx.lineTo(-4, 60);
      ctx.stroke();
      
      // Creepy red eyes scattered on lower body
      ctx.fillStyle = '#b91c1c'; 
      ctx.beginPath(); ctx.arc(-6, 30, 3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(8, 40, 2.5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(-10, 45, 3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(4, 60, 2.5, 0, Math.PI*2); ctx.fill();

      // Huge creepy bone/flesh legs
      // Leg movement animations
      let leftWalkAnim = 0;
      let rightWalkAnim = 0;
      if (this.enemy.vx !== 0 && this.enemy.state === 'idle') {
          leftWalkAnim = Math.sin(this.enemy.animTime * 8) * 0.25;
          rightWalkAnim = Math.sin(this.enemy.animTime * 8 + Math.PI) * 0.25;
      }
      
      const shootMouthOpen = this.enemy.legShootTimer < 0.3 || this.enemy.legShootTimer > 2.7;
      const mouthHeight = shootMouthOpen ? 8 : 3;

      const drawLeg = (isLeft: boolean, isBack: boolean) => {
          ctx.save();
          const sideMult = isLeft ? -1 : 1;
          const walkAnim = isLeft ? leftWalkAnim : rightWalkAnim;
          
          // Position & Animation
          ctx.translate(sideMult * 10, 10);
          ctx.rotate(walkAnim * (isBack ? 0.6 : 1.1));
          
          if (isBack) {
              ctx.scale(0.8, 0.8);
              ctx.translate(sideMult * -5, -10);
          }
          
          // Colors
          ctx.fillStyle = isBack ? (isPhase2 ? '#450a0a' : '#9ca3af') : boneColor; 
          ctx.strokeStyle = isPhase2 ? (isBack ? '#1f2937' : '#374151') : '#000000';
          ctx.lineWidth = isPhase2 ? 2.5 : 1.5;
          
          // Leg shape
          ctx.beginPath();
          ctx.moveTo(sideMult * 5, 5);
          ctx.lineTo(sideMult * 30, 80);
          ctx.lineTo(sideMult * 5, 120);
          ctx.lineTo(sideMult * -5, 80);
          ctx.lineTo(sideMult * -5, 15);
          ctx.fill();
          ctx.stroke();
          
          // Knee face / mask
          if (isPhase2) {
              ctx.fillStyle = isBack ? '#450a0a' : '#7f1d1d'; // dark flesh
              ctx.beginPath(); 
              ctx.ellipse(sideMult * 12, 55, 9, 14, 0, 0, Math.PI*2); 
              ctx.fill();
                            // Eyes
              ctx.fillStyle = '#22d3ee';
              ctx.shadowColor = '#22d3ee'; 
              ctx.shadowBlur = 6;
              ctx.beginPath(); ctx.arc(sideMult * 15, 52, 2.5, 0, Math.PI*2); ctx.fill();
              ctx.beginPath(); ctx.arc(sideMult * 9, 52, 2.5, 0, Math.PI*2); ctx.fill();
              ctx.shadowBlur = 0;
              
              // Mouth
              ctx.fillStyle = shootMouthOpen ? '#fbbf24' : '#000000';
              if (shootMouthOpen) {
                  ctx.shadowColor = '#fbbf24';
                  ctx.shadowBlur = 12;
              }
              ctx.beginPath(); 
              ctx.ellipse(sideMult * 12, 62, 4, mouthHeight, 0, 0, Math.PI*2); 
              ctx.fill();
              ctx.shadowBlur = 0;
          } else {
              // Golden polygonal mask for Phase 1
              ctx.fillStyle = isBack ? '#b45309' : '#fbbf24'; 
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = 1.5;
              ctx.beginPath(); 
              ctx.moveTo(sideMult * 12, 42); // Top point
              ctx.lineTo(sideMult * 22, 55); // Outer point
              ctx.lineTo(sideMult * 12, 72); // Bottom point
              ctx.lineTo(sideMult * 2, 55);  // Inner point
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
              
              // Slanted eyes
              ctx.fillStyle = '#22d3ee';
              ctx.shadowColor = '#22d3ee'; 
              ctx.shadowBlur = 6;
              ctx.beginPath(); 
              ctx.moveTo(sideMult * 8, 52); ctx.lineTo(sideMult * 11, 55); ctx.lineTo(sideMult * 6, 55); ctx.fill();
              ctx.beginPath(); 
              ctx.moveTo(sideMult * 16, 52); ctx.lineTo(sideMult * 13, 55); ctx.lineTo(sideMult * 18, 55); ctx.fill();
              ctx.shadowBlur = 0;
              
              // Mouth
              ctx.fillStyle = shootMouthOpen ? '#22d3ee' : '#000000';
              if (shootMouthOpen) {
                  ctx.shadowColor = '#22d3ee';
                  ctx.shadowBlur = 12;
              }
              ctx.beginPath();
              ctx.moveTo(sideMult * 12, 60); ctx.lineTo(sideMult * 15, 62 + mouthHeight/2); 
              ctx.lineTo(sideMult * 12, 64 + mouthHeight); ctx.lineTo(sideMult * 9, 62 + mouthHeight/2);
              ctx.fill();
              ctx.shadowBlur = 0;
          }
          
          ctx.restore();
      };
      
      // Draw back legs first
      drawLeg(true, true);  // Back Left
      drawLeg(false, true); // Back Right
      
      // Draw front legs
      drawLeg(true, false);  // Front Left
      drawLeg(false, false); // Front Right

      // Head bobbing animation for breathing
      const breatheBob = Math.sin(this.enemy.animTime * 3) * 2;
      ctx.translate(0, breatheBob);

      // Upper Body (Angular/Imposing Torso)
      ctx.fillStyle = skinColor; // Pale bone skin
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.lineTo(20, -5);
      ctx.lineTo(25, -25);
      ctx.lineTo(15, -35);
      ctx.lineTo(-15, -35);
      ctx.lineTo(-25, -25);
      ctx.lineTo(-20, -5);
      ctx.closePath();
      ctx.fill();
      if (!isPhase2) {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.5;
          ctx.stroke();
      }
      
      // Golden armor accents (Sharp, angular)
      ctx.strokeStyle = armorColor;
      ctx.lineWidth = 3.5;
      ctx.beginPath(); 
      ctx.moveTo(-15, -35); ctx.lineTo(0, -15); ctx.lineTo(15, -35); 
      ctx.moveTo(-20, -5); ctx.lineTo(0, -15); ctx.lineTo(20, -5);
      ctx.moveTo(0, -15); ctx.lineTo(0, 10);
      ctx.stroke();
      if (!isPhase2) {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1;
          ctx.stroke();
      }
      
      // Arms (pale, sharp, mantis-like)
      // Animated based on armRaise
      ctx.strokeStyle = skinColor;
      ctx.lineWidth = 9; // slightly thicker
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
      
      // Left Arm
      ctx.save();
      ctx.translate(-22, -25);
      ctx.rotate(armRaise);
      ctx.beginPath();
      ctx.moveTo(0, 0); 
      ctx.lineTo(-20, 20); 
      ctx.lineTo(-5, 45);
      ctx.stroke();
      if (!isPhase2) {
          // Draw a black outline inside the line
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1;
          // since arms are thick lines, outline by drawing thin lines at offsets is hard.
          // let's draw polygonal armored arms instead for Phase 1!
          ctx.lineWidth = 1;
          ctx.fillStyle = skinColor;
          ctx.beginPath();
          ctx.moveTo(-4, -2); ctx.lineTo(-24, 18); ctx.lineTo(-10, 45);
          ctx.lineTo(-1, 45); ctx.lineTo(-16, 22); ctx.lineTo(4, 2);
          ctx.closePath();
          ctx.fill(); ctx.stroke();
      }
      // Sharp blade/claw at the end
      ctx.fillStyle = armorColor;
      ctx.beginPath();
      ctx.moveTo(-5, 45); ctx.lineTo(-10, 65); ctx.lineTo(2, 50); ctx.fill();
      if (!isPhase2) {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1;
          ctx.stroke();
      }
      ctx.restore();
      
      // Right Arm
      ctx.save();
      ctx.translate(22, -25);
      ctx.rotate(-armRaise);
      ctx.beginPath();
      ctx.moveTo(0, 0); 
      ctx.lineTo(20, 20); 
      ctx.lineTo(5, 45);
      ctx.stroke();
      if (!isPhase2) {
          ctx.lineWidth = 1;
          ctx.fillStyle = skinColor;
          ctx.strokeStyle = '#000000';
          ctx.beginPath();
          ctx.moveTo(4, -2); ctx.lineTo(24, 18); ctx.lineTo(10, 45);
          ctx.lineTo(1, 45); ctx.lineTo(16, 22); ctx.lineTo(-4, 2);
          ctx.closePath();
          ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = armorColor;
      ctx.beginPath();
      ctx.moveTo(5, 45); ctx.lineTo(10, 65); ctx.lineTo(-2, 50); ctx.fill();
      if (!isPhase2) {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1;
          ctx.stroke();
      }
      ctx.restore();

      if (isPhase2) {
          // Giant Eye Head with teeth (The Eye of Angel style)
          ctx.fillStyle = '#450a0a'; // dark flesh base
          ctx.beginPath();
          ctx.arc(0, -55, 28, 0, Math.PI * 2);
          ctx.fill();
          
          // Outer teeth ring
          ctx.fillStyle = '#e5e7eb'; // bone teeth
          for(let i = 0; i < 12; i++) {
              const angle = (i / 12) * Math.PI * 2 + this.enemy.animTime * 2;
              const innerR = 25;
              const outerR = 40 + Math.sin(this.enemy.animTime * 15 + i) * 6;
              ctx.beginPath();
              ctx.moveTo(Math.cos(angle - 0.15) * innerR, -55 + Math.sin(angle - 0.15) * innerR);
              ctx.lineTo(Math.cos(angle) * outerR, -55 + Math.sin(angle) * outerR);
              ctx.lineTo(Math.cos(angle + 0.15) * innerR, -55 + Math.sin(angle + 0.15) * innerR);
              ctx.fill();
          }

          // The giant eye
          ctx.fillStyle = '#fca5a5';
          ctx.beginPath();
          ctx.ellipse(0, -55, 20, 14, 0, 0, Math.PI * 2);
          ctx.fill();
          
          // Pupil tracking player
          const dx = this.player.x - this.enemy.x;
          const dy = this.player.y - this.enemy.y;
          const dist = Math.sqrt(dx*dx + dy*dy) || 1;
          const px = (dx / dist) * 6;
          const py = (dy / dist) * 4;
          
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(px, -55 + py, 7, 0, Math.PI * 2);
          ctx.fill();

          // Glowing red center
          ctx.fillStyle = '#ef4444';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(px, -55 + py, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Grotesque fleshy halo
          ctx.strokeStyle = '#450a0a';
          ctx.shadowColor = '#ef4444'; 
          ctx.shadowBlur = haloGlow;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(0, -55, 50, Math.PI, 0);
          ctx.stroke();
          
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(-20, -95); ctx.lineTo(-25, -130);
          ctx.moveTo(0, -105); ctx.lineTo(0, -140);
          ctx.moveTo(20, -95); ctx.lineTo(25, -130);
          ctx.stroke();
          ctx.shadowBlur = 0;
      } else {
          // Head (Angular, scary mask)
          ctx.fillStyle = boneColor;
          ctx.beginPath();
          ctx.moveTo(0, -30); // Chin
          ctx.lineTo(12, -40); // Jaw right
          ctx.lineTo(18, -60); // Temple right
          ctx.lineTo(0, -70); // Top center
          ctx.lineTo(-18, -60); // Temple left
          ctx.lineTo(-12, -40); // Jaw left
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          
          // Eyes (Fierce, slanted)
          ctx.fillStyle = eyeColor;
          ctx.shadowColor = eyeColor; 
          ctx.shadowBlur = 15;
          ctx.beginPath(); 
          ctx.moveTo(-4, -45); ctx.lineTo(-14, -52); ctx.lineTo(-5, -49); ctx.fill();
          ctx.beginPath(); 
          ctx.moveTo(4, -45); ctx.lineTo(14, -52); ctx.lineTo(5, -49); ctx.fill();
          ctx.shadowBlur = 0;
          
          // Crown / Horns (More integrated, sharp)
          ctx.strokeStyle = armorColor;
          ctx.lineWidth = 3.5;
          ctx.lineJoin = 'miter';
          ctx.beginPath();
          ctx.moveTo(-18, -60); ctx.lineTo(-35, -85); ctx.lineTo(-10, -70);
          ctx.moveTo(18, -60); ctx.lineTo(35, -85); ctx.lineTo(10, -70);
          ctx.moveTo(0, -70); ctx.lineTo(0, -100);
          ctx.stroke();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Halo (complex triple spike)
          ctx.strokeStyle = '#f8fafc'; // White halo
          ctx.shadowColor = '#ffffff'; 
          ctx.shadowBlur = haloGlow;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, -65, 30, Math.PI, 0);
          ctx.stroke();
          // Spikes
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.moveTo(-15, -85); ctx.lineTo(-20, -115);
          ctx.moveTo(0, -95); ctx.lineTo(0, -130);
          ctx.moveTo(15, -85); ctx.lineTo(20, -115);
          ctx.stroke();
          ctx.shadowBlur = 0;
      }

      ctx.restore();
      
    } else {
        // Enemy dead carcass
        ctx.save();
        ctx.translate(this.enemy.x, this.enemy.y + this.enemy.height/2 - 15);
        ctx.scale(1.5, 1.5);
        ctx.fillStyle = '#d1d5db';
        ctx.beginPath();
        ctx.ellipse(0, 0, 30, 10, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }

    // --- Draw Boss Spells ---
    
    // Masks
    for (const m of this.masks) {
        ctx.save();
        ctx.translate(m.x, m.y);
        
        if (m.type === 'gold') {
            ctx.fillStyle = '#fbbf24'; // Gold
            ctx.shadowColor = '#fef08a';
            ctx.shadowBlur = 15;
            ctx.strokeStyle = '#b45309';
            ctx.lineWidth = 2;
        } else {
            ctx.fillStyle = '#450a0a';
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 10;
        }
        
        // Draw grotesque mask
        ctx.beginPath();
        ctx.ellipse(0, 0, m.width/2, m.height/2, 0, 0, Math.PI * 2);
        ctx.fill();
        if (m.type === 'gold') ctx.stroke();
        
        // Eyes
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(-10, -10, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(10, -10, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(-10, -10, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(10, -10, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Mouth
        ctx.beginPath();
        ctx.ellipse(0, 15, 10, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // HP Bar
        if (m.hp < m.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(-m.width/2, -m.height/2 - 15, m.width, 5);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(-m.width/2, -m.height/2 - 15, m.width * (m.hp / m.maxHp), 5);
        }
        
        ctx.restore();
    }

    // Projectiles (Divine Light / Blood)
    for (const p of this.projectiles) {
        if (p.type === 'blood') {
            ctx.fillStyle = '#fca5a5';
            ctx.shadowColor = '#7f1d1d';
            ctx.strokeStyle = 'rgba(127, 29, 29, 0.8)';
        } else if (p.type === 'magic') {
            ctx.fillStyle = '#fef08a';
            ctx.shadowColor = '#fbbf24';
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
        } else if (p.color) {
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color === '#991b1b' ? '#450a0a' : '#0284c7';
            ctx.strokeStyle = p.color === '#991b1b' ? 'rgba(69, 10, 10, 0.8)' : 'rgba(14, 165, 233, 0.6)';
        } else {
            ctx.fillStyle = '#bae6fd';
            ctx.shadowColor = '#0284c7';
            ctx.strokeStyle = 'rgba(14, 165, 233, 0.6)';
        }
        
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        // Inner core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Trail
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.15, p.y - p.vy * 0.15);
        ctx.lineWidth = p.radius;
        ctx.stroke();
    }

    // AoEs
    for (const a of this.aoes) {
        const progress = 1 - (a.timer / a.maxTimer);
        
        if (a.type === 'heavens_break' || a.type === 'divine_ray') {
            if (a.exploded) {
                // Massive solid beam when it strikes
                const dur = a.duration || 0.3;
                let flashAlpha = 1.0;
                if (a.timer < -dur + 0.3) {
                    flashAlpha = Math.max(0, (a.timer + dur) / 0.3);
                }
                
                ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
                ctx.beginPath();
                ctx.moveTo(a.x - a.radius * 0.9, 0);
                ctx.lineTo(a.x + a.radius * 0.9, 0);
                ctx.lineTo(a.x + a.radius * 1.1, a.y);
                ctx.lineTo(a.x - a.radius * 1.1, a.y);
                ctx.fill();
                
                // Core beam
                ctx.fillStyle = `rgba(250, 204, 21, ${flashAlpha})`;
                ctx.fillRect(a.x - a.radius * 0.5, 0, a.radius, a.y);
                
                // Impact explosion on ground
                ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
                ctx.beginPath();
                ctx.ellipse(a.x, a.y, a.radius * 1.5, a.radius * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Large light beam from sky (warning phase)
                ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + progress * 0.3})`;
                ctx.beginPath();
                ctx.moveTo(a.x - a.radius * 0.8, 0);
                ctx.lineTo(a.x + a.radius * 0.8, 0);
                ctx.lineTo(a.x + a.radius, a.y);
                ctx.lineTo(a.x - a.radius, a.y);
                ctx.fill();
                
                ctx.fillStyle = `rgba(250, 204, 21, ${0.1 + progress * 0.2})`; // Gold transparent area gets brighter
                ctx.strokeStyle = '#facc15';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.ellipse(a.x, a.y, a.radius, a.radius * 0.3, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                // Progress ring expanding
                ctx.strokeStyle = `rgba(239, 68, 68, ${0.8 - progress * 0.5})`; // Red ring fades
                ctx.lineWidth = 4 + progress * 6;
                ctx.beginPath();
                ctx.ellipse(a.x, a.y, a.radius * progress, a.radius * 0.3 * progress, 0, 0, Math.PI * 2);
                ctx.stroke();
                
                // Impact rays shooting up if nearly done
                if (progress > 0.8) {
                    ctx.fillStyle = `rgba(250, 204, 21, ${(progress - 0.8) * 4})`;
                    ctx.beginPath();
                    ctx.moveTo(a.x - a.radius, a.y);
                    ctx.lineTo(a.x + a.radius, a.y);
                    ctx.lineTo(a.x, a.y - a.radius * 3);
                    ctx.fill();
                }
            }
        } else if (a.type === 'holy_nova' || a.type === 'abyssal_nova') {
            if (a.exploded) {
                const dur = a.duration || 0.3;
                let flashAlpha = 1.0;
                if (a.timer < -dur + 0.3) {
                    flashAlpha = Math.max(0, (a.timer + dur) / 0.3);
                }
                ctx.fillStyle = a.type === 'abyssal_nova' 
                    ? `rgba(153, 27, 27, ${flashAlpha})` 
                    : `rgba(255, 255, 255, ${flashAlpha})`;
                ctx.beginPath();
                ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = a.type === 'abyssal_nova'
                    ? `rgba(0, 0, 0, ${flashAlpha * 0.8})`
                    : `rgba(250, 204, 21, ${flashAlpha * 0.5})`;
                ctx.beginPath();
                ctx.arc(a.x, a.y, a.radius * 0.9, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Massive expanding circular blast area (visual warning)
                ctx.fillStyle = a.type === 'abyssal_nova'
                    ? `rgba(69, 10, 10, ${0.1 + progress * 0.3})`
                    : `rgba(250, 204, 21, ${0.1 + progress * 0.3})`;
                ctx.beginPath();
                ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.strokeStyle = a.type === 'abyssal_nova'
                    ? `rgba(127, 29, 29, ${Math.max(0, 0.8 - progress * 0.5)})`
                    : `rgba(234, 179, 8, ${Math.max(0, 0.8 - progress * 0.5)})`;
                ctx.lineWidth = 4 + progress * 10;
                ctx.beginPath();
                ctx.arc(a.x, a.y, a.radius * progress, 0, Math.PI * 2);
                ctx.stroke();
            }
        } else if (a.type === 'void_blast') {
            const alpha = 1.0 - Math.abs(a.timer / a.maxTimer);
            ctx.beginPath();
            ctx.arc(a.x, a.y, a.radius * (1 - alpha), 0, Math.PI*2);
            ctx.fillStyle = `rgba(168, 85, 247, ${alpha * 0.5})`; // purple-500
            ctx.fill();
            ctx.strokeStyle = `rgba(216, 180, 254, ${alpha})`; // purple-300
            ctx.lineWidth = 4;
            ctx.stroke();
        } else if (a.type === 'laser_h' || a.type === 'laser_v') {
            if (a.exploded) {
                const flashAlpha = 1.0 - (Math.abs(a.timer) / 0.3);
                ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
                ctx.shadowColor = '#06b6d4';
                ctx.shadowBlur = 30;
                
                let rx, ry;
                if (a.type === 'laser_h') {
                    rx = a.x;
                    ry = a.y - a.height/2;
                } else {
                    rx = a.x - a.width/2;
                    ry = a.y;
                }
                ctx.fillRect(rx, ry, a.width, a.height);
                
                ctx.fillStyle = `rgba(34, 211, 238, ${flashAlpha * 0.8})`;
                ctx.fillRect(rx + (a.type==='laser_v'? 20 : 0), ry + (a.type==='laser_h'? 20 : 0), 
                             a.type==='laser_v'? a.width-40 : a.width, 
                             a.type==='laser_h'? a.height-40 : a.height);
                ctx.shadowBlur = 0;
            } else {
                const warningAlpha = 0.2 + progress * 0.5;
                ctx.fillStyle = `rgba(6, 182, 212, ${warningAlpha})`;
                
                let rx, ry;
                if (a.type === 'laser_h') {
                    rx = a.x;
                    ry = a.y - a.height/2;
                } else {
                    rx = a.x - a.width/2;
                    ry = a.y;
                }
                
                // Warning area
                ctx.fillRect(rx, ry, a.width, a.height);
                
                // Telegraph lines
                ctx.strokeStyle = '#22d3ee';
                ctx.lineWidth = 2;
                ctx.beginPath();
                if (a.type === 'laser_h') {
                    ctx.moveTo(rx, a.y);
                    ctx.lineTo(rx + a.width, a.y);
                } else {
                    ctx.moveTo(a.x, ry);
                    ctx.lineTo(a.x, ry + a.height);
                }
                ctx.stroke();
            }
        }
    }

    // Eye Mini Boss
    if (this.enemy.phase === 3 && (this.eyeMiniBoss.hp > 0 || this.eyeMiniBoss.scale > 0)) {
        ctx.save();
        ctx.translate(this.eyeMiniBoss.x, this.eyeMiniBoss.y);
        let s = this.eyeMiniBoss.scale === undefined ? 1 : this.eyeMiniBoss.scale;
        ctx.scale(2.5 * s, 2.5 * s);
        ctx.globalAlpha = Math.max(0, s); // Considerably increase size
        
        // Base dark fleshy mass
        ctx.fillStyle = '#270303'; // Almost black-red
        ctx.beginPath();
        ctx.ellipse(0, 0, 90, 45, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner fleshy mass
        ctx.fillStyle = '#5c1616'; // Dark blood red
        ctx.beginPath();
        ctx.moveTo(-75, 0);
        ctx.bezierCurveTo(-50, -35, 50, -35, 75, 0);
        ctx.bezierCurveTo(50, 35, -50, 35, -75, 0);
        ctx.fill();
        
        // Outer tentacles and veins
        ctx.strokeStyle = '#3f0909';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const time = Date.now() / 1000;
        for (let i = 0; i < 14; i++) {
            ctx.beginPath();
            const angle = (i / 14) * Math.PI * 2;
            const startDist = 35;
            const tX = Math.cos(angle);
            const tY = Math.sin(angle);
            ctx.moveTo(tX * startDist, tY * startDist);
            
            // Wriggling tentacles
            const cp1X = tX * 60 + Math.sin(time * 2 + i) * 15;
            const cp1Y = tY * 60 + Math.cos(time * 2 + i) * 15;
            const endX = tX * 85 + Math.sin(time * 3 + i) * 25;
            const endY = tY * 85 + Math.cos(time * 3 + i) * 25;
            
            ctx.quadraticCurveTo(cp1X, cp1Y, endX, endY);
            ctx.stroke();
            
            // Slime drips on bottom tentacles
            if (tY > 0) {
                 ctx.fillStyle = 'rgba(120, 160, 50, 0.5)'; // sickly green slime
                 ctx.beginPath();
                 ctx.arc(endX, endY + Math.abs(Math.sin(time * 4 + i)) * 10, 2, 0, Math.PI * 2);
                 ctx.fill();
            }
        }
        
        // Fleshy eye socket
        ctx.fillStyle = '#7f1d1d'; // Brighter red
        ctx.beginPath();
        ctx.ellipse(0, 0, 32, 22, 0, 0, Math.PI * 2);
        ctx.fill();

        // The Eye itself
        if (this.eyeMiniBoss.isActive) {
            ctx.fillStyle = '#fef08a'; // Sickly yellow sclera
            ctx.beginPath();
            ctx.ellipse(0, 0, 28, 18, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Pupil (tracking player slightly or just scary red)
            const dx = this.player.x - this.eyeMiniBoss.x;
            const dy = this.player.y - this.eyeMiniBoss.y;
            const dist = Math.hypot(dx, dy) + 0.001;
            const pupX = (dx / dist) * 10;
            const pupY = (dy / dist) * 6;
            
            ctx.fillStyle = '#991b1b'; // Deep Red iris
            ctx.beginPath();
            ctx.arc(pupX, pupY, 12, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#000000'; // Black pupil
            ctx.beginPath();
            ctx.arc(pupX, pupY, 5, 0, Math.PI * 2);
            ctx.fill();
            
            // Eye shine
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(pupX - 4, pupY - 4, 3, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Closed eye (eyelid)
            ctx.fillStyle = '#450a0a'; // darker flesh eyelid
            ctx.beginPath();
            ctx.ellipse(0, 0, 28, 18, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#1a0202';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-28, 0);
            ctx.bezierCurveTo(-10, 8, 10, 8, 28, 0); // closed slit
            ctx.stroke();
        }
        
        ctx.restore();
        

    
        // Draw Laser
        if (this.eyeMiniBoss.state === 'laser_fire') {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            const sweepProgress = Math.max(0, 1.0 - (this.eyeMiniBoss.attackTimer / 1.5));
            const startAngle = this.eyeMiniBoss.side === 1 ? Math.PI * 0.6 : Math.PI * 0.4;
            const endAngle = this.eyeMiniBoss.side === 1 ? Math.PI * 0.1 : Math.PI * 0.9;
            const angle = startAngle + (endAngle - startAngle) * sweepProgress;
            const laserGrad = ctx.createLinearGradient(
                this.eyeMiniBoss.x, 
                this.eyeMiniBoss.y, 
                this.eyeMiniBoss.x + Math.cos(angle) * 2000, 
                this.eyeMiniBoss.y + Math.sin(angle) * 2000
            );
            laserGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
            laserGrad.addColorStop(0.5, 'rgba(100, 255, 255, 0.8)');
            laserGrad.addColorStop(1, 'rgba(0, 100, 255, 0)');
            
            ctx.translate(this.eyeMiniBoss.x, this.eyeMiniBoss.y);
            ctx.rotate(angle);
            ctx.fillStyle = laserGrad;
            
            // Random thickness to make it flicker
            const thickness = 100 + Math.random() * 40;
            ctx.fillRect(0, -thickness/2, 2000, thickness);
            ctx.restore();
        }
        
        // Draw Suck Wind
        if (this.eyeMiniBoss.state === 'sucking') {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.translate(this.eyeMiniBoss.x, this.eyeMiniBoss.y);
            
            const suckTime = Date.now() / 100;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            
            for (let i = 0; i < 20; i++) {
                const angle = Math.random() * Math.PI * 2;
                // Move towards center
                const dist = 300 - ((suckTime * 300 + i * 50) % 300);
                
                ctx.beginPath();
                ctx.moveTo(Math.cos(angle) * dist, Math.sin(angle) * dist);
                ctx.lineTo(Math.cos(angle) * (dist - 40), Math.sin(angle) * (dist - 40));
                ctx.stroke();
            }
            ctx.restore();
        }
        
        // Draw Judgment
        if (this.eyeMiniBoss.state === 'judgment_prepare' || this.eyeMiniBoss.state === 'judgment_fire') {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            for (const laser of this.judgmentLasers) {
                const angle = Math.atan2(laser.targetY - laser.y, laser.targetX - laser.x);
                ctx.save();
                ctx.translate(laser.x, laser.y);
                ctx.rotate(angle);
                
                if (this.eyeMiniBoss.state === 'judgment_prepare') {
                    // Draw red warning line
                    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(2000, 0);
                    ctx.stroke();
                } else {
                    // Draw thick laser beam
                    const laserGrad = ctx.createLinearGradient(0, 0, 2000, 0);
                    laserGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
                    laserGrad.addColorStop(0.5, 'rgba(250, 204, 21, 0.8)'); // Yellow
                    laserGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
                    
                    ctx.fillStyle = laserGrad;
                    const thickness = 60 + Math.random() * 20;
                    ctx.fillRect(0, -thickness/2, 2000, thickness);
                }
                ctx.restore();
            }
            ctx.restore();
        }

        // Draw Invocation Lock
        if (this.eyeMiniBoss.state === 'invocation_lock') {
            // Draw slime around player
            ctx.save();
            ctx.translate(this.player.x, this.player.y);
            ctx.fillStyle = 'rgba(153, 27, 27, 0.7)'; // Red meat slime
            ctx.beginPath();
            ctx.ellipse(0, this.player.height/2, 50 + Math.sin(time*10)*5, 20, 0, 0, Math.PI*2);
            ctx.fill();
            // Tendrils grabbing player
            ctx.strokeStyle = '#7f1d1d';
            ctx.lineWidth = 4;
            for(let i=0; i<5; i++) {
                ctx.beginPath();
                ctx.moveTo(0, this.player.height/2);
                ctx.quadraticCurveTo(
                    (Math.random()-0.5)*100, 
                    this.player.height/2 - 20, 
                    (Math.random()-0.5)*50, 
                    -this.player.height/2 + Math.random()*50
                );
                ctx.stroke();
            }
            ctx.restore();
        }

        // Draw Wall Tentacles
        if (this.eyeMiniBoss.state === 'wall_tentacles') {
            ctx.save();
            ctx.fillStyle = '#450a0a';
            ctx.strokeStyle = '#270303';
            ctx.lineWidth = 10;
            for (const tent of this.wallTentacles) {
                const startX = tent.side === -1 ? 0 : ROOM_WIDTH;
                let length = 0;
                if (tent.state === 'extend') {
                    length = (1 - (tent.timer / tent.maxTimer)) * 600;
                } else if (tent.state === 'active') {
                    length = 600 + Math.sin(time * 20) * 20;
                } else if (tent.state === 'retract') {
                    length = (tent.timer / tent.maxTimer) * 600;
                }
                
                ctx.beginPath();
                ctx.moveTo(startX, tent.y - 20);
                const tipX = startX + tent.side * length;
                ctx.quadraticCurveTo(startX + tent.side * (length/2), tent.y - 100, tipX, tent.y);
                ctx.quadraticCurveTo(startX + tent.side * (length/2), tent.y + 60, startX, tent.y + 20);
                ctx.fill();
                ctx.stroke();
                
                // spikes
                for(let i=1; i<=3; i++) {
                    const sx = startX + tent.side * (length * 0.25 * i);
                    ctx.beginPath();
                    ctx.moveTo(sx, tent.y - 30);
                    ctx.lineTo(sx + tent.side * 40, tent.y - 60);
                    ctx.lineTo(sx + tent.side * 20, tent.y - 10);
                    ctx.fillStyle = '#ef4444';
                    ctx.fill();
                }
            }
            ctx.restore();
        }
    }

// Meteors
    for (const m of this.meteors) {
        ctx.fillStyle = '#fef08a'; // Bright yellow core
        ctx.shadowColor = '#ea580c'; // Orange glow
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Outer fire shell
        ctx.fillStyle = 'rgba(239, 68, 68, 0.7)'; // Red outer
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius * 1.3, 0, Math.PI * 2);
        ctx.fill();
        
        // Thick flaming tail
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - m.vx * 0.25, m.y - m.vy * 0.25);
        ctx.strokeStyle = 'rgba(234, 88, 12, 0.8)';
        ctx.lineWidth = m.radius * 1.5;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - m.vx * 0.35, m.y - m.vy * 0.35);
        ctx.strokeStyle = 'rgba(225, 29, 72, 0.5)';
        ctx.lineWidth = m.radius * 0.8;
        ctx.stroke();
        
        ctx.shadowBlur = 0;
    }

    // Intro text moved to end of draw()
    


    // Particles
    this.particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 6, 6);
    });


    // --- Foreground Golden Rocks (Depth) ---
    ctx.save();
    const phase2 = this.enemy.phase >= 2;
    ctx.fillStyle = phase2 ? '#450a0a' : '#d97706';
    ctx.strokeStyle = phase2 ? '#7f1d1d' : '#fbbf24';
    ctx.lineWidth = 4;
    
    const rockScroll = (this.player.x * 0.25);
    const leftRockX = - (rockScroll % 200);
    
    // Left side foreground
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y + 80);
    ctx.lineTo(80 + leftRockX, FLOOR_Y + 40);
    ctx.lineTo(160 + leftRockX, FLOOR_Y + 100);
    ctx.lineTo(280 + leftRockX, FLOOR_Y + 60);
    ctx.lineTo(380 + leftRockX, ROOM_HEIGHT);
    ctx.lineTo(0, ROOM_HEIGHT);
    ctx.fill();
    ctx.stroke();

    // Right side foreground
    const rightRockX = Math.max(ROOM_WIDTH - 400, ROOM_WIDTH - (rockScroll % 250));
    ctx.beginPath();
    ctx.moveTo(ROOM_WIDTH, FLOOR_Y + 50);
    ctx.lineTo(ROOM_WIDTH - 120, FLOOR_Y + 20);
    ctx.lineTo(ROOM_WIDTH - 200, FLOOR_Y + 80);
    ctx.lineTo(ROOM_WIDTH - 350, FLOOR_Y + 40);
    ctx.lineTo(ROOM_WIDTH - 480, ROOM_HEIGHT);
    ctx.lineTo(ROOM_WIDTH, ROOM_HEIGHT);
    ctx.fill();
    ctx.stroke();
    
    // Decorative swirls
    ctx.strokeStyle = phase2 ? '#b91c1c' : '#fef08a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, FLOOR_Y + 100);
    ctx.quadraticCurveTo(80 + leftRockX, FLOOR_Y + 60, 120 + leftRockX, FLOOR_Y + 110);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(ROOM_WIDTH - 50, FLOOR_Y + 70);
    ctx.quadraticCurveTo(ROOM_WIDTH - 150, FLOOR_Y + 50, ROOM_WIDTH - 180, FLOOR_Y + 100);
    ctx.stroke();

    ctx.restore();

    // Boss subtitle moved to end of draw()

    // Transition to Phase 3 dark overlay
    if (this.enemy.state === 'transition_phase3') {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const progress = 1 - (this.enemy.stateTimer / 6.0); // 0 to 1
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, progress * 1.5)})`;
        ctx.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
        ctx.restore();
    }

    if (this.hitEffectTimer > 0) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const alpha = Math.min(0.8, this.hitEffectTimer);
        const grad = ctx.createRadialGradient(ROOM_WIDTH/2, ROOM_HEIGHT/2, Math.min(ROOM_WIDTH, ROOM_HEIGHT)/3, ROOM_WIDTH/2, ROOM_HEIGHT/2, Math.max(ROOM_WIDTH, ROOM_HEIGHT));
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(0,0,0,${alpha})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
        ctx.restore();
    }
    
    ctx.restore(); // restore from the screenshake translate

    // Top-left text moved to end of draw()
    
    if (this.retroMode && this.offscreenCanvas) {
        ctx.restore(); // Restore the scale 1/4 we did earlier
        
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.clearRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
        this.ctx.drawImage(this.offscreenCanvas, 0, 0, ROOM_WIDTH, ROOM_HEIGHT);
        
        // Scanlines
        this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
        for (let i = 0; i < ROOM_HEIGHT; i += 4) {
            this.ctx.fillRect(0, i, ROOM_WIDTH, 2);
        }
    }
    
    // Draw UI directly to main canvas for crisp text
    const mainCtx = this.ctx;
    
    if (this.enemy.state === 'intro') {
        mainCtx.save();
        const alpha = Math.min(1, this.enemy.stateTimer, 10 - this.enemy.stateTimer);
        mainCtx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        mainCtx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
        mainCtx.lineWidth = 4;
        mainCtx.font = 'bold 22px serif';
        mainCtx.textAlign = 'center';
        
        // Convert world coordinates to screen coordinates if needed, 
        // but here the canvas is full width/height so world == screen
        let textY = this.player.y - 220; // Higher above player
        
        const playerTexts = [
            '(Click esquerdo ou "X" atacar)',
            '(Click direito ou "C" para defender)',
            '("F" para curar)',
            '("V" para buff de ataque)',
            '(Shift para dash)'
        ];
        
        playerTexts.forEach(text => {
            mainCtx.strokeText(text.toUpperCase(), this.player.x, textY);
            mainCtx.fillText(text.toUpperCase(), this.player.x, textY);
            textY += 30;
        });
        mainCtx.restore();
    } else {
        mainCtx.save();
        mainCtx.setTransform(1, 0, 0, 1, 0, 0);
        mainCtx.fillStyle = '#fbbf24'; // Yellow
        mainCtx.font = 'bold 16px monospace';
        mainCtx.textAlign = 'left';
        mainCtx.shadowColor = 'black';
        mainCtx.shadowBlur = 4;
        mainCtx.lineWidth = 3;
        mainCtx.strokeStyle = 'black';
        const texts = [
            '(Click esquerdo ou "X" para atacar)',
            '(Click direito ou "C" para defender)',
            '("F" para curar)',
            '("V" para buff de ataque)',
            '(Shift para dash)'
        ];
        
        // Dark semi-transparent background for UI
        mainCtx.shadowBlur = 0;
        mainCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        mainCtx.fillRect(10, 140, 360, 135);
        mainCtx.shadowBlur = 4;
        mainCtx.fillStyle = '#fbbf24'; // Yellow
        
        let startY = 160; // Start below the health and energy HUD
        texts.forEach(text => {
            mainCtx.strokeText(text.toUpperCase(), 15, startY);
            mainCtx.fillText(text.toUpperCase(), 15, startY);
            startY += 25;
        });
        mainCtx.shadowBlur = 0;
        mainCtx.restore();
    }

    // Boss Subtitle Alert
    if (this.bossSubtitleTimer > 0) {
        mainCtx.save();
        mainCtx.setTransform(1, 0, 0, 1, 0, 0);
        mainCtx.font = 'bold 48px serif';
        mainCtx.textAlign = 'center';
        
        // Dark text outline for readability
        mainCtx.strokeStyle = 'black';
        mainCtx.lineWidth = 6;
        mainCtx.strokeText(this.bossSubtitleText, ROOM_WIDTH / 2, FLOOR_Y - 200);

        // Subtitle color depending on state
        if (this.enemy.state === 'divine_light') mainCtx.fillStyle = '#fef08a';
        else if (this.enemy.state === 'heavens_break') mainCtx.fillStyle = '#fca5a5';
        else if (this.enemy.state === 'meteor_shower') mainCtx.fillStyle = '#fb923c';
        else if (this.enemy.state === 'holy_nova') mainCtx.fillStyle = '#eab308';
        else mainCtx.fillStyle = 'white';

        mainCtx.shadowColor = mainCtx.fillStyle;
        mainCtx.shadowBlur = 15;
        
        // Fade in/out logic
        let alpha = 1.0;
        if (this.bossSubtitleTimer > 1.2) {
            alpha = (1.5 - this.bossSubtitleTimer) / 0.3; // fade in over first 0.3s
        } else if (this.bossSubtitleTimer < 0.3) {
            alpha = this.bossSubtitleTimer / 0.3; // fade out over last 0.3s
        }
        mainCtx.globalAlpha = Math.max(0, Math.min(1, alpha));
        
        mainCtx.fillText(this.bossSubtitleText, ROOM_WIDTH / 2, FLOOR_Y - 200);
        mainCtx.restore();
    }

    if (this.gameMode === 'tutorial') {
        mainCtx.save();
        mainCtx.fillStyle = 'white';
        mainCtx.font = '24px "Press Start 2P", sans-serif';
        mainCtx.textAlign = 'center';
        mainCtx.shadowColor = 'black';
        mainCtx.shadowBlur = 4;
        mainCtx.fillText("Press A/D to Move, SPACE to Jump, Click to Attack", ROOM_WIDTH / 2, 110);
        mainCtx.restore();
    }
    
    this.ctx.restore(); // Restore ZOOM
  }


  drawDevastatedPath(ctx: CanvasRenderingContext2D) {
      const time = Date.now() / 1000;
      const camOffsetX = (this.player.x - ROOM_WIDTH / 2);
      // Sky - gets darker during the storm
      let skyDarken = 0;
      if (this.lightningEventTimer > 0) {
          skyDarken = 0.5; // darken by 50%
      } else if (this.devastatedTimer > 28) {
          skyDarken = (this.devastatedTimer - 28) / 2 * 0.5; // fade into dark
      }
      
      ctx.save();
      const skyGrad = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
      // Base colors (Void purple tint)
      const r1 = Math.floor(40 * (1 - skyDarken)), g1 = Math.floor(10 * (1 - skyDarken)), b1 = Math.floor(80 * (1 - skyDarken));
      const r2 = Math.floor(20 * (1 - skyDarken)), g2 = Math.floor(40 * (1 - skyDarken)), b2 = Math.floor(140 * (1 - skyDarken));
      
      skyGrad.addColorStop(0, `rgb(${r1}, ${g1}, ${b1})`);
      skyGrad.addColorStop(1, `rgb(${r2}, ${g2}, ${b2})`);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
      
      // Layer 3 (Background/Clouds/Far Mountains) - Parallax 0.05
      ctx.save();
      ctx.translate(-camOffsetX * 0.05, 0);
      // Void clouds at top
      ctx.fillStyle = '#4c1d95'; // purple-900
      ctx.beginPath();
      for(let i=-5; i<30; i++) {
          const cx = i * 100;
          const cy = -30;
          const r = 140;
          ctx.arc(cx, cy, r, 0, Math.PI*2);
      }
      ctx.fill();
      
      // Add volume to clouds
      ctx.fillStyle = '#6d28d9'; // purple-700
      ctx.beginPath();
      for(let i=-5; i<30; i++) {
          const cx = i * 100;
          const cy = 20;
          const r = 100;
          ctx.arc(cx, cy, r, 0, Math.PI*2);
      }
      ctx.fill();

      // God rays from the clouds (dimmed during storm)
      if (skyDarken < 0.4) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          for (let i = 0; i < 6; i++) {
              const x = (i * 350 + (time * 15) % 350) - 200;
              const angle = Math.PI / 3;
              const rayWidth = 120;
              const alpha = 0.4 * (1 - skyDarken * 2);
              const grad = ctx.createLinearGradient(x, 0, x + Math.cos(angle) * ROOM_HEIGHT, Math.sin(angle) * ROOM_HEIGHT);
              grad.addColorStop(0, `rgba(167, 139, 250, ${Math.max(0, alpha)})`); // purple-400
              grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
              ctx.fillStyle = grad;
              ctx.beginPath();
              ctx.moveTo(x, 0);
              ctx.lineTo(x + rayWidth, 0);
              ctx.lineTo(x + rayWidth + Math.cos(angle) * ROOM_HEIGHT, Math.sin(angle) * ROOM_HEIGHT);
              ctx.lineTo(x + Math.cos(angle) * ROOM_HEIGHT, Math.sin(angle) * ROOM_HEIGHT);
              ctx.fill();
          }
          ctx.restore();
      }

      // Distant city silhouette
      ctx.fillStyle = `rgb(${Math.floor(30 * (1-skyDarken))}, ${Math.floor(20 * (1-skyDarken))}, ${Math.floor(60 * (1-skyDarken))})`;
      for (let i = -10; i < 50; i++) {
          const w = 40 + Math.sin(i*7)*30;
          const h = 50 + Math.sin(i*13)*50;
          const x = i * 70;
          ctx.fillRect(x, FLOOR_Y - h, w, h);
      }
      ctx.restore(); // End Layer 3

      // Layer 2 (Midground Ruins) - Parallax 0.15
      ctx.save();
      ctx.translate(-camOffsetX * 0.15, 0);
      
      // Giant Floating Void Crystals
      ctx.save();
      for (let i = 0; i < 5; i++) {
          const cx = 200 + i * 500;
          const cy = FLOOR_Y - 200 - Math.sin(time * 2 + i) * 20;
          
          ctx.shadowColor = '#d8b4fe';
          ctx.shadowBlur = 30 + Math.sin(time * 4 + i) * 10;
          
          ctx.fillStyle = '#a855f7';
          ctx.beginPath();
          ctx.moveTo(cx, cy - 80); // top
          ctx.lineTo(cx + 30, cy - 10); // right top
          ctx.lineTo(cx + 10, cy + 60); // right bottom
          ctx.lineTo(cx, cy + 80); // bottom
          ctx.lineTo(cx - 10, cy + 60); // left bottom
          ctx.lineTo(cx - 30, cy - 10); // left top
          ctx.fill();
          
          // Crystal highlight
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#e9d5ff';
          ctx.beginPath();
          ctx.moveTo(cx, cy - 80);
          ctx.lineTo(cx + 10, cy - 10);
          ctx.lineTo(cx, cy + 60);
          ctx.lineTo(cx - 10, cy - 10);
          ctx.fill();
      }
      ctx.restore();

      // Ruined pillar 1 (left) (left)
      ctx.save();
      ctx.translate(300, FLOOR_Y);
      ctx.rotate(-Math.PI / 7);
      this.drawDetailedPillar(ctx, -50, -220, 100, 220);
      ctx.restore();

      // Platform / Altar (center)
      ctx.save();
      ctx.translate(800, FLOOR_Y);
      ctx.fillStyle = '#4c1d95';
      ctx.beginPath();
      ctx.ellipse(0, -60, 140, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      // Altar detail lines
      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, -60, 120, 20, 0, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.fillStyle = '#2e1065';
      ctx.fillRect(-120, -60, 240, 40);
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(-140, -20, 280, 20); // base
      // Cracks in altar
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-50, -60); ctx.lineTo(-30, -40); ctx.lineTo(-10, -50);
      ctx.stroke();
      ctx.restore();
      
      // Second broken pillar (right side)
      ctx.save();
      ctx.translate(1400, FLOOR_Y);
      ctx.rotate(Math.PI / 12);
      this.drawDetailedPillar(ctx, -40, -150, 80, 150);
      ctx.restore();
      
      // Giant bone/structure (far right)
      ctx.save();
      ctx.translate(1700, FLOOR_Y);
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-100, -250, 50, -450);
      ctx.lineTo(90, -430);
      ctx.quadraticCurveTo(-60, -230, 60, 0);
      ctx.fill();
      // Bone shading
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-100, -250, 50, -450);
      ctx.lineTo(60, -440);
      ctx.quadraticCurveTo(-80, -240, 20, 0);
      ctx.fill();
      ctx.restore();
      
      ctx.restore(); // End Layer 2

      ctx.restore(); // End general save

      // Wind particles (slower, subtle, full screen)
      ctx.fillStyle = 'rgba(10, 10, 10, 0.4)';
      for (let i = 0; i < 60; i++) {
          const px = ((i * 450 - time * 300) % (ROOM_WIDTH + 1000)) + 1000;
          const py = (i * 97) % ROOM_HEIGHT;
          const w = 40 + Math.random() * 80;
          const h = 1 + Math.random() * 2;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(-0.05); // slight slant
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
      }

      // Foreground Floor (rocky terrain) - Parallax 0.3 (fastest depth layer, note player is moving at 1.0)
      ctx.save();
      ctx.translate(-camOffsetX * 0.3, 0);
      
      ctx.fillStyle = '#2e1065';
      ctx.beginPath();
      ctx.moveTo(-500, FLOOR_Y);
      for(let x=-500; x<=ROOM_WIDTH + 500; x+=80) {
          ctx.lineTo(x, FLOOR_Y + Math.sin(x*0.05)*15 - 10);
      }
      ctx.lineTo(ROOM_WIDTH + 500, ROOM_HEIGHT);
      ctx.lineTo(-500, ROOM_HEIGHT);
      ctx.fill();

      // Rocky steps at the bottom front
      ctx.fillStyle = '#1e1b4b';
      for(let x=-500; x<ROOM_WIDTH + 500; x+=150) {
          const w = 100 + Math.sin(x)*50;
          const h = 50 + Math.cos(x)*20;
          ctx.fillRect(x, ROOM_HEIGHT - h, w, h);
          // top edge highlight
          ctx.fillStyle = '#4c1d95';
          ctx.fillRect(x, ROOM_HEIGHT - h, w, 10);
          ctx.fillStyle = '#1e1b4b';
      }
      
      // Some sparse dead grass / yellow bushes
      ctx.strokeStyle = '#9333ea';
      ctx.lineWidth = 3;
      for (let i=-5; i<25; i++) {
          const gx = i * 100 + 50;
          const gy = FLOOR_Y + Math.sin(gx*0.05)*15 - 10;
          ctx.beginPath();
          ctx.moveTo(gx, gy);
          ctx.lineTo(gx - 10 - Math.sin(time*3+i)*10, gy - 20);
          ctx.moveTo(gx, gy);
          ctx.lineTo(gx + 5 - Math.sin(time*3+i)*10, gy - 25);
          ctx.stroke();
      }
      ctx.restore(); // End Foreground
      
      // Environmental Lightnings
      if (this.environmentalLightnings) {
          for (let l of this.environmentalLightnings) {
              if (l.timer > 0.2) {
                  // Warning beam
                  ctx.fillStyle = 'rgba(216, 180, 254, 0.2)'; // purple-300
                  ctx.fillRect(l.x - 30, 0, 60, FLOOR_Y);
                  ctx.fillStyle = 'rgba(147, 51, 234, 0.3)'; // purple-600
                  ctx.fillRect(l.x - 10, 0, 20, FLOOR_Y);
              } else if (l.timer > 0) {
                  // Strike
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(l.x - 40, 0, 80, FLOOR_Y);
                  ctx.fillStyle = '#a855f7'; // purple-500
                  ctx.fillRect(l.x - 20, 0, 40, FLOOR_Y);
                  
                  // Ground impact
                  ctx.beginPath();
                  ctx.ellipse(l.x, FLOOR_Y, 80, 20, 0, 0, Math.PI*2);
                  ctx.fillStyle = '#ffffff';
                  ctx.fill();
              }
          }
      }
  }

  drawDetailedPillar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
      // Base pillar color
      ctx.fillStyle = '#4c1d95';
      ctx.fillRect(x, y, w, h);
      
      // Shading for cylinder volume (left and right edges darker)
      const grad = ctx.createLinearGradient(x, y, x + w, y);
      grad.addColorStop(0, 'rgba(0,0,0,0.4)');
      grad.addColorStop(0.2, 'rgba(0,0,0,0)');
      grad.addColorStop(0.8, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);

      // Fluting (vertical grooves)
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      const grooves = 5;
      const spacing = w / (grooves + 1);
      for(let i=1; i<=grooves; i++) {
          ctx.fillRect(x + spacing * i - 2, y, 4, h);
      }

      // Base
      ctx.fillStyle = '#2e1065';
      ctx.fillRect(x - 10, y + h - 20, w + 20, 20);
      ctx.fillRect(x - 20, y + h - 10, w + 40, 10);

      // Top capital (if not completely broken)
      ctx.fillStyle = '#9ca3af';
      ctx.beginPath();
      ctx.moveTo(x - 10, y + 20);
      ctx.lineTo(x + w + 10, y + 20);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x, y);
      ctx.fill();
      
      // Cracks
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + w*0.2, y + h*0.3);
      ctx.lineTo(x + w*0.4, y + h*0.35);
      ctx.lineTo(x + w*0.3, y + h*0.4);
      ctx.stroke();
  }

  loop = (time: number) => {
    try {
    if (this.isPaused) return;

    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    // Cap dt to prevent massive jumps on tab switch
    if (dt < 0.1) {
       this.update(dt);
       this.draw();
    }

    this.animationId = requestAnimationFrame(this.loop);
    } catch(e) {
       console.error(e);
       this.ctx.fillStyle = 'red';
       this.ctx.font = '20px sans-serif';
       this.ctx.fillText(e.stack || e.message, 50, 50);
       throw e;
    }
  };


}
