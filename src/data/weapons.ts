import type { WeaponDef, WeaponId } from './types';

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  sword: {
    id: 'sword', name: 'Espada Partida', icon: 0,
    damage: 10, cooldown: 0.34, reach: 34, height: 26, knockback: 140, fx: 'slash',
    desc: ['Equilibrada e rápida.', 'Dano 10.'],
  },
  spear: {
    id: 'spear', name: 'Lança do Arauto', icon: 1,
    damage: 13, cooldown: 0.52, reach: 58, height: 12, knockback: 180, fx: 'thrust',
    desc: ['Golpes mais lentos,', 'alcance muito maior.', 'Dano 13.'],
  },
  scythe: {
    id: 'scythe', name: 'Foice do Ossário', icon: 2,
    damage: 11, cooldown: 0.46, reach: 44, height: 40, knockback: 120, fx: 'scytheArc',
    critBonus: 0.1, backHit: true,
    desc: ['Arco amplo que atinge', 'também atrás de você.', '+10% crítico. Dano 11.'],
  },
  gauntlets: {
    id: 'gauntlets', name: 'Manoplas do Serafim', icon: 3,
    damage: 6, cooldown: 0.17, reach: 24, height: 20, knockback: 60, fx: 'punch',
    comboShock: true,
    desc: ['Socos velozes. O 3º', 'golpe seguido solta', 'uma onda de choque.', 'Dano 6.'],
  },
};
