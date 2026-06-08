# D — HABILIDADES (poderes do jogador, dos monstros e atividades dos corações-NPC)

> Onde está no código: banner `// ===== [HABILIDADES] ...`, lista `ACTIVE_POWERS`, `usePower / cyclePower / fireDivine / fireBlast / placeWall`, as habilidades de monstro dentro do loop dos `monsters`, e o comportamento dos corações no loop de coleta.

## Poderes do JOGADOR
Começa com **Parede 🧱 + Explosão 💥**. O motor concede novos poderes conforme você avança; a barra de AMOR e o nº de cargas crescem (poderes fortes custam mais).

Ativos (precisam de comando) e na UI ficam em **2 botões**: `❤` explosão e `★` poder equipado (com `⇄` pra trocar). O **Amor Divino ✨** só aparece quando a barra enche.

| Poder | Tipo | O que faz |
|------|------|-----------|
| Explosão 💥 | ativo (❤) | onda de coração que apaixona/empurra; raio já reduzido |
| Parede 🧱 | ativo (joystick ↓) | barreira de amor |
| Barreira-círculo | ativo | escudo que empurra por alguns segundos |
| Disparo de amor | ativo | coração na direção que você anda, apaixona/empurra |
| Laser de amor | ativo | instantâneo, mas você fica parado ~2s |
| Onda de amor | ativo | ondulação pros dois lados, dano a monstro |
| Coração de proteção | passivo | te segue, tem vida, ninguém te toca |
| Chuva de amor | passivo | chove corações por um tempo |
| Amor elétrico | passivo | nuvem solta raios de amor |
| **AMOR DIVINO ✨** | definitivo | círculo que cresce; todos param; destrói monstros e apaixona todos |

Passivos ligam sozinhos (só ícone de status). A ordem de implementação segue o roadmap (ativos simples → passivos → Amor Divino).

## Controle (celular) — pedido do Doug
Agora é **só o joystick**, mais intuitivo:
- ← → **anda**
- empurrar pra **CIMA = pula** (re-arma pra pulo duplo/triplo)
- empurrar pra **BAIXO = solta a parede 🧱**

O botão `❤` (explosão) continua no canto. `★`/`⇄`/`✨` só aparecem quando há poder/barra cheia. (No PC: setas/WASD, ESPAÇO explode, ↓ parede, E usa poder, Q troca, F divino.)

## Habilidades dos MONSTROS
Todo poder de monstro tem **contrapartida** (dá pra desviar, reverter com poder ou destruir — nunca "morte garantida"):
1. **Barreira no chão** — gruda você; some quando você destrói o monstro (tem vida).
2. **Disparar coração** (projétil).
3. **Metralhadora** — vários pequenos em sequência.
4. **Esferas escuras** — deixam os tristes chorando; se te pegam, te seguram e te deixam lento (reverte com poder).
5. **Espinhos** — sombra que cresce e baixa em onda até você.
6. **Onda de energia** — suas plataformas/paredes perdem o sólido por ~5s (você cai até o chão).
7. **Feixe negro vertical** — corta as plataformas/chão; cair no buraco = morte, fora = reaparece.
8. **Tentáculo** — círculo solta tentáculo lento; toca = dano; pode ter até 5 em diagonal.
9. **Cão negro** — morde e não solta até matar; tira agilidade (acumula).

Regra de vitória com monstros: **apaixonar todos os tristes E derrotar todos os monstros**. O briefing avisa quando há monstros e quando há chefe.

## "Atividades" dos CORAÇÕES-NPC (coleta)
Cada tipo tem comportamento fixo (a "atividade pré-definida" pedida) — visual em doc C:
- **fast:** dispara pra longe (foge muito rápido).
- **ghost:** atravessa plataformas.
- **tough:** precisa encostar/explodir **2×** pra absorver.
- **crybaby:** super rápido e errático.
- **solid:** não atravessa outros; **empurra** os demais.
- **snake:** pega outros corações e vira uma **cobra** em fila; persegue e **rouba** o que você está carregando.
- **splitter:** ao tocar, explode em **2 metades** (cada uma vale meio) que você precisa pegar.
- **eater:** **come os vizinhos** e cresce, passando a **valer mais**; foge de você mas persegue os outros.

Tudo balanceado pra continuar **possível** juntar o total e chegar na Máquina 🪨 (sempre vencível).
