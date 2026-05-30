# 💥 Amor Explosivo

> Um jogo de plataforma feito em **HTML5 Canvas + JavaScript puro** (sem nenhuma biblioteca), que roda direto no navegador — no PC e no celular.

Escale a montanha cheia de plataformas, carregue a sua **explosão de amor** e apaixone todo mundo. Os 5 primeiros níveis são feitos à mão; do **nível 6 em diante**, um **motor procedural** distorce a realidade — cada nível fica mais estranho e mais difícil, no estilo **No Man's Sky / Backrooms**.

Feito por **Douglas**.

---

## 🎮 Sobre o jogo

Você controla um personagem que dispara uma **onda de amor** em forma de coração. A explosão converte os **tristes** (NPCs azuis) em **apaixonados**. Quanto mais gente você apaixona, mais rápido e mais alto você fica — o seu poder cresce junto com a dificuldade.

A partir do nível 6, o motor pega o jogo base e vai **mutando** a cada nível: paleta de cor, gravidade, arquitetura das plataformas e ameaças. Quanto mais fundo, mais distorcido — e mais habilidades você ganha pra dar conta.

---

## ⌨️ Como jogar

**No PC (teclado):**

| Tecla | Ação |
|------|------|
| `←` `→` ou `A` `D` | Andar |
| `↑` ou `W` | Pular (de novo no ar = pulo duplo / triplo) |
| `ESPAÇO` (segurar e soltar) | Carregar e disparar a **explosão de amor** 💥 |
| `↓` ou `S` | Colocar **parede de amor** 🧱 |
| `R` | Reiniciar o nível |

**No celular (toque):** botões na tela — andar, pular, segurar o ❤ para carregar a explosão, e a parede 🧱.

**Objetivo:** apaixonar todos os tristes do nível. Em alguns níveis o objetivo é **coletar corações** (eles fogem de você!) e levar até a **Máquina** 🪨.

---

## 🕹️ Modos de jogo

- **Aventura** — você tem **vidas** e **pontos de vida (❤)**. Levou dano, perde HP; zerou o HP, perde uma vida; acabaram as 3 vidas, volta ao nível 1.
- **Infinito** — modo hardcore: ao ser tocado, o **nível reinicia** na hora. Continua de onde parou e guarda o recorde de profundidade.

O progresso fica **salvo no próprio aparelho** — o menu mostra **"▶ Continuar"** quando há um jogo salvo.

---

## 🧬 O motor procedural (níveis 6+)

O motor trata cada nível como um "DNA" e o distorce a cada novo nível:

- **Distorção crescente** — cor, gravidade, densidade e altura das plataformas mudam a cada nível.
- **Arquitetura Backrooms** — além do caminho-base, o motor monta estruturas surreais: plataformas **diagonais, coladas, em V e em quadrado**. (O caminho-base continua sempre escalável.)
- **Os dois lados crescem** — não aumenta só o lado ruim: o seu HP, velocidade, pulo e explosão também sobem.
- **Monstros** que entram aos poucos e ficam **maiores** e mais resistentes às explosões:
  - **Perseguidor** — te caça e resiste a vários tiros.
  - **Atirador** 🖤 — dispara corações negros à distância.
  - No fundo, vira praticamente uma **metralhadora**.
  - **Comedor** — come os tristes e cresce.
- **Limite de 1000 níveis** — chegar ao 1000 é a vitória.

---

## 📁 Estrutura dos arquivos

Mantenha todos os arquivos **na mesma pasta**:

```
amor_explosivo/
├── index.html          # Launcher: detecta o aparelho e abre a versão certa
├── desktop.html        # Versão PC (teclado)
├── mobile.html         # Versão celular (toque)
├── game.js             # Lógica do jogo (compartilhada pelas duas versões)
├── style.css           # Estilo compartilhado
├── style-desktop.css   # Ajustes da versão PC
├── style-mobile.css    # Ajustes da versão celular
└── README.md           # Este arquivo
```

O `index.html` detecta automaticamente PC ou celular e redireciona para a versão correta.

---

## ▶️ Como rodar

**Localmente:** abra o **`index.html`** no navegador. Ele escolhe a versão de PC ou celular sozinho.

**Publicar online (GitHub Pages):**

1. Crie um repositório no GitHub e suba todos os arquivos.
2. Vá em **Settings → Pages**.
3. Em **Source**, escolha a branch `main` e a pasta `/ (root)`.
4. Salve. Em alguns instantes o jogo fica disponível em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

> Publicar no GitHub Pages é a forma mais confiável de o **"Continuar de onde parou"** lembrar sempre, porque o save fica preso a um endereço fixo (a mesma origem).

---

## 🛠️ Tecnologia

- **HTML5 Canvas** para a renderização.
- **JavaScript puro** (ES6), sem dependências e sem build.
- **Web Audio API** para os efeitos sonoros.
- **localStorage** para salvar o progresso no aparelho.

---

## 📜 Créditos

Jogo desenvolvido por **Douglas**.

Sinta-se livre para jogar, estudar o código e modificar.
