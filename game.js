(() => {
"use strict";
/* ============================================================================
   AMOR EXPLOSIVO — game.js  v27 (motor único, comentado por ÁREAS)
   Tudo roda dentro de UMA função (IIFE) porque as variáveis são compartilhadas
   por closure. O arquivo está DIVIDIDO EM ÁREAS com banners "===== [ÁREA] =====":

     [MOTORES]      laço de passo fixo, geração de fase, diretor, física, câmera
     [NÍVEIS 1–5]   as 5 fases feitas à mão + tamanho de fase por nível
     [PERSONAGENS]  jogador, tristes (NPC azul), monstros, corações-NPC da coleta
     [HABILIDADES]  poderes do jogador (aparecem aos poucos), poderes dos monstros
     [RENDER]       desenho leve: sprites pré-prontos, fundo em cache, qualidade automática
     [TELAS]        menu, tutorial, briefing, pausa, fim de fase

   v27 (15/11/2026, revisão feita pelo Claude a pedido do Douglas):
   - física em PASSO FIXO de 60 Hz (antes dependia do FPS: lento em aparelho fraco,
     rápido demais em tela de 120/144 Hz) + interpolação da câmera e do jogador;
   - fase em unidades fixas do mundo (a mesma semente gera a mesma fase em qualquer tela);
   - fases largas (rolagem lateral) com subida; câmera que olha para onde você anda;
   - desenho sem shadowBlur em tempo real (sprites assados uma vez) e qualidade automática;
   - poderes desbloqueados por nível COM aviso; diretor Backrooms em 4 camadas de estranheza.
   ============================================================================ */
const MOBILE = !!(typeof document!=='undefined' && document.body && document.body.dataset && document.body.dataset.platform==='mobile');
const SAVE_KEY='amorExplosivo_save_v2';
function saveProgress(lvOverride){ try{ if(typeof localStorage==='undefined')return;
  localStorage.setItem(SAVE_KEY, JSON.stringify({v:27,mode,level:lvOverride||level,lives,deepest,deaths,seed:runSeed,seen,ts:Date.now()})); }catch(e){} }
// lê o save e devolve SEMPRE um objeto limpo (ou null). Aceita save da v26 (sem "v"/"seen").
// Achado pelo robô _save_test.js (16/11): antes um save estranho mostrava "nível 2.7"/"nível true" no menu e abria outro
// nível, 1e12 abria o nível 1, recorde gigante punha a fase na dificuldade máxima e mortes podiam ficar negativas.
function saveInt(x){ if(typeof x==='number') return isFinite(x)?Math.floor(x):NaN;
  if(typeof x==='string' && /^\s*\d{1,12}\s*$/.test(x)) return parseInt(x,10); return NaN; }
function loadProgress(){ try{ if(typeof localStorage==='undefined')return null;
  const s=localStorage.getItem(SAVE_KEY); const o=s?JSON.parse(s):null;
  if(!o || typeof o!=='object' || Array.isArray(o)) return null;
  const lv=saveInt(o.level); if(!(lv>=1)) return null;
  const level=Math.min(lv,LEVEL_CAP), li=saveInt(o.lives), dp=saveInt(o.deepest), dt=saveInt(o.deaths), sd=saveInt(o.seed);
  const seen={}; if(o.seen && typeof o.seen==='object' && !Array.isArray(o.seen))
    for(const k of Object.keys(o.seen)){ if(k!=='__proto__' && k.length<40 && o.seen[k]) seen[k]=1; }
  return { v:o.v, mode:o.mode==='infinite'?'infinite':'adventure', level,
    lives:(li>=1&&li<=3)?li:3, deepest:clamp(dp>=1?dp:level,level,LEVEL_CAP), deaths:dt>=0?Math.min(dt,1e9):0,
    seed:(o.seed!=null && sd>=0)?(sd>>>0):(typeof o.seed==='number'&&isFinite(o.seed)?(o.seed>>>0):null), seen };
  }catch(e){return null;} }
function clearProgress(){ try{ if(typeof localStorage!=='undefined') localStorage.removeItem(SAVE_KEY); }catch(e){} }
const cv=document.getElementById('game'), ctx=cv.getContext('2d',{alpha:false});   // tela opaca: o navegador compõe mais rápido
let W=0,H=0,DPR=1,SCRW=0,SCRH=0,ZOOM=1,RS=1;

const GROUND_H=90, GRAV=0.62, BASE_JUMP=-14.6, STEP=1/60, MAX_FALL=18;
const MOVE=1.7, FRICTION=0.74, COYOTE=0.12, JUMP_BUF=0.12;
const BAND_H=70, SLOT=248;
const MAX_STAM=100, WALL_COST=50, WALL_LIFE=60, FREEZE_TIME=3, BLOCK_TIME=3;
const CONV_SPEED=0.10, CONV_SPEED_CAP=1.0, CONV_JUMP=0.06, CONV_JUMP_CAP=0.6;
const LEVEL_CAP=1000;
const VIEW_H = MOBILE ? 600 : 960;           // altura do MUNDO visível (unidades do mundo), igual em qualquer aparelho
const HEART_COLORS=['#ff2e63','#ff8fab','#ffd166','#06d6a0','#4cc9f0','#b5179e','#f72585','#ff7b00'];

// física viva (distorcível por nível)
let phGrav=GRAV, phMove=MOVE, phFric=FRICTION, phBandH=BAND_H, phSlot=SLOT, phBaseJump=BASE_JUMP, JUMP_Hc=140;

// ===== [NÍVEIS 1–5] As 5 fases feitas à mão =====
const HAND=[
 {type:'love',   moving:0,  mvSpeed:0,   npc:10, follow:2.0, blocks:3},
 {type:'collect',moving:2,  mvSpeed:0.8, target:10, blocks:0},
 {type:'love',   moving:4,  mvSpeed:1.0, npc:14, follow:2.4, blocks:4},
 {type:'love',   moving:7,  mvSpeed:1.2, npc:18, follow:2.7, blocks:5},
 {type:'love',   moving:11, mvSpeed:1.5, npc:22, follow:3.0, blocks:6},
];
function hsl(h,s,l){ return 'hsl('+((h%360)+360)%360+','+s+'%,'+l+'%)'; }
function palFromHue(hue,inv){ const L=l=>inv?100-l:l; return {
  bg:hsl(hue,34,L(13)), bg2:hsl(hue+10,40,L(19)), line:hsl(hue+15,40,L(28)), hi:hsl(hue+30,70,L(60)),
  amb:hsl(hue+40,70,70), groundTop:hsl(hue+20,38,L(34)), groundBot:hsl(hue+10,40,L(12)), groundLine:hsl(hue+50,80,72),
  plat:hsl(hue,30,L(40)), platTop:hsl(hue+30,60,L(76)), platMv:hsl(hue+20,46,L(50)), arch:hsl(hue+160,30,L(38)) }; }
const PAL_NIGHT={ bg:'#140d33', bg2:'#22174d', line:'#3a2a6e', hi:'#ff9eb5', amb:'#ff9eb5', groundTop:'#5a3d7a', groundBot:'#2a1d40', groundLine:'rgba(255,158,181,.6)',
  plat:'#523a78', platTop:'#c9b6ef', platMv:'#6a4a9e', arch:'#7a5a3e' };
const PAL_SKY={ bg:'#1d3d7a', bg2:'#2b5296', line:'#3e66ad', hi:'#cfe0ff', amb:'#bcd4ff', groundTop:'#3a6a4a', groundBot:'#1d3a2a', groundLine:'rgba(180,255,200,.6)',
  plat:'#4a5f9e', platTop:'#d5e2ff', platMv:'#6a6ab0', arch:'#6a5a8e' };

// ===== TAMANHO DA FASE (em unidades FIXAS do mundo: a mesma fase em qualquer tela) =====
// Fases LARGAS (rolagem lateral, ida e volta) com subida — fica mais larga e mais alta com a profundidade.
function areaForLevel(n){
  if(n===1) return {w:3600,h:1500};
  if(n===2) return {w:3000,h:1500};   // 1ª coleta
  if(n===3) return {w:4200,h:1800};
  if(n===4) return {w:4800,h:2000};
  if(n===5) return {w:5400,h:2300};
  const d=n-5; return {w:Math.min(5000+d*50, 9000), h:Math.min(2100+d*12, 3300)};
}
// ===== QUANDO CADA PODER APARECE (o jogo avisa na 1ª vez) =====
const UNLOCKS=[
  {lv:2,  id:'double',  icon:'🦘', name:'PULO DUPLO',        pc:'aperte ↑ de novo no ar', mob:'deslize pra cima de novo, ainda no ar', what:'Pule outra vez no meio do pulo.'},
  {lv:3,  id:'wall',    icon:'🧱', name:'BARREIRA DE AMOR',  pc:'aperte ↓', mob:'puxe o dedo da esquerda pra baixo', what:'Uma parede de corações por 60 s: os apaixonados não passam por ela. Gasta 50 de energia.'},
  {lv:5,  id:'triple',  icon:'🪽', name:'PULO TRIPLO',       pc:'↑ três vezes', mob:'deslize pra cima três vezes', what:'Agora são 3 pulos seguidos.'},
  {lv:8,  id:'dash',    icon:'💨', name:'DASH DE AMOR',      pc:'aperte SHIFT', mob:'botão »', what:'Arrancada rápida pra frente, atravessando os apaixonados sem levar dano. 15 de energia.'},
  {lv:7,  id:'shot',    icon:'💘', name:'DISPARO DE AMOR',   pc:'aperte E', mob:'botão ★', what:'Lança um coração pra frente: apaixona os tristes e fere monstros. 24 de energia.'},
  {lv:10, id:'divine',  icon:'✨', name:'AMOR DIVINO',       pc:'aperte F com a energia CHEIA', mob:'botão ✨ (aparece com a energia cheia)', what:'Apaixona TODOS e destrói TODOS os monstros da fase. Gasta a energia inteira.'},
  {lv:12, id:'wave',    icon:'🌊', name:'ONDA DE AMOR',      pc:'E (troque com Q)', mob:'★ (troque com ⇄)', what:'Uma onda pelo chão pros dois lados. 34 de energia.'},
  {lv:13, id:'ponte',   icon:'🌉', name:'PONTE DE CORAÇÃO',  pc:'E (troque com Q)', mob:'★ (troque com ⇄)', what:'Cria uma plataforma de coração por 6 s: na sua frente e um degrau acima, ou embaixo dos seus pés se você estiver caindo. 20 de energia.'},
  {lv:16, id:'jardim',  icon:'🌷', name:'JARDIM DO AMOR',    pc:'E (troque com Q)', mob:'★ (troque com ⇄)', what:'Nascem flores e corações nas 5 plataformas mais perto: quebra os espinhos, atrai os tristes, e apaixonado que pega um coração para de te seguir. 30 de energia.'},
  {lv:15, id:'shield',  icon:'🛡️', name:'ESCUDO',            pc:'E (troque com Q)', mob:'★ (troque com ⇄)', what:'5 s sem levar dano e empurrando quem chega perto. 40 de energia.'},
  {lv:18, id:'laser',   icon:'🔆', name:'LASER DE AMOR',     pc:'E (troque com Q)', mob:'★ (troque com ⇄)', what:'Raio instantâneo na linha em que você está; você fica parado 1,6 s. 46 de energia.'},
  {lv:20, id:'dominio', icon:'🌸', name:'EXPANSÃO DE DOMÍNIO', pc:'aperte G (com 70 de energia)', mob:'botão ◎ (aparece com 70 de energia)', what:'Por 7 s o cenário vira o seu SANTUÁRIO DO AMOR: os tristes por perto se apaixonam sozinhos, os apaixonados ficam calmos (não machucam) e os monstros dentro perdem vida. Se um monstro abrir o domínio dele, abra o seu para QUEBRAR o dele.'},
  {lv:21, id:'terremoto',icon:'🌋', name:'TERREMOTO DO AMOR', pc:'E (troque com Q)', mob:'★ (troque com ⇄)', what:'O chão treme em volta de você: monstros pulam, ficam tontos e perdem 1 de vida; pregos giram, espinhos quebram e os blocos caem. 40 de energia.'},
  {lv:22, id:'rain',    icon:'🌧️', name:'CHUVA DE AMOR',     pc:'E (troque com Q)', mob:'★ (troque com ⇄)', what:'Chovem corações na tela por 2,6 s. 38 de energia.'},
  {lv:24, id:'tempo',   icon:'⏳', name:'TEMPO LENTO',        pc:'E (troque com Q)', mob:'★ (troque com ⇄)', what:'Por 4 s tudo fica em câmera lenta (monstros, apaixonados, tiros e plataformas que se mexem), menos você. 45 de energia.'},
  {lv:26, id:'guard',   icon:'💚', name:'CORAÇÃO DE PROTEÇÃO', pc:'E (troque com Q)', mob:'★ (troque com ⇄)', what:'Um coração te segue por 30 s e segura 3 golpes. 42 de energia.'},
  {lv:30, id:'electric',icon:'⚡', name:'AMOR ELÉTRICO',     pc:'E (troque com Q)', mob:'★ (troque com ⇄)', what:'Nuvem-coração que solta raios por 4 s. 44 de energia.'},
];
function unlocked(id,n){ const u=UNLOCKS.find(u=>u.id===id); return !!u && (n||level)>=u.lv; }

// ===== [FASES] PLANEJADOR DINÂMICO (sem fim, pro modo infinito): NORMAL / BÔNUS / ESPECIAL =====
// Tudo configurável aqui. O plano é calculado em sequência pela semente da partida (mesmo save = mesmo plano).
const PLANO={ bonusPrimeiro:8, bonusIntervalo:[8,12], especialPrimeiro:13, especialIntervalo:[6,10], especiaisSeguidasLiberadasEm:60 };
const ESPECIAIS={   // obj: apaixonar | saida | topo | resgate · min = nível mínimo · cada uma tem UMA mecânica central
  desaparecem:{nome:'PLATAFORMAS QUE DESAPARECEM',min:13,obj:'saida',icon:'🪵',curta:'As plataformas caem depois que alguém pisa!',txt:'As plataformas rachadas tremem e caem depois que alguém pisa nelas (voltam depois). Pule rápido e chegue à SAÍDA 🚪.'},
  torre:{nome:'A TORRE DOS CORAÇÕES',min:16,obj:'topo',icon:'🗼',curta:'Suba até o coração do topo!',txt:'Suba pelas plataformas até o grande coração dourado lá no TOPO e toque nele. Nas versões difíceis, uma névoa sobe por baixo.'},
  portas:{nome:'AS PORTAS FAMINTAS',min:18,obj:'saida',icon:'🚪',curta:'Não pule perto das portas!',txt:'Várias portinhas famintas: elas atacam quando você PULA perto. Chegue à SAÍDA — ou use as portas a seu favor.'},
  gigantes:{nome:'OS GIGANTES APAIXONADOS',min:20,obj:'apaixonar',icon:'🦣',curta:'Cuidado com os apaixonados gigantes!',txt:'Quase todo apaixonado vira GIGANTE: bloqueia caminhos, é mais lento e pula menos. Encontre outra rota.'},
  elevadores:{nome:'ELEVADORES DO AMOR',min:22,obj:'topo',icon:'🛗',curta:'Espere o elevador chegar perto!',txt:'Muitas plataformas sobem e descem sem parar. Embarque na hora certa e chegue ao coração do TOPO.'},
  gravLeve:{nome:'GRAVIDADE LEVE',min:24,obj:'apaixonar',icon:'🎈',curta:'Seus saltos estão mais altos!',txt:'A gravidade está fraca: você pula mais alto e fica mais tempo no ar, mas é mais difícil mudar de direção.'},
  trampolins:{nome:'O DESAFIO DOS TRAMPOLINS',min:26,obj:'topo',icon:'🦘',curta:'Use os trampolins!',txt:'Plataformas-mola (com molinha embaixo) te jogam lá pra cima — algumas pro lado (seta). Ache a sequência até o TOPO.'},
  cascata:{nome:'CASCATA DE CORAÇÕES',min:28,obj:'resgate',icon:'💧',curta:'Ative as plataformas para liberar os corações!',txt:'Exploda as plataformas com coração lá em cima: os corações caem pelas plataformas. Faça cada apaixonado pegar um (AMOR-PRÓPRIO 💗) pra passar.'},
  escuridao:{nome:'ESCURIDÃO DOS CORAÇÕES',min:30,obj:'saida',icon:'🌑',curta:'Use o amor para iluminar o caminho!',txt:'Está escuro. As bordas das plataformas brilham fraquinho e cada explosão ilumina tudo por uns segundos. Chegue à SAÍDA.'},
  gelo:{nome:'PLATAFORMAS DE GELO',min:32,obj:'apaixonar',icon:'🧊',curta:'O gelo dificulta suas paradas!',txt:'Tudo escorrega: você demora pra parar e pra virar. Calcule a distância antes de pular.'},
  musicais:{nome:'PLATAFORMAS MUSICAIS',min:34,obj:'saida',icon:'🎵',curta:'As plataformas se movem no ritmo!',txt:'As plataformas sobem e descem no ritmo da batida (você ouve o tique). Aprenda o ritmo e pule na hora certa até a SAÍDA.'},
  vento:{nome:'O VENTO DO AMOR',min:36,obj:'saida',icon:'🌬️',curta:'O vento muda seus saltos!',txt:'Faixas de vento (com risquinhos) te empurram no ar e levam os corações soltos. Nas versões difíceis o vento troca de lado — com aviso.'},
  fuga:{nome:'FUGA VERTICAL',min:38,obj:'topo',icon:'⬆️',curta:'Suba antes que a ameaça alcance você!',txt:'Uma nuvem negativa sobe devagar desde o chão: encostar nela = perder. Suba até o coração do TOPO.'},
  resgate:{nome:'O GRANDE RESGATE',min:40,obj:'resgate',icon:'🛟',curta:'Ajude todos a conquistar amor-próprio!',txt:'Apaixone e depois leve cada apaixonado até um coração (AMOR-PRÓPRIO 💗). Medalha 🏅 se ninguém explodir de amor.'},
};
const ORDEM_ESP=['desaparecem','torre','portas','gigantes','elevadores','gravLeve','trampolins','cascata','escuridao','gelo','musicais','vento','fuga','resgate'];
const BONUS_VAR={ tradicional:{nome:'COLETA',txt:'Capture os corações e leve-os à Máquina do Amor!'},
  vertical:{nome:'CAÇADA VERTICAL',txt:'A Máquina do Amor está lá no ALTO. Capture e suba!'},
  fantasmas:{nome:'CORAÇÕES FANTASMAS',txt:'Quase todos são fantasmas: só dá pra pegar quando ficam SÓLIDOS (mais fortes na cor).'},
  moveis:{nome:'PLATAFORMAS EM MOVIMENTO',txt:'Os corações fogem usando plataformas que se mexem.'},
  viajante:{nome:'MÁQUINA VIAJANTE',txt:'A Máquina do Amor muda de lugar de tempos em tempos (ela avisa antes).'},
  tempo:{nome:'CAÇADA CONTRA O TEMPO',txt:'Encha a Máquina do Amor antes do tempo acabar ⏰!'},
  disfarcados:{nome:'CORAÇÕES DISFARÇADOS',txt:'Alguns corações são só ENFEITE (parados). Os de verdade se mexem.'},
  grupo:{nome:'FUGA EM GRUPO',txt:'O coração REI 👑 faz os outros fugirem junto. Separe o grupo! (o rei vale 3)'},
  escura:{nome:'CAÇADA ESCURA',txt:'Está escuro: os corações aparecem perto de você ou quando você explode.'},
  entrega:{nome:'ENTREGA PERIGOSA',txt:'A Máquina está no alto e o caminho tem plataformas que caem.'} };
const ORDEM_BONUS=['vertical','fantasmas','viajante','tempo','moveis','grupo','disfarcados','escura','entrega'];
let _plano=null;
function planoFases(n){
  if(!_plano || _plano.seed!==runSeed) _plano={seed:runSeed, R:makeRng((runSeed^0x9e3779b9)>>>0), lista:[null], nb:PLANO.bonusPrimeiro, ne:PLANO.especialPrimeiro, kb:0, vezes:{}, usados:{}};
  const P=_plano, faixa=(a)=>a[0]+Math.floor(P.R()*(a[1]-a[0]+1));
  while(P.lista.length<=n && P.lista.length<=LEVEL_CAP){ const i=P.lista.length; let f;
    if(i<=5) f={tipo:HAND[i-1].type==='collect'?'bonus':'normal', var:'tradicional', idx:(i===2?1:0)};
    else if(i===P.nb){ P.kb++; const v=P.kb===1?'tradicional':(ORDEM_BONUS[P.kb-2]||Object.keys(BONUS_VAR)[Math.floor(P.R()*10)]);
      f={tipo:'bonus', var:v, idx:P.kb+1}; P.nb=i+faixa(PLANO.bonusIntervalo); if(P.nb===P.ne) P.ne++; }
    else if(i>=P.ne && (P.lista[i-1].tipo!=='especial' || i>=PLANO.especiaisSeguidasLiberadasEm)){
      let id=ORDEM_ESP.find(k=>!P.usados[k] && ESPECIAIS[k].min<=i);                  // novidade: uma de cada vez, na ordem
      if(!id){ const ok=ORDEM_ESP.filter(k=>ESPECIAIS[k].min<=i); id=ok[Math.floor(P.R()*ok.length)]; }
      P.usados[id]=1; P.vezes[id]=(P.vezes[id]||0)+1; f={tipo:'especial', id, vez:P.vezes[id]}; P.ne=i+faixa(PLANO.especialIntervalo); if(P.ne===P.nb) P.ne++; }
    else f={tipo:'normal'};
    P.lista.push(f); }
  return P.lista[Math.min(n,P.lista.length-1)]; }

// ===== [MOTORES] gera o DNA de cada nível (1-5 à mão, 6+ distorcido — muda A CADA nível) =====
function genLevel(n){
  if(n<=5){ const b=HAND[n-1];
    return Object.assign({}, b, {
      grav:GRAV, move:MOVE, fric:FRICTION, bandH:BAND_H, slot:SLOT, baseJump:BASE_JUMP,
      playerSpeed:5.6+(n-1)*0.12, playerJump:BASE_JUMP-(n-1)*0.4, maxJumps:(n>=5?3:(n>=2?2:1)),
      maxHp:3, blastCost:Math.max(14,22-(n-1)*2), stamRegen:14+(n-1)*2, collectIndex:(n===2?1:0), objetivo:(b.type==='collect'?'coletar':'apaixonar'), bonusVar:'tradicional', especial:null,
      chaserCount:0, shooterCount:0, eaterCount:0, dogCount:0, sphereCount:0, bossCount:0, spikerCount:0, beamerCount:0, tentacleCount:0, monsterHp:1, monsterScale:1, monsterSpeed:0, shooterRate:2, archCount:0, hue:null, vignette:0,
      mut:{name:(b.type==='collect'?'CAMPO DOS CORAÇÕES':'MONTANHA DO AMOR'), style:(b.type==='collect'?'clouds':'stars'), tier:-1, tags:[], distort:0, jitter:0, warp:0, gaps:0, gravMul:1, densityMul:1},
      label:'NÍVEL '+n+' de 5 · '+(b.type==='collect'?'coleta: '+b.target+' corações':'apaixone '+b.npc+' tristes') });
  }
  const d=n-5;                                  // profundidade procedural (1..)
  const dd=Math.min(d,900);
  let plano=planoFases(n); if(FORCA) plano=FORCA;
  const isCollect=plano.tipo==='bonus';
  const playerSpeed=6.1+Math.min(dd*0.03,2.6);
  const playerJump=-16.2*(1+Math.min(dd*0.006,0.4));
  const cfg={
    type: isCollect?'collect':'love',
    grav: clamp(0.62*(1+0.18*Math.sin(d*0.9)+Math.min(d*0.004,0.18)), 0.5, 0.86),
    move: MOVE, fric: FRICTION,
    bandH: clamp(70-Math.floor(dd/50)+Math.round(Math.min(dd*0.5,5)*Math.sin(d*1.3)), 58, 74),
    slot: clamp(248+Math.round(16*Math.sin(d*0.7)), 218, 274),
    baseJump: playerJump, playerSpeed, playerJump,
    maxJumps: 3,
    maxHp: Math.min(3+Math.floor(dd/10), 10),
    blastCost: Math.max(10, 18-Math.floor(dd/40)),
    stamRegen: 16+Math.min(Math.floor(dd/10),12),
    moving: Math.min(14+Math.floor(dd*0.5), 30),
    mvSpeed: Math.min(1.5+dd*0.02, 2.8),
    blocks: Math.min(7+Math.floor(dd/5), 16),
    follow: 0, npc:0, target:0,
    chaserCount:0, shooterCount:0, eaterCount:0, dogCount:0, sphereCount:0, bossCount:0, spikerCount:0, beamerCount:0, tentacleCount:0,
    monsterHp:Math.min(1+Math.floor(dd/14), 6),
    monsterScale:1.25+Math.min(dd*0.022, 1.7),
    monsterSpeed:Math.min(2.1+dd*0.035, playerSpeed*0.66),
    shooterRate:clamp(2.0-dd*0.014, 0.22, 2.0),
    archCount:Math.min(2+Math.floor(dd*0.7), 26),
    vignette:Math.min(dd*0.01,0.5),
  };
  if(isCollect){ cfg.collectIndex=plano.idx||2; cfg.target=clamp(10+(cfg.collectIndex-1)*2, 10, 28); }
  else { cfg.npc=Math.min(22+Math.floor(dd*0.6), 36);
    cfg.follow=Math.min(3.0+dd*0.04, playerSpeed*0.7);
    if(d>=1)  cfg.chaserCount  = Math.min(1+Math.floor(d/3), 8);
    if(d>=4)  cfg.shooterCount = Math.min(1+Math.floor((d-4)/6), 5);
    if(d>=10) cfg.eaterCount   = Math.min(1+Math.floor((d-10)/9), 3);
    if(d>=7)  cfg.dogCount     = Math.min(1+Math.floor((d-7)/7), 4);
    if(d>=13) cfg.sphereCount  = Math.min(1+Math.floor((d-13)/8), 3);
    if(d>=19) cfg.spikerCount  = Math.min(1+Math.floor((d-19)/10), 2);
    if(d>=22) cfg.beamerCount  = Math.min(1+Math.floor((d-22)/10), 2);
    if(d>=16) cfg.tentacleCount= Math.min(1+Math.floor((d-16)/12), 2);
    if(d>=12) cfg.moverCount   = Math.min(1+Math.floor((d-12)/12), 3);
    if(d>=9)  cfg.tristCount   = Math.min(1+Math.floor((d-9)/15), 2);    // TRISTONHO: deixa apaixonados tristes de novo
    if(d>=13) cfg.camaCount    = Math.min(1+Math.floor((d-13)/12), 3);   // CAMALEÃO: quase invisível
    if(d>=17) cfg.diviCount    = Math.min(1+Math.floor((d-17)/12), 3);   // DIVISOR: vira dois
    if(d>=21) cfg.piscCount    = Math.min(1+Math.floor((d-21)/12), 2);   // PISCA-PISCA: teleporta perto de você   // ARQUITETO: muda plataformas de lugar de propósito
    if(d>=19) cfg.gelCount     = Math.min(1+Math.floor((d-19)/12), 2);   // GELADOR: congela as plataformas perto
    if(d>=22) cfg.rachCount    = Math.min(1+Math.floor((d-22)/12), 2);   // RACHADOR: pisa forte e as plataformas perto caem
    if(d>=25) cfg.sombCount    = Math.min(1+Math.floor((d-25)/14), 2);   // SOMBRIO: apaga a luz em volta dele
    if(n>=20 && n%20===0) cfg.bossCount = 1;
  }
  const mut=director(n);                                                 // MINI-AI: muda as regras deste nível
  cfg.mut=mut; cfg.hue=mut.hue;
  if(mut.acel){ cfg.monsterSpeed*=1.3; cfg.mvSpeed*=1.3; cfg.follow*=1.2; }   // mundo acelerado
  cfg.vignette=clamp(cfg.vignette + mut.distort*0.12, 0, 0.6);
  cfg.grav=clamp(cfg.grav*mut.gravMul, 0.42, 1.05);
  cfg.baseJump=cfg.playerJump=playerJump*Math.sqrt(mut.gravMul);         // compensa o pulo p/ manter o alcance (vencível)
  cfg.plano=plano; cfg.bonusVar=isCollect?(plano.var||'tradicional'):null;
  cfg.especial=(plano.tipo==='especial'&&ESPECIAIS[plano.id])?Object.assign({id:plano.id,nivel:Math.min(4,plano.vez||1)},ESPECIAIS[plano.id]):null;
  cfg.objetivo=isCollect?'coletar':(cfg.especial?cfg.especial.obj:'apaixonar');
  if(cfg.especial){ const E=cfg.especial, f=[0.4,0.6,0.85,1][E.nivel-1];             // 1ª vez = aprender (menos inimigos); depois combina
    for(const k of ['chaserCount','shooterCount','eaterCount','dogCount','sphereCount','spikerCount','beamerCount','tentacleCount','moverCount','tristCount','camaCount','diviCount','piscCount','gelCount','rachCount','sombCount']) if(cfg[k]) cfg[k]=Math.floor(cfg[k]*f);
    cfg.bossCount=0;
    if(E.id==='gravLeve'){ cfg.grav*=0.62; cfg.baseJump=cfg.playerJump=cfg.playerJump*0.86; }
    if(E.id==='gelo') mut.ice=true;
    if(E.id==='escuridao') mut.fog=true;
    if(E.obj==='resgate'){ cfg.npc=clamp(8+E.nivel*3,8,20); cfg.blocks=Math.max(cfg.blocks,Math.ceil(cfg.npc/2)+2); }
    if(E.obj==='saida'||E.obj==='topo') cfg.npc=Math.min(cfg.npc,14); }
  if(cfg.bonusVar==='escura') mut.fog=true;
  if(cfg.bonusVar==='moveis') cfg.moving=Math.min(cfg.moving*2,40);
  cfg.label='NÍVEL '+n+' · '+(cfg.especial?('⭐ '+cfg.especial.nome):(isCollect?('BÔNUS · '+BONUS_VAR[cfg.bonusVar].nome):mut.name));
  return cfg;
}
// ===== DIRETOR (mini-AI): escolhe a SALA + muda as REGRAS por nível (estilo Backrooms) =====
// 4 camadas de estranheza: 0 = lembranças quase normais, 1 = o espaço começa a dobrar,
// 2 = abstrato, 3 = puro abstrato. Mais fundo = mais regras estranhas ao mesmo tempo.
const DIR_THEMES=[
  [ {name:'SALA AMARELA',hue:50,style:'wallpaper'}, {name:'ESCRITÓRIO VAZIO',hue:38,style:'office'}, {name:'PISCINA INFINITA',hue:190,style:'tiles'},
    {name:'CORREDOR DE HOTEL',hue:12,style:'hallway'}, {name:'GARAGEM ESCURA',hue:215,style:'garage'} ],
  [ {name:'ESCADA SEM FIM',hue:28,style:'stairs'}, {name:'SALA QUE RESPIRA',hue:330,style:'breath'}, {name:'BIBLIOTECA DE LIVROS EM BRANCO',hue:32,style:'shelves'},
    {name:'LAVANDERIA DAS MEIAS PERDIDAS',hue:200,style:'tiles'}, {name:'JARDIM DE PLÁSTICO',hue:120,style:'grass'} ],
  [ {name:'GRADE DO ESQUECIMENTO',hue:290,style:'grid'}, {name:'PAREDE QUE OLHA',hue:350,style:'eyes'}, {name:'CÉU DE CABEÇA PRA BAIXO',hue:250,style:'invsky'},
    {name:'SALA DE ESPELHOS',hue:180,style:'mirror'} ],
  [ {name:'O VAZIO EM FORMA DE CORAÇÃO',hue:330,style:'void'}, {name:'ESTÁTICA',hue:0,style:'static'}, {name:'GEOMETRIA QUE SENTE',hue:270,style:'geom'},
    {name:'O FIM DO MAPA',hue:160,style:'dots'} ]
];
// regras estranhas (mutadores): profundidade mínima e texto da explicação (aparece na 1ª vez)
const MUTATORS={
  'gravidade leve':   {min:1,  icon:'🎈', txt:'Você cai mais devagar e o pulo flutua.'},
  'gravidade pesada': {min:1,  icon:'🪨', txt:'Tudo pesa mais: o pulo é mais curto e rápido.'},
  'vazio':            {min:1,  icon:'🕳️', txt:'Menos plataformas nesta sala.'},
  'névoa':            {min:4,  icon:'🌫️', txt:'Você só enxerga bem perto de você. Siga as setas na borda.'},
  'luz piscando':     {min:8,  icon:'💡', txt:'As lâmpadas apagam de vez em quando. Calma: dura um instante.'},
  'chão de sabão':    {min:10, icon:'🧼', txt:'Escorrega! Você demora pra parar e pra virar.'},
  'eco':              {min:12, icon:'👥', txt:'Seu passado te segue como sombra. Só enfeite: não machuca.'},
  'plataformas que piscam': {min:16, icon:'⏳', txt:'Algumas plataformas somem por 1 s (elas tremem antes). A escada principal nunca some.'},
  'buracos':          {min:18, icon:'🧩', txt:'Faltam pedaços lá no alto.'},
  'mundo dá a volta': {min:14, icon:'🔁', txt:'Saiu por um lado, entra pelo outro.'},
  'sala respira':     {min:20, icon:'🫁', txt:'A sala aproxima e afasta devagar.'},
  'câmera torta':     {min:25, icon:'🌀', txt:'O mundo balança de leve. Os controles continuam iguais.'},
  'mundo acelerado':  {min:16, icon:'⏩', txt:'Tudo anda mais rápido: monstros, apaixonados e plataformas.'},
  'cores invertidas': {min:30, icon:'🎭', txt:'As cores viraram do avesso.'},
};
function director(n){
  const rng=makeRng((seedFor(n)^0x5bd1e995)>>>0); const d=Math.max(0,n-5);
  let tier=d<=15?0:(d<=35?1:(d<=65?2:3));
  if(tier>0 && rng()<0.18) tier--;                                      // às vezes "lembra" de uma sala mais antiga
  const list=DIR_THEMES[tier], theme=list[(n*7+Math.floor(rng()*list.length))%list.length];
  const distort=clamp(d/45,0,1);
  const mut={ name:theme.name, hue:theme.hue, style:theme.style, tier, distort, jitter:0, warp:0, gravMul:1, densityMul:1, gaps:0, tags:[] };
  const add=t=>{ if(mut.tags.indexOf(t)<0) mut.tags.push(t); };
  if(rng()<0.42){ mut.gravMul=0.78+rng()*0.5; add(mut.gravMul<1?'gravidade leve':'gravidade pesada'); }
  if(rng()<0.5){ mut.densityMul=0.82+rng()*0.34; if(mut.densityMul<0.97) add('vazio'); }
  mut.jitter=distort*(0.4+rng()*0.6);
  mut.warp=distort*(0.4+rng()*0.6);
  // regras extras: quanto mais fundo, mais regras ao mesmo tempo
  const extras=['névoa','luz piscando','chão de sabão','eco','plataformas que piscam','buracos','mundo dá a volta','sala respira','câmera torta','cores invertidas','mundo acelerado'];
  const maxExtra=Math.min(Math.floor((d+6)/14), 5);                     // nível 6-7: nenhuma; depois sobe devagar
  let tries=0, got=0;
  while(got<maxExtra && tries++<24){ const t=extras[Math.floor(rng()*extras.length)];
    if(d<MUTATORS[t].min || mut.tags.indexOf(t)>=0) continue; if(rng()<0.45){ add(t); got++; } }
  if(theme.style==='breath') add('sala respira');
  if(mut.tags.indexOf('buracos')>=0) mut.gaps=0.08+distort*0.18;
  mut.fog=mut.tags.indexOf('névoa')>=0; mut.flicker=mut.tags.indexOf('luz piscando')>=0; mut.ice=mut.tags.indexOf('chão de sabão')>=0;
  mut.echo=mut.tags.indexOf('eco')>=0; mut.blink=mut.tags.indexOf('plataformas que piscam')>=0; mut.wrap=mut.tags.indexOf('mundo dá a volta')>=0;
  mut.acel=mut.tags.indexOf('mundo acelerado')>=0;
  mut.breathe=mut.tags.indexOf('sala respira')>=0; mut.tilt=mut.tags.indexOf('câmera torta')>=0; mut.invert=mut.tags.indexOf('cores invertidas')>=0;
  return mut;
}

let level=1, explodedCount=0, totalSad0=0;
let mode='adventure', lives=3, deaths=0, deepest=1;
let WORLD_W=0, WORLD_H=0, groundY=0, cfg=null, PAL=PAL_NIGHT, VIGN=0, M={tags:[]};
let player, npcs, monsters, shots, loveShots, waves, lasers, loveRain, divineFx, elecRays, beams, spikesW, stickies, platforms, blasts, particles, ambient, walls, fhearts, pHearts, blocks, rock, carrying, echoes;
let _domShown=false, _divShown=false, phantomT=0, levelToken=0;
let dominio=null, lentoT=0, meta=null, subida=null, ventos=[], batida=null, enfeites=[], luzT=0, ultimaExplosao=null, escuro=false, FORCA=null, ouro=null, tristeT=0, portas=[], toastT=0, toastTxt='', toastCol='#fff', avisoMonstros=false, explodidos=0;   // portas do nada, avisos na tela, quem explodiu de amor
// paleta 'pastel' do CIS (CIS - Clone Imagem Site\paleta_area.py, PRESETS['pastel']) — deixa as fases mais fofas
const PASTEL=['#ffd6e0','#c3f0ca','#cde7ff','#fff1c1'];
function toast(txt,seg,col){ toastTxt=txt; toastT=seg||2.6; toastCol=col||'#ff8fab'; drawDirty=true; }
let seen={};                                           // o que o jogador já viu explicado (salvo no aparelho)
let briefedLevels={};
let aiLearn={vx:0,jr:0};
let camX=0, camY=0, camPX=0, camPY=0, lookX=0, shake=0, state='end', time=0, rainTimer=0, pendingReset=false;
let runSeed=(Date.now()^(Math.random()*1e9))>>>0;
let RNG=Math.random;
const keys={left:false,right:false,jump:false,charge:false};

function makeRng(seed){ let a=seed>>>0; return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function seedFor(n){ let h=(runSeed^Math.imul(n,2654435761))>>>0; h=Math.imul(h^(h>>>15),2246822507); h=Math.imul(h^(h>>>13),3266489909); return (h^(h>>>16))>>>0; }
const rand=(a,b)=>a+RNG()*(b-a);
function clamp(v,a,b){return v<a?a:(v>b?b:v);}
// ===== ponte com o GRAFO DE EXPERIÊNCIA (grafo_experiencia.js). Só observa: erro ou ausência nunca param o jogo =====
function G(fn,a,b,c,d){ try{ const g=globalThis.AE_GRAFO; if(g&&typeof g[fn]==='function') return g[fn](a,b,c,d); }catch(e){} return null; }
// ===== [IA] APRENDIZADO DE MÁQUINA PRÓPRIO DO JOGO (fica salvo no aparelho; não é o formato do Nerael) =====
// - Monstros escolhem ESTRATÉGIAS por tentativa e erro (bandido multi-braço ε-guloso): direto, cercar, emboscar, cautela.
//   Estratégia que te machuca ganha valor; a que leva o monstro a morrer perde. Com o tempo eles repetem o que funciona.
// - O jogo aprende seus HÁBITOS (média móvel): se você costuma pular quando um monstro chega, e de que distância você explode.
// - "Nível de IA" cresce com o tempo de jogo: tristes começam a fugir da explosão e pular entre plataformas.
const IA=(function(){ const K='amorExplosivo_ia_v1';
  let d={xp:0,V:{direto:0.3,cercar:0.3,emboscar:0.3,cautela:0.3},N:{direto:1,cercar:1,emboscar:1,cautela:1},pulaFuga:0.5,distExplode:150};
  try{ if(typeof localStorage!=='undefined'){ const s=localStorage.getItem(K); if(s){ const o=JSON.parse(s); if(o&&o.V&&o.N) d=Object.assign(d,o); } } }catch(e){}
  let tSalva=0;
  const API={ dados:d,
    nivel(){ return clamp(Math.log2(1+d.xp/90),0,6); },
    escolher(){ const ks=Object.keys(d.V), eps=Math.max(0.08,0.4-API.nivel()*0.05);
      if(Math.random()<eps) return ks[Math.floor(Math.random()*ks.length)]; return ks.reduce((a,b)=>d.V[b]>d.V[a]?b:a); },
    premio(mo,r){ if(!mo||!mo.estr||!(mo.estr in d.V)) return; const s=mo.estr; d.N[s]=(d.N[s]||1)+1; d.V[s]+=(r-d.V[s])/Math.min(d.N[s],60); },
    habito(nome,valor,taxa){ if(typeof d[nome]!=='number'||!isFinite(valor)) return; const a=taxa||0.05; d[nome]=d[nome]*(1-a)+valor*a; },
    tick(dt){ d.xp+=dt; tSalva+=dt; if(tSalva>20){ tSalva=0; API.salvar(); } },
    salvar(){ try{ if(typeof localStorage!=='undefined') localStorage.setItem(K,JSON.stringify(d)); }catch(e){} },
    melhor(){ const ks=Object.keys(d.V), b=ks.reduce((a,c)=>d.V[c]>d.V[a]?c:a); return {nome:b, valor:d.V[b]}; } };
  return API; })();
const OPC=(()=>{ try{ const s=typeof localStorage!=='undefined'?localStorage.getItem('amorExplosivo_opcoes'):null; const o=s?JSON.parse(s):{}; return {reduz:!!(o&&o.reduz)}; }catch(e){ return {reduz:false}; } })();   // acessibilidade
function salvaOPC(){ try{ localStorage.setItem('amorExplosivo_opcoes',JSON.stringify(OPC)); }catch(e){} }
const ICON_PERSO={romantico:'😍',carente:'🥺',ciumento:'😠',timido:'😳',impulsivo:'🤪',calculista:'🧐'};
const NOME_FONTE={gelador:'gelador',rachador:'rachador',sombrio:'sombrio',tristonho:'tristonho',camaleao:'camaleão',divisor:'divisor',piscador:'pisca-pisca',arquiteto:'arquiteto',chaser:'perseguidor',shooter:'atirador',eater:'comilão',dog:'cão sombrio',sphere:'esfera chorona',spiker:'espinhos',beamer:'feixe',tentacle:'tentáculo',boss:'chefe gigante'};
const dist=(ax,ay,bx,by)=>Math.hypot(ax-bx,ay-by);
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(RNG()*(i+1)); const t=a[i];a[i]=a[j];a[j]=t; } return a; }
function heartPath(c,x,y,s){const t=s*0.3;c.beginPath();c.moveTo(x,y+t);
  c.bezierCurveTo(x,y,x-s/2,y,x-s/2,y+t);c.bezierCurveTo(x-s/2,y+(s+t)/2,x,y+(s+t)/1.35,x,y+s);
  c.bezierCurveTo(x,y+(s+t)/1.35,x+s/2,y+(s+t)/2,x+s/2,y+t);c.bezierCurveTo(x+s/2,y,x,y,x,y+t);c.closePath();}
function roundRect(c,x,y,w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);
  c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function srng(s){s>>>=0;return function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function starPath(c,cx,cy,r,p){c.beginPath();for(let i=0;i<p*2;i++){const a=Math.PI*i/p-Math.PI/2,rr=i%2?r*0.45:r;c.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);}c.closePath();}
function polyPath(c,cx,cy,r,sides,rot,jit,R){c.beginPath();for(let i=0;i<sides;i++){const a=rot+Math.PI*2*i/sides,rr=r*(1+(R?(R()-0.5)*jit:0));const x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();}
function blobPath(c,cx,cy,r,R,lump){const N=8;c.beginPath();for(let i=0;i<N;i++){const a=Math.PI*2*i/N,rr=r*(1+(R()-0.5)*(lump||0.5));const x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();}
function ghostPath(c,cx,cy,r){c.beginPath();c.arc(cx,cy-r*0.1,r,Math.PI,0);const b=cy+r*0.9;c.lineTo(cx+r,b);for(let i=0;i<4;i++){const x=cx+r-(i+0.5)*(2*r/4);c.quadraticCurveTo(x+r/8,b+r*0.18,x,b);}c.lineTo(cx-r,cy-r*0.1);c.closePath();}
function hShape(c,cx,cy,s,vs,R){
  if(vs==='ghost') ghostPath(c,cx,cy+s*0.4,s*0.5);
  else if(vs==='star') starPath(c,cx,cy+s*0.4,s*0.58,5);
  else if(vs==='diamond') polyPath(c,cx,cy+s*0.4,s*0.52,4,0,0,null);
  else if(vs==='blob') blobPath(c,cx,cy+s*0.4,s*0.52,R,0.55);
  else if(vs==='gem') polyPath(c,cx,cy+s*0.4,s*0.52,6,0.3,0.15,R);
  else heartPath(c,cx,cy,s);
}

function effMoveMax(){ return player.moveMaxBase * (1 + Math.min(player.conv*CONV_SPEED, CONV_SPEED_CAP)); }
function effJump(){ return player.jumpBase * (1 + Math.min(player.conv*CONV_JUMP, CONV_JUMP_CAP)); }
function blastMaxR(ch){ return 90 + ch*150 + Math.min((level-1)*5, 150); }

function computeReachable(){
  // Quais barras dá pra alcançar partindo do chão (band 0), pulo a pulo. Indexado por faixa de altura.
  const ps=platforms, reach=new Array(ps.length).fill(false);
  const VRE=JUMP_Hc+8, HRE=64, B=Math.max(40,Math.ceil(VRE));
  for(let i=0;i<ps.length;i++) if(ps[i].band===0) reach[i]=true;
  const reachByBand={};
  const add=(idx)=>{ const b=(ps[idx].y/B)|0; (reachByBand[b]||(reachByBand[b]=[])).push(idx); };
  for(let i=0;i<ps.length;i++) if(reach[i]) add(i);
  let ch=true;
  while(ch){ ch=false;
    for(let i=0;i<ps.length;i++){ if(reach[i])continue; const p=ps[i]; const pb=(p.y/B)|0;
      let ok=false;
      for(let bb=pb-1; bb<=pb+1 && !ok; bb++){ const list=reachByBand[bb]; if(!list)continue;
        for(const j of list){ const q=ps[j]; const v=q.y-p.y;
          if(v>0&&v<=VRE){ const eg=(p.x<q.x+q.w&&p.x+p.w>q.x)?0:(p.x>q.x?p.x-(q.x+q.w):q.x-(p.x+p.w));
            if(eg<=HRE){ ok=true; break; } } } }
      if(ok){ reach[i]=true; add(i); ch=true; } } }
  return reach;
}

// ===== som (com limite: no máximo 5 bipes por quadro, pra não engasgar o celular) =====
let actx=null, beepsThisFrame=0;
function beep(f,d,t,v){ if(beepsThisFrame>=3) return; beepsThisFrame++;
  try{ if(!actx)actx=new (window.AudioContext||window.webkitAudioContext)();
  const o=actx.createOscillator(),g=actx.createGain(); o.type=t||'sine'; o.frequency.value=f; g.gain.value=v||0.06;
  o.connect(g);g.connect(actx.destination);o.start();
  g.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+(d||0.15));o.stop(actx.currentTime+(d||0.15));}catch(e){}}
function later(ms,fn){ const tok=levelToken; setTimeout(()=>{ if(tok===levelToken) fn(); },ms); }   // atraso que morre ao trocar de fase

// ===== [RENDER] qualidade automática: se o aparelho engasga, baixa a resolução e as partículas =====
const Q={ tier:2, partCap:220, ema:16, work:4, slowN:0, fastN:0 };
if(typeof window!=='undefined' && window.__FRACO){ Q.tier=1; Q.partCap=140; }   // aparelho fraco (pouca memória/núcleos): já começa no modo leve
function dprForTier(){ const dev=window.devicePixelRatio||1; return Math.min(dev, [0.75,1.15,MOBILE?1.6:2][Q.tier]); }
function qualityTick(interval, work){
  if(interval>0 && interval<100){ Q.ema=Q.ema*0.95+interval*0.05; }
  Q.work=Q.work*0.95+work*0.05;
  const slow = Q.work>11 || (Q.ema>24 && Q.work>6);
  if(slow){ if(++Q.slowN>80){ Q.slowN=0; Q.fastN=0; if(Q.tier>0){ Q.tier--; applyQuality(); } } } else Q.slowN=Math.max(0,Q.slowN-1);
  if(Q.work<4 && Q.ema<18){ if(++Q.fastN>900){ Q.fastN=0; if(Q.tier<2){ Q.tier++; applyQuality(); } } } else Q.fastN=0;
}
function applyQuality(){ Q.partCap=[70,140,220][Q.tier]; resize(true); }

let SPR=new Map(), SPR_E=1;
function mkCanvas(w,h){ const c=document.createElement('canvas'); c.width=Math.max(1,Math.ceil(w)); c.height=Math.max(1,Math.ceil(h)); return c; }
function bake(w,h,ax,ay,paint,maxPx){ let rs=RS; const m=Math.max(w,h)*rs; if(maxPx && m>maxPx) rs*=maxPx/m;
  const c=mkCanvas(w*rs,h*rs), g=c.getContext('2d'); if(g.setTransform) g.setTransform(rs,0,0,rs,0,0); paint(g);
  c._w=w; c._h=h; c._ax=ax; c._ay=ay; c._e=SPR_E; return c; }
function cacheGet(k,make){ let c=SPR.get(k); if(!c){ if(SPR.size>700) SPR.clear(); c=make(); SPR.set(k,c); } return c; }
function drawSpr(c,x,y){ ctx.drawImage(c, x-c._ax, y-c._ay, c._w, c._h); }
// coração pronto (com ou sem brilho) — usado por partículas, tiros, chuva, paredes etc.
function heartSpr(col,size,glow){ const s=Math.max(4,Math.round(size/3)*3);
  return cacheGet('h|'+col+'|'+s+'|'+(glow?1:0), ()=>{ const pad=glow?Math.ceil(s*0.5):2;
    return bake(s+pad*2, s+pad*2, pad+s/2, pad, g=>{ if(glow){ g.shadowColor=col; g.shadowBlur=s*0.35; }
      g.fillStyle=col; heartPath(g,pad+s/2,pad,s); g.fill();
      if(glow){ g.shadowBlur=0; g.strokeStyle='rgba(255,255,255,.55)'; g.lineWidth=Math.max(1.5,s*0.06); heartPath(g,pad+s/2,pad,s); g.stroke(); } }); }); }
function drawHeart(x,y,size,col,glow){ const sp=heartSpr(col,size,glow), k=size/(Math.max(4,Math.round(size/3)*3));
  ctx.drawImage(sp, x-sp._ax*k, y-sp._ay*k, sp._w*k, sp._h*k); }
function glowSpr(col){ return cacheGet('g|'+col, ()=>bake(128,128,64,64,g=>{ const gr=g.createRadialGradient(64,64,4,64,64,64);
  gr.addColorStop(0,col); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,0,128,128); },160)); }
function drawGlow(col,x,y,r,a){ const sp=glowSpr(col); ctx.globalAlpha=a; ctx.drawImage(sp,x-r,y-r,r*2,r*2); ctx.globalAlpha=1; }

function resize(force){
  const nW=cv.clientWidth||window.innerWidth||1280, nH=cv.clientHeight||window.innerHeight||720, nD=dprForTier();
  if(!force && nW===SCRW && nH===SCRH && nD===DPR) return;          // nada mudou: não refaz caches (o celular manda muito resize)
  SCRW=nW; SCRH=nH; DPR=nD;
  ZOOM=clamp(SCRH/VIEW_H, 0.3, 1.5);
  W=SCRW/ZOOM; H=SCRH/ZOOM;
  RS=ZOOM*DPR;
  cv.width=Math.floor(SCRW*DPR); cv.height=Math.floor(SCRH*DPR);
  SPR.clear(); SPR_E++; BD=null; FOG=null; VIG=null;
  if(platforms) buildBackdrop();
  drawDirty=true;
}
function checkOrient(){ try{ const portrait = window.innerHeight > window.innerWidth; if(document.body) document.body.classList.toggle('portrait', !!portrait); }catch(e){} }
window.addEventListener('resize', ()=>{ checkOrient(); resize(); });
window.addEventListener('orientationchange', ()=>{ setTimeout(()=>{ checkOrient(); resize(); },120); setTimeout(()=>{ checkOrient(); resize(); },350); });
try{ if(window.visualViewport){ window.visualViewport.addEventListener('resize', ()=>{ checkOrient(); resize(); }); } }catch(e){}
checkOrient();

// ===== [PERSONAGENS] tristes (NPC azul), jogador, monstros e corações-NPC =====
function sadDeform(){
  const d=Math.max(0,level-5);
  if(level<=5 || RNG()>clamp(d*0.05,0,0.9)) return {shape:'normal',scale:1,legs:false,fast:false,bug:false,seed:(RNG()*1e9)|0};
  const r=RNG(); const def={shape:'normal',scale:1,legs:false,fast:false,bug:false};
  if(r<0.22) def.shape='square';
  else if(r<0.42) { def.shape='tall'; }
  else if(r<0.60) { def.shape='wide'; }
  else if(r<0.74) { def.shape='giant'; def.scale=1.6+Math.min(d*0.02,1.2); }
  else if(r<0.88) { def.legs=true; }
  else { def.shape='square'; def.scale=1.3; }
  if(RNG()<0.35) def.fast=true;
  if(RNG()<0.35) def.bug=true;
  const a=RNG(); if(a<0.20) def.melt=true; else if(a<0.36) def.blob=true; else if(a<0.50) def.eyes=2+Math.floor(RNG()*3);
  def.twin = RNG()<0.10; def.seed=(RNG()*1e9)|0; def.rot=(RNG()-0.5)*clamp(d*0.04,0,0.6);
  return def;
}
function mkSad(x,y){ const def=sadDeform(); let w=30,h=44; const s=def.scale;
  if(def.shape==='square'){ w=40*s; h=40*s; }
  else if(def.shape==='tall'){ w=26*s; h=66*s; }
  else if(def.shape==='wide'){ w=54*s; h=34*s; }
  else if(def.shape==='giant'){ w=30*s; h=44*s; }
  return { x, y:y-(h-44), vx:0, vy:0, w, h, onGround:false, platRef:null, state:'sad', def, bugT:rand(0.5,2.5), legPhase:rand(0,6.28),
  dir:RNG()<.5?-1:1, wander:rand(40,160), grace:0, freezeT:0, bob:rand(0,6.28),
  phone:RNG()<0.55 && def.shape==='normal', stuck:false, shake:0, heartTrail:0, holding:false }; }
function mkMonster(x,y,kind){ kind=kind||'chaser';
  let sc=cfg.monsterScale*(kind==='eater'?1.2:(kind==='shooter'?1.05:1));
  if(kind==='dog') sc*=0.8; if(kind==='boss') sc*=8;
  let hp=cfg.monsterHp; if(kind==='boss') hp=cfg.monsterHp*12; if(kind==='sphere') hp=cfg.monsterHp+1; if(kind==='tentacle') hp=cfg.monsterHp+1;
  let sp=cfg.monsterSpeed*(kind==='shooter'?0.45:1); if(kind==='dog') sp=cfg.monsterSpeed*1.7; if(kind==='boss') sp=cfg.monsterSpeed*0.5; if(kind==='sphere') sp=cfg.monsterSpeed*0.45; if(kind==='spiker') sp=cfg.monsterSpeed*0.4; if(kind==='beamer') sp=cfg.monsterSpeed*0.32; if(kind==='tentacle') sp=0; if(kind==='arquiteto') sp=cfg.monsterSpeed*0.6; if(kind==='tristonho') sp=cfg.monsterSpeed*0.5; if(kind==='camaleao') sp=cfg.monsterSpeed*0.9; if(kind==='piscador') sp=cfg.monsterSpeed*0.4; if(kind==='divisor') hp=cfg.monsterHp+1; if(kind==='gelador') sp=cfg.monsterSpeed*0.7; if(kind==='rachador'){ sp=cfg.monsterSpeed*0.55; hp=cfg.monsterHp+1; } if(kind==='sombrio') sp=cfg.monsterSpeed*0.8;
  let w=30*sc, h=42*sc; if(kind==='tentacle'){ w=44*cfg.monsterScale; h=130*cfg.monsterScale; }
  if(kind!=='boss'&&kind!=='tentacle'){ const sv=0.82+RNG()*0.55; w*=sv; h*=sv; }
  const dd2=Math.max(0,level-5);
  return { x,y, w, h, vx:0, vy:0, onGround:false, platRef:null, kind,
  hp, maxHp:hp, sp, hitT:0, float:(kind==='sphere'), grabCD:rand(0.5,1.6),
  arms:Math.min(2+Math.floor(dd2/15),5), sway:rand(0,6.28),
  fireT:rand(0.4,cfg.shooterRate||2), beamCD:rand(2.5,4.5), spikeCD:rand(2.5,4), stickyCD:rand(3,6), phantomCD:rand(7,11), moveCD:rand(2.5,4.5), beam:null, ringCD:rand(4,6), ringT:0, blinkCD:rand(3,5), visT:0, alvoP:null, estr:null, estrT:0, domCD:rand(6,10), stun:0, geloCD:rand(3,5), pisaCD:rand(4,6), pisaT:0,
  bob:rand(0,6.28), eye:rand(0,6.28), grow:0, seed:(RNG()*1e9)|0, twin:(kind!=='boss'&&kind!=='tentacle'&&RNG()<0.12) }; }
const HEART_POOL=['fast','ghost','tough','crybaby','solid','snake','splitter','eater','saltador','dorminhoco','camaleao','imitador','teleporte','rei'];
function heartKind(){ if(cfg.type!=='collect') return 'normal';
  if(cfg.bonusVar==='fantasmas' && RNG()<0.7) return 'ghost';
  const ci=cfg.collectIndex||1;
  const chance = ci<=1 ? 0 : clamp((ci-1)*0.10, 0, 0.7);
  if(RNG()>chance) return 'normal';
  const k=Math.min(HEART_POOL.length, 1+Math.floor(ci*1.5));
  return HEART_POOL[Math.floor(RNG()*k)]; }
const HEART_PERSONA={
  fast:    {outfit:1, col:'#ffd166', shape:'heart'},   // óculos escuros (corredor)
  ghost:   {outfit:-1,col:'#cfe8ff', shape:'ghost'},   // fantasma translúcido
  tough:   {outfit:4, col:'#9aa7c7', shape:'heart'},   // boné (durão: 2 toques)
  crybaby: {outfit:-1,col:'#7fc8ff', shape:'heart'},   // chorão
  solid:   {outfit:2, col:'#b0b8cc', shape:'diamond'}, // gravata-borboleta (pesadão: empurra)
  snake:   {outfit:0, col:'#37b24d', shape:'heart'},   // cartola (sequestrador)
  splitter:{outfit:5, col:'#ff7b00', shape:'gem'},     // coroa (vira 2)
  eater:   {outfit:3, col:'#7a2e6b', shape:'blob'},    // cachecol (comilão: vale 2)
  saltador:{outfit:-1,col:'#a0e85b', shape:'heart'},   // pula MUITO alto quando você chega na plataforma dele
  dorminhoco:{outfit:4,col:'#b8a1ff', shape:'heart'},  // dorme até você chegar perto ou explodir
  camaleao:{outfit:-1,col:'#7dffb0', shape:'blob'},    // some quando fica parado
  imitador:{outfit:1, col:'#ffb3d1', shape:'star'},    // pula quando você pula
  teleporte:{outfit:-1,col:'#c77dff', shape:'diamond'},// some e aparece em outra plataforma (avisa antes)
  rei:     {outfit:5, col:'#ffd166', shape:'heart'},   // grandão, lento, os outros fogem com ele (vale 3)
};
function spawnHeart(x,y,falling,forceType){ const big=(cfg.type==='collect'); const s=big?rand(34,82):rand(16,24);
  const type=forceType||heartKind();
  const persona=big?HEART_PERSONA[type]:null;
  const hsx=big&&RNG()<0.4?0.72+RNG()*0.7:1, hsy=big&&RNG()<0.4?0.72+RNG()*0.7:1;
  const outfit = persona ? persona.outfit : (big?Math.floor(rand(0,6)):-1);
  const col = persona ? persona.col : HEART_COLORS[Math.floor(rand(0,HEART_COLORS.length))];
  const vshape = persona ? persona.shape : ((big&&RNG()<0.5)?['ghost','star','diamond','blob','gem'][Math.floor(RNG()*5)]:'heart');
  const h={ x,y, w:s*0.95,h:s*0.95, vx:0, vy: falling?rand(1.2,2.4):0, s, hsx, hsy,
  col, sw:rand(0,6.28), rest:!falling, big,
  type, hp:(type==='tough'?2:1), fleeT:0, wob:rand(0,6.28),
  outfit, wT:rand(0.3,1.4), wdir:(RNG()<.5?-1:1),
  seed:(RNG()*1e9)|0, vshape, vtwin:(big&&!persona&&RNG()<0.12) }; if(type==='rei'){ h.s*=1.5; h.w*=1.5; h.h*=1.5; } fhearts.push(h); return h; }
function spawnHeartScattered(forceType){
  let x,y;
  const alc=platforms.filter(q=>q.alc!==false&&q.band!==99);
  if(alc.length && RNG()<0.7){ const p=alc[Math.floor(rand(0,alc.length))]; x=clamp(p.x+rand(0,Math.max(2,p.w-40)),20,WORLD_W-60); y=p.y-62; }
  else { x=rand(60,WORLD_W-60); y=rand(groundY-260,groundY-110); }   // no ar: perto do chão (nunca cai numa plataforma fora do alcance)
  const h=spawnHeart(x,y,false,forceType); h.rest=false; return h; }
function spawnPHeart(x,y){ const w=50,h=58; pHearts.push({ x:clamp(x-w/2,2,WORLD_W-w-2), y:y-h, w, h,
  vy:rand(-2,1), col:HEART_COLORS[Math.floor(rand(0,HEART_COLORS.length))], sw:rand(0,6.28), rest:false }); }
function fireBlackHeart(mo){ const px=player.x+player.w/2, py=player.y+player.h/2, mx=mo.x+mo.w/2, my=mo.y+mo.h*0.4;
  const sp=4.6+Math.min(level*0.02,4), tt=Math.hypot(px-mx,py-my)/sp, a=Math.atan2(py+Math.min(player.vy,6)*tt*0.3-my, px+player.vx*tt*0.6-mx);   // mira onde você VAI estar
  shots.push({x:mx,y:my,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0,maxLife:3.2,sw:rand(0,6.28)});
  beep(140,0.12,'sawtooth',0.05); }

function startLevel(n){ level=clamp(n|0,1,LEVEL_CAP); if(level===1) explodedCount=0;
  try{ if(!actx)actx=new (window.AudioContext||window.webkitAudioContext)(); if(actx&&actx.state==='suspended')actx.resume(); }catch(e){}
  keys.charge=false;
  buildLevel(level); saveProgress();
  G('inicioFase',{fase:level,tipo:cfg.type,sala:M.name||'',regras:M.tags||[],monstros:monsters.map(m=>NOME_FONTE[m.kind]||m.kind),modo:mode,poderes:player.powers.slice()});
  if(globalThis.__SKIP_INTRO || briefedLevels[level]){ hideOverlay(); state='play';
    if(cfg.especial) toast(cfg.especial.icon+' '+cfg.especial.curta,3); else if(cfg.type==='collect') toast('💕 '+BONUS_VAR[cfg.bonusVar||'tradicional'].txt,3); }   // aviso curto nas repetições
  else { briefedLevels[level]=true; showBriefing(level); }
}

function buildLevel(n){
  resize();
  levelToken++;
  RNG=makeRng(seedFor(n));
  level=clamp(n|0,1,LEVEL_CAP);
  cfg=genLevel(level);
  { const aj=clamp(IA.dados.ajuste||1,0.75,1.15); cfg.monsterSpeed*=aj; cfg.follow*=aj; }   // dificuldade dinâmica (suave)
  M=cfg.mut||{tags:[]};
  PAL = cfg.hue==null ? (cfg.type==='collect'?PAL_SKY:PAL_NIGHT) : palFromHue(cfg.hue, M.invert);
  VIGN=cfg.vignette||0;
  phGrav=cfg.grav; phMove=cfg.move; phFric=cfg.fric; phBandH=cfg.bandH; phSlot=cfg.slot; phBaseJump=cfg.baseJump;
  JUMP_Hc=(phBaseJump*phBaseJump)/(2*phGrav);
  { const A=areaForLevel(level); let aw=A.w; if(cfg.type==='collect' && level>5) aw=Math.round(aw*0.72);
    WORLD_W=Math.max(aw, Math.ceil(W)); WORLD_H=Math.max(A.h, Math.ceil(H*1.2)); }
  groundY=WORLD_H-GROUND_H;
  player={ x:140, y:groundY-46, vx:0, vy:0, w:34, h:46, onGround:true, platRef:null, face:1,
    charge:0, charging:false, stam:MAX_STAM, conv:0, prevJump:false, jumps:0, coyote:0, jumpBuf:0, jumpCut:false,
    moveMaxBase:cfg.playerSpeed, jumpBase:cfg.playerJump, maxJumps:cfg.maxJumps,
    stamRegenLvl:cfg.stamRegen, blastCost:cfg.blastCost, hp:cfg.maxHp, maxHp:cfg.maxHp, invuln:0,
    powers:powersForLevel(level), equip:0, shieldT:0, laserLock:0, rainT:0, guard:null, elec:null,
    agility:1, slowT:0, biteCD:0, rootT:0, stickT:0, px:140, py:groundY-46, echoT:0 };
  { const bonus=clamp(Math.floor((deepest||1)/8),0,10);
    player.moveMaxBase*=(1+bonus*0.02); player.jumpBase*=(1+bonus*0.015); player.bonus=bonus; }
  if(cfg.type==='collect'){ player.jumpBase*=1.24; player.maxJumps=Math.max(player.maxJumps,2); aiLearn={vx:0,jr:0}; }
  { const _bp=document.getElementById('bPow'), _bc=document.getElementById('bCyc');
    if(_bp) _bp.style.display=player.powers.length?'flex':'none';
    if(_bc) _bc.style.display=player.powers.length>1?'flex':'none';
    const _bd=document.getElementById('bDash'); if(_bd) _bd.style.display=unlocked('dash',level)?'flex':'none'; }
  npcs=[];monsters=[];shots=[];loveShots=[];waves=[];lasers=[];loveRain=[];divineFx=null;elecRays=[];beams=[];spikesW=[];stickies=[];phantomT=0;blasts=[];particles=[];walls=[];ambient=[];fhearts=[];pHearts=[];blocks=[];rock=null;carrying=0;rainTimer=0;echoes=[];portas=[];ouro=null;dominio=null;lentoT=0;meta=null;subida=null;ventos=[];batida=null;enfeites=[];luzT=0;escuro=false;ultimaExplosao=null;avisoMonstros=false;explodidos=0;toastT=0;
  shake=0;time=0;lookX=0;
  for(let i=0;i<18;i++) ambient.push({x:Math.random(),y:Math.random(),s:rand(8,18),sp:rand(.0006,.0016),sw:rand(0,6.28)});

  // plataformas: caminho-base SEMPRE alcançável
  platforms=[];
  const jReach=JUMP_Hc, NB_MAX=32;
  let nBands=Math.max(4, Math.floor((groundY-110)/Math.min(phBandH, jReach*0.82)));
  nBands=Math.min(nBands, NB_MAX);
  phBandH=clamp((groundY-110)/Math.max(nBands,1), 56, jReach*0.82);   // espaçamento SEMPRE ≤ alcance do pulo
  const count=clamp(Math.round(WORLD_W/(phSlot*1.7/(M.densityMul||1))), 3, 40);
  const cellW=WORLD_W/count;
  for(let b=0;b<nBands;b++){
    const y=groundY-phBandH*(b+1);
    const off=(b%2)?cellW*0.5:0;
    for(let s=0;s<count;s++){
      if(M.gaps>0 && b>=nBands-2 && RNG()<M.gaps*1.5) continue;          // buracos só lá no alto (não quebra a subida)
      const w=clamp(rand(124,188)*(1+(RNG()-0.5)*(M.warp||0)*0.4), 96, 210), hw=w/2;
      let cx=off+(s+0.5)*cellW+rand(-cellW*0.14,cellW*0.14)+(RNG()-0.5)*cellW*(M.jitter||0)*0.12;
      cx=clamp(cx,hw+10,WORLD_W-hw-10);
      platforms.push({x:cx-hw,y,w,h:14,band:b,cx,hw,mv:null,solid:true});
    }
  }
  // ===== ESCADAS-ESPINHA: uma barra por faixa, em zigue-zague CURTO o bastante pra SEMPRE conectar =====
  const nSpines=Math.max(1, Math.round(WORLD_W/3600));
  for(let k=0;k<nSpines;k++){ let spineX=clamp(rand(WORLD_W*(k+0.2)/nSpines, WORLD_W*(k+0.8)/nSpines), 120, WORLD_W-220);
    for(let b=0;b<nBands;b++){ const y=groundY-phBandH*(b+1);
      const w=clamp(rand(150,200),140,210), hw=w/2;
      const maxStep=56+w*0.5;
      spineX=clamp(spineX+rand(-maxStep,maxStep), hw+12, WORLD_W-hw-12);
      platforms.push({x:spineX-hw, y, w, h:16, band:b, cx:spineX, hw, mv:null, spine:true, solid:true});
    } }
  // barras comuns que ficavam SOBREPOSTAS à escada (duas barras uma em cima da outra, parecia bug) saem — a escada já garante o caminho
  { const sp=platforms.filter(p=>p.spine);
    platforms=platforms.filter(p=>p.spine || !sp.some(s=>s.band===p.band && p.x<s.x+s.w+16 && p.x+p.w>s.x-16)); }
  // ===== BARRAS COM MOVIMENTO: oscilam em torno da posição-base (que É alcançável) =====
  const movPool=shuffle(platforms.filter(p=>{ if(p.band<2||p.spine)return false;
    const rL=p.x-18, rR=(WORLD_W-p.w-18)-p.x; return rL>=40&&rR>=40; }));
  const VAMP=clamp(jReach*0.40, 36, 96);
  for(let i=0;i<Math.min(cfg.moving,movPool.length);i++){ const p=movPool[i];
    p.bx=p.x; p.by=p.y;
    const rL=p.x-18, rR=(WORLD_W-p.w-18)-p.x, roomX=Math.max(0,Math.min(rL,rR)-2);
    const longMove=RNG()<0.42;
    const ampX=clamp(longMove?rand(80,150):rand(40,80), 0, roomX);
    const r=RNG(); let mvm='pingX', ampx=ampX, ampy=0;
    if(r<0.34){ mvm='pingX'; ampx=ampX; ampy=0; }
    else if(r<0.62){ mvm='pingY'; ampx=0; ampy=longMove?VAMP:VAMP*0.6; }
    else { mvm='diag'; ampx=ampX*0.8; ampy=VAMP*0.6; }
    const tsp=(0.010+RNG()*0.013)*clamp(cfg.mvSpeed*0.6,0.7,1.5)*(longMove?0.85:1.1);
    p.mv={mode:mvm,ampx,ampy,tsp,dir:RNG()<.5?-1:1,t:0,pulse:RNG()<0.42,pulseT:rand(60,180),boost:1}; }

  // ===== ARQUITETURA BACKROOMS: estruturas distorcidas =====
  addStructures(cfg.archCount||0, nBands);

  const reach=computeReachable();
  platforms.forEach((p,i)=>{ p.alc=!!reach[i]; });
  const statics=platforms.filter((p,i)=>!p.mv && reach[i]);
  const reachAny=platforms.filter((p,i)=>reach[i]);

  // PLATAFORMAS QUE PISCAM: só barras comuns (nunca a espinha nem as que têm gente em cima no começo)
  if(M.blink){ const pool=shuffle(platforms.filter(p=>!p.spine&&!p.mv&&p.band>0));
    for(let i=0;i<Math.floor(pool.length*0.22);i++){ pool[i].blink={on:rand(2.6,4.2),off:1.0,t:rand(0,3)}; } }
  // visual torto (bem leve, pra não parecer que flutua) — calculado UMA vez
  for(const p of platforms){ const ps=((Math.floor(p.x)*73856093)^(Math.floor(p.y)*19349663))>>>0;
    p.tilt = (!p.mv && level>=6 && (ps%100)<40) ? ((((ps>>3)%100)/100-0.5)*0.12) : 0; p.corner=level>=6 && (ps>>7)%6===0;
    p.ic=(ps>>11)&3; p.flor=(!p.mv&&!p.arch&&!p.spine&&p.band!==99&&((ps>>13)%5===0))?1+((ps>>17)%3):0; p.flx=4+((ps>>5)%Math.max(1,Math.floor(p.w-28))); }
  // PLATAFORMAS COM PREGO NO MEIO: pisou no meio, fica parada; pisou na ponta, ela gira e derruba (nunca a escada principal)
  // em TODAS as fases: 1 ou 2 (um pouco mais nas fundas). Pisou na beirada: ela gira uns 90° e depois volta sozinha.
  { const nGira = level===1?1:clamp(1+Math.floor(RNG()*2)+Math.floor(Math.max(0,level-5)/12),1,8);
    const pool=shuffle(platforms.filter(p=>!p.spine&&!p.mv&&!p.blink&&!p.arch&&p.band>=1&&p.band!==99&&p.w>=120));
    for(let i=0;i<Math.min(nGira,pool.length);i++){ const p=pool[i]; p.gira={ang:0,av:0,load:0,fase:'parado',t:0,dir:1}; p.tilt=0; p.flor=0; } }
  // PORTAS DO NADA: em pares, bem longe uma da outra, em plataformas firmes. Aparecem do nada e te engolem no meio do pulo
  portas=[];
  if(level>=2 && RNG()<0.55){ const firm0=statics.filter(p=>!p.gira&&!p.blink&&!p.arch&&!p.tilt&&p.w>=100); let firm=firm0;   // portinha só em plataforma reta, em qualquer fase
    const pares=1+((level>15&&RNG()<0.4)?1:0);
    for(let k=0;k<pares && firm.length>2;k++){ const a=firm[Math.floor(RNG()*firm.length)]; let b=null;
      for(let tt=0;tt<30;tt++){ const c=firm[Math.floor(RNG()*firm.length)]; if(Math.abs(c.x-a.x)>WORLD_W*0.35){ b=c; break; } }
      if(!b) continue; const i=portas.length;
      firm=firm.filter(p=>Math.abs(p.x-a.x)>420&&Math.abs(p.x-b.x)>420);
      for(const [p,par] of [[a,i+1],[b,i]]){ p.temPorta=true; const hx=clamp(p.x+p.w/2-20,4,WORLD_W-44), hy=p.y;
        portas.push({x:hx,y:hy,hx,hy,w:40,h:62,par,estado:'oculta',a:0,abre:0,cd:0}); } } }
  // PONTES QUE QUEBRAM: ficou parado ~meio segundo em cima, ela racha e cai; volta depois de 4 s (nunca a escada)
  if(level>=8){ const pool=shuffle(platforms.filter(p=>!p.spine&&!p.mv&&!p.gira&&!p.blink&&!p.arch&&!p.temPorta&&p.band>=1&&p.band!==99));
    for(let i=0;i<Math.min(pool.length,3+Math.floor((level-8)/6),10);i++) pool[i].fragil={peso:0,estado:'ok',t:0}; }
  // PLATAFORMAS EM GRUPO: ondulação, balanço juntas ou "respirando" (abre e fecha) — nunca a escada
  if(level>=6 && RNG()<0.45){ const modos=['onda','grupoX','respira'], modo=modos[Math.floor(RNG()*3)];
    const cx0=rand(WORLD_W*0.15,WORLD_W*0.85), larg=rand(900,1500), b0=2+Math.floor(RNG()*Math.max(1,nBands-6));
    const grupo=platforms.filter(p=>!p.spine&&!p.mv&&!p.gira&&!p.blink&&!p.fragil&&!p.temPorta&&p.band>=b0&&p.band<=b0+3&&Math.abs(p.x+p.w/2-cx0)<larg/2);
    const A=clamp(VAMP*0.55,24,44), w=0.9+RNG()*0.8;
    for(const p of grupo){ p.bx=p.x; p.by=p.y; p.tilt=0; p.flor=0; p.mv={mode:modo,A,w,fase:(p.x-cx0)*0.006,cx0,t:RNG()*6}; } }
  // ===== [FASES ESPECIAIS] cada uma monta a sua mecânica central (e combina com as conhecidas nas vezes seguintes) =====
  { const ESP=cfg.especial, nv=ESP?ESP.nivel:0;
    const livres=()=>platforms.filter(p=>!p.spine&&!p.mv&&!p.gira&&!p.blink&&!p.fragil&&!p.temPorta&&p.band>=1&&p.band!==99);
    const addPar=()=>{ const firm=statics.filter(p=>!p.gira&&!p.blink&&!p.arch&&!p.tilt&&!p.temPorta&&p.w>=100&&!portas.some(d=>Math.abs(d.hx-p.x)<420&&Math.abs(d.hy-p.y)<300)); if(firm.length<4) return;
      const a=firm[Math.floor(RNG()*firm.length)]; let b=null; for(let tt=0;tt<30;tt++){ const c=firm[Math.floor(RNG()*firm.length)]; if(c!==a&&Math.abs(c.x-a.x)>WORLD_W*0.3){ b=c; break; } }
      if(!b) return; const i=portas.length; for(const [p,par] of [[a,i+1],[b,i]]){ p.temPorta=true; const hx=clamp(p.x+p.w/2-20,4,WORLD_W-44); portas.push({x:hx,y:p.y,hx,hy:p.y,w:40,h:62,par,estado:'oculta',a:0,abre:0,cd:0}); } };
    if(ESP){
      if(ESP.id==='desaparecem'){ const pool=shuffle(livres()); const k=Math.floor(pool.length*(0.4+0.1*nv)); for(let i=0;i<k;i++) pool[i].fragil={peso:0,estado:'ok',t:0,todos:nv>=2}; }
      if(ESP.id==='portas'){ for(let k=0;k<2+nv;k++) addPar(); }
      if(ESP.id==='elevadores'){ const pool=shuffle(livres()); for(let i=0;i<Math.floor(pool.length*0.35);i++){ const p=pool[i]; p.bx=p.x; p.by=p.y; p.tilt=0; p.flor=0; p.mv={mode:'pingY',ampx:0,ampy:VAMP,tsp:0.008+RNG()*0.006,dir:1,t:RNG()*2-1,pulse:false,pulseT:0,boost:1}; } }
      if(ESP.id==='musicais'){ batida={per:clamp(0.78-nv*0.06,0.5,0.78),t:0,n:0}; for(const p of livres()){ p.bx=p.x; p.by=p.y; p.tilt=0; p.mv={mode:'musica',A:clamp(VAMP*0.5,22,40),grupo:(p.band+Math.floor(p.x/600))%2}; } }
      if(ESP.id==='trampolins'){ const pool=shuffle(livres()); for(let i=0;i<Math.min(pool.length,8+nv*2);i++){ pool[i].trampolim={lado:(RNG()<0.2*nv?(RNG()<.5?-1:1):0),t:0}; pool[i].flor=0; pool[i].tilt=0; } }
      if(ESP.id==='cascata'){ shuffle(livres().filter(p=>p.band>=nBands-5&&p.alc)).slice(0,4+nv).forEach(p=>{ p.cascata={carga:true,t:0}; p.flor=0; }); }
      if(ESP.id==='escuridao') escuro=true;
      if(ESP.id==='vento'){ for(let k=0;k<2+nv;k++){ ventos.push({x:rand(WORLD_W*0.1,WORLD_W*0.85),w:rand(220,380),fx:(RNG()<.5?-1:1)*(0.22+0.05*nv),fy:RNG()<0.35?-0.55:0,troca:nv>=3?rand(7,10):0,t:0,aviso:0}); } }
      if(ESP.id==='fuga' || (ESP.id==='torre' && nv>=2)){ const alto=groundY-phBandH*nBands, tempo=Math.max(35,55+nBands*2.6-(ESP.id==='fuga'?nv*4:0)); subida={y:groundY+120, vel:(groundY+120-alto)/tempo, atraso:ESP.id==='fuga'?4:8}; }
      if(nv>=3 && ESP.id!=='portas') addPar();                                               // combinação: + uma mecânica conhecida
      if(nv>=4 && ESP.id!=='desaparecem'){ const pool=shuffle(livres()); for(let i=0;i<Math.min(4,pool.length);i++) pool[i].fragil={peso:0,estado:'ok',t:0}; }
      if(ESP.obj==='saida'){ const alc=platforms.filter((p,i)=>reach[i]&&!p.mv&&!p.fragil&&!p.gira&&p.band!==99&&!p.temPorta).sort((a,b)=>b.x-a.x); const p=alc[0]||platforms[0]; meta={tipo:'saida',x:clamp(p.x+p.w/2-26,4,WORLD_W-56),y:p.y-74,w:52,h:74}; }
      if(ESP.obj==='topo'){ const sp=platforms.filter(p=>p.spine).sort((a,b)=>a.y-b.y)[0]; meta={tipo:'topo',x:sp.x+sp.w/2-30,y:sp.y-64,w:60,h:64}; }
    } }

  for(let i=0;i<cfg.blocks;i++){ const p=statics[Math.floor(rand(0,statics.length))]||platforms[0];
    const bw=clamp(p.w*rand(.8,1.05),80,132), bh=30, side=RNG()<.5?-1:1;
    let bx=side<0 ? p.x-bw-rand(4,14) : p.x+p.w+rand(4,14);
    bx=clamp(bx,8,WORLD_W-bw-8);
    blocks.push({x:bx,y:p.y,w:bw,h:bh,state:'idle',t:0,vy:0,sw:rand(0,6.28)}); }

  const fixos=reachAny.filter(p=>!p.mv); if(!fixos.length) fixos.push(platforms[0]);
  if(cfg.type==='love'){
    totalSad0=cfg.npc;
    for(let i=0;i<cfg.npc;i++){
      let x,y2;
      if(i<3){ x=rand(420,Math.min(1100,WORLD_W-60)); y2=groundY-44; }
      else { const p=(fixos[Math.floor(rand(0,fixos.length))])||platforms[0]; x=clamp(p.x+rand(0,Math.max(2,p.w-32)),0,WORLD_W-30); y2=p.y-44; }
      const sd=mkSad(x,y2); sd.x=clamp(sd.x,0,WORLD_W-sd.w); npcs.push(sd);   // tristes largos/gigantes não nascem metade fora do mundo
    }
    // monstros: em plataformas alcançáveis LONGE do começo (antes eram empurrados pra fora da plataforma)
    // CORAÇÃO DOURADO: pegou, a próxima explosão acalma TODOS os apaixonados por perto
    ouro=null; if(level>=6 && RNG()<0.5){ const op=fixos[Math.floor(rand(0,fixos.length))]; if(op) ouro={x:op.x+op.w/2,y:op.y-34,sw:0}; }
    const far=fixos.filter(p=>p.x>900&&!(meta&&Math.abs(p.x+p.w/2-(meta.x+meta.w/2))<p.w/2+90&&Math.abs(p.y-(meta.y+meta.h))<4)); const pool=far.length?far:fixos;   // nunca em cima da saída
    const spawnMon=(kind,cnt)=>{ for(let i=0;i<cnt;i++){ const p=pool[Math.floor(rand(0,pool.length))]||platforms[0];
      const mo=mkMonster(0,0,kind); mo.x=clamp(p.x+rand(0,Math.max(2,p.w-mo.w)), 900, WORLD_W-mo.w-10); mo.y=p.y-mo.h; monsters.push(mo); } };
    spawnMon('chaser',cfg.chaserCount); spawnMon('shooter',cfg.shooterCount); spawnMon('eater',cfg.eaterCount);
    spawnMon('dog',cfg.dogCount); spawnMon('sphere',cfg.sphereCount); spawnMon('spiker',cfg.spikerCount); spawnMon('beamer',cfg.beamerCount); spawnMon('arquiteto',cfg.moverCount||0); spawnMon('tristonho',cfg.tristCount||0); spawnMon('camaleao',cfg.camaCount||0); spawnMon('divisor',cfg.diviCount||0); spawnMon('piscador',cfg.piscCount||0); spawnMon('gelador',cfg.gelCount||0); spawnMon('rachador',cfg.rachCount||0); spawnMon('sombrio',cfg.sombCount||0);
    for(let i=0;i<cfg.tentacleCount;i++){ const tm=mkMonster(0,0,'tentacle'); tm.x=clamp(rand(1000,WORLD_W-160),60,WORLD_W-tm.w-40);
      if(meta){ for(let k=0;k<12 && Math.abs(tm.x+tm.w/2-(meta.x+meta.w/2))<tm.w/2+meta.w/2+120;k++) tm.x=clamp(rand(1000,WORLD_W-160),60,WORLD_W-tm.w-40); } tm.y=groundY-tm.h; monsters.push(tm); }   // tentáculo nunca tapando a saída
    if(cfg.bossCount){ const bm=mkMonster(0,0,'boss'); bm.x=clamp(WORLD_W*0.6,200,WORLD_W-bm.w-40); bm.y=groundY-bm.h; monsters.push(bm); }
    if(level>=20 && (!cfg.especial || cfg.especial.nivel>=3)){ const cand=shuffle(monsters.filter(m=>m.kind!=='boss'&&m.kind!=='tentacle'&&m.kind!=='sphere'&&m.kind!=='shooter'&&m.kind!=='beamer'&&m.kind!=='divisor'));
      const ne=Math.min(cand.length, level>=45?2:1);
      for(let i=0;i<ne;i++){ if(RNG()<0.35+Math.min(0.4,(level-20)*0.01)){ const m=cand[i], ow=m.w, oh=m.h; m.elite=true; m.w*=1.3; m.h*=1.3; m.y-=(m.h-oh); m.x=clamp(m.x-(m.w-ow)/2,0,WORLD_W-m.w); m.hp=m.maxHp=m.hp*2+1; m.domCD=rand(5,9); } } }
  } else {
    totalSad0=0;
    const bv=cfg.bonusVar||'tradicional';
    rock={ x:WORLD_W/2-34, y:groundY-84, w:68, h:84, fill:0, target:cfg.target, done:false, born:0 };
    const spTopo=platforms.filter(p=>p.spine).sort((a,b)=>a.y-b.y);
    if((bv==='vertical'||bv==='entrega') && spTopo[0]){ rock.x=clamp(spTopo[0].x+spTopo[0].w/2-34,4,WORLD_W-72); rock.y=spTopo[0].y-84; }   // a escada sempre leva até lá
    if(bv==='viajante' && spTopo.length>2){ const mid=spTopo[Math.floor(spTopo.length/2)];
      rock.pontos=[{x:WORLD_W/2-34,y:groundY-84},{x:clamp(mid.x+mid.w/2-34,4,WORLD_W-72),y:mid.y-84},{x:clamp(spTopo[0].x+spTopo[0].w/2-34,4,WORLD_W-72),y:spTopo[0].y-84}]; rock.pi=0; rock.trocaT=18; }
    if(bv==='tempo') rock.tempo=40+cfg.target*5;
    if(bv==='entrega'){ for(const p of platforms){ if(p.spine||p.mv||p.gira||p.band===99||p.temPorta) continue; if(Math.abs(p.x+p.w/2-(rock.x+34))<700 && p.y<groundY-phBandH*3){ if(RNG()<0.45) p.fragil={peso:0,estado:'ok',t:0}; else if(RNG()<0.25) p.blink={on:rand(2.6,4),off:1.0,t:rand(0,3)}; } } }
    if(bv==='disfarcados'){ for(let k=0;k<8;k++){ const p=reachAny[Math.floor(rand(0,reachAny.length))]; if(p) enfeites.push({x:p.x+rand(20,Math.max(21,p.w-20)),y:p.y-34,s:rand(24,38),col:HEART_COLORS[Math.floor(rand(0,HEART_COLORS.length))]}); } }
    const fieldN=clamp(cfg.target+2, 6, 12);
    for(let i=0;i<fieldN;i++){ let ft=(i===0 && (cfg.collectIndex||0)===1)?'fast':undefined; if(bv==='grupo'&&i===0) ft='rei'; spawnHeartScattered(ft); }
  }
  // ===== ESTEIRA: uma FAIXA inteira desliza, some e reaparece do outro lado (superfície extra, nunca obrigatória) =====
  if(level>=6 && RNG()<0.6){
    const usableTop=groundY-phBandH*(nBands-2), usableBot=groundY-phBandH*3;
    const cy=clamp(usableBot+RNG()*(usableTop-usableBot), phBandH*2, groundY-phBandH*2);
    const dir=RNG()<.5?-1:1, sp=(0.7+RNG()*1.0)*clamp(cfg.mvSpeed*0.5,0.6,1.4);
    const nC=3+Math.floor(RNG()*3), gap=WORLD_W/nC;
    for(let k=0;k<nC;k++){ const w=clamp(rand(120,180),96,210);
      platforms.push({x:k*gap+RNG()*gap*0.4, y:cy, w, h:14, band:99, cx:0, hw:w/2, extra:true, solid:true, tilt:0,
        mv:{mode:'wrapX', sp, dir, pulse:true, pulseT:rand(80,200), boost:1}}); }
  }
  state='play';
  RNG=Math.random;
  // câmera começa já no lugar (sem "viagem" ao entrar na fase)
  camX=clamp(player.x+player.w/2-W/2,0,Math.max(0,WORLD_W-W)); camY=clamp(player.y+player.h/2-H*0.58,0,Math.max(0,WORLD_H-H));
  camPX=camX; camPY=camY;
  updatePlatforms(); buildBackdrop(); groundGrad=null;
  setObjective(); updateHUD(); drawDirty=true;
  if(IA.dados.avisarAjuste){ IA.dados.avisarAjuste=0; toast('🤍 Calma: os perseguidores estão um pouco mais lentos nesta tentativa',3.5,'#cfe8ff'); }
}

// MOTIVOS BACKROOMS: cada nível é o anterior um pouco mais deformado (âncoras estáveis pela semente).
function addStructures(count, nBands){
  if(count<=0) return;
  const d=Math.max(0, level-5);
  const yTop=groundY-phBandH*(nBands-1), yBot=groundY-phBandH*1.5;
  const mk=(x,y,w,h)=>{ const ww=clamp(w,36,170), hh=clamp(h||14,10,64), hw=ww/2,
    cx=clamp(x,hw+8,WORLD_W-hw-8), yy=clamp(y,yTop,yBot);
    platforms.push({x:cx-hw,y:yy,w:ww,h:hh,band:clamp(Math.round((groundY-yy)/phBandH)-1,1,99),cx,hw,mv:null,arch:true,motif:true,solid:true}); };
  const hash=i=>{ let h=Math.imul((i+1)^runSeed,2654435761)>>>0; h^=h>>>15; h=Math.imul(h,2246822507)>>>0; h^=h>>>13; return h>>>0; };
  const N=Math.min(count,20), spanY=Math.max(1,(yBot-yTop-phBandH));
  for(let i=0;i<N;i++){
    const hx=hash(i*2), hy=hash(i*2+1);
    const ax=120+((hx%10000)/10000)*(WORLD_W-240);
    const ay=clamp(yTop+phBandH+((hy%10000)/10000)*spanY, yTop, yBot);
    const stage=d+(hx%7);
    const cyc=stage%7, wear=Math.floor(stage/7), cr=Math.min(wear*4,24);
    if(cyc===0){ mk(ax,ay,72,12); mk(ax+cr*0.4,ay-16,72,12); }
    else if(cyc===1){ mk(ax,ay,78,26+Math.min(wear*3,18)); }
    else if(cyc===2){ mk(ax,ay,82,28); mk(ax+56,ay-6,40,12); }
    else if(cyc===3){ mk(ax,ay,82,28); for(let k=0;k<3;k++) mk(ax+44+k*12,ay-6-k*(6+cr*0.2),18,10); }
    else if(cyc===4){ mk(ax,ay,84,30); mk(ax+34,ay-15,28,14); }
    else if(cyc===5){ for(let k=0;k<4;k++) mk(ax,ay-k*14,16,14); mk(ax+26,ay,46,14); }
    else { for(let k=0;k<5;k++) mk(ax+(k>2?(k-2)*cr*0.3:0),ay-k*14,16,14);
           for(let k=0;k<3;k++) mk(ax+22+k*(16+cr*0.3), ay+k*cr*0.2, 22,12); }
  }
}

// ===== MOTOR DAS BARRAS MÓVEIS + índice por faixa (colisão só com as barras perto) =====
let platBuckets=null; const PBUCKET=70;
function updatePlatforms(){ let algumMorto=false; const lentoPula=lentoT>0 && (Math.round(time*60)%3)!==0;
  for(const p of platforms){ p.dx=0; p.dy=0;
    if(p.gelo>0) p.gelo-=STEP; if(p.tremor>0) p.tremor-=STEP;
    if(p.ponte){ p.ponte.t-=STEP; p.warn=p.ponte.t<1.2; if(p.ponte.t<=0){ p.dead=true; algumMorto=true; puff(p.x+p.w/2,p.y,10,'#ffb3d1',3,10); continue; } }
    if(p.blink){ const b=p.blink; b.t+=STEP; const per=b.on+b.off, ph=b.t%per; p.solid = ph<b.on; p.warn = p.solid && ph>b.on-0.6; }
    if(p.gira){ const g=p.gira;       // prego no meio: parado → (pisou na beirada) inclina → GIRA ~90° → segura → volta sozinha
      if(g.fase==='parado'){ if(Math.abs(g.load)>0.01) g.av+=g.load*0.0025; else g.av-=g.ang*0.02; g.av*=0.9; g.ang+=g.av;
        if(Math.abs(g.ang)>0.18){ g.fase='girando'; g.dir=Math.sign(g.ang)||1; g.t=0; beep(200,0.12,'triangle',0.05); G('evento','plataforma_girou',null,false); } }
      else if(g.fase==='girando'){ g.ang+=(g.dir*Math.PI/2-g.ang)*0.22; if(Math.abs(g.ang)>0.35) p.solid=false; g.t+=STEP; if(g.t>1.1){ g.fase='voltando'; } }
      else { g.ang+=(0-g.ang)*0.06; if(Math.abs(g.ang)<0.03){ g.ang=0; g.av=0; g.fase='parado'; p.solid=true; } }
      g.load=0; }
    if(p.fragil){ const f=p.fragil;
      if(f.estado==='ok'){ if((player&&player.onGround&&player.platRef===p)||(f.todos&&f.toque)) f.peso+=STEP; else f.peso=Math.max(0,f.peso-STEP*0.5); f.toque=false;
        if(f.peso>0.55){ f.estado='cai'; f.t=0; p.solid=false; beep(160,0.15,'square',0.04); G('evento','ponte_quebrou',null,false); } }
      else { f.t+=STEP; p.dyVis=Math.min(400,f.t*f.t*300); if(f.t>4){ f.estado='ok'; f.peso=0; p.solid=true; p.dyVis=0; } } }
    if(p.cascata && !p.cascata.carga){ p.cascata.t+=STEP; if(p.cascata.t>12){ p.cascata.carga=true; p.cascata.t=0; } }
    if(p.trampolim && p.trampolim.t>0) p.trampolim.t-=STEP;
    if(p.coracao){ const c=p.coracao; if(!c.caindo){ c.t-=STEP; if(c.t<=0){ c.caindo=true; c.vy=0; p.solid=false; } }
      else { c.vy+=0.5; p.dyVis=(p.dyVis||0)+c.vy; if(p.y+p.dyVis>=groundY-20){ p.dead=true; algumMorto=true; puff(p.x+p.w/2,groundY-10,16,'#ff8fab',4,14);
        for(let k=0;k<3;k++) spawnPHeart(p.x+p.w/2+rand(-40,40), groundY); } } }
    if(p.shift){ const s=p.shift; if(s.warn>0) s.warn-=STEP;
      else { s.t=Math.min(1,s.t+STEP/0.8); const e=s.t<0.5?2*s.t*s.t:1-Math.pow(-2*s.t+2,2)/2; const nx=s.from+(s.to-s.from)*e; p.dx=nx-p.x; p.x=nx; p.cx=p.x+p.w/2; if(s.t>=1) p.shift=null; } }
    const mv=p.mv; if(!mv) continue; if(lentoPula) continue;   // TEMPO LENTO: as plataformas que se mexem andam 1/3
    if(mv.mode==='musica'){ const fase=batida?((batida.n+mv.grupo)%2):0, alvo=p.by+(fase?-mv.A:mv.A)*0.5, ny=p.y+(alvo-p.y)*0.2; p.dy=ny-p.y; p.y=ny; continue; }   // sobe/desce na batida
    if(mv.mode==='onda'||mv.mode==='grupoX'||mv.mode==='respira'){ mv.t+=STEP*mv.w; let nx=p.bx, ny=p.by;
      if(mv.mode==='onda') ny=p.by+mv.A*Math.sin(mv.t*2+mv.fase);                         // onda passando pelo grupo
      else if(mv.mode==='grupoX') nx=p.bx+mv.A*1.6*Math.sin(mv.t*1.3);                    // o grupo inteiro balança junto
      else nx=p.bx+(p.bx+p.w/2-mv.cx0)*0.12*Math.sin(mv.t*1.2);                            // o grupo abre e fecha (respira)
      nx=clamp(nx,4,WORLD_W-p.w-4); p.dx=nx-p.x; p.dy=ny-p.y; p.x=nx; p.y=ny; continue; }
    if(mv.pulse){ mv.pulseT-=1; if(mv.pulseT<=0){ if(mv.boost>1){ mv.boost=1; mv.pulseT=rand(120,240); } else { mv.boost=2.2+Math.random()*1.2; mv.pulseT=rand(28,64); } } }
    const boost=mv.boost||1;
    if(mv.mode==='wrapX'){ const ox=p.x; p.x+=mv.sp*boost*mv.dir;
      if(mv.dir>0 && p.x>WORLD_W+4){ p.x=-p.w-4; } else if(mv.dir<0 && p.x+p.w<-4){ p.x=WORLD_W+4; }
      p.dx = Math.abs(p.x-ox)>p.w ? 0 : (p.x-ox);
    } else {
      mv.t += mv.tsp*boost*mv.dir; if(mv.t>1){ mv.t=1; mv.dir=-1; } if(mv.t<-1){ mv.t=-1; mv.dir=1; }
      const nx=p.bx+(mv.ampx||0)*mv.t, ny=p.by+(mv.ampy||0)*mv.t;
      p.dx=nx-p.x; p.dy=ny-p.y; p.x=nx; p.y=ny;
    } }
  if(algumMorto) platforms=platforms.filter(q=>!q.dead);
  platBuckets={};
  for(const p of platforms){ const b=(p.y/PBUCKET)|0; (platBuckets[b]||(platBuckets[b]=[])).push(p); }
}
// gravidade + pouso. Velocidade de queda limitada e pouso por "varredura" (não atravessa mais plataformas caindo de alto)
function applyVertical(e){
  const rp=e.platRef;
  // em cima da plataforma com PREGO: acompanha a inclinação; pisar na ponta empurra ela pra girar; no meio (30%) não pesa
  if(rp && rp.gira && e.onGround && rp.solid && e.vy>=0 && phantomT<=0){ const g=rp.gira, cxp=rp.x+rp.w/2, ex=e.x+e.w/2;
    if(e.x+e.w>rp.x+4 && e.x<rp.x+rp.w-4){ const d=clamp((ex-cxp)/(rp.w/2),-1,1), dz=Math.abs(d)<0.3?0:Math.sign(d)*(Math.abs(d)-0.3)/0.7;
      g.load+=dz*(e===player?1:0.6); e.y=rp.y+(clamp(ex,rp.x,rp.x+rp.w)-cxp)*Math.tan(g.ang)-e.h; e.vy=0; if(Math.abs(g.ang)>0.12) e.x=clamp(e.x+Math.sin(g.ang)*1.6,0,WORLD_W-e.w); return; } }
  // atalho: parado em cima de barra FIXA não precisa procurar plataforma de novo (economiza CPU no celular)
  if(e.onGround && rp && !rp.mv && !rp.gira && !rp.shift && rp.solid && !rp.blink && e.vy===0 && phantomT<=0 && e.x+e.w>rp.x+4 && e.x<rp.x+rp.w-4 && Math.abs(e.y+e.h-rp.y)<0.5) return;
  e.vy=Math.min(e.vy+phGrav, MAX_FALL); e.y+=e.vy; e.onGround=false; e.platRef=null;
  if(e.y+e.h>=groundY){ e.y=groundY-e.h; e.vy=0; e.onGround=true; return; }
  if(phantomT<=0 && e.vy>=0 && platBuckets){
    const feet=e.y+e.h, prev=feet-e.vy, fb=(feet/PBUCKET)|0, pb=(prev/PBUCKET)|0;
    let best=null, bestTop=0;
    for(let bb=pb-1; bb<=fb+1; bb++){ const arr=platBuckets[bb]; if(!arr) continue;
      for(const p of arr){ if(!p.solid) continue; const top=p.gira?p.y+(e.x+e.w/2-p.x-p.w/2)*Math.tan(p.gira.ang):p.y;
        if(e.x+e.w>p.x+4 && e.x<p.x+p.w-4 && prev<=Math.max(top,top-(p.dy||0))+2 && feet>=top && (!best||top<bestTop)){ best=p; bestTop=top; } } }
    if(best){ e.y=bestTop-e.h; e.vy=0; e.onGround=true; e.platRef=best; }
  }
  for(const bl of blocks){ if(bl.state==='fall')continue; if(e.vy>=0){ const feet=e.y+e.h, prev=feet-e.vy;
    if(e.x+e.w>bl.x+3 && e.x<bl.x+bl.w-3 && prev<=bl.y+2 && feet>=bl.y){
      e.y=bl.y-e.h; e.vy=0; e.onGround=true; e.platRef=null; } } }
}
function ride(e){ const p=e.platRef; if(p && e.onGround){ if(p.dx) e.x=clamp(e.x+p.dx,0,WORLD_W-e.w); if(p.dy) e.y+=p.dy; } }
function landHeart(h){ if(h.rest) return;
  if(h.y+h.h>=groundY){ h.y=groundY-h.h; h.vy=0; h.rest=true; return; }
  const feet=h.y+h.h, prev=feet-h.vy, fb=(feet/PBUCKET)|0;
  if(!platBuckets) return;
  for(let bb=fb-1; bb<=fb+1; bb++){ const arr=platBuckets[bb]; if(!arr) continue;
    for(const p of arr){ if(!p.solid) continue;
      if(h.x+h.w/2>p.x && h.x+h.w/2<p.x+p.w && prev<=p.y+2 && feet>=p.y){ h.y=p.y-h.h; h.vy=0; h.rest=true; h.on=p; return; } } }
}
function restPHeartGround(h){ h.y=groundY-h.h; h.vy=0;
  let guard=0, moved=true;
  while(moved && guard++<60){ moved=false;
    for(const o of pHearts){ if(o===h||!o.rest)continue;
      if(h.x<o.x+o.w && h.x+h.w>o.x){ if(h.x+h.w/2 < o.x+o.w/2) h.x=o.x-h.w-1; else h.x=o.x+o.w+1;
        h.x=clamp(h.x,2,WORLD_W-h.w-2); moved=true; } } }
  h.rest=true;
}
function puff(x,y,n,col,sp,sz){ for(let i=0;i<n;i++){ const a=rand(0,6.28), s=rand(1,sp||4);
  particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:1,decay:rand(.02,.04),s:rand(sz?sz*0.6:6,sz||12),col}); } }

function fireBlast(){
  const ch=player.charge, dour=!!player.dourado, maxR=blastMaxR(ch)*(dour?1.5:1); const sad0=npcs.filter(n=>n.state==='sad').length;
  const bx=player.x+player.w/2, by=player.y+player.h*0.42;
  blasts.push({x:bx,y:by,r:24,maxR,life:0,maxLife:0.6});
  shake=Math.min(20,7+ch*16); player.stam=Math.max(0,player.stam-player.blastCost);
  beep(520-ch*120,0.10,'triangle',0.07); later(60,()=>beep(760,0.18,'sine',0.05));
  const n=16+Math.floor(ch*28);
  for(let i=0;i<n;i++){const a=rand(0,6.28),sp=rand(2,6)*(0.6+ch);
    particles.push({x:bx,y:by,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1.5,life:1,decay:rand(.012,.026),s:rand(8,18),col:Math.random()<.5?'#ff2e63':'#ff8fab'});}
  for(const m of npcs.slice()){ const dd=dist(bx,by,m.x+m.w/2,m.y+m.h/2);
    if(dd<maxR){ if(m.state==='sad') makeHappy(m,'explosão');
      else if(m.state==='happy'&&!m.holding&&m.grace<=0){ if(dour){ m.holding=true; m.vx=0; } else { m.state='frozen'; m.freezeT=FREEZE_TIME; m.vx=0; m.stuck=false; } }
      else if(m.state==='happy'&&m.holding&&m.grace<=0&&!dour){ m.holding=false; m.state='frozen'; m.freezeT=FREEZE_TIME; m.vx=0; } } }   // com amor-próprio e leva outra explosão: sobrecarrega também
  if(dour){ player.dourado=false; puff(bx,by,30,'#ffd166',6,16); toast('✨ Explosão dourada: os apaixonados por perto ficaram calmos!',3,'#ffd166'); G('evento','explosao_dourada',null,true); }
  for(const mo of monsters.slice()){ if(mo.hitT<=0){ const dd=dist(bx,by,mo.x+mo.w/2,mo.y+mo.h/2);
    if(dd<maxR+Math.min(mo.w,mo.h)*0.3){ mo.hp--; mo.hitT=0.45; mo.vx+=Math.sign(mo.x-bx)*4; beep(180,0.12,'sawtooth',0.06);
      if(dominio && dominio.dono==='monstro' && dominio.mo===mo){ dominio.hp--; puff(mo.x+mo.w/2,mo.y+mo.h/2,14,dominio.T.cor,5,14); if(dominio.hp<=0) fecharDominio(true); }
      if(mo.hp<=0) defeatMonster(mo); } } }
  // a explosão também DESTRÓI os corações negros por perto (antes a fala prometia isso e não acontecia)
  for(let i=shots.length-1;i>=0;i--){ const s=shots[i]; if(dist(bx,by,s.x,s.y)<maxR){ puff(s.x,s.y,5,'#b14cff',3,9); shots.splice(i,1); } }
  for(const bl of blocks){ if(bl.state==='idle'){ const dd=dist(bx,by,bl.x+bl.w/2,bl.y+bl.h/2);
    if(dd<maxR){ bl.state='hit'; bl.t=BLOCK_TIME; bl.vy=0; beep(260,0.1,'square',0.05); } } }
  // a explosão também muda as PLATAFORMAS: quebra espinhos e, de tanto amor (3 explosões), a plataforma vira coração e cai
  let virou=false;
  for(const p of platforms){ if(p.mv||p.band===99||p.coracao||p.dead||(p.fragil&&p.fragil.estado!=='ok')) continue; if(dist(bx,by,p.x+p.w/2,p.y)>maxR*0.85) continue;
    if(p.espinhos){ p.espinhos=false; p.sujo=0; puff(p.x+p.w/2,p.y,10,'#ffd6e0',3,10); G('evento','quebrou_espinhos',null,true); continue; }
    if(p.sujo) p.sujo=Math.max(0,p.sujo-3);
    if(dist(bx,by,p.x+p.w/2,p.y)>maxR*0.6) continue;        // só fica rosa a plataforma bem no meio da explosão
    p.rosa=(p.rosa||0)+1;
    if(p.rosa>=3 && !p.spine && !p.gira && !p.temPorta && !p.cascata && !p.trampolim){ p.coracao={t:2.2}; virou=true; } else if(p.spine) p.rosa=Math.min(p.rosa,2); }
  ultimaExplosao={x:bx,y:by,t:time}; luzT=2.5;
  for(const p of platforms){ if(p.cascata && p.cascata.carga && dist(bx,by,p.x+p.w/2,p.y)<maxR){ p.cascata.carga=false; p.cascata.t=0;
      for(let k=0;k<5;k++){ spawnPHeart(p.x+p.w/2+rand(-p.w/3,p.w/3), p.y-6); pHearts[pHearts.length-1].vx=rand(-5,5); } puff(p.x+p.w/2,p.y,16,'#ff8fab',4,14); G('evento','cascata',null,true); } }
  if(virou && !seen.platCoracao){ seen.platCoracao=1; toast('💗 Amor demais naquela plataforma: ela virou coração e vai cair!',4,'#ff8fab'); }
  { let dmin=1e9; for(const m of npcs) if(m.state!=='sad'||true){ const d=dist(bx,by,m.x+m.w/2,m.y+m.h/2); if(d<dmin) dmin=d; } if(dmin<600) IA.habito('distExplode',dmin,0.08); }
  const acertos=sad0-npcs.filter(n=>n.state==='sad').length;
  G('evento','explodiu',[['forca',ch<0.34?'fraca':(ch<0.67?'média':'forte')]],acertos>0,{forca:ch,apaixonou:acertos});
  checkWinLove();
}
function makeHappy(n,causa){ if(n.state!=='sad')return; n.state='happy'; n.grace=0.95; n.heartTrail=0;
  { const pool=['romantico']; if(level>=3) pool.push('carente'); if(level>=4) pool.push('timido'); if(level>=5) pool.push('ciumento'); if(level>=6) pool.push('impulsivo'); if(level>=8) pool.push('calculista');
    n.perso=pool[Math.floor(Math.random()*pool.length)]; }   // cada apaixonado tem um jeito de te seguir
  G('evento','apaixonou',[['causa',causa||'explosão'],['triste',(n.def&&n.def.shape)||'normal']],true);
  player.conv++;
  if(Math.random()<((cfg.especial&&cfg.especial.id==='gigantes')?0.75:0.16) && n.w<80 && n.h<90){ const ow=n.w, oh=n.h; n.w*=2; n.h*=2; n.x=clamp(n.x-(n.w-ow)/2,0,WORLD_W-n.w); n.y-=(n.h-oh); n.inchou=true;   // amor demais: INCHOU
    puff(n.x+n.w/2,n.y+n.h/2,12,'#ffb3d1',4,14); G('evento','inchou',null,null);
    if(!seen.inchou){ seen.inchou=1; toast('😳 Esse ficou TÃO apaixonado que inchou! Agora ele é 2x maior',4,'#ffb3d1'); } }
  beep(660,0.12,'sine',0.06); later(70,()=>beep(990,0.14,'sine',0.045));
  for(let i=0;i<8;i++){const a=rand(0,6.28),sp=rand(1,3.5);
    particles.push({x:n.x+n.w/2,y:n.y+10,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,life:1,decay:rand(.02,.04),s:rand(7,13),col:'#ff5d8f'});}
  updateHUD(); checkWinLove(); }
// Explodir de amor é RUIM: a pessoa vira pedaços de coração, a tela escurece de tristeza e você perde energia.
function explodeHappy(n){ const cx=n.x+n.w/2, cy=n.y+n.h*0.5; shake=Math.min(22,shake+10);
  beep(220,0.3,'sawtooth',0.07); later(120,()=>beep(140,0.4,'sawtooth',0.06));
  for(let i=0;i<24;i++){const a=rand(0,6.28),sp=rand(2,8);
    particles.push({x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-rand(1,4),life:1,decay:rand(.008,.02),s:rand(8,20),col:i%3?'#8a8095':'#5a4a68'});}
  for(let i=0;i<2;i++) spawnPHeart(cx+rand(-30,30), cy);
  explodidos++; player.stam=Math.max(0,player.stam-20); tristeT=1.2;
  toast(explodidos===1?'💔 Amor demais: ele EXPLODIU! Isso é ruim (−20 de energia)':'💔 Mais um explodiu de amor… ('+explodidos+' nesta fase)',3.5,'#9a8aa8');
  G('evento','pessoa_explodiu',null,false);
  explodedCount++; const i=npcs.indexOf(n); if(i>=0) npcs.splice(i,1); updateHUD(); checkWinLove(); }
function explodeBlock(bl){ const cx=bl.x+bl.w/2; shake=Math.min(22,shake+12);
  beep(200,0.2,'sawtooth',0.07); later(70,()=>beep(720,0.18,'sine',0.05));
  for(let i=0;i<28;i++){const a=rand(0,6.28),sp=rand(2,9);
    particles.push({x:cx,y:bl.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-rand(1,4),life:1,decay:rand(.008,.02),s:rand(9,20),col:HEART_COLORS[Math.floor(rand(0,8))]});}
  for(let i=0;i<3;i++) spawnPHeart(cx+rand(-30,30), groundY); }
function defeatMonster(mo){ const i=monsters.indexOf(mo); if(i<0) return; monsters.splice(i,1); IA.premio(mo,-0.5); if(dominio && dominio.mo===mo) fecharDominio(true);
  G('evento','derrotou_monstro',[['monstro',NOME_FONTE[mo.kind]||mo.kind]],true);
  const cx=mo.x+mo.w/2, cy=mo.y+mo.h/2; shake=Math.min(24,shake+14);
  beep(140,0.3,'sawtooth',0.08); later(90,()=>beep(660,0.2,'sine',0.05));
  for(let k=0;k<34;k++){const a=rand(0,6.28),sp=rand(2,9);
    particles.push({x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-rand(1,4),life:1,decay:rand(.01,.02),s:rand(9,20),col:HEART_COLORS[Math.floor(rand(0,8))]});}
  for(let k=0;k<4;k++) spawnPHeart(cx+rand(-30,30), groundY);
  updateHUD(); checkWinLove(); }
function tocouAmeaca(){ if(state!=='play') return;
  G('evento','dano',[['fonte','nuvem que sobe']],false); puff(player.x+player.w/2,player.y+player.h,16,'#5a2a6a',4,12);
  if(mode==='infinite'){ damagePlayer(player.x,'nuvem que sobe'); return; }
  player.hp=0; updateHUD(); toast('☁️ A nuvem negativa te alcançou!',3,'#b58ad8'); die(); }
function tempoEsgotado(){ if(state!=='play') return; state='end'; G('fimFase','tempo_esgotado',{fase:level}); beep(200,0.3,'triangle',0.06);
  showScreen('<div class="broken" aria-hidden="true">⏰</div><h1>O tempo acabou!</h1><p>A Máquina do Amor ficou com '+rock.fill+' de '+rock.target+'. Fase bônus: não perde vida.</p>'+BTN('b','TENTAR DE NOVO','',true)+BTN('bm','MENU','ghost'),'lose-screen');
  on('b',()=>startLevel(level)); on('bm',()=>showMenu()); }
function regrasDaFase(){ const L=[], obj=cfg.objetivo||'apaixonar';
  const OBJ={apaixonar:['💞','Objetivo','Apaixone todos os tristes'+(monsters.length?' e derrote os monstros':'')+'.'], coletar:['💗','Objetivo','Capture corações e leve à Máquina do Amor ('+(rock?rock.target:0)+').'],
    saida:['🚪','Objetivo','Chegue à SAÍDA (a porta grande de coração).'], topo:['🗼','Objetivo','Toque no coração dourado do TOPO.'], resgate:['🛟','Objetivo','Todo apaixonado precisa pegar um coração (amor-próprio).']};
  L.push(OBJ[obj]||OBJ.apaixonar);
  if(cfg.especial) L.push([cfg.especial.icon,cfg.especial.nome,cfg.especial.txt]);
  if(cfg.type==='collect'&&cfg.bonusVar) L.push(['💕',BONUS_VAR[cfg.bonusVar].nome,BONUS_VAR[cfg.bonusVar].txt]);
  (M.tags||[]).forEach(tg=>{ if(MUTATORS[tg]) L.push([MUTATORS[tg].icon,tg,MUTATORS[tg].txt]); });
  if(platforms.some(p=>p.gira)) L.push(['📌','Prego','No meio ela fica parada; na beirada gira 90° e volta.']);
  if(platforms.some(p=>p.fragil)) L.push(['🪵','Ponte que quebra','Pisou, ela treme e cai; volta em 4 s.']);
  if(portas.length) L.push(['🚪','Portinha viva','Pulou perto, ela te engole e te joga na outra.']);
  if(ouro) L.push(['💛','Coração dourado','A próxima explosão acalma os apaixonados por perto.']);
  if(platforms.some(p=>p.trampolim)) L.push(['🦘','Trampolim','Pisou, ele te joga longe.']);
  if(ventos.length) L.push(['🌬️','Vento','As faixas com risquinhos te empurram no ar.']);
  if(subida) L.push(['⬆️','Ameaça que sobe','Encostar na nuvem de baixo = perder.']);
  if(monsters.some(m=>m.elite||m.kind==='boss')) L.push(['👑','Expansão de domínio','O monstro com coroa (ou o chefe) troca o cenário pelo mundo dele e te prende na arena. 3 explosões nele quebram o domínio (4 no chefe).']);
  if(unlocked('dominio')) L.push(['🌸','Seu domínio',(MOBILE?'Botão ◎':'Tecla G')+' com 70 de energia: 7 s de Santuário do Amor. Quebra o domínio de um monstro.']);
  if(monsters.some(m=>m.kind==='gelador')) L.push(['🧊','Gelador','Plataforma congelada escorrega por 6 s.']);
  if(monsters.some(m=>m.kind==='rachador')) L.push(['🪨','Rachador','O arco vermelho avisa: as plataformas perto caem por 4 s.']);
  if(monsters.some(m=>m.kind==='sombrio')) L.push(['🌑','Sombrio','Escurece em volta dele; a explosão ilumina.']);
  return L; }
function showRegras(){ const L=regrasDaFase();
  showScreen('<h1>Regras desta fase</h1><div class="tutGrid">'+L.map(r=>'<div class="card"><div class="cardIcon">'+r[0]+'</div><h3>'+r[1]+'</h3><p>'+r[2]+'</p></div>').join('')+'</div>'+BTN('rvolta','VOLTAR','',true),'tut-screen');
  on('rvolta',()=>{ state='play'; pauseGame(); }); }
function pisouEspinhos(){ if(state!=='play') return;
  if(player.shieldT>0){ player.vy=-11; player.onGround=false; return; }        // o escudo te salva e te joga pra cima
  G('evento','dano',[['fonte','espinhos da plataforma']],false); puff(player.x+player.w/2,player.y+player.h,16,'#5a2a5a',4,12);
  if(mode==='infinite'){ damagePlayer(player.x,'espinhos da plataforma'); return; }
  player.hp=0; updateHUD(); toast('💀 Você caiu nos espinhos!',3,'#ff5d5d'); die(); }
function dash(){ if(state!=='play') return; if(!unlocked('dash')||player.dashCD>0||player.stam<15){ beep(120,0.08,'square',0.04); return; }
  player.stam-=15; player.dashT=0.18; player.dashCD=0.7; player.invuln=Math.max(player.invuln,0.3); player.protT=0.3; puff(player.x+player.w/2,player.y+player.h/2,10,'#ffb3d1',3,10);
  beep(700,0.08,'sine',0.05); G('evento','usou_poder',[['poder','dash']],true); }
function placeWall(){ if(state!=='play') return;
  if(!unlocked('wall')){ beep(120,0.08,'square',0.04); return; }
  if(player.stam<WALL_COST){ beep(120,0.08,'square',0.04); return; } player.stam-=WALL_COST;
  const h=player.h*3, wx=player.x+player.w/2-9, wy=(player.y+player.h)-h;
  walls.push({x:wx,y:Math.max(0,wy),w:18,h,life:WALL_LIFE});
  beep(180,0.18,'square',0.06); later(80,()=>beep(120,0.25,'sawtooth',0.05));
  for(let i=0;i<14;i++) particles.push({x:wx+9,y:wy+rand(0,h),vx:rand(-1,1),vy:rand(-2,0),life:1,decay:.03,s:rand(6,12),col:'#b39ddb'}); }

// ===== [HABILIDADES] Poderes do jogador (ativos, equipáveis) — aparecem conforme a tabela UNLOCKS =====
const ACTIVE_POWERS={
  shot:{name:'Disparo de amor', cost:24, fire:fireLoveShot},
  wave:{name:'Onda de amor',    cost:34, fire:fireWave},
  shield:{name:'Escudo',        cost:40, fire:activateShield},
  laser:{name:'Laser de amor',  cost:46, fire:fireLaser},
  rain:{name:'Chuva de amor',   cost:38, fire:fireRain},
  guard:{name:'Coração de proteção', cost:42, fire:fireGuard},
  electric:{name:'Amor elétrico', cost:44, fire:fireElectric},
  ponte:{name:'Ponte de coração', cost:20, fire:firePonte},
  jardim:{name:'Jardim do amor',  cost:30, fire:fireJardim},
  terremoto:{name:'Terremoto do amor', cost:40, fire:fireTerremoto},
  tempo:{name:'Tempo lento',      cost:45, fire:fireTempo},
};
function powersForLevel(n){ return ['shot','ponte','wave','jardim','shield','laser','terremoto','rain','tempo','guard','electric'].filter(id=>unlocked(id,n)); }
// PONTE DE CORAÇÃO: plataforma de 6 s (na frente e um degrau acima; caindo = embaixo dos pés)
function firePonte(){ const pw=150, ar=!player.onGround;
  let x=ar?player.x+player.w/2-pw/2:player.x+player.w/2+player.face*120-pw/2, y=ar?player.y+player.h+6:player.y+player.h-Math.min(phBandH*0.95,JUMP_Hc*0.7);
  x=clamp(x,4,WORLD_W-pw-4); y=clamp(y,80,groundY-20);
  platforms.push({x,y,w:pw,h:14,band:99,cx:x+pw/2,hw:pw/2,mv:null,solid:true,tilt:0,extra:true,ponte:{t:6},ic:0,flor:0,flx:10});
  puff(x+pw/2,y,14,'#ff8fab',3,12); beep(600,0.1,'sine',0.05); later(70,()=>beep(900,0.12,'sine',0.04)); }
// JARDIM DO AMOR: corações e flores nas plataformas perto (limpa espinhos; apaixonado que pega coração se acalma)
function fireJardim(){ const pcx=player.x+player.w/2, pcy=player.y+player.h/2, dd=p=>dist(pcx,pcy,p.x+p.w/2,p.y);
  const ps=platforms.filter(p=>p.solid&&!p.dead&&!p.coracao&&!p.ponte&&p.band!==99&&dd(p)<560).sort((a,b)=>dd(a)-dd(b)).slice(0,5);
  for(const p of ps){ spawnPHeart(p.x+p.w/2,p.y); const h=pHearts[pHearts.length-1]; h.y=p.y-h.h; h.vy=0; h.rest=true; h.on=p;
    if(!p.mv&&!p.gira&&!p.arch&&!p.spine) p.flor=1+((p.ic|0)%3); p.espinhos=false; p.sujo=0; puff(p.x+p.w/2,p.y-10,10,'#c3f0ca',3,10); }
  if(!ps.length) spawnPHeart(pcx,groundY);
  beep(520,0.12,'sine',0.05); later(90,()=>beep(780,0.14,'sine',0.045)); G('evento','jardim',[['plataformas',String(ps.length)]],true); }
// TERREMOTO DO AMOR: muda o cenário em volta
function fireTerremoto(){ const pcx=player.x+player.w/2, pcy=player.y+player.h/2, R=720; shake=Math.min(34,shake+26);
  beep(60,0.5,'sawtooth',0.08); later(120,()=>beep(90,0.4,'sawtooth',0.06));
  for(const p of platforms){ if(Math.abs(p.x+p.w/2-pcx)>R||Math.abs(p.y-pcy)>R*0.8) continue; p.tremor=0.9;
    if(p.espinhos){ p.espinhos=false; p.sujo=0; puff(p.x+p.w/2,p.y,8,'#ffd6e0',3,9); }
    if(p.gira && p.gira.fase==='parado' && p!==player.platRef){ p.gira.fase='girando'; p.gira.dir=(p.x+p.w/2>pcx)?1:-1; p.gira.t=0; } }
  for(const mo of monsters.slice()){ if(Math.abs(mo.x+mo.w/2-pcx)>R||Math.abs(mo.y-pcy)>R*0.8) continue; mo.stun=Math.max(mo.stun||0,1.6);
    if(!mo.float && mo.kind!=='tentacle'){ mo.vy=-9; mo.onGround=false; } if(mo.hitT<=0){ mo.hp--; mo.hitT=0.4; if(mo.hp<=0) defeatMonster(mo); } }
  for(const n of npcs){ if(Math.abs(n.x+n.w/2-pcx)>R||Math.abs(n.y-pcy)>R*0.8) continue; if(n.state==='happy') n.grace=Math.max(n.grace,1.4); if(n.onGround){ n.vy=-6; n.onGround=false; } }
  for(const bl of blocks) if(bl.state==='idle' && dist(pcx,pcy,bl.x+bl.w/2,bl.y)<R*0.6){ bl.state='hit'; bl.t=1.2; }
  for(let k=0;k<26;k++) particles.push({x:pcx+rand(-R*0.6,R*0.6),y:player.y+player.h,vx:rand(-1.5,1.5),vy:-rand(2,6),life:1,decay:rand(.02,.04),s:rand(6,12),col:k%2?'#c9a46b':'#ffd6e0'});
  G('evento','terremoto',null,true); }
// TEMPO LENTO: monstros, apaixonados, tiros e plataformas móveis a 1/3
function fireTempo(){ lentoT=4; beep(300,0.3,'sine',0.06); later(150,()=>beep(200,0.4,'sine',0.05)); puff(player.x+player.w/2,player.y+player.h/2,16,'#bfe0ff',4,12); }

// ===== EXPANSÃO DE DOMÍNIO (estilo anime): o cenário vira o mundo de quem abriu, com uma regra própria =====
// Monstros de ELITE (coroa 👑) e chefes abrem quando você chega perto: paredes prendem a arena por alguns segundos.
// Quebrar: 3 explosões no dono (4 no chefe), aguentar até acabar, ou abrir o SEU domínio (choque de domínios).
const DOM_TIPOS={
  coracaoNegro:{nome:'CORAÇÃO NEGRO ETERNO',  estilo:'void',  hue:345, cor:'#ff2e63', txt:'Chovem corações negros do céu!'},
  tristeza:    {nome:'MAR DA TRISTEZA',       estilo:'static',hue:220, cor:'#9aa7c7', txt:'Você fica lento e os apaixonados voltam a ficar tristes!'},
  labirinto:   {nome:'LABIRINTO SEM FIM',     estilo:'grid',  hue:190, cor:'#7fe0ff', txt:'As plataformas mudam de lugar sem parar!'},
  sombras:     {nome:'JARDIM DAS SOMBRAS',    estilo:'eyes',  hue:280, cor:'#a58bff', txt:'A luz apagou: você só enxerga perto de você!'},
  gelo:        {nome:'REINO DO GELO ETERNO',  estilo:'tiles', hue:195, cor:'#bfefff', txt:'Todas as plataformas congelaram: escorrega!'},
  furia:       {nome:'ARENA DA FÚRIA',        estilo:'mirror',hue:0,   cor:'#ff5d5d', txt:'Os monstros ficam mais rápidos e soltam espinhos!'},
  amor:        {nome:'SANTUÁRIO DO AMOR INFINITO', estilo:'stars', hue:330, cor:'#ff8fab', txt:'Os tristes se apaixonam e os monstros enfraquecem!'} };
const DOM_CUSTO=70;
function tipoDominio(mo){ if(!mo) return 'amor'; const k=mo.kind;
  return k==='boss'?'coracaoNegro':(k==='tristonho'?'tristeza':(k==='arquiteto'?'labirinto':((k==='camaleao'||k==='sombrio')?'sombras':(k==='gelador'?'gelo':'furia')))); }
function corA(hex,a){ const n=parseInt(hex.slice(1),16); return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')'; }
function abrirDominio(dono,mo){ if(state!=='play') return false;
  if(dominio){ if(dono==='jogador' && dominio.dono==='monstro'){ fecharDominio(true,true); toast('💥 CHOQUE DE DOMÍNIOS! O seu amor quebrou o domínio do monstro!',4,'#ffd166'); G('evento','choque_dominios',null,true); }
    else return false; }
  const tipo=dono==='jogador'?'amor':tipoDominio(mo), T=DOM_TIPOS[tipo], R=700;
  const cx=dono==='jogador'?player.x+player.w/2:mo.x+mo.w/2;
  dominio={dono,mo:mo||null,tipo,T,t:0,dur:dono==='jogador'?7:9,aviso:dono==='jogador'?1.1:1.8,hp:(mo&&mo.kind==='boss')?4:3,
    x0:Math.max(0,cx-R),x1:Math.min(WORLD_W,cx+R),prende:dono==='monstro'&&!M.wrap,tick:0.8,tick2:1.5,
    velP:tipo==='tristeza'?0.72:1, velM:tipo==='furia'?1.45:(tipo==='amor'?0.6:1), orig:{PAL,style:M.style,fog:M.fog}};
  PAL=palFromHue(T.hue,false); M.style=T.estilo; if(tipo==='sombras') M.fog=true; BD=null; FOG=null; buildBackdrop(); groundGrad=null; drawDirty=true;
  if(tipo==='gelo') for(const p of platforms){ const c=p.x+p.w/2; if(c>dominio.x0&&c<dominio.x1) p.gelo=dominio.dur; }
  shake=Math.min(30,shake+22); beep(dono==='jogador'?520:90,0.4,dono==='jogador'?'sine':'sawtooth',0.08); later(180,()=>beep(dono==='jogador'?780:60,0.5,dono==='jogador'?'sine':'sawtooth',0.07)); later(420,()=>beep(dono==='jogador'?1040:130,0.4,'triangle',0.06));
  puff(cx,(mo?mo.y+mo.h/2:player.y+player.h/2),40,T.cor,8,18);
  G('evento','dominio_aberto',[['dono',dono],['tipo',tipo]],dono==='jogador');
  return true; }
function fecharDominio(quebrado,silencioso){ const D=dominio; if(!D) return; dominio=null;
  PAL=D.orig.PAL; M.style=D.orig.style; M.fog=D.orig.fog; BD=null; FOG=null; buildBackdrop(); groundGrad=null; drawDirty=true;
  if(D.tipo==='gelo') for(const p of platforms) if(p.gelo>0) p.gelo=Math.min(p.gelo,1.5);
  if(D.dono==='monstro' && quebrado && D.mo && monsters.indexOf(D.mo)>=0){ D.mo.stun=3; D.mo.hitT=0.5; }
  if(silencioso) return;
  if(D.dono==='monstro' && quebrado){ shake=Math.min(26,shake+16); beep(880,0.2,'sine',0.07); later(120,()=>beep(1320,0.25,'sine',0.06)); puff(player.x+player.w/2,player.y,26,'#ffd166',6,14);
    toast('💖 Você QUEBROU o domínio! O monstro ficou tonto 💫',3.5,'#ffd166'); G('evento','dominio_quebrado',null,true); }
  else toast(D.dono==='jogador'?'🌸 O seu domínio terminou':'O domínio acabou e o cenário voltou ao normal',2.5,'#cfe8ff'); }
function usarDominio(){ if(state!=='play') return; if(!unlocked('dominio')||player.stam<DOM_CUSTO||(dominio&&dominio.dono==='jogador')){ beep(120,0.08,'square',0.04); return; }
  player.stam-=DOM_CUSTO; abrirDominio('jogador',null); updateHUD(); }
function dominioTick(dt){ const D=dominio; if(!D) return; D.t+=dt; if(D.aviso>0) D.aviso-=dt;
  if(D.dono==='monstro' && (!D.mo || monsters.indexOf(D.mo)<0)){ fecharDominio(true); return; }
  if(D.t>=D.dur){ fecharDominio(false); return; }
  const dentro=e=>{ const ex=e.x+e.w/2; return ex>D.x0 && ex<D.x1 && Math.abs(e.y-player.y)<800; };
  const pcx=player.x+player.w/2, pcy=player.y+player.h/2;
  D.tick-=dt; D.tick2-=dt;
  if(Q.tier>0 && Math.random()<0.5){ const col=D.tipo==='gelo'?'#ffffff':(D.tipo==='tristeza'?'#8a95b5':D.T.cor);
    particles.push({x:camX+rand(0,W),y:D.tipo==='amor'?camY+H:camY-10,vx:rand(-0.5,0.5),vy:D.tipo==='amor'?-rand(3,5):rand(2,5),life:1,decay:.012,s:rand(5,10),col}); }
  if(D.tipo==='coracaoNegro' && D.tick<=0 && D.aviso<=0){ D.tick=0.55;
    for(let k=0;k<2 && shots.length<70;k++){ const sx=rand(Math.max(D.x0,camX),Math.min(D.x1,camX+W)); shots.push({x:sx,y:camY-10,vx:rand(-0.6,0.6),vy:4.2,life:0,maxLife:4,sw:rand(0,6.28)}); } }
  if(D.tipo==='tristeza' && D.tick<=0 && D.aviso<=0){ D.tick=2.2; let alvo=null, bd=1e9;
    for(const n of npcs){ if(n.state==='happy'&&!n.holding&&dentro(n)){ const d=dist(pcx,pcy,n.x+n.w/2,n.y+n.h/2); if(d<bd){ bd=d; alvo=n; } } }
    if(alvo){ alvo.state='sad'; alvo.grace=0; alvo.perso=null; puff(alvo.x+alvo.w/2,alvo.y,10,'#8a8095',3,10); avisoMonstros=false; updateHUD(); } }
  if(D.tipo==='labirinto' && D.tick<=0 && D.aviso<=0){ D.tick=1.3;
    const pool=platforms.filter(p=>!p.spine&&!p.mv&&!p.gira&&p.band!==99&&!p.shift&&!p.temPorta&&p.solid&&p!==player.platRef&&dentro(p)&&dist(pcx,pcy,p.x+p.w/2,p.y)<650);
    const p=pool[Math.floor(Math.random()*pool.length)]; if(p){ const dx=clamp((Math.random()<.5?-1:1)*rand(110,170),10-p.x,WORLD_W-p.w-10-p.x); p.shift={from:p.x,to:p.x+dx,t:0,warn:0.5}; } }
  if(D.tipo==='furia' && D.tick<=0 && D.aviso<=0 && D.mo){ D.tick=2.8; if(spikesW.length<8) for(const dr of [-1,1]) spikesW.push({x:D.mo.x+D.mo.w/2,dir:dr,dist:0,maxDist:520}); beep(150,0.18,'square',0.05); }
  if(D.tipo==='amor'){ for(let i=shots.length-1;i>=0;i--){ const s=shots[i]; if(s.x>D.x0&&s.x<D.x1){ puff(s.x,s.y,4,'#ff8fab',2,8); shots.splice(i,1); } }
    if(D.tick<=0){ D.tick=0.35; for(let k=0;k<2;k++){ let alvo=null, bd=1e9; for(const n of npcs){ if(n.state==='sad'&&dentro(n)){ const d=dist(pcx,pcy,n.x+n.w/2,n.y+n.h/2); if(d<bd){ bd=d; alvo=n; } } } if(alvo) makeHappy(alvo,'domínio'); } }   // 2 por vez (até ~38 em 7 s)
    if(D.tick2<=0){ D.tick2=1.5; for(const mo of monsters.slice()){ if(dentro(mo) && mo.hitT<=0){ mo.hp--; mo.hitT=0.4; puff(mo.x+mo.w/2,mo.y+mo.h/2,8,'#ff8fab',3,10); if(mo.hp<=0) defeatMonster(mo); } } } } }
function usePower(){ if(state!=='play'||!player.powers.length)return; const id=player.powers[player.equip], P=ACTIVE_POWERS[id];
  if(player.stam<P.cost){ beep(120,0.08,'square',0.04); return; } player.stam-=P.cost; P.fire(); G('evento','usou_poder',[['poder',P.name]],true); updateHUD(); }
function cyclePower(){ if(state==='play' && player.powers.length>1){ player.equip=(player.equip+1)%player.powers.length; beep(560,0.07,'sine',0.05); updateHUD(); } }
function fireLoveShot(){ const dir=player.face||1, sz=18+Math.min(level*0.25,18);
  loveShots.push({x:player.x+player.w/2,y:player.y+player.h*0.42,vx:dir*9,sz,life:0,hit:[]}); beep(720,0.12,'sine',0.06); shake=Math.min(12,shake+5); }
function fireWave(){ const y=player.y+player.h, maxD=280+Math.min(level*6,360);
  for(const dir of [-1,1]) waves.push({cx:player.x+player.w/2,y,dir,dist:0,maxDist:maxD,h:64,hit:[]});
  beep(300,0.16,'sine',0.06); shake=Math.min(14,shake+6); }
function activateShield(){ player.shieldT=5; beep(440,0.15,'sine',0.06); later(80,()=>beep(660,0.18,'sine',0.05)); }
function fireLaser(){ const dir=player.face||1, by=player.y+player.h*0.45, band=player.h*0.85, pcx=player.x+player.w/2;
  player.laserLock=1.6;
  for(const n of npcs){ if(n.state==='sad' && Math.sign((n.x+n.w/2)-pcx)===dir && Math.abs((n.y+n.h/2)-by)<band){ makeHappy(n,'laser'); n.vx=dir*6; } }
  for(const mo of monsters.slice()){ if(Math.sign((mo.x+mo.w/2)-pcx)===dir && Math.abs((mo.y+mo.h/2)-by)<band+mo.h*0.5){ mo.hp-=3; mo.hitT=0.4; mo.vx+=dir*9; if(mo.hp<=0)defeatMonster(mo); } }
  lasers.push({x:pcx,y:by,dir,life:0.55}); beep(900,0.25,'sawtooth',0.07); shake=Math.min(20,shake+12); }
function fireRain(){ player.rainT=2.6; beep(520,0.2,'sine',0.06); }
function fireGuard(){ player.guard={hp:3,maxHp:3,t:30,x:player.x+player.w/2,y:player.y-46}; beep(620,0.16,'sine',0.06); later(80,()=>beep(820,0.16,'sine',0.05)); }
function fireElectric(){ player.elec={t:4,fireT:0}; beep(760,0.14,'square',0.05); }
function fireDivine(){ if(state!=='play'||player.stam<MAX_STAM||!unlocked('divine'))return;   // ULTIMATE: só com a barra cheia
  player.stam=0; divineFx={x:player.x+player.w/2,y:player.y+player.h/2,r:0,maxR:Math.hypot(WORLD_W,WORLD_H),life:0,maxLife:1.3};
  for(const n of npcs.slice()){ if(n.state==='sad') makeHappy(n,'amor divino'); }
  for(const mo of monsters.slice()) defeatMonster(mo);
  shots.length=0;
  shake=Math.min(32,shake+26); beep(660,0.4,'sine',0.09); later(120,()=>beep(990,0.5,'sine',0.08));
  updateHUD(); checkWinLove(); }

function damagePlayer(srcx,fonte){ if(state!=='play')return; if(player.protT>0) return;   // proteção garantida (porta 0,7 s / dash) em qualquer modo
  if(player.shieldT<=0 && !(player.invuln>0 && mode!=='infinite')) G('evento','dano',[['fonte',fonte||'desconhecida']],false);
  if(player.shieldT>0) return;
  if(player.guard && player.guard.hp>0){ if(player.invuln>0) return; player.guard.hp--; player.invuln=0.6; shake=12; beep(520,0.12,'square',0.05);
    puff(player.guard.x,player.guard.y,10,'#7fffd4',3,10);
    if(player.guard.hp<=0) player.guard=null; return; }
  if(mode==='infinite'){ if(pendingReset)return; deaths++; deepest=Math.max(deepest,level); shake=22; beep(110,0.35,'sawtooth',0.08);
    puff(player.x+player.w/2,player.y+player.h/2,22,'#ff3b3b',5,14);
    G('fimFase','derrota',{fase:level}); pendingReset=true; return; }
  if(player.invuln>0)return; player.hp--; player.invuln=1.2;
  player.vx=(Math.sign((player.x+player.w/2)-srcx)||1)*7; player.vy=-6.5; shake=18;
  beep(160,0.25,'sawtooth',0.08);
  puff(player.x+player.w/2,player.y+player.h/2,16,'#ff3b3b',4,12);
  updateHUD(); if(player.hp<=0) die(); }

// ===== [MOTORES] um passo de simulação (SEMPRE 1/60 s — igual em qualquer aparelho) =====
function update(dt){
  dt=STEP;
  time+=dt; player.stam=Math.min(MAX_STAM,player.stam+player.stamRegenLvl*dt);
  if(player.invuln>0) player.invuln-=dt; if(player.protT>0) player.protT-=dt;
  if(player.biteCD>0) player.biteCD-=dt;
  if(player.slowT>0){ player.slowT-=dt; if(player.slowT<=0) player.agility=1; }
  if(player.rootT>0) player.rootT-=dt;
  if(player.shieldT>0){ player.shieldT-=dt; const R=player.w*1.9, pcx=player.x+player.w/2, pcy=player.y+player.h/2;
    const push=o=>{ const ox=o.x+o.w/2, oy=o.y+o.h/2, dd=Math.hypot(ox-pcx,oy-pcy); if(dd<R+Math.max(o.w,o.h)*0.4){ const a=Math.atan2(oy-pcy,ox-pcx); o.x=clamp(o.x+Math.cos(a)*6,0,WORLD_W-o.w); o.vy=Math.min(o.vy,-2); } };
    for(const n of npcs) if(n.state==='happy') push(n); for(const mo of monsters) if(mo.kind!=='tentacle'&&mo.kind!=='boss') push(mo); }
  updatePlatforms();
  if(toastT>0) toastT-=dt; if(tristeT>0) tristeT-=dt; if(luzT>0) luzT-=dt; if(lentoT>0) lentoT-=dt;
  if(batida && state==='play'){ batida.t+=dt; if(batida.t>=batida.per){ batida.t-=batida.per; batida.n++; beep(batida.n%2?880:660,0.05,'sine',0.025); } }   // ritmo das plataformas musicais
  if(state==='play') atualizarPortas(dt);
  if(state==='play' && dominio) dominioTick(dt);

  if(state==='play'){
    const slow=player.charging?0.5:1, stick=(player.stickT>0?0.35:1), mm=effMoveMax()*player.agility*stick*slow*(dominio?dominio.velP:1), jv=effJump()*(player.stickT>0?0.62:1);
    // ANDAR: aceleração, virada rápida (frente↔trás sem patinar), atrito no chão e controle no ar
    const dir=(keys.right&&!keys.left)?1:((keys.left&&!keys.right)?-1:0);
    const onG=player.onGround, ice=(M.ice||(player.platRef&&player.platRef.gelo>0))&&onG;
    if(dir){ player.face=dir;
      let acc=phMove*slow*(onG?1:0.8)*(ice?0.45:1);
      if(player.vx*dir<0) acc*=(ice?1.3:2.6);                   // trocou de lado: freia e vira rápido
      const v=player.vx+dir*acc;
      if(Math.abs(v)>mm) player.vx=Math.sign(v)*Math.max(mm, Math.abs(player.vx)*0.9);   // empurrão acima do limite vai sumindo
      else player.vx=v;
    } else { player.vx*= onG ? (ice?0.965:phFric) : 0.93; }
    if(Math.abs(player.vx)<0.05) player.vx=0;
    if(player.dashCD>0) player.dashCD-=dt;
    if(player.dashT>0){ player.dashT-=dt; player.vx=player.face*17; player.vy=Math.min(player.vy,1); }   // DASH de amor
    if(player.laserLock>0){ player.laserLock-=dt; player.vx=0; }
    if(player.rootT>0){ player.vx=0; }
    // PULO: tempo de coiote, pulo guardado, pulos no ar e pulo variável (soltar cedo = pulo menor)
    if(onG){ player.coyote=COYOTE; player.jumps=0; }
    else { player.coyote=Math.max(0,player.coyote-dt); if(player.coyote<=0 && player.jumps===0) player.jumps=1; }  // saiu da borda: o pulo do chão conta
    const pressed=(keys.jump&&!player.prevJump)||jumpQueued;
    if(pressed) player.jumpBuf=JUMP_BUF; else player.jumpBuf=Math.max(0,player.jumpBuf-dt);
    if(player.jumpBuf>0 && (player.onGround||player.coyote>0)){
      player.ultimoPulo=time; player.vy=jv; player.onGround=false; player.jumps=1; player.coyote=0; player.jumpBuf=0; player.jumpCut=true; player.platRef=null; beep(440,0.09,'square',0.04);
    } else if(pressed && !player.onGround && player.coyote<=0 && player.jumps<player.maxJumps){
      player.ultimoPulo=time; player.vy=jv*0.92; player.jumps++; player.jumpBuf=0; player.jumpCut=true; beep(580,0.09,'square',0.045);
      for(let i=0;i<8;i++){const a=rand(0,6.28);particles.push({x:player.x+player.w/2,y:player.y+player.h,vx:Math.cos(a)*2,vy:Math.sin(a)*1.4+1.2,life:1,decay:.04,s:rand(5,9),col:'#ff8fab'});}
    }
    if(player.jumpCut){ if(player.vy>=0) player.jumpCut=false; else if(!keys.jump){ player.vy=Math.max(player.vy, jv*0.66); player.jumpCut=false; } }
    player.prevJump=keys.jump; jumpQueued=false;
    if(keys.charge&&player.stam>=player.blastCost){player.charging=true;player.charge=Math.min(1,player.charge+dt*0.85);}
    let nx=player.x+player.vx, wrapped=false;
    if(M.wrap){ if(nx<-player.w*0.5){ nx+=WORLD_W; wrapped=true; } else if(nx>WORLD_W-player.w*0.5){ nx-=WORLD_W; wrapped=true; } }
    else nx=clamp(nx,0,WORLD_W-player.w);
    player.x=nx; if(wrapped) wrapCam();
    if(dominio && dominio.prende){ const cl=clamp(player.x,dominio.x0,dominio.x1-player.w); if(cl!==player.x){ player.x=cl; player.vx=0; } }   // a arena do domínio prende você
    if(player.onGround) ride(player);
    applyVertical(player);
    if(player.onGround) player.jumps=0;
    if(player.onGround && player.platRef && player.platRef.espinhos) pisouEspinhos();
    if(player.onGround && player.platRef && player.platRef.trampolim){ const tp=player.platRef.trampolim; player.vy=player.jumpBase*1.6; player.vx+=tp.lado*11; player.onGround=false; player.platRef=null;
      player.jumps=1; player.jumpCut=false; tp.t=0.25; beep(520,0.12,'triangle',0.06); later(60,()=>beep(780,0.1,'sine',0.05)); G('evento','trampolim',null,true); }
    if(meta && (cfg.objetivo==='saida'||cfg.objetivo==='topo') && overlap(player,meta)){ puff(meta.x+meta.w/2,meta.y+meta.h/2,30,'#ffd166',6,16); G('evento','chegou_na_meta',null,true); levelClear(); }
    if(subida){ if(subida.atraso>0) subida.atraso-=dt; else subida.y-=subida.vel*dt; if(state==='play' && player.y+player.h>subida.y+8) tocouAmeaca(); }
    for(const v of ventos){ if(v.troca){ v.t+=dt; if(v.t>v.troca-2&&!v.aviso){ v.aviso=1; toast('🌬️ O vento vai virar!',2,'#cfe8ff'); } if(v.t>=v.troca){ v.t=0; v.aviso=0; v.fx=-v.fx; } }
      const pcx2=player.x+player.w/2; if(pcx2>v.x&&pcx2<v.x+v.w){ player.vx+=v.fx*(player.onGround?0.4:1); if(!player.onGround) player.vy+=v.fy*0.5; } }
    if(ouro){ ouro.sw+=dt; if(dist(player.x+player.w/2,player.y+player.h/2,ouro.x,ouro.y)<42){ player.dourado=true; ouro=null; beep(880,0.2,'sine',0.06); later(90,()=>beep(1320,0.25,'sine',0.05));
        toast('✨ Coração dourado! Sua próxima explosão acalma os apaixonados por perto',4,'#ffd166'); G('evento','pegou_coracao_dourado',null,true); } }
    { let perto=false; for(const mo of monsters){ if(Math.abs(mo.x+mo.w/2-player.x-player.w/2)<150 && Math.abs(mo.y-player.y)<120){ perto=true; break; } }   // aprende: você pula quando o monstro chega?
      if(perto) IA.habito('pulaFuga', player.vy<-3?1:0, 0.01); }
    IA.tick(dt);
    if(M.echo){ player.echoT-=dt; if(player.echoT<=0){ player.echoT=0.09; echoes.push({x:player.x,y:player.y,f:player.face,a:0.35}); if(echoes.length>7) echoes.shift(); } }
  }
  for(const e of echoes) e.a-=dt*0.5;

  for(let i=walls.length-1;i>=0;i--){ walls[i].life-=dt; if(walls[i].life<=0) walls.splice(i,1); }

  for(let i=blocks.length-1;i>=0;i--){ const bl=blocks[i]; bl.sw+=dt;
    if(bl.state==='hit'){ bl.t-=dt; if(bl.t<=0) bl.state='fall'; }
    else if(bl.state==='fall'){ bl.vy=Math.min(bl.vy+phGrav,MAX_FALL); bl.y+=bl.vy;
      if(bl.y+bl.h>=groundY){ bl.y=groundY-bl.h; explodeBlock(bl); blocks.splice(i,1); } } }

  // longe da tela = "dormindo" (como em todo jogo de rolagem lateral): tristes longe atualizam 1 a cada 4 passos e monstros longe esperam você chegar
  const fc=Math.round(time*60), ccx=camX+W/2, ccy=camY+H/2, farX=W*1.3+400, farY=H*1.3+300;
  const far=e=>Math.abs(e.x-ccx)>farX || Math.abs(e.y-ccy)>farY;
  for(let ni=npcs.length-1; ni>=0; ni--){ const n=npcs[ni]; if(!n) continue;
    if(n.state==='sad' && n.onGround && ((fc+ni)&3)!==0 && far(n)) continue;
    if(lentoT>0 && ((fc+ni)%3)!==0) continue;   // tempo lento
    if(n.grace>0) n.grace-=dt; n.bob+=dt*6;
    if(n.state==='frozen'){ n.freezeT-=dt; n.shake+=dt; if(n.freezeT<=0){ explodeHappy(n); } continue; }
    if(n.state==='sad'){
      const fastM=(n.def&&n.def.fast)?2.0:1;
      // ATRAÍDO pelo coração no chão mais próximo (corações que saem dos blocos e dos monstros)
      let lured=null, ld=260; const ncx=n.x+n.w/2, ncy=n.y+n.h/2;
      for(const ph of pHearts){ if(!ph.rest) continue; const d=Math.abs((ph.x+ph.w/2)-ncx); if(d<ld && Math.abs((ph.y+ph.h/2)-ncy)<90){ ld=d; lured=ph; } }
      if(n.platRef){ if(n.x<=n.platRef.x) n.dir=1; if(n.x>=n.platRef.x+n.platRef.w-n.w) n.dir=-1;
        if(lured) n.dir=Math.sign((lured.x+lured.w/2)-ncx)||n.dir; n.vx=n.dir*0.7*fastM; }
      else { if(lured){ n.dir=Math.sign((lured.x+lured.w/2)-ncx)||n.dir; }
             else { n.wander-=1; if(n.wander<=0){ n.dir=Math.random()<.5?-1:1; if(Math.random()<.3)n.dir=0; n.wander=rand(50,170); } }
             n.vx=n.dir*0.9*fastM; if(n.x<=0)n.dir=1; if(n.x>=WORLD_W-n.w)n.dir=-1; }
      { const nia=IA.nivel();
        if(nia>=1 && player.charging && Math.abs(player.x-n.x)<220 && Math.abs(player.y-n.y)<120 && Math.random()<0.02*nia){ n.dir=Math.sign(n.x-player.x)||1; n.vx=n.dir*1.6; }   // aprendeu a fugir da explosão
        if(nia>=2 && n.onGround && n.platRef && Math.random()<0.0015*nia){ n.vy=phBaseJump*0.6; n.onGround=false; } }                                   // começa a pular entre plataformas
      if(n.def&&n.def.bug){ n.bugT-=dt; if(n.bugT<=0){ n.bugT=rand(0.5,2.2);
        n.x=clamp(n.x+(Math.random()<.5?-1:1)*rand(12,40),0,WORLD_W-n.w); n.vy=-rand(1,4);
        for(let q=0;q<5;q++) particles.push({x:n.x+n.w/2,y:n.y+n.h/2,vx:rand(-2,2),vy:rand(-2,2),life:1,decay:.05,s:rand(4,8),col:'#7fb0ff'}); } }
    } else if(n.state==='happy'){
      n.stuck=false;
      if(n.holding){ n.wander-=1; if(n.wander<=0){ n.dir=Math.random()<.5?-1:1; if(Math.random()<.3)n.dir=0; n.wander=rand(50,170); }
        n.vx=n.dir*0.8; if(n.x<=0)n.dir=1; if(n.x>=WORLD_W-n.w)n.dir=-1;
      } else if(n.grace<=0 && cfg.type==='love'){
        let grabbed=false;
        for(let k=pHearts.length-1;k>=0;k--){ const ph=pHearts[k]; if(ph.rest && overlap(n,ph)){ pHearts.splice(k,1); n.holding=true; n.vx=0; grabbed=true; beep(820,0.1,'sine',0.05); checkWinLove(); updateHUD(); break; } }
        if(!grabbed){ const px=player.x+player.w/2, nx=n.x+n.w/2, pe=n.perso||'romantico'; let alvo=px, vel=cfg.follow; n.ciume=false; n.corado=false;
          if(pe==='calculista') alvo=px+player.vx*25;                                                              // 🧐 tenta te interceptar
          else if(pe==='carente') vel*=1+clamp(Math.abs(px-nx)/600,0,1.2);                                         // 🥺 acelera quando fica longe
          else if(pe==='ciumento'){ const dm=Math.abs(px-nx); n.ciume=npcs.some(o=>o!==n&&o.state==='happy'&&!o.holding&&Math.abs(px-(o.x+o.w/2))<dm-20); if(n.ciume) vel*=1.6; }   // 😠 não deixa outro chegar antes
          else if(pe==='timido'){ const olhando=Math.sign(nx-px)===player.face; if(!olhando){ vel=0; n.corado=true; } }   // 😳 só vem quando você olha pra ele
          else if(pe==='impulsivo'){ vel*=1.1; if(n.onGround && Math.random()<0.01){ n.vy=phBaseJump*0.6; n.onGround=false; } }   // 🤪 zigue-zague e pulinhos
          if(n.inchou) vel*=0.85;   // gigante não fica mais rápido: é perigoso pelo tamanho
          n.vx=Math.sign(alvo-nx)*vel+(pe==='impulsivo'?Math.sin(time*6+n.bob)*1.6:0);
          if(n.onGround && player.y<n.y-26 && Math.abs(px-nx)<240 && vel>0){ n.vy=phBaseJump*(n.inchou?0.68:0.82); n.onGround=false; } }
      } else n.vx*=0.82;
      n.heartTrail-=dt; if(n.heartTrail<=0){ n.heartTrail=0.22;
        particles.push({x:n.x+n.w/2,y:n.y,vx:rand(-.4,.4),vy:-1.4,life:1,decay:.03,s:rand(5,9),col:'#ff8fab'}); }
    }
    const nx=clamp(n.x+n.vx,0,WORLD_W-n.w);
    let blocked=false;
    if(n.state==='happy'&&!n.holding){ for(const w of walls){
      if(nx<w.x+w.w&&nx+n.w>w.x&&n.y+n.h>w.y&&n.y<w.y+w.h){ blocked=true; n.stuck=true; break; } } }
    if(!blocked) n.x=nx; else n.vx=0;
    ride(n); applyVertical(n);
    if(n.onGround&&n.platRef&&n.platRef.fragil) n.platRef.fragil.toque=true;   // perseguidores também derrubam pontes
  }

  // MONSTROS
  for(let mi=monsters.length-1; mi>=0; mi--){ const mo=monsters[mi]; if(!mo) continue; if(mo.hitT>0) mo.hitT-=dt; mo.bob+=dt*5;
    if(mo.kind!=='boss' && (mo.onGround||mo.float) && far(mo)) continue;
    if(lentoT>0 && ((fc+mi)%3)!==0) continue;                                   // tempo lento
    if(mo.stun>0){ mo.stun-=dt; if(!mo.float){ mo.vx*=0.85; mo.x=clamp(mo.x+mo.vx,0,WORLD_W-mo.w); ride(mo); applyVertical(mo); } continue; }   // tonto
    const px=player.x+player.w/2, nx=mo.x+mo.w/2, py=player.y+player.h/2, ny=mo.y+mo.h/2;
    if(mo.float){ // ESFERA CHORONA: flutua e prende o jogador
      mo.x=clamp(mo.x+(px-nx)*0.012,0,WORLD_W-mo.w); mo.y=clamp(mo.y+(py-60-ny)*0.012, 0, groundY-mo.h);
      mo.grabCD-=dt; if(mo.grabCD<=0 && dist(px,py,nx,ny)<220 && state==='play'){ mo.grabCD=2.6; player.rootT=Math.max(player.rootT,1.0); player.slowT=3; beep(120,0.2,'sawtooth',0.05); }
      continue; }
    // mais espertos: miram onde você VAI estar e fogem quando você está carregando uma explosão forte por perto
    if(!mo.estr || (mo.estrT-=dt)<=0){ mo.estr=IA.escolher(); mo.estrT=rand(5,8); }
    let alvoX=px+player.vx*16;
    if(mo.estr==='cercar'){ let outro=null, od=1e9; for(const o of monsters){ if(o===mo) continue; const dd=Math.abs(o.x-mo.x); if(dd<od&&dd<900){ od=dd; outro=o; } }
      if(outro){ const lado=Math.sign(px-(outro.x+outro.w/2))||1; alvoX=px+lado*110; } }                                            // fecha o cerco pelo outro lado
    else if(mo.estr==='emboscar'){ if(!player.onGround) alvoX=px+player.vx*28; else if(IA.dados.pulaFuga>0.5 && Math.abs(px-nx)<260) alvoX=nx; }   // espera você pular e vai onde você cai
    else if(mo.estr==='cautela'){ const raio=(IA.dados.distExplode||150)+50; if(player.stam>=player.blastCost && Math.abs(px-nx)<raio) alvoX=nx+Math.sign(nx-px)*80; }   // fora do alcance até você ficar sem energia
    let alvoDir=Math.abs(alvoX-nx)<6?0:(Math.sign(alvoX-nx)||0);
    const foge=(mo.kind==='chaser'||mo.kind==='dog'||mo.kind==='eater'||mo.kind==='arquiteto') && player.charging && player.charge>0.35 && dist(px,py,nx,ny)<blastMaxR(player.charge)+60;
    if(foge){ alvoDir=-(Math.sign(px-nx)||1); if(mo.onGround && Math.random()<0.03){ mo.vy=phBaseJump*0.7; mo.onGround=false; } }
    else if(mo.kind==='arquiteto' && Math.abs(px-nx)<280) alvoDir=-alvoDir*0.5;           // o arquiteto mantém distância e mexe no cenário
    mo.vx += (alvoDir*mo.sp*(IA.nivel()>3?1.08:1)*(dominio?dominio.velM:1) - mo.vx)*0.12;
    if(mo.kind!=='shooter' && mo.kind!=='boss' && mo.kind!=='tentacle' && mo.onGround && player.y<mo.y-30 && Math.abs(px-nx)<260 && Math.random()<0.04){ mo.vy=phBaseJump*0.8; mo.onGround=false; }
    let bl=false; const mxx=clamp(mo.x+mo.vx,0,WORLD_W-mo.w);
    for(const w of walls){ if(mxx<w.x+w.w&&mxx+mo.w>w.x&&mo.y+mo.h>w.y&&mo.y<w.y+w.h){ bl=true; break; } }
    if(!bl) mo.x=mxx; else mo.vx=0; ride(mo); applyVertical(mo);
    if(mo.onGround&&mo.platRef&&mo.platRef.fragil) mo.platRef.fragil.toque=true;
    // monstro que fica pisando muito numa plataforma deixa ela ESCURA e nascem ESPINHOS (cair neles mata; explosão quebra)
    if(mo.onGround && mo.platRef && !mo.platRef.mv && !mo.platRef.gira && !mo.platRef.coracao){ const pp=mo.platRef; pp.sujo=(pp.sujo||0)+dt;
      if(!pp.espinhos && pp.sujo>7){ pp.espinhos=true; G('evento','nasceram_espinhos',null,false);
        if(!seen.espinhos){ seen.espinhos=1; toast('⚠️ Os monstros pisaram tanto que nasceram ESPINHOS! Cair neles mata — exploda pra quebrar',5,'#ff5d5d'); } } }
    const nearP=Math.abs(px-nx)<1300 && Math.abs(py-ny)<900;                       // só atacam quando você está por perto
    if((mo.elite||mo.kind==='boss') && !dominio && state==='play' && Math.abs(px-nx)<700 && Math.abs(py-ny)<600){ mo.domCD-=dt; if(mo.domCD<=0){ mo.domCD=rand(28,36); abrirDominio('monstro',mo); } }
    if(mo.kind==='gelador'){ mo.geloCD-=dt; if(mo.geloCD<=0 && nearP){ mo.geloCD=rand(4.5,6.5); let k=0;
        for(const p of platforms){ if(dist(nx,ny,p.x+p.w/2,p.y)<340){ p.gelo=6; k++; } }
        puff(nx,ny,16,'#e8fbff',4,10); beep(1200,0.12,'triangle',0.04);
        if(k){ G('evento','monstro_congelou',null,false); if(!seen.geloAviso){ seen.geloAviso=1; toast('🧊 O gelador congelou as plataformas: elas escorregam!',4,'#bfefff'); } } } }
    if(mo.kind==='rachador'){ if(mo.pisaT>0){ mo.pisaT-=dt; if(mo.pisaT<=0){ shake=Math.min(24,shake+12); beep(70,0.3,'square',0.06); let k=0;
          for(const p of platforms){ if(p.spine||p.mv||p.gira||p.band===99||p.temPorta||p.coracao||p.trampolim||p.cascata||p===mo.platRef) continue;
            if(dist(nx,mo.y+mo.h,p.x+p.w/2,p.y)<280){ p.fragil={peso:0,estado:'cai',t:0}; p.solid=false; k++; } }
          puff(nx,mo.y+mo.h,18,'#c9a46b',5,12);
          if(k){ G('evento','monstro_rachou',null,false); if(!seen.rachaAviso){ seen.rachaAviso=1; toast('🪨 O rachador pisou forte: as plataformas perto caíram! Voltam em 4 s',4,'#e0c08a'); } } } }
      else { mo.pisaCD-=dt; if(mo.pisaCD<=0 && nearP && mo.onGround && Math.abs(px-nx)<700){ mo.pisaCD=rand(5.5,7.5); mo.pisaT=0.9; mo.vy=phBaseJump*0.5; mo.onGround=false; } } }
    if(mo.beam){ mo.beam.t-=dt; if(mo.beam.t<=0) mo.beam=null; }
    if(mo.kind==='arquiteto'){ mo.moveCD-=dt; if(mo.moveCD<=0 && nearP && state==='play'){ mo.moveCD=rand(3.5,6);
      // estratégia: empurra pra longe a plataforma para onde você está indo (à frente e acima de você)
      let alvo=null, best=1e9; const fx=px+player.face*170, fy=player.y-30;
      for(const p of platforms){ if(p.spine||p.mv||p.gira||p.band===99||p.shift||p.temPorta||!p.solid) continue; const d=Math.hypot(p.x+p.w/2-fx,p.y-fy); if(d<best && d<460){ best=d; alvo=p; } }
      if(alvo){ const dir=(alvo.x+alvo.w/2>px)?1:-1; const dx=clamp(dir*rand(110,170), 10-alvo.x, WORLD_W-alvo.w-10-alvo.x);
        alvo.shift={from:alvo.x,to:alvo.x+dx,t:0,warn:0.6}; mo.beam={p:alvo,t:1.4}; beep(260,0.18,'triangle',0.05);
        G('evento','monstro_moveu_plataforma',[['monstro','arquiteto']],false); } } }
    if(mo.kind==='tristonho'){ if(mo.ringT>0){ mo.ringT-=dt; if(mo.ringT<=0){ let k=0;
          for(const n of npcs){ if(n.state==='happy' && dist(nx,ny,n.x+n.w/2,n.y+n.h/2)<210){ n.state='sad'; n.holding=false; n.grace=0; n.perso=null; k++; } }
          puff(nx,ny,14,'#8a8095',4,12); if(k){ avisoMonstros=false; updateHUD(); G('evento','tristonho_entristeceu',null,false);
            if(!seen.tristonhoAviso){ seen.tristonhoAviso=1; toast('🌧️ O tristonho deixou '+k+' apaixonado'+(k>1?'s':'')+' triste de novo!',4,'#9aa7c7'); } } } }
      else { mo.ringCD-=dt; if(mo.ringCD<=0 && nearP){ mo.ringCD=rand(5,7); mo.ringT=0.9; beep(120,0.3,'sine',0.05); } } }
    if(mo.kind==='camaleao'){ mo.blinkCD-=dt; if(mo.blinkCD<=0){ mo.blinkCD=rand(3,5); mo.visT=1.0; } if(mo.visT>0) mo.visT-=dt; }
    if(mo.kind==='piscador'){ if(mo.alvoP){ mo.alvoP.t-=dt; if(mo.alvoP.t<=0){ puff(nx,ny,10,'#c77dff',3,10); mo.x=clamp(mo.alvoP.x-mo.w/2,0,WORLD_W-mo.w); mo.y=Math.min(mo.alvoP.y-mo.h,groundY-mo.h); mo.vy=0; mo.alvoP=null; puff(mo.x+mo.w/2,mo.y+mo.h/2,10,'#c77dff',3,10); } }
      else { mo.blinkCD-=dt; if(mo.blinkCD<=0 && nearP){ mo.blinkCD=rand(4.5,6.5); const lado=Math.random()<.5?-1:1; mo.alvoP={x:clamp(px+lado*rand(150,230),20,WORLD_W-20),y:player.y+player.h,t:0.9}; beep(500,0.15,'sine',0.04); } } }
    if(mo.kind==='divisor' && !mo.dividiu && mo.hp>0 && mo.hp<=Math.ceil(mo.maxHp/2)){ mo.dividiu=true;      // perdeu metade: vira DOIS menores
      for(const s of [-1,1]){ const c=mkMonster(0,0,'divisor'); c.w=mo.w*0.7; c.h=mo.h*0.7; c.hp=Math.max(1,mo.hp); c.maxHp=c.hp; c.dividiu=true; c.estr=mo.estr;
        c.x=clamp(mo.x+s*mo.w*0.6,0,WORLD_W-c.w); c.y=mo.y+mo.h-c.h; c.vx=s*4; c.vy=-6; monsters.push(c); }
      monsters.splice(mi,1); puff(nx,ny,18,'#ff9f43',4,12); beep(300,0.15,'square',0.05); updateHUD(); continue; }
    if(mo.kind==='shooter'){ mo.fireT-=dt; if(mo.fireT<=0 && nearP && shots.length<60){ mo.fireT=cfg.shooterRate; fireBlackHeart(mo); } }
    if(mo.kind==='beamer'){ mo.beamCD-=dt; if(mo.beamCD<=0 && nearP && beams.length<4){ mo.beamCD=rand(3.2,5); beams.push({x:player.x+player.w/2,t:-0.85,w:56,hit:false}); beep(80,0.3,'sawtooth',0.05); } }
    if(mo.kind==='spiker'){ mo.spikeCD-=dt; if(mo.spikeCD<=0 && nearP && spikesW.length<8){ mo.spikeCD=rand(3,4.5); for(const dr of [-1,1]) spikesW.push({x:mo.x+mo.w/2,dir:dr,dist:0,maxDist:440}); beep(150,0.18,'square',0.05); } }
    if(mo.kind==='boss'){ mo.phantomCD-=dt; if(mo.phantomCD<=0 && phantomT<=0){ mo.phantomCD=rand(9,13); phantomT=5; shake=Math.min(28,shake+18); beep(70,0.5,'sawtooth',0.06); } }
    if((mo.kind==='boss' || (mo.kind==='chaser' && (level-5)>=30)) && stickies.length<5 && nearP){ mo.stickyCD-=dt; if(mo.stickyCD<=0){ mo.stickyCD=rand(4,7);
      const dir=Math.sign((player.x+player.w/2)-(mo.x+mo.w/2))||1, sx=clamp(player.x+dir*90,20,WORLD_W-90);
      stickies.push({x:sx,y:groundY-26,w:74,h:26,hp:2,maxHp:2,life:12,hitBy:null}); beep(110,0.2,'square',0.05); } }
    if(mo.kind==='eater'){ for(let k=npcs.length-1;k>=0;k--){ const n=npcs[k]; if(n.state==='sad'&&overlap(mo,n)){
        npcs.splice(k,1); totalSad0=Math.max(0,totalSad0-1);
        if(mo.w<110){ mo.w*=1.12; mo.h*=1.12; mo.grow++; } beep(90,0.18,'sawtooth',0.06);
        puff(n.x+n.w/2,n.y,10,'#3d7bff',3,12);
        updateHUD(); checkWinLove(); break; } } }
  }

  // FEIXE VERTICAL: aviso tracejado, depois corta (dano); dá pra desviar saindo da coluna
  for(let i=beams.length-1;i>=0;i--){ const b=beams[i]; b.t+=dt; const pcx=player.x+player.w/2;
    let killed=false;
    for(const bl of blasts){ if(Math.abs(bl.x-b.x) < bl.r + b.w/2){ killed=true; break; } }
    if(!killed && state==='play'){
      if(player.shieldT>0 && Math.abs(pcx-b.x) < b.w/2 + player.w*1.9) killed=true;
      else if(player.guard && player.guard.hp>0 && Math.abs(pcx-b.x) < b.w/2 + 44) killed=true; }
    if(killed){ puff(b.x,player.y+player.h/2,10,'#7fffd4',4,12); beep(700,0.1,'sine',0.05); beams.splice(i,1); continue; }
    if(b.t>=0 && b.t<0.45 && !b.hit && state==='play' && Math.abs(pcx-b.x)<b.w/2+player.w/2){ b.hit=true; damagePlayer(b.x,'feixe'); }
    if(b.t>0.62) beams.splice(i,1); }
  // ONDA DE ESPINHOS: percorre o chão; pule pra desviar
  for(let i=spikesW.length-1;i>=0;i--){ const sw=spikesW[i]; sw.dist+=6; const sx=sw.x+sw.dir*sw.dist;
    if(state==='play' && Math.abs((player.x+player.w/2)-sx)<28 && (player.y+player.h)>groundY-44){ damagePlayer(sx,'espinhos'); }
    if(sw.dist>sw.maxDist || sx<0 || sx>WORLD_W) spikesW.splice(i,1); }
  if(phantomT>0) phantomT-=dt;
  // BARREIRA PEGAJOSA: gruda, expira, e a explosão destrói (tem HP)
  for(let i=stickies.length-1;i>=0;i--){ const st=stickies[i]; st.life-=dt;
    if(state==='play' && overlap(player,st)){ player.stickT=0.12; }
    for(const b of blasts){ if(st.hitBy!==b && dist(b.x,b.y,st.x+st.w/2,st.y+st.h/2)<b.r+20){ st.hp--; st.hitBy=b; puff(st.x+st.w/2,st.y+st.h/2,8,'#7d5a2e',3,12); } }
    if(st.hp<=0||st.life<=0) stickies.splice(i,1); }
  if(player.stickT>0) player.stickT-=dt;

  // DISPARO DE AMOR
  for(let i=loveShots.length-1;i>=0;i--){ const s=loveShots[i]; s.life+=dt; s.x+=s.vx;
    const box={x:s.x-s.sz/2,y:s.y-s.sz/2,w:s.sz,h:s.sz};
    for(const n of npcs){ if(n.state==='sad'&&overlap(box,n)){ makeHappy(n,'disparo'); n.vx=Math.sign(s.vx)*4; } }
    for(const mo of monsters.slice()){ if(mo.hitT<=0&&s.hit.indexOf(mo)<0&&overlap(box,mo)){ mo.hp--; mo.hitT=0.4; mo.vx+=Math.sign(s.vx)*5; s.hit.push(mo); if(mo.hp<=0)defeatMonster(mo); } }
    if((time*60|0)%2===0) particles.push({x:s.x,y:s.y,vx:rand(-1,1),vy:rand(-1,1),life:1,decay:.06,s:rand(6,12),col:'#ff8fab'});
    if(s.x<-40||s.x>WORLD_W+40||s.life>3){ loveShots.splice(i,1); } }
  // ONDA DE AMOR
  for(let i=waves.length-1;i>=0;i--){ const wv=waves[i]; wv.dist+=7; const wx=wv.cx+wv.dir*wv.dist;
    const box={x:wx-22,y:wv.y-wv.h,w:44,h:wv.h+30};
    for(const n of npcs){ if(n.state==='sad'&&overlap(box,n)){ makeHappy(n,'onda'); n.vx=wv.dir*4; } }
    for(const mo of monsters.slice()){ if(mo.hitT<=0&&wv.hit.indexOf(mo)<0&&overlap(box,mo)){ mo.hp--; mo.hitT=0.4; mo.vx+=wv.dir*5; wv.hit.push(mo); if(mo.hp<=0)defeatMonster(mo); } }
    if(wv.dist>wv.maxDist){ waves.splice(i,1); } }
  for(let i=lasers.length-1;i>=0;i--){ lasers[i].life-=dt; if(lasers[i].life<=0) lasers.splice(i,1); }
  // CHUVA DE AMOR
  if(player.rainT>0){ player.rainT-=dt; if(Math.random()<0.9) for(let q=0;q<3;q++) loveRain.push({x:camX+rand(0,W),y:camY-20,vy:rand(4,7),sz:rand(12,20)}); }
  for(let i=loveRain.length-1;i>=0;i--){ const r=loveRain[i]; r.y+=r.vy;
    for(const n of npcs){ if(n.state==='sad'&&Math.abs((n.x+n.w/2)-r.x)<n.w/2+r.sz/2&&r.y>n.y&&r.y<n.y+n.h){ makeHappy(n,'chuva'); } }
    if(r.y>WORLD_H+40||r.y>camY+H+120){ loveRain.splice(i,1); } }
  if(divineFx){ divineFx.life+=dt; divineFx.r=divineFx.maxR*clamp(divineFx.life/0.7,0,1); if(divineFx.life>=divineFx.maxLife) divineFx=null; }
  if(player.guard){ const tx=player.x+player.w/2, ty=player.y-46; player.guard.x+=(tx-player.guard.x)*0.18; player.guard.y+=(ty-player.guard.y)*0.18;
    player.guard.t-=dt; if(player.guard.t<=0||player.guard.hp<=0) player.guard=null; }
  if(player.elec){ player.elec.t-=dt; player.elec.fireT-=dt; const ex=player.x+player.w/2, ey=player.y-44;
    if(player.elec.fireT<=0){ player.elec.fireT=0.35; const R=160+Math.min(level*3,140);
      for(let a=0;a<8;a++) elecRays.push({x:ex,y:ey,ang:a*Math.PI/4,len:R,life:0.25,seed:(Math.random()*1e9)|0});
      for(const n of npcs){ if(n.state==='sad'&&dist(ex,ey,n.x+n.w/2,n.y+n.h/2)<R) makeHappy(n,'amor elétrico'); }
      for(const mo of monsters.slice()){ if(mo.hitT<=0&&dist(ex,ey,mo.x+mo.w/2,mo.y+mo.h/2)<R){ mo.hp--; mo.hitT=0.4; if(mo.hp<=0)defeatMonster(mo); } }
      beep(680,0.07,'sine',0.04); }
    if(player.elec && player.elec.t<=0) player.elec=null; }
  for(let i=elecRays.length-1;i>=0;i--){ elecRays[i].life-=dt; if(elecRays[i].life<=0) elecRays.splice(i,1); }
  { const want=(unlocked('divine') && player.stam>=MAX_STAM && state==='play'); if(want!==_divShown){ _divShown=want; const b=document.getElementById('bDiv'); if(b) b.style.display=want?'flex':'none'; } }
  { const want=(unlocked('dominio') && player.stam>=DOM_CUSTO && state==='play' && !(dominio&&dominio.dono==='jogador')); if(want!==_domShown){ _domShown=want; const b=document.getElementById('bDom'); if(b) b.style.display=want?'flex':'none'; } }

  // projéteis (corações negros)
  for(let i=shots.length-1;i>=0;i--){ const s=shots[i], lf=lentoT>0?0.35:1; s.life+=dt*lf; s.sw+=dt*6; s.x+=s.vx*lf; s.y+=s.vy*lf;
    if(s.life>=s.maxLife || s.x<-30 || s.x>WORLD_W+30 || s.y<-30 || s.y>WORLD_H+30){ shots.splice(i,1); continue; }
    { let bate=false; for(const w of walls){ if(s.x>w.x-8&&s.x<w.x+w.w+8&&s.y>w.y-6&&s.y<w.y+w.h){ bate=true; break; } }
      if(bate){ puff(s.x,s.y,6,'#b39ddb',3,9); shots.splice(i,1); continue; } }   // a barreira de amor segura o coração negro
    if(state==='play' && player.invuln<=0 && player.shieldT<=0 && overlap(player,{x:s.x-9,y:s.y-9,w:18,h:18})){ shots.splice(i,1); damagePlayer(s.x,'coração negro'); } }

  // contato com o jogador
  if(state==='play'){
    for(const n of npcs){ if(n.state==='happy'&&n.grace<=0&&!n.stuck&&!n.holding&&!(dominio&&dominio.dono==='jogador')&&overlap(player,n)){ damagePlayer(n.x+n.w/2,'abraço de apaixonado'); break; } }
    for(const mo of monsters){ if(overlap(player,mo)){
        if(mode==='infinite'){ IA.premio(mo,1); damagePlayer(mo.x+mo.w/2,NOME_FONTE[mo.kind]||mo.kind); }
        else if(mo.kind==='dog'){ if(player.biteCD<=0){ player.biteCD=0.8; player.agility=Math.max(0.5,player.agility-0.05); player.slowT=4;
            player.vx=(Math.sign((player.x+player.w/2)-(mo.x+mo.w/2))||1)*5; beep(150,0.1,'square',0.05);
            puff(player.x+player.w/2,player.y+player.h/2,6,'#222',3,8); } }
        else if(mo.kind==='sphere'){ player.rootT=Math.max(player.rootT,0.6); player.slowT=3; }
        else { if(player.invuln<=0 && player.shieldT<=0) IA.premio(mo,1); damagePlayer(mo.x+mo.w/2,NOME_FONTE[mo.kind]||mo.kind); }
        break; } }
  }

  if(cfg.type==='collect'&&state==='play'){
    aiLearn.vx = aiLearn.vx*0.94 + player.vx*0.06;
    aiLearn.jr = aiLearn.jr*0.97 + (player.vy<-2?0.03:0);
    rainTimer-=dt; if(rainTimer<=0){ rainTimer=rand(0.25,0.55); if(fhearts.length<10) spawnHeartScattered(); }
    const pcx=player.x+player.w/2, pcy=player.y+player.h/2;
    const ppx=pcx + clamp(aiLearn.vx,-7,7)*22;
    for(let i=fhearts.length-1;i>=0;i--){ const h=fhearts[i]; if(!h) continue; h.sw+=dt*4; if(h.fleeT>0) h.fleeT-=dt;
      const hcx=h.x+h.w/2, hcy=h.y+h.h/2, dx=hcx-pcx, near=Math.abs(dx)<330 && Math.abs(hcy-pcy)<280;
      const fast=(h.type==='fast'||h.type==='crybaby')?1.9:1;
      if(h.type==='snake' && h.fleeT<=0){ h.vx += (Math.sign(-dx)*3.0 - h.vx)*0.2; }
      else if(near){ let fdir=Math.sign(hcx-ppx)||1;
        if(hcx<130) fdir=1; else if(hcx>WORLD_W-130) fdir=-1;
        h.vx += (fdir*4.7*fast - h.vx)*0.26;
        const onGround=(h.y+h.h>=groundY-3)||h.rest;
        if(onGround && h.type!=='ghost' && Math.random()<0.10+clamp(aiLearn.jr*2.5,0,0.14)){ h.vy=-rand(6.8,9.8); h.rest=false; } }
      else { h.wT-=dt; if(h.wT<=0){ h.wT=rand(0.5,1.6); h.wdir=(Math.random()<.5?-1:1)*(Math.random()<.25?0:1); } h.vx += (h.wdir*1.5*fast - h.vx)*0.1; }
      const solo=(h.y+h.h>=groundY-3)||h.rest;
      if(h.type==='saltador' && solo && Math.abs(dx)<300 && Math.abs(hcy-pcy)<120 && (h.cd=(h.cd||0)-dt)<=0){ h.vy=-13; h.rest=false; h.cd=1.2; }   // pulão pra outra altura
      if(h.type==='fast' && h.rest && h.on){ const bx=h.x+h.w/2; if(bx-h.on.x<30||h.on.x+h.on.w-bx<30) h.vx*=0.6; }                                   // veloz freia nas pontas
      if(h.type==='dorminhoco'){ if(h.dorme===undefined) h.dorme=true;
        if(h.dorme){ h.vx=0; if((Math.abs(dx)<200&&Math.abs(hcy-pcy)<150) || (ultimaExplosao && time-ultimaExplosao.t<0.4 && dist(ultimaExplosao.x,ultimaExplosao.y,hcx,hcy)<600)){ h.dorme=false; h.vy=-6; h.rest=false; puff(hcx,hcy,8,'#b8a1ff',3,8); } }
        else h.vx*=1.15; }
      if(h.type==='imitador' && player.ultimoPulo!=null && time-player.ultimoPulo<0.04 && Math.abs(dx)<450 && solo){ h.vy=Math.max(player.vy*0.85,-12); h.rest=false; }   // pula junto com você
      if(h.type==='teleporte'){ h.tpT=(h.tpT==null?rand(3,5):h.tpT)-dt;
        if(h.alvoTp){ h.alvoTp.t-=dt; if(h.alvoTp.t<=0){ puff(hcx,hcy,8,'#c77dff',3,8); h.x=h.alvoTp.x; h.y=h.alvoTp.y-h.h; h.rest=false; h.vy=0; h.alvoTp=null; } }
        else if(h.tpT<=0 && Math.abs(dx)<300 && platforms.length){ const p=platforms[Math.floor(Math.random()*platforms.length)]; h.alvoTp={x:clamp(p.x+p.w/2-h.w/2,2,WORLD_W-h.w-2),y:p.y,t:0.8}; h.tpT=rand(4,6); } }
      if(h.rest && h.on && h.on.alc===false){ h.fora=(h.fora||0)+dt; if(h.fora>3){ const alc=platforms.filter(q=>q.alc&&q.solid&&!q.mv&&q.band!==99); const q=alc[Math.floor(Math.random()*alc.length)];
          if(q){ puff(hcx,hcy,8,'#c77dff',3,8); h.x=clamp(q.x+q.w/2-h.w/2,2,WORLD_W-h.w-2); h.y=q.y-h.h; h.on=q; h.vy=0; puff(h.x+h.w/2,h.y+h.h/2,8,'#c77dff',3,8); } h.fora=0; } } else h.fora=0;   // nunca fica preso fora do alcance
      if(h.type==='rei'){ h.vx*=0.6; for(const o of fhearts){ if(o!==h && o.type!=='rei' && Math.abs(o.x-h.x)<260 && Math.abs(o.y-h.y)<200){ o.vx+=(h.vx*0.8-o.vx)*0.1+Math.sign(h.x-o.x)*0.05; } } }
      if(h.type==='crybaby' && (hcx<130||hcx>WORLD_W-130) && solo && Math.random()<0.05){ h.vy=-rand(7,10); h.rest=false; }   // medroso: encurralado, entra em pânico
      if(h.type==='crybaby'){ h.vx += Math.sin(time*9+h.wob)*1.2; if(Math.random()<0.06) particles.push({x:hcx,y:h.y+h.h,vx:rand(-1,1),vy:rand(0,2),life:1,decay:.05,s:rand(4,7),col:'#7fc8ff'}); }
      h.x=clamp(h.x+h.vx,2,WORLD_W-h.w-2);
      if(h.type==='ghost'){ h.y=clamp(h.y+Math.sin(time*3+h.wob)*0.6, 40, groundY-h.h); h.rest=false; }
      else { if(h.rest){ const cx=h.x+h.w/2, by=h.y+h.h; let sup=by>=groundY-2;
          if(!sup && h.on && h.on.solid && cx>h.on.x && cx<h.on.x+h.on.w && Math.abs(by-h.on.y)<5){ sup=true; if(h.on.dx) h.x=clamp(h.x+h.on.dx,2,WORLD_W-h.w-2); h.y=h.on.y-h.h; }
          if(!sup) { h.rest=false; h.on=null; } }
        if(!h.rest){ h.vy=Math.min(h.vy+0.12,6.5); h.y+=h.vy; landHeart(h); } }
      if(h.type==='eater'){ for(let j=fhearts.length-1;j>=0;j--){ const o=fhearts[j]; if(o===h||o.type==='eater')continue;
          if(Math.abs((o.x+o.w/2)-hcx)<h.w*0.7 && Math.abs((o.y+o.h/2)-hcy)<h.h*0.7){ fhearts.splice(j,1); if(j<i)i--; if(h.s<86){h.s*=1.06;h.w*=1.06;h.h*=1.06;} beep(80,0.1,'sawtooth',0.04); } } }
      const hb={x:h.x-3,y:h.y-3,w:h.w+6,h:h.h+6};
      if(overlap(player,hb) && !(h.type==='ghost' && ((time+h.wob)%3)>1.1)){   // fantasma só dá pra pegar quando fica sólido
        const idx=fhearts.indexOf(h);
        if(h.type==='tough' && h.hp>1){ h.hp--; h.vx=Math.sign(dx||1)*7; h.x=clamp(h.x+h.vx*2,2,WORLD_W-h.w-2); h._spr=null; beep(220,0.08,'square',0.05); }
        else if(h.type==='snake' && carrying>0){ carrying--; G('evento','roubaram_coracao',[['coracao','sequestrador']],false); beep(150,0.14,'sawtooth',0.06); if(idx>=0) fhearts.splice(idx,1); updateHUD(); }
        else if(h.type==='splitter'){ if(idx>=0) fhearts.splice(idx,1); beep(900,0.06,'square',0.05); later(60,()=>beep(300,0.12,'sawtooth',0.05));
          puff(hcx,hcy,14,h.col,4,12);
          for(let q=0;q<2;q++){ const nh=spawnHeart(hcx+rand(-20,20),hcy,false,'fast'); nh.s*=0.7; nh.w*=0.7; nh.h*=0.7; nh.vy=-rand(2,4); nh.rest=false; } }
        else { let got=1; if(h.type==='eater') got=2; if(h.type==='rei') got=3; carrying+=got; G('evento','pegou_coracao',[['coracao',h.type==='normal'?(h.vshape||'coração'):h.type]],true);
          if(h.type==='solid'){ player.vx=(Math.sign((player.x+player.w/2)-hcx)||1)*8; player.vy=-4; }
          if(idx>=0) fhearts.splice(idx,1); beep(700+carrying*4,0.07,'sine',0.05); updateHUD(); } } }
    if(rock && rock.pontos && !rock.done){ rock.trocaT-=dt; if(rock.trocaT<=3 && !rock.avisou){ rock.avisou=true; toast('💗 A Máquina do Amor vai mudar de lugar!',2.5,'#ffd166'); }
      if(rock.trocaT<=0){ puff(rock.x+34,rock.y+40,16,'#ffd166',4,12); rock.pi=(rock.pi+1)%rock.pontos.length; rock.x=rock.pontos[rock.pi].x; rock.y=rock.pontos[rock.pi].y; rock.trocaT=18; rock.avisou=false; puff(rock.x+34,rock.y+40,16,'#ffd166',4,12); } }
    if(rock && rock.tempo!=null && !rock.done){ const s0=Math.ceil(rock.tempo); rock.tempo-=dt; if(Math.ceil(rock.tempo)!==s0) updateHUD(); if(rock.tempo<=0) tempoEsgotado(); }
    for(const e of enfeites){ if(!e.visto && overlap(player,{x:e.x-e.s/2,y:e.y,w:e.s,h:e.s})){ e.visto=true; puff(e.x,e.y+e.s/2,8,'#fff',2,8); if(!seen.enfeite){ seen.enfeite=1; toast('🙃 Esse era só enfeite! Os de verdade se mexem',3); } } }
    if(rock&&!rock.done&&overlap(player,rock)&&carrying>0){ G('evento','entregou_na_maquina',null,true,{coracoes:carrying}); rock.fill+=carrying; carrying=0;
      beep(440,0.12,'triangle',0.06); updateHUD(); if(rock.fill>=rock.target) bornFromRock(); }
  }

  for(const h of pHearts){ h.sw+=dt*4;      // corações soltos: caem e PARAM nas plataformas (cascata), andam com elas e o vento leva
    if(h.rest && h.on && (!h.on.solid||h.on.dead||h.on.coracao)){ h.rest=false; h.on=null; }
    if(h.rest && h.on){ if(h.on.dx) h.x=clamp(h.x+h.on.dx,2,WORLD_W-h.w-2); h.y=h.on.y-h.h; const cx=h.x+h.w/2; if(cx<h.on.x||cx>h.on.x+h.on.w){ h.rest=false; h.on=null; } continue; }
    if(h.rest) continue;
    if(h.vx){ h.x=clamp(h.x+h.vx,2,WORLD_W-h.w-2); h.vx*=0.97; if(Math.abs(h.vx)<0.05) h.vx=0; }
    for(const v of ventos){ const cx=h.x+h.w/2; if(cx>v.x&&cx<v.x+v.w) h.x=clamp(h.x+v.fx*3,2,WORLD_W-h.w-2); }
    const prev=h.y+h.h; h.vy=Math.min(h.vy+phGrav,MAX_FALL); h.y+=h.vy; const feet=h.y+h.h;
    if(feet>=groundY){ restPHeartGround(h); h.on=null; continue; }
    if(h.vy>0 && platBuckets){ const cx=h.x+h.w/2, fb=(feet/PBUCKET)|0, pb=(prev/PBUCKET)|0; let best=null;
      for(let bb=pb-1;bb<=fb+1;bb++){ const arr=platBuckets[bb]; if(!arr) continue; for(const p of arr){ if(!p.solid||p.coracao) continue; if(cx>p.x+4&&cx<p.x+p.w-4&&prev<=p.y+2&&feet>=p.y&&(!best||p.y<best.y)) best=p; } }
      if(best){ h.y=best.y-h.h; h.vy=0; h.vx=0; h.rest=true; h.on=best; } } }
  if(pHearts.length>40) pHearts.splice(0,pHearts.length-40);
  for(let i=blasts.length-1;i>=0;i--){ const b=blasts[i]; b.life+=dt; b.r+=(b.maxR-b.r)*0.22; if(b.life>=b.maxLife) blasts.splice(i,1); }
  for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.x+=p.vx; p.y+=p.vy; p.vy+=0.12; p.vx*=0.99; p.life-=p.decay; if(p.life<=0) particles.splice(i,1); }
  if(particles.length>Q.partCap) particles.splice(0,particles.length-Q.partCap);

  // CÂMERA: segue com suavidade e OLHA PARA ONDE VOCÊ ANDA (vira junto quando você volta)
  shake*=0.86; if(shake<0.2) shake=0;
  { const ahead=player.face*Math.min(W*0.14,300)*(Math.abs(player.vx)>0.6?1:0.55);
    lookX += (ahead-lookX)*(1-Math.exp(-dt*2.6));
    const tx=clamp(player.x+player.w/2+lookX-W/2,0,Math.max(0,WORLD_W-W));
    const ty=clamp(player.y+player.h/2-H*0.58,0,Math.max(0,WORLD_H-H));
    camX += (tx-camX)*(1-Math.exp(-dt*7)); camY += (ty-camY)*(1-Math.exp(-dt*(player.vy>8?9:5))); }
  setBars();
  if(pendingReset){ pendingReset=false; startLevel(level); }
}
function wrapCam(){ // "mundo dá a volta": câmera pula junto (sem deslizar pela fase inteira)
  camX=clamp(player.x+player.w/2+lookX-W/2,0,Math.max(0,WORLD_W-W)); camPX=camX; player.px=player.x; echoes.length=0;
  puff(player.x+player.w/2,player.y+player.h/2,10,'#bfe0ff',3,10); }

function bornFromRock(){ rock.done=true; rock.born=rock.fill;
  shake=20; beep(330,0.2,'sine',0.07); later(120,()=>beep(660,0.25,'sine',0.06));
  for(let i=0;i<50;i++){const a=rand(0,6.28),s=rand(2,9);
    particles.push({x:rock.x+rock.w/2,y:rock.y+10,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,life:1,decay:rand(.008,.018),s:rand(10,22),col:HEART_COLORS[Math.floor(rand(0,8))]});}
  for(let i=0;i<Math.min(rock.fill,10);i++) spawnPHeart(rock.x+rock.w/2+rand(-160,160), groundY);   // os corações felizes NASCEM de verdade
  later(1400,()=>{ if(state==='play') levelClear(); }); }

// ===== [RENDER] fundo da sala (pré-pronto), névoa e vinheta em cache =====
let BD=null, FOG=null, VIG=null, groundGrad=null, drawDirty=true;
function paintTile(g,T,style,P,R){
  const fill=(c)=>{ g.fillStyle=c; g.fillRect(0,0,T,T); };
  const RP=m=>m+R()*(T-2*m);   // posição que NÃO cruza a borda do ladrilho (sem emenda visível no fundo)
  g.lineWidth=2;
  switch(style){
    case 'stars': fill(P.bg); for(let i=0;i<26;i++){ g.globalAlpha=0.3+R()*0.7; g.fillStyle='#fff'; g.beginPath(); g.arc(RP(2),RP(2),0.5+R()*1.6,0,6.28); g.fill(); }
      g.globalAlpha=0.08; g.fillStyle=P.hi; heartPath(g,T*0.7,T*0.2,30); g.fill(); g.globalAlpha=1; break;
    case 'clouds': fill(P.bg); g.fillStyle='rgba(255,255,255,.055)'; for(let i=0;i<3;i++){ const x=RP(46)-24,y=RP(34); for(let k=0;k<4;k++){ g.beginPath(); g.arc(x+k*16,y+Math.sin(k)*6,16+R()*10,0,6.28); g.fill(); } } break;
    case 'wallpaper': fill(P.bg2); for(let x=0;x<T;x+=T/8){ g.fillStyle=(x/(T/8))%2?P.bg:P.bg2; g.fillRect(x,0,T/16,T); }
      g.fillStyle=P.line; for(let y=T/8;y<T;y+=T/4) for(let x=T/16;x<T;x+=T/4){ g.save(); g.translate(x,y); g.rotate(Math.PI/4); g.fillRect(-3,-3,6,6); g.restore(); }
      g.fillStyle='rgba(255,250,200,.18)'; g.fillRect(T*0.25,4,T*0.5,10); break;
    case 'office': fill(P.bg); g.fillStyle=P.bg2; for(let i=0;i<300;i++) g.fillRect(R()*T,R()*T,2,2);
      g.fillStyle=P.line; g.fillRect(0,T*0.55,T*0.45,6); g.fillRect(T*0.43,T*0.55,6,T*0.45); g.fillStyle='rgba(255,255,230,.12)'; g.fillRect(T*0.6,6,T*0.3,8); break;
    case 'tiles': fill(P.bg2); g.strokeStyle=P.line; const tt=T/6; for(let i=0;i<=6;i++){ g.beginPath(); g.moveTo(i*tt,0); g.lineTo(i*tt,T); g.moveTo(0,i*tt); g.lineTo(T,i*tt); g.stroke(); }
      g.fillStyle='rgba(120,220,255,.07)'; g.fillRect(0,T*0.6,T,T*0.4); break;
    case 'hallway': fill(P.bg2); for(let x=0;x<T;x+=T/10){ g.fillStyle=(Math.round(x/(T/10))%2)?P.bg:P.bg2; g.fillRect(x,0,T/20,T*0.62); }
      g.fillStyle=P.line; g.fillRect(0,T*0.62,T,6); g.fillStyle=P.bg; g.fillRect(0,T*0.62+6,T,T); g.fillStyle='rgba(255,240,200,.16)'; g.beginPath(); g.arc(T*0.5,T*0.2,10,0,6.28); g.fill(); break;   // corredor: papel listrado + rodapé + arandela (sem portas: porta é só a portinha viva)
    case 'doors': fill(P.bg); g.fillStyle=P.bg2; g.fillRect(T*0.3,T*0.2,T*0.4,T*0.7); g.strokeStyle=P.line; g.strokeRect(T*0.3,T*0.2,T*0.4,T*0.7);
      g.fillStyle=P.hi; g.beginPath(); g.arc(T*0.64,T*0.58,4,0,6.28); g.fill(); g.fillStyle=P.line; g.font='bold 14px sans-serif'; g.textAlign='center'; g.fillText(String(100+Math.floor(R()*899)),T*0.5,T*0.3); break;
    case 'garage': fill(P.bg); g.fillStyle=P.bg2; g.fillRect(T*0.1,0,T*0.14,T); g.fillStyle='rgba(255,220,90,.25)'; for(let y=0;y<T;y+=T/4) g.fillRect(T*0.6,y,6,T/8); break;
    case 'stairs': fill(P.bg); g.strokeStyle=P.line; g.beginPath(); for(let k=0;k<8;k++){ const x=k*T/8,y=T-k*T/8; g.moveTo(x,y); g.lineTo(x,y-T/8); g.lineTo(x+T/8,y-T/8); } g.stroke();
      g.strokeStyle=P.bg2; g.beginPath(); for(let k=0;k<8;k++){ const x=T-k*T/8,y=T-k*T/8; g.moveTo(x,y); g.lineTo(x,y-T/8); g.lineTo(x-T/8,y-T/8); } g.stroke(); break;
    case 'breath': fill(P.bg); g.strokeStyle=P.line; for(let k=1;k<6;k++){ roundRect(g,T/2-k*T/12,T/2-k*T/12,k*T/6,k*T/6,10); g.stroke(); } break;
    case 'shelves': fill(P.bg); for(let y=T/4;y<=T;y+=T/4){ g.fillStyle=P.line; g.fillRect(0,y-6,T,6); let x=4; while(x<T-10){ const bw=8+R()*12; g.fillStyle=R()<0.5?'#e8e4d8':'#cfc9b8'; g.fillRect(x,y-6-(T/4-14)*(0.6+R()*0.4),bw,(T/4-14)*(0.6+R()*0.4)); x+=bw+2; } } break;
    case 'grass': fill(P.bg); g.strokeStyle=P.hi; g.globalAlpha=0.25; for(let i=0;i<70;i++){ const x=RP(6),y=RP(12); g.beginPath(); g.moveTo(x,y); g.lineTo(x+3,y-10); g.stroke(); } g.globalAlpha=1; break;
    case 'grid': fill('#0b0616'); g.strokeStyle=P.hi; g.globalAlpha=0.35; for(let i=0;i<=4;i++){ g.beginPath(); g.moveTo(i*T/4,0); g.lineTo(i*T/4,T); g.moveTo(0,i*T/4); g.lineTo(T,i*T/4); g.stroke(); } g.globalAlpha=1; break;
    case 'eyes': fill(P.bg); for(let i=0;i<4;i++){ const x=RP(24),y=RP(14),s=8+R()*14; g.fillStyle='#f4eef2'; g.beginPath(); g.ellipse(x,y,s,s*0.55,0,0,6.28); g.fill(); g.fillStyle='#1a0610'; g.beginPath(); g.arc(x+(R()-0.5)*s*0.6,y,s*0.32,0,6.28); g.fill(); } break;
    case 'invsky': fill(P.bg2); g.fillStyle=P.bg; g.fillRect(0,T/2,T,T/2); for(let i=0;i<20;i++){ g.fillStyle='rgba(0,0,0,.6)'; g.beginPath(); g.arc(R()*T,R()*T,1+R()*2,0,6.28); g.fill(); } break;
    case 'mirror': fill(P.bg); g.fillStyle='rgba(255,255,255,.07)'; for(let k=-2;k<4;k++){ g.beginPath(); g.moveTo(k*T/3,0); g.lineTo(k*T/3+T/6,0); g.lineTo(k*T/3+T/6+T,T); g.lineTo(k*T/3+T,T); g.fill(); } break;
    case 'void': fill('#060208'); for(let i=0;i<3;i++){ g.globalAlpha=0.12+R()*0.2; g.fillStyle=P.hi; heartPath(g,RP(12),RP(12)-10,6+R()*14); g.fill(); } g.globalAlpha=1; break;
    case 'static': fill('#141218'); for(let i=0;i<900;i++){ const v=(R()*120)|0; g.fillStyle='rgb('+v+','+v+','+(v+10)+')'; g.fillRect((R()*T)|0,(R()*T)|0,3,3); } break;
    case 'geom': fill(P.bg); g.strokeStyle=P.hi; g.globalAlpha=0.35; for(let i=0;i<5;i++){ const s=10+R()*30, x=RP(s+2),y=RP(s+2); g.beginPath(); if(R()<0.5){ g.arc(x,y,s,0,6.28); } else { g.moveTo(x,y-s); g.lineTo(x+s,y+s); g.lineTo(x-s,y+s); g.closePath(); } g.stroke(); } g.globalAlpha=1; break;
    case 'dots': fill(P.bg); g.fillStyle=P.line; for(let y=T/28;y<T;y+=T/14) for(let x=T/28;x<T;x+=T/14){ g.beginPath(); g.arc(x,y,1.5+3*Math.abs(Math.sin(x*0.03+y*0.02)),0,6.28); g.fill(); } break;
    default: fill(P.bg);
  }
  // o fundo é decoração: abaixa o contraste pra nunca competir com plataformas e personagens
  if(style!=='stars'&&style!=='clouds'&&style!=='void'){ g.globalAlpha=(style==='eyes'||style==='static'||style==='shelves')?0.6:0.42; g.fillStyle=P.bg; g.fillRect(0,0,T,T); g.globalAlpha=1; }
}
function buildBackdrop(){
  if(!SCRW||!platforms) return;
  const style=(M&&M.style)||'stars', T=220, sc=Math.min(DPR,1)*(Q.tier===0?0.6:1);
  const tile=mkCanvas(T*sc,T*sc), tg=tile.getContext('2d'); if(tg.setTransform) tg.setTransform(sc,0,0,sc,0,0);
  paintTile(tg,T,style,PAL,srng((seedFor(level)^0x77)>>>0));
  const cw=(Math.ceil(SCRW/T)+1)*T, ch=(Math.ceil(SCRH/T)+1)*T;
  const bd=mkCanvas(cw*sc,ch*sc), bg=bd.getContext('2d');
  for(let y=0;y<ch;y+=T) for(let x=0;x<cw;x+=T) bg.drawImage(tile,x*sc,y*sc,T*sc,T*sc);
  bd._T=T; bd._cw=cw; bd._ch=ch; bd._par=(M.tier>=2?0.45:0.3); bd._static=(style==='static');
  BD=bd;
  // névoa: buraco de luz ao redor do jogador (baixa resolução = leve)
  if(M.fog){ const fw=SCRW*2, fh=SCRH*2, fs=0.25; FOG=mkCanvas(fw*fs,fh*fs); const fg=FOG.getContext('2d');
    const r0=Math.min(SCRW,SCRH)*0.22*fs, r1=Math.min(SCRW,SCRH)*0.62*fs, gr=fg.createRadialGradient(fw*fs/2,fh*fs/2,r0,fw*fs/2,fh*fs/2,r1);
    gr.addColorStop(0,'rgba(10,6,18,0)'); gr.addColorStop(1,'rgba(10,6,18,0.93)'); fg.fillStyle=gr; fg.fillRect(0,0,fw*fs,fh*fs); FOG._w=fw; FOG._h=fh; } else FOG=null;
  if(VIGN>0){ const vs=0.25; VIG=mkCanvas(SCRW*vs,SCRH*vs); const vg=VIG.getContext('2d');
    const gr=vg.createRadialGradient(SCRW*vs/2,SCRH*vs/2,SCRH*vs*0.35,SCRW*vs/2,SCRH*vs/2,SCRH*vs*0.85);
    gr.addColorStop(0,'rgba(0,0,0,0)'); gr.addColorStop(1,'rgba(0,0,0,'+VIGN+')'); vg.fillStyle=gr; vg.fillRect(0,0,SCRW*vs,SCRH*vs); } else VIG=null;
}

// ===== [RENDER] sprites dos personagens (assados uma vez, desenhados com drawImage) =====
function playerSpr(){ return cacheGet('player', ()=>bake(40,62,3,13,g=>{ const x=3,y=13,w=34,h=46,cx=x+w/2;
  g.fillStyle='#fff3e6'; roundRect(g,x,y,w,h,12); g.fill(); g.strokeStyle='#c9a76b'; g.lineWidth=2; roundRect(g,x,y,w,h,12); g.stroke();
  g.fillStyle='#33264d'; g.beginPath(); g.arc(cx-6,y+15,3.2,0,6.28); g.arc(cx+6,y+15,3.2,0,6.28); g.fill();
  g.strokeStyle='#33264d'; g.lineWidth=2; g.beginPath(); g.arc(cx,y+22,5,0.15*Math.PI,0.85*Math.PI); g.stroke();
  g.fillStyle='rgba(255,140,170,.45)'; g.beginPath(); g.arc(cx-11,y+21,3,0,6.28); g.arc(cx+11,y+21,3,0,6.28); g.fill();
  g.fillStyle='#fff'; g.beginPath(); g.arc(cx-5,y+13.8,1.3,0,6.28); g.arc(cx+7,y+13.8,1.3,0,6.28); g.fill();          // brilho nos olhos
  g.strokeStyle='#c9a76b'; g.lineWidth=2; g.beginPath(); g.moveTo(cx,y); g.quadraticCurveTo(cx+3,y-5,cx,y-7); g.stroke();   // anteninha
  g.fillStyle='#ff5d8f'; heartPath(g,cx,y-13,9); g.fill(); })); }
function paintGenericMonster(g,mo,hit){
  const isBoss=mo.kind==='boss', R=srng(mo.seed), distm=clamp((level-5)/40,0,1);
  const acc={gelador:'#9fe8ff',rachador:'#c9a46b',sombrio:'#a58bff',shooter:'#b14cff',eater:'#ffcc00',beamer:'#ff2e63',spiker:'#d7dee6',arquiteto:'#7fe0ff',boss:'#ffd166',tristonho:'#9aa7c7',camaleao:'#7dffb0',divisor:'#ff9f43',piscador:'#c77dff'}[mo.kind]||'#ff3b6b';
  const col=hit?'#fff':(isBoss?'#3a0820':'#241430');
  const rad=Math.min(mo.w,mo.h)/2;
  const shape=['blob','box','round','star','tear'][Math.floor(R()*5)];
  const eyes=isBoss?2:1+Math.floor(R()*(1+distm*4.5)), melt=R()<distm*0.8, spikes=mo.kind==='spiker'||R()<0.5;
  const rot=isBoss?0:(R()-0.5)*distm*0.8, sx=isBoss?1:1+(R()-0.5)*distm*0.7, sy=isBoss?1:1+(R()-0.5)*distm*0.7;
  g.shadowColor=PAL.amb; g.shadowBlur=isBoss?28:12;
  g.rotate(rot); g.scale(sx,sy);
  g.fillStyle=col; g.strokeStyle=isBoss?'#ff2e63':PAL.platTop; g.lineWidth=isBoss?6:3;
  if(shape==='blob') blobPath(g,0,0,rad,R,0.5+distm*0.4);
  else if(shape==='box') roundRect(g,-rad*0.85,-rad*0.9,rad*1.7,rad*1.8,8);
  else if(shape==='round'){g.beginPath();g.arc(0,0,rad,0,6.28);}
  else if(shape==='star') starPath(g,0,0,rad*1.05,4+Math.floor(R()*3));
  else { g.beginPath(); g.moveTo(0,-rad*1.05); g.quadraticCurveTo(rad,0,0,rad); g.quadraticCurveTo(-rad,0,0,-rad*1.05); g.closePath(); }
  g.fill(); g.shadowBlur=0; g.stroke();
  if(spikes){ g.fillStyle=acc; const S=4+Math.floor(R()*5); for(let i=0;i<S;i++){const a=Math.PI*2*i/S;g.beginPath();g.moveTo(Math.cos(a)*rad,Math.sin(a)*rad);g.lineTo(Math.cos(a)*rad*1.4,Math.sin(a)*rad*1.4);g.lineTo(Math.cos(a+0.2)*rad,Math.sin(a+0.2)*rad);g.fill();} }
  g.fillStyle=acc; for(let i=0;i<eyes;i++){const a=R()*6.28,r=rad*0.55*R();g.beginPath();g.arc(Math.cos(a)*r,Math.sin(a)*r-rad*0.1,Math.max(2,rad*0.14),0,6.28);g.fill();}
  if(melt){ g.fillStyle=col; const Mn=2+Math.floor(R()*3); for(let i=0;i<Mn;i++){const mx=(-0.4+R()*0.8)*rad;g.beginPath();g.arc(mx,rad*0.9,3+R()*3,0,6.28);g.fill();g.fillRect(mx-2,rad*0.6,4,rad*0.5);} }
  if(mo.kind==='eater'){ g.fillStyle='#120010'; roundRect(g,-rad*0.5,rad*0.2,rad,rad*0.4,3); g.fill(); g.fillStyle='#fff'; for(let i=0;i<4;i++){const tx=-rad*0.42+i*rad*0.28;g.beginPath();g.moveTo(tx,rad*0.2);g.lineTo(tx+rad*0.08,rad*0.42);g.lineTo(tx+rad*0.16,rad*0.2);g.fill();} }
  if(isBoss){ g.fillStyle='#ffd166'; g.beginPath();g.moveTo(-rad*0.5,-rad*0.85);g.lineTo(-rad*0.25,-rad*1.15);g.lineTo(0,-rad*0.85);g.lineTo(rad*0.25,-rad*1.15);g.lineTo(rad*0.5,-rad*0.85);g.fill(); }
  if(mo.twin){ const R2=srng((mo.seed^0x9e37)>>>0); g.scale(1/sx,1/sy); g.rotate(-rot); g.translate(rad*0.85,rad*0.25); g.scale(0.66,0.66);
    g.fillStyle=col; blobPath(g,0,0,rad,R2,0.5); g.fill(); g.strokeStyle=acc; g.lineWidth=3; g.stroke();
    g.fillStyle=acc; g.beginPath(); g.arc(0,-rad*0.1,Math.max(2,rad*0.16),0,6.28); g.fill(); }
}
function monsterSpr(mo,hit){ const key=hit?'_sH':'_sN';
  let c=mo[key]; if(c && c._e===SPR_E && Math.abs(c._mw-mo.w)<mo.w*0.05) return c;
  const S=Math.max(mo.w,mo.h)*2.3;
  c=bake(S,S,S/2,S/2,g=>{ g.translate(S/2,S/2); paintGenericMonster(g,mo,hit); }, 1100);
  c._mw=mo.w; mo[key]=c; return c; }
function sadSpr(n){ let c=n._spr; if(c && c._e===SPR_E) return c;
  const w=n.w,h=n.h,P=Math.max(w,h)*0.6, def=n.def||{};
  c=bake(w+P*2,h+P*2,P,P,g=>{ const xx=P,yy=P,cx=xx+w/2, sq=(def.shape==='square'), rad=sq?6:Math.min(10,w*0.3);
    g.save(); const ccx=cx, ccy=yy+h/2; g.translate(ccx,ccy); g.rotate(def.rot||0); g.translate(-ccx,-ccy);
    g.fillStyle='#3d7bff';
    if(def.blob){ blobPath(g,ccx,ccy,Math.max(w,h)*0.5,srng(def.seed||1),0.38); } else { roundRect(g,xx,yy,w,h,rad); }
    g.fill(); g.strokeStyle='#13316e'; g.lineWidth=2.5; g.stroke();
    g.fillStyle='#dfeaff';
    if(def.eyes){ const Re=srng(((def.seed||1)^7)>>>0); for(let i=0;i<def.eyes;i++){ const exx=cx+(-0.3+Re()*0.6)*w, eyy=yy+h*0.3+(Re()-0.5)*h*0.2; g.beginPath(); g.arc(exx,eyy,2.2,0,6.28); g.fill(); } }
    else { const ex=Math.max(4,w*0.16), ew=Math.max(3,w*0.10); g.fillRect(cx-ex,yy+h*0.34,ew,2.5); g.fillRect(cx+ex-ew,yy+h*0.34,ew,2.5);
      g.fillStyle='rgba(150,200,255,.9)'; g.beginPath(); g.arc(cx-ex+ew*0.5,yy+h*0.34+7,1.8,0,6.28); g.fill(); }   // lagriminha
    g.strokeStyle='#dfeaff'; g.lineWidth=2; g.beginPath(); g.arc(cx,yy+h*0.66,Math.max(3,w*0.13),1.15*Math.PI,1.85*Math.PI); g.stroke();
    if(def.melt){ g.fillStyle='#3d7bff'; const Rm=srng(((def.seed||1)^13)>>>0); for(let i=0;i<3;i++){ const mx=cx+(-0.4+Rm()*0.8)*w; g.beginPath(); g.arc(mx,yy+h,2.5+Rm()*2,0,6.28); g.fill(); g.fillRect(mx-2,yy+h*0.7,4,h*0.3); } }
    g.restore();
    if(def.twin){ const Rt=srng(((def.seed||1)^0x55)>>>0); g.save(); g.translate(xx+w*0.5,yy+h*0.3); g.scale(0.66,0.66);
      g.fillStyle='#3d7bff'; blobPath(g,0,0,Math.max(w,h)*0.5,Rt,0.35); g.fill(); g.strokeStyle='#13316e'; g.lineWidth=2.5; g.stroke();
      g.fillStyle='#dfeaff'; g.fillRect(-w*0.12,-h*0.05,3,2); g.fillRect(w*0.06,-h*0.05,3,2); g.restore(); } });
  n._spr=c; return c; }
function happySpr(w,h,variant){ return cacheGet('hp|'+Math.round(w)+'|'+Math.round(h)+'|'+variant, ()=>bake(w+8,h+8,4,4,g=>{
  const fillc=variant===0?'#ffc4d6':(variant===1?'#b9f5c9':(variant===3?'#ffb3d1':(variant===4?'#ff8fab':'#ff8fab')));
  if(variant>=3){ g.shadowColor='#fff'; g.shadowBlur=14; }
  g.fillStyle=fillc; roundRect(g,4,4,w,h,10); g.fill(); g.shadowBlur=0;
  g.strokeStyle=variant===1?'#2e8b57':'#c23a63'; g.lineWidth=2; roundRect(g,4,4,w,h,10); g.stroke();
  g.fillStyle='#ff0a54'; heartPath(g,4+w/2-7,4+12,8); g.fill(); heartPath(g,4+w/2+7,4+12,8); g.fill();
  g.fillStyle='rgba(255,90,140,.35)'; g.beginPath(); g.arc(4+w*0.18,4+h*0.55,Math.max(2.5,w*0.09),0,6.28); g.arc(4+w*0.82,4+h*0.55,Math.max(2.5,w*0.09),0,6.28); g.fill();
  g.strokeStyle='#c23a63'; g.beginPath(); g.arc(4+w/2,4+h*0.62,5,0.1*Math.PI,0.9*Math.PI); g.stroke(); })); }
function fheartSpr(h){ let c=h._spr; if(c && c._e===SPR_E && Math.abs(c._s-h.s)<1) return c;
  const s=h.s, S=s*3.2, C=S/2, cxh=C, cyh=C-s*0.45;
  c=bake(S,S,C,C-s*0.45,g=>{
    g.shadowColor=h.col; g.shadowBlur=10;
    const Rh=srng(h.seed);
    g.save(); g.translate(cxh,cyh); g.scale(h.hsx||1,h.hsy||1); g.translate(-cxh,-cyh);
    g.fillStyle=(h.type==='solid')?'#9aa7c7':(h.type==='eater'?'#7a2e6b':h.col);
    hShape(g,cxh,cyh,s,h.vshape,Rh); g.fill(); g.shadowBlur=0;
    g.strokeStyle=(h.type==='tough'&&h.hp>1)?'#cfd8e0':'rgba(255,255,255,.5)'; g.lineWidth=(h.type==='tough'&&h.hp>1)?4:2; hShape(g,cxh,cyh,s,h.vshape,srng(h.seed)); g.stroke();
    g.restore();
    if(h.type==='tough'){ g.strokeStyle='rgba(255,255,255,.6)'; g.lineWidth=2; g.beginPath(); g.moveTo(cxh-s*0.2,cyh+s*0.3); g.lineTo(cxh+s*0.2,cyh+s*0.3); g.stroke(); }
    if(h.type==='eater'){ g.fillStyle='#120010'; g.beginPath(); g.arc(cxh-s*0.12,cyh+s*0.3,s*0.06,0,6.28); g.arc(cxh+s*0.12,cyh+s*0.3,s*0.06,0,6.28); g.fill();
      g.fillStyle='#fff'; for(let t=0;t<3;t++){ const tx=cxh-s*0.12+t*s*0.12; g.beginPath(); g.moveTo(tx,cyh+s*0.45); g.lineTo(tx+s*0.04,cyh+s*0.56); g.lineTo(tx+s*0.08,cyh+s*0.45); g.fill(); } }
    if(h.type==='crybaby'){ g.fillStyle='#7fc8ff'; g.beginPath(); g.arc(cxh-s*0.1,cyh+s*0.5,2.5,0,6.28); g.arc(cxh+s*0.1,cyh+s*0.5,2.5,0,6.28); g.fill(); }
    // olhinhos (todo coração da coleta tem cara — fica claro que é "alguém" que foge)
    if(h.outfit!==1){ g.fillStyle='rgba(30,10,30,.75)'; g.beginPath(); g.arc(cxh-s*0.12,cyh+s*0.36,Math.max(1.5,s*0.045),0,6.28); g.arc(cxh+s*0.12,cyh+s*0.36,Math.max(1.5,s*0.045),0,6.28); g.fill(); }
    if(h.outfit>=0){ const ox=cxh, oy=cyh+s*0.38; g.lineWidth=2;
      if(h.outfit===0){ g.fillStyle='#222'; g.fillRect(ox-s*0.22,oy-s*0.30,s*0.44,s*0.06); g.fillRect(ox-s*0.12,oy-s*0.46,s*0.24,s*0.18); }
      else if(h.outfit===1){ g.strokeStyle='#111'; g.fillStyle='#111'; g.beginPath(); g.arc(ox-s*0.12,oy-s*0.02,s*0.09,0,6.28); g.arc(ox+s*0.12,oy-s*0.02,s*0.09,0,6.28); g.fill(); g.beginPath(); g.moveTo(ox-s*0.03,oy-s*0.02); g.lineTo(ox+s*0.03,oy-s*0.02); g.stroke(); }
      else if(h.outfit===2){ g.fillStyle='#c1121f'; g.beginPath(); g.moveTo(ox,oy+s*0.16); g.lineTo(ox-s*0.16,oy+s*0.06); g.lineTo(ox-s*0.16,oy+s*0.26); g.closePath(); g.moveTo(ox,oy+s*0.16); g.lineTo(ox+s*0.16,oy+s*0.06); g.lineTo(ox+s*0.16,oy+s*0.26); g.closePath(); g.fill(); }
      else if(h.outfit===3){ g.fillStyle='#2a9d8f'; g.fillRect(ox-s*0.2,oy+s*0.14,s*0.4,s*0.1); g.fillRect(ox+s*0.06,oy+s*0.2,s*0.08,s*0.18); }
      else if(h.outfit===4){ g.fillStyle='#1d3557'; g.beginPath(); g.arc(ox,oy-s*0.26,s*0.2,Math.PI,0); g.fill(); g.fillRect(ox-s*0.02,oy-s*0.28,s*0.3,s*0.05); }
      else { g.fillStyle='#ffd166'; g.beginPath(); g.moveTo(ox-s*0.2,oy-s*0.24); g.lineTo(ox-s*0.12,oy-s*0.42); g.lineTo(ox,oy-s*0.26); g.lineTo(ox+s*0.12,oy-s*0.42); g.lineTo(ox+s*0.2,oy-s*0.24); g.closePath(); g.fill(); } }
    if(h.vtwin){ const Rt=srng((h.seed^0x55)>>>0); g.save(); g.translate(cxh+s*0.42,cyh+s*0.22); g.scale(0.68,0.68); g.translate(-cxh,-cyh);
      g.fillStyle=h.col; hShape(g,cxh,cyh,s,h.vshape,Rt); g.fill(); g.strokeStyle='rgba(255,255,255,.5)'; g.lineWidth=2; hShape(g,cxh,cyh,s,h.vshape,srng((h.seed^0x55)>>>0)); g.stroke(); g.restore(); }
  }, 520);
  c._s=h.s; h._spr=c; return c; }
function platSpr(p){ const wb=Math.max(24,Math.round(p.w/6)*6), hb=Math.round(p.h), kind=p.mv?'m':(p.arch?'a':(p.spine?'s':'n')), ic=(p.ic|0)%4;
  return cacheGet('pl|'+wb+'|'+hb+'|'+kind+'|'+ic+'|'+PAL.plat, ()=>bake(wb+4,hb+12,2,8,g=>{ const x=2,y=8,w=wb,h=hb;
    const base=p.mv?PAL.platMv:(p.arch?PAL.arch:PAL.plat), top=p.mv?'#ffd9a0':(p.arch?'#b8fff0':(p.spine?'#ffc4d6':PASTEL[ic]));
    g.fillStyle=base; roundRect(g,x,y,w,h+2,Math.min(8,(h+2)/2)); g.fill();
    g.fillStyle='rgba(255,255,255,.12)'; roundRect(g,x+4,y+h*0.5,w-8,Math.max(2,h*0.22),2); g.fill();
    g.fillStyle=top; roundRect(g,x,y-2,w,7,4); g.fill();                                    // cobertura de glacê
    for(let i=x+5;i<x+w-5;i+=12){ g.beginPath(); g.arc(i+3,y+4,4,0,Math.PI); g.fill(); }    // babadinhos
    g.fillStyle='rgba(255,255,255,.7)'; for(let i=x+8;i<x+w-6;i+=19){ g.beginPath(); g.arc(i,y+1,1.2,0,6.28); g.fill(); }
    if(p.spine){ g.fillStyle='rgba(255,255,255,.45)'; heartPath(g,x+w/2,y+h*0.25,Math.min(10,h*0.7)); g.fill(); } })); }
function florSpr(t){ return cacheGet('flor|'+t, ()=>bake(20,22,0,22,g=>{ g.strokeStyle='#5dbb63'; g.lineWidth=2; g.beginPath(); g.moveTo(10,22); g.quadraticCurveTo(8,16,10,11); g.stroke();
  if(t===3){ g.fillStyle='#ff5d8f'; heartPath(g,10,2,10); g.fill(); return; }
  const c=t===1?'#ffd6e0':'#cde7ff'; g.fillStyle=c; for(let k=0;k<5;k++){ const a=k*1.2566; g.beginPath(); g.arc(10+Math.cos(a)*4,7+Math.sin(a)*4,3.2,0,6.28); g.fill(); }
  g.fillStyle='#ffd166'; g.beginPath(); g.arc(10,7,2.4,0,6.28); g.fill(); })); }
function groundSpr(){ return cacheGet('chao|'+PAL.groundLine, ()=>bake(120,16,0,0,g=>{ g.fillStyle=PAL.groundLine; g.fillRect(0,2,120,4);
  g.fillStyle='rgba(255,255,255,.28)'; for(let x=0;x<120;x+=15){ g.beginPath(); g.arc(x+7.5,6,6,0,Math.PI); g.fill(); }   // renda
  g.fillStyle='rgba(255,214,224,.75)'; for(let x=7.5;x<120;x+=30){ g.beginPath(); g.arc(x,13,1.6,0,6.28); g.fill(); } })); }
function portaSpr(){ return cacheGet('porta2', ()=>bake(48,70,4,4,g=>{ const x=4,y=4,w=40,h=62;
  g.fillStyle='#c9a7ff'; g.beginPath(); g.moveTo(x,y+h); g.lineTo(x,y+22); g.arc(x+w/2,y+22,w/2,Math.PI,0); g.lineTo(x+w,y+h); g.closePath(); g.fill();
  g.fillStyle='#1a0830'; g.beginPath(); g.moveTo(x+6,y+h); g.lineTo(x+6,y+24); g.arc(x+w/2,y+24,w/2-6,Math.PI,0); g.lineTo(x+w-6,y+h); g.closePath(); g.fill();
  g.fillStyle='#fff'; for(let k=0;k<5;k++){ g.globalAlpha=0.4+0.5*((k*37)%10)/10; g.beginPath(); g.arc(x+10+((k*29)%22),y+22+((k*41)%34),1,0,6.28); g.fill(); } g.globalAlpha=1; })); }
function drawPorta(d){ ctx.globalAlpha=d.a; const caca=d.abre>0.15; const bounce=caca?Math.sin(time*30)*2:0;
  ctx.save(); ctx.translate(0,bounce); drawSpr(portaSpr(), d.x, d.y-d.h);
  // carinha viva: olhos em cima; quando caça, a porta vira uma BOQUINHA com dentinhos
  const ex=d.x+d.w/2, ey=d.y-d.h+10; ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(ex-8,ey,4.5,0,6.28); ctx.arc(ex+8,ey,4.5,0,6.28); ctx.fill();
  const lx=clamp((player.x+player.w/2-ex)/200,-1,1)*2; ctx.fillStyle='#2a0a3a'; ctx.beginPath(); ctx.arc(ex-8+lx,ey+1,2.2,0,6.28); ctx.arc(ex+8+lx,ey+1,2.2,0,6.28); ctx.fill();
  if(caca){ ctx.fillStyle='#fff'; for(let k=0;k<4;k++){ const tx=d.x+8+k*7; ctx.beginPath(); ctx.moveTo(tx,d.y-d.h+20); ctx.lineTo(tx+3.5,d.y-d.h+27); ctx.lineTo(tx+7,d.y-d.h+20); ctx.fill(); ctx.beginPath(); ctx.moveTo(tx,d.y-2); ctx.lineTo(tx+3.5,d.y-9); ctx.lineTo(tx+7,d.y-2); ctx.fill(); } }
  ctx.restore(); ctx.save(); ctx.translate(0,bounce);
  if(d.abre>0.2) drawGlow('rgba(190,140,255,.9)', d.x+d.w/2, d.y-d.h*0.45, 46*d.abre, d.abre*0.8);
  const fw=(d.w-10)*(1-d.abre*0.88);                                                      // folha da porta abrindo
  if(fw>2){ ctx.fillStyle='#ff8fab'; roundRect(ctx,d.x+5,d.y-d.h+18,fw,d.h-18,4); ctx.fill(); ctx.fillStyle='#ffd6e0'; ctx.fillRect(d.x+5,d.y-d.h+18,Math.min(fw,3),d.h-18);
    if(fw>12) drawHeart(d.x+5+fw/2, d.y-d.h+26, Math.min(11,fw*0.5), '#fff', false);
    ctx.fillStyle='#ffd166'; ctx.beginPath(); ctx.arc(d.x+5+fw-4, d.y-d.h*0.42, 2.2, 0, 6.28); ctx.fill(); }
  ctx.restore(); ctx.globalAlpha=1; }
function atualizarPortas(dt){ if(!portas.length) return;
  const pcx=player.x+player.w/2, pcy=player.y+player.h/2;
  for(const d of portas){ if(d.estado==='usada'){ d.a=Math.max(0,d.a-dt*1.2); d.abre=Math.max(0,d.abre-dt); continue; }
    const dd=Math.hypot(pcx-(d.x+d.w/2), pcy-(d.y-d.h/2)); if(d.cd>0) d.cd-=dt;
    if(d.estado==='oculta'){ if(dd<300 && d.cd<=0){ d.estado='ativa'; beep(180,0.25,'sine',0.04); puff(d.x+d.w/2,d.y-d.h/2,8,'#c9a7ff',2,10); } continue; }   // aparece do nada
    d.a=Math.min(1,d.a+dt*3);
    if(!player.onGround && dd<190 && d.cd<=0){ const tx=pcx-d.w/2, ty=player.y+player.h+8;   // pulou a ~4 corpos dela: ela PULA em você como uma boquinha e se força a passar por você
      d.x+=(tx-d.x)*0.3; d.y+=(ty-d.y)*0.3; d.abre=Math.min(1,d.abre+dt*6); }
    else { d.abre=Math.max(0,d.abre-dt*1.5); d.x+=(d.hx-d.x)*0.03; d.y+=(d.hy-d.y)*0.03; if(dd>760){ d.estado='oculta'; d.a=0; d.x=d.hx; d.y=d.hy; } }
    d.x=clamp(d.x,0,WORLD_W-d.w); d.y=clamp(d.y,d.h+4,groundY);
    if(d.abre>0.5 && overlap(player,{x:d.x+6,y:d.y-d.h+10,w:d.w-12,h:d.h-14})){ atravessar(d); break; } } }
function atravessar(d){ const q=portas[d.par]; if(!q) return;
  puff(player.x+player.w/2,player.y+player.h/2,16,'#c9a7ff',4,12);
  player.x=clamp(q.hx+q.w/2-player.w/2,0,WORLD_W-player.w); player.y=Math.min(q.hy,groundY)-player.h-1; player.vx=0; player.vy=-3; player.onGround=false; player.platRef=null;
  player.invuln=Math.max(player.invuln,0.7); player.protT=0.7; player.jumps=Math.max(player.jumps,1);   // 0,7 s de proteção ao sair da porta
  d.estado='usada'; q.estado='usada'; q.x=q.hx; q.y=q.hy; q.a=1; q.abre=1;
  for(const o of portas) if(o.estado!=='usada') o.cd=Math.max(o.cd,1.5);   // as outras portas não te engolem logo na saída                   // passou: as duas somem
  camX=clamp(player.x+player.w/2+lookX-W/2,0,Math.max(0,WORLD_W-W)); camY=clamp(player.y+player.h/2-H*0.58,0,Math.max(0,WORLD_H-H));
  camPX=camX; camPY=camY; player.px=player.x; player.py=player.y; echoes.length=0;
  puff(player.x+player.w/2,player.y+player.h/2,16,'#c9a7ff',4,12); beep(300,0.2,'sine',0.06); later(90,()=>beep(900,0.25,'sine',0.05));
  if(!seen.portaUsada){ seen.portaUsada=1; toast('🚪 A porta te engoliu e te jogou em outro lugar da fase!',3.5,'#c9a7ff'); }
  G('evento','atravessou_porta',null,null); }
function drawCoracaoPlat(p){ const c=p.coracao, cx=p.x+p.w/2, s=Math.max(56,Math.min(150,p.w*0.8)), y=p.y+(p.dyVis||0)-6, pul=c.caindo?1:1+0.06*Math.sin(time*14);
  drawHeart(cx, y, s*pul, '#ff5d8f', Q.tier>0);
  if(!c.caindo){ ctx.fillStyle='#fff'; ctx.font='bold 13px sans-serif'; ctx.textAlign='center'; ctx.fillText(Math.ceil(c.t), cx, y+s*0.45); } }
function emojiSpr(e){ return cacheGet('emo|'+e, ()=>bake(32,32,16,16,g=>{ g.fillStyle='rgba(255,255,255,.75)'; g.beginPath(); g.arc(16,16,14,0,6.28); g.fill(); g.font='22px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(e,16,17); })); }
function blockSpr(w,hit){ const bw=Math.round(w/4)*4; return cacheGet('bl|'+bw+'|'+(hit?1:0), ()=>bake(bw+24,54,12,12,g=>{ const x=12,y=12,h=30;
  if(hit){ g.shadowColor='#ff2e63'; g.shadowBlur=14; }
  g.fillStyle=hit?'#ff5d8f':'#3fb6a8'; roundRect(g,x,y,bw,h,7); g.fill(); g.shadowBlur=0;
  g.fillStyle=hit?'rgba(255,160,190,.9)':'rgba(150,235,225,.9)'; roundRect(g,x,y,bw,4,4); g.fill();
  g.strokeStyle=hit?'#b3002d':'#1f6b62'; g.lineWidth=3; roundRect(g,x,y,bw,h,7); g.stroke();
  g.fillStyle='rgba(255,255,255,.85)'; heartPath(g,x+bw/2,y+8,13); g.fill(); })); }
function wallSpr(h){ const hh=Math.round(h); return cacheGet('wall|'+hh, ()=>bake(18+28,hh+28,14,14,g=>{ const x=14,y=14,w=18;
  const gr=g.createLinearGradient(x,0,x+w,0); gr.addColorStop(0,'rgba(255,143,171,.75)');gr.addColorStop(.5,'rgba(255,46,99,.9)');gr.addColorStop(1,'rgba(255,143,171,.75)');
  g.fillStyle=gr; g.shadowColor='#ff2e63'; g.shadowBlur=14; roundRect(g,x,y,w,hh,8); g.fill(); g.shadowBlur=0;
  g.fillStyle='#fff'; for(let yy=y+10;yy<y+hh-6;yy+=22){ heartPath(g,x+w/2,yy,10); g.fill(); } })); }
function rockSpr(){ return cacheGet('rock', ()=>bake(68,84,0,0,g=>{ const w=68,h=84;
  g.fillStyle='#5b5470'; roundRect(g,0,0,w,h,14); g.fill();
  g.fillStyle='#736b8c'; roundRect(g,5,5,w-10,h*0.4,10); g.fill();
  g.strokeStyle='#3a3550'; g.lineWidth=3; roundRect(g,0,0,w,h,14); g.stroke();
  g.fillStyle='#2a2440'; roundRect(g,10,h-26,w-20,16,6); g.fill();
  g.fillStyle='#ffd166'; g.font='bold 10px sans-serif'; g.textAlign='center'; g.fillText('AMOR',w/2,h-14); })); }
function indSpr(icon,col){ return cacheGet('ind|'+icon+'|'+col, ()=>bake(40,40,20,20,g=>{
  g.fillStyle='rgba(12,8,24,.75)'; g.beginPath(); g.arc(20,20,17,0,6.28); g.fill(); g.strokeStyle=col; g.lineWidth=3; g.stroke();
  g.font='18px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(icon,20,21); })); }
function joySpr(){ return cacheGet('joy', ()=>bake(JOY_R*2+8,JOY_R*2+8,JOY_R+4,JOY_R+4,g=>{ const o=JOY_R+4,R=JOY_R;
  g.fillStyle='rgba(30,10,30,0.45)'; g.beginPath(); g.arc(o,o,R,0,6.2832); g.fill();
  g.lineWidth=4; g.strokeStyle='rgba(255,170,200,0.6)'; g.beginPath(); g.arc(o,o,R,0,6.2832); g.stroke();
  g.strokeStyle='rgba(255,170,200,0.3)'; g.lineWidth=2; g.beginPath(); g.arc(o,o,R*0.62,0,6.2832); g.stroke();
  g.fillStyle='rgba(255,210,225,0.8)';
  for(const dd of [[1,0],[0,1],[-1,0]]){ const ax=o+dd[0]*R*0.83, ay=o+dd[1]*R*0.83; g.save(); g.translate(ax,ay); g.rotate(Math.atan2(dd[1],dd[0])+Math.PI/2);
    g.beginPath(); g.moveTo(0,-7); g.lineTo(-6,4.5); g.lineTo(6,4.5); g.closePath(); g.fill(); g.restore(); } })); }

// ===== [RENDER] desenho do quadro =====
let camRX=0, camRY=0;
function draw(alpha){
  if(alpha==null) alpha=1;
  const workT0=performance.now();
  camRX=camPX+(camX-camPX)*alpha; camRY=camPY+(camY-camPY)*alpha;
  const prx=player.px+(player.x-player.px)*alpha, pry=player.py+(player.y-player.py)*alpha;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.globalAlpha=1;
  // fundo (1 drawImage só)
  if(!BD) buildBackdrop();
  if(BD){ const T=BD._T; let ox=-((((camRX*ZOOM*BD._par)%T)+T)%T), oy=-((((camRY*ZOOM*BD._par*0.5)%T)+T)%T);
    if(BD._static){ ox=-((((-ox)+((time*15|0)%7)*37)%T+T)%T); }     // estática "pula" de leve
    ctx.drawImage(BD, ox, oy, BD._cw, BD._ch); }
  else { ctx.fillStyle=PAL.bg; ctx.fillRect(0,0,SCRW,SCRH); }
  if(Q.tier>1) for(const a of ambient){ a.y-=a.sp; a.sw+=0.02; if(a.y<-0.05){ a.y=1.05; a.x=Math.random(); }
    const ax=((a.x*SCRW - camRX*ZOOM*0.12)%(SCRW+40)+(SCRW+40))%(SCRW+40)-20; ctx.globalAlpha=0.10; drawHeart(ax+Math.sin(a.sw)*12, a.y*SCRH, a.s, PAL.amb, false); }
  ctx.globalAlpha=1;

  // mundo
  let z=ZOOM; if(M.breathe&&!OPC.reduz) z*=1+0.03*Math.sin(time*1.1);
  const sk=OPC.reduz?0:shake, sx=sk?(Math.random()-.5)*sk:0, sy=sk?(Math.random()-.5)*sk:0;
  ctx.translate(SCRW/2,SCRH/2); if(M.tilt&&!OPC.reduz) ctx.rotate(0.035*Math.sin(time*0.6)); ctx.scale(z,z);
  ctx.translate(-(camRX+W/2)+sx, -(camRY+H/2)+sy);
  const mg=(M.tilt||M.breathe)?160:60, vx0=camRX-mg, vx1=camRX+W+mg, vy0=camRY-mg, vy1=camRY+H+mg;
  const inV=(x,y,w,h)=>x+w>vx0&&x<vx1&&y+h>vy0&&y<vy1;

  // chão
  if(!groundGrad){ groundGrad=ctx.createLinearGradient(0,groundY,0,WORLD_H); groundGrad.addColorStop(0,PAL.groundTop); groundGrad.addColorStop(1,PAL.groundBot); }
  if(groundY<vy1){ ctx.fillStyle=groundGrad; ctx.fillRect(vx0,groundY,vx1-vx0,GROUND_H+mg); { const gs=groundSpr(), st0=Math.floor(vx0/120)*120; for(let x=st0;x<vx1;x+=120) ctx.drawImage(gs,x,groundY-2,120,gs._h); }
    if(Q.tier>1){ const st=Math.floor(vx0/120)*120; for(let x=st;x<vx1;x+=120){ drawHeart(x+30, groundY+26, 16, 'rgba(255,255,255,.07)', false); } } }

  // plataformas
  const outline=(M.style==='grid'||M.style==='void'||M.style==='geom'), glitch=(M.style==='static'||M.style==='mirror');
  for(const p of platforms){ if(p.y<vy0-40||p.y>vy1||p.x+p.w<vx0||p.x>vx1) continue;
    let a=1; if(!p.solid) a=0.18; else if(p.warn) a=0.55+0.45*Math.sin(time*40); if(phantomT>0) a*=0.3;
    ctx.globalAlpha=a;
    const topCol=p.mv?'#ffcf8a':(p.arch?'#9cffe6':(p.spine?'#ffc4d6':PASTEL[(p.ic|0)%4]));
    if(p.coracao){ ctx.globalAlpha=1; drawCoracaoPlat(p); continue; }
    if(p.fragil && p.fragil.estado==='cai') a*=clamp(1-p.fragil.t/0.8,0,1); ctx.globalAlpha=a;
    let px=p.x, py=p.y+(p.dyVis||0); if(p.tremor>0 && !OPC.reduz) px+=Math.sin(time*70+p.x)*4*clamp(p.tremor,0,1); if(glitch && ((Math.floor(time*8)+Math.floor(p.x))%23===0)) px+=6;
    if(p.shift && p.shift.warn>0) px+=Math.sin(time*70)*3;                        // treme antes do arquiteto empurrar
    const ang=p.gira?p.gira.ang:p.tilt;
    if(ang){ ctx.save(); ctx.translate(px+p.w/2,p.y+p.h/2); ctx.rotate(ang); px=-p.w/2; py=-p.h/2; }
    if(outline){ ctx.strokeStyle=topCol; ctx.lineWidth=3; ctx.strokeRect(px,py,p.w,p.h); ctx.fillStyle=topCol; ctx.fillRect(px,py,p.w,3); }
    else { const sp=platSpr(p); ctx.drawImage(sp, px-sp._ax, py-sp._ay, p.w+4, sp._h);
      if(p.corner && !p.mv && !p.arch) { ctx.fillStyle=PAL.plat; roundRect(ctx,px,py-p.h*0.8,Math.min(p.w*0.25,18),p.h*0.8+4,5); ctx.fill(); } }
    if(!outline){ if(p.rosa){ ctx.fillStyle='rgba(255,120,170,'+Math.min(0.55,p.rosa*0.2)+')'; roundRect(ctx,px,py-2,p.w,p.h+4,7); ctx.fill(); }
      if(p.gelo>0){ ctx.fillStyle='rgba(190,240,255,'+(0.55*clamp(p.gelo,0,1)).toFixed(2)+')'; roundRect(ctx,px,py-3,p.w,p.h+5,7); ctx.fill(); ctx.fillStyle='rgba(255,255,255,.8)'; for(let k=8;k<p.w-8;k+=26) ctx.fillRect(px+k,py-2,10,2); }
      if(p.ponte){ ctx.fillStyle='rgba(255,120,170,.8)'; roundRect(ctx,px,py-2,p.w,p.h+4,7); ctx.fill(); for(let k=18;k<p.w;k+=38) drawHeart(px+k,py-1,11,'#fff0f5',false); }
      if(p.sujo>1){ ctx.fillStyle='rgba(20,0,20,'+Math.min(0.7,p.sujo/10).toFixed(2)+')'; roundRect(ctx,px,py-2,p.w,p.h+4,7); ctx.fill(); } }
    if(p.espinhos||p.sujo>4.5){ const hh=p.espinhos?13:13*clamp((p.sujo-4.5)/2.5,0,1); ctx.fillStyle='#1a0a1a'; ctx.strokeStyle='#b06ab0'; ctx.lineWidth=1.5;
      for(let sx=px+4;sx<px+p.w-8;sx+=12){ ctx.beginPath(); ctx.moveTo(sx,py); ctx.lineTo(sx+6,py-hh); ctx.lineTo(sx+12,py); ctx.closePath(); ctx.fill(); ctx.stroke(); } }
    if(p.fragil){ ctx.strokeStyle='rgba(70,30,50,'+(0.35+Math.min(0.5,p.fragil.peso))+')'; ctx.lineWidth=1.5; ctx.beginPath();
      for(let k=1;k<4;k++){ const cxk=px+p.w*k/4; ctx.moveTo(cxk,py+1); ctx.lineTo(cxk-4,py+p.h*0.5); ctx.lineTo(cxk+2,py+p.h); } ctx.stroke(); }
    if(p.trampolim){ const sq=p.trampolim.t>0?4:0; ctx.strokeStyle='#7fffd4'; ctx.lineWidth=2.5; ctx.beginPath(); for(let k=0;k<4;k++){ const yy=py+p.h+3+k*5-sq; ctx.moveTo(px+p.w*0.3,yy); ctx.lineTo(px+p.w*0.7,yy+2.5); } ctx.stroke();
      ctx.fillStyle='rgba(127,255,212,.9)'; ctx.fillRect(px,py-3+sq,p.w,4); if(p.trampolim.lado){ ctx.fillStyle='#fff'; const cx2=px+p.w/2, d2=p.trampolim.lado; ctx.beginPath(); ctx.moveTo(cx2+d2*12,py-12); ctx.lineTo(cx2-d2*2,py-18); ctx.lineTo(cx2-d2*2,py-6); ctx.fill(); } }
    if(p.cascata && p.cascata.carga) drawHeart(px+p.w/2, py-26+Math.sin(time*4)*2, 22, '#ff5d8f', Q.tier>0);
    if(p.gira){ ctx.fillStyle='#e9e4f5'; ctx.beginPath(); ctx.arc(px+p.w/2,py+p.h/2,6,0,6.28); ctx.fill(); ctx.fillStyle='#6b6080'; ctx.beginPath(); ctx.arc(px+p.w/2,py+p.h/2,2.5,0,6.28); ctx.fill(); }
    if(p.mv){ ctx.fillStyle='rgba(255,230,170,.85)'; const m=p.mv.mode, cxp=px+p.w/2, cyp=py+p.h/2+1;
      ctx.beginPath(); if(m==='pingY'){ ctx.moveTo(cxp-5,cyp+1); ctx.lineTo(cxp,cyp-4); ctx.lineTo(cxp+5,cyp+1); }
      else { const d=(m==='wrapX'?p.mv.dir:1); ctx.moveTo(cxp-4*d,cyp-4); ctx.lineTo(cxp+4*d,cyp); ctx.lineTo(cxp-4*d,cyp+4); } ctx.fill(); }
    if(ang) ctx.restore();
    else if(p.flor && !outline && p.solid) drawSpr(florSpr(p.flor), p.x+p.flx, p.y);   // florzinha em cima (só enfeite)
  }
  ctx.globalAlpha=1;
  for(const st of stickies){ if(!inV(st.x,st.y-8,st.w,st.h+8)) continue;
    ctx.fillStyle='#6b4a22'; roundRect(ctx,st.x,st.y,st.w,st.h,6); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(st.x,st.y-7,st.w,4); ctx.fillStyle='#ffb703'; ctx.fillRect(st.x,st.y-7,st.w*clamp(st.hp/st.maxHp,0,1),4); }
  for(const h of pHearts){ if(!inV(h.x,h.y,h.w,h.h)) continue; const fl=h.rest?0:Math.sin(h.sw)*2; drawHeart(h.x+h.w/2,h.y+fl+3,h.w*0.92,h.col,Q.tier>0); }
  for(const bl of blocks){ if(!inV(bl.x,bl.y,bl.w,bl.h)) continue; const hit=bl.state!=='idle'; const xx=bl.x+(hit?Math.sin(bl.sw*40)*2.5:0);
    drawSpr(blockSpr(bl.w,hit),xx,bl.y);
    if(bl.state==='hit'){ ctx.fillStyle='#fff'; ctx.font='bold 13px sans-serif'; ctx.textAlign='center'; ctx.fillText(Math.ceil(bl.t), xx+bl.w/2, bl.y-6); } }
  for(const w of walls){ if(!inV(w.x,w.y,w.w,w.h)) continue; ctx.globalAlpha=0.6+0.25*Math.sin(time*6)*(w.life<5?2:1); drawSpr(wallSpr(w.h),w.x,w.y); } ctx.globalAlpha=1;
  for(const p of particles){ if(p.x<vx0||p.x>vx1||p.y<vy0||p.y>vy1) continue; ctx.globalAlpha=p.life>0?p.life:0;
    let sp=p._sp; if(!sp||sp._e!==SPR_E){ sp=p._sp=heartSpr(p.col,p.s,false); p._k=p.s/(Math.max(4,Math.round(p.s/3)*3)); }   // sprite guardado na partícula (sem montar texto a cada quadro)
    const k=p._k; ctx.drawImage(sp, p.x-sp._ax*k, p.y-sp._ay*k, sp._w*k, sp._h*k); }
  ctx.globalAlpha=1;

  if(cfg.type==='collect'){ if(rock) drawRock(rock);
    for(const h of fhearts){ if(!inV(h.x-h.s,h.y-h.s,h.s*3,h.s*3)) continue; const fl=Math.sin(h.sw)*2, cxh=h.x+h.w/2, cyh=h.y+fl;
      if(h.type==='snake'){ ctx.strokeStyle=h.fleeT>0?'#9be29b':'#37b24d'; ctx.lineWidth=h.w*0.35; ctx.lineCap='round';
        ctx.beginPath(); for(let k=0;k<5;k++){ const tx=cxh-h.vx*k*2.2, ty=cyh+h.s*0.5+Math.sin(time*8+k)*5; if(k===0)ctx.moveTo(tx,ty); else ctx.lineTo(tx,ty);} ctx.stroke(); ctx.lineCap='butt'; }
      if(h.alvoTp){ ctx.globalAlpha=0.5+0.4*Math.sin(time*20); ctx.strokeStyle='#c77dff'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(h.alvoTp.x+h.w/2,h.alvoTp.y-h.h/2,h.s*0.6,0,6.28); ctx.stroke(); ctx.globalAlpha=1; }
      if(h.type==='ghost') ctx.globalAlpha=((time+h.wob)%3)<1.1?0.9:0.28; else if(h.vshape==='ghost') ctx.globalAlpha=0.5;
      if(h.type==='camaleao') ctx.globalAlpha=(Math.abs(h.vx)>2.2||dist(cxh,cyh,player.x+player.w/2,player.y+player.h/2)<130)?0.9:0.18;
      if((cfg.bonusVar==='escura') && dist(cxh,cyh,player.x+player.w/2,player.y+player.h/2)>260 && luzT<=0) ctx.globalAlpha*=0.15;
      if(h.type==='dorminhoco' && h.dorme){ ctx.fillStyle='#fff'; ctx.font='bold 14px sans-serif'; ctx.textAlign='center'; ctx.fillText('z z',cxh+h.s*0.5,cyh-6); }
      drawSpr(fheartSpr(h),cxh,cyh); ctx.globalAlpha=1; }
    for(const e of enfeites) if(!e.visto) drawHeart(e.x,e.y,e.s,e.col,false); }

  for(const s of shots){ if(!inV(s.x-12,s.y-12,24,24)) continue; drawHeart(s.x,s.y-8,16+Math.sin(s.sw)*1.5,'#2a0038',true); }
  for(const s of loveShots){ drawHeart(s.x,s.y-s.sz*0.5,s.sz,'#ff2e63',true); }
  for(const wv of waves){ const wx=wv.cx+wv.dir*wv.dist, a=clamp(1-wv.dist/wv.maxDist,0,1);
    ctx.globalAlpha=a*0.85; ctx.strokeStyle='#ff5d8f'; ctx.lineWidth=4;
    ctx.beginPath(); for(let k=-2;k<=2;k++){ const yy=wv.y-Math.abs(k)*10; ctx.moveTo(wx-wv.dir*8,yy-wv.h*0.5+Math.sin((wv.dist*0.05)+k)*6); ctx.lineTo(wx,yy-wv.h*0.5); } ctx.stroke();
    drawHeart(wx,wv.y-wv.h*0.6,18,'#ff8fab',false); ctx.globalAlpha=1; }
  for(const L of lasers){ const a=clamp(L.life/0.55,0,1), ex=L.dir>0?Math.min(WORLD_W,vx1):Math.max(0,vx0);
    ctx.globalAlpha=a; ctx.lineCap='round';
    ctx.strokeStyle='rgba(255,143,171,.5)'; ctx.lineWidth=player.h*0.9; ctx.beginPath(); ctx.moveTo(L.x,L.y); ctx.lineTo(ex,L.y); ctx.stroke();
    ctx.strokeStyle='#fff'; ctx.lineWidth=6; ctx.beginPath(); ctx.moveTo(L.x,L.y); ctx.lineTo(ex,L.y); ctx.stroke();
    ctx.lineCap='butt'; ctx.globalAlpha=1; }
  for(const r of loveRain){ if(r.y<vy0||r.y>vy1) continue; drawHeart(r.x,r.y,r.sz,'#ff5d8f',false); }
  if(divineFx){ const a=clamp(1-divineFx.life/divineFx.maxLife,0,1);
    ctx.globalAlpha=a; ctx.strokeStyle='#fff3b0'; ctx.lineWidth=14; ctx.beginPath(); ctx.arc(divineFx.x,divineFx.y,divineFx.r,0,6.2832); ctx.stroke();
    ctx.globalAlpha=a*0.4; ctx.strokeStyle='#ff8fab'; ctx.lineWidth=34; ctx.beginPath(); ctx.arc(divineFx.x,divineFx.y,divineFx.r*0.82,0,6.2832); ctx.stroke(); ctx.globalAlpha=1; }
  for(const ry of elecRays){ const a=clamp(ry.life/0.25,0,1), Rr=srng(ry.seed); ctx.globalAlpha=a; ctx.strokeStyle='#bff0ff'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(ry.x,ry.y); for(let s2=1;s2<=4;s2++){ ctx.lineTo(ry.x+Math.cos(ry.ang)*ry.len*s2/4+(Rr()-0.5)*12, ry.y+Math.sin(ry.ang)*ry.len*s2/4+(Rr()-0.5)*12);} ctx.stroke(); }
  ctx.globalAlpha=1;
  if(player.elec){ drawHeart(prx+player.w/2,pry-52,22+Math.sin(time*12)*2,'#cdebff',true); }
  if(player.guard){ const g=player.guard; drawHeart(g.x,g.y-8,20,Math.sin(time*10)>0?'#7fffd4':'#5ce6c0',true);
    for(let i=0;i<g.hp;i++) drawHeart(g.x-10+i*10,g.y+12,7,'#0a8a5a',false); }
  for(const b of beams){ if(b.x<vx0-80||b.x>vx1+80) continue;
    if(b.t<0){ ctx.globalAlpha=0.4+0.45*Math.sin(time*30); ctx.strokeStyle='#ff2e63'; ctx.lineWidth=3; ctx.setLineDash([12,10]);
      ctx.beginPath(); ctx.moveTo(b.x,vy0); ctx.lineTo(b.x,vy1); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1; }
    else if(b.t<0.55){ ctx.globalAlpha=0.9; ctx.fillStyle='#0a0010'; ctx.fillRect(b.x-b.w/2,vy0,b.w,vy1-vy0);
      ctx.strokeStyle='#ff2e63'; ctx.lineWidth=4; ctx.strokeRect(b.x-b.w/2,vy0,b.w,vy1-vy0); ctx.globalAlpha=1; } }
  for(const sw of spikesW){ const sx2=sw.x+sw.dir*sw.dist; if(sx2<vx0||sx2>vx1) continue;
    ctx.fillStyle='#d7dee6'; ctx.strokeStyle='#8a97a5'; ctx.lineWidth=2;
    for(let k=0;k<3;k++){ const tx=sx2+sw.dir*k*15; ctx.beginPath(); ctx.moveTo(tx-9,groundY); ctx.lineTo(tx,groundY-28); ctx.lineTo(tx+9,groundY); ctx.closePath(); ctx.fill(); ctx.stroke(); } }

  for(const v of ventos){ if(v.x+v.w<vx0||v.x>vx1) continue; ctx.fillStyle='rgba(200,230,255,.06)'; ctx.fillRect(v.x,vy0,v.w,vy1-vy0); ctx.strokeStyle='rgba(220,240,255,.4)'; ctx.lineWidth=2; ctx.beginPath();
    for(let k=0;k<12;k++){ const yy=vy0+(((k*137)+(v.fy<0?-time*140:0))%(vy1-vy0)+(vy1-vy0))%(vy1-vy0), xx=v.x+(((k*61)+time*90*Math.sign(v.fx))%v.w+v.w)%v.w; ctx.moveTo(xx,yy); ctx.lineTo(xx+Math.sign(v.fx)*22,yy+(v.fy<0?-10:0)); } ctx.stroke(); }
  if(meta && inV(meta.x-40,meta.y-40,meta.w+80,meta.h+80)){ drawGlow('rgba(255,209,102,.9)',meta.x+meta.w/2,meta.y+meta.h/2,70,0.45+0.2*Math.sin(time*3));
    if(meta.tipo==='saida'){ ctx.fillStyle='#ff8fab'; roundRect(ctx,meta.x,meta.y,meta.w,meta.h,10); ctx.fill(); ctx.fillStyle='#2a0a3a'; roundRect(ctx,meta.x+8,meta.y+12,meta.w-16,meta.h-12,8); ctx.fill(); drawHeart(meta.x+meta.w/2,meta.y+2,20,'#ffd166',false); }
    else drawHeart(meta.x+meta.w/2, meta.y+Math.sin(time*3)*4, 58, '#ffd166', Q.tier>0);
    ctx.fillStyle='#fff'; ctx.font='bold 12px sans-serif'; ctx.textAlign='center'; ctx.fillText(meta.tipo==='saida'?'SAÍDA':'TOPO',meta.x+meta.w/2,meta.y-10); }
  for(const d of portas) if(d.a>0.01 && inV(d.x-20,d.y-d.h-20,d.w+40,d.h+40)) drawPorta(d);
  if(ouro && inV(ouro.x-30,ouro.y-30,60,60)){ const b=Math.sin(ouro.sw*3)*4; drawGlow('rgba(255,209,102,.9)',ouro.x,ouro.y+b,34,0.6); drawHeart(ouro.x,ouro.y-14+b,28,'#ffd166',true); }
  if(dominio && dominio.prende){ for(const wx of [dominio.x0,dominio.x1]){ if(wx<vx0-40||wx>vx1+40) continue; ctx.fillStyle=corA(dominio.T.cor,0.22+0.08*Math.sin(time*6)); ctx.fillRect(wx-16,vy0,32,vy1-vy0); ctx.fillStyle=corA(dominio.T.cor,0.8); ctx.fillRect(wx-3,vy0,6,vy1-vy0); } }   // paredes da arena
  for(const mo of monsters){ if(mo.kind==='sombrio' && inV(mo.x-400,mo.y-400,mo.w+800,mo.h+800)){ const scx=mo.x+mo.w/2, scy=mo.y+mo.h/2, rr=luzT>0?140:330;   // SOMBRIO apaga a luz (as bordas continuam aparecendo)
      drawGlow('rgba(4,0,10,1)',scx,scy,rr,0.92); ctx.fillStyle='rgba(255,214,224,.5)'; for(const p of platforms){ if(p.solid && Math.abs(p.x+p.w/2-scx)<rr+p.w/2 && Math.abs(p.y-scy)<rr) ctx.fillRect(p.x,p.y,p.w,2); } } }
  for(const mo of monsters) if(inV(mo.x-mo.w*0.6,mo.y-mo.h*0.6,mo.w*2.2,mo.h*2.2)){ const dono=dominio&&dominio.mo===mo;
    if(mo.elite||dono) drawGlow(dono?dominio.T.cor:'#ffd166',mo.x+mo.w/2,mo.y+mo.h/2,Math.max(mo.w,mo.h)*(dono?1.5:1.0),0.35+0.15*Math.sin(time*4));
    if(mo.pisaT>0){ ctx.globalAlpha=0.5+0.4*Math.sin(time*25); ctx.strokeStyle='#ff5d5d'; ctx.lineWidth=3; ctx.setLineDash([10,8]); ctx.beginPath(); ctx.arc(mo.x+mo.w/2,mo.y+mo.h,280,Math.PI,2*Math.PI); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1; }
    drawMonster(mo);
    if(mo.elite) drawSpr(emojiSpr('👑'),mo.x+mo.w/2,mo.y-26+Math.sin(time*3)*2);
    if(mo.stun>0) drawSpr(emojiSpr('💫'),mo.x+mo.w/2+(mo.elite?26:0),mo.y-26); }
  for(const n of npcs) if(inV(n.x-20,n.y-30,n.w+40,n.h+50)) drawNPC(n);
  if(subida && subida.y<vy1){ ctx.fillStyle='rgba(35,0,45,.84)'; ctx.fillRect(vx0,subida.y,vx1-vx0,vy1-subida.y+mg); ctx.fillStyle='rgba(140,60,170,.65)'; ctx.beginPath(); ctx.moveTo(vx0,subida.y+20);
    for(let x=vx0;x<=vx1;x+=40) ctx.lineTo(x,subida.y-8*Math.sin(x*0.02+time*3)); ctx.lineTo(vx1,subida.y+20); ctx.closePath(); ctx.fill(); }

  for(const b of blasts){ const a=clamp(1-b.life/b.maxLife,0,1);
    drawGlow('rgba(255,46,99,.55)',b.x,b.y,b.r,a*0.9);
    ctx.globalAlpha=a; ctx.strokeStyle='#ff2e63'; ctx.lineWidth=4; const hs=b.r*1.18; heartPath(ctx,b.x,b.y-hs*0.5,hs); ctx.stroke(); ctx.globalAlpha=1; }

  for(const e of echoes){ if(e.a<=0) continue; ctx.globalAlpha=e.a*0.6; drawSpr(playerSpr(),e.x,e.y); } ctx.globalAlpha=1;
  drawPlayer(prx,pry);
  ctx.setTransform(DPR,0,0,DPR,0,0);

  // efeitos de tela (em cache)
  if(FOG){ const psx=(prx+player.w/2-camRX)*ZOOM, psy=(pry+player.h/2-camRY)*ZOOM; ctx.globalAlpha=1-clamp(luzT/2.5,0,1)*0.85; ctx.drawImage(FOG, psx-FOG._w/2, psy-FOG._h/2, FOG._w, FOG._h); ctx.globalAlpha=1;   // explosão ilumina
    if(escuro||cfg.bonusVar==='escura'){ ctx.fillStyle='rgba(255,214,224,.35)'; for(const p of platforms){ const x=(p.x-camRX)*ZOOM, y=(p.y-camRY)*ZOOM; if(x>-400&&x<SCRW&&y>-10&&y<SCRH) ctx.fillRect(x,y,p.w*ZOOM,2); } } }   // bordas sempre visíveis (sem queda injusta)
  if(VIG && Q.tier>1) ctx.drawImage(VIG,0,0,SCRW,SCRH);
  if(M.flicker&&!OPC.reduz){ const ph=(time*0.37+level*0.13)%1; if(ph<0.06 || (ph>0.09&&ph<0.11)){ ctx.fillStyle='rgba(0,0,0,.72)'; ctx.fillRect(0,0,SCRW,SCRH); } }
  if(phantomT>0){ ctx.fillStyle='rgba(120,0,60,'+(0.10+0.05*Math.sin(time*10)).toFixed(3)+')'; ctx.fillRect(0,0,SCRW,SCRH); }
  if(lentoT>0){ ctx.fillStyle='rgba(120,170,255,'+(0.12*clamp(lentoT,0,1)).toFixed(3)+')'; ctx.fillRect(0,0,SCRW,SCRH); }   // tempo lento
  if(dominio) drawDominioTela();
  if(tristeT>0){ ctx.fillStyle='rgba(40,30,60,'+(0.35*clamp(tristeT/1.2,0,1)).toFixed(3)+')'; ctx.fillRect(0,0,SCRW,SCRH); }   // tela fica triste quando alguém explode
  drawIndicators();
  if(toastT>0){ const al=clamp(toastT/0.4,0,1), fs=MOBILE?15:19; ctx.globalAlpha=al; ctx.font='bold '+fs+'px "Trebuchet MS",sans-serif';
    const tw=Math.min(SCRW-24,ctx.measureText(toastTxt).width+44), th=fs+22, tx=SCRW/2-tw/2, ty=Math.round(SCRH*(MOBILE?0.27:0.2));   // abaixo do placar, nunca em cima dele
    ctx.fillStyle='rgba(40,6,30,.86)'; roundRect(ctx,tx,ty,tw,th,th/2); ctx.fill(); ctx.strokeStyle=toastCol; ctx.lineWidth=2.5; ctx.stroke();
    ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(toastTxt,SCRW/2,ty+th/2+1,tw-24); ctx.textBaseline='alphabetic'; ctx.globalAlpha=1; }
  if(cfg.type==='collect'&&carrying>0&&rock&&!rock.done){
    const psx=(prx+player.w/2-camRX)*ZOOM, psy=(pry-26-camRY)*ZOOM;
    const ang=Math.atan2((rock.y+rock.h/2)-(pry+player.h/2),(rock.x+rock.w/2)-(prx+player.w/2));
    ctx.save(); ctx.translate(psx,psy); ctx.rotate(ang);
    ctx.fillStyle='#ffd166'; ctx.beginPath(); ctx.moveTo(22,0); ctx.lineTo(4,-9); ctx.lineTo(4,9); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle='#fff'; ctx.font='bold 15px sans-serif'; ctx.textAlign='center'; ctx.fillText('💖 '+carrying+' → Máquina', psx, psy-14);
  }
  if(MOBILE){ for(const j of jumpTouches.values()){ ctx.globalAlpha=0.35; ctx.strokeStyle='#ff8fab'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(j.x,j.y,28,0,6.28); ctx.stroke();
      ctx.fillStyle='#ffd6e0'; ctx.beginPath(); ctx.moveTo(j.x,j.y-12); ctx.lineTo(j.x-9,j.y+4); ctx.lineTo(j.x+9,j.y+4); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1; }
    if(level<=2 && time<7 && state==='play'){ const al=clamp((7-time)/1.5,0,1)*0.75; ctx.globalAlpha=al; ctx.fillStyle='#fff'; ctx.font='bold 15px "Trebuchet MS",sans-serif'; ctx.textAlign='center';
      for(const [tx,tx2] of [['esquerda: arraste = andar ◀ ▶ · pra cima = pular',SCRW*0.25],['direita: deslize ⤴ = pular · toque = 💥',SCRW*0.75]]){ const tw=ctx.measureText(tx).width+28;
        ctx.fillStyle='rgba(30,8,40,.82)'; roundRect(ctx,tx2-tw/2,SCRH*0.62-21,tw,32,16); ctx.fill(); ctx.fillStyle='#fff'; ctx.fillText(tx,tx2,SCRH*0.62); }   // fundo escuro: dá pra ler em cima das plataformas
      ctx.strokeStyle='rgba(255,255,255,.25)'; ctx.setLineDash([6,8]); ctx.beginPath(); ctx.moveTo(SCRW/2,SCRH*0.3); ctx.lineTo(SCRW/2,SCRH*0.85); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1; } }
  if(joy&&joy.modo==='anda'){ ctx.globalAlpha=0.95; drawSpr(joySpr(),joy.ox,joy.oy); const kr=JOY_R*0.42;
    drawHeart(joy.x,joy.y-kr*1.05,kr*2.2,'#ff5d8f',true); ctx.globalAlpha=1; }
  qualityWork=performance.now()-workT0;
}
let qualityWork=0;

function drawRock(r){ const glow=0.25+0.2*Math.sin(time*3)+(r.fill/r.target)*0.3;
  drawGlow('rgba(255,90,140,.9)',r.x+r.w/2,r.y+r.h/2,100,clamp(glow,0,1));
  drawSpr(rockSpr(),r.x,r.y);
  const f=clamp(r.fill/r.target,0,1);
  ctx.save(); heartPath(ctx,r.x+r.w/2,r.y+12,32); ctx.clip();
  ctx.fillStyle='#ff2e63'; ctx.fillRect(r.x-5,r.y+12+32*(1-f),r.w+10,32*f+4); ctx.restore();
  ctx.strokeStyle='#ff8fab'; ctx.lineWidth=2; heartPath(ctx,r.x+r.w/2,r.y+12,32); ctx.stroke();
  ctx.fillStyle='#fff'; ctx.font='bold 13px sans-serif'; ctx.textAlign='center'; ctx.fillText(r.fill+'/'+r.target, r.x+r.w/2, r.y-8); }

function drawPlayer(x,y){ const w=player.w,h=player.h,cx=x+w/2;
  if(player.shieldT>0){ const R=w*1.9, a=clamp(player.shieldT/5,0,1);
    ctx.globalAlpha=0.5+0.3*Math.sin(time*10); ctx.strokeStyle='#7fe0ff'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(cx,y+h*0.5,R*(0.8+0.2*a),0,6.2832); ctx.stroke();
    ctx.globalAlpha=0.12; ctx.fillStyle='#7fe0ff'; ctx.fill(); ctx.globalAlpha=1; }
  if(player.invuln>0 && Math.floor(time*16)%2===0) return;
  if(player.charging&&player.charge>0.02){ const r=30+player.charge*90+Math.sin(time*18)*4; drawGlow('rgba(255,46,99,.8)',cx,y+h*0.45,r,0.4+player.charge*0.4); }
  const sq=player.onGround?1:(player.vy<0?1.06:0.96);     // estica no pulo, achata na queda (dá vida ao movimento)
  if(sq!==1){ ctx.save(); ctx.translate(cx,y+h); ctx.scale(2-sq,sq); ctx.translate(-cx,-(y+h)); }
  if(player.face<0){ ctx.save(); ctx.translate(cx,0); ctx.scale(-1,1); ctx.translate(-cx,0); drawSpr(playerSpr(),x,y); ctx.restore(); }
  else drawSpr(playerSpr(),x,y);
  if(sq!==1) ctx.restore();
  const ps=13+(player.charging?player.charge*8:Math.sin(time*4)*1.2);
  drawHeart(cx,y+h*0.55-ps*0.5,ps,'#ff2e63',Q.tier>0);
  if(player.rootT>0){ ctx.strokeStyle='rgba(150,80,210,.7)'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(cx,y+h*0.5,w*0.8,0,6.28); ctx.stroke(); } }

function drawMonster(mo){ const x=mo.x,y=mo.y,w=mo.w,h=mo.h,cx=x+w/2; const bob=Math.sin(mo.bob)*3;
  const hpbar=(yb)=>{ if(mo.maxHp>1){ ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(x,yb,w,4); ctx.fillStyle='#ff2e63'; ctx.fillRect(x,yb,w*clamp(mo.hp/mo.maxHp,0,1),4); } };
  const hitc=mo.hitT>0;
  if(mo.kind==='dog'){ const b2=Math.sin(mo.bob)*2; ctx.fillStyle=hitc?'#fff':'#161018';
    roundRect(ctx,x,y+b2+h*0.2,w,h*0.55,8); ctx.fill(); const hx=mo.vx>=0?x+w*0.66:x+w*0.02;
    roundRect(ctx,hx,y+b2,w*0.34,h*0.45,6); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx+w*0.06,y+b2); ctx.lineTo(hx+w*0.01,y+b2-h*0.22); ctx.lineTo(hx+w*0.16,y+b2); ctx.fill();
    for(let i=0;i<4;i++){ const lx=x+w*(0.13+i*0.23), sw=Math.sin(time*14+i)*3; ctx.fillRect(lx,y+b2+h*0.72,w*0.09,h*0.28+sw); }
    ctx.fillStyle='#ff3b6b'; ctx.beginPath(); ctx.arc(hx+(mo.vx>=0?w*0.2:w*0.14),y+b2+h*0.16,w*0.06,0,6.28); ctx.fill(); hpbar(y+b2-7); return; }
  if(mo.kind==='sphere'){ const b2=Math.sin(mo.bob)*4, cy=y+b2+h/2;
    ctx.fillStyle=hitc?'#fff':'#1a0e2a'; ctx.beginPath(); ctx.arc(cx,cy,w*0.5,0,6.28); ctx.fill(); ctx.strokeStyle='#6a3a9a'; ctx.lineWidth=3; ctx.stroke();
    ctx.fillStyle='#bfe0ff'; ctx.beginPath(); ctx.arc(cx-w*0.16,cy-h*0.05,w*0.08,0,6.28); ctx.arc(cx+w*0.16,cy-h*0.05,w*0.08,0,6.28); ctx.fill();
    ctx.fillStyle='#7fc8ff'; for(let i=0;i<2;i++){ const tx=cx+(i?1:-1)*w*0.16, ty=cy+h*0.08+((time*60)%26); ctx.beginPath(); ctx.arc(tx,ty,3.5,0,6.28); ctx.fill(); }
    if(player.rootT>0 && dist(cx,cy,player.x+player.w/2,player.y+player.h/2)<260){ ctx.strokeStyle='rgba(150,80,210,.6)'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(player.x+player.w/2,player.y+player.h/2); ctx.stroke(); }
    hpbar(y+b2-7); return; }
  if(mo.kind==='tentacle'){ const base=mo.y+mo.h, cxv=mo.x+mo.w/2;
    ctx.strokeStyle=hitc?'#fff':'#3a1850'; ctx.lineCap='round';
    for(let a=0;a<mo.arms;a++){ const off=(a-(mo.arms-1)/2)*mo.w*0.5/mo.arms; ctx.lineWidth=mo.w*0.22;
      ctx.beginPath(); ctx.moveTo(cxv+off,base); let lx=cxv+off, ly=base; const segs=5, segL=mo.h/segs;
      for(let sg=1;sg<=segs;sg++){ const wob=Math.sin(time*3+mo.sway+a+sg*0.6)*(8+sg*3); lx=cxv+off*0.4+wob; ly=base-sg*segL; ctx.lineTo(lx,ly); } ctx.stroke();
      ctx.fillStyle='#ff3b6b'; ctx.beginPath(); ctx.arc(lx,ly,mo.w*0.12,0,6.28); ctx.fill(); }
    ctx.lineCap='butt'; ctx.fillStyle=hitc?'#fff':'#241430'; roundRect(ctx,mo.x,base-mo.w*0.5,mo.w,mo.w*0.5,8); ctx.fill();
    hpbar(mo.y+Math.sin(mo.bob)*3-7); return; }
  if(mo.beam && mo.beam.p){ const bp=mo.beam.p; ctx.globalAlpha=clamp(mo.beam.t,0,1)*0.8; ctx.strokeStyle='#7fe0ff'; ctx.lineWidth=3; ctx.setLineDash([8,8]);
    ctx.beginPath(); ctx.moveTo(cx,y+h*0.4); ctx.lineTo(bp.x+bp.w/2,bp.y); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1; }
  if(mo.kind==='tristonho' && mo.ringT>0){ ctx.globalAlpha=0.6; ctx.strokeStyle='#9aa7c7'; ctx.lineWidth=4; ctx.setLineDash([10,8]); ctx.beginPath(); ctx.arc(cx,y+h/2,210*(1-mo.ringT/0.9)+20,0,6.28); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1; }
  if(mo.kind==='piscador' && mo.alvoP){ ctx.globalAlpha=0.5+0.4*Math.sin(time*20); ctx.strokeStyle='#c77dff'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(mo.alvoP.x,mo.alvoP.y-mo.h/2,mo.w*0.6,0,6.28); ctx.stroke(); ctx.globalAlpha=1; }
  if(mo.kind==='camaleao' && !(mo.visT>0) && !hitc){ ctx.globalAlpha=0.14+0.06*Math.sin(time*8); drawSpr(monsterSpr(mo,false), cx, y+bob+h/2); ctx.globalAlpha=1; return; }   // quase invisível
  drawSpr(monsterSpr(mo,hitc), cx, y+bob+h/2);
  hpbar(y+bob-9); }

function drawNPC(n){ const x=n.x,y=n.y,w=n.w,h=n.h,cx=x+w/2;
  const bob=n.state==='happy'?Math.abs(Math.sin(n.bob))*5:0; let yy=y-bob, xx=x;
  if(n.state==='frozen') xx=x+Math.sin(n.shake*40)*2.5;
  if(n.state==='sad'){ const def=n.def||{};
    if(def.legs){ ctx.strokeStyle='#2a5bd0'; ctx.lineWidth=4; ctx.lineCap='round';
      for(let l=0;l<4;l++){ const lx=xx+w*(0.18+l*0.21), sw=Math.sin(time*9+l*1.4)*6;
        ctx.beginPath(); ctx.moveTo(lx,yy+h-2); ctx.lineTo(lx+sw,yy+h+12); ctx.stroke(); } ctx.lineCap='butt'; }
    drawSpr(sadSpr(n),xx,yy);
    if(n.phone){ ctx.fillStyle='#11213f'; ctx.fillRect(cx+(n.dir>=0?6:-12),yy+22,7,11);
      ctx.fillStyle='rgba(150,220,255,.95)'; ctx.fillRect(cx+(n.dir>=0?7:-11),yy+23,5,8); }
  } else if(n.state==='frozen'){
    drawSpr(happySpr(w,h,(OPC.reduz||Math.sin(time*30)>0)?3:4),xx,yy);
    { const tt=1-n.freezeT/FREEZE_TIME, sp=3+tt*16; for(let k=0;k<3;k++){ const a=time*sp+k*2.09; drawHeart(cx+Math.cos(a)*w*0.75, yy+h*0.25+Math.sin(a)*h*0.3, 8+tt*5,'#ff5d8f',false); } }   // corações aceleram na sobrecarga
    ctx.fillStyle='#ff6b8a'; ctx.font='bold 13px sans-serif'; ctx.textAlign='center'; ctx.fillText('💔 '+Math.ceil(n.freezeT),cx,yy-8);   // vai explodir: é ruim
  } else {
    drawSpr(happySpr(w,h,n.grace>0?0:(n.holding?1:2)),xx,yy);
    if(n.perso && n.perso!=='romantico' && !n.holding){ if(n.ciume) drawGlow('rgba(255,60,60,.8)',cx,yy-12,14,0.6); drawSpr(emojiSpr(ICON_PERSO[n.perso]),cx,yy-20); }
    if(n.holding) drawHeart(cx,yy-18,16,'#ff2e63',Q.tier>0); }
}

function drawDominioTela(){ const D=dominio, T=D.T;
  ctx.fillStyle=corA(T.cor,(0.07+0.03*Math.sin(time*3)).toFixed(3)); ctx.fillRect(0,0,SCRW,SCRH);
  const ap=clamp(D.aviso/0.5,0,1), barH=SCRH*0.1*clamp(D.aviso>0?1:0,0,1);
  if(D.aviso>0){ ctx.globalAlpha=Math.min(1,ap+0.2); ctx.fillStyle='#000'; ctx.fillRect(0,0,SCRW,barH); ctx.fillRect(0,SCRH-barH,SCRW,barH);   // faixas pretas de cinema
    const fs=MOBILE?24:44, cy=SCRH*0.44; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='bold '+Math.round(fs*0.45)+'px "Trebuchet MS",sans-serif'; ctx.fillStyle='#fff'; ctx.fillText(D.dono==='jogador'?'🌸 EXPANSÃO DE DOMÍNIO 🌸':'👑 EXPANSÃO DE DOMÍNIO 👑',SCRW/2,cy-fs*0.9);
    ctx.font='bold '+fs+'px "Trebuchet MS",sans-serif'; ctx.lineWidth=6; ctx.strokeStyle='rgba(20,0,20,.85)'; ctx.strokeText(T.nome,SCRW/2,cy,SCRW-30); ctx.fillStyle=T.cor; ctx.fillText(T.nome,SCRW/2,cy,SCRW-30);
    ctx.font='bold '+Math.round(fs*0.42)+'px "Trebuchet MS",sans-serif'; ctx.fillStyle='#fff'; ctx.fillText(T.txt,SCRW/2,cy+fs*0.9,SCRW-30); ctx.textBaseline='alphabetic'; ctx.globalAlpha=1; }
  const bw=Math.min(300,SCRW-40), bx=SCRW/2-bw/2, by=SCRH-(MOBILE?92:104), fr=clamp(1-D.t/D.dur,0,1);   // barra do domínio
  ctx.fillStyle='rgba(20,4,24,.8)'; roundRect(ctx,bx,by,bw,16,8); ctx.fill(); ctx.fillStyle=T.cor; roundRect(ctx,bx+2,by+2,(bw-4)*fr,12,6); ctx.fill();
  ctx.font='bold '+(MOBILE?11:13)+'px sans-serif'; ctx.textAlign='center'; ctx.fillStyle='#fff';
  ctx.fillText(D.dono==='jogador'?'🌸 SEU DOMÍNIO':'👑 '+T.nome+' · quebre: '+'💥'.repeat(Math.max(0,D.hp)),SCRW/2,by-6,SCRW-20); }
function drawIndicators(){
  const pcx=player.x+player.w/2, pcy=player.y+player.h/2, list=[];
  if(cfg.type==='love'){ for(const n of npcs) if(n.state==='sad') list.push({x:n.x+n.w/2,y:n.y+n.h/2,icon:'😔',col:'#7fb0ff'});
    for(const mo of monsters) list.push({x:mo.x+mo.w/2,y:mo.y+mo.h/2,icon:'👹',col:'#ff5d8f'}); }
  else if(rock) list.push({x:rock.x+rock.w/2,y:rock.y+rock.h/2,icon:'💗',col:'#ffd166'});
  if(meta) list.unshift({x:meta.x+meta.w/2,y:meta.y+meta.h/2,icon:meta.tipo==='saida'?'🚪':'🗼',col:'#ffd166'});
  const m=26; let shown=0;
  list.sort((a,b)=>dist(a.x,a.y,pcx,pcy)-dist(b.x,b.y,pcx,pcy));
  for(const t of list){ const sx=(t.x-camRX)*ZOOM, sy=(t.y-camRY)*ZOOM;
    if(sx>=0&&sx<=SCRW&&sy>=0&&sy<=SCRH) continue;
    if(++shown>12) break;
    const cxs=clamp(sx,m,SCRW-m), cys=clamp(sy,MOBILE?96:110,SCRH-m-60);   // não fica embaixo do placar
    ctx.globalAlpha=0.9; drawSpr(indSpr(t.icon,t.col),cxs,cys);
    const ang=Math.atan2(sy-cys,sx-cxs); ctx.fillStyle=t.col; ctx.beginPath();
    ctx.moveTo(cxs+Math.cos(ang)*26,cys+Math.sin(ang)*26); ctx.lineTo(cxs+Math.cos(ang+0.5)*17,cys+Math.sin(ang+0.5)*17); ctx.lineTo(cxs+Math.cos(ang-0.5)*17,cys+Math.sin(ang-0.5)*17); ctx.fill(); }
  ctx.globalAlpha=1;
}

// ===== [TELAS] HUD (DOM) =====
const amorFill=document.getElementById('amorFill'), stamFill=document.getElementById('stamFill');
const countEl=document.getElementById('count'), objEl=document.getElementById('obj'), overlay=document.getElementById('overlay');
let _barA=-1,_barS=-1;
function setBars(){ const a=Math.round((player.charging?player.charge:0)*100), s=Math.round(player.stam/MAX_STAM*100);
  if(a!==_barA){ _barA=a; amorFill.style.transform='scaleX('+(a/100)+')'; }
  if(s!==_barS){ _barS=s; stamFill.style.transform='scaleX('+(s/100)+')'; if(stamFill.classList) stamFill.classList.toggle('full', s>=100); } }
function jumpLabel(){ return player.maxJumps>=3?'pulo triplo':(player.maxJumps>=2?'pulo duplo':'pulo simples'); }
function hpHTML(){ let s=''; for(let i=0;i<player.maxHp;i++) s+='<i class="'+(i<player.hp?'on':'off')+'">❤</i>'; return '<span class="hpRow">'+s+'</span>'; }
function setObjective(){ const m = mode==='infinite' ? '∞ INFINITO · recorde '+deepest : 'AVENTURA · '+'❤'.repeat(Math.max(0,lives));
  objEl.innerHTML='<div class="oMode">'+m+'</div><div class="oLvl">'+cfg.label+'</div>'+((M.tags&&M.tags.length)?'<div class="oTags">'+M.tags.map(t=>'<span>'+(MUTATORS[t]?MUTATORS[t].icon+' ':'')+t+'</span>').join('')+'</div>':''); }
function powerLabel(){ if(!player||!player.powers||!player.powers.length) return (player&&player.bonus)?'⭐ bônus +'+player.bonus:'';
  const P=ACTIVE_POWERS[player.powers[player.equip]];
  return '★ '+P.name+' <span class="cost">'+P.cost+'⚡</span>'+(MOBILE?'':' <kbd>E</kbd>')+(player.powers.length>1?(MOBILE?' ⇄':' <kbd>Q</kbd> troca'):'')+(player.bonus?' · ⭐+'+player.bonus:''); }
function updateHUD(){ if(!player||!cfg) return;
  let main, sub;
  const obj=cfg.objetivo||'apaixonar';
  if(cfg.type==='love' && (obj==='saida'||obj==='topo')){ main=(obj==='saida'?'🚪 chegue à SAÍDA':'🗼 suba ao TOPO'); sub=(cfg.especial?cfg.especial.curta:'')+' · '+jumpLabel(); }
  else if(cfg.type==='love' && obj==='resgate'){ const okc=npcs.filter(n=>n.state==='happy'&&n.holding).length; main='💗 <b>'+okc+'</b><span class="of">/'+npcs.length+'</span>'; sub='com amor-próprio'+(explodidos?' · 💔 '+explodidos:'')+(monsters.length?' · 👹 '+monsters.length:''); }
  else if(cfg.type==='love'){ const sad=npcs.filter(n=>n.state==='sad').length;
    main='💞 <b>'+(totalSad0-sad)+'</b><span class="of">/'+totalSad0+'</span>';
    sub=(sad?sad+' triste'+(sad===1?'':'s'):'✔ todos apaixonados')+(monsters.length?(sad?' · 👹 '+monsters.length:' · <b>falta derrotar 👹 '+monsters.length+'</b>'):'')+(explodidos?' · 💔 '+explodidos:'')+' · '+jumpLabel(); }
  else { main='💗 <b>'+(rock?rock.fill:0)+'</b><span class="of">/'+(rock?rock.target:0)+'</span>'; sub='carregando '+carrying+(rock&&rock.tempo!=null?' · ⏰ '+Math.max(0,Math.ceil(rock.tempo))+' s':'')+' · '+jumpLabel(); }
  countEl.innerHTML='<div class="cMain">'+main+'</div>'+hpHTML()+'<div class="cSub">'+sub+'</div>'+(powerLabel()?'<div class="cPow">'+powerLabel()+'</div>':''); }
function checkWinLove(){ if(cfg.type!=='love'||state!=='play') return; const obj=cfg.objetivo||'apaixonar';
  if(obj==='saida'||obj==='topo') return;                                                    // vence ao tocar a meta
  if(obj==='resgate'){ if(monsters.length===0 && npcs.every(n=>n.state==='happy'&&n.holding)) levelClear(); return; }
  const todos=npcs.every(n=>n.state!=='sad');
  if(todos && monsters.length===0){ levelClear(); return; }
  if(todos && monsters.length>0 && !avisoMonstros){ avisoMonstros=true;                       // faltava este aviso
    toast('💞 Todos apaixonados! Agora falta derrotar '+monsters.length+' monstro'+(monsters.length>1?'s':'')+' 👹',5,'#ff5d8f');
    beep(520,0.15,'triangle',0.06); later(160,()=>beep(390,0.2,'triangle',0.05)); G('evento','faltam_monstros',null,null); updateHUD(); } }

// ===== [TELAS] overlay: menu, tutorial, briefing, pausa, fim =====
const FLOATS=(()=>{ let s=''; for(let i=0;i<14;i++){ s+='<span class="fh" style="left:'+((i*37)%100)+'%;animation-delay:'+(-(i*1.7)%12).toFixed(1)+'s;animation-duration:'+(9+(i*13)%8)+'s;font-size:'+(14+(i*7)%26)+'px">❤</span>'; } return s; })();
function K(pc,mob){ return MOBILE ? '<b class="tbtnTip">'+mob+'</b>' : '<kbd>'+pc+'</kbd>'; }
function showScreen(html,cls){ overlay.className=cls||''; overlay.innerHTML='<div class="fx" aria-hidden="true">'+FLOATS+'</div><div class="panel">'+html+'</div>'; drawDirty=true; }
function hideOverlay(){ overlay.classList.add('hidden'); }
function on(id,fn){ const el=document.getElementById(id); if(el) el.onclick=()=>{ beep(620,0.06,'sine',0.04); fn(); }; }
const BTN=(id,txt,cls,primary)=>'<button id="'+id+'" class="btn '+(cls||'')+'"'+(primary?' data-primary="1"':'')+'><span class="bh" aria-hidden="true"></span><span>'+txt+'</span></button>';
const LOGO='<div class="logo" aria-hidden="true"><svg viewBox="0 0 120 110" width="120" height="110"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb3c8"/><stop offset=".5" stop-color="#ff2e63"/><stop offset="1" stop-color="#b5179e"/></linearGradient></defs>'+
  '<g class="burst">'+[0,1,2,3,4,5,6,7].map(i=>'<rect x="58" y="2" width="4" height="16" rx="2" fill="#ffd166" transform="rotate('+(i*45)+' 60 55)"/>').join('')+'</g>'+
  '<path class="lheart" d="M60 98 C 20 70, 6 48, 18 30 C 30 12, 52 16, 60 34 C 68 16, 90 12, 102 30 C 114 48, 100 70, 60 98 Z" fill="url(#lg)" stroke="#fff" stroke-width="3"/>'+
  '<path d="M38 40 Q 44 30 54 34" stroke="rgba(255,255,255,.7)" stroke-width="5" fill="none" stroke-linecap="round"/></svg></div>';

function briefingCards(n){
  const isCollect=cfg.type==='collect', kinds={}; monsters.forEach(m=>kinds[m.kind]=1);
  const cards=[];
  if(cfg.especial){ const E=cfg.especial, k='esp:'+E.id; cards.push({icon:E.icon, tag:'FASE ESPECIAL'+(E.nivel>1?' · '+['','aprender','aplicar','combinar','dominar'][E.nivel]:''), big:E.nome, sub:seen[k]?E.curta:E.txt}); seen[k]=1; }
  if(isCollect && cfg.bonusVar && cfg.bonusVar!=='tradicional'){ const B=BONUS_VAR[cfg.bonusVar], k='bv:'+cfg.bonusVar; cards.push({icon:'💕', tag:'FASE BÔNUS', big:B.nome, sub:B.txt}); seen[k]=1; }
  // poderes novos desta fase
  for(const u of UNLOCKS){ if(u.lv===n && !seen['pw:'+u.id]){ seen['pw:'+u.id]=1;
    cards.push({icon:u.icon, tag:'NOVO PODER', big:u.name, sub:u.what, how:MOBILE?u.mob:u.pc}); } }
  if(isCollect){
    if(!seen.collect){ seen.collect=1;
      cards.push({icon:'💕', big:'HORA DA COLETA!', sub:'Os corações estão soltos pela fase. Encoste num deles pra pegar.'});
      cards.push({icon:'🏃', big:'ELES FOGEM E PULAM', sub:'Eles aprendem pra onde você corre. Encurrale contra uma parede ou espere eles pularem.'});
      cards.push({icon:'💗', big:'LEVE À MÁQUINA DO AMOR', sub:'Encoste na Máquina (no meio da fase) carregando corações. Encha '+cfg.target+' pra passar. A seta amarela aponta pra ela.'});
      cards.push({icon:'👀', big:'DISFARCES', sub:'Estrela, fantasma, gema, losango, bolha… todos contam como coração.'});
    } else cards.push({icon:'💕', big:'COLETA: '+cfg.target+' CORAÇÕES', sub:'Pegue e leve à Máquina do Amor.'});
    if((cfg.collectIndex||1)>=2 && !seen.collectSpecial){ seen.collectSpecial=1;
      cards.push({icon:'🎩', big:'CORAÇÕES ESPECIAIS', sub:'Óculos = rápido · fantasma = atravessa tudo · boné = 2 toques · gravata = te empurra · coroa = vira 2 · cachecol = vale 2 · cartola verde = rouba 1 que você carrega!'}); }
  } else {
    if(!seen.love){ seen.love=1;
      cards.push({icon:'💥', big:'EXPLODA DE AMOR', sub:(MOBILE?'Toque rápido em QUALQUER lugar da tela = explosão. Segure parado pra carregar e solte PERTO dos tristes (azuis). Arrastar não explode.':'Segure '+K('ESPAÇO','')+' pra carregar e solte PERTO dos tristes (azuis).')+' Quanto mais carregar, maior a explosão.'});
      cards.push({icon:'😱', big:'AMOR DEMAIS APERTA', sub:'Quem você apaixona corre atrás de você querendo abraço — se encostar, tira 1 ❤ de vida. Apaixonou? Siga em frente!'});
      cards.push({icon:'💔', big:'AMOR DEMAIS EXPLODE', sub:'Se você explodir de novo perto de um apaixonado, ele congela e em 3 s EXPLODE de amor. Isso é RUIM: ele vira só pedaços de coração e você perde energia. Melhor fugir dele.'});
      cards.push({icon:'🟩', big:'BLOCOS VERDE-ÁGUA', sub:'Exploda um: em 3 s ele cai e solta corações. Apaixonado que pega um para de te seguir, e os tristes por perto vão até eles.'});
      cards.push({icon:'💞', big:'PARA PASSAR', sub:'Apaixone TODOS os tristes. As setas na borda da tela mostram onde estão.'});
    } else if((cfg.objetivo||'apaixonar')==='apaixonar') cards.push({icon:'💞', big:'APAIXONE OS '+npcs.filter(x=>x.state==='sad').length+' TRISTES', sub:(MOBILE?'Toque (ou segure e solte) em qualquer lugar da tela':'Segure '+K('ESPAÇO',''))+' perto deles.'});
    if(monsters.length && !seen.mon){ seen.mon=1; cards.push({icon:'👹', big:'MONSTROS!', sub:'Encostar machuca. A explosão tira vida deles (barrinha em cima). Para passar: apaixone todos E derrote todos os monstros.'}); }
    const MK={ shooter:['🎯','ATIRADOR','Lança corações negros em você. Sua explosão destrói os que estiverem perto.'],
      dog:['🐕','CÃO SOMBRIO','Morde e te deixa mais lento por uns segundos (não tira vida).'],
      eater:['👄','COMILÃO','Come os tristes! Apaixone-os antes que ele chegue.'],
      sphere:['🔮','ESFERA CHORONA','Flutua atrás de você e te prende por 1 s. Afaste-se e exploda.'],
      tentacle:['🦑','TENTÁCULO','Parado no chão. Encostar machuca; tem mais vida.'],
      spiker:['🦔','ESPINHOS','Solta espinhos que correm pelo chão: pule por cima!'],
      beamer:['🔻','FEIXE','Uma linha tracejada avisa: saia da coluna antes do corte. A explosão apaga o feixe.'],
      arquiteto:['🏗️','ARQUITETO','Mantém distância e EMPURRA pra longe a plataforma pra onde você vai (ela treme antes). A escada principal ele não consegue mexer.'],
      tristonho:['🌧️','TRISTONHO','De tempos em tempos solta uma onda cinza (um anel avisa antes) que deixa os apaixonados por perto TRISTES de novo.'],
      camaleao:['🦎','CAMALEÃO','Fica quase invisível e aparece de vez em quando. Procure o brilho fraquinho.'],
      divisor:['🧫','DIVISOR','Quando perde metade da vida, vira DOIS monstros menores.'],
      gelador:['🧊','GELADOR','Congela as plataformas perto dele: em cima delas você escorrega (demora pra parar). O gelo derrete em 6 s.'],
      rachador:['🪨','RACHADOR','Pula e pisa FORTE: um arco vermelho avisa, e as plataformas perto racham e caem por 4 s. A escada principal aguenta.'],
      sombrio:['🌑','SOMBRIO','Apaga a luz em volta dele: tudo perto fica escuro (só a bordinha das plataformas brilha). Sua explosão ilumina.'],
      piscador:['🌀','PISCA-PISCA','Some e reaparece do seu lado. Um círculo roxo avisa onde ele vai surgir.'],
      boss:['👑','CHEFE GIGANTE','Muita vida. Às vezes deixa as plataformas fantasmas (você cai) e solta gosma que gruda — exploda a gosma. Use seus poderes!'] };
    const novos=Object.keys(MK).filter(k=>kinds[k] && !seen['mk:'+k]); novos.forEach(k=>seen['mk:'+k]=1);
    if(novos.length>2) cards.push({icon:'👹', tag:'MONSTROS NOVOS', big:novos.length+' MONSTROS NOVOS', sub:novos.map(k=>MK[k][0]+' <b>'+MK[k][1]+'</b>: '+MK[k][2]).join('<br>')});   // muitos de uma vez = 1 cartão só
    else novos.forEach(k=>cards.push({icon:MK[k][0], tag:'MONSTRO NOVO', big:MK[k][1], sub:MK[k][2]}));
  }
  if(monsters.some(m=>m.elite||m.kind==='boss') && !seen.elite){ seen.elite=1; cards.push({icon:'👑', tag:'CUIDADO', big:'EXPANSÃO DE DOMÍNIO', sub:'Monstros com coroa 👑 (e os chefes) abrem um DOMÍNIO quando você chega perto: o cenário vira o mundo deles, com uma regra nova, e paredes prendem você na arena por uns segundos. Para quebrar: acerte 3 explosões no dono (4 no chefe), aguente até acabar'+(unlocked('dominio')?', ou abra o SEU domínio ('+K('G','◎')+').':'.')}); }
  if(platforms.some(p=>p.gira) && !seen.gira){ seen.gira=1; cards.push({icon:'📌', tag:'NOVIDADE', big:'PLATAFORMA COM PREGO', sub:'Ela gira em volta do prego do meio. Pise no MEIO e ela fica parada. Pisou na beirada, ela gira quase de pé (90°), te derruba e depois volta sozinha.'}); }
  if(platforms.some(p=>p.fragil) && !seen.fragil){ seen.fragil=1; cards.push({icon:'🪵', tag:'NOVIDADE', big:'PONTE QUE QUEBRA', sub:'As plataformas rachadas aguentam meio segundo com você em cima. Depois caem e só voltam 4 s depois. Não pare nelas!'}); }
  if(platforms.some(p=>p.mv&&(p.mv.mode==='onda'||p.mv.mode==='grupoX'||p.mv.mode==='respira')) && !seen.ondas){ seen.ondas=1; cards.push({icon:'🌊', tag:'NOVIDADE', big:'PLATAFORMAS EM GRUPO', sub:'Um grupo de plataformas se mexe junto: em onda, balançando ou abrindo e fechando. Pule no ritmo.'}); }
  if(ouro && !seen.ouro){ seen.ouro=1; cards.push({icon:'💛', tag:'NOVIDADE', big:'CORAÇÃO DOURADO', sub:'Pegue o coração dourado: a próxima explosão fica MAIOR e acalma todos os apaixonados por perto (eles param de te seguir).'}); }
  if(cfg.type==='love' && level>=3 && !seen.perso){ seen.perso=1; cards.push({icon:'😍', tag:'NOVIDADE', big:'CADA APAIXONADO TEM UM JEITO', sub:'😍 vem direto · 🥺 acelera quando fica longe · 😳 só vem quando você olha pra ele · 😠 não deixa outro chegar antes · 🤪 zigue-zague · 🧐 tenta te cortar o caminho. O símbolo fica em cima da cabeça.'}); }
  if(level>=6 && monsters.length && !seen.espinhosCard){ seen.espinhosCard=1; cards.push({icon:'🌵', tag:'CUIDADO', big:'PLATAFORMA ESCURA', sub:'Onde os monstros pisam muito, a plataforma escurece e nascem espinhos: cair neles mata. Exploda nela pra quebrar. E de tanto amor (3 explosões) uma plataforma vira coração e cai.'}); }
  if(portas.length && !seen.portas){ seen.portas=1; cards.push({icon:'🚪', tag:'NOVIDADE', big:'A PORTINHA VIVA', sub:'Portinhas aparecem em duplas, longe uma da outra. Se você pular perto de uma, ela PULA em você como uma boquinha e te engole! Você sai pela outra portinha e as duas somem.'}); }
  // regras estranhas da sala (explica na 1ª vez)
  const newTags=(M.tags||[]).filter(t=>!seen['tag:'+t]);
  if(newTags.length){ newTags.forEach(t=>seen['tag:'+t]=1);
    cards.push({icon:'🚪', tag:'REGRA NOVA DA SALA', big:M.name, sub:newTags.map(t=>(MUTATORS[t]?MUTATORS[t].icon+' <b>'+t+'</b>: '+MUTATORS[t].txt:t)).join('<br>')}); }
  else if(level>5 && cards.length===1 && !cards[0].tag){ cards[0].tag=M.name; }
  return cards;
}
function showBriefing(n){
  state='briefing';
  const cards=briefingCards(n); let idx=0; saveProgress();
  const render=()=>{ const c=cards[idx], last=idx===cards.length-1;
    showScreen('<div class="brief">'
      +'<div class="briefStep">NÍVEL '+n+(cards.length>1?' · '+(idx+1)+' de '+cards.length:'')+'</div>'
      +(c.tag?'<div class="briefTag">'+c.tag+'</div>':'')
      +'<div class="briefIcon">'+(c.icon||'💖')+'</div>'
      +'<div class="briefBig">'+c.big+'</div>'
      +(c.sub?'<div class="briefSub">'+c.sub+'</div>':'')
      +(c.how?'<div class="briefHow">Como usar: <b>'+c.how+'</b></div>':'')
      +BTN('bnext',last?'JOGAR':'PRÓXIMO','',true)+(cards.length>1&&!last?BTN('bskip','PULAR','ghost'):'')
      +(cards.length>1?'<div class="briefDots">'+cards.map((_,i)=>'<i class="'+(i===idx?'on':'')+'">❤</i>').join('')+'</div>':'')
      +'</div>','brief-screen');
    on('bnext',()=>{ if(last){ hideOverlay(); state='play'; } else { idx++; render(); } }); on('bskip',()=>{ hideOverlay(); state='play'; }); };
  render();
}
let tutorialShown=false;
function showTutorial(go){
  showScreen('<h1>Como jogar</h1>'+
    '<div class="tutGrid">'+
    '<div class="card"><div class="cardIcon">🎯</div><h3>Objetivo</h3><p>Transforme os <b class="blue">tristes</b> em <b class="pink">apaixonados</b> com a sua explosão de amor. Algumas fases são de <b>coleta</b>: pegue corações fujões e leve à <b>Máquina do Amor</b>.</p></div>'+
    (MOBILE?'<div class="card"><div class="cardIcon">📱</div><h3>Controles</h3><p><b>Toque rápido em qualquer lugar = explosão 💥</b> (segure parado pra carregar e solte). <b>Esquerda:</b> arraste ← → pra andar, empurre pra cima pra pular, pra baixo = barreira. <b>Direita:</b> deslize pra cima pra <b>pular</b> (no ar, deslize de novo = duplo). Arrastar nunca explode. Botões ★ ⇄ = poderes.</p></div>'
          :'<div class="card"><div class="cardIcon">⌨️</div><h3>Controles</h3><p><kbd>←</kbd> <kbd>→</kbd> ou <kbd>A</kbd> <kbd>D</kbd> anda · <kbd>↑</kbd>/<kbd>W</kbd> pula (segure pra pular mais alto)<br><kbd>ESPAÇO</kbd> segure e solte = explosão · <kbd>P</kbd> pausa · <kbd>R</kbd> reinicia a fase</p></div>')+
    '<div class="card"><div class="cardIcon">⚡</div><h3>Energia</h3><p>A barra <b>ENERGIA</b> paga a explosão e os poderes e enche sozinha. A barra <b>AMOR</b> mostra a força da explosão enquanto você segura.</p></div>'+
    '<div class="card"><div class="cardIcon">🎁</div><h3>Poderes</h3><p>Você ganha poderes novos conforme avança (pulo duplo, barreira, disparo…). O jogo te explica cada um quando aparecer.</p></div>'+
    '</div>'+BTN('tgo','COMEÇAR','',true),'tut-screen');
  on('tgo',()=>{ tutorialShown=true; go(); });
}
function newGame(m){ mode=m; lives=3; deaths=0; deepest=1; briefedLevels={}; seen={}; runSeed=(Date.now()^(Math.random()*1e9))>>>0; startLevel(1); }
function showMenu(){ state='menu';
  const sv=loadProgress();
  const cont = sv ? BTN('cont','CONTINUAR · nível '+sv.level+' <small>('+(sv.mode==='infinite'?'Infinito':'Aventura')+')</small>','cont',true) : '';
  showScreen(LOGO+'<h1 class="title">Amor <span>Explosivo</span></h1>'+
    '<p class="tagline">Apaixone o mundo inteiro… antes que o mundo derreta.</p>'+
    (cont?'<div class="contWrap">'+cont+'</div>':'')+
    '<div class="modes">'+
      '<button class="mode" id="adv"'+(cont?'':' data-primary="1"')+'><div class="mIcon">❤❤❤</div><div class="mName">Aventura</div><div class="mTxt">3 vidas · cada vida tem corações de HP. Acabou tudo, volta ao nível 1.</div></button>'+
      '<button class="mode alt" id="inf"><div class="mIcon">∞</div><div class="mName">Infinito</div><div class="mTxt">Sem vidas: qualquer toque reinicia a fase na hora. Bata seu recorde.</div></button>'+
    '</div>'+
    '<p class="hint">As 5 primeiras fases são feitas à mão. Da 6 em diante o mundo é gerado e fica cada vez mais estranho.</p>'+
    (cont?'<p><a class="clr" id="clr" href="#">apagar progresso salvo</a></p>':'')+'<p><a class="clr" id="opcEfx" href="#">'+(OPC.reduz?'efeitos reduzidos (tocar pra voltar ao normal)':'reduzir flashes e tremores')+'</a></p>','menu-screen');
  { const ef=document.getElementById('opcEfx'); if(ef) ef.onclick=(e)=>{ if(e&&e.preventDefault) e.preventDefault(); OPC.reduz=!OPC.reduz; salvaOPC(); showMenu(); }; }
  if(sv){ on('cont',()=>{ mode=sv.mode; lives=sv.lives; deepest=sv.deepest; deaths=sv.deaths;   // sv já vem limpo de loadProgress()
    seen=sv.seen; briefedLevels={}; if(sv.seed!=null)runSeed=sv.seed; startLevel(sv.level); });
    const cl=document.getElementById('clr'); if(cl) cl.onclick=(e)=>{ if(e&&e.preventDefault) e.preventDefault(); clearProgress(); showMenu(); }; }
  on('adv',()=>{ const go=()=>newGame('adventure'); tutorialShown?go():showTutorial(go); });
  on('inf',()=>{ const go=()=>newGame('infinite'); tutorialShown?go():showTutorial(go); });
}
function pauseGame(){ if(state!=='play') return; state='pause'; keys.left=keys.right=keys.jump=keys.charge=false; if(player){ player.charging=false; player.charge=0; } joy=null; jumpTouches.clear(); blastTouches.clear();
  showScreen('<div class="pauseIcon">⏸</div><h1>Pausa</h1><p class="hint">'+cfg.label+'</p>'+
    BTN('pres','CONTINUAR','',true)+BTN('pregras','REGRAS DESTA FASE','alt')+BTN('prst','REINICIAR FASE','alt')+BTN('pmenu','MENU','ghost')+BTN('pefx',OPC.reduz?'EFEITOS: REDUZIDOS':'REDUZIR FLASHES E TREMORES','ghost')+
    '<p class="hint">🎚️ Dificuldade ajustada: '+Math.round((IA.dados.ajuste||1)*100)+'%</p>'+
    '<p class="hint">🧠 IA do jogo: nível '+IA.nivel().toFixed(1)+' de 6 · estratégia que mais funciona nos monstros: <b>'+IA.melhor().nome+'</b></p>'+
    (G('resumo')?'<p class="hint">Experiência guardada: '+G('resumo').nos+' nós · '+G('resumo').arestas+' arestas</p>'+BTN('pexp','EXPORTAR EXPERIÊNCIA','ghost'):''),'pause-screen');
  on('pregras',showRegras); on('pefx',()=>{ OPC.reduz=!OPC.reduz; salvaOPC(); state='play'; pauseGame(); });
  on('pres',resumeGame); on('pexp',()=>{ G('salvar'); G('baixar'); }); on('prst',()=>{ startLevel(level); }); on('pmenu',()=>{ saveProgress(); showMenu(); }); }
function resumeGame(){ if(state!=='pause') return; hideOverlay(); state='play'; }

function levelClear(){ if(state!=='play') return; state='end';
  { const d=IA.dados; if(player.hp>=player.maxHp && time<90) d.seq=(d.seq||0)+1; else d.seq=0; if(d.seq>=3){ d.ajuste=Math.min(1.15,(d.ajuste||1)+0.03); d.seq=0; } if(d.mf&&d.mf.lv===level) d.mf=null; }   // dominando: aumenta de leve
  IA.salvar();
  G('fimFase','vitoria',{hp_restante:player.hp,hp_max:player.maxHp});
  beep(660,0.2,'sine',0.07); later(140,()=>beep(990,0.3,'sine',0.06));
  deepest=Math.max(deepest,level+1);
  if(level>=LEVEL_CAP){ clearProgress(); showScreen(LOGO+'<h1>1000 NÍVEIS!</h1><p>Você atravessou toda a distorção e apaixonou o universo inteiro. Lenda! 💖</p>'+BTN('b','RECOMEÇAR','',true),'win-screen');
    on('b',()=>{ lives=3; startLevel(1); }); return; }
  saveProgress(level+1);
  const nxt=level+1, nu=UNLOCKS.find(u=>u.lv===nxt);
  const msg = (cfg.type==='collect' ? 'A Máquina do Amor encheu e fez nascer corações felizes!' : ({saida:'Você chegou à saída!',topo:'Você chegou ao topo!',resgate:'Todo mundo conquistou amor-próprio!'+(explodidos?'':' 🏅 Medalha: ninguém explodiu!')}[cfg.objetivo]||'Você apaixonou todo mundo!'))+
    (cfg.type==='love'?(explodidos?' <br>💔 '+explodidos+' explodi'+(explodidos>1?'ram':'u')+' de amor (o ideal é ninguém).':' <br>✨ Ninguém explodiu de amor. Perfeito!'):'');
  showScreen('<div class="clearHearts" aria-hidden="true">💞</div><h1>Nível '+level+' completo!</h1><p>'+msg+'</p>'+
    (nu?'<p class="tease">No próximo nível: <b>'+nu.icon+' '+nu.name.toLowerCase()+'</b></p>':'')+
    BTN('b','NÍVEL '+nxt,'',true)+BTN('bm','MENU','ghost'),'win-screen');
  on('b',()=>startLevel(nxt)); on('bm',()=>showMenu()); }

function die(){ if(state!=='play') return; state='end';
  { const d=IA.dados; if(!d.mf||d.mf.lv!==level) d.mf={lv:level,n:0}; d.mf.n++; if(d.mf.n>=2){ d.ajuste=Math.max(0.75,(d.ajuste||1)-0.06); d.avisarAjuste=1; } d.seq=0; }   // morrendo muito na mesma fase: alivia um pouco
  IA.salvar(); beep(120,0.4,'sawtooth',0.08);
  G('fimFase','derrota',{fase:level});
  const perigo=G('maiorPerigo'), dica=perigo?'<p class="tease">O que a sua experiência mostra: o que mais te machucou até hoje foi <b>'+perigo.fonte+'</b> ('+perigo.vezes+' vezes).</p>':'';
  if(mode==='adventure'){ lives--;
    if(lives>0){ saveProgress(); showScreen('<div class="broken" aria-hidden="true">💔</div><h1>Seu coração partiu</h1><p>Vidas restantes: '+'❤'.repeat(lives)+'</p>'+dica+
        BTN('b','TENTAR DE NOVO · nível '+level,'',true)+BTN('bm','MENU','ghost'),'lose-screen'); on('b',()=>startLevel(level)); on('bm',()=>showMenu()); }
    else { clearProgress(); showScreen('<div class="broken" aria-hidden="true">💔</div><h1>Fim da jornada</h1><p>Acabaram as 3 vidas. Você chegou ao nível <b>'+level+'</b>.</p>'+dica+
        BTN('b','RECOMEÇAR DO NÍVEL 1','',true)+BTN('bm','MENU','ghost'),'lose-screen'); on('b',()=>{ lives=3; startLevel(1); }); on('bm',()=>showMenu()); } }
  else { startLevel(level); } }

// ===== entrada: teclado =====
function overlayOpen(){ return !overlay.classList.contains('hidden'); }
function setKey(e,down){ const k=(e.key||'').toLowerCase();
  if(down && overlayOpen()){
    if(k==='enter'||k===' '||k==='spacebar'){ e.preventDefault(); if(!e.repeat){ const b=overlay.querySelector('[data-primary]'); if(b) b.click(); } return; }
    if((k==='escape'||k==='p') && state==='pause'){ e.preventDefault(); resumeGame(); return; } }
  if(k==='arrowleft'||k==='a') keys.left=down;
  else if(k==='arrowright'||k==='d') keys.right=down;
  else if(k==='arrowup'||k==='w'){ e.preventDefault&&e.preventDefault(); keys.jump=down; }
  else if(k==='arrowdown'||k==='s'){ e.preventDefault(); if(down&&!e.repeat) placeWall(); }
  else if(k===' '||k==='spacebar'){ e.preventDefault();
    if(down){ if(state==='play'){ keys.charge=true; if(player.stam<player.blastCost && !e.repeat) beep(120,0.08,'square',0.04); } }
    else { if(keys.charge&&state==='play'&&player.charging&&player.stam>=player.blastCost) fireBlast();
           keys.charge=false; if(player){ player.charging=false; player.charge=0; } } }
  else if(e.repeat) return;
  else if(k==='shift'&&down){ e.preventDefault(); dash(); }
  else if(k==='e'&&down){ e.preventDefault(); usePower(); }
  else if(k==='q'&&down){ e.preventDefault(); cyclePower(); }
  else if(k==='f'&&down){ e.preventDefault(); fireDivine(); }
  else if(k==='g'&&down){ e.preventDefault(); usarDominio(); }
  else if(k==='r'&&down){ if(state==='play') startLevel(level); }
  else if((k==='p'||k==='escape')&&down){ if(state==='play'){ e.preventDefault(); pauseGame(); } } }
window.addEventListener('keydown',e=>setKey(e,true));
window.addEventListener('keyup',e=>setKey(e,false));
// trocou de aba / perdeu o foco: solta todas as teclas e pausa (antes o boneco seguia correndo sozinho)
function releaseAll(){ keys.left=keys.right=keys.jump=keys.charge=false; joy=null; jumpTouches.clear(); blastTouches.clear(); if(player){ player.charging=false; player.charge=0; } }
window.addEventListener('blur',()=>{ releaseAll(); pauseGame(); });
try{ document.addEventListener('visibilitychange',()=>{ if(document.hidden){ releaseAll(); pauseGame(); } }); }catch(e){}
function bindTouch(id,onDown,onUp){ const el=document.getElementById(id); if(!el)return;
  const p=e=>{e.preventDefault();e.stopPropagation();onDown();}, r=e=>{e.preventDefault();e.stopPropagation();onUp();};
  el.addEventListener('touchstart',p,{passive:false}); el.addEventListener('touchend',r,{passive:false});
  el.addEventListener('touchcancel',r,{passive:false});
  el.addEventListener('mousedown',p); el.addEventListener('mouseup',r); el.addEventListener('mouseleave',r); }

// ===== entrada: toque (celular) — DOIS DEDOS (v33, regra do doug 18/11) =====
// EXPLOSÃO É UNIVERSAL: um toque rápido em QUALQUER lugar da tela explode (não depende de botão).
//   segurar parado = CARREGA, soltar = explode (maior).
// PULO = DESLIZAR PRA CIMA (o toque nunca é confundido com pulo):
//   dedo da DIREITA: desliza pra cima = pula (manter o dedo = pulo mais alto; no ar, deslizar de novo = duplo/triplo).
//   JOYSTICK (1º dedo da esquerda): arrastar ← → = anda; empurrar pra cima = pula; puxar pra baixo = barreira 🧱.
//   Arrastar NUNCA explode (cancela a carga).
// Botões ★ ⇄ ✨ ◎ » ficam para os PODERES (o 💥 do canto saiu do celular).
let joy=null, jumpQueued=false; const jumpTouches=new Map();   // jumpTouches = dedos que não são o joystick (toque/carga/pulo)
const JOY_R=60, JOY_DZ=12, JOY_DOWN=38, JOY_UP=30;
function onCharge(){ if(state==='play') keys.charge=true; }
function offCharge(){ if(keys.charge&&state==='play'&&player.charging&&player.stam>=player.blastCost) fireBlast();
  keys.charge=false; if(player){ player.charging=false; player.charge=0; } }
// toque rápido (sem carga) também explode — carga mínima pra ter raio
const TAP_CHARGE=0.15, HOLD_MS=170, MOVE_PX=14;
function soltarExplosao(){ if(state==='play'&&player&&player.stam>=player.blastCost){ player.charge=Math.max(player.charge||0,TAP_CHARGE); fireBlast(); }
  keys.charge=false; if(player){ player.charging=false; player.charge=0; } }
function cancelarCarga(){ keys.charge=false; if(player){ player.charging=false; player.charge=0; } }
var blastTouches=new Set();   // (compatibilidade) limpo no pause
function algumCarregando(){ if(joy&&joy.modo==='carga') return true; for(const g of jumpTouches.values()) if(g.modo==='carga') return true; return false; }
function algumSegurandoPulo(){ if(joy&&joy.upArm) return true; for(const g of jumpTouches.values()) if(g.modo==='pulo') return true; return false; }
function pular(){ jumpQueued=true; keys.jump=true; }
function soltouPulo(){ keys.jump=algumSegurandoPulo(); }
function largouCarga(){ if(!algumCarregando()) cancelarCarga(); }
bindTouch('bCharge', onCharge, offCharge);
bindTouch('bPow', ()=>usePower(), ()=>{});
bindTouch('bCyc', ()=>cyclePower(), ()=>{});
bindTouch('bDiv', ()=>fireDivine(), ()=>{});
bindTouch('bDom', ()=>usarDominio(), ()=>{});
bindTouch('bDash', ()=>dash(), ()=>{});
bindTouch('bPause', ()=>{ if(state==='play') pauseGame(); else if(state==='pause') resumeGame(); }, ()=>{});

if(MOBILE){
  const wrap=document.getElementById('wrap');
  const onUI=t=>!!(t.target&&t.target.closest&&(t.target.closest('#touch')||t.target.closest('#overlay')||t.target.closest('button')));
  const esquerda=t=>t.clientX < (window.innerWidth||SCRW||800)*0.5;
  // qualquer dedo começa "em espera": se soltar rápido = explode; se ficar parado = carrega
  const armarCarga=(g)=>setTimeout(()=>{ if(g.modo==='espera'&&state==='play'&&(g===joy||jumpTouches.get(g.id)===g)){ g.modo='carga'; keys.charge=true; } }, HOLD_MS);
  wrap.addEventListener('touchstart',e=>{
    if(state!=='play') return;
    let used=false;
    for(const t of e.changedTouches){ if(onUI(t)) continue; used=true;
      const g={id:t.identifier, ox:t.clientX, oy:t.clientY, x:t.clientX, y:t.clientY, modo:'espera', dnArm:false, upArm:false};
      if(esquerda(t)&&!joy) joy=g; else jumpTouches.set(t.identifier,g);
      armarCarga(g); }
    if(used) e.preventDefault();
  },{passive:false});
  wrap.addEventListener('touchmove',e=>{
    if(state!=='play') return;
    let used=false;
    for(const t of e.changedTouches){
      if(joy && t.identifier===joy.id){ used=true;
        let dx=t.clientX-joy.ox, dy=t.clientY-joy.oy; const m=Math.hypot(dx,dy);
        if(joy.modo!=='anda'){ if(m<MOVE_PX) continue; const eraCarga=joy.modo==='carga'; joy.modo='anda'; if(eraCarga) largouCarga(); }   // arrastou: anda, não explode
        if(m>JOY_R){ dx*=JOY_R/m; dy*=JOY_R/m; }
        joy.x=joy.ox+dx; joy.y=joy.oy+dy;
        keys.left=dx<-JOY_DZ; keys.right=dx>JOY_DZ;
        if(dy> JOY_DOWN && Math.abs(dx)<JOY_DOWN){ if(!joy.dnArm){ placeWall(); joy.dnArm=true; } } else if(dy< JOY_DOWN*0.5){ joy.dnArm=false; }
        if(dy< -JOY_UP){ if(!joy.upArm){ joy.upArm=true; pular(); } } else if(dy> -JOY_UP*0.5 && joy.upArm){ joy.upArm=false; soltouPulo(); }   // joystick pra cima = pulo
      } else if(jumpTouches.has(t.identifier)){ used=true; const g=jumpTouches.get(t.identifier);
        const DX=t.clientX-g.ox, DY=t.clientY-g.oy;
        if(g.modo==='espera'||g.modo==='carga'){
          if(Math.hypot(DX,DY)>=MOVE_PX){ const eraCarga=g.modo==='carga';
            if(DY<0 && -DY>=Math.abs(DX)*0.7){ g.modo='pulo'; pular(); } else g.modo='nada';   // deslizou pra cima = pula; outro arrasto = nada
            if(eraCarga) largouCarga(); g.oy=t.clientY; } }
        else if(g.modo==='pulo'){ if(t.clientY-g.oy>MOVE_PX*1.5){ g.modo='nada'; g.oy=t.clientY; soltouPulo(); } else g.oy=Math.min(g.oy,t.clientY); }   // desceu o dedo: solta o pulo
        else if(g.modo==='nada'){ if(g.oy-t.clientY>=MOVE_PX){ g.modo='pulo'; pular(); g.oy=t.clientY; } else g.oy=Math.max(g.oy,t.clientY); }   // subiu de novo (duplo/triplo sem tirar o dedo)
        g.x=t.clientX; g.y=t.clientY; }
    }
    if(used) e.preventDefault();
  },{passive:false});
  const endTouch=e=>{ const fim=e.type==='touchend'&&state==='play';
    for(const t of e.changedTouches){
      let g=null;
      if(joy && t.identifier===joy.id){ g=joy; joy=null; keys.left=keys.right=false; }
      else if(jumpTouches.has(t.identifier)){ g=jumpTouches.get(t.identifier); jumpTouches.delete(t.identifier); }
      if(!g) continue;
      if(g.modo==='espera'||g.modo==='carga'){ if(fim) soltarExplosao(); else largouCarga(); }   // toque/segurar sem arrastar = EXPLODE
      soltouPulo(); } };
  wrap.addEventListener('touchend',endTouch,{passive:false});
  wrap.addEventListener('touchcancel',endTouch,{passive:false});
}

// ===== HOOK DE DESENVOLVEDOR (só liga com window.__DEV=true; não afeta o jogo normal) =====
if(globalThis.__DEV){
  globalThis.AE_DEV={
    go(n){ n=clamp(n|0,1,LEVEL_CAP); startLevel(n); return this.info(); },
    next(){ return this.go(level+1); },
    prev(){ return this.go(level-1); },
    reseed(s){ runSeed=(s>>>0)||((Date.now()^(Math.random()*1e9))>>>0); return this.go(level); },
    randSeed(){ return this.reseed((Date.now()^(Math.random()*1e9))>>>0); },
    // monta uma cena pra conferir as mecânicas novas sem precisar jogar (só no dev.html)
    cena(nome){ let pl=player;
      if(nome==='prego'){ for(let L=4;L<40;L++){ startLevel(L); pl=player; const p=platforms.find(q=>q.gira); if(p){ pl.x=p.x+p.w*0.92-pl.w/2; pl.y=p.y-pl.h; pl.vy=0; pl.onGround=true; pl.platRef=p;
          for(let i=0;i<26;i++){ camPX=camX; camPY=camY; pl.px=pl.x; pl.py=pl.y; update(STEP); } camX=clamp(pl.x-W/2,0,Math.max(0,WORLD_W-W)); camY=clamp(pl.y-H*0.55,0,Math.max(0,WORLD_H-H)); camPX=camX; camPY=camY; return this.info(); } } }
      if(nome==='porta'){ for(let L=9;L<120;L++){ startLevel(L); pl=player; if(portas.length){ const d=portas[0]; pl.x=d.hx-110; pl.y=d.hy-pl.h-70; pl.vx=3; pl.vy=-7; pl.onGround=false; pl.platRef=null; pl.face=1;
          for(let i=0;i<14;i++){ camPX=camX; camPY=camY; pl.px=pl.x; pl.py=pl.y; update(STEP); } camX=clamp(pl.x-W/2,0,Math.max(0,WORLD_W-W)); camY=clamp(pl.y-H*0.5,0,Math.max(0,WORLD_H-H)); camPX=camX; camPY=camY; return this.info(); } } }
      if(nome==='monstros'){ startLevel(12); pl=player; for(const n of npcs.slice()) makeHappy(n,'cena'); return this.info(); }
      if(nome==='explode'){ startLevel(3); pl=player; const near=npcs.slice(0,3); for(const n of near){ n.x=pl.x+80+Math.random()*200; n.y=groundY-n.h; makeHappy(n,'cena'); n.grace=0; n.state='frozen'; n.freezeT=2.2; } npcs[0].freezeT=0.01; for(let i=0;i<3;i++) update(STEP); return this.info(); }
      if(nome==='incha'){ startLevel(5); pl=player; let k=0; for(const n of npcs.slice(0,4)){ n.x=pl.x+100+k*120; n.y=groundY-n.h; k++; makeHappy(n,'cena'); if(!n.inchou){ const ow=n.w,oh=n.h; n.w*=2; n.h*=2; n.y-=(n.h-oh); n.inchou=true; } } return this.info(); }
      if(nome==='arquiteto'){ for(let L=17;L<80;L++){ startLevel(L); pl=player; const mo=monsters.find(m=>m.kind==='arquiteto'); if(mo){ pl.x=clamp(mo.x-260,0,WORLD_W-pl.w); pl.y=mo.y+mo.h-pl.h; pl.face=1; mo.moveCD=0.01;
          for(let i=0;i<40;i++){ pl.invuln=3; camPX=camX; camPY=camY; pl.px=pl.x; pl.py=pl.y; update(STEP); if(mo.beam) break; } camX=clamp(mo.x-W*0.45,0,Math.max(0,WORLD_W-W)); camY=clamp(mo.y-H*0.5,0,Math.max(0,WORLD_H-H)); camPX=camX; camPY=camY; return this.info(); } } }
      const foca=(x,y)=>{ camX=clamp(x-W/2,0,Math.max(0,WORLD_W-W)); camY=clamp(y-H*0.55,0,Math.max(0,WORLD_H-H)); camPX=camX; camPY=camY; pl.px=pl.x; pl.py=pl.y; };
      if(nome==='espinhos'){ startLevel(12); pl=player; const ps=platforms.filter(q=>!q.spine&&!q.mv&&!q.gira&&q.band>1&&Math.abs(q.x-pl.x)<900).slice(0,3); ps[0].espinhos=true; ps[0].sujo=8; if(ps[1]){ ps[1].sujo=5.6; } if(ps[2]) ps[2].rosa=2; foca(ps[0].x,ps[0].y); pl.x=ps[0].x-200; pl.y=groundY-pl.h; return this.info(); }
      if(nome==='coracao'){ startLevel(6); pl=player; const p=platforms.find(q=>!q.spine&&!q.mv&&!q.gira&&!q.temPorta&&q.band>1&&q.x>300); p.coracao={t:2}; const p2=platforms.find(q=>q!==p&&!q.spine&&Math.abs(q.y-p.y)<80&&Math.abs(q.x-p.x)<500); if(p2) p2.rosa=2; foca(p.x,p.y); return this.info(); }
      if(nome==='grupo'){ for(let L=6;L<80;L++){ startLevel(L); pl=player; const g=platforms.filter(q=>q.mv&&q.mv.A); if(g.length>4 && g[0].mv.mode==='onda'){ for(let i=0;i<40;i++) update(STEP); foca(g[0].bx,g[0].by); return this.info(); } } }
      if(nome==='perso'){ startLevel(9); pl=player; let k=0; for(const n of npcs.slice(0,6)){ n.x=pl.x+90+k*90; n.y=groundY-n.h; makeHappy(n,'cena'); n.perso=['carente','timido','ciumento','impulsivo','calculista','romantico'][k]; n.grace=2; k++; } foca(pl.x+300,pl.y); return this.info(); }
      if(nome==='tristonho'){ for(let L=14;L<60;L++){ startLevel(L); pl=player; const tr=monsters.find(m=>m.kind==='tristonho'); if(tr){ tr.ringT=0.4; pl.x=clamp(tr.x-260,0,WORLD_W-pl.w); pl.y=tr.y+tr.h-pl.h; pl.invuln=3; foca(tr.x,tr.y); return this.info(); } } }
      return null; },
    dominio(tipo,L){ startLevel(L||40); let pl=player;
      if(tipo==='amor'){ pl.stam=MAX_STAM; usarDominio(); for(let i=0;i<20;i++) update(STEP); return Object.assign(this.info(),{dominio:dominio&&dominio.tipo}); }
      const kind={coracaoNegro:'boss',tristeza:'tristonho',labirinto:'arquiteto',sombras:'sombrio',gelo:'gelador',furia:'chaser'}[tipo]||'chaser';
      let mo=monsters.find(m=>m.kind===kind); if(!mo){ mo=mkMonster(0,0,kind); monsters.push(mo); }
      mo.elite=kind!=='boss'; mo.x=clamp(pl.x+420,0,WORLD_W-mo.w); mo.y=groundY-mo.h; mo.onGround=true;
      pl.invuln=99; abrirDominio('monstro',mo); for(let i=0;i<30;i++){ pl.invuln=99; update(STEP); }
      camX=clamp(pl.x+200-W/2,0,Math.max(0,WORLD_W-W)); camY=clamp(pl.y-H*0.55,0,Math.max(0,WORLD_H-H)); camPX=camX; camPY=camY; pl.px=pl.x; pl.py=pl.y;
      return Object.assign(this.info(),{dominio:dominio&&dominio.tipo}); },
    poder(id,L){ startLevel(L||30); const pl=player; if(pl.powers.indexOf(id)<0) pl.powers.push(id); pl.equip=pl.powers.indexOf(id); pl.stam=MAX_STAM; pl.invuln=99; usePower();
      for(let i=0;i<12;i++){ pl.invuln=99; update(STEP); } return this.info(); },
    especial(id,nv,L){ FORCA={tipo:'especial',id,vez:nv||1}; startLevel(L||Math.max(ESPECIAIS[id].min,13)); FORCA=null; return this.info(); },
    bonus(v,L){ FORCA={tipo:'bonus',var:v,idx:4}; startLevel(L||20); FORCA=null; return this.info(); },
    plano(a,b){ const r=[]; for(let n=a;n<=b;n++){ const p=planoFases(n); r.push(n+':'+(p.tipo==='especial'?'E/'+p.id+p.vez:(p.tipo==='bonus'?'B/'+p.var:'n'))); } return r.join(' '); },
    parede(){ return dominio?{x0:dominio.x0,x1:dominio.x1,prende:dominio.prende}:null; },
    jogador(){ return {x:player.x,y:player.y,vx:player.vx,vy:player.vy,onGround:player.onGround,jumps:player.jumps,stam:player.stam,shots:loveShots.length}; },
    reachOK(){ const ps=platforms, r=computeReachable(); const top=groundY-(groundY-110)*0.75;
      let tt=0,tr=0; ps.forEach((p,i)=>{ if(p.band===99)return; if(p.y<=top){tt++; if(r[i])tr++;} });
      return tt===0?true:tr>0; },
    scan(a,b){ a=a|0||1; b=b|0||100; const fails=[]; const cur=level;
      for(let n=a;n<=b;n++){ startLevel(n); if(!this.reachOK()) fails.push(n); }
      startLevel(cur); return {checked:(b-a+1), fails}; },
    info(){ return { level, label:(cfg&&cfg.label)||'', type:cfg&&cfg.type, plats:platforms.length,
      npcs:npcs.length, monsters:monsters.length, W:WORLD_W, H:WORLD_H, seed:runSeed,
      tags:(M&&M.tags)||[], style:M&&M.style, target:cfg&&cfg.target, collectIndex:cfg&&cfg.collectIndex,
      monstersKinds:monsters.map(m=>m.kind), quality:Q.tier, portas:portas.length, gira:platforms.filter(p=>p.gira).length, fragil:platforms.filter(p=>p.fragil).length, grupo:platforms.filter(p=>p.mv&&p.mv.A).length, ouro:!!ouro, ia:IA.nivel(), objetivo:cfg&&cfg.objetivo, especial:cfg&&cfg.especial&&cfg.especial.id, bonusVar:cfg&&cfg.bonusVar, elites:monsters.filter(m=>m.elite).length, dominioAtivo:dominio?dominio.tipo:null }; }
  };
}

// ===== [MOTORES] laço principal: simulação em PASSO FIXO + desenho interpolado =====
let last=performance.now(), acc=0, idleFrames=0;
function loop(now){
  let dt=(now-last)/1000; last=now; if(!(dt>=0)) dt=0;
  beepsThisFrame=0;
  const t0=performance.now();
  if(state==='play'){
    acc+=Math.min(dt,0.25); let steps=0;
    while(acc>=STEP && steps<5){
      camPX=camX; camPY=camY; player.px=player.x; player.py=player.y;
      update(STEP); acc-=STEP; steps++;
      if(state!=='play') break;
    }
    if(steps>=5) acc=0;                         // aparelho muito lento: não entra em espiral
    if(player) draw(clamp(acc/STEP,0,1));
    qualityTick(dt*1000, performance.now()-t0);
    idleFrames=0;
  } else {
    acc=0;
    // menu/briefing/pausa: desenha só de vez em quando (economiza bateria em aparelho fraco)
    if(player && (drawDirty || (++idleFrames%20===0))){ drawDirty=false; camPX=camX; camPY=camY; player.px=player.x; player.py=player.y; draw(1); }
  }
  requestAnimationFrame(loop); }
resize(true); buildLevel(1); state='menu'; showMenu(); requestAnimationFrame(loop);
})();
