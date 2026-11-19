/* ============================================================================
   AMOR EXPLOSIVO — grafo_experiencia.js (v2, 15/11/2026; infraestrutura escrita pelo Claude)
   Aprendizado em GRAFO por baixo do jogo, seguindo o contrato GEP V1
   (FORJA\CONTRATO_GRAFO_PROGRAMAS\CONTRATO_GEP_V1.md): nós, arestas com peso e
   frequência de uso (usos, sucessos, falhas), variáveis e episódios com nota.

   - Só OBSERVA: se este arquivo faltar ou der erro, o jogo continua igual.
   - O navegador não grava SQLite: o jogo guarda a experiência no aparelho e
     EXPORTA só o que é novo desde a última exportação (delta + episódios).
     O conversor `gep_amor_explosivo.py` grava isso com o gep.py oficial em
     E:\NERAEL_GEP\amor_explosivo.gep.sqlite e roda o validador.
   - Nada se apaga (regra 6 do contrato): o que não é usado só ENFRAQUECE.
   - Proveniência: 'uso_programa' (pessoa jogando) ou 'simulacao_propria' (robô).
   ============================================================================ */
(function(){
"use strict";
const CHAVE='amorExplosivo_grafo_v2', VERSAO=2, MAX_EPIS=3000;   // episódios esperando exportação (exporte de vez em quando)
const nos=new Map(), arestas=new Map();
let tick=0, episodio=null, contexto=[], episodiosPend=[], sujo=false, ultimoSalvo=0, origem='uso_programa';

function no(tipo, rotulo){ const id=tipo+':'+rotulo; let x=nos.get(id);
  if(!x){ x={id,tipo,rotulo:String(rotulo).slice(0,120),n:0,v:{}}; nos.set(id,x); } return x; }
function variavel(x, nome, valor){ if(typeof valor!=='number'||!isFinite(valor)) return;
  let s=x.v[nome]; if(!s) s=x.v[nome]={s:0,s2:0,c:0,min:valor,max:valor,ult:valor};
  s.s+=valor; s.s2+=valor*valor; s.c++; s.ult=valor; if(valor<s.min) s.min=valor; if(valor>s.max) s.max=valor; }
// rel: 'causa' (o local causou o evento), 'leva_a' (contexto → evento), 'coativacao' (acesos juntos)
function aresta(a, b, rel, bom){ const k=a.id+'>'+rel+'>'+b.id; let e=arestas.get(k);
  if(!e){ e={a:a.id,b:b.id,rel,peso:0,n:0,ok:0,f:0,dn:0,dok:0,df:0}; arestas.set(k,e); }
  e.n++; e.dn++; if(bom===true){ e.ok++; e.dok++; } else if(bom===false){ e.f++; e.df++; }
  e.peso+=(1-e.peso)*0.15; return e; }                       // reforço que satura em 1
function acender(lista){ contexto=lista.map(([t,r])=>no(t,r)); }
function evento(nome, extra, bom, vars){ tick++; const ev=no('evento',nome); ev.n++;
  const locais=(extra||[]).map(([t,r])=>no(t,r));
  for(const c of contexto) aresta(c,ev,'leva_a',bom);
  for(const l of locais){ l.n++; aresta(l,ev,'causa',bom); for(const c of contexto) if(c!==l) aresta(c,l,'coativacao',bom); }   // sem ligar um nó a ele mesmo
  if(vars) for(const k in vars) variavel(ev,k,vars[k]);
  if(episodio){ episodio.eventos[nome]=(episodio.eventos[nome]||0)+1; for(const l of locais) episodio.usados.add(l.id); }
  sujo=true; }
function enfraquecer(){ for(const e of arestas.values()) e.peso*=0.985; }   // esquecer = enfraquecer, nunca apagar

const API={
  versao:VERSAO,
  origem(o){ if(o==='uso_programa'||o==='simulacao_propria') origem=o; },
  inicioFase(info){
    const lista=[['fase',info.fase],['tipo_fase',info.tipo],['sala',info.sala],['modo',info.modo]];
    (info.regras||[]).forEach(r=>lista.push(['regra',r])); [...new Set(info.monstros||[])].forEach(m=>lista.push(['monstro',m]));
    (info.poderes||[]).forEach(p=>lista.push(['poder_disponivel',p]));
    acender(lista);
    episodio={quando:new Date().toISOString(), fase:info.fase, t0:Date.now(), eventos:{}, usados:new Set(contexto.map(c=>c.id)), entrada:'fase '+info.fase+' · '+(info.sala||'')+((info.regras||[]).length?' · regras: '+info.regras.join(', '):'')};
    evento('fase_comecou',null,null); },
  evento(nome, extra, bom, vars){ evento(nome, extra, bom, vars); },
  fimFase(resultado, vars){ if(!episodio) return; const dur=(Date.now()-episodio.t0)/1000;
    evento(resultado, null, resultado==='vitoria', Object.assign({segundos:dur}, vars||{}));
    variavel(no('fase',episodio.fase), resultado==='vitoria'?'segundos_para_vencer':'segundos_ate_perder', dur);
    const nota = resultado==='vitoria' ? 1 : (resultado==='derrota' ? 0 : 0.4);
    episodiosPend.push({quando:episodio.quando, entrada:episodio.entrada, nos:[...episodio.usados, 'evento:'+resultado], resultado, nota, eventos:episodio.eventos, origem});
    if(episodiosPend.length>MAX_EPIS) episodiosPend.splice(0, episodiosPend.length-MAX_EPIS);
    episodio=null; enfraquecer(); salvar(true); },
  // maior fase jogada num modo, pelos episódios guardados (usado pelo menu para recuperar o Infinito; 19/11)
  maiorFase(modo){ const alvo='modo:'+modo; let m=0;
    const olha=(ids)=>{ if(!ids || ids.indexOf(alvo)<0) return; for(const id of ids){ if(typeof id==='string' && id.slice(0,5)==='fase:'){ const n=parseInt(id.slice(5),10); if(n>m) m=n; } } };
    for(const ep of episodiosPend) olha(Array.isArray(ep.nos)?ep.nos:null);
    if(episodio) olha([...episodio.usados]);
    return m; },
  maiorPerigo(){ const dano=no('evento','dano'); let melhor=null;
    for(const e of arestas.values()){ if(e.b!==dano.id || e.rel!=='causa') continue; if(!melhor||e.n>melhor.n) melhor=e; }
    return melhor ? {fonte:nos.get(melhor.a).rotulo, vezes:melhor.n, peso:+melhor.peso.toFixed(3)} : null; },
  resumo(){ let pend=0; for(const e of arestas.values()) if(e.dn) pend++; return {nos:nos.size, arestas:arestas.size, eventos:tick, arestas_novas:pend, episodios_novos:episodiosPend.length}; },
  // exportação no formato de troca do jogo → o conversor grava no GEP. marcar=true zera o "novo desde a última exportação".
  exportar(marcar){ const usados=new Set(), lista=[];
    for(const e of arestas.values()) if(e.dn){ usados.add(e.a); usados.add(e.b); }
    for(const ep of episodiosPend) ep.nos.forEach(id=>usados.add(id));
    for(const x of nos.values()) if(usados.has(x.id) || Object.keys(x.v).length) lista.push(x);
    const out={ formato:'amor_explosivo_para_gep', versao:VERSAO, contrato_alvo:'GEP_V1_2026-11-15', programa:'amor_explosivo',
      id_exportacao:'exp_'+Date.now().toString(36)+'_'+Math.floor(Math.random()*1e9).toString(36), origem, criado_em:new Date().toISOString(),
      autor_infraestrutura:'Claude (registrador); conteúdo = uso do jogo ou robô',
      nos:lista.map(x=>({id:x.id,tipo:x.tipo,rotulo:x.rotulo,n:x.n,variaveis:Object.fromEntries(Object.entries(x.v).map(([k,s])=>[k,{ultimo:s.ult,media:+(s.s/s.c).toFixed(4),min:s.min,max:s.max,contagem:s.c}]))})),
      arestas:[...arestas.values()].filter(e=>e.dn).map(e=>({de:e.a,para:e.b,rel:e.rel,peso:+e.peso.toFixed(4),usos:e.dn,sucessos:e.dok,falhas:e.df})),
      episodios:episodiosPend.slice() };
    if(marcar){ for(const e of arestas.values()){ e.dn=0; e.dok=0; e.df=0; } episodiosPend=[]; sujo=true; salvar(true); }
    return out; },
  baixar(){ try{ const dados=API.exportar(false); const blob=new Blob([JSON.stringify(dados)],{type:'application/json'}); const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download='amor_explosivo_experiencia_'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.json'; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500); API.exportar(true); return true; }catch(e){ return false; } },
  salvar(){ salvar(true); }
};
// ----- persistência compacta no aparelho (matriz de índices) -----
function salvar(forcar){ if(!sujo) return; const agora=Date.now(); if(!forcar && agora-ultimoSalvo<15000) return;
  try{ if(typeof localStorage==='undefined') return; const lista=[...nos.values()], idx=new Map(lista.map((x,i)=>[x.id,i]));
    const pac={v:VERSAO,tick,N:lista.map(x=>[x.tipo,x.rotulo,x.n,x.v]),E:[...arestas.values()].map(e=>[idx.get(e.a),idx.get(e.b),e.rel,+e.peso.toFixed(4),e.n,e.ok,e.f,e.dn,e.dok,e.df]),P:episodiosPend};
    localStorage.setItem(CHAVE,JSON.stringify(pac)); sujo=false; ultimoSalvo=agora; }catch(e){} }
function carregar(obj){ if(!obj||!Array.isArray(obj.N)||!Array.isArray(obj.E)) return;
  const ids=obj.N.map(r=>{ const x=no(r[0],r[1]); x.n=r[2]|0; if(r[3]&&typeof r[3]==='object') x.v=r[3]; return x; });
  for(const r of obj.E){ const a=ids[r[0]], b=ids[r[1]]; if(!a||!b) continue; const k=a.id+'>'+r[2]+'>'+b.id;
    arestas.set(k,{a:a.id,b:b.id,rel:String(r[2]),peso:Math.min(1,+r[3]||0),n:r[4]|0,ok:r[5]|0,f:r[6]|0,dn:r[7]|0,dok:r[8]|0,df:r[9]|0}); }
  tick=obj.tick|0; if(Array.isArray(obj.P)) episodiosPend=obj.P.slice(-MAX_EPIS); }
try{ if(typeof localStorage!=='undefined'){ const s=localStorage.getItem(CHAVE); if(s) carregar(JSON.parse(s)); } }catch(e){}
try{ window.addEventListener('pagehide',()=>salvar(true)); document.addEventListener('visibilitychange',()=>{ if(document.hidden) salvar(true); }); }catch(e){}
try{ setInterval(()=>salvar(false),15000); }catch(e){}
globalThis.AE_GRAFO=API;
})();
