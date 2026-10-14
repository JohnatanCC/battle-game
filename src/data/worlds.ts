import type { WorldDef, Platform, LevelDef } from './types';

// Plataformas (o chão fica em y=328). Pulo alcança ~72px.
const L_A: Platform[] = [{ x: 96, y: 266, w: 112 }, { x: 432, y: 266, w: 112 }, { x: 264, y: 206, w: 112 }];
const L_B: Platform[] = [{ x: 56, y: 262, w: 96 }, { x: 272, y: 270, w: 96 }, { x: 488, y: 262, w: 96 }, { x: 164, y: 204, w: 80 }, { x: 396, y: 204, w: 80 }];
const L_C: Platform[] = [{ x: 200, y: 264, w: 240 }, { x: 40, y: 208, w: 96 }, { x: 504, y: 208, w: 96 }];
const BOSS_1: Platform[] = [{ x: 72, y: 262, w: 112 }, { x: 456, y: 262, w: 112 }];
const BOSS_2: Platform[] = [{ x: 88, y: 260, w: 96 }, { x: 272, y: 206, w: 96 }, { x: 456, y: 260, w: 96 }];
const BOSS_3: Platform[] = [{ x: 64, y: 262, w: 96 }, { x: 480, y: 262, w: 96 }, { x: 272, y: 214, w: 96 }];

function lvl(world: number, index: number, name: string, extra: Partial<LevelDef>): LevelDef {
  return { id: `${world}-${index}`, world, index, name, platforms: L_A, fragments: 20 + world * 10, ...extra };
}

export const WORLDS: WorldDef[] = [
  {
    id: 1, name: 'O Ossuário', subtitle: 'As profundezas onde os caídos apodrecem',
    bg: 'bg1', tiles: 'tiles1', music: 'world1', bossMusic: 'boss1',
    ambient: { tex: 'px', tint: 0x8a7cc8, dir: 'up' }, tint: 0x8a7cc8,
    levels: [
      lvl(1, 1, 'Fossa dos Esquecidos', {
        amulet: 'ossified_heart', platforms: L_A,
        waves: [['skeleton', 'skeleton'], ['skeleton', 'zombie', 'skeleton'], ['zombie', 'skeleton', 'skeleton', 'zombie']],
      }),
      lvl(1, 2, 'Ninho dos Corvos', {
        amulet: 'broken_wing', platforms: L_B,
        waves: [['crow', 'skeleton', 'crow'], ['archer', 'zombie', 'crow'], ['archer', 'skeleton', 'skeleton', 'crow', 'crow']],
      }),
      lvl(1, 3, 'Catacumba Uivante', {
        amulet: 'crow_feather', platforms: L_C,
        waves: [['archer', 'archer', 'skeleton'], ['crow', 'crow', 'crow', 'zombie'], ['zombie', 'zombie', 'archer', 'skeleton', 'crow', 'crow']],
      }),
      lvl(1, 4, 'Trono de Ossos', { boss: 'boneking', bossWeapon: 'scythe', platforms: BOSS_1, fragments: 80 }),
    ],
  },
  {
    id: 2, name: 'Os Átrios Dourados', subtitle: 'Os salões dos que te julgaram',
    bg: 'bg2', tiles: 'tiles2', music: 'world2', bossMusic: 'boss2',
    ambient: { tex: 'pfeather', tint: 0xffffff, dir: 'down' }, tint: 0xffd75e,
    levels: [
      lvl(2, 1, 'Pátio dos Querubins', {
        amulet: 'golden_chalice', platforms: L_A,
        waves: [['knight', 'sentinel'], ['ofanim', 'knight', 'sentinel'], ['ofanim', 'ofanim', 'knight', 'sentinel']],
      }),
      lvl(2, 2, 'Galeria dos Mil Olhos', {
        amulet: 'judgment_horn', platforms: L_B,
        waves: [['ofanim', 'ofanim', 'sentinel'], ['knight', 'knight', 'ofanim'], ['sentinel', 'sentinel', 'ofanim', 'ofanim', 'knight']],
      }),
      lvl(2, 3, 'Ponte do Juízo', {
        amulet: 'messenger_sandals', platforms: L_C,
        waves: [['knight', 'knight', 'knight'], ['sentinel', 'ofanim', 'ofanim', 'sentinel'], ['knight', 'knight', 'ofanim', 'ofanim', 'sentinel', 'sentinel']],
      }),
      lvl(2, 4, 'Portão do Carcereiro', { boss: 'seraph', bossWeapon: 'gauntlets', platforms: BOSS_2, fragments: 120 }),
    ],
  },
  {
    id: 3, name: 'O Trono Usurpado', subtitle: 'Onde o falso anjo se senta no teu lugar',
    bg: 'bg3', tiles: 'tiles3', music: 'world3', bossMusic: 'boss3',
    ambient: { tex: 'px', tint: 0xe83b3b, dir: 'up' }, tint: 0xe83b3b,
    levels: [
      lvl(3, 1, 'Escadaria Profanada', {
        amulet: 'usurped_heart', platforms: L_A,
        waves: [['fallen', 'profane'], ['voideye', 'fallen', 'skeleton', 'skeleton'], ['profane', 'profane', 'voideye', 'fallen']],
      }),
      lvl(3, 2, 'Salão dos Espelhos', {
        amulet: 'celestial_aegis', platforms: L_B,
        waves: [['voideye', 'voideye', 'fallen'], ['profane', 'sentinel', 'fallen', 'crow', 'crow'], ['voideye', 'voideye', 'fallen', 'fallen', 'profane']],
      }),
      lvl(3, 3, 'Antecâmara Sangrenta', {
        amulet: 'martyr_blade', platforms: L_C,
        waves: [['fallen', 'fallen', 'fallen'], ['profane', 'profane', 'voideye', 'archer', 'archer'], ['fallen', 'fallen', 'voideye', 'voideye', 'profane', 'sentinel']],
      }),
      lvl(3, 4, 'O Trono Usurpado', { boss: 'falseangel', platforms: BOSS_3, fragments: 0 }),
    ],
  },
];

