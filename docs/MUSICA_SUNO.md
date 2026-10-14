# Trilha sonora no Suno

O jogo procura cada faixa em `public/music/<arquivo>.mp3`. Enquanto o arquivo não existir,
ele toca um placeholder (as músicas antigas do projeto). Basta gerar no Suno, baixar em MP3,
renomear exatamente como abaixo e jogar na pasta `public/music/`. Não precisa mudar código.

## Dicas gerais

- Ative **Instrumental** em todas as faixas.
- Todas tocam em **loop**. No Suno, use *Extend* até ~2–3 min e prefira trechos que terminem
  parecidos com o começo. Se precisar, corte o final num editor (Audacity) para o loop fechar.
- Para manter a identidade 16-bit, todo prompt usa a mesma base:
  `16-bit SNES soundtrack, retro JRPG, chiptune instrumentation`.
- Gere 2–4 variações por faixa e escolha a que tiver a melodia mais marcante.
- **Licença:** confira os termos atuais do Suno. Em geral, faixas geradas em plano gratuito
  são só para uso não comercial; para vender o jogo, gere num plano pago.

## Faixas

| Arquivo | Onde toca | BPM | Clima |
|---|---|---|---|
| `menu.mp3` | Título | 80 | Melancólico e heroico |
| `story.mp3` | Introdução | 70 | Narrativo, solene (opcional: cai no `menu`) |
| `map.mp3` | Mapa da ascensão | 95 | Jornada, esperança |
| `world1.mp3` | Mundo 1 — O Ossuário | 120 | Gótico, sombrio |
| `world2.mp3` | Mundo 2 — Os Átrios Dourados | 130 | Celestial, majestoso e hostil |
| `world3.mp3` | Mundo 3 — O Trono Usurpado | 140 | Catedral corrompida |
| `boss1.mp3` | Rei Ossário | 150 | Chefe gótico |
| `boss2.mp3` | Serafim Guardião | 160 | Épico angelical |
| `boss3.mp3` | O Falso Anjo (fases 1–2) | 150 | Chefe final épico |
| `boss3_final.mp3` | O Falso Anjo (fase final) | 170 | Desespero, caos |
| `reward.mp3` | Vitória e escolha de cartas | 70 | Santuário, calma |
| `ending.mp3` | Final e créditos | 85 | Triunfo emocional |

## Prompts (campo *Style of Music*)

**menu.mp3 — "Tema do Trono Caído"**
```
16-bit SNES soundtrack, retro JRPG, chiptune instrumentation, melancholic heroic main theme, slow 80 bpm, warm synth choir pads, harp arpeggios, lonely flute melody, soft timpani, fallen angel, nostalgic, loopable
```

**story.mp3 — "A Queda"**
```
16-bit SNES soundtrack, retro JRPG, chiptune instrumentation, solemn storytelling cue, 70 bpm, music box and harp, low strings, distant choir, sorrowful, cinematic, loopable
```

**map.mp3 — "A Ascensão"**
```
16-bit SNES soundtrack, retro JRPG, chiptune instrumentation, world map theme, 95 bpm, adventurous and hopeful, pizzicato strings, harp, gentle brass melody, steady march snare, loopable
```

**world1.mp3 — "O Ossuário"**
```
16-bit SNES soundtrack, gothic castlevania style, chiptune instrumentation, dark dungeon action theme, 120 bpm, pipe organ, harpsichord riffs, pizzicato bass, driving drums, crows, eerie and energetic, loopable
```

**world2.mp3 — "Os Átrios Dourados"**
```
16-bit SNES soundtrack, retro JRPG, chiptune instrumentation, heavenly palace battle theme, 130 bpm, bright brass fanfares, harp glissandos, angelic synth choir, majestic but hostile, golden, loopable
```

**world3.mp3 — "O Trono Usurpado"**
```
16-bit SNES soundtrack, dark gothic, chiptune instrumentation, corrupted cathedral battle theme, 140 bpm, distorted pipe organ, dissonant choir, heavy drums, tense strings, ominous, loopable
```

**boss1.mp3 — "Rei Ossário"**
```
16-bit SNES boss battle music, gothic castlevania style, chiptune instrumentation, 150 bpm, aggressive pipe organ, fast harpsichord arpeggios, pounding drums, skeleton king, menacing, loopable
```

**boss2.mp3 — "O Carcereiro dos Céus"**
```
16-bit SNES boss battle music, epic orchestral JRPG, chiptune instrumentation, 160 bpm, triumphant trumpets, angelic choir, fast strings ostinato, timpani rolls, seraph guardian, grand and threatening, loopable
```

**boss3.mp3 — "O Falso Anjo"**
```
16-bit SNES final boss music, epic JRPG, chiptune instrumentation, 150 bpm, latin choir chant, cathedral organ, heroic brass counter melody, relentless drums, divine and corrupted, climactic, loopable
```

**boss3_final.mp3 — "Desespero"**
```
16-bit SNES final boss last phase, chiptune instrumentation, 170 bpm, frantic and chaotic, distorted organ, screaming synth lead, double time drums, dissonant choir, apocalyptic, desperate, loopable
```

**reward.mp3 — "Santuário"**
```
16-bit SNES soundtrack, retro JRPG, chiptune instrumentation, peaceful sanctuary theme, 70 bpm, music box, soft harp, warm pads, gentle bells, safe and reflective, loopable
```

**ending.mp3 — "O Trono é Teu"**
```
16-bit SNES ending credits theme, retro JRPG, chiptune instrumentation, 85 bpm, triumphant yet emotional, full synth orchestra, choir swell, main theme reprise, bittersweet, heroic finale
```

## Efeitos sonoros

Os efeitos (golpes, pulo, cura, explosões etc.) são sintetizados em tempo real em
`src/audio/Sfx.ts`, no estilo chip, e não precisam de arquivo. O Suno não é bom para
efeitos curtos. Se quiser trocar algum, gere no [jsfxr](https://sfxr.me/) ou no ChipTone.
