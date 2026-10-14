import { useEffect, useRef, useLayoutEffect } from 'react';
import { GameEngine, resizeGame } from '../game/GameEngine';

interface GameCanvasProps {
  gameMode?: 'tutorial' | 'battle' | 'devastated_path';
  retroMode?: boolean;
  character?: 'knight' | 'witch';
  sfxVolume?: number;
  isPaused?: boolean;
  onPlayerHpChange: (hp: number) => void;
  onEnemyHpChange: (hp: number, maxHp?: number) => void;
  onGameOver: () => void;
  onVitalChargesChange?: (charges: number) => void;
  onIntroFinish?: () => void;
}

export function GameCanvas({
  retroMode,
  character = 'knight',
  gameMode = 'battle',
  sfxVolume = 0.7,
  isPaused = false,
  onPlayerHpChange,
  onEnemyHpChange,
  onGameOver,
  onVitalChargesChange,
  onIntroFinish
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  useLayoutEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        resizeGame(window.innerWidth, window.innerHeight);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new GameEngine(canvasRef.current, character, gameMode, sfxVolume);
    engineRef.current = engine;

    engine.onGameOver = () => { onGameOver(); };
    engine.onPlayerHpChange = (hp) => {
      onPlayerHpChange(hp);
      if (hp <= 0) {
        onGameOver();
      }
    };
    engine.onEnemyHpChange = (hp, maxHp) => {
      onEnemyHpChange(hp, maxHp);
    };
    engine.onVitalChargesChange = (charges) => {
      if (onVitalChargesChange) onVitalChargesChange(charges);
    };
    engine.onIntroFinish = () => {
      if (onIntroFinish) onIntroFinish();
    };

    window.addEventListener('keydown', engine.handleKeyDown);
    window.addEventListener('keyup', engine.handleKeyUp);
    canvasRef.current.addEventListener('mousedown', engine.handleMouseDown);
    canvasRef.current.addEventListener('mouseup', engine.handleMouseUp);
    canvasRef.current.addEventListener('mousemove', engine.handleMouseMove);
    canvasRef.current.addEventListener('contextmenu', engine.handleContextMenu);

    engine.retroMode = !!retroMode;
    engine.start();
    canvasRef.current?.focus();

    return () => {
      engine.stop();
      window.removeEventListener('keydown', engine.handleKeyDown);
      window.removeEventListener('keyup', engine.handleKeyUp);
      if (canvasRef.current) {
        canvasRef.current.removeEventListener('mousedown', engine.handleMouseDown);
        canvasRef.current.removeEventListener('mouseup', engine.handleMouseUp);
        canvasRef.current.removeEventListener('mousemove', engine.handleMouseMove);
        canvasRef.current.removeEventListener('contextmenu', engine.handleContextMenu);
      }
    };
  }, []);

  useEffect(() => {
      if (engineRef.current) {
          engineRef.current.retroMode = !!retroMode;
      }
  }, [retroMode]);

  useEffect(() => {
      if (engineRef.current && sfxVolume !== undefined) {
          engineRef.current.setSfxVolume(sfxVolume);
      }
  }, [sfxVolume]);

  useEffect(() => {
      if (engineRef.current) {
          if (isPaused) {
              engineRef.current.pause();
          } else {
              engineRef.current.resume();
          }
      }
  }, [isPaused]);

  return (
    <canvas
      ref={canvasRef}
      tabIndex={0}
      className="w-full h-full block bg-stone-900 cursor-crosshair outline-none"
      style={{ imageRendering: retroMode ? "pixelated" : "auto" }}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
