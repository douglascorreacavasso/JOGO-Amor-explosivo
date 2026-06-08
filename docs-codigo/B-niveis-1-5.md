# B — NÍVEIS 1 a 5 (as fases feitas à mão)

> Onde está no código: banner `// ===== [NÍVEIS 1–5] ...`, tabela `HAND` e o ramo `if(n<=5)` de `genLevel`.

As 5 primeiras fases são uma **tabela fixa** (`HAND`), pra começar fácil e ensinar. Do nível 6 em diante o motor procedural assume (doc A).

## Tabela `HAND`
Cada linha é o DNA de uma fase à mão:

| Nível | Tipo | Objetivo | Móveis | Blocos | Observação |
|------|------|----------|--------|--------|-----------|
| 1 | love | apaixonar 10 tristes | 0 | 3 | tutorial do amor |
| 2 | **collect** | pegar **10** corações | 2 | 0 | **1ª coleta** (só 1 estranho, resto normal) |
| 3 | love | apaixonar 14 | 4 | 4 | entra mais barra móvel |
| 4 | love | apaixonar 18 | 7 | 5 | — |
| 5 | love | apaixonar 22 | 11 | 6 | última à mão; já com pulo triplo |

> A coleta foi **baixada de 100 → 10** corações (pedido do Doug). O rótulo da fase mostra o alvo real lendo `b.target`.

## O que o motor "à mão" liga em cada uma
No ramo `n<=5` o `genLevel` define física base (gravidade/pulo normais), `maxJumps` (1 no nível 1, 2 a partir do 3, 3 no 5), HP=3, custo da explosão decrescente, e **zero monstros** (eles só entram no procedural, do 6+). O campo `collectIndex` marca o nível 2 como **coleta #1** (pra controlar a variedade — ver doc C, corações-NPC).

## Tamanho dessas fases
Vem de `areaForLevel` (doc A): 1×3, 1×3, 1×4, 1×4, 2×4. Pequenas e contidas de propósito — boas pra aprender e leves no celular.

## Briefing (explicação grande antes de jogar)
Como o primo do Doug apertava e nem sabia o que fazer, agora **toda fase nova abre um briefing em PARTES, em letras grandes**, que **trava até a pessoa entender** (`showBriefing` / `briefingCards`). A 1ª fase de amor mostra o texto completo:
1. PRIMEIRO: EXPLODA SEU AMOR PERTO DELES 💥
2. DOIS: CORRRRAA! — SE TE PEGAREM JÁ ERA! 😱
3. TEM QUE FAZER O MESMO COM TODOS!! 💞
4. PODE FAZER ELES PARAREM (explodindo de amor de novo) 🌀
5. OU EXPLODA UMA BARRA VERDE 🟩 (solta corações no chão e ATRAI os tristes)
6. BOA SORTE !!!! 🍀

A 1ª coleta (nível 2) mostra o briefing próprio de coleta. Em retry/Infinito repetido **não repete** o briefing (não enche o saco). Reseta a cada jogo novo.
