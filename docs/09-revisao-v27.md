# 09 — Revisão geral v27 (15/11/2026)

Pedido do Douglas: analisar a dinâmica, as instruções e as falas; achar e corrigir os bugs; deixar o desenho leve e liso até em aparelho fraco; movimento perfeito para frente e para trás; poderes que vão aparecendo ao avançar; fases cada vez mais bizarras e abstratas (estilo Backrooms); visual novo no tema de amor e corações; ~200 mil testes automáticos; teste como usuário real.

**Quem fez:** todo o trabalho desta revisão (detecção e correção) foi feito pelo **Claude**. Na coluna "Como foi achado": *leitura* = lendo o código linha a linha; *robô* = teste automático de estresse; *print* = olhando a tela do jogo rodando no navegador (PC e celular emulado); *medição* = bancada de desempenho.

Backup do jogo antes de qualquer mudança: `E:\BACKUP_JOGO_AMOR_EXPLOSIVO\15NOV_antes_claude`.

---

## 1. Física e movimento

| # | Problema | Como foi achado | Correção |
|---|---|---|---|
| 1 | A física andava **por quadro**: a 30 fps (aparelho fraco) o jogo ficava em câmera lenta; em tela de 120/144 Hz ficava 2× mais rápido. | leitura | Laço em **passo fixo de 60 Hz** com acumulador + desenho interpolado (câmera e jogador). Mesma velocidade em qualquer aparelho. |
| 2 | Sem velocidade máxima de queda e colisão com janela de 28 px: caindo de alto, o boneco **atravessava plataformas**. | leitura | Queda limitada a 18 px/passo e pouso por varredura (pega a plataforma mais alta cruzada no passo). |
| 3 | O "pulo guardado" não era limpo depois de um pulo no ar → ao pousar, **pulava sozinho**. | leitura | Limpa o pulo guardado após pulo no ar. |
| 4 | Com "pulo simples", sair da borda sem pular dava um **pulo extra no ar**. | leitura | Saiu da borda e o tempo de coiote acabou = o pulo do chão conta como usado. |
| 5 | Virar de lado patinava (sem freio na virada) e a câmera ficava centrada: andar para trás parecia "travado". | leitura | Virada com freio 2,6× mais forte, atrito no chão, controle reduzido no ar, e **câmera que olha para onde você anda** (vira junto, suave). |
| 6 | Suavização da câmera por quadro (mudava com o FPS). | leitura | Suavização exponencial por tempo. |
| 7 | Não havia pulo variável (todo toque = pulo inteiro). | leitura | Soltar cedo = pulo menor (mínimo de 66% da força, sempre alcança a faixa de cima). No celular, segurar o joystick pra cima = pulo alto. |

## 2. Controles e telas

| # | Problema | Como foi achado | Correção |
|---|---|---|---|
| 8 | Trocar de aba / perder o foco deixava teclas **presas** (o boneco seguia correndo). | leitura | Solta tudo e **pausa** sozinho ao perder o foco ou esconder a aba. |
| 9 | Segurar ↓ repetia e **gastava energia** em várias barreiras; R/E/Q/F repetiam. | leitura | Repetição do teclado ignorada nas ações. |
| 10 | **R no menu** começava a partida sem escolher modo; R na tela de fim com 0 vidas deixava **vidas negativas**. | leitura | R só funciona durante o jogo; `die()` e `levelClear()` não rodam duas vezes. |
| 11 | Não existia pausa. | leitura | `P`/`Esc` e botão ❚❚ (celular e PC): continuar, reiniciar fase, menu. |
| 12 | Enter/Espaço não confirmavam os botões das telas. | leitura | Enter/Espaço apertam o botão principal de cada tela. |

## 3. Lógica das fases

