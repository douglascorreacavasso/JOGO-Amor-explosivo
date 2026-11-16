# 10 — Ideias de outros jogos e a lista de 80 do Douglas (16/11/2026)

Análise e implementação feitas pelo Claude, a pedido do Douglas. Nenhum jogo foi copiado: de cada um saiu só a **mecânica**, adaptada ao amor e aos corações.

## 1. O que cada estilo de jogo ensina, e como entrou no Amor Explosivo

| Jogo / estilo | O que ensina | Como ficou aqui |
|---|---|---|
| Pac-Man (fantasmas com personalidade) | Cada perseguidor tem um jeito, e a dificuldade vem da **combinação** de jeitos | 6 personalidades de apaixonado com símbolo em cima da cabeça: 😍 🥺 😳 😠 🤪 🧐 |
| Celeste / Super Meat Boy | Movimento preciso: coiote, pulo guardado, pulo variável, dash, blocos que quebram | Dash de amor (nível 8), pontes que quebram, pulo variável (já existia) |
| Mario Wonder | Regras do mundo mudam na hora (efeitos "maravilha") | 14 regras estranhas por sala, incluindo agora o "mundo acelerado" |
| Bomberman | Explosões que mudam o cenário e reações em cadeia | Explosões deixam a plataforma rosa até ela virar coração e cair (3 explosões); a explosão quebra espinhos |
| Portal | Teleporte que o próprio jogador tem de usar com cuidado | Portinha viva em dupla que te engole no pulo |
| Vampire Survivors / Hades | Poderes que vão aparecendo e se combinam | 12 poderes por nível, cada um com cartão de aviso |
| Plataforma clássica (gangorra, plataformas em onda) | Plataformas com física e movimento em grupo | Prego que gira 90° e volta; grupos em onda, em balanço ou "respirando" |
| Jogos com IA adaptativa (Left 4 Dead, inimigos que aprendem) | O jogo se adapta a quem joga | IA própria: monstros escolhem estratégias por tentativa e erro e o jogo aprende seus hábitos |

## 2. A lista de 80 ideias: o que já existe, o que entrou agora, o que fica para depois

**Já existiam antes desta rodada:**
- 6 estrategista (🧐 calculista);
- 11 gelo (chão de sabão);
- 12 esteiras;
- 18 plataformas giratórias (agora melhoradas);
- 19 teletransportadores (portinhas);
- 36 atirador;
- 41 barreira;
- 48 escudo / coração de proteção;
- 51 chuva de corações;
- 55 escuridão (névoa);
- 61 resgate sem explodir ninguém (selo "ninguém explodiu" no fim da fase).

**Entraram agora:**

| Nº | Ideia | Como ficou |
|---|---|---|
| 1, 5 | Apaixonado veloz / saltador | 🤪 impulsivo: zigue-zague e pulinhos |
| 2 | Tímido | 😳 só vem quando você olha pra ele |
| 3 | Ciumento | 😠 acelera se outro apaixonado está mais perto de você (brilho vermelho de aviso) |
| 6 | Estrategista | 🧐 mira onde você vai estar |
| — | Carente (seção 5 da lista) | 🥺 acelera quando fica longe |
| 10 | Gigante | Apaixonados que incham 2x (rodada anterior) |
| 14 | Pontes quebradiças | Ponte que quebra (nível 8+): meio segundo em cima e ela cai; volta em 4 s |
| 18 | Plataformas giratórias | Prego: gira 90° se pisar na beirada e volta sozinho, em todas as fases |
| 21 | Explosão em cadeia / cenário que muda | 3 explosões viram a plataforma em coração, que cai em corações (atrai os tristes) |
| 24 | Coração dourado | Pegou: a próxima explosão fica 50% maior e acalma os apaixonados por perto |
| 33 | Gerador de tristeza | 🌧️ Tristonho (nível 14+): anel de aviso, depois deixa apaixonados tristes de novo |
| 34 | Camaleão | 🦎 Camaleão (nível 18+): quase invisível, aparece de vez em quando |
| 39 | Divisor | 🧫 Divisor (nível 22+): com metade da vida, vira dois |
| 40 | Teletransportador | 🌀 Pisca-pisca (nível 26+): círculo roxo avisa onde ele vai surgir |
| 42 | Dash de amor | 💨 SHIFT no PC, botão » no celular (nível 8) |
| 56 | Mundo acelerado | Regra "⏩ mundo acelerado" (nível 21+) |
| 59 | Chão em ritmo | Plataformas em grupo: onda, balanço junto, abre e fecha |

**Pedidos do Douglas fora da lista, também feitos:**
- plataforma onde os monstros pisam muito escurece e cria espinhos (cair mata; a explosão quebra);
- IA que aprende.

**Ficam para as próximas rodadas** (precisam de fase desenhada à mão ou mexem muito na física):
- espelhos e raio refletido (20, 66);
- placas de pressão e portas com estado (13, 17, 64);
- gravidade invertida (53);
- mundo espelhado (54);
- labirinto vivo (58);
- regras móveis estilo Baba Is You (70);
- os chefões temáticos (71 a 80);
- modo "Amor Infinito" com ondas e melhorias (Vampire Survivors);
- ventiladores (16);
- corações com física de rolar ou quicar (22, 23, 26);
- monstro espelho e monstro escudo (32, 35);
- sombra do jogador (77).

## 3. Aprendizado de máquina do próprio jogo

O Douglas disse que o jogo não precisa seguir o formato do Nerael. O grafo GEP continua só como exportação opcional. O jogo agora tem o próprio aprendizado, salvo no aparelho (`amorExplosivo_ia_v1`):

- **Estratégias dos monstros:** os monstros escolhem uma estratégia por tentativa e erro. A técnica é um "bandido multi-braço" ε-guloso.
  - As estratégias são: **direto**, **cercar** (vem pelo outro lado de outro monstro), **emboscar** (espera você pular e vai onde você cai) e **cautela** (fica fora do alcance da sua explosão até a sua energia acabar).
  - Uma estratégia que te machuca ganha valor; uma que leva o monstro a morrer perde. Com o tempo eles passam a usar mais o que funciona contra **você**.
- **Seus hábitos:** o jogo aprende se você pula quando um monstro chega e de que distância você costuma explodir. A emboscada e a cautela usam esses números.
- **Nível de IA:** sobe com o tempo de jogo, até 6.
  - A partir do nível 1, os tristes começam a fugir quando você carrega a explosão.
  - A partir do nível 2, eles pulam entre plataformas ("os paradinhos começam a se mexer").
  - Acima de 3, os monstros ficam 8% mais rápidos.
- **Onde ver:** a pausa mostra o nível da IA e a estratégia que mais funciona contra você.
