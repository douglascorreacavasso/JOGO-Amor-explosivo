(() => {
"use strict";
const MOBILE = !!(typeof document!=='undefined' && document.body && document.body.dataset && document.body.dataset.platform==='mobile');
const SAVE_KEY='amorExplosivo_save_v2';
function saveProgress(){ try{ if(typeof localStorage==='undefined')return;
  localStorage.setItem(SAVE_KEY, JSON.stringify({mode,level,lives,deepest,deaths,seed:runSeed,ts:Date.now()})); }catch(e){} }
function loadProgress(){ try{ if(typeof localStorage==='undefined')return null;
  const s=localStorage.getItem(SAVE_KEY); return s?JSON.parse(s):null; }catch(e){return null;} }
function clearProgress(){ try{ if(typeof localStorage!=='undefined') localStorage.removeItem(SAVE_KEY); }catch(e){} }
const cv=document.getElementById('game'), ctx=cv.getContext('2d');
let W=0,H=0,DPR=1;

const GROUND_H=90, GRAV=0.62, BASE_JUMP=-14.6;
const MOVE=1.7, FRICTION=0.74, COYOTE=0.12, JUMP_BUF=0.12;
const BAND_H=70, SLOT=248;
const MAX_STAM=100, WALL_COST=50, WALL_LIFE=60, FREEZE_TIME=3, BLOCK_TIME=3;
const CONV_SPEED=0.10, CONV_SPEED_CAP=1.0, CONV_JUMP=0.06, CONV_JUMP_CAP=0.6;
const LEVEL_CAP=1000;
const HEART_COLORS=['#ff2e63','#ff8fab','#ffd166','#06d6a0','#4cc9f0','#b5179e','#f72585','#ff7b00'];

// física viva (distorcível por nível)
let phGrav=GRAV, phMove=MOVE, phFric=FRICTION, phBandH=BAND_H, phSlot=SLOT, phBaseJump=BASE_JUMP, JUMP_Hc=140;

// ===== 5 níveis feitos à mão =====
const HAND=[
 {type:'love',   w:1500, h:1900, moving:0,  mvSpeed:0,   npc:10, follow:2.0, blocks:3},
 {type:'collect',w:1500, h:2000, moving:2,  mvSpeed:0.8, target:100, blocks:0},
 {type:'love',   w:1700, h:2400, moving:4,  mvSpeed:1.0, npc:14, follow:2.4, blocks:4},
 {type:'love',   w:1850, h:2900, moving:7,  mvSpeed:1.2, npc:18, follow:2.7, blocks:5},
 {type:'love',   w:2000, h:3500, moving:11, mvSpeed:1.5, npc:22, follow:3.0, blocks:6},
];
function hsl(h,s,l){ return 'hsl('+((h%360)+360)%360+','+s+'%,'+l+'%)'; }
function palFromHue(hue){ return {
  skyTop:hsl(hue,55,7), skyMid:hsl(hue+24,50,20), skyLow:hsl(hue+50,48,34), skyGround:hsl(hue+70,45,46),
  glow:'rgba(255,150,180,.30)', amb:hsl(hue+40,70,70),
  groundTop:hsl(hue+20,38,38), groundBot:hsl(hue+10,40,18), groundLine:hsl(hue+50,80,72),
  plat:hsl(hue,30,38), platTop:hsl(hue+30,55,72), platMv:hsl(hue+20,42,44) }; }

// ===== MOTOR: gera o DNA de cada nível (1-5 à mão, 6+ distorcido — muda A CADA nível) =====
function genLevel(n){
  if(n<=5){ const b=HAND[n-1];
    return Object.assign({}, b, {
      grav:GRAV, move:MOVE, fric:FRICTION, bandH:BAND_H, slot:SLOT, baseJump:BASE_JUMP,
      playerSpeed:5.6+(n-1)*0.12, playerJump:BASE_JUMP-(n-1)*0.4, maxJumps:(n>=5?3:(n>=3?2:1)),
      maxHp:3, blastCost:Math.max(14,22-(n-1)*2), stamRegen:14+(n-1)*2,
      chaserCount:0, shooterCount:0, eaterCount:0, dogCount:0, sphereCount:0, bossCount:0, spikerCount:0, beamerCount:0, tentacleCount:0, monsterHp:1, monsterScale:1, monsterSpeed:0, shooterRate:2, archCount:0, hue:null, vignette:0,
      label:n+'/5 — '+(b.type==='collect'?'Coleta: pegue 100 corações (eles fogem!) e leve à Pedra 🪨.':'Apaixone todos subindo pela tela cheia de plataformas.') });
  }
  const d=n-5;                                  // profundidade procedural (1..)
  const dd=Math.min(d,900);
  const isCollect=(d%9===0);
  const playerSpeed=6.1+Math.min(dd*0.03,2.6);     // começa no nível 5 e cresce
  const playerJump=-16.2*(1+Math.min(dd*0.006,0.4));
  const cfg={
    type: isCollect?'collect':'love',
    w: Math.min(2000+dd*8, 2600),
    h: Math.min(3500+dd*40, 6000),
    grav: clamp(0.62*(1+0.18*Math.sin(d*0.9)+Math.min(d*0.004,0.18)), 0.5, 0.86), // oscila a cada nível
    move: MOVE, fric: FRICTION,
    bandH: clamp(70-Math.floor(dd/50)+Math.round(Math.min(dd*0.5,5)*Math.sin(d*1.3)), 58, 74),
    slot: clamp(248+Math.round(16*Math.sin(d*0.7)), 218, 274),
    baseJump: playerJump,
    playerSpeed, playerJump,
    maxJumps: 3,
    maxHp: Math.min(3+Math.floor(dd/10), 10),         // pontos de vida crescem
    blastCost: Math.max(10, 18-Math.floor(dd/40)),
    stamRegen: 16+Math.min(Math.floor(dd/10),12),
    moving: Math.min(11+Math.floor(dd*0.4), 18),
    mvSpeed: Math.min(1.5+dd*0.02, 2.8),
    blocks: Math.min(6+Math.floor(dd/5), 12),
    follow: 0, npc:0, target:0,
    chaserCount:0, shooterCount:0, eaterCount:0, dogCount:0, sphereCount:0, bossCount:0, spikerCount:0, beamerCount:0, tentacleCount:0,
    monsterHp:Math.min(1+Math.floor(dd/14), 6),
    monsterScale:1.25+Math.min(dd*0.022, 1.7),        // MONSTROS MAIORES
    monsterSpeed:Math.min(2.1+dd*0.035, playerSpeed*0.66),
    shooterRate:clamp(2.0-dd*0.014, 0.22, 2.0),        // fundo = METRALHADORA
    archCount:Math.min(1+Math.floor(dd*0.7), 22),      // arquitetura nova A CADA nível
    hue:(n*47)%360, vignette:Math.min(dd*0.01,0.5),
  };
  if(isCollect){ cfg.target=Math.min(80+dd, 220); }
  else { cfg.npc=Math.min(22+Math.floor(dd*0.6), 36);
    cfg.follow=Math.min(3.0+dd*0.04, playerSpeed*0.7);
    if(d>=1)  cfg.chaserCount  = Math.min(1+Math.floor(d/3), 8);        // monstros desde o 1º nível gerado
    if(d>=4)  cfg.shooterCount = Math.min(1+Math.floor((d-4)/6), 5);
    if(d>=10) cfg.eaterCount   = Math.min(1+Math.floor((d-10)/9), 3);
    if(d>=7)  cfg.dogCount     = Math.min(1+Math.floor((d-7)/7), 4);    // cão sombrio (morde, tira agilidade)
    if(d>=13) cfg.sphereCount  = Math.min(1+Math.floor((d-13)/8), 3);   // esfera chorona (agarra/prende)
    if(d>=19) cfg.spikerCount  = Math.min(1+Math.floor((d-19)/10), 2);  // espinhos
    if(d>=22) cfg.beamerCount  = Math.min(1+Math.floor((d-22)/10), 2);  // feixe vertical
    if(d>=16) cfg.tentacleCount= Math.min(1+Math.floor((d-16)/12), 2);  // tentáculos
    if(n>=20 && n%20===0) cfg.bossCount = 1;                            // CHEFE gigante (a cada 20 níveis)
  }
  const mut=director(n);                                                 // MINI-AI: muda as regras deste nível
  cfg.mut=mut; cfg.hue=mut.hue;
  cfg.vignette=clamp(cfg.vignette + (mut.tags.indexOf('névoa')>=0?0.22:0) + mut.distort*0.12, 0, 0.7);
  cfg.grav=clamp(cfg.grav*mut.gravMul, 0.42, 1.05);
  cfg.baseJump=cfg.playerJump=playerJump*Math.sqrt(mut.gravMul);         // compensa o pulo p/ manter alcance (vencível)
  cfg.label='NÍVEL '+n+' · '+mut.name+(isCollect?' · coleta':'')+(mut.tags.length?' ['+mut.tags.join(' · ')+']':'');
  return cfg;
}
// ===== DIRETOR (mini-AI): escolhe TEMA + muda as REGRAS por nível (Backrooms + No Man's Sky) =====
const DIR_THEMES=[
  {name:'SALA AMARELA',hue:48},{name:'ESCRITÓRIO',hue:38},{name:'PISCINA INFINITA',hue:190},
  {name:'GARAGEM',hue:215},{name:'BIBLIOTECA',hue:28},{name:'HOTEL INFINITO',hue:18},
  {name:'JARDIM',hue:120},{name:'QUADRA',hue:32},{name:'CAPELA',hue:52},{name:'LAVANDERIA',hue:200},
  {name:'CORREDOR',hue:60},{name:'PORÃO',hue:280}
];
function director(n){
  const rng=makeRng((seedFor(n)^0x5bd1e995)>>>0); const d=Math.max(0,n-5);
  const epoch=Math.floor(d/15);                                          // a cada 15 níveis a ordem distorce mais (No Man's Sky)
  const theme=DIR_THEMES[(n*7 + epoch*5 + Math.floor(rng()*(1+epoch)))%DIR_THEMES.length];
  const distort=clamp(d/45,0,1);                                         // "lembrado errado" cresce com a profundidade
  const mut={ name:theme.name, hue:theme.hue, distort, jitter:0, warp:0, gravMul:1, densityMul:1, gaps:0, tags:[] };
  if(rng()<0.42){ mut.gravMul=0.78+rng()*0.5; mut.tags.push(mut.gravMul<1?'gravidade leve':'gravidade pesada'); }
  if(rng()<0.62){ mut.densityMul=0.82+rng()*0.34; mut.tags.push(mut.densityMul<0.97?'vazio':'normal'); }
  mut.jitter=distort*(0.4+rng()*0.6);                                    // tremor de posição das plataformas
  mut.warp=distort*(0.4+rng()*0.6);                                      // variação de tamanho
  if(d>=18 && rng()<0.5){ mut.gaps=distort*0.22; mut.tags.push('buracos'); }   // plataformas faltando (lembrado errado)
  if(rng()<0.32) mut.tags.push('névoa');
  return mut;
}

let level=1, explodedCount=0, totalSad0=0;
let mode='adventure', lives=3, deaths=0, deepest=1;
let WORLD_W=0, WORLD_H=0, groundY=0, cfg=null, PAL=null, VIGN=0;
let player, npcs, monsters, shots, loveShots, waves, lasers, loveRain, divineFx, elecRays, beams, spikesW, stickies, platforms, blasts, particles, ambient, stars, walls, fhearts, pHearts, blocks, rock, carrying;
let _divShown=false, phantomT=0;
let introT=0, introText='', introSub='';
let camX, camY, shake, state, time, rainTimer, pendingReset=false;
let runSeed=(Date.now()^(Math.random()*1e9))>>>0;   // semente da run (salva no save)
let RNG=Math.random;                                  // trocado por uma versão semeada durante a geração
const keys={left:false,right:false,jump:false,charge:false};

function makeRng(seed){ let a=seed>>>0; return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function seedFor(n){ let h=(runSeed^Math.imul(n,2654435761))>>>0; h=Math.imul(h^(h>>>15),2246822507); h=Math.imul(h^(h>>>13),3266489909); return (h^(h>>>16))>>>0; }
const rand=(a,b)=>a+RNG()*(b-a);
function clamp(v,a,b){return v<a?a:(v>b?b:v);}
const dist=(ax,ay,bx,by)=>Math.hypot(ax-bx,ay-by);
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(RNG()*(i+1)); const t=a[i];a[i]=a[j];a[j]=t; } return a; }
function heartPath(c,x,y,s){const t=s*0.3;c.beginPath();c.moveTo(x,y+t);
  c.bezierCurveTo(x,y,x-s/2,y,x-s/2,y+t);c.bezierCurveTo(x-s/2,y+(s+t)/2,x,y+(s+t)/1.35,x,y+s);
  c.bezierCurveTo(x,y+(s+t)/1.35,x+s/2,y+(s+t)/2,x+s/2,y+t);c.bezierCurveTo(x+s/2,y,x,y,x,y+t);c.closePath();}
function roundRect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);
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
  const ps=platforms, reach=new Array(ps.length).fill(false);
  const VRE=JUMP_Hc+8, HRE=64;
  for(let i=0;i<ps.length;i++) if(ps[i].band===0) reach[i]=true;
  let ch=true;
  while(ch){ ch=false;
    for(let i=0;i<ps.length;i++){ if(reach[i])continue; const p=ps[i];
      for(let j=0;j<ps.length;j++){ if(!reach[j])continue; const q=ps[j]; const v=q.y-p.y;
        if(v>0&&v<=VRE){ const eg=(p.x<q.x+q.w&&p.x+p.w>q.x)?0:(p.x>q.x?p.x-(q.x+q.w):q.x-(p.x+p.w));
          if(eg<=HRE){ reach[i]=true; ch=true; break; } } } } }
  return reach;
}

let actx=null;
function beep(f,d,t,v){try{ if(!actx)actx=new (window.AudioContext||window.webkitAudioContext)();
  const o=actx.createOscillator(),g=actx.createGain(); o.type=t||'sine'; o.frequency.value=f; g.gain.value=v||0.06;
  o.connect(g);g.connect(actx.destination);o.start();
  g.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+(d||0.15));o.stop(actx.currentTime+(d||0.15));}catch(e){}}

function resize(){ DPR=Math.min(window.devicePixelRatio||1,2); W=cv.clientWidth; H=cv.clientHeight;
  cv.width=Math.floor(W*DPR); cv.height=Math.floor(H*DPR); ctx.setTransform(DPR,0,0,DPR,0,0); }
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', ()=>{ setTimeout(resize,250); });
try{ if(window.visualViewport) window.visualViewport.addEventListener('resize', resize); }catch(e){}

