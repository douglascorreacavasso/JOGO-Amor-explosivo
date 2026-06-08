# C — PERSONAGENS (jogador, tristes, monstros, corações-NPC)

> Onde está no código: banner `// ===== [PERSONAGENS] ...` e as funções `mkSad / mkHappy / mkMonster / spawnHeart / heartKind` + os `drawNPC / drawMonster / drawPlayer`.

## Jogador
Criado em `buildLevel` (objeto `player`). Anda, pula (duplo/triplo conforme o nível), carrega a explosão de amor (segura ❤ e solta) e ganha agilidade/pulo conforme apaixona gente. Recebe um **bônus permanente** de início que cresce com o recorde (`deepest`).

## Tristes (NPC azul) — `mkSad` / `sadDeform`
São o objetivo das fases de amor: apaixonar **todos**. Vão ficando **deformados** com a profundidade (quadrado, alto, largo, gigante, 5 membros, derretendo, multi-olhos, girado; gêmeo grudado raro) e com **movimento bugado** (rápidos, teletransporte curto). Continuam sempre em superfícies **alcançáveis**.

> **Novidade:** o triste no chão agora é **atraído pelo coração no chão mais próximo** (até ~200px). Isso faz a dica da "barra verde" ser real — explodir um bloco/inimigo solta corações no chão e os tristes se **agrupam** ali, ficando fáceis de apaixonar em grupo.

## Monstros — `mkMonster`
Entram só do nível 6+ e ficam maiores/mais resistentes com a profundidade. Tipos e quando aparecem (no `genLevel` procedural): `chaser` (perseguidor, desde o 1º gerado), `shooter` (atirador), `dog` (cão que morde e tira agilidade), `eater` (comedor, come os tristes e cresce), `sphere` (esfera chorona que prende), `spiker` (espinhos), `beamer` (feixe vertical), `tentacle` (tentáculos) e `boss` (chefe gigante a cada 20 níveis). São desenhados como **criaturas aberrantes** (corpo blob/caixa/estrela/gota, 1–5 olhos, espinhos, derretendo) com seed estável. Habilidades deles: ver doc D.

## Corações-NPC da coleta — `spawnHeart` / `heartKind`
Nas fases de coleta, os corações estão **soltos pela fase e fogem** de você. A grande mudança pedida pelo Doug:

### Variedade que CRESCE a cada coleta
- A **1ª coleta** (nível 2) tem **só 1 estranho** (forçado) e o resto **normal**.
- Cada nova fase de coleta libera mais tipos e mais chance de estranhos (`heartKind` usa `cfg.collectIndex`: chance `=(ci-1)·10%` e o leque de tipos cresce com `ci`).

### Personalidades FIXAS (item + cor + forma) — `HEART_PERSONA`
Cada tipo especial tem visual **reconhecível** e atividade própria:

| Tipo | Item | Cor | Forma | Atividade (ver doc D) |
|------|------|-----|-------|------------------------|
| fast | óculos escuros | amarelo | coração | foge rápido |
| ghost | — (translúcido) | azul claro | fantasma | atravessa plataformas |
| tough | boné/capacete | cinza | coração | precisa 2 toques |
| crybaby | — (lágrimas) | azul | coração | rápido e errático |
| solid | gravata-borboleta | cinza-azul | losango | empurra ao pegar |
| snake | cartola | verde | coração | persegue e ROUBA o que carrega |
| splitter | coroa | laranja | gema | ao tocar vira 2 metades |
| eater | cachecol | roxo | blob | come os vizinhos e cresce (vale 2) |

Os **normais** continuam vindo vestidos com roupas aleatórias (cartola, óculos, gravata, cachecol, boné, coroa) e tamanhos/deformações variados — pra fase ficar viva — mas os especiais **se destacam** pelo item/cor/forma fixos.

## Garantia
Todos (tristes, monstros, corações) são posicionados em superfícies **alcançáveis** (validado pelo robô de alcance), então a fase é **sempre vencível**.
