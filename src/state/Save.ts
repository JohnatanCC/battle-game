import type { AmuletColor, WeaponId } from '../data/types';
import { AMULET_BY_ID } from '../data/amulets';
import { CARD_BY_ID } from '../data/cards';
import { LEVEL_ORDER } from '../data/worlds';

export interface SaveData {
  v: 1;
  cleared: string[];
  amulets: string[];
  equipped: Record<AmuletColor, string[]>;
  weapons: WeaponId[];
  weapon: WeaponId;
  cards: Record<string, number>;
  fragments: number;
  deaths: number;
  finished: boolean;
  introSeen: boolean;
}

export interface Settings {
  music: number;
  sfx: number;
  shake: boolean;
}

const SAVE_KEY = 'trono-caido-save-v1';
const SETTINGS_KEY = 'trono-caido-settings-v1';

function fresh(): SaveData {
  return {
    v: 1, cleared: [], amulets: [], equipped: { red: [], blue: [], yellow: [] },
    weapons: ['sword'], weapon: 'sword', cards: {}, fragments: 0, deaths: 0, finished: false, introSeen: false,
  };
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* armazenamento indisponível */ }
}

class SaveStore {
  data: SaveData = fresh();
  settings: Settings = { music: 0.5, sfx: 0.7, shake: true };

  load() {
    const s = read<SaveData>(SAVE_KEY);
    if (s && s.v === 1) this.data = { ...fresh(), ...s };
    const st = read<Settings>(SETTINGS_KEY);
    if (st) this.settings = { ...this.settings, ...st };
  }

  hasGame() {
    const s = read<SaveData>(SAVE_KEY);
    return !!s && (s.cleared.length > 0 || s.introSeen);
  }

  newGame() {
    this.data = fresh();
    this.persist();
  }

  persist() { write(SAVE_KEY, this.data); }
  persistSettings() { write(SETTINGS_KEY, this.settings); }

  isCleared(id: string) { return this.data.cleared.includes(id); }

  isUnlocked(id: string) {
    const i = LEVEL_ORDER.indexOf(id);
    return i === 0 || (i > 0 && this.isCleared(LEVEL_ORDER[i - 1]));
  }

  /** Próximo nível não concluído */
  nextLevel(): string {
    return LEVEL_ORDER.find((id) => !this.isCleared(id)) ?? LEVEL_ORDER[LEVEL_ORDER.length - 1];
  }

  cardCount(id: string) { return this.data.cards[id] ?? 0; }

  slots(color: AmuletColor) {
    const key = color === 'red' ? 'slotRed' : color === 'blue' ? 'slotBlue' : 'slotYellow';
    let n = 1;
    for (const [cid, count] of Object.entries(this.data.cards)) {
      const m = CARD_BY_ID[cid]?.mods?.[key];
      if (typeof m === 'number') n += m * count;
    }
    return n;
  }

  grantAmulet(id: string) {
    if (this.data.amulets.includes(id)) return;
    this.data.amulets.push(id);
    const a = AMULET_BY_ID[id];
    // equipa automaticamente se houver espaço
    if (a && this.data.equipped[a.color].length < this.slots(a.color)) this.data.equipped[a.color].push(id);
  }

  isEquipped(id: string) {
    const a = AMULET_BY_ID[id];
    return !!a && this.data.equipped[a.color].includes(id);
  }

  /** Alterna equipado/desequipado. Se os slots estiverem cheios, substitui o mais antigo. */
  toggleEquip(id: string) {
    const a = AMULET_BY_ID[id];
    if (!a) return;
    const list = this.data.equipped[a.color];
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
    else {
      if (list.length >= this.slots(a.color)) list.shift();
      list.push(id);
    }
  }

  grantCard(id: string) {
    const c = CARD_BY_ID[id];
    if (!c) return;
    this.data.cards[id] = (this.data.cards[id] ?? 0) + 1;
    if (c.weapon) {
      if (!this.data.weapons.includes(c.weapon)) this.data.weapons.push(c.weapon);
      this.data.weapon = c.weapon;
    }
  }

  grantWeapon(w: WeaponId) {
    if (!this.data.weapons.includes(w)) this.data.weapons.push(w);
  }
}

export const Save = new SaveStore();