function sadDeform(){
  const d=Math.max(0,level-5);
  if(level<=5 || RNG()>clamp(d*0.05,0,0.9)) return {shape:'normal',scale:1,legs:false,fast:false,bug:false};
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
function mkHappy(x,y,vx,vy,grace){ return { x,y, vx:vx||0, vy:vy||0, w:28, h:42, onGround:false, platRef:null,
  state:'happy', grace:grace==null?0.9:grace, bob:rand(0,6.28), stuck:false, heartTrail:0, dir:1, wander:rand(40,160), freezeT:0, shake:0, holding:false }; }
function mkMonster(x,y,kind){ kind=kind||'chaser';
  let sc=cfg.monsterScale*(kind==='eater'?1.2:(kind==='shooter'?1.05:1));
  if(kind==='dog') sc*=0.8; if(kind==='sphere') sc*=1.0; if(kind==='boss') sc*=8;
  let hp=cfg.monsterHp; if(kind==='boss') hp=cfg.monsterHp*12; if(kind==='sphere') hp=cfg.monsterHp+1; if(kind==='tentacle') hp=cfg.monsterHp+1;
  let sp=cfg.monsterSpeed*(kind==='shooter'?0.45:1); if(kind==='dog') sp=cfg.monsterSpeed*1.7; if(kind==='boss') sp=cfg.monsterSpeed*0.5; if(kind==='sphere') sp=cfg.monsterSpeed*0.45; if(kind==='spiker') sp=cfg.monsterSpeed*0.4; if(kind==='beamer') sp=cfg.monsterSpeed*0.32; if(kind==='tentacle') sp=0;
  let w=30*sc, h=42*sc; if(kind==='tentacle'){ w=44*cfg.monsterScale; h=130*cfg.monsterScale; }
  if(kind!=='boss'&&kind!=='tentacle'){ const sv=0.82+RNG()*0.55; w*=sv; h*=sv; }   // tamanhos variados
  const dd2=Math.max(0,level-5);
  return { x,y, w, h, vx:0, vy:0, onGround:false, platRef:null, kind,
  hp, maxHp:hp, sp, hitT:0, float:(kind==='sphere'), grabCD:rand(0.5,1.6),
  arms:Math.min(2+Math.floor(dd2/15),5), sway:rand(0,6.28),
  fireT:rand(0.4,cfg.shooterRate||2), beamCD:rand(2.5,4.5), spikeCD:rand(2.5,4), stickyCD:rand(3,6), phantomCD:rand(7,11),
  bob:rand(0,6.28), eye:rand(0,6.28), grow:0, seed:(RNG()*1e9)|0, twin:(kind!=='boss'&&kind!=='tentacle'&&RNG()<0.12) }; }
function heartKind(){ if(cfg.type!=='collect') return 'normal';
  const d=Math.max(0,level-5), exotic=clamp((d-9)/60,0,0.82);
  if(RNG()>exotic) return 'normal';
  const r=RNG();
  if(r<0.16) return 'fast';
  if(r<0.32) return 'ghost';
  if(r<0.47) return 'tough';
  if(r<0.60) return 'crybaby';
  if(r<0.72) return 'solid';
  if(r<0.84) return 'snake';
  if(r<0.94) return 'splitter';
  return 'eater'; }
function spawnHeart(x,y,falling,forceType){ const big=(cfg.type==='collect'); const s=big?rand(34,82):rand(16,24);
  const type=forceType||heartKind();
  const hsx=big&&RNG()<0.4?0.72+RNG()*0.7:1, hsy=big&&RNG()<0.4?0.72+RNG()*0.7:1;   // deformação (achatado/esticado)
  const h={ x,y, w:s*0.95,h:s*0.95, vx:0, vy: falling?rand(1.2,2.4):0, s, hsx, hsy,
  col:HEART_COLORS[Math.floor(rand(0,HEART_COLORS.length))], sw:rand(0,6.28), rest:!falling, big,
  type, hp:(type==='tough'?2:1), fleeT:0, wob:rand(0,6.28), hat:(Math.floor(rand(0,3))),
  outfit:(big?Math.floor(rand(0,6)):-1), wT:rand(0.3,1.4), wdir:(RNG()<.5?-1:1),
  seed:(RNG()*1e9)|0, vshape:(big&&RNG()<0.5)?['ghost','star','diamond','blob','gem'][Math.floor(RNG()*5)]:'heart', vtwin:(big&&RNG()<0.12) }; fhearts.push(h); return h; }
function spawnHeartScattered(forceType){                                  // aparece em QUALQUER lugar, em alturas diferentes
  let x,y;
  if(platforms.length && RNG()<0.7){ const p=platforms[Math.floor(rand(0,platforms.length))]; x=clamp(p.x+rand(0,Math.max(2,p.w-40)),20,WORLD_W-60); y=p.y-62; }
  else { x=rand(60,WORLD_W-60); y=rand(120,groundY-110); }
  const h=spawnHeart(x,y,false,forceType); h.rest=false; return h; }
function spawnPHeart(x,y){ const w=50,h=58; pHearts.push({ x:clamp(x-w/2,2,WORLD_W-w-2), y:y-h, w, h,
  vy:rand(-2,1), col:HEART_COLORS[Math.floor(rand(0,HEART_COLORS.length))], sw:rand(0,6.28), rest:false }); }
function fireBlackHeart(mo){ const px=player.x+player.w/2, py=player.y+player.h/2, mx=mo.x+mo.w/2, my=mo.y+mo.h*0.4;
  const a=Math.atan2(py-my,px-mx), sp=4.6+Math.min(level*0.02,4);
  shots.push({x:mx,y:my,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0,maxLife:3.2,sw:rand(0,6.28)});
  beep(140,0.12,'sawtooth',0.05); }

function startLevel(n){ level=clamp(n,1,LEVEL_CAP); if(n===1) explodedCount=0; overlay.classList.add('hidden');
  try{ if(!actx)actx=new (window.AudioContext||window.webkitAudioContext)(); if(actx&&actx.state==='suspended')actx.resume(); }catch(e){}
  buildLevel(level); saveProgress(); }

function buildLevel(n){
  resize();
  RNG=makeRng(seedFor(n));      // geração determinística (mesmo nível+semente = mesmo mundo)
  cfg=genLevel(n);
  PAL = cfg.hue==null ? null : palFromHue(cfg.hue); VIGN=cfg.vignette||0;
  phGrav=cfg.grav; phMove=cfg.move; phFric=cfg.fric; phBandH=cfg.bandH; phSlot=cfg.slot; phBaseJump=cfg.baseJump;
  JUMP_Hc=(phBaseJump*phBaseJump)/(2*phGrav);
  WORLD_W=cfg.w; WORLD_H=cfg.h; groundY=WORLD_H-GROUND_H;
  player={ x:120, y:groundY-46, vx:0, vy:0, w:34, h:46, onGround:false, platRef:null, face:1,
    charge:0, charging:false, stam:MAX_STAM, conv:0, prevJump:false, jumps:0, coyote:0, jumpBuf:0,
    moveMaxBase:cfg.playerSpeed, jumpBase:cfg.playerJump, maxJumps:cfg.maxJumps,
    stamRegenLvl:cfg.stamRegen, blastCost:cfg.blastCost, hp:cfg.maxHp, maxHp:cfg.maxHp, invuln:0,
    powers:powersForLevel(n), equip:0, shieldT:0, laserLock:0, rainT:0, guard:null, elec:null,
    agility:1, slowT:0, biteCD:0, rootT:0, stickT:0 };
  { const bonus=clamp(Math.floor((deepest||1)/8),0,10);            // bônus permanente cresce com o recorde
    player.moveMaxBase*=(1+bonus*0.02); player.jumpBase*=(1+bonus*0.015); player.bonus=bonus; }
  { const _bp=document.getElementById('bPow'), _bc=document.getElementById('bCyc');
    if(_bp) _bp.style.display=player.powers.length?'flex':'none';
    if(_bc) _bc.style.display=player.powers.length>1?'flex':'none'; }
  npcs=[];monsters=[];shots=[];loveShots=[];waves=[];lasers=[];loveRain=[];divineFx=null;elecRays=[];beams=[];spikesW=[];stickies=[];phantomT=0;blasts=[];particles=[];walls=[];ambient=[];stars=[];fhearts=[];pHearts=[];blocks=[];rock=null;carrying=0;rainTimer=0;
  camX=0;camY=clamp(player.y-H/2,0,Math.max(0,WORLD_H-H));shake=0;time=0;

  for(let i=0;i<110;i++) stars.push({x:rand(0,WORLD_W),y:rand(0,WORLD_H*0.65),r:rand(0.6,1.8),tw:rand(0,6.28)});
  for(let i=0;i<26;i++) ambient.push({x:rand(0,WORLD_W),y:rand(0,WORLD_H),s:rand(6,14),sp:rand(.2,.6),sw:rand(0,6.28),drift:rand(.3,.9)});

  // plataformas: menos barras (porém mais largas) + leve distorção — caminho-base SEMPRE alcançável
  platforms=[];
  const M=cfg.mut||{jitter:0,warp:0,gaps:0,densityMul:1};
  const nBands=Math.max(4, Math.floor((groundY-110)/phBandH));
  const count=Math.max(3, Math.round(WORLD_W/(phSlot*1.5/(M.densityMul||1))));   // bem menos barras (mais espalhadas)
  const cellW=WORLD_W/count;
  for(let b=0;b<nBands;b++){
    const y=groundY-phBandH*(b+1);
    const off=(b%2)?cellW*0.5:0;
    for(let s=0;s<count;s++){
      if(M.gaps>0 && b===nBands-1 && RNG()<M.gaps*1.5) continue;        // buracos só na banda mais alta (não quebra a subida)
      const w=clamp(rand(124,188)*(1+(RNG()-0.5)*M.warp*0.4), 96, 210), hw=w/2;   // barras mais largas
      let cx=off+(s+0.5)*cellW+rand(-cellW*0.14,cellW*0.14)+(RNG()-0.5)*cellW*M.jitter*0.12;
      cx=clamp(cx,hw+10,WORLD_W-hw-10);
      platforms.push({x:cx-hw,y,w,h:14,band:b,cx,hw,mv:null});
    }
  }
  const movPool=shuffle(platforms.filter(p=>{ if(p.band<2)return false;
    const rL=p.x-18, rR=(WORLD_W-p.w-18)-p.x; return rL>=50&&rR>=50; }));
  for(let i=0;i<Math.min(cfg.moving,movPool.length);i++){ const p=movPool[i];
    const rL=p.x-18, rR=(WORLD_W-p.w-18)-p.x, half=Math.min(rand(45,80),rL-2,rR-2);
    p.mv={x0:p.x-half,x1:p.x+half,sp:cfg.mvSpeed*rand(.7,1.2),dir:RNG()<.5?-1:1}; }

  // ===== ARQUITETURA BACKROOMS: estruturas distorcidas (diagonal/colada/V/quadrado) =====
  addStructures(cfg.archCount||0, nBands);

  const reach=computeReachable();
  const statics=platforms.filter((p,i)=>!p.mv && reach[i]);
  const reachAny=platforms.filter((p,i)=>reach[i]);

  // blocos: largura de plataforma normal, sempre ao lado de uma alcançável
  for(let i=0;i<cfg.blocks;i++){ const p=statics[Math.floor(rand(0,statics.length))]||platforms[0];
    const bw=clamp(p.w*rand(.8,1.05),80,132), bh=30, side=RNG()<.5?-1:1;
    let bx=side<0 ? p.x-bw-rand(4,14) : p.x+p.w+rand(4,14);
    bx=clamp(bx,8,WORLD_W-bw-8);
    blocks.push({x:bx,y:p.y,w:bw,h:bh,state:'idle',t:0,vy:0,sw:rand(0,6.28)}); }

  if(cfg.type==='love'){
    totalSad0=cfg.npc;
    for(let i=0;i<cfg.npc;i++){
      let x,y2;
      if(i<3){ x=rand(180,Math.min(640,WORLD_W-60)); y2=groundY-44; }
      else { const p=(reachAny[Math.floor(rand(0,reachAny.length))])||platforms[0]; x=clamp(p.x+rand(0,Math.max(2,p.w-32)),0,WORLD_W-30); y2=p.y-44; }
      npcs.push(mkSad(x,y2));
    }
    // monstros (longe do início), por tipo
    const spawnMon=(kind,cnt)=>{ for(let i=0;i<cnt;i++){ const p=reachAny[Math.floor(rand(0,reachAny.length))]||platforms[0];
      const x=clamp(p.x+rand(0,Math.max(2,p.w-40)), 760, WORLD_W-60); monsters.push(mkMonster(x, p.y-50*cfg.monsterScale, kind)); } };
    spawnMon('chaser',cfg.chaserCount); spawnMon('shooter',cfg.shooterCount); spawnMon('eater',cfg.eaterCount);
    spawnMon('dog',cfg.dogCount); spawnMon('sphere',cfg.sphereCount); spawnMon('spiker',cfg.spikerCount); spawnMon('beamer',cfg.beamerCount);
    for(let i=0;i<cfg.tentacleCount;i++){ const tm=mkMonster(0,0,'tentacle'); tm.x=clamp(rand(700,WORLD_W-120),60,WORLD_W-tm.w-40); tm.y=groundY-tm.h; monsters.push(tm); }
    if(cfg.bossCount){ const bm=mkMonster(0,0,'boss'); bm.x=clamp(WORLD_W*0.6,200,WORLD_W-bm.w-40); bm.y=groundY-bm.h; monsters.push(bm); }
    state='play';
  } else {
    totalSad0=0;
    rock={ x:WORLD_W/2-32, y:groundY-78, w:64, h:78, fill:0, target:cfg.target, done:false, born:0 };
    for(let i=0;i<26;i++) spawnHeartScattered();
    state='play';
  }
  setObjective(); updateHUD();
  { const hasMon=monsters.length>0;
    introSub='NÍVEL '+level;
    introText = cfg.type==='collect' ? ('Colete '+cfg.target+' corações e encha a máquina no centro')
              : (hasMon ? '⚠️ Apaixone todos os tristes E derrote os monstros' : 'Apaixone todos os tristes');
    introT = 2.6; }
  RNG=Math.random;   // gameplay volta a ser aleatório (partículas etc.)
}

// MOTIVOS BACKROOMS: cada nível é o anterior um pouco mais deformado.
// Âncoras estáveis (pela semente) + estágio que avança com a profundidade.
// Só ADICIONAM superfícies reais (colisão honesta) e o caminho-base continua alcançável.
function addStructures(count, nBands){
  if(count<=0) return;
  const d=Math.max(0, level-5);
  const yTop=groundY-phBandH*(nBands-1), yBot=groundY-phBandH*1.5;
  const mk=(x,y,w,h)=>{ const ww=clamp(w,36,170), hh=clamp(h||14,10,64), hw=ww/2,
    cx=clamp(x,hw+8,WORLD_W-hw-8), yy=clamp(y,yTop,yBot);
    platforms.push({x:cx-hw,y:yy,w:ww,h:hh,band:clamp(Math.round((groundY-yy)/phBandH)-1,1,99),cx,hw,mv:null,arch:true,motif:true}); };
  const hash=i=>{ let h=Math.imul((i+1)^runSeed,2654435761)>>>0; h^=h>>>15; h=Math.imul(h,2246822507)>>>0; h^=h>>>13; return h>>>0; };
  const N=Math.min(count,14), spanY=Math.max(1,(yBot-yTop-phBandH));
  for(let i=0;i<N;i++){
    const hx=hash(i*2), hy=hash(i*2+1);
    const ax=120+((hx%10000)/10000)*(WORLD_W-240);       // posição ~estável entre níveis (só "anda" devagar)
    const ay=clamp(yTop+phBandH+((hy%10000)/10000)*spanY, yTop, yBot);
    const stage=d+(hx%7);                                 // +1 a cada nível => "o anterior, mais torto"
    const cyc=stage%7, wear=Math.floor(stage/7), cr=Math.min(wear*4,24);  // cr = entortamento acumulado
    if(cyc===0){ mk(ax,ay,72,12); mk(ax+cr*0.4,ay-16,72,12); }                          // 6: duas coladas
    else if(cyc===1){ mk(ax,ay,78,26+Math.min(wear*3,18)); }                            // 7: fundiram numa grossa
    else if(cyc===2){ mk(ax,ay,82,28); mk(ax+56,ay-6,40,12); }                          // 8: grossa + uma menor perto
    else if(cyc===3){ mk(ax,ay,82,28); for(let k=0;k<3;k++) mk(ax+44+k*12,ay-6-k*(6+cr*0.2),18,10); } // 9: menor inclinando/chegando
    else if(cyc===4){ mk(ax,ay,84,30); mk(ax+34,ay-15,28,14); }                         // 10: grudou em cima
    else if(cyc===5){ for(let k=0;k<4;k++) mk(ax,ay-k*14,16,14); mk(ax+26,ay,46,14); }   // 11: virou um "L"
    else { for(let k=0;k<5;k++) mk(ax+(k>2?(k-2)*cr*0.3:0),ay-k*14,16,14);               // 12+: "L" puxado, perna torta
           for(let k=0;k<3;k++) mk(ax+22+k*(16+cr*0.3), ay+k*cr*0.2, 22,12); }
  }
}

function updatePlatforms(){
  for(const p of platforms){ p.dx=0;
    if(p.mv){ const old=p.x; p.x+=p.mv.sp*p.mv.dir;
      if(p.x<p.mv.x0){p.x=p.mv.x0;p.mv.dir=1;} if(p.x>p.mv.x1){p.x=p.mv.x1;p.mv.dir=-1;} p.dx=p.x-old; } }
}
function applyVertical(e){
  e.vy+=phGrav; e.y+=e.vy; e.onGround=false; e.platRef=null;
  if(e.y+e.h>=groundY){ e.y=groundY-e.h; e.vy=0; e.onGround=true; }
  for(const p of platforms){ if(phantomT>0) break; if(e.vy>=0){ const feet=e.y+e.h, prev=feet-e.vy;
    if(e.x+e.w>p.x+4 && e.x<p.x+p.w-4 && prev<=p.y+2 && feet>=p.y && feet<=p.y+p.h+14){
      e.y=p.y-e.h; e.vy=0; e.onGround=true; e.platRef=p; } } }
  for(const bl of blocks){ if(bl.state==='fall')continue; if(e.vy>=0){ const feet=e.y+e.h, prev=feet-e.vy;
    if(e.x+e.w>bl.x+3 && e.x<bl.x+bl.w-3 && prev<=bl.y+2 && feet>=bl.y && feet<=bl.y+bl.h+14){
      e.y=bl.y-e.h; e.vy=0; e.onGround=true; e.platRef=null; } } }
}
function carry(e){ if(e.platRef&&e.platRef.dx) e.x=clamp(e.x+e.platRef.dx,0,WORLD_W-e.w); }
function landHeart(h){ if(h.rest) return;
  if(h.y+h.h>=groundY){ h.y=groundY-h.h; h.vy=0; h.rest=true; return; }
  for(const p of platforms){ const feet=h.y+h.h, prev=feet-h.vy;
    if(h.x+h.w/2>p.x && h.x+h.w/2<p.x+p.w && prev<=p.y+2 && feet>=p.y){ h.y=p.y-h.h; h.vy=0; h.rest=true; return; } }
}
function restPHeartGround(h){ h.y=groundY-h.h; h.vy=0;
  let guard=0, moved=true;
  while(moved && guard++<300){ moved=false;
    for(const o of pHearts){ if(o===h||!o.rest)continue;
      if(h.x<o.x+o.w && h.x+h.w>o.x){ if(h.x+h.w/2 < o.x+o.w/2) h.x=o.x-h.w-1; else h.x=o.x+o.w+1;
        h.x=clamp(h.x,2,WORLD_W-h.w-2); moved=true; } } }
  h.rest=true;
}

function fireBlast(){
  const ch=player.charge, maxR=blastMaxR(ch);
  const bx=player.x+player.w/2, by=player.y+player.h*0.42;
  blasts.push({x:bx,y:by,r:24,maxR,life:0,maxLife:0.6});
  shake=Math.min(20,7+ch*16); player.stam=Math.max(0,player.stam-player.blastCost);
  beep(520-ch*120,0.10,'triangle',0.07); setTimeout(()=>beep(760,0.18,'sine',0.05),60);
  const n=16+Math.floor(ch*28);
  for(let i=0;i<n;i++){const a=rand(0,6.28),sp=rand(2,6)*(0.6+ch);
    particles.push({x:bx,y:by,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1.5,life:1,decay:rand(.012,.026),s:rand(8,18),col:Math.random()<.5?'#ff2e63':'#ff8fab'});}
  for(const m of npcs){ const dd=dist(bx,by,m.x+m.w/2,m.y+m.h/2);
    if(dd<maxR){ if(m.state==='sad') makeHappy(m);
      else if(m.state==='happy'&&!m.holding&&m.grace<=0){ m.state='frozen'; m.freezeT=FREEZE_TIME; m.vx=0; m.stuck=false; } } }
  for(const mo of monsters){ if(mo.hitT<=0){ const dd=dist(bx,by,mo.x+mo.w/2,mo.y+mo.h/2);
    if(dd<maxR){ mo.hp--; mo.hitT=0.45; mo.vx+=Math.sign(mo.x-bx)*4; beep(180,0.12,'sawtooth',0.06);
      if(mo.hp<=0) defeatMonster(mo); } } }
  for(const bl of blocks){ if(bl.state==='idle'){ const dd=dist(bx,by,bl.x+bl.w/2,bl.y+bl.h/2);
    if(dd<maxR){ bl.state='hit'; bl.t=BLOCK_TIME; bl.vy=0; beep(260,0.1,'square',0.05); } } }
}
function makeHappy(n){ if(n.state!=='sad')return; n.state='happy'; n.grace=0.95; n.heartTrail=0;
  player.conv++;
  beep(660,0.12,'sine',0.06); setTimeout(()=>beep(990,0.14,'sine',0.045),70);
  for(let i=0;i<8;i++){const a=rand(0,6.28),sp=rand(1,3.5);
    particles.push({x:n.x+n.w/2,y:n.y+10,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,life:1,decay:rand(.02,.04),s:rand(7,13),col:'#ff5d8f'});}
  for(let i=0;i<8;i++) particles.push({x:player.x+player.w/2,y:player.y+player.h/2,vx:rand(-2.4,2.4),vy:rand(-3.6,-0.5),life:1,decay:.03,s:rand(6,12),col:'#ffd166'});
  updateHUD(); checkWinLove(); }
function explodeHappy(n){ const cx=n.x+n.w/2, cy=n.y+n.h*0.5; shake=Math.min(22,shake+10);
  beep(300,0.18,'sawtooth',0.06); setTimeout(()=>beep(880,0.2,'sine',0.05),60);
  for(let i=0;i<32;i++){const a=rand(0,6.28),sp=rand(2,8);
    particles.push({x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-rand(1,4),life:1,decay:rand(.008,.02),s:rand(8,20),col:HEART_COLORS[Math.floor(rand(0,8))]});}
  for(let i=0;i<3;i++) spawnPHeart(cx+rand(-30,30), cy);
  explodedCount++; const i=npcs.indexOf(n); if(i>=0) npcs.splice(i,1); updateHUD(); checkWinLove(); }
function explodeBlock(bl){ const cx=bl.x+bl.w/2; shake=Math.min(22,shake+12);
  beep(200,0.2,'sawtooth',0.07); setTimeout(()=>beep(720,0.18,'sine',0.05),70);
  for(let i=0;i<36;i++){const a=rand(0,6.28),sp=rand(2,9);
    particles.push({x:cx,y:bl.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-rand(1,4),life:1,decay:rand(.008,.02),s:rand(9,20),col:HEART_COLORS[Math.floor(rand(0,8))]});}
  for(let i=0;i<3;i++) spawnPHeart(cx+rand(-30,30), groundY); }
function defeatMonster(mo){ const cx=mo.x+mo.w/2, cy=mo.y+mo.h/2; shake=Math.min(24,shake+14);
  beep(140,0.3,'sawtooth',0.08); setTimeout(()=>beep(660,0.2,'sine',0.05),90);
  for(let i=0;i<46;i++){const a=rand(0,6.28),sp=rand(2,9);
    particles.push({x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-rand(1,4),life:1,decay:rand(.01,.02),s:rand(9,20),col:HEART_COLORS[Math.floor(rand(0,8))]});}
  for(let i=0;i<4;i++) spawnPHeart(cx+rand(-30,30), groundY);
  const i=monsters.indexOf(mo); if(i>=0) monsters.splice(i,1); checkWinLove(); }
function placeWall(){ if(player.stam<WALL_COST)return; player.stam-=WALL_COST;
  const h=player.h*3, wx=player.x+player.w/2-9, wy=(player.y+player.h)-h;
  walls.push({x:wx,y:Math.max(0,wy),w:18,h,life:WALL_LIFE});
  beep(180,0.18,'square',0.06); setTimeout(()=>beep(120,0.25,'sawtooth',0.05),80);
  for(let i=0;i<14;i++) particles.push({x:wx+9,y:wy+rand(0,h),vx:rand(-1,1),vy:rand(-2,0),life:1,decay:.03,s:rand(6,12),col:'#b39ddb'}); }

// ===== PODERES (ativos, equipáveis) =====
const ACTIVE_POWERS={
  shot:{name:'Disparo de amor', cost:24, fire:fireLoveShot},
  wave:{name:'Onda de amor',    cost:34, fire:fireWave},
  shield:{name:'Escudo',        cost:40, fire:activateShield},
  laser:{name:'Laser de amor',  cost:46, fire:fireLaser},
  rain:{name:'Chuva de amor',   cost:38, fire:fireRain},
  guard:{name:'Coração de proteção', cost:42, fire:fireGuard},
  electric:{name:'Amor elétrico', cost:44, fire:fireElectric},
};
function powersForLevel(n){ const p=[]; if(n>=8)p.push('shot'); if(n>=12)p.push('wave'); if(n>=16)p.push('shield'); if(n>=20)p.push('laser'); if(n>=24)p.push('rain'); if(n>=28)p.push('guard'); if(n>=32)p.push('electric'); return p; }
function usePower(){ if(state!=='play'||!player.powers.length)return; const id=player.powers[player.equip], P=ACTIVE_POWERS[id];
  if(player.stam<P.cost){ beep(120,0.08,'square',0.04); return; } player.stam-=P.cost; P.fire(); updateHUD(); }
function cyclePower(){ if(player.powers.length>1){ player.equip=(player.equip+1)%player.powers.length; beep(560,0.07,'sine',0.05); updateHUD(); } }
function fireLoveShot(){ const dir=player.face||1, sz=18+Math.min(level*0.25,18);
  loveShots.push({x:player.x+player.w/2,y:player.y+player.h*0.42,vx:dir*9,sz,life:0,hit:[]}); beep(720,0.12,'sine',0.06); shake=Math.min(12,shake+5); }
function fireWave(){ const y=player.y+player.h, maxD=280+Math.min(level*6,360);
  for(const dir of [-1,1]) waves.push({cx:player.x+player.w/2,y,dir,dist:0,maxDist:maxD,h:64,hit:[]});
  beep(300,0.16,'sine',0.06); shake=Math.min(14,shake+6); }
function activateShield(){ player.shieldT=5; beep(440,0.15,'sine',0.06); setTimeout(()=>beep(660,0.18,'sine',0.05),80); }
function fireLaser(){ const dir=player.face||1, by=player.y+player.h*0.45, band=player.h*0.85, pcx=player.x+player.w/2;
  player.laserLock=1.6;                                       // trava o movimento ~1,6s
  for(const n of npcs){ if(n.state==='sad' && Math.sign((n.x+n.w/2)-pcx)===dir && Math.abs((n.y+n.h/2)-by)<band){ makeHappy(n); n.vx=dir*6; } }
  for(const mo of monsters.slice()){ if(Math.sign((mo.x+mo.w/2)-pcx)===dir && Math.abs((mo.y+mo.h/2)-by)<band+12){ mo.hp-=3; mo.hitT=0.4; mo.vx+=dir*9; if(mo.hp<=0)defeatMonster(mo); } }
  lasers.push({x:pcx,y:by,dir,life:0.55}); beep(900,0.25,'sawtooth',0.07); shake=Math.min(20,shake+12); }
function fireRain(){ player.rainT=2.6; beep(520,0.2,'sine',0.06); }
function fireGuard(){ player.guard={hp:3,maxHp:3,t:30,x:player.x+player.w/2,y:player.y-46}; beep(620,0.16,'sine',0.06); setTimeout(()=>beep(820,0.16,'sine',0.05),80); }
function fireElectric(){ player.elec={t:4,fireT:0}; beep(760,0.14,'square',0.05); }
function fireDivine(){ if(state!=='play'||player.stam<MAX_STAM||level<10)return;   // ULTIMATE: só com a barra cheia
  player.stam=0; divineFx={x:player.x+player.w/2,y:player.y+player.h/2,r:0,maxR:Math.hypot(WORLD_W,WORLD_H),life:0,maxLife:1.3};
  for(const n of npcs){ if(n.state==='sad') makeHappy(n); }          // apaixona TODOS
  for(const mo of monsters.slice()) defeatMonster(mo);               // destrói TODOS os monstros
  shake=Math.min(32,shake+26); beep(660,0.4,'sine',0.09); setTimeout(()=>beep(990,0.5,'sine',0.08),120);
  updateHUD(); checkWinLove(); }

function damagePlayer(srcx){ if(state!=='play')return;
  if(player.shieldT>0) return;                              // ESCUDO bloqueia todo dano
  if(player.guard && player.guard.hp>0){ player.guard.hp--; player.invuln=0.6; shake=12; beep(520,0.12,'square',0.05);
    for(let i=0;i<10;i++){const a=rand(0,6.28);particles.push({x:player.guard.x,y:player.guard.y,vx:Math.cos(a)*3,vy:Math.sin(a)*3,life:1,decay:.04,s:rand(6,10),col:'#7fffd4'});}
    if(player.guard.hp<=0) player.guard=null; return; }     // CORAÇÃO DE PROTEÇÃO absorve o golpe
  if(mode==='infinite'){ if(pendingReset)return; deaths++; deepest=Math.max(deepest,level); shake=22; beep(110,0.35,'sawtooth',0.08);
    for(let i=0;i<22;i++){const a=rand(0,6.28);particles.push({x:player.x+player.w/2,y:player.y+player.h/2,vx:Math.cos(a)*5,vy:Math.sin(a)*5,life:1,decay:.025,s:rand(7,14),col:'#ff3b3b'});}
    pendingReset=true; return; }                       // INFINITO: tocou → reseta o nível
  if(player.invuln>0)return; player.hp--; player.invuln=1.2;
  player.vx=Math.sign((player.x+player.w/2)-srcx)*7; player.vy=-6.5; shake=18;
  beep(160,0.25,'sawtooth',0.08);
  for(let i=0;i<16;i++){const a=rand(0,6.28);particles.push({x:player.x+player.w/2,y:player.y+player.h/2,vx:Math.cos(a)*4,vy:Math.sin(a)*4,life:1,decay:.03,s:rand(6,12),col:'#ff3b3b'});}
  updateHUD(); if(player.hp<=0) die(); }

function update(dt){
  time+=dt; player.stam=Math.min(MAX_STAM,player.stam+player.stamRegenLvl*dt);
  if(player.invuln>0) player.invuln-=dt;
  if(player.biteCD>0) player.biteCD-=dt;
  if(player.slowT>0){ player.slowT-=dt; if(player.slowT<=0) player.agility=1; }   // agilidade volta após parar de ser mordido
  if(player.rootT>0) player.rootT-=dt;
  if(player.shieldT>0){ player.shieldT-=dt; const R=player.w*1.9, pcx=player.x+player.w/2, pcy=player.y+player.h/2;
    const push=o=>{ const ox=o.x+o.w/2, oy=o.y+o.h/2, dd=Math.hypot(ox-pcx,oy-pcy); if(dd<R){ const a=Math.atan2(oy-pcy,ox-pcx); o.x=clamp(o.x+Math.cos(a)*6,0,WORLD_W-o.w); o.vy=Math.min(o.vy,-2); } };
    for(const n of npcs) if(n.state==='happy') push(n); for(const mo of monsters) push(mo); }
  updatePlatforms();

  if(state==='play'){
    const slow=player.charging?0.5:1, stick=(player.stickT>0?0.35:1), mm=effMoveMax()*player.agility*stick, jv=effJump()*(player.stickT>0?0.62:1);
    if(keys.left){player.vx-=phMove*slow;player.face=-1;}
    if(keys.right){player.vx+=phMove*slow;player.face=1;}
    if(!keys.left&&!keys.right) player.vx*=phFric;
    player.vx=clamp(player.vx,-mm*slow,mm*slow);
    if(player.laserLock>0){ player.laserLock-=dt; player.vx=0; }   // laser trava o movimento
    if(player.rootT>0){ player.vx=0; }                              // esfera chorona te prende
    if(player.onGround){ player.coyote=COYOTE; } else { player.coyote=Math.max(0,player.coyote-dt); }
    const pressed=(keys.jump&&!player.prevJump)||jumpQueued;
    if(pressed) player.jumpBuf=JUMP_BUF; else player.jumpBuf=Math.max(0,player.jumpBuf-dt);
    if(player.jumpBuf>0 && (player.onGround||player.coyote>0)){
      player.vy=jv; player.onGround=false; player.jumps=1; player.coyote=0; player.jumpBuf=0; beep(440,0.09,'square',0.04);
    } else if(pressed && !player.onGround && player.coyote<=0 && player.jumps<player.maxJumps){
      player.vy=jv*0.92; player.jumps++; beep(580,0.09,'square',0.045);
      for(let i=0;i<10;i++){const a=rand(0,6.28);particles.push({x:player.x+player.w/2,y:player.y+player.h,vx:Math.cos(a)*2,vy:Math.sin(a)*1.4+1.2,life:1,decay:.04,s:rand(5,9),col:'#ff8fab'});}
    }
    player.prevJump=keys.jump; jumpQueued=false;
    if(keys.charge&&player.stam>=player.blastCost){player.charging=true;player.charge=Math.min(1,player.charge+dt*0.85);}
    player.x=clamp(player.x+player.vx,0,WORLD_W-player.w);
    applyVertical(player); carry(player);
    if(player.onGround) player.jumps=0;
  }

  for(let i=walls.length-1;i>=0;i--){ walls[i].life-=dt; if(walls[i].life<=0) walls.splice(i,1); }

  for(let i=blocks.length-1;i>=0;i--){ const bl=blocks[i]; bl.sw+=dt;
    if(bl.state==='hit'){ bl.t-=dt; if(bl.t<=0) bl.state='fall'; }
    else if(bl.state==='fall'){ bl.vy+=phGrav; bl.y+=bl.vy;
      if(bl.y+bl.h>=groundY){ bl.y=groundY-bl.h; explodeBlock(bl); blocks.splice(i,1); } } }

  for(const n of npcs){
    if(n.grace>0) n.grace-=dt; n.bob+=dt*6;
    if(n.state==='frozen'){ n.freezeT-=dt; n.shake+=dt; if(n.freezeT<=0){ explodeHappy(n); } continue; }
    if(n.state==='sad'){
      const fastM=(n.def&&n.def.fast)?2.0:1;
      if(n.platRef){ if(n.x<=n.platRef.x) n.dir=1; if(n.x>=n.platRef.x+n.platRef.w-n.w) n.dir=-1; n.vx=n.dir*0.7*fastM; }
      else { n.wander-=1; if(n.wander<=0){ n.dir=Math.random()<.5?-1:1; if(Math.random()<.3)n.dir=0; n.wander=rand(50,170); }
             n.vx=n.dir*0.9*fastM; if(n.x<=0)n.dir=1; if(n.x>=WORLD_W-n.w)n.dir=-1; }
      if(n.def&&n.def.bug){ n.bugT-=dt; if(n.bugT<=0){ n.bugT=rand(0.5,2.2);   // efeito bug: pula de lugar
        n.x=clamp(n.x+(Math.random()<.5?-1:1)*rand(12,40),0,WORLD_W-n.w); n.vy=-rand(1,4);
        for(let q=0;q<5;q++) particles.push({x:n.x+n.w/2,y:n.y+n.h/2,vx:rand(-2,2),vy:rand(-2,2),life:1,decay:.05,s:rand(4,8),col:'#7fb0ff'}); } }
    } else if(n.state==='happy'){
      n.stuck=false;
      if(n.holding){ n.wander-=1; if(n.wander<=0){ n.dir=Math.random()<.5?-1:1; if(Math.random()<.3)n.dir=0; n.wander=rand(50,170); }
        n.vx=n.dir*0.8; if(n.x<=0)n.dir=1; if(n.x>=WORLD_W-n.w)n.dir=-1;
      } else if(n.grace<=0 && cfg.type==='love'){
        let grabbed=false;
        for(let k=pHearts.length-1;k>=0;k--){ const ph=pHearts[k]; if(ph.rest && overlap(n,ph)){ pHearts.splice(k,1); n.holding=true; n.vx=0; grabbed=true; beep(820,0.1,'sine',0.05); break; } }
        if(!grabbed){ const px=player.x+player.w/2, nx=n.x+n.w/2; n.vx=Math.sign(px-nx)*cfg.follow;
          if(n.onGround && player.y<n.y-26 && Math.abs(px-nx)<240){ n.vy=phBaseJump*0.82; n.onGround=false; } }
      } else n.vx*=0.82;
      n.heartTrail-=dt; if(n.heartTrail<=0){ n.heartTrail=0.18;
        particles.push({x:n.x+n.w/2,y:n.y,vx:rand(-.4,.4),vy:-1.4,life:1,decay:.03,s:rand(5,9),col:'#ff8fab'}); }
    }
    const nx=clamp(n.x+n.vx,0,WORLD_W-n.w);
    let blocked=false;
    if(n.state==='happy'&&!n.holding){ for(const w of walls){
      if(nx<w.x+w.w&&nx+n.w>w.x&&n.y+n.h>w.y&&n.y<w.y+w.h){ blocked=true; n.stuck=true; break; } } }
    if(!blocked) n.x=nx; else n.vx=0;
    applyVertical(n); carry(n);
  }

  // MONSTROS (perseguidor / atirador / comedor / cão / esfera chorona / chefe)
  for(const mo of monsters){ if(mo.hitT>0) mo.hitT-=dt; mo.bob+=dt*5;
    const px=player.x+player.w/2, nx=mo.x+mo.w/2, py=player.y+player.h/2, ny=mo.y+mo.h/2;
    if(mo.float){ // ESFERA CHORONA: flutua e agarra/prende o jogador
      mo.x=clamp(mo.x+(px-nx)*0.012,0,WORLD_W-mo.w); mo.y+=(py-60-ny)*0.012;
      mo.grabCD-=dt; if(mo.grabCD<=0 && dist(px,py,nx,ny)<220){ mo.grabCD=2.6; player.rootT=Math.max(player.rootT,1.0); player.slowT=3; beep(120,0.2,'sawtooth',0.05); }
      continue; }
    mo.vx += (Math.sign(px-nx)*mo.sp - mo.vx)*0.12;
    if(mo.kind!=='shooter' && mo.kind!=='boss' && mo.onGround && player.y<mo.y-30 && Math.abs(px-nx)<260 && Math.random()<0.04){ mo.vy=phBaseJump*0.8; mo.onGround=false; }
    let bl=false; const mxx=clamp(mo.x+mo.vx,0,WORLD_W-mo.w);
    for(const w of walls){ if(mxx<w.x+w.w&&mxx+mo.w>w.x&&mo.y+mo.h>w.y&&mo.y<w.y+w.h){ bl=true; break; } }
    if(!bl) mo.x=mxx; applyVertical(mo); carry(mo);
    if(mo.kind==='shooter'){ mo.fireT-=dt; if(mo.fireT<=0 && Math.abs(px-nx)<1000 && shots.length<60){ mo.fireT=cfg.shooterRate; fireBlackHeart(mo); } }
    if(mo.kind==='beamer'){ mo.beamCD-=dt; if(mo.beamCD<=0 && beams.length<4){ mo.beamCD=rand(3.2,5); beams.push({x:player.x+player.w/2,t:-0.85,w:56,hit:false}); beep(80,0.3,'sawtooth',0.05); } }
    if(mo.kind==='spiker'){ mo.spikeCD-=dt; if(mo.spikeCD<=0 && spikesW.length<8){ mo.spikeCD=rand(3,4.5); for(const dr of [-1,1]) spikesW.push({x:mo.x+mo.w/2,dir:dr,dist:0,maxDist:440}); beep(150,0.18,'square',0.05); } }
    if(mo.kind==='boss'){ mo.phantomCD-=dt; if(mo.phantomCD<=0 && phantomT<=0){ mo.phantomCD=rand(9,13); phantomT=5; shake=Math.min(28,shake+18); beep(70,0.5,'sawtooth',0.06); } }
    if((mo.kind==='boss' || (mo.kind==='chaser' && (level-5)>=30)) && stickies.length<5){ mo.stickyCD-=dt; if(mo.stickyCD<=0){ mo.stickyCD=rand(4,7);
      const dir=Math.sign((player.x+player.w/2)-(mo.x+mo.w/2))||1, sx=clamp(player.x+dir*90,20,WORLD_W-90);
      stickies.push({x:sx,y:groundY-26,w:74,h:26,hp:2,maxHp:2,life:12,hitBy:null}); beep(110,0.2,'square',0.05); } }
    if(mo.kind==='eater'){ for(const n of npcs){ if(n.state==='sad'&&overlap(mo,n)){
        const idx=npcs.indexOf(n); if(idx>=0)npcs.splice(idx,1); totalSad0=Math.max(0,totalSad0-1);
        if(mo.w<110){ mo.w*=1.12; mo.h*=1.12; mo.grow++; } beep(90,0.18,'sawtooth',0.06);
        for(let i=0;i<10;i++){const a=rand(0,6.28);particles.push({x:n.x+n.w/2,y:n.y,vx:Math.cos(a)*3,vy:Math.sin(a)*3,life:1,decay:.03,s:rand(6,12),col:'#3d7bff'});}
        updateHUD(); checkWinLove(); break; } } }
  }

  // FEIXE VERTICAL: aviso, depois corta (dano); dá pra desviar saindo da coluna
  for(let i=beams.length-1;i>=0;i--){ const b=beams[i]; b.t+=dt; const pcx=player.x+player.w/2;
    let killed=false;
    for(const bl of blasts){ if(Math.abs(bl.x-b.x) < bl.r + b.w/2){ killed=true; break; } }   // EXPLOSÃO destrói o raio
    if(!killed && state==='play'){                                                              // ESCUDO/CORAÇÃO DE PROTEÇÃO repele
      if(player.shieldT>0 && Math.abs(pcx-b.x) < b.w/2 + player.w*1.9) killed=true;
      else if(player.guard && player.guard.hp>0 && Math.abs(pcx-b.x) < b.w/2 + 44) killed=true; }
    if(killed){ for(let q=0;q<10;q++){const a=rand(0,6.28);particles.push({x:b.x,y:player.y+player.h/2,vx:Math.cos(a)*4,vy:Math.sin(a)*4,life:1,decay:.05,s:rand(6,12),col:'#7fffd4'});} beep(700,0.1,'sine',0.05); beams.splice(i,1); continue; }
    if(b.t>=0 && b.t<0.45 && !b.hit && state==='play' && Math.abs(pcx-b.x)<b.w/2+player.w/2){ b.hit=true; damagePlayer(b.x); }
    if(b.t>0.62) beams.splice(i,1); }
  // ONDA DE ESPINHOS: percorre o chão; pula pra desviar
  for(let i=spikesW.length-1;i>=0;i--){ const sw=spikesW[i]; sw.dist+=6; const sx=sw.x+sw.dir*sw.dist;
    if(state==='play' && Math.abs((player.x+player.w/2)-sx)<28 && (player.y+player.h)>groundY-44){ damagePlayer(sx); }
    if(sw.dist>sw.maxDist || sx<0 || sx>WORLD_W) spikesW.splice(i,1); }
  // SEM SOLIDEZ (onda do chefe): plataformas viram fantasma por alguns segundos
  if(phantomT>0) phantomT-=dt;
  // BARREIRA PEGAJOSA: gruda o jogador, expira, e a explosão destrói (tem HP)
  for(let i=stickies.length-1;i>=0;i--){ const st=stickies[i]; st.life-=dt;
    if(state==='play' && overlap(player,st)){ player.stickT=0.12; }
    for(const b of blasts){ if(st.hitBy!==b && dist(b.x,b.y,st.x+st.w/2,st.y+st.h/2)<b.r+20){ st.hp--; st.hitBy=b;
      for(let q=0;q<8;q++) particles.push({x:st.x+st.w/2,y:st.y+st.h/2,vx:rand(-3,3),vy:rand(-4,0),life:1,decay:.04,s:rand(6,12),col:'#7d5a2e'}); } }
    if(st.hp<=0||st.life<=0) stickies.splice(i,1); }
  if(player.stickT>0) player.stickT-=dt;

  // DISPARO DE AMOR: voa até a borda, apaixona/empurra quem toca, fere monstros
  for(let i=loveShots.length-1;i>=0;i--){ const s=loveShots[i]; s.life+=dt; s.x+=s.vx;
    const box={x:s.x-s.sz/2,y:s.y-s.sz/2,w:s.sz,h:s.sz};
    for(const n of npcs){ if(n.state==='sad'&&overlap(box,n)){ makeHappy(n); n.vx=Math.sign(s.vx)*4; } }
    for(const mo of monsters){ if(mo.hitT<=0&&s.hit.indexOf(mo)<0&&overlap(box,mo)){ mo.hp--; mo.hitT=0.4; mo.vx+=Math.sign(s.vx)*5; s.hit.push(mo); if(mo.hp<=0)defeatMonster(mo); } }
    particles.push({x:s.x,y:s.y,vx:rand(-1,1),vy:rand(-1,1),life:1,decay:.06,s:rand(6,12),col:'#ff8fab'});
    if(s.x<-40||s.x>WORLD_W+40||s.life>3){ loveShots.splice(i,1); } }
  // ONDA DE AMOR: ondulação pros dois lados
  for(let i=waves.length-1;i>=0;i--){ const wv=waves[i]; wv.dist+=7; const wx=wv.cx+wv.dir*wv.dist;
    const box={x:wx-22,y:wv.y-wv.h,w:44,h:wv.h+30};
    for(const n of npcs){ if(n.state==='sad'&&overlap(box,n)){ makeHappy(n); n.vx=wv.dir*4; } }
    for(const mo of monsters){ if(mo.hitT<=0&&wv.hit.indexOf(mo)<0&&overlap(box,mo)){ mo.hp--; mo.hitT=0.4; mo.vx+=wv.dir*5; wv.hit.push(mo); if(mo.hp<=0)defeatMonster(mo); } }
    if(wv.dist>wv.maxDist){ waves.splice(i,1); } }
  // LASER: dura um instante (já converteu/feriu ao disparar)
  for(let i=lasers.length-1;i>=0;i--){ lasers[i].life-=dt; if(lasers[i].life<=0) lasers.splice(i,1); }
  // CHUVA DE AMOR: corações caem (atravessam plataformas) e apaixonam quem tocam
  if(player.rainT>0){ player.rainT-=dt; if(Math.random()<0.9) for(let q=0;q<3;q++) loveRain.push({x:camX+rand(0,W),y:camY-20,vy:rand(4,7),sz:rand(12,20)}); }
  for(let i=loveRain.length-1;i>=0;i--){ const r=loveRain[i]; r.y+=r.vy;
    for(const n of npcs){ if(n.state==='sad'&&Math.abs((n.x+n.w/2)-r.x)<n.w/2+r.sz/2&&r.y>n.y&&r.y<n.y+n.h){ makeHappy(n); } }
    if(r.y>WORLD_H+40||r.y>camY+H+120){ loveRain.splice(i,1); } }
  // AMOR DIVINO: anel crescente
  if(divineFx){ divineFx.life+=dt; divineFx.r=divineFx.maxR*clamp(divineFx.life/0.7,0,1); if(divineFx.life>=divineFx.maxLife) divineFx=null; }
  // CORAÇÃO DE PROTEÇÃO: segue o jogador, expira em 30s
  if(player.guard){ const tx=player.x+player.w/2, ty=player.y-46; player.guard.x+=(tx-player.guard.x)*0.18; player.guard.y+=(ty-player.guard.y)*0.18;
    player.guard.t-=dt; if(player.guard.t<=0||player.guard.hp<=0) player.guard=null; }
  // AMOR ELÉTRICO: nuvem-coração solta raios pra todos os lados
  if(player.elec){ player.elec.t-=dt; player.elec.fireT-=dt; const ex=player.x+player.w/2, ey=player.y-44;
    if(player.elec.fireT<=0){ player.elec.fireT=0.35; const R=160+Math.min(level*3,140);
      for(let a=0;a<8;a++) elecRays.push({x:ex,y:ey,ang:a*Math.PI/4,len:R,life:0.25});
      for(const n of npcs){ if(n.state==='sad'&&dist(ex,ey,n.x+n.w/2,n.y+n.h/2)<R) makeHappy(n); }
      for(const mo of monsters.slice()){ if(mo.hitT<=0&&dist(ex,ey,mo.x+mo.w/2,mo.y+mo.h/2)<R){ mo.hp--; mo.hitT=0.4; if(mo.hp<=0)defeatMonster(mo); } }
      beep(680,0.07,'sine',0.04); }
    if(player.elec.t<=0) player.elec=null; }
  for(let i=elecRays.length-1;i>=0;i--){ elecRays[i].life-=dt; if(elecRays[i].life<=0) elecRays.splice(i,1); }
  { const want=(level>=10 && player.stam>=MAX_STAM && state==='play'); if(want!==_divShown){ _divShown=want; const b=document.getElementById('bDiv'); if(b) b.style.display=want?'flex':'none'; } }

  // projéteis (corações negros) — fundo = metralhadora
  for(let i=shots.length-1;i>=0;i--){ const s=shots[i]; s.life+=dt; s.sw+=dt*6; s.x+=s.vx; s.y+=s.vy;
    if(s.life>=s.maxLife || s.x<-30 || s.x>WORLD_W+30 || s.y<-30 || s.y>WORLD_H+30){ shots.splice(i,1); continue; }
    if(state==='play' && player.invuln<=0 && player.shieldT<=0 && overlap(player,{x:s.x-9,y:s.y-9,w:18,h:18})){ shots.splice(i,1); damagePlayer(s.x); } }

  // contato com o jogador (HP)
  if(state==='play'){
    for(const n of npcs){ if(n.state==='happy'&&n.grace<=0&&!n.stuck&&!n.holding&&overlap(player,n)){ damagePlayer(n.x+n.w/2); break; } }
    for(const mo of monsters){ if(overlap(player,mo)){
        if(mode==='infinite'){ damagePlayer(mo.x+mo.w/2); }     // hardcore: qualquer toque reseta
        else if(mo.kind==='dog'){ if(player.biteCD<=0){ player.biteCD=0.8; player.agility=Math.max(0.5,player.agility-0.05); player.slowT=4;
            player.vx=Math.sign((player.x+player.w/2)-(mo.x+mo.w/2))*5; beep(150,0.1,'square',0.05);
            for(let i=0;i<6;i++){const a=rand(0,6.28);particles.push({x:player.x+player.w/2,y:player.y+player.h/2,vx:Math.cos(a)*3,vy:Math.sin(a)*3,life:1,decay:.05,s:rand(4,8),col:'#222'});} } }
        else if(mo.kind==='sphere'){ player.rootT=Math.max(player.rootT,0.6); player.slowT=3; }
        else { damagePlayer(mo.x+mo.w/2); }
        break; } }
  }

  if(cfg.type==='collect'&&state==='play'){
    rainTimer-=dt; if(rainTimer<=0){ rainTimer=rand(0.3,0.7); if(fhearts.length<46) spawnHeartScattered(); }
    const pcx=player.x+player.w/2, pcy=player.y+player.h/2;
    for(let i=fhearts.length-1;i>=0;i--){ const h=fhearts[i]; h.sw+=dt*4; if(h.fleeT>0) h.fleeT-=dt;
      const hcx=h.x+h.w/2, hcy=h.y+h.h/2, dx=hcx-pcx, near=Math.abs(dx)<300 && Math.abs(hcy-pcy)<260;
      const fast=(h.type==='fast'||h.type==='crybaby')?1.9:1;
      if(h.type==='snake' && h.fleeT<=0){ h.vx += (Math.sign(-dx)*3.0 - h.vx)*0.2; }     // sequestrador PERSEGUE
      else if(near){ h.vx += (Math.sign(dx)*4.4*fast - h.vx)*0.25;                            // foge mais rápido
        const onGround=(h.y+h.h>=groundY-3)||h.rest;
        if(onGround && h.type!=='ghost' && Math.random()<0.10){ h.vy=-rand(6.5,9.5); h.rest=false; } } // e PULA pra escapar
      else { h.wT-=dt; if(h.wT<=0){ h.wT=rand(0.5,1.6); h.wdir=(Math.random()<.5?-1:1)*(Math.random()<.25?0:1); } h.vx += (h.wdir*1.5*fast - h.vx)*0.1; } // VAGA aleatório
      if(h.type==='crybaby'){ h.vx += Math.sin(time*9+h.wob)*1.2; if(Math.random()<0.06) particles.push({x:hcx,y:h.y+h.h,vx:rand(-1,1),vy:rand(0,2),life:1,decay:.05,s:rand(4,7),col:'#7fc8ff'}); }
      h.x=clamp(h.x+h.vx,2,WORLD_W-h.w-2);
      if(h.type==='ghost'){ h.y+=Math.sin(time*3+h.wob)*0.6; h.rest=false; }              // FANTASMA: flutua e atravessa
      else { if(h.rest){ const cx=h.x+h.w/2, by=h.y+h.h; let sup=by>=groundY-2;
          if(!sup){ for(const p of platforms){ if(cx>p.x&&cx<p.x+p.w&&Math.abs(by-p.y)<5){ sup=true; break; } } }
          if(!sup) h.rest=false; }
        if(!h.rest){ h.vy=Math.min(h.vy+0.12,6.5); h.y+=h.vy; landHeart(h); } }
      if(h.type==='eater'){ for(let j=fhearts.length-1;j>=0;j--){ const o=fhearts[j]; if(o===h||o.type==='eater')continue;
          if(Math.abs((o.x+o.w/2)-hcx)<h.w*0.7 && Math.abs((o.y+o.h/2)-hcy)<h.h*0.7){ fhearts.splice(j,1); if(j<i)i--; if(h.s<86){h.s*=1.06;h.w*=1.06;h.h*=1.06;} beep(80,0.1,'sawtooth',0.04); } } }
      const hb={x:h.x-3,y:h.y-3,w:h.w+6,h:h.h+6};
      if(overlap(player,hb)){
        if(h.type==='tough' && h.hp>1){ h.hp--; h.vx=Math.sign(dx||1)*7; h.x=clamp(h.x+h.vx*2,2,WORLD_W-h.w-2); beep(220,0.08,'square',0.05); }
        else if(h.type==='snake' && carrying>0){ carrying--; h.fleeT=2.2; h.vx=Math.sign(-dx||1)*7; beep(150,0.14,'sawtooth',0.06); fhearts.splice(i,1); updateHUD(); }
        else if(h.type==='splitter'){ fhearts.splice(i,1); beep(900,0.06,'square',0.05); setTimeout(()=>beep(300,0.12,'sawtooth',0.05),60);
          for(let q=0;q<14;q++){const a=rand(0,6.28);particles.push({x:hcx,y:hcy,vx:Math.cos(a)*4,vy:Math.sin(a)*4,life:1,decay:.04,s:rand(6,12),col:h.col});}
          for(let q=0;q<2;q++){ const nh=spawnHeart(hcx+rand(-20,20),hcy,false,'fast'); nh.s*=0.7; nh.w*=0.7; nh.h*=0.7; nh.vy=-rand(2,4); nh.rest=false; } }
        else { let got=1; if(h.type==='eater') got=2; carrying+=got;
          if(h.type==='solid'){ player.vx=Math.sign((player.x+player.w/2)-hcx)*8; player.vy=-4; }
          fhearts.splice(i,1); beep(700+carrying*4,0.07,'sine',0.05); updateHUD(); } } }
    if(rock&&!rock.done&&overlap(player,rock)&&carrying>0){ rock.fill+=carrying; carrying=0;
      beep(440,0.12,'triangle',0.06); updateHUD(); if(rock.fill>=rock.target) bornFromRock(); }
  }

  for(const h of pHearts){ h.sw+=dt*4; if(!h.rest){ h.vy+=phGrav; h.y+=h.vy; if(h.y+h.h>=groundY) restPHeartGround(h); } }
  for(let i=blasts.length-1;i>=0;i--){ const b=blasts[i]; b.life+=dt; b.r+=(b.maxR-b.r)*0.22; if(b.life>=b.maxLife) blasts.splice(i,1); }
  for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.x+=p.vx; p.y+=p.vy; p.vy+=0.12; p.vx*=0.99; p.life-=p.decay; if(p.life<=0) particles.splice(i,1); }
  if(particles.length>220) particles.splice(0,particles.length-220);
  for(const a of ambient){ a.y-=a.sp; a.sw+=0.02; a.x+=Math.sin(a.sw)*a.drift; if(a.y<-20){ a.y=WORLD_H+10; a.x=rand(0,WORLD_W); } }

  shake*=0.86;
  camX += (clamp(player.x+player.w/2-W/2,0,Math.max(0,WORLD_W-W))-camX)*0.12;
  camY += (clamp(player.y+player.h/2-H/2,0,Math.max(0,WORLD_H-H))-camY)*0.12;
  amorFill.style.width=(player.charging?player.charge*100:0)+'%';
  stamFill.style.width=(player.stam/MAX_STAM*100)+'%';
  if(pendingReset){ pendingReset=false; startLevel(level); }   // reset seguro (fim do frame)
}

