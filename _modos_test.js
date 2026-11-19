// ===== ROBÔ DOS MODOS (19/11/2026) — o Infinito nunca pode ser apagado sem querer =====
// Uso: node _modos_test.js          (cenários normais)
//      node _modos_test.js historico (o caso do Douglas: save antigo zerado + histórico do grafo com o nível de verdade)
const fs=require('fs');
const HIST=process.argv[2]==='historico';
function stubCtx(){ const g={addColorStop(){}}; return new Proxy({}, {get(_t,k){
  if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern') return ()=>g;
  if(k==='measureText') return ()=>({width:10}); if(k==='canvas') return {width:0,height:0};
  if(k==='getImageData') return ()=>({data:new Uint8ClampedArray(4)}); return ()=>{}; }}); }
const styleObj=()=>new Proxy({}, {get(){return '';}, set(){return true;}});
const ELS={};
function stubEl(id){ let html=''; return { id, style:styleObj(), dataset:{}, classList:{add(){},remove(){},toggle(){},contains(){return false;}},
  querySelector(){return null;}, querySelectorAll(){return [];}, set innerHTML(v){ html=String(v); }, get innerHTML(){ return html; },
  addEventListener(){}, getContext(){ return stubCtx(); }, clientWidth:1280, clientHeight:720, width:0, height:0, onclick:null, closest(){ return null; }, focus(){} }; }
function el(id){ return ELS[id] || (ELS[id]=stubEl(id)); }
global.document={ body:{dataset:{platform:'desktop'},classList:{add(){},remove(){},toggle(){}}}, getElementById:el, addEventListener(){}, createElement(){ return stubEl('_'); }, hidden:false };
global.window={ addEventListener(){}, devicePixelRatio:1, innerWidth:1280, innerHeight:720, visualViewport:null };
global.navigator={ userAgent:'node', maxTouchPoints:0 };
let STORE={};
global.localStorage={ getItem(k){ return Object.prototype.hasOwnProperty.call(STORE,k)?STORE[k]:null; }, setItem(k,v){ STORE[k]=String(v); }, removeItem(k){ delete STORE[k]; } };
global.performance={ now(){ return Number(process.hrtime.bigint()/1000n)/1000; } };
global.requestAnimationFrame=()=>{}; global.setInterval=()=>0;
const OLD='amorExplosivo_save_v2', INF='amorExplosivo_save_infinito_v3', ADV='amorExplosivo_save_aventura_v3';
if(HIST){
  // o que aconteceu: o save antigo (uma vaga só) ficou com Infinito nível 1; o grafo ainda tem as fases jogadas no Infinito
  STORE[OLD]=JSON.stringify({v:27,mode:'infinite',level:1,lives:3,deepest:1,deaths:0,seed:5,seen:{},ts:Date.now()});
  const ep=(f,m)=>({quando:'2026-11-19T10:00:00Z',entrada:'fase '+f,nos:['fase:'+f,'tipo_fase:love','sala:quarto','modo:'+m,'evento:vitoria'],resultado:'vitoria',nota:1,eventos:{},origem:'uso_programa'});
  STORE['amorExplosivo_grafo_v2']=JSON.stringify({v:2,tick:10,N:[],E:[],P:[ep(70,'infinite'),ep(83,'infinite'),ep(140,'adventure'),ep(12,'infinite')]});
}
eval(fs.readFileSync(__dirname+'/grafo_experiencia.js','utf8'));
let src=fs.readFileSync(__dirname+'/game.js','utf8');
src=src.replace(/\}\)\(\);\s*$/, `; globalThis.__AE={ showMenu, update, pauseGame, startLevel, get state(){return state;}, get level(){return level;}, get mode(){return mode;},
  get overlayHTML(){return overlay.innerHTML;} }; })();`);
