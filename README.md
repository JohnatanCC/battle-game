# Trono Caído

Jogo de batalhas em arena 16-bit. Você é um ser divino exilado que sobe das profundezas,
mundo após mundo, para retomar o trono do Falso Anjo.

- 3 mundos × 6 níveis (5 arenas + 1 chefe), com cinemática de abertura e prólogo jogável
- Build com 4 slots: arma + amuletos vermelho, azul e amarelo
- 1 carta a escolher entre 3 ao fim de cada nível
- Pixel art gerada em código, efeitos sonoros sintetizados e trilha feita no Suno

## Rodar

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # gera dist/ (site estático)
```

## Controles

| Ação | Teclado | Gamepad |
|---|---|---|
| Mover | A/D ou setas | Analógico / D-pad |
| Pular | Espaço ou Z | A |
| Atacar (+cima/baixo) | J ou X, ou clique (mira com o mouse) | X |
| Investida | SHIFT | RB / RT |
| Habilidade 1 / 2 | K ou C / L ou V | B / LB |
| Curar (segurar) | F ou H | Y |
| Descer plataforma | Baixo + pular | |
| Pausa | Esc ou P | Start |

## Estrutura

```
src/
  config.ts          resolução, chão, profundidades
  data/              amuletos, cartas, armas, mundos/níveis (balanceamento aqui)
  state/             save (localStorage) e cálculo de atributos da build
  entities/          herói, inimigos, chefes, projéteis, áreas de perigo
  scenes/            título, história, mapa, build, arena, recompensa, final
  gfx/               toda a pixel art, desenhada por código
  audio/             efeitos sintetizados e gerenciador de música
  ui/                textos, menus, painéis, HUD
  dev/testkit.ts     ferramentas de teste (só em `npm run dev`)
docs/
  GDD.md             documento de design
  MUSICA_SUNO.md     lista de faixas e prompts para o Suno
```

## Música

Coloque os MP3 gerados no Suno em `public/music/` com os nomes listados em
[docs/MUSICA_SUNO.md](docs/MUSICA_SUNO.md). Enquanto uma faixa não existir, o jogo toca um placeholder.

## Atalhos de desenvolvimento

- `?level=2-4`: abre direto numa arena (ex.: o Serafim)
- `?scene=Map`: abre direto numa cena
- `?scene=Prologue&act=3`: abre a cinemática de abertura num ato específico (1, 2 ou 3)
- `?level=prologue`: abre direto o tutorial
- No console: `__auto(3000)` joga sozinho (invencível), `__state()` resume a arena e
  `__sim(n)` avança n quadros