function bornFromRock(){ rock.done=true; const bornN=explodedCount>0?explodedCount+2:2; rock.born=bornN;
  shake=20; beep(330,0.2,'sine',0.07); setTimeout(()=>beep(660,0.25,'sine',0.06),120);
  for(let i=0;i<60;i++){const a=rand(0,6.28),s=rand(2,9);
    particles.push({x:rock.x+rock.w/2,y:rock.y+10,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,life:1,decay:rand(.008,.018),s:rand(10,22),col:HEART_COLORS[Math.floor(rand(0,8))]});}
  setTimeout(levelClear,1300); }

function draw(){
  const sx=(Math.random()-.5)*shake, sy=(Math.random()-.5)*shake;
  ctx.save(); ctx.translate(-camX+sx,-camY+sy);
  const sky=ctx.createLinearGradient(0,0,0,WORLD_H);
  if(PAL){ sky.addColorStop(0,PAL.skyTop); sky.addColorStop(.4,PAL.skyMid); sky.addColorStop(.75,PAL.skyLow); sky.addColorStop(1,PAL.skyGround); }
  else if(cfg.type==='collect'){ sky.addColorStop(0,'#0a1430'); sky.addColorStop(.5,'#274a8c'); sky.addColorStop(1,'#6a9bd8'); }
  else { sky.addColorStop(0,'#0a0820'); sky.addColorStop(.4,'#241a52'); sky.addColorStop(.75,'#5a2f6e'); sky.addColorStop(1,'#9a5a7a'); }
  ctx.fillStyle=sky; ctx.fillRect(camX-20,camY-20,W+40,H+40);
  for(const s of stars){ if(s.y>camY-20&&s.y<camY+H+20){ const a=0.4+0.6*Math.abs(Math.sin(time*1.5+s.tw));
    ctx.globalAlpha=a*(1-clamp((s.y/(WORLD_H*0.65)),0,1)*0.6); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,6.28); ctx.fill(); } }
  ctx.globalAlpha=1;
  for(const a of ambient){ if(a.y>camY-20&&a.y<camY+H+20){ ctx.save(); ctx.globalAlpha=0.12;
    ctx.fillStyle=PAL?PAL.amb:(cfg.type==='collect'?'#bcd4ff':'#ff9eb5'); heartPath(ctx,a.x,a.y,a.s); ctx.fill(); ctx.restore(); } }
  const gg=ctx.createLinearGradient(0,groundY,0,WORLD_H);
  if(PAL){ gg.addColorStop(0,PAL.groundTop); gg.addColorStop(1,PAL.groundBot); }
  else if(cfg.type==='collect'){ gg.addColorStop(0,'#3a6a4a'); gg.addColorStop(1,'#1d3a2a'); } else { gg.addColorStop(0,'#5a3d7a'); gg.addColorStop(1,'#2a1d40'); }
  ctx.fillStyle=gg; ctx.fillRect(camX-20,groundY,W+40,GROUND_H+20);
  ctx.fillStyle=PAL?PAL.groundLine:(cfg.type==='collect'?'rgba(180,255,200,.5)':'rgba(255,158,181,.55)'); ctx.fillRect(camX-20,groundY,W+40,4);

  for(const p of platforms){ if(p.y<camY-30||p.y>camY+H+30) continue;
    ctx.save(); if(phantomT>0){ ctx.globalAlpha=0.28; ctx.setLineDash([6,6]); }
    ctx.fillStyle=p.mv?(PAL?PAL.platMv:'#6a4a9e'):(p.arch?(PAL?PAL.platMv:'#7a5a3e'):(PAL?PAL.plat:'#523a78')); roundRect(ctx,p.x,p.y,p.w,p.h,7); ctx.fill();
    ctx.fillStyle=p.mv?'rgba(255,200,120,.9)':(p.arch?'rgba(120,255,220,.85)':(PAL?PAL.platTop:'rgba(179,157,219,.85)')); roundRect(ctx,p.x,p.y,p.w,4,4); ctx.fill();
    if(p.mv){ ctx.fillStyle='rgba(255,220,150,.7)'; ctx.font='10px sans-serif'; ctx.textAlign='center'; ctx.fillText('↔',p.x+p.w/2,p.y+12); } ctx.restore(); }
  // barreiras pegajosas
  for(const st of stickies){ if(st.x<camX-60||st.x>camX+W+60) continue; ctx.save();
    ctx.fillStyle='#6b4a22'; roundRect(ctx,st.x,st.y,st.w,st.h,6); ctx.fill();
    ctx.fillStyle='rgba(190,150,90,.85)'; for(let k=0;k<5;k++){ const gx=st.x+8+k*((st.w-16)/4); ctx.beginPath(); ctx.moveTo(gx,st.y); ctx.quadraticCurveTo(gx-4,st.y+12,gx,st.y-8); ctx.quadraticCurveTo(gx+4,st.y+12,gx,st.y); ctx.fill(); }
    ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(st.x,st.y-7,st.w,4); ctx.fillStyle='#ffb703'; ctx.fillRect(st.x,st.y-7,st.w*clamp(st.hp/st.maxHp,0,1),4); ctx.restore(); }

  for(const h of pHearts){ if(h.y<camY-40||h.y>camY+H+40) continue; const fl=h.rest?0:Math.sin(h.sw)*2;
    ctx.save(); ctx.shadowColor=h.col; ctx.shadowBlur=9; ctx.fillStyle=h.col; heartPath(ctx,h.x+h.w/2,h.y+fl+3,h.w*0.92); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.5)'; ctx.lineWidth=2; heartPath(ctx,h.x+h.w/2,h.y+fl+3,h.w*0.92); ctx.stroke(); ctx.restore(); }

  for(const bl of blocks){ if(bl.y<camY-50||bl.y>camY+H+50) continue;
    const hit=bl.state!=='idle'; const xx=bl.x+(hit?Math.sin(bl.sw*40)*2.5:0);
    ctx.save(); if(hit){ ctx.shadowColor='#ff2e63'; ctx.shadowBlur=18; }
    ctx.fillStyle=hit?'#ff5d8f':'#3fb6a8'; roundRect(ctx,xx,bl.y,bl.w,bl.h,7); ctx.fill();
    ctx.fillStyle=hit?'rgba(255,160,190,.9)':'rgba(150,235,225,.9)'; roundRect(ctx,xx,bl.y,bl.w,4,4); ctx.fill();
    ctx.strokeStyle=hit?'#b3002d':'#1f6b62'; ctx.lineWidth=3; roundRect(ctx,xx,bl.y,bl.w,bl.h,7); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.85)'; heartPath(ctx,xx+bl.w/2,bl.y+10,12); ctx.fill();
    ctx.restore();
    if(bl.state==='hit'){ ctx.save(); ctx.fillStyle='#fff'; ctx.font='bold 13px sans-serif'; ctx.textAlign='center';
      ctx.fillText(Math.ceil(bl.t), xx+bl.w/2, bl.y-6); ctx.restore(); } }

  for(const w of walls){ ctx.save(); ctx.globalAlpha=0.55+0.25*Math.sin(time*6);
    const g=ctx.createLinearGradient(w.x,0,w.x+w.w,0);
    g.addColorStop(0,'rgba(255,143,171,.7)');g.addColorStop(.5,'rgba(255,46,99,.85)');g.addColorStop(1,'rgba(255,143,171,.7)');
    ctx.fillStyle=g; ctx.shadowColor='#ff2e63'; ctx.shadowBlur=18; roundRect(ctx,w.x,w.y,w.w,w.h,8); ctx.fill(); ctx.restore();
    ctx.save(); ctx.globalAlpha=0.85; ctx.fillStyle='#fff';
    for(let yy=w.y+10;yy<w.y+w.h-6;yy+=22){ heartPath(ctx,w.x+w.w/2,yy,10); ctx.fill(); } ctx.restore(); }

  for(const p of particles){ ctx.save(); ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle=p.col; heartPath(ctx,p.x,p.y,p.s); ctx.fill(); ctx.restore(); }

  if(cfg.type==='collect'){ if(rock) drawRock(rock);
    for(const h of fhearts){ const fl=Math.sin(h.sw)*2, cxh=h.x+h.w/2, cyh=h.y+fl; ctx.save();
      if(h.type==='snake'){ ctx.strokeStyle=h.fleeT>0?'#9be29b':'#37b24d'; ctx.lineWidth=h.w*0.4; ctx.lineCap='round';
        ctx.beginPath(); for(let k=0;k<5;k++){ const sx=cxh-h.vx*k*2.2, sy=cyh+Math.sin(time*8+k)*5; if(k===0)ctx.moveTo(sx,sy); else ctx.lineTo(sx,sy);} ctx.stroke(); ctx.lineCap='butt'; }
      ctx.shadowColor=h.col; ctx.shadowBlur=10;
      if(h.type==='ghost'||h.vshape==='ghost'){ ctx.globalAlpha=0.45; }
      const Rh=srng(h.seed);
      ctx.save(); ctx.translate(cxh,cyh); ctx.scale(h.hsx||1,h.hsy||1); ctx.translate(-cxh,-cyh);   // achatado/esticado
      ctx.fillStyle=(h.type==='solid')?'#9aa7c7':(h.type==='eater'?'#7a2e6b':h.col);
      hShape(ctx,cxh,cyh,h.s,h.vshape,Rh); ctx.fill();
      ctx.strokeStyle=(h.type==='tough')?'#cfd8e0':'rgba(255,255,255,.5)'; ctx.lineWidth=(h.type==='tough')?4:2; hShape(ctx,cxh,cyh,h.s,h.vshape,srng(h.seed)); ctx.stroke();
      ctx.restore();
      if(h.type==='tough'){ ctx.strokeStyle='rgba(255,255,255,.6)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(cxh-h.s*0.2,cyh-h.s*0.1); ctx.lineTo(cxh+h.s*0.2,cyh-h.s*0.1); ctx.stroke(); }
      if(h.type==='eater'){ ctx.fillStyle='#120010'; ctx.beginPath(); ctx.arc(cxh-h.s*0.12,cyh-h.s*0.05,h.s*0.06,0,6.28); ctx.arc(cxh+h.s*0.12,cyh-h.s*0.05,h.s*0.06,0,6.28); ctx.fill();
        ctx.fillStyle='#fff'; for(let t=0;t<3;t++){ const tx=cxh-h.s*0.12+t*h.s*0.12; ctx.beginPath(); ctx.moveTo(tx,cyh+h.s*0.05); ctx.lineTo(tx+h.s*0.04,cyh+h.s*0.16); ctx.lineTo(tx+h.s*0.08,cyh+h.s*0.05); ctx.fill(); } }
      if(h.type==='crybaby'){ ctx.fillStyle='#7fc8ff'; ctx.beginPath(); ctx.arc(cxh-h.s*0.1,cyh+h.s*0.12,2.5,0,6.28); ctx.arc(cxh+h.s*0.1,cyh+h.s*0.12,2.5,0,6.28); ctx.fill(); }
      if(h.outfit>=0){ const s=h.s, ox=cxh, oy=cyh; ctx.lineWidth=2;
        if(h.outfit===0){ ctx.fillStyle='#222'; ctx.fillRect(ox-s*0.22,oy-s*0.30,s*0.44,s*0.06); ctx.fillRect(ox-s*0.12,oy-s*0.46,s*0.24,s*0.18); }      // cartola
        else if(h.outfit===1){ ctx.strokeStyle='#111'; ctx.beginPath(); ctx.arc(ox-s*0.12,oy-s*0.02,s*0.09,0,6.28); ctx.arc(ox+s*0.12,oy-s*0.02,s*0.09,0,6.28); ctx.moveTo(ox-s*0.03,oy-s*0.02); ctx.lineTo(ox+s*0.03,oy-s*0.02); ctx.stroke(); } // óculos
        else if(h.outfit===2){ ctx.fillStyle='#c1121f'; ctx.beginPath(); ctx.moveTo(ox,oy+s*0.16); ctx.lineTo(ox-s*0.16,oy+s*0.06); ctx.lineTo(ox-s*0.16,oy+s*0.26); ctx.closePath(); ctx.moveTo(ox,oy+s*0.16); ctx.lineTo(ox+s*0.16,oy+s*0.06); ctx.lineTo(ox+s*0.16,oy+s*0.26); ctx.closePath(); ctx.fill(); } // gravata-borboleta
        else if(h.outfit===3){ ctx.fillStyle='#2a9d8f'; ctx.fillRect(ox-s*0.2,oy+s*0.14,s*0.4,s*0.1); ctx.fillRect(ox+s*0.06,oy+s*0.2,s*0.08,s*0.18); } // cachecol
        else if(h.outfit===4){ ctx.fillStyle='#1d3557'; ctx.beginPath(); ctx.arc(ox,oy-s*0.26,s*0.2,Math.PI,0); ctx.fill(); ctx.fillRect(ox-s*0.02,oy-s*0.28,s*0.3,s*0.05); } // boné
        else { ctx.fillStyle='#ffd166'; ctx.beginPath(); ctx.moveTo(ox-s*0.2,oy-s*0.24); ctx.lineTo(ox-s*0.12,oy-s*0.42); ctx.lineTo(ox,oy-s*0.26); ctx.lineTo(ox+s*0.12,oy-s*0.42); ctx.lineTo(ox+s*0.2,oy-s*0.24); ctx.closePath(); ctx.fill(); } } // coroa
      if(h.vtwin){ const Rt=srng((h.seed^0x55)>>>0); ctx.save(); ctx.translate(cxh+h.s*0.42,cyh+h.s*0.22); ctx.scale(0.68,0.68); ctx.translate(-cxh,-cyh);
        ctx.fillStyle=h.col; hShape(ctx,cxh,cyh,h.s,h.vshape,Rt); ctx.fill(); ctx.strokeStyle='rgba(255,255,255,.5)'; ctx.lineWidth=2; hShape(ctx,cxh,cyh,h.s,h.vshape,srng((h.seed^0x55)>>>0)); ctx.stroke(); ctx.restore(); }
      ctx.restore(); } }

  for(const s of shots){ if(s.x<camX-30||s.x>camX+W+30||s.y<camY-30||s.y>camY+H+30) continue;
    ctx.save(); ctx.shadowColor='#8a00d0'; ctx.shadowBlur=12; ctx.fillStyle='#180022'; heartPath(ctx,s.x,s.y-7,16+Math.sin(s.sw)*1.5); ctx.fill();
    ctx.strokeStyle='#b14cff'; ctx.lineWidth=2; heartPath(ctx,s.x,s.y-7,16); ctx.stroke(); ctx.restore(); }
  // disparo de amor
  for(const s of loveShots){ ctx.save(); ctx.shadowColor='#ff2e63'; ctx.shadowBlur=16; ctx.fillStyle='#ff2e63';
    heartPath(ctx,s.x,s.y-s.sz*0.5,s.sz); ctx.fill(); ctx.fillStyle='rgba(255,255,255,.6)'; heartPath(ctx,s.x,s.y-s.sz*0.5,s.sz*0.5); ctx.fill(); ctx.restore(); }
  // onda de amor
  for(const wv of waves){ const wx=wv.cx+wv.dir*wv.dist, a=clamp(1-wv.dist/wv.maxDist,0,1);
    ctx.save(); ctx.globalAlpha=a*0.85; ctx.strokeStyle='#ff5d8f'; ctx.lineWidth=4;
    ctx.beginPath(); for(let k=-2;k<=2;k++){ const yy=wv.y-Math.abs(k)*10; ctx.moveTo(wx-wv.dir*8,yy-wv.h*0.5+Math.sin((wv.dist*0.05)+k)*6); ctx.lineTo(wx,yy-wv.h*0.5); } ctx.stroke();
    ctx.fillStyle='rgba(255,143,171,'+(a*0.5)+')'; heartPath(ctx,wx,wv.y-wv.h*0.6,18); ctx.fill(); ctx.restore(); }
  // laser de amor
  for(const L of lasers){ const a=clamp(L.life/0.55,0,1), ex=L.dir>0?WORLD_W:0;
    ctx.save(); ctx.globalAlpha=a; ctx.lineCap='round'; ctx.shadowColor='#ff2e63'; ctx.shadowBlur=20;
    ctx.strokeStyle='rgba(255,143,171,.5)'; ctx.lineWidth=player.h*0.9; ctx.beginPath(); ctx.moveTo(L.x,L.y); ctx.lineTo(ex,L.y); ctx.stroke();
    ctx.strokeStyle='#fff'; ctx.lineWidth=6; ctx.beginPath(); ctx.moveTo(L.x,L.y); ctx.lineTo(ex,L.y); ctx.stroke();
    ctx.lineCap='butt'; ctx.restore(); }
  // chuva de amor
  for(const r of loveRain){ if(r.y<camY-30||r.y>camY+H+30) continue; ctx.save(); ctx.shadowColor='#ff2e63'; ctx.shadowBlur=8; ctx.fillStyle='#ff5d8f'; heartPath(ctx,r.x,r.y,r.sz); ctx.fill(); ctx.restore(); }
  // amor divino (anel)
  if(divineFx){ const a=clamp(1-divineFx.life/divineFx.maxLife,0,1); ctx.save();
    ctx.globalAlpha=a; ctx.strokeStyle='#fff3b0'; ctx.lineWidth=14; ctx.shadowColor='#ffd166'; ctx.shadowBlur=30;
    ctx.beginPath(); ctx.arc(divineFx.x,divineFx.y,divineFx.r,0,6.2832); ctx.stroke();
    ctx.globalAlpha=a*0.4; ctx.strokeStyle='#ff8fab'; ctx.lineWidth=34; ctx.beginPath(); ctx.arc(divineFx.x,divineFx.y,divineFx.r*0.82,0,6.2832); ctx.stroke(); ctx.restore(); }
  // amor elétrico (raios + nuvem-coração)
  for(const ry of elecRays){ const a=clamp(ry.life/0.25,0,1); ctx.save(); ctx.globalAlpha=a; ctx.strokeStyle='#bff0ff'; ctx.lineWidth=3; ctx.shadowColor='#7fe0ff'; ctx.shadowBlur=12;
    ctx.beginPath(); ctx.moveTo(ry.x,ry.y); let zx=ry.x,zy=ry.y; for(let s=1;s<=4;s++){ zx=ry.x+Math.cos(ry.ang)*ry.len*s/4+rand(-6,6); zy=ry.y+Math.sin(ry.ang)*ry.len*s/4+rand(-6,6); ctx.lineTo(zx,zy);} ctx.stroke(); ctx.restore(); }
  if(player.elec){ const ex=player.x+player.w/2, ey=player.y-44; ctx.save(); ctx.shadowColor='#7fe0ff'; ctx.shadowBlur=18; ctx.fillStyle='#cdebff'; heartPath(ctx,ex,ey-8,22+Math.sin(time*12)*2); ctx.fill(); ctx.restore(); }
  // coração de proteção
  if(player.guard){ const g=player.guard; ctx.save(); ctx.shadowColor='#7fffd4'; ctx.shadowBlur=18;
    ctx.fillStyle=Math.sin(time*10)>0?'#7fffd4':'#5ce6c0'; heartPath(ctx,g.x,g.y-8,20); ctx.fill();
    ctx.fillStyle='#0a3'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center'; for(let i=0;i<g.hp;i++) ctx.fillText('♥',g.x-10+i*10,g.y+14); ctx.restore(); }

  // feixe vertical (aviso + corte)
  for(const b of beams){ if(b.x<camX-80||b.x>camX+W+80) continue;
    if(b.t<0){ const a=0.4+0.45*Math.sin(time*30); ctx.save(); ctx.globalAlpha=a; ctx.strokeStyle='#ff2e63'; ctx.lineWidth=3; ctx.setLineDash([12,10]);
      ctx.beginPath(); ctx.moveTo(b.x,camY); ctx.lineTo(b.x,camY+H); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
    else if(b.t<0.55){ ctx.save(); ctx.globalAlpha=0.9; ctx.shadowColor='#ff2e63'; ctx.shadowBlur=26;
      ctx.fillStyle='#0a0010'; ctx.fillRect(b.x-b.w/2,0,b.w,WORLD_H);
      ctx.strokeStyle='#ff2e63'; ctx.lineWidth=4; ctx.strokeRect(b.x-b.w/2,0,b.w,WORLD_H); ctx.restore(); } }
  // onda de espinhos
  for(const sw of spikesW){ const sx=sw.x+sw.dir*sw.dist; if(sx<camX-40||sx>camX+W+40) continue;
    ctx.save(); ctx.fillStyle='#d7dee6'; ctx.strokeStyle='#8a97a5'; ctx.lineWidth=2;
    for(let k=0;k<3;k++){ const tx=sx+sw.dir*k*15; ctx.beginPath(); ctx.moveTo(tx-9,groundY); ctx.lineTo(tx,groundY-28); ctx.lineTo(tx+9,groundY); ctx.closePath(); ctx.fill(); ctx.stroke(); } ctx.restore(); }

  for(const mo of monsters) drawMonster(mo);
  for(const n of npcs) drawNPC(n);

  for(const b of blasts){ const a=clamp(1-b.life/b.maxLife,0,1); ctx.save(); ctx.globalAlpha=a*0.9;
    const g=ctx.createRadialGradient(b.x,b.y,b.r*0.2,b.x,b.y,b.r);
    g.addColorStop(0,'rgba(255,143,171,0)');g.addColorStop(.7,'rgba(255,46,99,.5)');g.addColorStop(1,'rgba(255,46,99,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,6.2832); ctx.fill();
    // o coração DEMARCA a área de efeito (cresce com a força até o limite)
    ctx.globalAlpha=a; ctx.strokeStyle='#ff2e63'; ctx.lineWidth=4; const hs=b.r*1.18; heartPath(ctx,b.x,b.y-hs*0.5,hs); ctx.stroke(); ctx.restore(); }

  drawPlayer();
  ctx.restore();

  if(VIGN>0){ const vg=ctx.createRadialGradient(W/2,H/2,H*0.35,W/2,H/2,H*0.8);
    vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,'+VIGN+')'); ctx.fillStyle=vg; ctx.fillRect(0,0,W,H); }
  drawIndicators();
  if(cfg.type==='collect'&&carrying>0&&rock&&!rock.done){
    const psx=player.x+player.w/2-camX, psy=player.y-26-camY;
    const ang=Math.atan2((rock.y+rock.h/2)-(player.y+player.h/2),(rock.x+rock.w/2)-(player.x+player.w/2));
    ctx.save(); ctx.translate(psx,psy); ctx.rotate(ang);
    ctx.fillStyle='#ffd166'; ctx.shadowColor='#000'; ctx.shadowBlur=5;
    ctx.beginPath(); ctx.moveTo(20,0); ctx.lineTo(2,-8); ctx.lineTo(2,8); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.fillStyle='#fff'; ctx.font='bold 16px sans-serif'; ctx.textAlign='center'; ctx.shadowColor='#000'; ctx.shadowBlur=6;
    ctx.fillText('💖 '+carrying+' → 🪨', psx, psy-12); ctx.restore();
  }
  if(joy){ const ox=joy.ox, oy=joy.oy, R=JOY_R; ctx.save();
    // base (anel escuro)
    ctx.globalAlpha=0.9; ctx.fillStyle='rgba(22,20,38,0.5)'; ctx.beginPath(); ctx.arc(ox,oy,R,0,6.2832); ctx.fill();
    ctx.lineWidth=4; ctx.strokeStyle='rgba(170,180,220,0.55)'; ctx.beginPath(); ctx.arc(ox,oy,R,0,6.2832); ctx.stroke();
    // ticks tipo engrenagem
    ctx.strokeStyle='rgba(150,160,205,0.40)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(ox,oy,R*0.62,0,6.2832); ctx.stroke();
    for(let i=0;i<24;i++){ const a=i/24*6.2832, r1=R*0.5, r2=R*0.62;
      ctx.beginPath(); ctx.moveTo(ox+Math.cos(a)*r1,oy+Math.sin(a)*r1); ctx.lineTo(ox+Math.cos(a)*r2,oy+Math.sin(a)*r2); ctx.stroke(); }
    // setas de direção (N E S O)
    ctx.fillStyle='rgba(200,212,255,0.75)';
    for(const dd of [[0,-1],[1,0],[0,1],[-1,0]]){ const ax=ox+dd[0]*R*0.83, ay=oy+dd[1]*R*0.83, s=7;
      ctx.save(); ctx.translate(ax,ay); ctx.rotate(Math.atan2(dd[1],dd[0])+Math.PI/2);
      ctx.beginPath(); ctx.moveTo(0,-s); ctx.lineTo(-s*0.85,s*0.65); ctx.lineTo(s*0.85,s*0.65); ctx.closePath(); ctx.fill(); ctx.restore(); }
    // bolinha de vidro (knob)
    const kx=joy.x, ky=joy.y, kr=R*0.42;
    const g=ctx.createRadialGradient(kx-kr*0.3,ky-kr*0.4,kr*0.1,kx,ky,kr);
    g.addColorStop(0,'rgba(225,247,255,0.98)'); g.addColorStop(0.5,'rgba(120,190,235,0.96)'); g.addColorStop(1,'rgba(58,108,168,0.96)');
    ctx.fillStyle=g; ctx.shadowColor='rgba(90,170,235,0.85)'; ctx.shadowBlur=16;
    ctx.beginPath(); ctx.arc(kx,ky,kr,0,6.2832); ctx.fill(); ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(kx-kr*0.25,ky-kr*0.35,kr*0.42,kr*0.26,-0.5,0,6.2832); ctx.fill();
    ctx.restore(); }
  // OBJETIVO DO NÍVEL (centro da tela, no começo; some e o nível começa)
  if(introT>0 && introText){ const a=clamp(introT/0.5,0,1)*clamp((2.6-introT)/0.35,0,1);
    ctx.save(); ctx.globalAlpha=Math.min(1,a*1.2);
    ctx.fillStyle='rgba(8,6,20,0.72)'; ctx.fillRect(0,H/2-66,W,132);
    ctx.fillStyle='#ff8fab'; ctx.shadowColor='#ff2e63'; ctx.shadowBlur=18; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='bold '+Math.round(clamp(W*0.06,20,34))+'px system-ui,sans-serif'; ctx.fillText(introSub, W/2, H/2-22);
    ctx.shadowBlur=0; ctx.fillStyle='#fff'; ctx.font='bold '+Math.round(clamp(W*0.045,15,24))+'px system-ui,sans-serif';
    ctx.fillText('Objetivo', W/2, H/2+8);
    ctx.fillStyle='#dfe8ff'; ctx.font=Math.round(clamp(W*0.038,13,20))+'px system-ui,sans-serif';
    ctx.fillText(introText, W/2, H/2+36); ctx.restore(); }
}

function drawRock(r){ ctx.save(); const g=ctx.createRadialGradient(r.x+r.w/2,r.y+r.h/2,5,r.x+r.w/2,r.y+r.h/2,90);
  const glow=0.25+0.2*Math.sin(time*3)+(r.fill/r.target)*0.3;
  g.addColorStop(0,'rgba(255,90,140,'+glow+')'); g.addColorStop(1,'rgba(255,90,140,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(r.x+r.w/2,r.y+r.h/2,90,0,6.28); ctx.fill(); ctx.restore();
  ctx.fillStyle='#5b5470'; roundRect(ctx,r.x,r.y,r.w,r.h,14); ctx.fill();
  ctx.fillStyle='#736b8c'; roundRect(ctx,r.x+5,r.y+5,r.w-10,r.h*0.4,10); ctx.fill();
  ctx.strokeStyle='#3a3550'; ctx.lineWidth=3; roundRect(ctx,r.x,r.y,r.w,r.h,14); ctx.stroke();
  const f=clamp(r.fill/r.target,0,1);
  ctx.save(); heartPath(ctx,r.x+r.w/2,r.y+14,30); ctx.clip();
  ctx.fillStyle='#ff2e63'; ctx.fillRect(r.x-5,r.y+14+30*(1-f),r.w+10,30*f+4); ctx.restore();
  ctx.strokeStyle='#ff2e63'; ctx.lineWidth=2; heartPath(ctx,r.x+r.w/2,r.y+14,30); ctx.stroke(); }

function drawPlayer(){ const x=player.x,y=player.y,w=player.w,h=player.h,cx=x+w/2;
  if(player.shieldT>0){ const R=w*1.9, a=clamp(player.shieldT/5,0,1); ctx.save();
    ctx.globalAlpha=0.5+0.3*Math.sin(time*10); ctx.strokeStyle='#7fe0ff'; ctx.lineWidth=3; ctx.shadowColor='#7fe0ff'; ctx.shadowBlur=16;
    ctx.beginPath(); ctx.arc(cx,y+h*0.5,R*(0.8+0.2*a),0,6.2832); ctx.stroke();
    ctx.globalAlpha=0.12; ctx.fillStyle='#7fe0ff'; ctx.beginPath(); ctx.arc(cx,y+h*0.5,R*(0.8+0.2*a),0,6.2832); ctx.fill(); ctx.restore(); }
  if(player.invuln>0 && Math.floor(time*16)%2===0) return; // pisca ao levar dano
  if(player.charging&&player.charge>0.02){ const r=30+player.charge*90+Math.sin(time*18)*4;
    ctx.save(); const g=ctx.createRadialGradient(cx,y+h*0.45,4,cx,y+h*0.45,r);
    g.addColorStop(0,'rgba(255,46,99,'+(0.35+player.charge*0.35)+')'); g.addColorStop(1,'rgba(255,46,99,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,y+h*0.45,r,0,6.2832); ctx.fill(); ctx.restore(); }
  ctx.fillStyle='#fff3e6'; roundRect(ctx,x,y,w,h,12); ctx.fill();
  ctx.strokeStyle='#c9a76b'; ctx.lineWidth=2; roundRect(ctx,x,y,w,h,12); ctx.stroke();
  ctx.fillStyle='#33264d'; ctx.beginPath(); ctx.arc(cx-6,y+15,3.2,0,6.28); ctx.arc(cx+6,y+15,3.2,0,6.28); ctx.fill();
  ctx.strokeStyle='#33264d'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(cx,y+22,5,0.15*Math.PI,0.85*Math.PI); ctx.stroke();
  const ps=13+(player.charging?player.charge*8:Math.sin(time*4)*1.2);
  ctx.save(); ctx.shadowColor='#ff2e63'; ctx.shadowBlur=14; ctx.fillStyle='#ff2e63'; heartPath(ctx,cx,y+h*0.55-ps*0.5,ps); ctx.fill(); ctx.restore(); }

function drawMonster(mo){ if(mo.y<camY-80||mo.y>camY+H+80||mo.x<camX-80||mo.x>camX+W+80) return;
  const x=mo.x,y=mo.y,w=mo.w,h=mo.h,cx=x+w/2; const bob=Math.sin(mo.bob)*3;
  const hpbar=(yb)=>{ if(mo.maxHp>1){ ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(x,yb,w,4); ctx.fillStyle='#ff2e63'; ctx.fillRect(x,yb,w*clamp(mo.hp/mo.maxHp,0,1),4); } };
  if(mo.kind==='dog'){ const b2=Math.sin(mo.bob)*2; ctx.save(); ctx.shadowColor='#000'; ctx.shadowBlur=12; ctx.fillStyle=mo.hitT>0?'#fff':'#161018';
    roundRect(ctx,x,y+b2+h*0.2,w,h*0.55,8); ctx.fill(); const hx=mo.vx>=0?x+w*0.66:x+w*0.02;
    roundRect(ctx,hx,y+b2,w*0.34,h*0.45,6); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx+w*0.06,y+b2); ctx.lineTo(hx+w*0.01,y+b2-h*0.22); ctx.lineTo(hx+w*0.16,y+b2); ctx.fill();
    for(let i=0;i<4;i++){ const lx=x+w*(0.13+i*0.23), sw=Math.sin(time*14+i)*3; ctx.fillRect(lx,y+b2+h*0.72,w*0.09,h*0.28+sw); }
    ctx.fillStyle='#ff3b6b'; ctx.beginPath(); ctx.arc(hx+(mo.vx>=0?w*0.2:w*0.14),y+b2+h*0.16,w*0.06,0,6.28); ctx.fill(); ctx.restore(); hpbar(y+b2-7); return; }
  if(mo.kind==='sphere'){ const b2=Math.sin(mo.bob)*4, cy=y+b2+h/2; ctx.save(); ctx.shadowColor='#3a0a5a'; ctx.shadowBlur=18;
    ctx.fillStyle=mo.hitT>0?'#fff':'#1a0e2a'; ctx.beginPath(); ctx.arc(cx,cy,w*0.5,0,6.28); ctx.fill(); ctx.strokeStyle='#6a3a9a'; ctx.lineWidth=3; ctx.stroke();
    ctx.fillStyle='#bfe0ff'; ctx.beginPath(); ctx.arc(cx-w*0.16,cy-h*0.05,w*0.08,0,6.28); ctx.arc(cx+w*0.16,cy-h*0.05,w*0.08,0,6.28); ctx.fill();
    ctx.fillStyle='#7fc8ff'; for(let i=0;i<2;i++){ const tx=cx+(i?1:-1)*w*0.16, ty=cy+h*0.08+((time*60)%26); ctx.beginPath(); ctx.arc(tx,ty,3.5,0,6.28); ctx.fill(); }
    if(player.rootT>0 && dist(cx,cy,player.x+player.w/2,player.y+player.h/2)<260){ ctx.strokeStyle='rgba(150,80,210,.6)'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(player.x+player.w/2,player.y+player.h/2); ctx.stroke(); }
    ctx.restore(); hpbar(y+b2-7); return; }
  if(mo.kind==='tentacle'){ ctx.save(); ctx.shadowColor='#2a0a3a'; ctx.shadowBlur=14; const base=mo.y+mo.h, cxv=mo.x+mo.w/2;
    ctx.strokeStyle=mo.hitT>0?'#fff':'#3a1850'; ctx.lineCap='round';
    for(let a=0;a<mo.arms;a++){ const off=(a-(mo.arms-1)/2)*mo.w*0.5/mo.arms; ctx.lineWidth=mo.w*0.22;
      ctx.beginPath(); ctx.moveTo(cxv+off,base); let lx=cxv+off, ly=base; const segs=5, segL=mo.h/segs;
      for(let sg=1;sg<=segs;sg++){ const wob=Math.sin(time*3+mo.sway+a+sg*0.6)*(8+sg*3); lx=cxv+off*0.4+wob; ly=base-sg*segL; ctx.lineTo(lx,ly); } ctx.stroke();
      ctx.fillStyle='#ff3b6b'; ctx.beginPath(); ctx.arc(lx,ly,mo.w*0.12,0,6.28); ctx.fill(); ctx.strokeStyle=mo.hitT>0?'#fff':'#3a1850'; }
    ctx.fillStyle=mo.hitT>0?'#fff':'#241430'; roundRect(ctx,mo.x,base-mo.w*0.5,mo.w,mo.w*0.5,8); ctx.fill(); ctx.restore();
    hpbar(mo.y+Math.sin(mo.bob)*3-7); return; }
  const isBoss=mo.kind==='boss';
  const R=srng(mo.seed), distm=clamp((level-5)/40,0,1);
  const acc=mo.kind==='shooter'?'#b14cff':(mo.kind==='eater'?'#ffcc00':(mo.kind==='beamer'?'#ff2e63':(mo.kind==='spiker'?'#d7dee6':(isBoss?'#ffd166':'#ff3b6b'))));
  const col=mo.hitT>0?'#fff':(isBoss?'#3a0820':'#241430');
  const ccx=cx, ccy=y+bob+h/2, rad=Math.min(w,h)/2;
  const shape=['blob','box','round','star','tear'][Math.floor(R()*5)];
  const eyes=isBoss?2:1+Math.floor(R()*(1+distm*4.5)), melt=R()<distm*0.8, spikes=mo.kind==='spiker'||R()<0.5;
  const rot=isBoss?0:(R()-0.5)*distm*0.8, sx=isBoss?1:1+(R()-0.5)*distm*0.7, sy=isBoss?1:1+(R()-0.5)*distm*0.7;
  ctx.save(); ctx.shadowColor=PAL?PAL.amb:'#9b30ff'; ctx.shadowBlur=isBoss?28:14;
  ctx.translate(ccx,ccy); ctx.rotate(rot); ctx.scale(sx,sy);
  ctx.fillStyle=col; ctx.strokeStyle=isBoss?'#ff2e63':(PAL?PAL.platTop:'#b5179e'); ctx.lineWidth=isBoss?6:3;
  if(shape==='blob') blobPath(ctx,0,0,rad,R,0.5+distm*0.4);
  else if(shape==='box') roundRect(ctx,-rad*0.85,-rad*0.9,rad*1.7,rad*1.8,8);
  else if(shape==='round'){ctx.beginPath();ctx.arc(0,0,rad,0,6.28);}
  else if(shape==='star') starPath(ctx,0,0,rad*1.05,4+Math.floor(R()*3));
  else { ctx.beginPath(); ctx.moveTo(0,-rad*1.05); ctx.quadraticCurveTo(rad,0,0,rad); ctx.quadraticCurveTo(-rad,0,0,-rad*1.05); ctx.closePath(); }
  ctx.fill(); ctx.stroke();
  if(spikes){ ctx.fillStyle=acc; const S=4+Math.floor(R()*5); for(let i=0;i<S;i++){const a=Math.PI*2*i/S;ctx.beginPath();ctx.moveTo(Math.cos(a)*rad,Math.sin(a)*rad);ctx.lineTo(Math.cos(a)*rad*1.4,Math.sin(a)*rad*1.4);ctx.lineTo(Math.cos(a+0.2)*rad,Math.sin(a+0.2)*rad);ctx.fill();} }
  ctx.fillStyle=acc; for(let i=0;i<eyes;i++){const a=R()*6.28,r=rad*0.55*R();ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r-rad*0.1,Math.max(2,rad*0.14),0,6.28);ctx.fill();}
  if(melt){ ctx.fillStyle=col; const M=2+Math.floor(R()*3); for(let i=0;i<M;i++){const mx=(-0.4+R()*0.8)*rad;ctx.beginPath();ctx.arc(mx,rad*0.9,3+R()*3,0,6.28);ctx.fill();ctx.fillRect(mx-2,rad*0.6,4,rad*0.5);} }
  if(mo.kind==='eater'){ ctx.fillStyle='#120010'; roundRect(ctx,-rad*0.5,rad*0.2,rad,rad*0.4,3); ctx.fill(); ctx.fillStyle='#fff'; for(let i=0;i<4;i++){const tx=-rad*0.42+i*rad*0.28;ctx.beginPath();ctx.moveTo(tx,rad*0.2);ctx.lineTo(tx+rad*0.08,rad*0.42);ctx.lineTo(tx+rad*0.16,rad*0.2);ctx.fill();} }
  if(isBoss){ ctx.fillStyle='#ffd166'; ctx.beginPath();ctx.moveTo(-rad*0.5,-rad*0.85);ctx.lineTo(-rad*0.25,-rad*1.15);ctx.lineTo(0,-rad*0.85);ctx.lineTo(rad*0.25,-rad*1.15);ctx.lineTo(rad*0.5,-rad*0.85);ctx.fill(); }
  ctx.restore();
  if(mo.twin){ const R2=srng((mo.seed^0x9e37)>>>0); ctx.save(); ctx.translate(ccx+rad*0.85,ccy+rad*0.25); ctx.scale(0.66,0.66);
    ctx.fillStyle=col; blobPath(ctx,0,0,rad,R2,0.5); ctx.fill(); ctx.strokeStyle=acc; ctx.lineWidth=3; ctx.stroke();
    ctx.fillStyle=acc; ctx.beginPath(); ctx.arc(0,-rad*0.1,Math.max(2,rad*0.16),0,6.28); ctx.fill(); ctx.restore(); }
  hpbar(y+bob-9); }

function drawNPC(n){ if(n.y<camY-60||n.y>camY+H+60||n.x<camX-60||n.x>camX+W+60) return;
  const x=n.x,y=n.y,w=n.w,h=n.h,cx=x+w/2;
  const bob=n.state==='happy'?Math.abs(Math.sin(n.bob))*5:0; let yy=y-bob, xx=x;
  if(n.state==='frozen') xx=x+Math.sin(n.shake*40)*2.5;
  if(n.state==='sad'){
    const def=n.def||{}, sq=(def.shape==='square'), rad=sq?6:Math.min(10,w*0.3);
    if(def.legs){ ctx.strokeStyle='#2a5bd0'; ctx.lineWidth=4; ctx.lineCap='round';
      for(let l=0;l<4;l++){ const lx=xx+w*(0.18+l*0.21), sw=Math.sin(time*9+l*1.4)*6;
        ctx.beginPath(); ctx.moveTo(lx,yy+h-2); ctx.lineTo(lx+sw,yy+h+12); ctx.stroke(); } ctx.lineCap='butt'; }
    ctx.save(); const ccx=cx, ccy=yy+h/2; ctx.translate(ccx,ccy); ctx.rotate(def.rot||0); ctx.translate(-ccx,-ccy);
    ctx.fillStyle='#3d7bff';
    if(def.blob){ blobPath(ctx,ccx,ccy,Math.max(w,h)*0.5,srng(def.seed||1),0.38); } else { roundRect(ctx,xx,yy,w,h,rad); }
    ctx.fill(); ctx.strokeStyle='#13316e'; ctx.lineWidth=2.5; ctx.stroke();
    ctx.fillStyle='#dfeaff';
    if(def.eyes){ const Re=srng(((def.seed||1)^7)>>>0); for(let i=0;i<def.eyes;i++){ const exx=cx+(-0.3+Re()*0.6)*w, eyy=yy+h*0.3+(Re()-0.5)*h*0.2; ctx.beginPath(); ctx.arc(exx,eyy,2.2,0,6.28); ctx.fill(); } }
    else { const ex=Math.max(4,w*0.16), ew=Math.max(3,w*0.10); ctx.fillRect(cx-ex,yy+h*0.34,ew,2.5); ctx.fillRect(cx+ex-ew,yy+h*0.34,ew,2.5); }
    ctx.strokeStyle='#dfeaff'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(cx,yy+h*0.66,Math.max(3,w*0.13),1.15*Math.PI,1.85*Math.PI); ctx.stroke();
    if(def.melt){ ctx.fillStyle='#3d7bff'; const Rm=srng(((def.seed||1)^13)>>>0); for(let i=0;i<3;i++){ const mx=cx+(-0.4+Rm()*0.8)*w; ctx.beginPath(); ctx.arc(mx,yy+h,2.5+Rm()*2,0,6.28); ctx.fill(); ctx.fillRect(mx-2,yy+h*0.7,4,h*0.3); } }
    ctx.restore();
    if(def.twin){ const Rt=srng(((def.seed||1)^0x55)>>>0); ctx.save(); ctx.translate(xx+w*0.5,yy+h*0.3); ctx.scale(0.66,0.66);
      ctx.fillStyle='#3d7bff'; blobPath(ctx,0,0,Math.max(w,h)*0.5,Rt,0.35); ctx.fill(); ctx.strokeStyle='#13316e'; ctx.lineWidth=2.5; ctx.stroke();
      ctx.fillStyle='#dfeaff'; ctx.fillRect(-w*0.12,-h*0.05,3,2); ctx.fillRect(w*0.06,-h*0.05,3,2); ctx.restore(); }
    if(n.phone){ ctx.fillStyle='#11213f'; ctx.fillRect(cx+(n.dir>=0?6:-12),yy+22,7,11);
      ctx.fillStyle='rgba(150,220,255,.95)'; ctx.fillRect(cx+(n.dir>=0?7:-11),yy+23,5,8); }
  } else if(n.state==='frozen'){ const t=1-n.freezeT/FREEZE_TIME;
    ctx.save(); ctx.shadowColor='#fff'; ctx.shadowBlur=10+t*24; ctx.fillStyle=Math.sin(time*30)>0?'#ffb3d1':'#ff8fab'; roundRect(ctx,xx,yy,w,h,10); ctx.fill(); ctx.restore();
    ctx.fillStyle='#ff0a54'; heartPath(ctx,cx-7,yy+12,8); ctx.fill(); heartPath(ctx,cx+7,yy+12,8); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center'; ctx.fillText(Math.ceil(n.freezeT),cx,yy-6);
  } else {
    ctx.fillStyle=n.grace>0?'#ffc4d6':(n.holding?'#b9f5c9':'#ff8fab'); roundRect(ctx,xx,yy,w,h,10); ctx.fill();
    ctx.strokeStyle=n.holding?'#2e8b57':'#c23a63'; ctx.lineWidth=2; roundRect(ctx,xx,yy,w,h,10); ctx.stroke();
    ctx.fillStyle='#ff0a54'; heartPath(ctx,cx-7,yy+12,8); ctx.fill(); heartPath(ctx,cx+7,yy+12,8); ctx.fill();
    if(n.holding){ ctx.save(); ctx.shadowColor='#ff2e63'; ctx.shadowBlur=10; ctx.fillStyle='#ff2e63'; heartPath(ctx,cx,yy-16,16); ctx.fill(); ctx.restore(); } }
}

function drawIndicators(){
  const targets=[];
  if(cfg.type==='love'){ for(const n of npcs) if(n.state==='sad') targets.push({x:n.x+n.w/2,y:n.y+n.h/2,icon:'😔',col:'#7fb0ff'});
    for(const mo of monsters) targets.push({x:mo.x+mo.w/2,y:mo.y+mo.h/2,icon:'👹',col:'#ff5d8f'}); }
  else if(rock) targets.push({x:rock.x+rock.w/2,y:rock.y+rock.h/2,icon:'🪨',col:'#ff8fab'});
  const m=26;
  for(const t of targets){ const sx=t.x-camX, sy=t.y-camY;
    if(sx>=0&&sx<=W&&sy>=0&&sy<=H) continue;
    const cxs=clamp(sx,m,W-m), cys=clamp(sy,m,H-m);
    ctx.save(); ctx.globalAlpha=.8; ctx.fillStyle=t.col; ctx.font='18px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(t.icon,cxs,cys); ctx.restore(); }
}

const amorFill=document.getElementById('amorFill'), stamFill=document.getElementById('stamFill');
const countEl=document.getElementById('count'), objEl=document.getElementById('obj'), overlay=document.getElementById('overlay');
function jumpLabel(){ return player.maxJumps>=3?'pulo triplo':(player.maxJumps>=2?'pulo duplo':'pulo simples'); }
function hpStr(){ return '❤'.repeat(Math.max(0,player.hp))+'·'.repeat(Math.max(0,player.maxHp-player.hp)); }
function setObjective(){ const m = mode==='infinite' ? 'INFINITO · recorde '+deepest : 'AVENTURA · vidas '+lives;
  objEl.innerHTML=m+'<br>'+cfg.label; }
function powerLabel(){ if(!player||!player.powers||!player.powers.length) return (player&&player.bonus)?' · ⭐ bônus +'+player.bonus:'';
  const P=ACTIVE_POWERS[player.powers[player.equip]]; return ' · ★ '+P.name+' ('+P.cost+')'+(player.powers.length>1?' ⇄':'')+(player.bonus?' · ⭐+'+player.bonus:''); }
function updateHUD(){ const life='HP '+hpStr();
  if(cfg.type==='love'){ const sad=npcs.filter(n=>n.state==='sad').length;
    const vel=Math.round(Math.min(player.conv*CONV_SPEED,CONV_SPEED_CAP)*100);
    countEl.innerHTML='💕 '+(totalSad0-sad)+' / '+totalSad0+'<small>'+life+' · '+sad+' tristes'+(monsters.length?' · 👹'+monsters.length:'')+'<br>⚡ '+jumpLabel()+' · vel +'+vel+'%'+powerLabel()+'</small>'; }
  else countEl.innerHTML='🪨 '+(rock?rock.fill:0)+' / '+(rock?rock.target:0)+'<small>'+life+' · 💖 '+carrying+' carregando'+powerLabel()+'</small>'; }
function checkWinLove(){ if(cfg.type==='love'&&state==='play'&&npcs.every(n=>n.state!=='sad')&&monsters.length===0) levelClear(); }

function levelClear(){ state='end'; overlay.classList.remove('hidden');
  beep(660,0.2,'sine',0.07); setTimeout(()=>beep(990,0.3,'sine',0.06),140);
  deepest=Math.max(deepest,level+1);
  try{ if(typeof localStorage!=='undefined') localStorage.setItem(SAVE_KEY, JSON.stringify({mode,level:Math.min(level+1,LEVEL_CAP),lives,deepest,deaths,seed:runSeed,ts:Date.now()})); }catch(e){}
  if(level>=LEVEL_CAP){ clearProgress(); overlay.innerHTML='<h1>🌟 1000 NÍVEIS! 🌟</h1><p>Você atravessou toda a distorção e apaixonou o universo inteiro. Lenda! 💖</p>'+
      '<button id="b">RECOMEÇAR</button>'; document.getElementById('b').onclick=()=>{lives=3;startLevel(1);}; return; }
  const msg = cfg.type==='collect' ? 'A Pedra encheu e nasceram corações felizes!' : 'Você apaixonou todo mundo!';
  overlay.innerHTML='<h1>💞 NÍVEL '+level+' OK 💞</h1><p>'+msg+'</p>'+
    '<button id="b">NÍVEL '+(level+1)+' →</button>';
  document.getElementById('b').onclick=()=>startLevel(level+1); }

function die(){ state='end'; overlay.classList.remove('hidden'); beep(120,0.4,'sawtooth',0.08);
  if(mode==='adventure'){ lives--;
    if(lives>0){ saveProgress(); overlay.innerHTML='<h1>💔 VOCÊ CAIU</h1><p>Vidas restantes: '+'❤'.repeat(lives)+'</p>'+
        '<button id="b">DE NOVO (nível '+level+')</button>'; document.getElementById('b').onclick=()=>startLevel(level); }
    else { clearProgress(); overlay.innerHTML='<h1>☠️ FIM DA RUN</h1><p>Acabaram as 3 vidas. Você chegou ao nível '+level+'. Voltando ao começo!</p>'+
        '<button id="b">NÍVEL 1</button>'; document.getElementById('b').onclick=()=>{lives=3;startLevel(1);}; } }
  else { deaths++; deepest=Math.max(deepest,level); saveProgress();
    overlay.innerHTML='<h1>💀 INFINITO</h1><p>Você caiu no nível '+level+' (mortes: '+deaths+'). Continue de onde parou!</p>'+
      '<button id="b">CONTINUAR (nível '+level+')</button>'; document.getElementById('b').onclick=()=>startLevel(level); } }

let tutorialShown=false;
function showTutorial(go){ overlay.classList.remove('hidden');
  overlay.innerHTML='<h1>COMO JOGAR</h1>'+
    '<div style="text-align:left;max-width:580px;margin:0 auto 12px;line-height:1.5">'+
    '<p><b>🎯 Objetivo:</b> segure <b>❤</b> pra soltar uma <b>explosão de amor</b> 💥 que transforma os <b>tristes</b> (azuis) em <b>apaixonados</b> (rosa). Nos níveis de <b>coleta</b>, leve os corações fujões até a <b>pedra/máquina</b>. Quando houver <b>monstros</b>, apaixone todos <b>e</b> derrote os monstros.</p>'+
    '<div style="background:rgba(127,224,255,.08);border-radius:10px;padding:10px 12px;margin:8px 0">'+
      '<h3 style="margin:0 0 4px;color:#7fe0ff">📱 No celular</h3>'+
      '<p style="margin:0">Encoste e arraste em qualquer lugar = <b>joystick</b> (anda pros lados).<br>Com um 2º dedo: <b>↑ pulo</b> · <b>↓ barreira</b> 🧱 · segure <b>❤</b> = explosão 💥<br><b>★</b> usa o poder · <b>⇄</b> troca · <b>✨</b> Amor Divino (quando a barra enche).</p></div>'+
    '<div style="background:rgba(255,143,171,.08);border-radius:10px;padding:10px 12px;margin:8px 0">'+
      '<h3 style="margin:0 0 4px;color:#ff8fab">💻 No PC</h3>'+
      '<p style="margin:0"><b>← →</b> andar · <b>↑</b> pular (duplo/triplo nos níveis altos) · <b>ESPAÇO</b> explosão 💥 · <b>↓</b> barreira 🧱<br><b>E</b> usa poder · <b>Q</b> troca poder · <b>F</b> Amor Divino ✨</p></div>'+
    '<div style="background:rgba(255,46,99,.10);border-radius:10px;padding:10px 12px;margin:8px 0">'+
      '<h3 style="margin:0 0 4px;color:#ff5d8f">⚠️ Cuidado</h3>'+
      '<p style="margin:0"><b>Monstros</b> (a partir do nível 6) te <b>machucam</b> ao encostar — apaixone todos <b>e</b> derrote os monstros pra passar. E olha: até os <b>apaixonados</b> (rosa) te <b>machucam</b> se você ficar grudado neles! Apaixonou, <b>siga em frente</b>. Na <b>coleta</b>, os corações <b>fogem e pulam</b> — encurrale e leve até a <b>máquina</b> no centro.</p></div>'+
    '<p class="hint" style="margin:6px 0 0">Dica: a barra de baixo é a <b>energia</b> da explosão — espere encher pra soltar de novo.</p>'+
    '</div><div><button id="tgo">COMEÇAR ▶</button></div>';
  document.getElementById('tgo').onclick=()=>{ tutorialShown=true; go(); };
}
function showMenu(){ overlay.classList.remove('hidden');
  const sv=loadProgress();
  const intro='<p>Escale a montanha cheia de plataformas e apaixone todo mundo. Os <b>5 primeiros níveis</b> são feitos à mão; do <b>6 em diante</b> os níveis são <b>gerados aleatoriamente</b>, cada um mais difícil que o anterior.</p>';
  const hint = '<p class="hint">Os controles aparecem no <b>tutorial</b>, ao iniciar.</p>';
  const cont = (sv && sv.level) ? '<button id="cont">▶ CONTINUAR · nível '+sv.level+' ('+(sv.mode==='infinite'?'Infinito':'Aventura')+')</button>' : '';
  overlay.innerHTML='<h1>AMOR EXPLOSIVO</h1>'+intro+hint+
    (cont?'<p class="hint">Seu progresso fica salvo neste aparelho:</p><div>'+cont+'</div>':'')+
    '<p style="opacity:.85;font-size:14px">Novo jogo:</p>'+
    '<div><button id="adv">AVENTURA · 3 vidas</button><button id="inf" class="alt">INFINITO · continua</button></div>'+
    (cont?'<p><a class="clr" id="clr">apagar progresso salvo</a></p>':'');
  if(cont){ const c=document.getElementById('cont'); c.onclick=()=>{ mode=sv.mode||'adventure'; lives=sv.lives||3; deepest=sv.deepest||sv.level; deaths=sv.deaths||0; if(sv.seed!=null)runSeed=sv.seed>>>0; startLevel(sv.level); };
    const cl=document.getElementById('clr'); if(cl) cl.onclick=()=>{ clearProgress(); showMenu(); }; }
  document.getElementById('adv').onclick=()=>{ const go=()=>{ mode='adventure'; lives=3; deaths=0; deepest=1; runSeed=(Date.now()^(Math.random()*1e9))>>>0; startLevel(1); }; tutorialShown?go():showTutorial(go); };
  document.getElementById('inf').onclick=()=>{ const go=()=>{ mode='infinite'; deaths=0; deepest=1; runSeed=(Date.now()^(Math.random()*1e9))>>>0; startLevel(1); }; tutorialShown?go():showTutorial(go); }; }

function setKey(e,down){ const k=e.key.toLowerCase();
  if(down && introT>0 && state==='play'){ introT=0; e.preventDefault(); return; }   // pula o objetivo
  if(k==='arrowleft'||k==='a') keys.left=down;
  else if(k==='arrowright'||k==='d') keys.right=down;
  else if(k==='arrowup'||k==='w') keys.jump=down;
  else if(k==='arrowdown'||k==='s'){ e.preventDefault(); if(down&&state==='play') placeWall(); }
  else if(k===' '||k==='spacebar'){ e.preventDefault();
    if(down) keys.charge=true;
    else { if(keys.charge&&state==='play'&&player.charging&&player.stam>=player.blastCost) fireBlast();
           keys.charge=false; player.charging=false; player.charge=0; } }
  else if(k==='e'&&down){ e.preventDefault(); usePower(); }
  else if(k==='q'&&down){ e.preventDefault(); cyclePower(); }
  else if(k==='f'&&down){ e.preventDefault(); fireDivine(); }
  else if(k==='r'&&down) startLevel(level); }
window.addEventListener('keydown',e=>setKey(e,true));
window.addEventListener('keyup',e=>setKey(e,false));
function bindTouch(id,on,off){ const el=document.getElementById(id); if(!el)return;
  const p=e=>{e.preventDefault();e.stopPropagation();on();}, r=e=>{e.preventDefault();e.stopPropagation();off();};
  el.addEventListener('touchstart',p,{passive:false}); el.addEventListener('touchend',r,{passive:false});
  el.addEventListener('touchcancel',r,{passive:false});
  el.addEventListener('mousedown',p); el.addEventListener('mouseup',r); el.addEventListener('mouseleave',r); }

// ===== Controles de toque (celular): joystick flutuante + 2º dedo p/ pular/barreira =====
let joy=null, gesture=null, jumpQueued=false;
const JOY_R=64, JOY_DZ=15, SWIPE=30;
function requestJump(){ jumpQueued=true; }
function onCharge(){ keys.charge=true; }
function offCharge(){ if(keys.charge&&state==='play'&&player.charging&&player.stam>=player.blastCost) fireBlast();
  keys.charge=false; player.charging=false; player.charge=0; }
bindTouch('bCharge', onCharge, offCharge);   // ❤ explosão (segura e solta)
bindTouch('bPow', ()=>usePower(), ()=>{});   // ★ usar poder equipado
bindTouch('bCyc', ()=>cyclePower(), ()=>{}); // ⇄ trocar poder
bindTouch('bDiv', ()=>fireDivine(), ()=>{}); // ✨ Amor Divino (aparece com a barra cheia)

if(MOBILE){
  const wrap=document.getElementById('wrap');
  const onUI=t=>!!(t.target&&t.target.closest&&(t.target.closest('#touch')||t.target.closest('#overlay')||t.target.closest('button')));
  wrap.addEventListener('touchstart',e=>{
    if(state!=='play') return;                       // menu/botões livres
    let used=false;
    for(const t of e.changedTouches){ if(onUI(t))continue;
      if(!joy){ joy={id:t.identifier, ox:t.clientX, oy:t.clientY, x:t.clientX, y:t.clientY}; used=true; }
      else if(!gesture && t.identifier!==joy.id){ gesture={id:t.identifier, sy:t.clientY, did:null}; used=true; } }
    if(used) e.preventDefault();
  },{passive:false});
  wrap.addEventListener('touchmove',e=>{
    if(state!=='play') return;
    let used=false;
    for(const t of e.changedTouches){
      if(joy && t.identifier===joy.id){ used=true;
        let dx=t.clientX-joy.ox, dy=t.clientY-joy.oy; const m=Math.hypot(dx,dy);
        if(m>JOY_R){ dx*=JOY_R/m; dy*=JOY_R/m; }
        joy.x=joy.ox+dx; joy.y=joy.oy+dy;
        keys.left=dx<-JOY_DZ; keys.right=dx>JOY_DZ;
      } else if(gesture && t.identifier===gesture.id){ used=true;
        const dy=t.clientY-gesture.sy;
        if(dy<-SWIPE && gesture.did!=='up'){ requestJump(); gesture.did='up'; }       // 2º dedo p/ cima = pulo
        else if(dy>SWIPE && gesture.did!=='down'){ if(state==='play')placeWall(); gesture.did='down'; } // p/ baixo = barreira
        else if(Math.abs(dy)<10){ gesture.did=null; }   // voltou ao centro → pode repetir (pulo duplo/triplo)
      }
    }
    if(used) e.preventDefault();
  },{passive:false});
  const endTouch=e=>{ for(const t of e.changedTouches){
      if(joy && t.identifier===joy.id){ joy=null; keys.left=keys.right=false; }
      else if(gesture && t.identifier===gesture.id) gesture=null; } };
  wrap.addEventListener('touchend',endTouch,{passive:false});
  wrap.addEventListener('touchcancel',endTouch,{passive:false});
}

let last=performance.now();
function loop(now){ let dt=(now-last)/1000; last=now; dt=Math.min(dt,0.05);
  if(state==='play'){ if(introT>0 && !globalThis.__SKIP_INTRO){ introT-=dt; } else { update(dt); } }
  if(player) draw(); requestAnimationFrame(loop); }
resize(); buildLevel(1); state='end'; showMenu(); requestAnimationFrame(loop);
})();
