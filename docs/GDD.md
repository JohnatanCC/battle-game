# Trono Caído — Documento de Design

Jogo de batalhas em arena, em pixel art 16-bit (640×360) e visão lateral com plataformas.

## Lore

Tu eras a Chama do Trono, o primeiro guardião dos céus. Um anjo de rosto dourado
sussurrou mentiras ao reino: tua coroa foi partida, tuas asas arrancadas, e foste lançado
às profundezas. Despertas entre ossos e corvos com uma última faísca de divindade.
Mundo após mundo, recuperas teu poder e sobes para derrubar o **Falso Anjo** que se senta no teu trono.

A identidade visual do herói conta a história: auréola rachada, uma única asa esfarrapada e manto real.

## Estrutura

3 mundos × 4 níveis. Os níveis 1–3 são arenas com 3 ondas de inimigos; o nível 4 é um chefe.

| Mundo | Tema | Inimigos | Chefe | Recompensa do chefe |
|---|---|---|---|---|
| 1 — O Ossuário | Profundezas góticas | Esqueleto, Arqueiro Ossudo, Zumbi, Corvo Amaldiçoado | **Rei Ossário** | Foice do Ossário |
| 2 — Os Átrios Dourados | Palácio celestial | Cavaleiro Alado, Ofanim (olho voador), Sentinela Dourada | **Serafim Guardião** | Manoplas do Serafim |
| 3 — O Trono Usurpado | Catedral corrompida | Anjo Corrompido, Olho do Vazio, Cavaleiro Profano + elites | **O Falso Anjo** | Final do jogo |

- **Progressão de campanha:** cada nível desbloqueia o seguinte. Ao morrer, você tenta de novo
  o mesmo nível sem perder a build, e preserva 50% dos fragmentos daquela tentativa.
- **Rejogar** níveis concluídos rende fragmentos (sem novo amuleto nem carta).

## Personagem

| Atributo | Base |
|---|---|
| Vida | 5 corações |
| Energia | 3 cargas (cada golpe acerta +0,25 carga) |
| Dano (espada) | 10 |
| Cura | Segurar F: canaliza 1,1 s, custa 1 carga, cura 1 |

Movimento: pulo com altura variável, *coyote time*, *jump buffer*, descer de plataforma (baixo + pulo).
Ataque em 3 direções (frente, cima e baixo no ar). O golpe para baixo faz **pogo** (quica no inimigo).

## Build: 4 slots

| Slot | Função |
|---|---|
| Arma | Espada (base), Lança (carta), Foice (chefe 1), Manoplas (chefe 2) |
| Amuleto vermelho | Vida e resistência |
| Amuleto azul | Habilidades especiais (teclas K / L) |
| Amuleto amarelo | Utilidades |

Os amuletos ficam numa **coleção**. Você equipa na tela de Build antes de cada nível, então
as cartas de slot extra criam combinações reais (por exemplo, Investida + Grito com 2 slots azuis).

### Amuletos

| Nível | Amuleto | Efeito |
|---|---|---|
| 1-1 | Coração Ossificado (V) | +2 vida |
| 1-2 | Pena da Asa Partida (A) | **Investida** invulnerável (sem custo, recarga 0,65 s) |
| 1-3 | Pena do Corvo (Am) | +15% velocidade de ataque |
| 2-1 | Cálice Dourado (V) | +1 vida, cura 35% mais rápido |
| 2-2 | Trombeta do Juízo (A) | **Grito Sônico**: empurra numa área grande, atordoa 2 s, destrói projéteis; custa 1 carga |
| 2-3 | Sandálias do Mensageiro (Am) | +15% movimento, +4 dano |
| 3-1 | Coração Usurpado (V) | Cura 50% mais rápido, regenera 1 vida a cada 30 s, −50% energia por golpe |
| 3-2 | Égide Celeste (A) | Com vida cheia, bloqueia projéteis; cada bloqueio consome 10% da barra de energia |
| 3-3 | Lâmina do Mártir (Am) | +10 dano, −1 vida, magias e cura custam +10% |

