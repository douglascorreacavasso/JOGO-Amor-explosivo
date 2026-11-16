// ===== ROBÔ DE ESTRESSE: ~200 mil variações (sem navegador) =====
// Uso: node _stress_200k.js [total=200000] [saida.json]
// A (60%) geração: níveis 1..1000 × sementes — topo alcançável, faixa ≤ pulo, tudo dentro do mundo, rótulos, regras conhecidas, mesma semente = mesmo mundo
// B (20%) partidas de 150 passos com teclas ao acaso (níveis 1..400, dois modos) — sem NaN, sem atravessar o chão, HP/energia nos limites, listas com teto, desenho sem erro
// C (20%) telas/saves: mesmo mundo em 5 telas × 4 densidades, salvar/continuar, save estragado, vitória salva o próximo, derrota sem vida negativa, R fora do jogo, pausa solta teclas
const fs=require('fs');
const TOTAL=+(process.argv[2]||200000), OUT=process.argv[3]||'';
function stubCtx(){ const g={addColorStop(){}}; return new Proxy({}, {get(_t,k){
  if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern') return ()=>g;
  if(k==='measureText') return ()=>({width:10}); if(k==='canvas') return {width:0,height:0};
  if(k==='getImageData') return ()=>({data:new Uint8ClampedArray(4)}); return ()=>{}; }}); }
const styleObj=()=>new Proxy({}, {get(){return '';}, set(){return true;}});
const ELS={}; let SCR={w:1280,h:720};
function stubEl(id){ let html=''; const o={ id, style:styleObj(), dataset:{}, classList:{add(){},remove(){},toggle(){},contains(){return false;}},
  querySelector(){return null;}, querySelectorAll(){return [];}, set innerHTML(v){html=String(v);}, get innerHTML(){return html;},
  addEventListener(){}, getContext(){return stubCtx();}, width:0, height:0, onclick:null, closest(){return null;}, focus(){}, click(){ if(o.onclick) o.onclick(); } };
  if(id==='game'){ Object.defineProperty(o,'clientWidth',{get(){return SCR.w;}}); Object.defineProperty(o,'clientHeight',{get(){return SCR.h;}}); }
  else { o.clientWidth=1280; o.clientHeight=720; } return o; }
const el=id=>ELS[id]||(ELS[id]=stubEl(id));
const WL={};
global.document={ body:{dataset:{platform:'desktop'},classList:{add(){},remove(){},toggle(){}}}, getElementById:el, addEventListener(){}, createElement(){return stubEl('_');}, hidden:false };
global.window={ addEventListener(t,f){ (WL[t]=WL[t]||[]).push(f); }, devicePixelRatio:1, innerWidth:1280, innerHeight:720, visualViewport:null };
global.navigator={ userAgent:'node', maxTouchPoints:0 };
let STORE={}; global.localStorage={ getItem(k){return k in STORE?STORE[k]:null;}, setItem(k,v){STORE[k]=String(v);}, removeItem(k){delete STORE[k];} };
global.performance={ now(){ return Number(process.hrtime.bigint()/1000n)/1000; } };
global.requestAnimationFrame=()=>{};
let src=fs.readFileSync(__dirname+'/game.js','utf8');
src=src.replace(/\}\)\(\);\s*$/, `; globalThis.__AE={ buildLevel, startLevel, computeReachable, update, draw, resize, showMenu, saveProgress, loadProgress, pauseGame, levelClear, die, newGame,
  MUTATORS, LEVEL_CAP, SAVE_KEY, MAX_FALL, MAX_STAM, keys, Q,
  get platforms(){return platforms;}, get cfg(){return cfg;}, get npcs(){return npcs;}, get monsters(){return monsters;}, get rock(){return rock;}, get M(){return M;},
  get WORLD_W(){return WORLD_W;}, get WORLD_H(){return WORLD_H;}, get JUMP_Hc(){return JUMP_Hc;}, get groundY(){return groundY;}, get phBandH(){return phBandH;},
  get player(){return player;}, get particles(){return particles;}, get pHearts(){return pHearts;}, get shots(){return shots;}, get walls(){return walls;},
  get state(){return state;}, set state(v){state=v;}, get level(){return level;}, get lives(){return lives;}, set lives(v){lives=v;}, get mode(){return mode;}, set mode(v){mode=v;},
  get runSeed(){return runSeed;}, set runSeed(v){runSeed=v>>>0;}, get overlayHTML(){return overlay.innerHTML;} }; })();`);
