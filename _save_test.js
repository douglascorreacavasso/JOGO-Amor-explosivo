// ===== ROBÔ DO "CONTINUAR" — save vazio, quebrado, estranho e de versão antiga =====
// Uso: node _save_test.js     (sem navegador; finge o localStorage e clica no botão CONTINUAR)
// Para cada save: abre o menu, vê se o botão aparece (ou não), clica, joga 240 passos
// desenhando, salva de novo e confere que o save regravado está limpo.
const fs = require('fs');

function stubCtx(){ const g={addColorStop(){}}; return new Proxy({}, {get(_t,k){
  if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern') return ()=>g;
  if(k==='measureText') return ()=>({width:10}); if(k==='canvas') return {width:0,height:0};
  if(k==='getImageData') return ()=>({data:new Uint8ClampedArray(4)});
  return ()=>{}; }}); }
const styleObj=()=>new Proxy({}, {get(){return '';}, set(){return true;}});
const ELS={};
function stubEl(id){ let html=''; return { id, style:styleObj(), dataset:{},
  classList:{add(){},remove(){},toggle(){},contains(){return false;}}, querySelector(){return null;}, querySelectorAll(){return [];},
  set innerHTML(v){ html=String(v); }, get innerHTML(){ return html; },
  addEventListener(){}, getContext(){ return stubCtx(); }, clientWidth:1280, clientHeight:720, width:0, height:0,
  onclick:null, closest(){ return null; }, focus(){} }; }
function el(id){ return ELS[id] || (ELS[id]=stubEl(id)); }
global.document={ body:{dataset:{platform:'desktop'},classList:{add(){},remove(){},toggle(){}}},
  getElementById:el, addEventListener(){}, createElement(){ return stubEl('_'); }, hidden:false };
global.window={ addEventListener(){}, devicePixelRatio:1, innerWidth:1280, innerHeight:720, visualViewport:null };
global.navigator={ userAgent:'node', maxTouchPoints:0 };
let STORE={}; let STORAGE_MODE='ok';   // ok | getThrows | setThrows | missing
const LS={ getItem(k){ if(STORAGE_MODE==='getThrows') throw new Error('SecurityError'); return Object.prototype.hasOwnProperty.call(STORE,k)?STORE[k]:null; },
  setItem(k,v){ if(STORAGE_MODE==='setThrows') throw new Error('QuotaExceededError'); STORE[k]=String(v); },
  removeItem(k){ delete STORE[k]; } };
Object.defineProperty(global,'localStorage',{ configurable:true, get(){ if(STORAGE_MODE==='missing') throw new Error('SecurityError: acesso negado'); return LS; } });
global.performance={ now(){ return Number(process.hrtime.bigint()/1000n)/1000; } };
global.requestAnimationFrame=()=>{};

let src=fs.readFileSync(__dirname+'/game.js','utf8');
src=src.replace(/\}\)\(\);\s*$/, `; globalThis.__AE={ showMenu, update, draw, saveProgress, loadProgress, LEVEL_CAP, SAVE_KEY,
  get state(){return state;}, set state(v){state=v;}, get level(){return level;}, get mode(){return mode;}, get lives(){return lives;},
  get deepest(){return deepest;}, get deaths(){return deaths;}, get seen(){return seen;}, get runSeed(){return runSeed;},
  get player(){return player;}, get overlayHTML(){return overlay.innerHTML;} }; })();`);
eval(src);
const AE=globalThis.__AE, KEY=AE.SAVE_KEY;

