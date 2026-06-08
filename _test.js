// ===== ROBÔ DE TESTE (headless) — alcançabilidade + performance, sem precisar jogar =====
const fs = require('fs');

// ---- stubs de DOM/Canvas/Window pro game.js rodar sem navegador ----
function stubCtx(){
  const grad = { addColorStop(){} };
  return new Proxy({}, { get(_t, k){
    if(k==='createLinearGradient'||k==='createRadialGradient') return ()=>grad;
    if(k==='measureText') return ()=>({width:10});
    if(k==='canvas') return {width:0,height:0};
    return ()=>{};
  }});
}
const styleObj = ()=>new Proxy({}, {get(){return '';}, set(){return true;}});
function stubEl(){ return { style: styleObj(), dataset:{}, classList:{add(){},remove(){},toggle(){}}, set innerHTML(v){}, get innerHTML(){return '';},
  addEventListener(){}, getContext(){ return stubCtx(); }, clientWidth:1280, clientHeight:720, width:0, height:0,
  set onclick(v){}, closest(){return null;} }; }
const canvas = stubEl();
global.document = {
  body: { dataset:{platform:'desktop'}, classList:{add(){},remove(){},toggle(){}} },
  getElementById(id){ if(id==='game') return canvas; return stubEl(); },
  addEventListener(){}
};
global.window = { addEventListener(){}, devicePixelRatio:1, innerWidth:1280, innerHeight:720,
  AudioContext:undefined, webkitAudioContext:undefined, visualViewport:null };
global.navigator = { userAgent:'node', maxTouchPoints:0 };
global.localStorage = { getItem(){return null;}, setItem(){}, removeItem(){} };
global.performance = { now(){ return Number(process.hrtime.bigint()/1000n)/1000; } };
global.requestAnimationFrame = ()=>{};   // NÃO roda o loop
global.AudioContext = undefined;

// ---- carrega game.js expondo os internos ----
let src = fs.readFileSync('game.js','utf8');
const SHIM = `; globalThis.__AE={ buildLevel, computeReachable, areaForLevel, update,
  get platforms(){return platforms;}, get cfg(){return cfg;}, get npcs(){return npcs;}, get monsters(){return monsters;},
  get WORLD_W(){return WORLD_W;}, get WORLD_H(){return WORLD_H;}, get JUMP_Hc(){return JUMP_Hc;}, get groundY(){return groundY;}, get phBandH(){return phBandH;},
  setState(v){state=v;}, get state(){return state;} };\n})();`;
// substitui o fechamento final "})();" pelo shim
src = src.replace(/\}\)\(\);\s*$/, SHIM);
eval(src);
const AE = globalThis.__AE;

// ---- 1) ALCANÇABILIDADE (robô): existe caminho do chão até o topo? ----
function reachReport(n){
  AE.buildLevel(n);
  const ps = AE.platforms, reach = AE.computeReachable();
  const nonExtra = ps.filter(p=>p.band!==99);
  const reachCount = ps.filter((p,i)=>reach[i] && p.band!==99).length;
  // topo: barras nas 25% superiores da área de jogo
  const top = AE.groundY - (AE.groundY-110)*0.75;
  let topReach=0, topTotal=0;
  ps.forEach((p,i)=>{ if(p.band===99) return; if(p.y<=top){ topTotal++; if(reach[i]) topReach++; } });
  return { n, plats:ps.length, nonExtra:nonExtra.length, reachCount, topTotal, topReach,
           okTop: topTotal===0 ? true : topReach>0, type:AE.cfg.type,
           npcs:AE.npcs.length, mon:AE.monsters.length, W:AE.WORLD_W, H:AE.WORLD_H, bands:AE.phBandH.toFixed(0) };
}
let fails=[];
let maxPlats=0;
for(let n=1;n<=200;n++){ const r=reachReport(n); maxPlats=Math.max(maxPlats,r.plats);
  if(!r.okTop) fails.push(r);
}
console.log('=== ALCANÇABILIDADE 1..200 ===');
console.log('falhas (topo inalcançável):', fails.length);
if(fails.length) console.log(fails.slice(0,8));
console.log('máx de barras numa fase:', maxPlats);

// amostra
[1,2,3,6,9,14,20,50,100,125,200].forEach(n=>{ const r=reachReport(n);
  console.log(`L${n} ${r.type} | plats=${r.plats} topo=${r.topReach}/${r.topTotal} npcs=${r.npcs} mon=${r.mon} W=${r.W} H=${r.H} bandH=${r.bands}`); });

// ---- 2) PERFORMANCE: tempo de update() por frame em fases crescentes ----
console.log('\n=== PERFORMANCE update() (ms/frame, média de 600 frames) ===');
function profile(n){
  AE.buildLevel(n); AE.setState('play');
  const FR=600; const t0=performance.now();
  for(let i=0;i<FR;i++) AE.update(0.016);
  const t1=performance.now();
  return ((t1-t0)/FR);
}
[1,6,20,50,75,100,150,200].forEach(n=>{
  const ms=profile(n);
  console.log(`L${n}: ${ms.toFixed(4)} ms/frame  (~${Math.round(1000/Math.max(ms,0.0001))} fps de orçamento)`);
});
// tempo de build (freeze ao trocar de nível)
console.log('\n=== TEMPO DE BUILD (freeze ao entrar na fase) ===');
[6,50,100,150,200].forEach(n=>{ const t0=performance.now(); AE.buildLevel(n); const t1=performance.now();
  console.log(`build L${n}: ${(t1-t0).toFixed(3)} ms (${AE.platforms.length} barras)`); });
