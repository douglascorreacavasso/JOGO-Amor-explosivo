const fs=require('fs');
function stubCtx(){const g={addColorStop(){}};return new Proxy({},{get(_t,k){if(k==='createLinearGradient'||k==='createRadialGradient')return ()=>g;if(k==='measureText')return ()=>({width:10});if(k==='canvas')return{width:0,height:0};return ()=>{};}});}
const so=()=>new Proxy({},{get(){return '';},set(){return true;}});
function el(){return{style:so(),dataset:{},classList:{add(){},remove(){},toggle(){}},set innerHTML(v){},get innerHTML(){return '';},addEventListener(){},getContext(){return stubCtx();},clientWidth:1280,clientHeight:720,width:0,height:0,set onclick(v){},closest(){return null;}};}
const cv=el();
global.document={body:{dataset:{platform:'desktop'},classList:{add(){},remove(){},toggle(){}}},getElementById(id){return id==='game'?cv:el();},addEventListener(){}};
global.window={addEventListener(){},devicePixelRatio:1,innerWidth:1280,innerHeight:720,visualViewport:null};
global.navigator={userAgent:'node',maxTouchPoints:0};
global.localStorage={getItem(){return null;},setItem(){},removeItem(){}};
global.performance={now(){return 0;}};
global.requestAnimationFrame=()=>{};
global.__DEV=true; global.__SKIP_INTRO=true;
eval(fs.readFileSync('game.js','utf8'));
const D=globalThis.AE_DEV;
console.log('go(6):', JSON.stringify(D.go(6)));
console.log('next:', JSON.stringify(D.next()).slice(0,90),'...');
console.log('go(14) coleta:', JSON.stringify({t:D.go(14).type,tgt:D.info().target,ci:D.info().collectIndex}));
console.log('reseed(123) L6:', D.go(6).seed, '->', D.reseed(123).seed);
const s=D.scan(1,100); console.log('scan 1..100 -> checked',s.checked,'fails',s.fails.length, s.fails.slice(0,10));
