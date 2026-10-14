import type { CardDef, Rarity } from './types';

export const CARDS: CardDef[] = [
  // --- Propostas originais ---
  { id: 'slot_red', name: 'Relicário Carmesim', rarity: 'rare', max: 1,
    desc: ['+1 slot de amuleto', 'VERMELHO.'], mods: { slotRed: 1 } },
  { id: 'slot_blue', name: 'Relicário Celeste', rarity: 'rare', max: 1,
    desc: ['+1 slot de amuleto', 'AZUL.'], mods: { slotBlue: 1 } },
  { id: 'slot_yellow', name: 'Relicário Solar', rarity: 'rare', max: 1,
    desc: ['+1 slot de amuleto', 'AMARELO.'], mods: { slotYellow: 1 } },
  { id: 'spear', name: 'Lança do Arauto', rarity: 'common', max: 1,
    desc: ['Troca a arma pela', 'LANÇA: ataques mais', 'lentos, alcance maior.'], weapon: 'spear' },
  { id: 'bleed', name: 'Lâmina Cruel', rarity: 'common', max: 1,
    desc: ['Golpes causam', 'SANGRAMENTO: o inimigo', 'perde vida por 3s.'], mods: { bleed: true } },
  { id: 'weakness', name: 'Marca da Fraqueza', rarity: 'common', max: 1,
    desc: ['Golpes aplicam', 'FRAQUEZA por 1,5s:', 'o inimigo recebe +15%', 'de dano e fica lento.'], mods: { weakness: true } },
  { id: 'vigor', name: 'Vigor Divino', rarity: 'common', max: 3,
    desc: ['+1 de vida máxima', 'permanente.'], mods: { maxHp: 1 } },
  { id: 'vessel', name: 'Cálice Extra', rarity: 'common', max: 2,
    desc: ['+1 carga de energia', 'permanente.'], mods: { maxEnergy: 1 } },
  { id: 'grace', name: 'Graça Intangível', rarity: 'rare', max: 1,
    desc: ['20% de chance de', 'anular um ataque', 'recebido.'], mods: { dodge: 0.2 } },
  // --- Novas ---
  { id: 'edge', name: 'Gume Bento', rarity: 'common', max: 3,
    desc: ['+3 de dano.'], mods: { damageAdd: 3 } },
  { id: 'fervor', name: 'Fervor', rarity: 'common', max: 2,
    desc: ['+30% de energia', 'ganha por golpe.'], mods: { energyGain: 0.3 } },
  { id: 'judgment', name: 'Juízo Certeiro', rarity: 'rare', max: 1,
    desc: ['15% de chance de', 'acerto crítico', '(dano x2).'], mods: { crit: 0.15 } },
  { id: 'wings', name: 'Asas Restauradas', rarity: 'rare', max: 1,
    desc: ['Permite PULO DUPLO.'], mods: { doubleJump: true } },
  { id: 'thorns', name: 'Coroa de Espinhos', rarity: 'common', max: 1,
    desc: ['Ao ser atingido, causa', '20 de dano a todos', 'os inimigos próximos.'], mods: { thorns: 20 } },
  { id: 'greed', name: 'Ganância Dourada', rarity: 'common', max: 1,
    desc: ['+50% de Fragmentos', 'de Graça.'], mods: { fragmentGain: 0.5 } },
  { id: 'thirst', name: 'Sede Sagrada', rarity: 'rare', max: 1,
    desc: ['A cada 12 inimigos', 'derrotados, recupera', '1 de vida.'], mods: { killHeal: 12 } },
  { id: 'ether', name: 'Passos Etéreos', rarity: 'common', max: 1,
    desc: ['+10% de movimento.', 'Investida recarrega', '30% mais rápido.'], mods: { moveSpeed: 0.1, dashCooldown: -0.3 } },
  { id: 'pact', name: 'Pacto Profano', rarity: 'cursed', max: 1,
    desc: ['+35% de dano.', '-1 de vida máxima.'], mods: { damageMult: 0.35, maxHp: -1 } },
  { id: 'lastbreath', name: 'Último Suspiro', rarity: 'cursed', max: 1,
    desc: ['+80% de dano', 'enquanto estiver com', '1 de vida.'], mods: { lastStand: 0.8 } },
  { id: 'zeal', name: 'Zelo Cego', rarity: 'cursed', max: 1,
    desc: ['+25% de velocidade', 'de ataque.', '-25% de energia', 'por golpe.'], mods: { attackSpeed: 0.25, energyGain: -0.25 } },
];

export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, rare: 28, cursed: 12 };
export const RARITY_NAME: Record<Rarity, string> = { common: 'COMUM', rare: 'RARA', cursed: 'AMALDIÇOADA' };
export const RARITY_COLOR: Record<Rarity, number> = { common: 0xb8b0cc, rare: 0x4aa8ff, cursed: 0xc060ff };