| # | Problema | Como foi achado | Correção |
|---|---|---|---|
| 13 | Na coleta, o fim de fase usava `setTimeout`: se reiniciasse nesse 1,3 s, **pulava de nível sozinho**. | leitura | Atrasos "morrem" ao trocar de fase (`later()` com ficha da fase). |
| 14 | A fase dependia do **tamanho da tela**: a mesma semente gerava outra fase no celular, no PC e ao girar o celular (o "Continuar" não reproduzia o mesmo mundo). | leitura | Fase em **unidades fixas do mundo**; a câmera é que se adapta à tela. Robô confirmou em vários tamanhos. |
| 15 | Monstros eram empurrados para x ≥ 760 **depois** de escolher a plataforma → nasciam no ar, fora dela. | leitura | Escolhe só plataformas longe do começo e posiciona em cima delas. |
| 16 | Tristes largos/gigantes nasciam **metade fora do mundo** (~3,5% das fases). | robô | Posição limitada pela largura real do triste. |
| 17 | Barras comuns **sobrepostas** à escada principal (duas barras uma em cima da outra). | print | Barras que encostam na escada saem (a escada já garante o caminho). |
| 18 | Plataformas "tortas" só no desenho (até ±10°) com colisão reta: o boneco parecia **flutuar**. | leitura | Inclinação reduzida a ±3,4°, calculada uma vez. |
| 19 | "Cantinho em L" aparecia também nas fases feitas à mão (1–5). | print | Só da fase 6 em diante. |
| 20 | Esferas choronas voavam pela fase toda e **prendiam o jogador logo no começo** (nível 52). | print | Monstros longe da tela "dormem" até você chegar (como em todo jogo de rolagem lateral). |
| 21 | Atirador, feixe e espinhos atacavam de **qualquer distância**. | leitura | Só atacam quando você está por perto. |
| 22 | Laços que removiam itens durante a varredura **pulavam o vizinho** (onda, disparo, explosão, congelados) e um monstro podia ser derrotado 2×. | leitura | Varreduras de trás pra frente / em cópia; derrota só uma vez. |
| 23 | Coração da coleta parado em plataforma móvel ficava no ar e caía. | leitura | Acompanha a plataforma. |
| 24 | Coração fantasma podia subir para fora do mundo; esfera podia afundar no chão. | leitura | Limites de altura. |
| 25 | Sem teto de corações no chão. | leitura | Máximo de 40. |
| 26 | Amor Divino não limpava os corações negros no ar. | leitura | Limpa. |

## 4. Falas e instruções (furos de lógica)

| # | Fala antiga | Problema | Como foi achado | Nova |
|---|---|---|---|---|
| 27 | "Segure ❤ e solte" | No PC a tecla é **ESPAÇO**. | leitura | Mostra a tecla do PC ou o botão do celular, conforme o aparelho. |
| 28 | Barra "CANSAÇO" | Cheia = descansado: o nome era o **contrário** do que mostrava. O tutorial dizia "a barra de baixo é a energia da explosão". | leitura | Barras **AMOR** (força da explosão enquanto segura) e **ENERGIA** (paga explosão e poderes). |
| 29 | "💔 VOCÊ CAIU" | Não existe queda: aparecia quando o **HP acabava**. | leitura | "Seu coração partiu". |
| 30 | Chefe: "A explosão destrói os corações negros dele" | O chefe **não atira** corações, e a explosão **não destruía** nenhum projétil. | leitura | Texto do chefe reescrito (plataformas fantasmas + gosma) e a explosão agora destrói os corações negros dos atiradores. |
| 31 | — | Poderes surgiam **sem aviso** (disparo no 8, Amor Divino no 10 nunca explicado). | leitura | Cartão "NOVO PODER" com o que faz e como usar, na fase em que aparece. Tabela no README. |
| 32 | "estrela, **caveira**, fantasma, gema…" | Não existe disfarce de caveira. | leitura | Lista só os disfarces reais. |
| 33 | "Pedra 🪨", "Máquina", "máquina do amor" | Três nomes para a mesma coisa. | leitura | **Máquina do Amor** em todo lugar. |
| 34 | "Explode uma BARRA VERDE: ATRAI os tristes" | É um bloco **verde-água**, cai **3 s** depois, e quem pega os corações são os **apaixonados** (param de seguir). | leitura | Cartão explica exatamente isso. |
| 35 | "Pode fazer eles pararem" | Não dizia que o apaixonado **explode em 3 s** e vira corações. | leitura | "Exploda de novo perto dele: ele congela 3 s e vira corações no chão". |
| 36 | "INFINITO · continua" | Não dizia que **qualquer toque reinicia** a fase. | leitura | Cartão do modo explica. |
| 37 | — | Monstros novos sem explicação (cão, esfera, feixe, espinhos…). | leitura | Cartão "MONSTRO NOVO" com como desviar/vencer (vários de uma vez = um cartão só). |
| 38 | Etiquetas "névoa", "buracos"… | Só etiqueta, sem explicar a regra. | leitura | Cartão "REGRA NOVA DA SALA" na primeira vez. |
| 39 | "nasceram corações felizes" | Nada nascia. | leitura | Agora nascem corações da Máquina. |
| 40 | Celular: "Botão ❤" | O botão virou um coração com 💥. | print | Texto atualizado. |

