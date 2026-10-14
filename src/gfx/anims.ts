import Phaser from 'phaser';

function anim(scene: Phaser.Scene, key: string, tex: string, frames: number[], frameRate: number, repeat = -1) {
  if (scene.anims.exists(key)) scene.anims.remove(key);
  scene.anims.create({ key, frames: frames.map((f) => ({ key: tex, frame: f })), frameRate, repeat });
}

export function buildAnims(scene: Phaser.Scene) {
  anim(scene, 'hero-idle', 'hero', [0, 1], 3);
  anim(scene, 'hero-run', 'hero', [2, 3, 4, 5], 11);

  anim(scene, 'skeleton-walk', 'skeleton', [0, 1, 2, 3], 7);
  anim(scene, 'archer-walk', 'archer', [0, 1], 4);
  anim(scene, 'zombie-walk', 'zombie', [0, 1, 2, 3], 5);
  anim(scene, 'crow-fly', 'crow', [0, 1], 8);
  anim(scene, 'knight-fly', 'knight', [0, 1], 6);
  anim(scene, 'profane-fly', 'profane', [0, 1], 7);
  anim(scene, 'ofanim-idle', 'ofanim', [0, 1], 4);
  anim(scene, 'voideye-idle', 'voideye', [0, 1], 4);
  anim(scene, 'sentinel-walk', 'sentinel', [0, 1], 4);
  anim(scene, 'fallen-idle', 'fallen', [0, 1], 4);

  anim(scene, 'boneking-idle', 'boneking', [0, 1], 3);
  anim(scene, 'seraph-idle', 'seraph', [0, 1], 5);
  anim(scene, 'falseangel-idle', 'falseangel', [0, 1], 3);
  anim(scene, 'falseangel-idle2', 'falseangel', [3, 4], 4);

  anim(scene, 'fx-slash', 'slash', [0, 1, 2], 24, 0);
  anim(scene, 'fx-scytheArc', 'scytheArc', [0, 1, 2], 20, 0);
  anim(scene, 'fx-thrust', 'thrust', [0, 1, 2], 20, 0);
  anim(scene, 'fx-punch', 'punch', [0, 1, 2], 30, 0);
  anim(scene, 'fx-spark', 'spark', [0, 1, 2, 3], 24, 0);
  anim(scene, 'fx-puff', 'puff', [0, 1, 2, 3], 14, 0);
  anim(scene, 'fx-portal', 'portal', [0, 1, 2, 3], 12);
  anim(scene, 'holyorb-spin', 'holyorb', [0, 1], 8);
  anim(scene, 'darkorb-spin', 'darkorb', [0, 1], 8);
  anim(scene, 'meteor-spin', 'meteor', [0, 1], 8);
  anim(scene, 'wave-run', 'wave', [0, 1], 12);
  anim(scene, 'shard-spin', 'shard', [0, 1], 6);
}
