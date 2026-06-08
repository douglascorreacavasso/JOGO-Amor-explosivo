const fs=require('fs');
function stubCtx(){ const grad={addColorStop(){}}; return new Proxy({},{get(_t,k){
  if(k==='createLinearGradient'||k==='createRadialGradient')return ()=>grad;
  if(k==='measureText')return ()=>({width:10}); if(k==='canvas')return {width:0,height:0};
  return ()=>{}; }}); }
const styleObj=()=>new Proxy({},{get(){return '';},set(){return true;}});
function stubEl(){return{style:styleObj(),dataset:{},classList:{add(){},remove(){},toggle(){}},set innerHTML(v){},get innerHTML(){return '';},addEventListener(){},getContext(){return stubCtx();},clientWidth:1280,clientHeight:720,width:0,height:0,set onclick(v){},closest(){return null;}};}
const canvas=stubEl();
global.document={body:{dataset:{platform:'desktop'},classList:{add(){},remove(){},toggle(){}}},getElementById(id){return id==='game'?canvas:stubEl();},addEventListener(){}};
global.window={addEventListener(){},devicePixelRatio:1,innerWidth:1280,innerHeight:720,visualViewport:null};
global.navigator={userAgent:'node',maxTouchPoints:0};
global.localStorage={getItem(){return null;},setItem(){},removeItem(){}};
global.performance={now(){return 0;}};
global.requestAnimationFrame=()=>{};
let src=fs.readFileSync('game.js','utf8');
src=src.replace(/\}\)\(\);\s*$/, '; globalThis.__AE={buildLevel,update,draw,setState(v){state=v;}}; })();');
eval(src);
const AE=globalThis.__AE;
let errs=0;
for(const n of [1,2,3,6,14,20,50,100,200]){
  try{ AE.buildLevel(n); AE.setState('play'); for(let i=0;i<60;i++){ AE.update(0.016); AE.draw(); } }
  catch(e){ errs++; console.log('ERRO draw/update L'+n+':', e.message); }
}
console.log(errs===0 ? 'DRAW+UPDATE OK em todas as fases testadas (60 frames cada)' : ('FALHAS: '+errs));
