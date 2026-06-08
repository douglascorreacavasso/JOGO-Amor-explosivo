# 💥 Amor Explosivo

> Jogo de plataforma em **HTML5 Canvas + JavaScript puro** (sem bibliotecas), roda no navegador no **PC e no celular**.

Escale a montanha, carregue a **explosão de amor** e apaixone todo mundo. Os **5 primeiros níveis** são feitos à mão; do **6 em diante** os níveis são **gerados** por um motor procedural que vai distorcendo tudo (efeito Backrooms), mais difícil a cada nível — mas **sempre vencível**.

Feito por **Douglas**.

---

## ⌨️ Como jogar

**PC (teclado):** `← →`/`A D` anda · `↑`/`W` pula (duplo/triplo) · `ESPAÇO` (segura e solta) explode 💥 · `↓`/`S` parede 🧱 · `E` usa poder · `Q` troca poder · `F` Amor Divino ✨ · `R` reinicia.

**Celular (toque) — gire pra horizontal:**
- **Joystick flutuante** (encoste e arraste em qualquer lugar): **← →** anda · **↑ pra cima = pula** (de novo no ar = duplo/triplo) · **↓ pra baixo = parede** 🧱.
- Botão **❤** (canto): segure e solte = **explosão** 💥. Os botões **★ / ⇄ / ✨** só aparecem quando você tem poder / a barra enche.

**Objetivo:** apaixonar **todos os tristes** (azuis). Em fases de **coleta**, junte os corações fujões e leve até a **Máquina** 🪨. Com **monstros**: apaixone todos **e** derrote os monstros.

No começo de cada fase nova aparece um **briefing grande, em partes**, explicando o que fazer.

---

## 🕹️ Modos
- **Aventura** — vidas + HP. Zerou HP perde vida; acabaram as 3, volta ao nível 1.
- **Infinito** — ao ser tocado, reinicia o nível na hora; guarda o recorde de profundidade.

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