eval(src);
const AE=globalThis.__AE, KEY=AE.SAVE_KEY;
let rs=987654321; const R=()=>{ rs^=rs<<13; rs^=rs>>>17; rs^=rs<<5; return (rs>>>0)/4294967296; };
const RI=(a,b)=>a+((R()*(b-a+1))|0);
const fire=(type,key,repeat)=>{ for(const f of (WL[type]||[])) f({key, repeat:!!repeat, preventDefault(){}}); };
function worldHash(){ let h=2166136261; const mix=v=>{ h^=(Math.round(v*10)|0); h=Math.imul(h,16777619); };
  for(const p of AE.platforms){ mix(p.x); mix(p.y); mix(p.w); } for(const n of AE.npcs){ mix(n.x); mix(n.y); } for(const m of AE.monsters){ mix(m.x); mix(m.y); }
  mix(AE.WORLD_W); mix(AE.WORLD_H); return h>>>0; }
const cnt={A:0,B:0,C:0}, falhas={A:0,B:0,C:0}, ex={A:[],B:[],C:[]};
const perf={build:0,buildN:0,buildMax:0,upd:0,updN:0,updMax:0,maxPlats:0};
function fail(g,caso,msg){ falhas[g]++; if(ex[g].length<25) ex[g].push(caso+': '+msg); }
function build(n){ const t=performance.now(); AE.buildLevel(n); const d=performance.now()-t; perf.build+=d; perf.buildN++; if(d>perf.buildMax) perf.buildMax=d; perf.maxPlats=Math.max(perf.maxPlats,AE.platforms.length); }
const finite=v=>typeof v==='number'&&isFinite(v);