// ---- casos ----
const good={v:27,mode:'adventure',level:12,lives:2,deepest:12,deaths:3,seed:123456,seen:{'pw:jump2':1,love:1},ts:1};
const cases=[
  // [nome, valor cru no localStorage (undefined = sem save), o que se espera]
  ['sem save nenhum', undefined, {btn:false}],
  ['string vazia', '', {btn:false}],
  ['só espaços', '   ', {btn:false}],
  ['JSON cortado no meio', JSON.stringify(good).slice(0,40), {btn:false}],
  ['lixo binário', '\u0000ÿ�{{{', {btn:false}],
  ['"null"', 'null', {btn:false}],
  ['"undefined"', 'undefined', {btn:false}],
  ['número solto', '7', {btn:false}],
  ['texto solto', '"nivel 9"', {btn:false}],
  ['lista', '[1,2,3]', {btn:false}],
  ['objeto vazio', '{}', {btn:false}],
  ['level 0', JSON.stringify({...good,level:0}), {btn:false}],
  ['level negativo', JSON.stringify({...good,level:-5}), {btn:false}],
  ['level texto', JSON.stringify({...good,level:'abc'}), {btn:false}],
  ['level null', JSON.stringify({...good,level:null}), {btn:false}],
  ['level true', JSON.stringify({...good,level:true}), {btn:false}],
  ['level com HTML', JSON.stringify({...good,level:'5<img src=x onerror=alert(1)>'}), {btn:false}],
  ['level "8" (texto com número)', JSON.stringify({...good,level:'8'}), {btn:true, level:8}],
  ['level 2.7 (quebrado)', JSON.stringify({...good,level:2.7}), {btn:true, level:2}],
  ['level [4] (lista)', JSON.stringify({...good,level:[4]}), {btn:false}],
  ['level acima do teto', JSON.stringify({...good,level:5000}), {btn:true, level:1000}],
  ['level gigante 1e12', JSON.stringify({...good,level:1e12}), {btn:true, level:1000}],
  ['level "0x10"', JSON.stringify({...good,level:'0x10'}), {btn:false}],
  ['lives 0', JSON.stringify({...good,lives:0}), {btn:true, level:12, lives:3}],
  ['lives 99', JSON.stringify({...good,lives:99}), {btn:true, level:12, lives:3}],
  ['lives -2', JSON.stringify({...good,lives:-2}), {btn:true, level:12, lives:3}],
  ['lives texto', JSON.stringify({...good,lives:'x'}), {btn:true, level:12, lives:3}],
  ['deepest gigante', JSON.stringify({...good,deepest:999999}), {btn:true, level:12, deepestMax:1000}],
  ['deepest negativo', JSON.stringify({...good,deepest:-9}), {btn:true, level:12, deepestMin:1}],
  ['deaths negativo', JSON.stringify({...good,deaths:-50}), {btn:true, level:12, deathsMin:0}],
  ['deaths texto', JSON.stringify({...good,deaths:'muitas'}), {btn:true, level:12, deathsMin:0}],
  ['mode estranho', JSON.stringify({...good,mode:'hacker'}), {btn:true, level:12, mode:'adventure'}],
  ['mode infinito', JSON.stringify({...good,mode:'infinite'}), {btn:true, level:12, mode:'infinite'}],
  ['seed texto', JSON.stringify({...good,seed:'abc'}), {btn:true, level:12}],
  ['seed negativa', JSON.stringify({...good,seed:-1}), {btn:true, level:12}],
  ['seed objeto', JSON.stringify({...good,seed:{a:1}}), {btn:true, level:12}],
  ['seen null', JSON.stringify({...good,seen:null}), {btn:true, level:12}],
  ['seen lista', JSON.stringify({...good,seen:[1,2]}), {btn:true, level:12}],
  ['seen texto', JSON.stringify({...good,seen:'tudo'}), {btn:true, level:12}],
  ['seen com __proto__', '{"v":27,"mode":"adventure","level":12,"lives":3,"seed":5,"seen":{"__proto__":{"love":1},"constructor":1}}', {btn:true, level:12}],
  ['versão futura v99', JSON.stringify({...good,v:99,extra:{x:1}}), {btn:true, level:12}],
  // saves da versão antiga (v26: sem "v", sem "seen"; mesma chave)
  ['v26 normal', JSON.stringify({mode:'adventure',level:9,lives:3,deepest:9,deaths:0,seed:987654,ts:1}), {btn:true, level:9}],
  ['v26 infinito', JSON.stringify({mode:'infinite',level:40,lives:3,deepest:44,deaths:17,seed:42,ts:1}), {btn:true, level:40, mode:'infinite'}],
  ['v26 no teto (venceu o 999)', JSON.stringify({mode:'adventure',level:1000,lives:1,deepest:1000,deaths:2,seed:1,ts:1}), {btn:true, level:1000}],
  ['v26 sem seed', JSON.stringify({mode:'adventure',level:3,lives:3}), {btn:true, level:3}],
  ['v-antigo só com level', JSON.stringify({level:5}), {btn:true, level:5}],
  ['save bom v27', JSON.stringify(good), {btn:true, level:12, lives:2, mode:'adventure'}],
];
const storageCases=[
  ['localStorage proibido (navegador privado)', 'missing', JSON.stringify(good), {btn:false}],
  ['getItem dá erro', 'getThrows', JSON.stringify(good), {btn:false}],
  ['setItem dá erro (cheio)', 'setThrows', JSON.stringify(good), {btn:true, level:12}],
];

