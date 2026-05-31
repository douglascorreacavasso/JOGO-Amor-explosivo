# 06 — UI e controles (celular)

## Tela do celular cortada / "expandir" (em correção)
- **Já ajustado:** a tela agora usa **altura dinâmica (`dvh`)** e respeita a **área de segurança** do topo (notch) — isso resolve o **corte em cima**.
- O **"expandir"** que aparece costuma ser do **preview do navegador/app** (quando o site abre dentro de outro app). Depois de expandir/abrir em tela cheia, o jogo já se ajusta sozinho. Publicar no **GitHub Pages** e abrir como site normal evita esse preview.

## Mostrar MUITOS poderes sem poluir o celular
O desafio: vão existir vários poderes. Proposta pra não encher a tela:
- **Separar ativos x passivos** (ver página 04).
  - **Passivos/automáticos** (Coração de proteção, Amor elétrico, Chuva de amor): ligam e agem sozinhos — **não precisam de botão**, só de um pequeno ícone de status.
  - **Ativos** (Explosão, Disparo, Laser, Onda, Amor Divino): usam comando.
- **Dois botões só**, no canto:
  1. **❤ Explosão** (segura e solta) — como já é.
  2. **★ Poder equipado** — usa o poder ativo escolhido; um toque rápido **troca** qual está equipado (ou um menuzinho radial que abre só quando segura).
- O **Amor Divino** (definitivo) pode virar um botão que só **aparece quando a barra enche** (raro), pra não ocupar espaço o tempo todo.
- Ícones pequenos e translúcidos, longe da zona do **joystick flutuante**.

## Gestos (já existem, mantém)
- **Joystick flutuante** = mover pros lados.
- **2º dedo:** arrastar ↑ = pular, ↓ = barreira.
- Dá pra usar o 2º dedo também pra **trocar/disparar** poder ativo, se ficar melhor que botão (a decidir testando).

## Raio da explosão (corrigido)
- Estava **exagerado de grande**. **Já reduzido** (de ~380–900 para ~240–385 no talo). Dá pra afinar mais se ainda estiver grande.

## A decidir (testando no celular)
- Botão único de poder vs roda radial vs gesto.
- Tamanho/posição dos ícones de status dos passivos.
