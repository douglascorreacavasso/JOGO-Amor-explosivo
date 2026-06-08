# A — MOTORES (geração, distorção, diretor, física, plataformas)

> Onde está no código: banner `// ===== [MOTORES] ...` e funções abaixo, todas dentro do IIFE de `game.js`.

## Como nasce um nível
`genLevel(n)` devolve o "DNA" da fase:
- **Níveis 1–5:** copia a tabela `HAND` (ver doc B).
- **Nível 6+:** monta tudo de forma procedural a partir da profundidade `d = n-5`, sempre **determinístico** pela semente da run (`runSeed` + `seedFor(n)`), então a mesma semente + mesmo nível = mesmo mundo (o "Continuar" volta idêntico).

`buildLevel(n)` é quem realmente constrói: define o tamanho da fase, gera as plataformas, a espinha, as barras móveis, as estruturas Backrooms, valida o alcance e popula personagens.

## Tamanho da fase (em "telas") — `areaForLevel(n)`
Resolve a **área enorme vazia** que sobrava no PC: o mundo agora é medido em telas.
| Nível | Largura × Altura |
|------|------------------|
| 1 | 1 × 3 |
| 2 (1ª coleta) | 1 × 3 |
| 3 | 1 × 4 |
| 4 | 1 × 4 |
| 5 | 2 × 4 |
| 6–49 | 2 × 4 |
| 50–124 | 2 × 5 |
| 125+ | 2 × 6 |

`WORLD_W = wx × W` e `WORLD_H = hx × H`, onde `W,H` é a janela do mundo (1 tela). Como `WORLD_W ≥ 1 tela`, **não sobra espaço vazio** lateral.

## Diretor (mini-AI) — `director(n)`
Escolhe **tema/cor** (lista `DIR_THEMES`) e sorteia **mutadores de regra**: gravidade leve/pesada, vazio/lotado, buracos, tremor (`jitter`), warp (variação de tamanho) e névoa. A "distorção" cresce com a profundidade. As tags aparecem no rótulo do nível.

## Física viva
Variáveis distorcíveis por nível: `phGrav, phMove, phFric, phBandH, phSlot, phBaseJump`. O alcance do pulo `JUMP_Hc = baseJump²/(2·grav)` é recalculado a cada fase e usado em TODA decisão de "dá pra alcançar".

## Plataformas (e por que NÃO fica lento)
1. **Densidade limitada (anti-lentidão):** teto de **32 faixas** por fase, com `phBandH` recalculado mas **sempre ≤ 0.82 × alcance do pulo** (continua vencível). Barras por faixa: 3 a 9 (menos e mais largas).
2. **Escada-espinha** (`spine:true`): uma barra por faixa, em zigue-zague **curto o bastante pra sempre conectar** com a faixa de baixo. É a garantia do **"sempre vencível"** — caminho do chão ao topo, não importa a distorção.
3. **Grade aleatória** + `addStructures()` (motivos Backrooms que evoluem a cada nível) adicionam variedade por cima.
4. **Barras móveis** (ver "movimento") e **esteira** são extras.

### Validação automática — `computeReachable()`
Marca quais barras dão pra alcançar a partir do chão, pulo a pulo. Foi **otimizada**: indexa por faixa de altura e só compara barras próximas (antes era todas × todas). O `dev.html` e o `_test.js` usam isso pra varrer 1–200 e provar que **0 fases** têm topo inalcançável.

## Movimento das barras — `updatePlatforms()`
Cada barra com `mv` pode ser:
- `pingX` lateral, `pingY` sobe/desce, `diag` diagonal (todas oscilam em torno da posição-base reachável → continua vencível);
- `wrapX` **esteira**: desliza e reaparece do outro lado (faixa inteira; é bônus, adicionada DEPOIS da validação, então nunca é obrigatória);
- `pulse`: de vez em quando **ACELERA** (boost) e depois volta.

`updatePlatforms()` também (re)monta um **índice de barras por faixa** (`platBuckets`) — é o que deixa a colisão rápida (cada personagem só checa as barras perto dele). Quem está em cima de uma barra móvel é carregado por `ride()` (lateral **e** vertical).

## Câmera / desempenho
`ZOOM` afasta a câmera (0.66 no celular, 0.80 no PC). O `draw()` só desenha o que está visível (corte por câmera). Partículas têm teto (220). Resultado medido: `update()` ~0.15–0.43 ms/frame **constante** da fase 1 à 200 (orçamento de 60 fps = 16,6 ms).