## 5. Desempenho (aparelho fraco)

| # | Problema | Como foi achado | Correção |
|---|---|---|---|
| 41 | `shadowBlur` em tempo real em ~15 tipos de desenho (o mais caro do canvas). | leitura | Sprites **assados uma vez** com o brilho dentro; desenho por `drawImage`. |
| 42 | Gradiente do céu e do chão recriados todo quadro; estrelas uma a uma. | leitura | Fundo da sala pronto num canvas (1 desenho por quadro); gradiente do chão guardado. |
| 43 | Cada partícula desenhava um coração por curvas. | leitura + medição | Sprite guardado na própria partícula. |
| 44 | Setas da borda desenhavam emoji como texto todo quadro. | leitura | Bolhas prontas; no máximo 12 setas (as mais perto). |
| 45 | Barras do HUD mudavam `width` todo quadro (recalcula o layout da página). | leitura | `transform: scaleX` só quando o valor muda. |
| 46 | Menu e briefing redesenhavam o jogo 60×/s atrás da tela. | leitura | Desenha só quando muda (economiza bateria). |
| 47 | Todos os tristes e monstros calculados todo passo, mesmo do outro lado da fase. | medição | Longe da tela "dormem"; parado em cima de barra fixa não procura plataforma de novo. |
| 48 | Até dezenas de bipes por explosão. | medição | No máximo 3 bipes por quadro. |
| 49 | Sem defesa para aparelho lento. | — | **Qualidade automática**: se engasgar, baixa resolução, partículas e efeitos; se sobrar, sobe de novo. |

## 6. Novidades de jogo

- **Poderes progressivos**: 1 explosão · 2 pulo duplo · 3 barreira · 5 pulo triplo · 7 disparo · 10 Amor Divino · 12 onda · 15 escudo · 18 laser · 22 chuva · 26 coração de proteção · 30 amor elétrico. A tela de fim de fase avisa o que vem no próximo nível.
- **Salas estranhas em 4 camadas**: (0) Sala Amarela, Escritório Vazio, Piscina Infinita, Corredor de Hotel, Garagem Escura · (1) Escada sem Fim, Sala que Respira, Biblioteca de Livros em Branco, Lavanderia das Meias Perdidas, Jardim de Plástico · (2) Grade do Esquecimento, Parede que Olha, Céu de Cabeça pra Baixo, Sala de Espelhos · (3) O Vazio em Forma de Coração, Estática, Geometria que Sente, O Fim do Mapa. Às vezes o diretor "lembra" de uma sala mais antiga.
- **13 regras estranhas** que se somam com a profundidade: gravidade leve/pesada, vazio, névoa, luz piscando, chão de sabão, eco, plataformas que piscam (a escada principal nunca some), buracos, mundo dá a volta, sala respira, câmera torta, cores invertidas. Cada uma é explicada na primeira vez.
- **Rolagem lateral**: fases de 3.000 a 9.000 de largura, com câmera que antecipa a direção.

### Referências de mecânica (sem copiar nenhum jogo)
Técnicas de "game feel" comuns em jogos de plataforma 2D: tempo de coiote, pulo guardado, pulo variável, câmera com antecipação e inimigos que só acordam perto da tela. Para desempenho no canvas: evitar `shadowBlur` e pré-desenhar em canvas fora da tela (guia de otimização de canvas da MDN).

## 7. Aprendizado em grafo (contrato GEP V1) — 15/11/2026, noite

Regra do Douglas: todo programa tem por baixo um aprendizado em grafo no formato do cérebro do Nerael, alimentado pelo uso, para depois encaixar no cérebro como uma peça pronta.

