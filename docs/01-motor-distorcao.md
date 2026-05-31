# 01 — Motor de distorção (o coração do jogo)

## A ideia certa (corrigida)

O motor **usa o nível anterior como base** e vai **deformando em cima dele**. Cada nível é o anterior "lembrado errado" — o motor esquece coisas e regras, faz coisas como se estivessem certas, e vai ficando cada vez mais torto, errado e distorcido. **Efeito Backrooms.**

Não é gerar cada nível do zero pelo número. É **evoluir** a estrutura: pegar o que existia e mutar.

## Exemplo (o que você descreveu) — uma estrutura evoluindo

| Nível | O que acontece com aquela estrutura |
|------|--------------------------------------|
| 6  | Duas plataformas, uma sobre a outra, bem coladas |
| 7  | A de baixo "afunda"/funde — agora é **uma só, mais grossa e meio deformada** |
| 8  | Virou uma grossa "certa"; perto dela aparece **uma menor** |
| 9  | A menor **inclinou de leve** e chegou mais perto |
| 10 | A menor **grudou** na grossa |
| 11 | Agora está fina e **parece um "L"** |
| 12 | O "L" está mais puxado e a perna dele **um pouco torta** |
| …  | …cada vez mais torto, errado e distorcido |

Esse é o trabalho do motor: **gerar aberrações com base no anterior e ir piorando**.

## Como implementar (proposta técnica)

- **Memória de estruturas:** o motor guarda uma lista de "estruturas" (cada uma com forma, posição, ângulo, espessura, estado). A cada nível ele aplica **mutações** nelas: afundar, fundir, engrossar, inclinar, grudar, esticar, dobrar em "L", entortar a perna, etc. Mutações novas entram conforme a profundidade.
- **Sempre vencível:** por cima das aberrações, o motor mantém um **caminho-base alcançável** (validado por teste de reachability + robô). As aberrações só **adicionam** estranheza, nunca bloqueiam a subida.
- **Dificuldade sobe junto:** a deformação cresce **e** os números (inimigos, velocidade, ameaças) sobem — começando no nível 5 como piso (já corrigido) e subindo a partir daí.

## Continuar de onde parou (resolve a dúvida anterior)

Como agora o nível **depende dos anteriores**, o "Continuar no nível 70" precisa **reproduzir a evolução 6→70**. Solução: guardar uma **semente (seed) da run** no save. Com a seed, o motor **re-roda a evolução de forma determinística** e chega no mesmo nível 70 distorcido — rápido e sem precisar guardar o desenho inteiro.

- Save passa a guardar: `modo, nível, seed, vidas, recorde, mortes, poderes desbloqueados`.
- Assim o nível 70 volta **idêntico** (mesma evolução), e os poderes que você ganhou também voltam.