// ---------- A: geração ----------
function testA(i){ const n=1+(i%1000), seed=(Math.floor(i/1000)*2654435761+12345)>>>0; AE.runSeed=seed; build(n);
  const c='A L'+n+' s'+seed;
  const ps=AE.platforms, r=AE.computeReachable(), top=AE.groundY-(AE.groundY-110)*0.75; let tt=0,tr=0;
  ps.forEach((p,k)=>{ if(p.band===99) return; if(p.y<=top){ tt++; if(r[k]) tr++; } });
  if(tt>0 && tr===0) fail('A',c,'topo inalcançável');
  if(!(AE.phBandH<=AE.JUMP_Hc)) fail('A',c,'faixa '+AE.phBandH.toFixed(0)+' > pulo '+AE.JUMP_Hc.toFixed(0));
  for(const p of ps){ if(!finite(p.x)||!finite(p.y)||!(p.w>0)) { fail('A',c,'plataforma inválida'); break; } }
  for(const o of AE.npcs.concat(AE.monsters)){ if(!(o.x>=-1 && o.x+o.w<=AE.WORLD_W+1 && o.y>=-1 && o.y<=AE.groundY+1)){ fail('A',c,'fora do mundo: '+(o.kind||'triste')+' x='+o.x.toFixed(0)); break; } }
  const rk=AE.rock; if(rk && !(rk.x>=0 && rk.x+rk.w<=AE.WORLD_W)) fail('A',c,'Máquina fora do mundo');
  const lb=(AE.cfg&&AE.cfg.label)||''; if(!lb || /undefined|NaN|null/.test(lb)) fail('A',c,'rótulo estranho "'+lb+'"');
  for(const t of (AE.M.tags||[])) if(!AE.MUTATORS[t]) fail('A',c,'regra sem explicação: '+t);
  if(i%10===0){ const h=worldHash(); build(n); if(worldHash()!==h) fail('A',c,'mesma semente gerou outro mundo'); }
}
// ---------- B: partidas com robô ----------
const KEYS=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','e','q','f','p','Escape','r','Enter'];
function testB(i){ const n=1+(i%400); AE.mode=(i%2)?'infinite':'adventure'; AE.lives=3; AE.runSeed=(i*7919)>>>0;
  globalThis.__SKIP_INTRO=true; AE.startLevel(n); const c='B L'+n+' '+AE.mode;
  const held={};
  try{
    for(let s=0;s<150;s++){
      if(R()<0.18){ const k=KEYS[RI(0,KEYS.length-1)]; const down=!held[k]||R()<0.3; fire(down?'keydown':'keyup',k,down&&held[k]); held[k]=down; }
      if(AE.state==='pause' && R()<0.3) fire('keydown','Escape');
      if(AE.state!=='play'){ if(R()<0.5){ globalThis.__SKIP_INTRO=true; AE.startLevel(n); } continue; }
      const t=performance.now(); AE.update(1/60); const d=performance.now()-t; perf.upd+=d; perf.updN++; if(d>perf.updMax) perf.updMax=d;
      if(s%5===0) AE.draw(1);
      const p=AE.player;
      if(!finite(p.x)||!finite(p.y)||!finite(p.vx)||!finite(p.vy)){ fail('B',c,'NaN no jogador (passo '+s+')'); break; }
      if(p.y+p.h>AE.groundY+2){ fail('B',c,'atravessou o chão y='+p.y.toFixed(1)); break; }
      if(p.vy>AE.MAX_FALL+0.01){ fail('B',c,'queda acima do limite '+p.vy.toFixed(1)); break; }
      if(!(p.hp>=0 && p.hp<=p.maxHp)){ fail('B',c,'HP fora '+p.hp+'/'+p.maxHp); break; }
      if(!(p.stam>=-0.01 && p.stam<=AE.MAX_STAM+0.01)){ fail('B',c,'energia fora '+p.stam); break; }
      if(AE.particles.length>400 || AE.pHearts.length>40 || AE.shots.length>200){ fail('B',c,'lista sem teto p='+AE.particles.length+' c='+AE.pHearts.length+' s='+AE.shots.length); break; }
      if(AE.lives<0){ fail('B',c,'vidas negativas'); break; }
    }
  }catch(e){ fail('B',c,'ERRO '+e.message+' '+((e.stack||'').split('\n')[1]||'').trim()); }
  for(const k in held) if(held[k]) fire('keyup',k);
  AE.keys.left=AE.keys.right=AE.keys.jump=AE.keys.charge=false;
}
// ---------- C: telas e saves ----------
const SIZES=[[1280,720],[1920,1080],[844,390],[390,844],[2560,1080]], DPRS=[1,1.5,2,3];
const BAD=['','{','null','[]','{"level":"x"}','{"level":-3}','{"level":1e99}','{"level":7,"seen":"x","lives":-9,"deepest":1e12}','{"level":"5","seed":"z"}','\u0000'];
function testC(i){ const kind=i%6, n=1+((i*37)%600); const c='C'+kind+' L'+n;
  try{
    if(kind===0){ AE.runSeed=i*31; SCR={w:1280,h:720}; window.devicePixelRatio=1; AE.resize(true); build(n); const h0=worldHash();
      const [w,hh]=SIZES[i%5]; SCR={w,h:hh}; window.devicePixelRatio=DPRS[(i>>3)%4]; AE.resize(true); build(n);
      if(worldHash()!==h0) fail('C',c,'tela '+w+'x'+hh+' gerou outro mundo');
      SCR={w:1280,h:720}; window.devicePixelRatio=1; AE.resize(true); }
    else if(kind===1){ STORE={}; AE.mode=(i%2)?'infinite':'adventure'; AE.lives=1+(i%3); AE.runSeed=i*13; globalThis.__SKIP_INTRO=true; AE.startLevel(n);
      const h0=worldHash(), lv=AE.level, md=AE.mode, li=AE.lives; AE.saveProgress(); AE.runSeed=12345; AE.showMenu(); el('cont').onclick();
      if(AE.level!==lv||AE.mode!==md||AE.lives!==li) fail('C',c,'continuar mudou nível/modo/vidas');
      if(worldHash()!==h0) fail('C',c,'continuar gerou outro mundo'); }
    else if(kind===2){ STORE={[KEY]:BAD[i%BAD.length]}; AE.showMenu(); if(el('cont').onclick && AE.overlayHTML.indexOf('id="cont"')>=0){ el('cont').onclick(); if(AE.state!=='play') fail('C',c,'save estragado não abriu'); for(let s=0;s<20;s++) AE.update(1/60); } }
    else if(kind===3){ STORE={}; AE.mode='adventure'; AE.lives=3; globalThis.__SKIP_INTRO=true; AE.startLevel(Math.min(n,999)); const lv=AE.level; AE.levelClear();
      const sv=AE.loadProgress(); if(!sv||sv.level!==lv+1) fail('C',c,'vitória não salvou o próximo nível ('+(sv&&sv.level)+')'); }
    else if(kind===4){ AE.mode='adventure'; AE.lives=1+(i%3); globalThis.__SKIP_INTRO=true; AE.startLevel(n); AE.die(); AE.die();
      if(AE.lives<0) fail('C',c,'vidas negativas'); if(AE.lives===0 && AE.loadProgress()) fail('C',c,'sem vidas mas save ficou'); }
    else { AE.showMenu(); const st=AE.state; fire('keydown','r'); fire('keyup','r'); if(AE.state!==st) fail('C',c,'R fora do jogo mudou o estado');
      globalThis.__SKIP_INTRO=true; AE.startLevel(n); fire('keydown','ArrowRight'); fire('keydown','ArrowUp'); fire('keydown',' '); AE.pauseGame();
      if(AE.keys.left||AE.keys.right||AE.keys.jump||AE.keys.charge) fail('C',c,'pausa não soltou as teclas');
      fire('keyup','ArrowRight'); fire('keyup','ArrowUp'); fire('keyup',' '); }
  }catch(e){ fail('C',c,'ERRO '+e.message+' '+((e.stack||'').split('\n')[1]||'').trim()); }
}
const t0=Date.now(); const nA=Math.round(TOTAL*0.6), nB=Math.round(TOTAL*0.2), nC=TOTAL-nA-nB;
for(let i=0;i<nA;i++){ testA(i); cnt.A++; if(i%20000===0) console.log('A',i,'falhas',falhas.A, ((Date.now()-t0)/1000|0)+'s'); }
for(let i=0;i<nB;i++){ testB(i); cnt.B++; if(i%5000===0) console.log('B',i,'falhas',falhas.B, ((Date.now()-t0)/1000|0)+'s'); }
for(let i=0;i<nC;i++){ testC(i); cnt.C++; if(i%5000===0) console.log('C',i,'falhas',falhas.C, ((Date.now()-t0)/1000|0)+'s'); }
const res={ quando:new Date().toISOString(), segundos:Math.round((Date.now()-t0)/1000), total:cnt.A+cnt.B+cnt.C, cnt, falhas, exemplos:ex,
  desempenho:{ build_ms_medio:+(perf.build/perf.buildN).toFixed(3), build_ms_max:+perf.buildMax.toFixed(2), update_ms_medio:+(perf.upd/Math.max(1,perf.updN)).toFixed(4),
    update_ms_max:+perf.updMax.toFixed(2), passos:perf.updN, max_plataformas:perf.maxPlats } };
console.log(JSON.stringify(res,null,1)); if(OUT) fs.writeFileSync(OUT, JSON.stringify(res,null,1));
process.exitCode=(falhas.A+falhas.B+falhas.C)?1:0;