- `grafo_experiencia.js` (infraestrutura escrita pelo Claude) só **observa** o jogo. Se faltar ou der erro, o jogo segue igual. Ele registra:
  - **nós:** fase, sala, regra, monstro, poder, causa de apaixonar, fonte de dano, tipo de coração, força da explosão e acontecimentos;
  - **arestas:** `causa`, `antes_de` e `coativacao`, com peso, usos, sucessos e falhas;
  - **variáveis:** segundos para vencer ou perder, força, acertos;
  - **episódios:** cada tentativa de fase, com nota (vitória 1, tempo esgotado 0,4, derrota 0).
- **Nada se apaga:** o que não é usado só enfraquece.
- **Primeiro uso do que aprendeu:** a tela de derrota mostra o que mais te machucou até hoje.
- **Pausa → EXPORTAR EXPERIÊNCIA:** baixa um JSON só com o que é novo desde a última exportação.
- **`node _grafo_robo.js [partidas] [saida.json]`:** o jogo treina sozinho (origem `simulacao_propria`).
- **`python gep_amor_explosivo.py <arquivo.json>`:** grava com o `gep.py` oficial em `E:\NERAEL_GEP\amor_explosivo.gep.sqlite` e roda o validador. O mesmo arquivo importado duas vezes não conta em dobro.
- **Primeira carga:** 300 partidas do robô, que deram 213 nós, 5.910 arestas, 62 variáveis e 436 episódios, e passaram no validador. Sobraram 7 avisos de "nó ligado a ele mesmo", da primeira carga. A causa já foi corrigida e eles não se repetem; ficam no arquivo porque nada se apaga.

## 8. Ideias do Douglas — 16/11/2026, madrugada

Tudo detectado, escrito e testado pelo Claude, a pedido do Douglas.

| Ideia | Como ficou |
|---|---|
| Aviso quando todos já estão apaixonados | Aparece "💞 Todos apaixonados! Agora falta derrotar N monstros 👹" na tela, e o placar mostra "falta derrotar". |
| Explodir de amor é ruim | O cartão do briefing virou "AMOR DEMAIS EXPLODE". Quem explode vira pedaços cinzas, a tela escurece, você perde 20 de energia e aparece um aviso. O contador 💔 fica no placar e no fim da fase ("o ideal é ninguém"). O apaixonado congelado mostra "💔 3, 2, 1". |
| Apaixonados que incham | Cerca de 16% dos apaixonados ficam 2x maiores (aleatório), com aviso na primeira vez. |
| Plataforma com prego no meio | Pisar no meio (30% do centro) não pesa. Pisar na ponta faz ela inclinar, girar e derrubar, e depois ela volta. A escada principal nunca tem prego. Aparece a partir do nível 4. |
| Portas do nada | Vêm em pares, bem longe uma da outra, em plataformas retas. Aparecem do nada quando você chega perto; se você pula perto, a porta se abre na sua frente e te engole no meio do pulo. Você sai pela porta-irmã e as duas somem. A partir do nível 9, em 45% das fases, com 1 a 3 pares. |
| Monstro arquiteto | A partir do nível 17. Mantém distância e empurra para longe a plataforma para onde você está indo (ela treme antes e uma linha azul liga o monstro à plataforma). Nunca mexe na escada principal nem em plataforma com porta. |
| Monstros mais espertos | Perseguidores miram onde você vai estar. Os atiradores também: os corações negros vão para onde você vai, não para onde você está. Perseguidor, cão, comilão e arquiteto fogem quando você carrega uma explosão forte por perto. |
| Fases mais fofas | Paleta "pastel" do CIS (`paleta_area.py`). Plataformas com glacê de babadinhos, florzinhas, chão rendado, escada principal com coraçãozinho, olhos com brilho e anteninha de coração no jogador, bochechas nos apaixonados. |
| CIS para conferir o design | O OCR do CIS (`analisador.ocr`) leu 100% das palavras dos avisos e telas nos prints (`legibilidade_cis.json`). |

Testes, todos fora do jogo, em script do Claude:
- 13 testes das mecânicas novas passaram.
- 20.000 fases geradas, com portas sempre dentro do mundo, prego só onde pode e topo sempre alcançável.
- 3.000 partidas com robô, sem erro e sem NaN.
- Os robôs antigos também passaram.

Os dois erros que esses testes acharam foram corrigidos:
- **Prego:** quem escorregava até a borda ficava "flutuando" sem pesar na plataforma.
- **Porta:** ela chegava atrasada e não engolia o jogador no pulo.

