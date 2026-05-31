# 07 — Roadmap (construção em pedaços)

A gente faz **em pedaços**; a cada pedaço eu te mando o arquivo, e no fim fecho um **ZIP completo**.

## ✅ Pronto
- Separação em arquivos (HTML/CSS/JS) + versões PC e celular com detecção.
- Modos Aventura / Infinito + salvar/continuar no aparelho.
- Joystick flutuante desenhado + gestos (2º dedo: pular/barreira).
- Aviso de girar o celular.
- **Raio da explosão reduzido** (estava exagerado).
- **Tela do celular**: altura dinâmica (dvh) + área de segurança (corte em cima).

## ✅ Etapa 1 — Fundação do motor encadeado (PRONTA)
- Geração com **semente determinística**: mesmo nível + mesma semente = **mundo idêntico** (testado).
- **Semente no save**: "Continuar" reproduz o mesmo mundo (ex.: nível 70 volta idêntico).

## ✅ Etapa 2 — Deformação visível (PRONTA)
- Estruturas (motivos Backrooms) **evoluindo nível a nível**: cada âncora avança 1 estágio por nível (duas coladas → fundem → grossa → menor perto → inclina → gruda → "L" → "L" torto) e acumula deformação a cada ciclo — nunca para de piorar.
- Âncoras ~estáveis pela semente (parece a mesma estrutura ficando torta). Colisão honesta (tudo é plataforma de verdade) e caminho-base sempre alcançável (testado).

## ✅ Etapa 3 — Tristes deformados (PRONTA)
- Aparência: quadrados, altos, largos, **gigantes**, e **5 membros** (perninhas extras se mexendo).
- Movimento: alguns **rápidos** e o **efeito bug** (pulando de lugar). Escala com a profundidade, determinístico, e todos continuam **pegáveis** (testado).

## ✅ Etapa 6 — Fase de coleta criativa (PRONTA)
- Tipos de coração: RÁPIDO, FANTASMA (atravessa plataformas), RESISTENTE (2 toques), CHORÃO (rápido e errático), SÓLIDO (empurra ao coletar), SEQUESTRADOR/COBRA (persegue e rouba o que você carrega), COMEDOR (come os vizinhos e cresce) e TEMÁTICO (com chapéu; ao tocar explode em 2 metades que você precisa pegar). Mais exóticos quanto mais fundo o nível de coleta.

## ✅ Extra — Motor Diretor (mini-AI) + correções
- Corações da coleta agora APARECEM espalhados em alturas diferentes e VAGAM sozinhos (além de fugir); não caem mais "do teto".
- Monstros aparecem desde o 1º nível gerado (nível 6), não mais só lá pelo 10/11.
- Menos "barras": plataformas mais largas e um pouco menos numerosas (menos poluído), mantendo tudo alcançável.
- DIRETOR (mini-AI): cada nível ganha um TEMA/sala e MUTADORES DE REGRA (gravidade leve/pesada, vazio/lotado, buracos, tremor, névoa) que distorcem mais fundo. Estilo Backrooms + No Man's Sky. Ver docs/08-motor-diretor.md.

## ✅ Extra 2 — Roupas na coleta + catálogos de avaliação
- Corações da coleta agora vêm VESTIDOS (cartola, óculos, gravata-borboleta, cachecol, boné, coroa) desde a coleta #1; os especiais começam na coleta #2.
- Duas páginas de catálogo (autossuficientes) para avaliar o motor: preview-niveis.html (50 níveis com monstro+triste+cor+barras) e preview-coleta.html (50 níveis de coleta com corações vestidos+barras+cor). Botão para gerar outra semente.

## ✅ Extra 3 — Ajustes do motor (com base no feedback dos catálogos)
- Variedade mais cedo: monstros entram antes (atirador~9, cão~12, comedor~15, esfera~18, tentáculo~21, spiker~24, beamer~27) e o CHEFE gigante a cada 20 níveis; cada monstro com tamanho variado.
- Tristes deformam mais cedo e com mais variedade.
- Plataformas: bem menos e mais largas/espalhadas (estilo dos níveis que o Doug curtiu), mantendo 30/30 de alcançabilidade.
- Coleta: corações com tamanhos variando (maior/menor) e deformados (achatado/esticado), mantendo as roupas; especiais a partir da coleta #2.
- Catálogos atualizados (preview-niveis.html / preview-coleta.html).

## ✅ Extra 4 — Criatividade no JOGO + tutorial
- Monstros agora desenhados como CRIATURAS aberrantes (corpo blob/caixa/estrela/gota, 1-5 olhos, espinhos, derretendo, girado, esticado) com seed estável por monstro; cão/esfera/tentáculo/chefe mantidos. Gêmeo grudado raro (cosmético).
- Tristes melhorados (blob, derretendo, multi-olhos, girado) mantendo o AZUL; gêmeo grudado raro.
- Corações da coleta podem virar fantasma/estrela/losango/blob/gema (uns nem são corações), mantendo roupas/tamanhos/deformação; gêmeo grudado raro.
- Grudados são RAROS (~10-12%) e de verdade colados (não dois soltos).
- TUTORIAL (PC + celular) que aparece UMA vez ao iniciar um jogo novo, antes do nível 1 (não a cada nível).
- Plataformas mantidas (espinha esparsa/larga, 30/30 de subida). Visual doido das plataformas no jogo fica pro próximo passo.

## (roadmap concluído)
3. **Poderes do jogador** (página 04) — começar pelos ativos simples: Disparo de amor, Onda, Barreira-círculo; depois os passivos; por último o **Amor Divino**. Junto com a **UI de poderes** (página 06).
4. **Monstros e poderes** (página 03) — começar pelos mais simples (barreira no chão, espinhos, cachorro), depois o **chefe gigante** e o **feixe que corta o chão**. Aplicar a regra "**apaixonar todos + derrotar todos os monstros**".
5. **Fase de coleta criativa** (página 05) — variações de coração (fantasma, comedor, cobra, chorão, sólido, temáticos).

## Regras fixas (valem pra tudo)
- **Sempre vencível** (caminho até o objetivo, validado por teste).
- **Os dois lados crescem**: quanto pior o mundo, mais poder/HP/velocidade o jogador ganha.
- **Toda ameaça tem contrapartida** (dá pra desviar/reverter/destruir).
- **Antes de entregar:** revisar item por item e **simular/testar** (inclusive toque/clique).
- No fim de cada rodada: **ZIP completo**.
