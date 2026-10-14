import type { AmuletDef, AmuletColor } from './types';

export const AMULETS: AmuletDef[] = [
  // ---------- MUNDO 1 ----------
  {
    id: 'ossified_heart', name: 'Coração Ossificado', color: 'red', world: 1,
    desc: ['+2 de vida máxima.'],
    flavor: 'Teu antigo vigor, petrificado entre os mortos.',
    mods: { maxHp: 2 },
  },
  {
    id: 'broken_wing', name: 'Pena da Asa Partida', color: 'blue', world: 1,
    desc: ['Habilidade: INVESTIDA', '(tecla SHIFT).', 'Avança rápido e fica', 'invulnerável durante', 'o movimento.'],
    flavor: 'Uma pena da asa que te arrancaram. Ainda lembra o voo.',
    mods: {}, ability: 'dash',
  },
  {
    id: 'crow_feather', name: 'Pena do Corvo', color: 'yellow', world: 1,
    desc: ['+15% de velocidade', 'de ataque.'],
    flavor: 'Os corvos guardaram tua pressa. Devolvem-na agora.',
    mods: { attackSpeed: 0.15 },
  },
  {
    id: 'gravedigger_relic', name: 'Relicário do Coveiro', color: 'red', world: 1,
    desc: ['Ao limpar cada onda,', 'recupera 1 de vida.'],
    flavor: 'Quem enterra os mortos aprende a seguir em frente.',
    mods: { waveHeal: 1 },
  },
  {
    id: 'spectral_blade', name: 'Lâmina Espectral', color: 'blue', world: 1,
    desc: ['Habilidade: LÂMINA', 'ESPECTRAL. Dispara um', 'corte de luz que', 'atravessa inimigos.', 'Custa 1/2 carga.'],
    flavor: 'O eco do golpe que um dia partiu as trevas.',
    mods: {}, ability: 'spectral',
  },
  // ---------- MUNDO 2 ----------
  {
    id: 'golden_chalice', name: 'Cálice Dourado', color: 'red', world: 2,
    desc: ['+1 de vida máxima.', 'Cura 35% mais rápido.'],
    flavor: 'O cálice de onde bebias a graça. Ainda não secou.',
    mods: { maxHp: 1, healSpeed: 0.35 },
  },
  {
    id: 'judgment_horn', name: 'Trombeta do Juízo', color: 'blue', world: 2,
    desc: ['Habilidade: GRITO SÔNICO.', 'Empurra inimigos numa', 'grande área, atordoa', 'por 2s e destrói', 'projéteis. Custa 1 carga.'],
    flavor: 'Tua voz de comando, roubada e trancada nos Átrios.',
    mods: {}, ability: 'scream',
  },
  {
    id: 'messenger_sandals', name: 'Sandálias do Mensageiro', color: 'yellow', world: 2,
    desc: ['+15% de velocidade', 'de movimento.', '+4 de dano.'],
    flavor: 'Os passos com que levavas a palavra do Trono.',
    mods: { moveSpeed: 0.15, damageAdd: 4 },
  },
  {
    id: 'cherub_plume', name: 'Pluma do Querubim', color: 'yellow', world: 2,
    desc: ['Permite PULO DUPLO.', 'Golpes para baixo', 'causam +50% de dano.'],
    flavor: 'Leve como a primeira asa que tiveste.',
    mods: { doubleJump: true, pogoBonus: 0.5 },
  },
  {
    id: 'seraph_tear', name: 'Lágrima do Serafim', color: 'red', world: 2,
    desc: ['Uma vez por arena,', 'sobrevive a um golpe', 'fatal com 1 de vida.'],
    flavor: 'Ele chorou ao te lançar ao abismo.',
    mods: { cheatDeath: true },
  },
  // ---------- MUNDO 3 ----------
  {
    id: 'usurped_heart', name: 'Coração Usurpado', color: 'red', world: 3,
    desc: ['Cura 50% mais rápido.', 'Regenera 1 vida a', 'cada 30s.', '-50% de energia por golpe.'],
    flavor: 'O coração que o falso anjo tomou de ti. Bate com rancor.',
    mods: { healSpeed: 0.5, regenEvery: 30, energyGain: -0.5 },
  },
  {
    id: 'celestial_aegis', name: 'Égide Celeste', color: 'blue', world: 3,
    desc: ['Com a vida cheia, um', 'escudo bloqueia', 'projéteis. Cada bloqueio', 'consome 10% da', 'barra de energia.'],
    flavor: 'O escudo que juraste erguer. Só protege os inteiros.',
    mods: { projectileShield: true },
  },
  {
    id: 'martyr_blade', name: 'Lâmina do Mártir', color: 'yellow', world: 3,
    desc: ['+10 de dano.', '-1 de vida máxima.', 'Magias custam +10%', 'de energia.'],
    flavor: 'O fio da tua antiga lâmina. Também corta quem a empunha.',
    mods: { damageAdd: 10, maxHp: -1, energyCost: 0.1 },
  },
  {
    id: 'void_eye', name: 'Olho do Abismo', color: 'yellow', world: 3,
    desc: ['+20% de chance de', 'crítico. Críticos', 'recarregam energia.'],
    flavor: 'Tudo o que olhaste no fundo agora te enxerga também.',
    mods: { crit: 0.2, critEnergy: 0.2 },
  },
  {
    id: 'final_judgment', name: 'Selo do Juízo Final', color: 'blue', world: 3,
    desc: ['Habilidade: JUÍZO.', 'Lança 8 lanças de luz', 'ao teu redor, com', 'dano altíssimo.', 'Custa 2 cargas.'],
    flavor: 'A sentença que um dia foi tua de proferir.',
    mods: {}, ability: 'judgment',
  },
];

export const AMULET_BY_ID: Record<string, AmuletDef> = Object.fromEntries(AMULETS.map((a) => [a.id, a]));

export const COLOR_FRAME: Record<AmuletColor, number> = { red: 0, blue: 1, yellow: 2 };
export const COLOR_NAME: Record<AmuletColor, string> = { red: 'Vermelho', blue: 'Azul', yellow: 'Amarelo' };
export const COLOR_HEX: Record<AmuletColor, string> = { red: '#e83b3b', blue: '#4aa8ff', yellow: '#ffe45e' };
