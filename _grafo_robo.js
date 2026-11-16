// ===== ROBÔ DE CENÁRIOS → GRAFO DE EXPERIÊNCIA (Claude, 15/11/2026) =====
// Joga sozinho milhares de cenários (headless, Node) e alimenta o grafo_experiencia.js.
// O robô é um jogador simples (vai até o triste mais perto, pula, carrega e solta a explosão, usa poderes);
// a experiência que ele gera fica marcada como "robô" na origem do arquivo exportado.
// Uso:  node _grafo_robo.js [partidas=300] [saida=experiencia_robo.json] [passos=900]
const fs=require('fs');
const PART=parseInt(process.argv[2]||'300'), SAIDA=process.argv[3]||'experiencia_robo.json', PASSOS=parseInt(process.argv[4]||'900');
function stubCtx(){ const g={addColorStop(){}}; return new Proxy({},{get(t,k){ if(k==='createLinearGradient'||k==='createRadialGradient') return ()=>g; if(k==='measureText') return ()=>({width:10});
  if(t[k]!==undefined) return t[k]; return ()=>{}; }, set(t,k,v){ t[k]=v; return true; }}); }
const so=()=>new Proxy({},{get(){return '';},set(){return true;}}), els={};
function el(){ const e={style:so(),dataset:{},className:'',_c:new Set(),classList:{add(c){e._c.add(c);},remove(c){e._c.delete(c);},toggle(){},contains(c){return e._c.has(c);}},
  innerHTML:'',querySelector(){return null;},addEventListener(){},getContext(){return stubCtx();},clientWidth:1280,clientHeight:720,width:0,height:0,onclick:null,closest(){return null;},remove(){},click(){}}; return e; }
const cv=el();
global.document={body:{dataset:{platform:'desktop'},classList:{add(){},remove(){},toggle(){}},appendChild(){}},getElementById(id){ return id==='game'?cv:(els[id]||(els[id]=el())); },addEventListener(){},createElement(){return el();},hidden:false};
global.window={addEventListener(){},devicePixelRatio:1,innerWidth:1280,innerHeight:720,visualViewport:null};
global.navigator={userAgent:'node',maxTouchPoints:0};
const mem={}; global.localStorage={getItem(k){return k in mem?mem[k]:null;},setItem(k,v){mem[k]=String(v);},removeItem(k){delete mem[k];}};
global.performance={now(){return Number(process.hrtime.bigint()/1000n)/1000;}};
global.requestAnimationFrame=()=>{}; global.setInterval=()=>0; global.setTimeout=()=>0; global.__SKIP_INTRO=true;
eval(fs.readFileSync(__dirname+'/grafo_experiencia.js','utf8'));
let src=fs.readFileSync(__dirname+'/game.js','utf8');
src=src.replace(/\}\)\(\);\s*$/, `; globalThis.__AE={ startLevel, update, setKey, get player(){return player;}, get npcs(){return npcs;}, get monsters(){return monsters;}, get fhearts(){return fhearts;}, get rock(){return rock;},
  get cfg(){return cfg;}, get state(){return state;}, get carrying(){return carrying;}, get level(){return level;}, set mode(v){mode=v;}, set lives(v){lives=v;}, set runSeed(v){runSeed=v;} };\n})();`);
eval(src);
const AE=globalThis.__AE, G=globalThis.AE_GRAFO; G.origem('simulacao_propria');   // proveniência: o jogo tentando sozinho
const key=(k,d)=>AE.setKey({key:k,preventDefault(){},repeat:false},d);
let rs=7; const R=()=>{ rs=(rs*1103515245+12345)&0x7fffffff; return rs/0x7fffffff; };
const placar={vitoria:0,derrota:0,tempo_esgotado:0,erros:0};
const t0=Date.now();
for(let p=0;p<PART;p++){
  const n=R()<0.5?1+Math.floor(R()*12):1+Math.floor(R()*60);
  AE.runSeed=(R()*4e9)>>>0; AE.mode=R()<0.2?'infinite':'adventure'; AE.lives=3;
  try{ AE.startLevel(n); }catch(e){ placar.erros++; continue; }
  let carga=0, puloT=0, fim=null;
  for(let s=0;s<PASSOS && !fim;s++){
    const pl=AE.player, pcx=pl.x+pl.w/2, pcy=pl.y+pl.h/2; let alvo=null, md=1e9;
    if(AE.cfg.type==='love'){ for(const m of AE.npcs) if(m.state==='sad'){ const d=Math.hypot(m.x+m.w/2-pcx,m.y+m.h/2-pcy); if(d<md){md=d;alvo={x:m.x+m.w/2,y:m.y+m.h/2};} }
      if(!alvo) for(const m of AE.monsters){ const d=Math.hypot(m.x+m.w/2-pcx,m.y+m.h/2-pcy); if(d<md){md=d;alvo={x:m.x+m.w/2,y:m.y+m.h/2};} } }
    else { if(AE.carrying>=3 && AE.rock) alvo={x:AE.rock.x+AE.rock.w/2,y:AE.rock.y}; else for(const h of AE.fhearts){ const d=Math.hypot(h.x-pcx,h.y-pcy); if(d<md){md=d;alvo={x:h.x+h.w/2,y:h.y+h.h/2};} } }
    if(alvo){ const dx=alvo.x-pcx; key('ArrowRight',dx>20); key('ArrowLeft',dx<-20);
      if((alvo.y<pcy-40 || (Math.abs(dx)>30 && R()<0.01)) && puloT<=0 && pl.onGround){ key('ArrowUp',true); puloT=22; }
      if(AE.cfg.type==='love' && md<170 && carga===0 && pl.stam>=pl.blastCost){ key(' ',true); carga=25+Math.floor(R()*30); } }
    if(puloT>0 && --puloT===0) key('ArrowUp',false);
    if(carga>0 && --carga===0) key(' ',false);
    if(R()<0.004) key('e',true), key('e',false);
    if(R()<0.002) key('q',true), key('q',false);
    try{ AE.update(1/60); }catch(e){ placar.erros++; break; }
    if(AE.state==='end') fim=(AE.player.hp<=0?'derrota':'vitoria');
  }
  for(const k of ['ArrowRight','ArrowLeft','ArrowUp',' ']) key(k,false);
  if(!fim){ G.fimFase('tempo_esgotado',{fase:n}); fim='tempo_esgotado'; }
  placar[fim]++;
}
const exp=G.exportar(true); exp.descricao='robô de cenários (_grafo_robo.js): '+PART+' partidas de até '+PASSOS+' passos';
fs.writeFileSync(SAIDA, JSON.stringify(exp));
const depois=G.exportar(false);   // depois de marcar, não pode sobrar nada "novo" (senão o conversor contaria duas vezes)
console.log(JSON.stringify({partidas:PART, placar, segundos:Math.round((Date.now()-t0)/1000), exportado:{nos:exp.nos.length,arestas:exp.arestas.length,episodios:exp.episodios.length},
  sobra_apos_marcar:{arestas:depois.arestas.length,episodios:depois.episodios.length}, saida:SAIDA}));
console.log('Próximo passo: python gep_amor_explosivo.py "'+SAIDA+'"  (grava no E:\\NERAEL_GEP e valida)');
