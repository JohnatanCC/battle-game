# Trilha sonora no Suno

O jogo procura cada faixa em `public/music/<arquivo>.mp3`. Enquanto o arquivo não existir,
ele toca um placeholder (as músicas antigas do projeto). Basta gerar no Suno, baixar em MP3,
renomear exatamente como abaixo e jogar na pasta `public/music/`. Não precisa mudar código.

## Identidade sonora

**Retrô 16-bit + angelical + orquestral.** É o som de uma trilha de SNES (soundfont de
orquestra, reverb de catedral) com coral angelical, harpa, sinos e órgão. Cada mundo varia o clima,
mas todas as faixas compartilham a mesma base para soar como uma trilha única:

```
16-bit SNES orchestral soundtrack, retro JRPG, angelic synth choir, harp, celestial bells, cathedral reverb
```

## Como usar no Suno

1. Use o modo **Custom** e ligue **Instrumental**.
2. Cole o prompt da faixa no campo **Style of Music**.
3. No campo **Exclude Styles** (se disponível), cole:
   ```
   lead vocals, lyrics, rap, EDM, dubstep, trap, modern pop, electric guitar, autotune
   ```
4. Gere 2–4 variações e escolha a de melodia mais marcante. Use *Extend* até ~2–3 min.
5. Todas tocam em **loop**: prefira trechos cujo final lembre o começo. Se precisar, corte num
   editor (Audacity) para o loop fechar.
6. **Licença:** confira os termos atuais do Suno. Em geral, faixas do plano gratuito são só para
   uso não comercial; para vender o jogo, gere num plano pago.

## Faixas

| Arquivo | Onde toca | BPM | Clima |
|---|---|---|---|
| `menu.mp3` | Título | 80 | Majestoso e melancólico |
| `world1.mp3` | Fases do Mundo 1 — O Ossuário | 125 | Sagrado no abismo, sombrio e heroico |
| `world2.mp3` | Fases do Mundo 2 — Os Átrios Dourados | 135 | Celestial radiante, majestoso e hostil |
| `world3.mp3` | Fases do Mundo 3 — O Trono Usurpado | 145 | Sagrado corrompido, tenso |
| `boss1.mp3` | Rei Ossário | 150 | Chefe sombrio e solene |
| `boss2.mp3` | Serafim Guardião | 160 | Épico angelical |
| `boss3.mp3` | O Falso Anjo (fases 1–2) | 150 | Chefe final grandioso |
| `boss3_final.mp3` | O Falso Anjo (fase final) | 170 | Desespero apocalíptico |
| `map.mp3`, `story.mp3`, `reward.mp3`, `ending.mp3` | Mapa, história, recompensa, créditos | — | Opcionais: sem elas toca o placeholder |

---

## Menu

**menu.mp3 — "Tema do Trono Caído"**
```
16-bit SNES orchestral soundtrack, retro JRPG main title theme, 80 bpm, majestic and melancholic, angelic synth choir pads, harp arpeggios, soft strings, solo flute melody, celestial bells, gentle timpani, cathedral reverb, fallen angel, nostalgic, loopable
```

## Fases de batalha

**world1.mp3 — "O Ossuário" (luz divina no abismo)**
```
16-bit SNES orchestral soundtrack, retro JRPG battle theme, 125 bpm, minor key, dark sacred atmosphere, pipe organ, pizzicato strings, low angelic choir, harp runs, celestial bells, driving snare and timpani, heroic rising melody, cathedral reverb, loopable
```

**world2.mp3 — "Os Átrios Dourados" (o céu que te julgou)**
```
16-bit SNES orchestral soundtrack, retro JRPG battle theme, 135 bpm, radiant heavenly palace, bright brass fanfares, soaring strings, angelic soprano synth choir, harp glissandos, glockenspiel, celestial bells, marching percussion, majestic yet hostile, loopable
```

**world3.mp3 — "O Trono Usurpado" (o sagrado corrompido)**

> Mundo 3 usa **rock/metal sombrio**. Nas faixas do Mundo 3, tire `electric guitar` do *Exclude Styles*.

```
16-bit retro symphonic metal, SNES soundfont, dark gothic battle theme, 145 bpm, minor key, distorted electric guitar riffs, palm-muted chugs, driving double bass drums, cathedral pipe organ, dark angelic choir, string ostinato, tolling bells, ominous and aggressive, loopable
```

## Chefes

**boss1.mp3 — "Rei Ossário"**
```
16-bit SNES orchestral boss battle, retro JRPG, 150 bpm, minor key, aggressive pipe organ riff, fast string ostinato, chanting angelic choir, brass hits, pounding timpani, tolling church bells, dark and solemn, intense, loopable
```

**boss2.mp3 — "Serafim Guardião"**
```
16-bit SNES orchestral boss battle, retro JRPG, 160 bpm, epic seraph battle, heroic brass fanfare, full angelic choir, rapid harp and strings, timpani rolls, celestial bells, cymbal crashes, triumphant yet threatening, loopable
```

**boss3.mp3 — "O Falso Anjo"** (Mundo 3: rock/metal sombrio)
```
16-bit retro symphonic metal, SNES soundfont, epic final boss battle, 150 bpm, minor key, heavy distorted guitar riffs, shredding guitar lead, double bass drums, cathedral pipe organ, latin angelic choir chant, orchestral brass hits, dark and climactic, divine yet corrupted, loopable
```

**boss3_final.mp3 — "Desespero" (fase final)** (Mundo 3: rock/metal sombrio)
```
16-bit retro extreme symphonic metal, SNES soundfont, final boss last phase, 175 bpm, frantic and apocalyptic, tremolo picked distorted guitars, blast beat drums, fast guitar solo, distorted pipe organ, screaming dark choir, chaotic strings, tolling bells, desperate, loopable
```

---

## Opcionais

**map.mp3** — `16-bit SNES orchestral soundtrack, retro JRPG world map theme, 95 bpm, hopeful ascension, pizzicato strings, harp, gentle brass melody, angelic synth choir, soft march snare, loopable`

**story.mp3** — `16-bit SNES orchestral soundtrack, retro JRPG story cue, 70 bpm, solemn and sorrowful, music box, harp, low strings, distant angelic choir, cathedral reverb, loopable`

**reward.mp3** — `16-bit SNES orchestral soundtrack, retro JRPG sanctuary theme, 70 bpm, peaceful and holy, harp, music box, warm angelic choir pads, gentle bells, loopable`

**ending.mp3** — `16-bit SNES orchestral ending credits, retro JRPG, 85 bpm, triumphant and emotional, full orchestra, angelic choir swell, main theme reprise, harp, bells, bittersweet heroic finale`

## Efeitos sonoros

Os efeitos (golpes, pulo, cura, explosões etc.) são sintetizados em tempo real em
`src/audio/Sfx.ts`, no estilo chip, e não precisam de arquivo. O Suno não é bom para
efeitos curtos. Se quiser trocar algum, gere no [jsfxr](https://sfxr.me/) ou no ChipTone.
