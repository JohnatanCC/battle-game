import type Phaser from 'phaser';
import type { Hero } from './Hero';
import type { Enemy } from './Enemy';
import type { Shot, ShotOpts } from './Shot';
import type { HazardOpts, Hazard } from './Hazard';
import type { Controls } from '../systems/Controls';
import type { Stats } from '../state/Stats';
import type { EnemyType } from '../data/types';

/** O que as entidades podem pedir à arena */
export interface ArenaApi extends Phaser.Scene {
  hero: Hero;
  stats: Stats;
  controls: Controls;
  floorY: number;
  world: number;
  frozen: boolean;
  cutscene: boolean;
  onBossReady(): void;
  bossSay(text: string): void;

  allTargets(): Enemy[];
  shotList(): Shot[];
  spawnShot(o: ShotOpts): Shot;
  spawnHazard(o: HazardOpts): Hazard;
  spawnEnemy(type: EnemyType, x: number, y: number, opts?: { noPortal?: boolean; summoned?: boolean }): void;
  onEnemyKilled(e: Enemy): void;
  onHeroDeath(): void;

  fx(key: string, x: number, y: number, opts?: { tint?: number; scale?: number; depth?: number }): void;
  ring(x: number, y: number, radius: number, color: number, ms: number): void;
  burst(x: number, y: number, tex: string, tint: number, n: number, speed?: number): void;
  healParticle(x: number, y: number): void;
  floatText(x: number, y: number, s: string, color?: string): void;
  shake(intensity: number, ms: number): void;
  flash(color: number, alpha: number): void;
  hitStop(ms: number): void;
  banner(title: string, sub?: string, color?: string): void;
}