/** Prólogo jogável (tutorial) logo após a cinemática de abertura */
export const PROLOGUE: LevelDef = {
  id: 'prologue', world: 1, index: 0, name: 'Despertar', platforms: L_A, fragments: 10, tutorial: true,
  waves: [['skeleton', 'skeleton', 'zombie']],
};

export const LEVEL_BY_ID: Record<string, LevelDef> = Object.fromEntries([
  ...WORLDS.flatMap((w) => w.levels.map((l) => [l.id, l])),
  [PROLOGUE.id, PROLOGUE],
]);

export const LEVEL_ORDER: string[] = WORLDS.flatMap((w) => w.levels.map((l) => l.id));

export const ENEMY_NAMES: Record<string, string> = {
  skeleton: 'Esqueleto', archer: 'Arqueiro Ossudo', zombie: 'Zumbi', crow: 'Corvo Amaldiçoado',
  knight: 'Cavaleiro Alado', ofanim: 'Ofanim', sentinel: 'Sentinela Dourada',
  fallen: 'Anjo Corrompido', voideye: 'Olho do Vazio', profane: 'Cavaleiro Profano',
};

/** Falas dos chefes: antes da luta, nas trocas de fase e na derrota */
export const BOSS_DIALOGUE: Record<string, { intro: string[]; phase: Record<number, string>; defeat: string }> = {
  boneking: {
    intro: [
      `Mais um que despenca do alto...
Eu também já fui luz, sabias?`,
      `Aqui embaixo ninguém precisa provar nada.
Fica. Descansa. Apodrece comigo.`,
    ],
    phase: { 2: 'Por que insistes? A luz te abandonou!' },
    defeat: 'Então... ainda tens fé. Que inveja.',
  },
  seraph: {
    intro: [
      `Fui eu quem desferiu o golpe que te lançou ao abismo.
Não por ódio. Por dever.`,
      `A lei do Trono não se curva a lembranças.
Se és digno, prova-o contra mim!`,
    ],
    phase: { 2: 'Teu brilho... é o mesmo de antes?!' },
    defeat: 'Vai. E lembra-te de quem eras.',
  },
  falseangel: {
    intro: [
      'Voltaste. Que tolice comovente.',
      `Este trono nunca foi teu.
Foi do teu orgulho.`,
    ],
    phase: {
      2: 'Ainda não me reconheces? Olha bem... este rosto é o teu.',
      3: 'Se eu cair, cais comigo!',
    },
    defeat: 'Então... és mais do que eu jamais fui...',
  },
};

export const BOSS_NAMES: Record<string, { name: string; title: string }> = {
  boneking: { name: 'REI OSSÁRIO', title: 'Senhor das Profundezas' },
  seraph: { name: 'SERAFIM GUARDIÃO', title: 'O Carcereiro dos Céus' },
  falseangel: { name: 'O FALSO ANJO', title: 'Usurpador do Trono' },
};