## Cartas

Ao concluir um nível pela primeira vez, o jogo oferece **3 cartas e você escolhe 1**.
O sorteio pondera a raridade: comum 60, rara 28, amaldiçoada 12.
**Rerrolar** custa fragmentos (15, depois +10 a cada vez) e **pular** dá +10 fragmentos.

| Carta | Raridade | Efeito |
|---|---|---|
| Relicário Carmesim / Celeste / Solar | Rara | +1 slot vermelho / azul / amarelo |
| Lança do Arauto | Comum | Troca a arma pela lança (lenta, alcance maior) |
| Lâmina Cruel | Comum | Sangramento: 2 de dano/s por 3 s |
| Marca da Fraqueza | Comum | Fraqueza por 1,5 s: +15% de dano recebido e 30% mais lento |
| Vigor Divino (×3) | Comum | +1 vida permanente |
| Cálice Extra (×2) | Comum | +1 carga de energia permanente |
| Graça Intangível | Rara | 20% de chance de anular um ataque |
| Gume Bento (×3) | Comum | +3 dano |
| Fervor (×2) | Comum | +30% energia por golpe |
| Juízo Certeiro | Rara | 15% crítico (dano ×2) |
| Asas Restauradas | Rara | Pulo duplo |
| Coroa de Espinhos | Comum | Ao ser atingido, causa 20 de dano ao redor |
| Ganância Dourada | Comum | +50% fragmentos |
| Sede Sagrada | Rara | A cada 12 abates, cura 1 |
| Passos Etéreos | Comum | +10% movimento, investida recarrega 30% mais rápido |
| Pacto Profano | Amaldiçoada | +35% dano, −1 vida |
| Último Suspiro | Amaldiçoada | +80% dano com 1 de vida |
| Zelo Cego | Amaldiçoada | +25% velocidade de ataque, −25% energia por golpe |

## Chefes

**Rei Ossário (650 PV):** leque de ossos (quebráveis com a arma), espinhos que brotam do chão
(com aviso), invocação de esqueletos e investida aérea seguida de pouso **vulnerável**.
Fase 2 (50%): invoca corvos, adiciona chuva de ossos e fica mais rápido.

**Serafim Guardião (900 PV):** desce e corta o chão (ondas para pular), chuva de lanças com
linhas de aviso, mergulho em linha reta seguido de pausa vulnerável, leque de penas.
Fase 2 (50%): cinco orbes orbitam o chefe e os ataques dobram.

**O Falso Anjo (1400 PV):** pilares de luz, anel de orbes, teletransporte com corte rasante e
invocação de olhos. Fase 2 (65%): a máscara quebra e entram meteoros, laser horizontal e anéis duplos.
Fase final (30%): espiral de orbes, trilha "Desespero" e arena escurecida.

## Mudanças em relação ao conceito original (e por quê)

1. **Dano base 10.** Com essa escala, "+4", "+10" e "−5%" fazem diferença perceptível.
2. **Fraqueza** passou a ser *+15% de dano recebido e lentidão*. A vida do herói é contada em
   corações inteiros, então "−5% do dano inimigo" não teria efeito visível.
3. **Sangramento** passou a ser 2 de dano/s por 3 s, na escala nova de dano.
4. **Égide Celeste:** o custo de 10% é **por projétil bloqueado**, não um dreno contínuo.
5. **Lâmina do Mártir:** o "+10% de consumo de energia vital" vale para cura e magias.
6. **Amuletos colecionáveis + tela de Build:** dão sentido às cartas de slot extra.
7. **Chefes dão armas** (Foice e Manoplas): o slot de Arma não depende só da carta da lança.
8. **Fragmentos de Graça** (moeda) para rerrolar cartas.
