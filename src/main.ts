import Phaser from 'phaser';
import '@fontsource/press-start-2p';
import { GAME_W, GAME_H, GRAVITY } from './config';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { StoryScene } from './scenes/StoryScene';
import { MapScene } from './scenes/MapScene';
import { BuildScene } from './scenes/BuildScene';
import { ArenaScene } from './scenes/ArenaScene';
import { RewardScene } from './scenes/RewardScene';
import { EndingScene } from './scenes/EndingScene';

async function boot() {
  try { await document.fonts.load('8px "Press Start 2P"'); } catch { /* segue sem a fonte */ }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_W,
    height: GAME_H,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#0b0814',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { gamepad: true },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: GRAVITY }, debug: false } },
    scene: [BootScene, TitleScene, StoryScene, MapScene, BuildScene, ArenaScene, RewardScene, EndingScene],
  });
  if (import.meta.env.DEV) {
    (window as unknown as { __game: Phaser.Game }).__game = game;
    import('./dev/testkit').then((m) => m.installTestkit(game));
  }
}
boot();
