// Paleta limitada estilo 16-bit. Toda a arte gerada usa estas cores.
export const C = {
  black: '#0b0814',
  outline: '#140c1c',
  night: '#1a1230',
  deep: '#241a3e',
  violet: '#3b2d6b',
  violetLight: '#5a4a9a',
  lilac: '#8a7cc8',

  white: '#f4f0ff',
  bone: '#e8e0c8',
  boneMid: '#bfb293',
  boneDark: '#857a5e',

  skin: '#f0d8c0',
  skinShade: '#c8a088',

  silver: '#d0dcf0',
  silverMid: '#94a4c4',
  silverDark: '#5a6688',

  gold: '#ffd75e',
  goldMid: '#e0a030',
  goldDark: '#9a6418',

  red: '#e83b3b',
  redMid: '#a8202e',
  redDark: '#5e1024',
  blood: '#8a0f1e',

  blue: '#4aa8ff',
  blueMid: '#2a6ad0',
  blueDark: '#1a3478',
  cyan: '#8ef0ff',

  yellow: '#ffe45e',
  yellowMid: '#e0b020',

  green: '#8ab070',
  greenMid: '#5e8050',
  greenDark: '#34503a',

  brown: '#8a5a3a',
  brownDark: '#4e3024',

  stone: '#6a6080',
  stoneMid: '#4a4262',
  stoneDark: '#2e2842',

  marble: '#e8e4f0',
  marbleMid: '#b8b0cc',
  marbleDark: '#7e7498',

  crimson: '#c0203a',
  void: '#7a2ab8',
  voidLight: '#c060ff',
  voidDark: '#3a0f5e',
};

export const hex = (c: string) => parseInt(c.slice(1), 16);
