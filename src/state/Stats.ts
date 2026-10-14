import { EMPTY_MODS, type Mods, type AbilityId, type WeaponDef } from '../data/types';
import { AMULET_BY_ID } from '../data/amulets';
import { CARD_BY_ID } from '../data/cards';
import { WEAPONS } from '../data/weapons';
import { Save } from './Save';

export const BASE = {
  hp: 5,
  energy: 3,
  moveSpeed: 115,
  healTime: 1.1,
  energyPerHit: 0.25,
  spellCost: 1,
  dashCooldown: 0.65,
};

export interface Stats {
  maxHp: number;
  maxEnergy: number;
  weapon: WeaponDef;
  damage: number;
  damageMult: number;
  attackCooldown: number;
  moveSpeed: number;
  healTime: number;
  energyPerHit: number;
  spellCost: number;
  regenEvery: number;
  shield: boolean;
  bleed: boolean;
  weakness: boolean;
  dodge: number;
  crit: number;
  doubleJump: boolean;
  thorns: number;
  fragmentMult: number;
  killHeal: number;
  lastStand: number;
  dashCooldown: number;
  abilities: AbilityId[];
}

function addMods(into: Mods, m: Partial<Mods>, times = 1) {
  for (const k of Object.keys(m) as (keyof Mods)[]) {
    const v = m[k];
    if (typeof v === 'boolean') (into[k] as boolean) = (into[k] as boolean) || v;
    else if (k === 'regenEvery') into.regenEvery = into.regenEvery ? Math.min(into.regenEvery, v as number) : (v as number);
    else (into[k] as number) += (v as number) * times;
  }
}

export function totalMods(): Mods {
  const m: Mods = { ...EMPTY_MODS };
  const d = Save.data;
  for (const color of ['red', 'blue', 'yellow'] as const)
    for (const id of d.equipped[color]) {
      const a = AMULET_BY_ID[id];
      if (a) addMods(m, a.mods);
    }
  for (const [id, n] of Object.entries(d.cards)) {
    const c = CARD_BY_ID[id];
    if (c?.mods) addMods(m, c.mods, n);
  }
  return m;
}

export function computeStats(): Stats {
  const m = totalMods();
  const weapon = WEAPONS[Save.data.weapon] ?? WEAPONS.sword;
  const abilities: AbilityId[] = [];
  for (const id of Save.data.equipped.blue) {
    const ab = AMULET_BY_ID[id]?.ability;
    if (ab && !abilities.includes(ab)) abilities.push(ab);
  }
  return {
    maxHp: Math.max(1, BASE.hp + m.maxHp),
    maxEnergy: Math.max(1, BASE.energy + m.maxEnergy),
    weapon,
    damage: weapon.damage + m.damageAdd,
    damageMult: 1 + m.damageMult,
    attackCooldown: weapon.cooldown / (1 + m.attackSpeed),
    moveSpeed: BASE.moveSpeed * (1 + m.moveSpeed),
    healTime: BASE.healTime / (1 + m.healSpeed),
    energyPerHit: Math.max(0.04, BASE.energyPerHit * (1 + m.energyGain)),
    spellCost: BASE.spellCost * (1 + m.energyCost),
    regenEvery: m.regenEvery,
    shield: m.projectileShield,
    bleed: m.bleed,
    weakness: m.weakness,
    dodge: Math.min(0.6, m.dodge),
    crit: Math.min(0.8, m.crit + (weapon.critBonus ?? 0)),
    doubleJump: m.doubleJump,
    thorns: m.thorns,
    fragmentMult: 1 + m.fragmentGain,
    killHeal: m.killHeal,
    lastStand: m.lastStand,
    dashCooldown: BASE.dashCooldown * Math.max(0.3, 1 + m.dashCooldown),
    abilities,
  };
}
