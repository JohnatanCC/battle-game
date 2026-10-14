import Phaser from 'phaser';
import { buildHeroArt } from '../gfx/heroArt';
import { buildEnemyArt } from '../gfx/enemyArt';
import { buildBossArt } from '../gfx/bossArt';
import { buildFxArt } from '../gfx/fxArt';
import { buildBackgrounds } from '../gfx/bgArt';
import { buildAnims } from '../gfx/anims';
import { Save } from '../state/Save';
import { Sfx } from '../audio/Sfx';
import { Music } from '../audio/Music';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    // Toda a arte é gerada proceduralmente em memória
    buildHeroArt(this);
    buildEnemyArt(this);
    buildBossArt(this);
    buildFxArt(this);
    buildBackgrounds(this);
    buildAnims(this);

    Save.load();
    Sfx.setVolume(Save.settings.sfx);
    Music.setVolume(Save.settings.music);

    // Navegadores só liberam áudio após interação
    const unlock = () => { Sfx.unlock(); Music.resume(); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    // Atalho de desenvolvimento: ?level=2-4 abre direto na arena
    const params = new URLSearchParams(location.search);
    const level = params.get('level');
    if (level) {
      if (params.get('god')) this.grantDebugBuild(params.get('god')!);
      this.scene.start('Arena', { levelId: level });
      return;
    }
    const scene = params.get('scene');
    if (scene) { this.scene.start(scene, {}); return; }
    this.scene.start('Title');
  }

  /** Build de teste para desenvolvimento (?god=1) */
  private grantDebugBuild(_v: string) {
    Save.newGame();
    for (const id of ['broken_wing', 'ossified_heart', 'crow_feather']) Save.grantAmulet(id);
  }
}