eval(src);
const AE=globalThis.__AE; globalThis.__SKIP_INTRO=true;
const fails=[]; const ok=(c,msg)=>{ if(!c) fails.push(msg); };
const click=id=>{ const e=ELS[id]; if(!e||!e.onclick) throw new Error('sem botão '+id+' na tela: '+(AE.overlayHTML.match(/id="[^"]+"/g)||[]).join(' ')); e.onclick({preventDefault(){}}); };
const has=id=>AE.overlayHTML.indexOf('id="'+id+'"')>=0;
const lvl=k=>{ const s=STORE[k]; return s?JSON.parse(s).level:null; };
const reset=()=>{ for(const k of Object.keys(ELS)) delete ELS[k]; };

if(!HIST){
  STORE={}; STORE[INF]=JSON.stringify({v:34,mode:'infinite',level:57,lives:3,deepest:57,deaths:9,seed:7,seen:{},ts:2000});
  STORE[ADV]=JSON.stringify({v:34,mode:'adventure',level:12,lives:2,deepest:12,deaths:1,seed:8,seen:{},ts:1000});
  STORE['amorExplosivo_migrou_v3']='1';
  // 1. menu mostra os dois CONTINUAR, o mais recente (Infinito) é o grande e principal
  reset(); AE.showMenu(); const h=AE.overlayHTML;
  ok(/id="cont"[^>]*class="btn cont"[\s\S]*CONTINUAR · nível 57/.test(h), '1: CONTINUAR principal não é o Infinito 57');
  ok(has('cont2') && /nível 12/.test(h), '1: falta o CONTINUAR da Aventura');
  ok(/id="cont"[^>]*data-primary/.test(h), '1: CONTINUAR não é o botão do Enter');
  ok(!has('clr'), '1: ainda existe o link de apagar no menu principal');
  // 2. tocar em "Infinito" (o acidente do Douglas) NÃO recomeça
  click('inf'); ok(AE.state==='menu', '2: tocar em Infinito saiu do menu (estado '+AE.state+')'); ok(lvl(INF)===57, '2: save do Infinito mudou para '+lvl(INF));
  ok(has('mcont') && has('mzero'), '2: tela de escolha sem CONTINUAR ou sem começar do zero');
  ok(/id="mcont"[^>]*data-primary/.test(AE.overlayHTML), '2: o Enter não é CONTINUAR');
  // 3. "começar do zero" pede confirmação, e "não" continua
  click('mzero'); ok(AE.state==='menu' && has('znao') && has('zsim'), '3: começar do zero não pediu confirmação'); ok(lvl(INF)===57, '3: apagou antes de confirmar');
  ok(/id="znao"[^>]*data-primary/.test(AE.overlayHTML), '3: o Enter na confirmação não é o NÃO');
  click('znao'); ok(AE.state==='play' && AE.level===57 && AE.mode==='infinite', '3: NÃO não continuou no 57 do Infinito ('+AE.mode+' '+AE.level+')');
  // 4. pausa > menu > Aventura: o Infinito continua intacto
  for(let i=0;i<30;i++) AE.update(1/60);
  AE.pauseGame(); click('pmenu'); ok(AE.state==='menu','4: MENU da pausa não voltou ao menu');
  click('adv'); click('mcont'); ok(AE.mode==='adventure' && AE.level===12, '4: Aventura não continuou no 12');
  ok(lvl(INF)===57, '4: jogar a Aventura mexeu no Infinito ('+lvl(INF)+')');
  // 5. apagar a Aventura de propósito: guarda o "antes" e o menu oferece voltar
  reset(); AE.showMenu(); click('adv'); click('mzero'); click('zsim'); if(AE.state!=='play' && has('tgo')) click('tgo');
  ok(AE.mode==='adventure' && AE.level===1, '5: começar do zero não foi para o nível 1');
  ok(lvl(INF)===57, '5: apagar a Aventura apagou o Infinito');
  ok(lvl(ADV+'_antes')===12, '5: não guardou o save de antes ('+lvl(ADV+'_antes')+')');
  reset(); AE.showMenu(); ok(/VOLTAR AO NÍVEL 12/.test(AE.overlayHTML), '5: menu não oferece voltar ao nível 12');
  click('rec0'); ok(AE.mode==='adventure' && AE.level===12, '5: recuperar não voltou ao 12 ('+AE.level+')');
  // 6. recorde do Infinito fica guardado à parte
  ok(+STORE['amorExplosivo_recorde_infinito']>=57, '6: recorde do Infinito não foi guardado ('+STORE['amorExplosivo_recorde_infinito']+')');
  // 7. sem save nenhum: tocar no modo começa direto (sem perguntar)
  STORE={}; reset(); AE.showMenu(); click('adv'); if(AE.state!=='play' && ELS.tgo) click('tgo'); ok(AE.state==='play' && AE.level===1, '7: sem save, Aventura não começou direto ('+AE.state+')');
} else {
  // o caso real: o menu tem que oferecer voltar ao nível 83 do Infinito (achado no histórico), sem tocar na Aventura
  reset(); AE.showMenu(); const h=AE.overlayHTML;
  ok(/VOLTAR AO NÍVEL 83/.test(h), 'H: menu não oferece voltar ao nível 83 do Infinito: '+(h.match(/VOLTAR[^<]*/)||['nada'])[0]);
  ok(!/NÍVEL 140/.test(h), 'H: usou fase da Aventura para o Infinito');
  ok(lvl(INF)===1, 'H: save antigo não migrou para a vaga do Infinito');
  click('rec0'); ok(AE.state==='play' && AE.mode==='infinite' && AE.level===83, 'H: recuperar não abriu o Infinito 83 ('+AE.mode+' '+AE.level+')');
  ok(lvl(INF)===83, 'H: save do Infinito não ficou no 83 ('+lvl(INF)+')');
  ok(+STORE['amorExplosivo_recorde_infinito']===83, 'H: recorde não ficou 83');
}
console.log('=== ROBÔ DOS MODOS'+(HIST?' (histórico)':'')+' === falhas: '+fails.length); fails.forEach(f=>console.log('  ✗ '+f));
process.exit(fails.length?1:0);
