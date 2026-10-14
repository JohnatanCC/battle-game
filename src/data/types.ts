export type AmuletColor = 'red' | 'blue' | 'yellow';
export type WeaponId = 'sword' | 'spear' | 'scythe' | 'gauntlets';
export type AbilityId = 'dash' | 'scream';
export type Rarity = 'common' | 'rare' | 'cursed';

/** Modificadores somáveis vindos de amuletos e cartas */
export interface Mods {
  maxHp: number;
  maxEnergy: number;
  damageAdd: number;
  damageMult: number;     // +0.35 = +35%
  attackSpeed: number;    // +0.15 = 15% mais rápido
  moveSpeed: number;
  healSpeed: number;      // +0.5 = cura 50% mais rápida
  energyGain: number;     // -0.5 = metade da energia por golpe
  energyCost: number;     // +0.1 = magias custam 10% a mais
  regenEvery: number;     // segundos para regenerar 1 vida (0 = nada)
  projectileShield: boolean;
  bleed: boolean;
  weakness: boolean;
  dodge: number;          // chance de anular um ataque
  crit: number;           // chance de crítico (dano x2)
  slotRed: number;
  slotBlue: number;
  slotYellow: number;
  doubleJump: boolean;
  thorns: number;         // dano em área ao ser atingido
  fragmentGain: number;
  killHeal: number;       // a cada N abates, cura 1
  lastStand: number;      // bônus de dano com 1 de vida
  dashCooldown: number;   // -0.3 = recarga 30% menor
}

export const EMPTY_MODS: Mods = {
  maxHp: 0, maxEnergy: 0, damageAdd: 0, damageMult: 0, attackSpeed: 0, moveSpeed: 0,
  healSpeed: 0, energyGain: 0, energyCost: 0, regenEvery: 0, projectileShield: false,
  bleed: false, weakness: false, dodge: 0, crit: 0, slotRed: 0, slotBlue: 0, slotYellow: 0,
  doubleJump: false, thorns: 0, fragmentGain: 0, killHeal: 0, lastStand: 0, dashCooldown: 0,
};

export interface AmuletDef {
  id: string;
  name: string;
  color: AmuletColor;
  world: number;
  desc: string[];
  flavor: string;
  mods: Partial<Mods>;
  ability?: AbilityId;
}

export interface CardDef {
  id: string;
  name: string;
  rarity: Rarity;
  desc: string[];
  max: number;            // quantas vezes pode ser escolhida
  mods?: Partial<Mods>;
  weapon?: WeaponId;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  icon: number;
  damage: number;
  cooldown: number;       // segundos entre golpes
  reach: number;          // alcance horizontal da hitbox
  height: number;         // altura da hitbox
  knockback: number;
  fx: 'slash' | 'thrust' | 'scytheArc' | 'punch';
  desc: string[];
  critBonus?: number;
  backHit?: boolean;      // atinge também atrás (foice)
  comboShock?: boolean;   // 3º golpe gera onda de choque (manoplas)
}

export type EnemyType =
  | 'skeleton' | 'archer' | 'zombie' | 'crow'
  | 'knight' | 'ofanim' | 'sentinel'
  | 'fallen' | 'voideye' | 'profane';

export type BossType = 'boneking' | 'seraph' | 'falseangel';

export interface Platform { x: number; y: number; w: number; }

export interface LevelDef {
  id: string;             // "1-2"
  world: number;
  index: number;          // 1..4
  name: string;
  amulet?: string;
  waves?: EnemyType[][];
  boss?: BossType;
  bossWeapon?: WeaponId;
  platforms: Platform[];
  fragments: number;
  tutorial?: boolean;
}

export interface WorldDef {
  id: number;
  name: string;
  subtitle: string;
  bg: string;
  tiles: string;
  music: 'world1' | 'world2' | 'world3';
  bossMusic: 'boss1' | 'boss2' | 'boss3';
  ambient: { tex: string; tint: number; dir: 'up' | 'down' };
  tint: number;
  levels: LevelDef[];
}
