# 08 - Motor Diretor (mini-AI) - Backrooms + No Man's Sky

Inspiracao: o filme Backrooms (salas "lembradas errado" que vao se distorcendo
e ate viram vazio/buraco conforme se desce) e o No Man's Sky (variedade infinita,
gerada proceduralmente). A ideia e um motor que NAO so muda o mapa, mas muda as
REGRAS de cada nivel, ficando mais criativo e distorcido quanto mais fundo.

## O diretor
A cada nivel, uma funcao "director(n)" (deterministica pela semente do save)
escolhe:

1. TEMA / SALA (variedade No Man's Sky)
   - Um tema de uma lista (Sala Amarela, Escritorio, Piscina Infinita, Garagem,
     Biblioteca, Hotel Infinito, Jardim, Quadra, Capela, Lavanderia, Corredor, Porao).
   - A ordem dos temas re-embaralha a cada ~15 niveis (epoca), ficando mais
     imprevisivel/distorcida quanto mais fundo - igual a sensacao de "descer"
     trocando de comodo no Backrooms.
   - O tema define a paleta de cor do nivel.

2. MUTADORES DE REGRA (a "mini-AI pensando")
   Cada nivel rola alguns mutadores que mudam como o nivel funciona:
   - Gravidade leve / pesada: muda a sensacao de queda e de pulo (o alcance do
     pulo e compensado automaticamente para o nivel continuar vencivel).
   - Vazio / lotado: muda a densidade de plataformas.
   - Buracos: na banda mais alta, algumas plataformas somem ("lembrado errado").
   - Tremor (jitter) e variacao de tamanho (warp): as plataformas ficam tortas
     e irregulares.
   - Nevoa: escurece/embaca a cena.
   As tags ativas aparecem no rotulo do nivel (ex.: "NIVEL 23 - PISCINA INFINITA
   [gravidade leve - buracos]"), entao da pra VER as regras mudando.

3. DISTORCAO CRESCENTE
   Um valor "distort" (0..1) cresce com a profundidade e amplifica tremor, warp,
   nevoa e buracos - o mundo vai ficando cada vez mais "errado".

## Garantias (qualidade)
- Deterministico: mesma semente + mesmo nivel = mesmas regras e mesmo mapa
  (o "Continuar" volta identico).
- Sempre vencivel: a grade-base de plataformas continua alcancavel (testado com
  o robo de alcance), os buracos so afetam a banda mais alta, e o pulo e
  compensado quando a gravidade muda.
- Combina com a Etapa 2 (estruturas Backrooms que evoluem nivel a nivel) e com a
  paleta/vinheta que ja existiam.

## Proximos passos possiveis (se quiser ir alem)
- Salas com "props" tematicos visiveis (cadeiras, lampadas, portas) como no demo
  HTML da conversa.
- Eventos de sala (luz piscando, corredor que estica).
- Regras mais exoticas (inverter controles por alguns segundos, escuridao com
  lanterna, etc.).
