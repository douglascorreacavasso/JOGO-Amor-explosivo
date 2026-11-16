# 💥 Amor Explosivo

> Jogo de plataforma em **HTML5 Canvas + JavaScript puro** (sem bibliotecas), roda no navegador no **PC e no celular**.

Fases largas de **rolagem lateral** (ida e volta) com subida: carregue a **explosão de amor** e apaixone todo mundo. Os **5 primeiros níveis** são feitos à mão; do **6 em diante** os níveis são **gerados** por um motor procedural que fica cada vez mais estranho (salas estilo Backrooms em 4 camadas, do "quase normal" ao "puro abstrato"), mais difícil a cada nível — mas **sempre vencível**.

Feito por **Douglas**. Revisão v27 (física em passo fixo, desenho leve, telas novas, poderes progressivos, salas estranhas) feita pelo Claude em 15/11/2026 — ver `docs/09-revisao-v27.md`.

---

## ⌨️ Como jogar

**PC (teclado):** `← →`/`A D` anda · `↑`/`W` pula (segurar = pulo mais alto) · `ESPAÇO` (segura e solta) explode 💥 · `↓`/`S` barreira 🧱 · `E` usa poder · `Q` troca poder · `F` Amor Divino ✨ · `P`/`Esc` pausa · `R` reinicia a fase · `Enter` confirma nas telas.

**Celular (toque) — gire pra horizontal:**
- **Joystick flutuante** (encoste e arraste em qualquer lugar): **← →** anda · **↑ pra cima = pula** (segurar = mais alto; de novo no ar = duplo/triplo) · **↓ pra baixo = barreira** 🧱.
- Botão **💥** (coração no canto): segure e solte = **explosão**. Os botões **★ / ⇄ / ✨** só aparecem quando você tem poder / a energia enche. **❚❚** no topo pausa.

**Objetivo:** apaixonar **todos os tristes** (azuis). Em fases de **coleta**, junte os corações fujões e leve até a **Máquina do Amor**. Com **monstros**: apaixone todos **e** derrote os monstros.

No começo de cada fase aparece um **briefing em partes**: explica o objetivo, cada **poder novo**, cada **monstro novo** e cada **regra estranha** da sala na primeira vez que aparecem.

### Poderes que vão aparecendo
| Nível | Poder |
|---|---|
| 1 | Explosão de amor 💥 |
| 2 | Pulo duplo 🦘 |
| 3 | Barreira de amor 🧱 |
| 5 | Pulo triplo 🪽 |
| 7 | Disparo de amor 💘 |
| 10 | Amor Divino ✨ (energia cheia) |
| 12 / 15 / 18 | Onda 🌊 / Escudo 🛡️ / Laser 🔆 |
| 22 / 26 / 30 | Chuva 🌧️ / Coração de proteção 💚 / Amor elétrico ⚡ |

---

## 🕹️ Modos
- **Aventura** — 3 vidas, cada vida com corações de HP. Zerou o HP perde uma vida; acabaram as 3, volta ao nível 1.
- **Infinito** — sem vidas: qualquer toque reinicia a fase na hora; guarda o recorde de profundidade.

Progresso **salvo no aparelho** (menu mostra **▶ Continuar**). O save guarda a **semente**, então o "Continuar" reproduz o mesmo mundo.

---

## 🧪 Modo desenvolvedor — `dev.html` (PC)
Abra **`dev.html`** pra inspecionar o motor **sem jogar**:
- **◀ ▶** (ou PageUp/PageDown) trocam de nível; campo pra digitar o nível.
- **Semente:** digitar uma ou **🎲 nova** pra ver o mesmo nível com outro mundo.
- **Info** da fase: tipo, nº de barras, tristes, monstros, tamanho do mundo, tags do diretor.
- **✔ varrer 1–100 (alcance):** roda o robô e diz se alguma fase ficou com topo inalcançável.

### Robôs headless (Node, sem navegador)
Dentro da pasta do jogo:
```
node _test.js   # alcançabilidade 1..200 + performance (ms/frame) + tempo de build
node _draw.js   # roda update()+draw() em várias fases (pega erro de runtime)
node _dev.js    # testa a API de dev (go/next/reseed/scan)
```

---

## 📁 Arquivos
```
amor_explosivo/
├── index.html          # detecta PC/celular e redireciona
├── desktop.html        # versão PC
├── mobile.html         # versão celular
├── dev.html            # inspetor de níveis (PC)
├── game.js             # motor (comentado por ÁREAS — ver docs-codigo/)
├── style.css           # estilo compartilhado
├── style-desktop.css   # ajustes PC
├── style-mobile.css    # ajustes celular (orientação, briefing compacto)
├── _test.js _draw.js _dev.js   # robôs de teste (Node)
├── docs/               # documentos de DESIGN (o plano: 01..08)
└── docs-codigo/        # como o CÓDIGO funciona, por área (A motores, B níveis 1-5, C personagens, D habilidades)
```

## ▶️ Rodar
Abra **`index.html`** (escolhe PC/celular sozinho). Pra publicar: **GitHub Pages** (Settings → Pages → branch `main`, pasta `/root`).

## 🛠️ Tecnologia
HTML5 Canvas · JS puro (ES6) · Web Audio API · localStorage. Sem build, sem dependências.
