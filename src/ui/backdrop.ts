import type Phaser from 'phaser';

// Mostra um cenário do jogo, ampliado e escurecido, atrás do canvas.
// Preenche as laterais em telas mais largas (ou altas) que 16:9.
const cache = new Map<string, string>();
let current = '';

export function setBackdrop(scene: Phaser.Scene, textureKey: string) {
  if (textureKey === current) return;
  const el = document.getElementById('backdrop');
  if (!el || !scene.textures.exists(textureKey)) return;
  let url = cache.get(textureKey);
  if (!url) {
    const src = scene.textures.get(textureKey).getSourceImage() as HTMLCanvasElement;
    if (!('toDataURL' in src)) return;
    url = src.toDataURL();
    cache.set(textureKey, url);
  }
  current = textureKey;
  el.style.opacity = '0';
  window.setTimeout(() => {
    el.style.backgroundImage = `url(${url})`;
    el.style.opacity = '1';
  }, 250);
}