Os eventos novos também entram no grafo GEP: pessoa explodiu, inchou, porta, prego girou, arquiteto moveu plataforma e faltam monstros.

## 9. Celular com dois dedos (16/11, manhã)

- **Esquerda:** o dedo da metade esquerda da tela é o joystick. Ele anda ← → e, puxado para baixo, faz a barreira.
- **Direita:** o dedo da metade direita pula com um toque (segurar dá um pulo mais alto). Tocar de novo no ar faz o pulo duplo ou triplo.
- **Botões:** ★ e ✨ funcionam com um toque simples, junto com os dois dedos. 💥 é segurar e soltar, como antes. Dá para usar no meio do pulo.
- **Botão de explosão:** ficou menor (66×60 em vez de 96×88), mais claro e um pouco transparente. Os botões ★ e ⇄ também ficaram menores.
- **Dica na tela:** nas fases 1 e 2, nos primeiros segundos, aparece uma dica com fundo escuro mostrando cada lado.
- **Teste:** feito com toque real no celular emulado (Edge, `Input.dispatchTouchEvent`):
  - andar, pular com o outro dedo enquanto anda, pulo duplo, poder no meio do pulo e botão discreto passaram;
  - não houve erro de JavaScript.

## 10. Rodada 3 (16/11, tarde) — detalhes do Douglas e ideias de outros jogos

Ver também `docs/10-ideias-e-referencias.md`.

**Mecânicas novas e ajustes**
- **Prego v2.** Em todas as fases (1 ou 2, um pouco mais nas fundas). Pisar no meio não pesa. Pisar na beirada faz a plataforma inclinar, girar até uns 90° (te derruba), segurar ~1 s e voltar sozinha para o lugar.
- **Portinha viva v2.**
  - É uma portinha de 40×62 com olhos que te seguem, e vira uma boquinha com dentes quando caça.
  - Aparece em cerca de 55% das fases a partir do nível 2, em dupla, longe uma da outra.
  - Pulou a ~4 corpos dela, ela pula em você e se força a passar por você. Você sai pela outra e as duas somem.
  - O fundo "Corredor de Hotel" não tem mais portas: agora é papel listrado com rodapé.
- **Espinhos dos monstros.** Onde os monstros pisam por ~7 s, a plataforma escurece e nascem espinhos. Cair neles mata; o escudo protege e te joga para cima. A explosão quebra.
- **Coração de tanto amor.** Cada explosão deixa a plataforma do centro mais rosa. Na 3ª, ela vira um coração grande que cai em 2 s e solta corações no chão. A escada principal nunca vira coração, e isso limita a explosão sem parar.
- **Plataformas em grupo** (nível 6+, ~45% das fases): onda, balanço juntas ou "respirando".
- **Ponte que quebra** (nível 8+): meio segundo em cima, ela racha e cai; volta em 4 s.
- **Personalidades dos apaixonados:** 😍 🥺 😳 😠 🤪 🧐, com o símbolo em cima da cabeça.
- **Quatro monstros novos:** tristonho, camaleão, divisor e pisca-pisca.
- **Poderes:** dash de amor (SHIFT ou botão »), coração dourado e a regra "mundo acelerado".
- **IA própria do jogo:** estratégias aprendidas pelos monstros, hábitos do jogador e nível de IA que sobe com o tempo de jogo.

**Testes (script do Claude, fora do jogo):** 28 de 28 passaram.
- Prego: parado no meio; 90° na beirada; volta sozinho.
- Portinha: em 120 de 200 fases; pequena; te engole.
- Espinhos: nascem, matam e quebram.
- Coração: vira e cai; a escada nunca vira.
- Grupos: em 95 de 200 fases, dentro do mundo.
- Personalidades: tímido parado de costas.
- Monstros novos: os quatro funcionam.
- Dash, dourado e IA (valor sobe, fica salvo, nível cresce).
- 20.000 fases geradas, com o topo sempre alcançável e a escada nunca girando, quebrando ou ondulando.
- 3.000 partidas com robô, sem erro e sem NaN.

**Erros que os testes acharam e o Claude corrigiu**
- As explosões transformavam plataformas demais. Agora só a do centro da explosão fica rosa.
- A função `jogador()` do dev sumiu durante a edição; foi restaurada.