const fails=[]; let ran=0;
function runCase(name, raw, exp, smode, briefing){
  ran++;
  const problems=[];
  STORE={}; STORAGE_MODE='ok'; if(raw!==undefined) STORE[KEY]=raw; STORAGE_MODE=smode||'ok';
  globalThis.__SKIP_INTRO=!briefing;
  ELS.cont && (ELS.cont.onclick=null);
  try{
    AE.showMenu();
    const html=AE.overlayHTML; const has=html.indexOf('id="cont"')>=0;
    if(has!==exp.btn) problems.push('botão CONTINUAR '+(has?'apareceu':'sumiu')+' (esperado: '+(exp.btn?'aparecer':'não aparecer')+')');
    if(/<img|onerror|undefined|NaN|null|\[object/.test(html)) problems.push('texto do menu estranho: '+(html.match(/nível[^<]*/)||[''])[0]);
    if(has){
      const m=html.match(/CONTINUAR · nível ([^ <]+)/); const shown=m?m[1]:'?';
      ELS.cont.onclick();
      if(briefing){ let guard=0; while(AE.state==='briefing' && guard++<30){ if(ELS.bnext && ELS.bnext.onclick) ELS.bnext.onclick(); else break; } }
      if(AE.state!=='play') problems.push('depois de clicar o estado é '+AE.state);
      if(String(AE.level)!==shown) problems.push('menu dizia nível '+shown+' mas abriu o nível '+AE.level);
      if(!(AE.level>=1 && AE.level<=AE.LEVEL_CAP && Number.isInteger(AE.level))) problems.push('nível inválido '+AE.level);
      if(exp.level!=null && AE.level!==exp.level) problems.push('nível '+AE.level+' (esperado '+exp.level+')');
      if(exp.lives!=null && AE.lives!==exp.lives) problems.push('vidas '+AE.lives+' (esperado '+exp.lives+')');
      if(!(AE.lives>=1 && AE.lives<=3)) problems.push('vidas fora de 1..3: '+AE.lives);
      if(exp.mode && AE.mode!==exp.mode) problems.push('modo '+AE.mode);
      if(!(Number.isInteger(AE.deepest) && AE.deepest>=1 && AE.deepest<=AE.LEVEL_CAP)) problems.push('recorde fora do limite: '+AE.deepest);
      if(!(Number.isInteger(AE.deaths) && AE.deaths>=0)) problems.push('mortes inválidas: '+AE.deaths);
      if(!(AE.runSeed>=0 && AE.runSeed<=4294967295 && Number.isInteger(AE.runSeed))) problems.push('semente inválida '+AE.runSeed);
      if(typeof AE.seen!=='object' || AE.seen===null || Array.isArray(AE.seen)) problems.push('seen virou '+typeof AE.seen);
      for(let i=0;i<240 && AE.state==='play';i++){ AE.update(1/60); if(i%4===0) AE.draw(1); }
      const p=AE.player; if(!p || !isFinite(p.x) || !isFinite(p.y)) problems.push('jogador com posição NaN');
      // regrava e relê: o save novo tem que estar limpo
      if(smode!=='setThrows'){
        STORAGE_MODE='ok'; AE.saveProgress(); const back=AE.loadProgress();
        if(!back) problems.push('save regravado não foi lido de volta');
        else { if(!(back.v>=27)) problems.push('save regravado sem versão');
          if(!(Number.isInteger(back.level)&&back.level>=1&&back.level<=AE.LEVEL_CAP)) problems.push('save regravado com level '+back.level); }
      }
    }
  }catch(e){ problems.push('ERRO: '+e.message+' @ '+((e.stack||'').split('\n')[1]||'').trim()); }
  if(problems.length) fails.push({caso:name+(briefing?' [com briefing]':''), problemas:problems});
}
for(const [n,raw,exp] of cases){ runCase(n,raw,exp,'ok',false); runCase(n,raw,exp,'ok',true); }
for(const [n,sm,raw,exp] of storageCases){ runCase(n,raw,exp,sm,false); runCase(n,raw,exp,sm,true); }

// ---- aleatório: 3.000 saves embaralhados (campos com tipos trocados) ----
const vals=[undefined,null,0,-1,1,2.5,3,12,999,1000,1001,1e9,-1e9,NaN,'', '7','abc','<b>',true,false,[],[3],{},{a:1},'__proto__'];
let rs=12345; const R=()=>{ rs=(rs*1103515245+12345)&0x7fffffff; return rs/0x7fffffff; };
const pick=a=>a[(R()*a.length)|0];
for(let i=0;i<3000;i++){
  const o={}; for(const k of ['v','mode','level','lives','deepest','deaths','seed','seen','ts']) if(R()<0.85) o[k]=(k==='mode'&&R()<0.5)?pick(['adventure','infinite']):pick(vals);
  let raw=JSON.stringify(o); if(R()<0.1) raw=raw.slice(0,(R()*raw.length)|0);
  const lv=o.level, ok=(typeof lv==='number'&&isFinite(lv)&&lv>=1)||(typeof lv==='string'&&/^\d+$/.test(lv)&&+lv>=1);
  const truncated=raw!==JSON.stringify(o);
  runCase('aleatório #'+i+' '+raw.slice(0,80), raw, {btn: ok && !truncated}, 'ok', i%3===0);
}

console.log('=== ROBÔ DO CONTINUAR ===');
console.log('casos rodados:', ran, '| falhas:', fails.length);
fails.slice(0,40).forEach(f=>console.log('✗', f.caso, '→', f.problemas.join(' | ')));
if(process.env.SAVE_TEST_OUT) fs.writeFileSync(process.env.SAVE_TEST_OUT, JSON.stringify({quando:new Date().toISOString(), casos:ran, falhas:fails.length, exemplos:fails.slice(0,60)},null,1));
process.exitCode = fails.length?1:0;
