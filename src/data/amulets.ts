import type { AmuletDef, AmuletColor } from './types';

export const AMULETS: AmuletDef[] = [
  // ---------- MUNDO 1 ----------
  {
    id: 'ossified_heart', name: 'Coração Ossificado', color: 'red', world: 1,
    desc: ['+2 de vida máxima.'],
    flavor: 'Bate devagar, mas nunca para.',
    mods: { maxHp: 2 },
  },
  {
    id: 'broken_wing', name: 'Pena da Asa Partida', color: 'blue', world: 1,
    desc: ['Habilidade: INVESTIDA.', 'Avança rápido e fica', 'invulnerável durante', 'o movimento.'],
    flavor: 'Ainda lembra como era voar.',
    mods: {}, ability: 'dash',
  },
  {
    id: 'crow_feather', name: 'Pena do Corvo', color: 'yellow', world: 1,
    desc: ['+15% de velocidade', 'de ataque.'],
    flavor: 'Os corvos aprenderam a ter pressa.',
    mods: { attackSpeed: 0.15 },
  },
  // ---------- MUNDO 2 ----------
  {
    id: 'golden_chalice', name: 'Cálice Dourado', color: 'red', world: 2,
    desc: ['+1 de vida máxima.', 'Cura 35% mais rápido.'],
    flavor: 'Nunca esvazia por completo.',
    mods: { maxHp: 1, healSpeed: 0.35 },
  },
  {
    id: 'judgment_horn', name: 'Trombeta do Juízo', color: 'blue', world: 2,
    desc: ['Habilidade: GRITO SÔNICO.', 'Empurra inimigos numa', 'grande área, atordoa', 'por 2s e destrói', 'projéteis. Custa 1 carga.'],
    flavor: 'O som que abriu os céus.',
    mods: {}, ability: 'scream',
  },
  {
    id: 'messenger_sandals', name: 'Sandálias do Mensageiro', color: 'yellow', world: 2,
    desc: ['+15% de velocidade', 'de movimento.', '+4 de dano.'],
    flavor: 'Mensagens divinas não esperam.',
    mods: { moveSpeed: 0.15, damageAdd: 4 },
  },
  // ---------- MUNDO 3 ----------
  {
    id: 'usurped_heart', name: 'Coração Usurpado', color: 'red', world: 3,
    desc: ['Cura 50% mais rápido.', 'Regenera 1 vida a', 'cada 30s.', '-50% de energia por golpe.'],
    flavor: 'Arrancado do peito do falso rei.',
    mods: { healSpeed: 0.5, regenEvery: 30, energyGain: -0.5 },
  },
  {
    id: 'celestial_aegis', name: 'Égide Celeste', color: 'blue', world: 3,
    desc: ['Com a vida cheia, um', 'escudo bloqueia', 'projéteis. Cada bloqueio', 'consome 10% da', 'barra de energia.'],
    flavor: 'Protege apenas os inteiros.',
    mods: { projectileShield: true },
  },
  {
    id: 'martyr_blade', name: 'Lâmina do Mártir', color: 'yellow', world: 3,
    desc: ['+10 de dano.', '-1 de vida máxima.', 'Magias custam +10%', 'de energia.'],
    flavor: 'Todo poder cobra seu sangue.',
    mods: { damageAdd: 10, maxHp: -1, energyCost: 0.1 },
  },
];

export const AMULET_BY_ID: Record<string, AmuletDef> = Object.fromEntries(AMULETS.map((a) => [a.id, a]));

export const COLOR_FRAME: Record<AmuletColor, number> = { red: 0, blue: 1, yellow: 2 };
export const COLOR_NAME: Record<AmuletColor, string> = { red: 'Vermelho', blue: 'Azul', yellow: 'Amarelo' };
export const COLOR_HEX: Record<AmuletColor, string> = { red: '#e83b3b', blue: '#4aa8ff', yellow: '#ffe45e' };
