// Emit route golden vectors using the EXACT algorithm from index.html's buildRoute,
// for validating the Swift Router port.
const fs=require('fs');
const DATA=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const ELEV_X=6.5, STAIR_W=6.5, STAIR_E=13.5;

function parseCN(raw){
  let s=(raw||'').toUpperCase().replace(/\*/g,'');
  s=s.replace(/\.(?=[A-Z])/g,' ');
  const toks=s.trim().replace(/\s+/g,' ').split(' ').filter(Boolean);
  if(!toks.length) return [];
  const out=[]; let classAlpha, classNum=0, rest=toks.slice(1);
  if(/^W[1-4][A-Z]{0,2}$/.test(toks[0])){ classAlpha=toks[0]; }
  else { const m0=toks[0].match(/^([A-Z]+)(\d+\.?\d*)?(.*)$/);
    if(m0){ classAlpha=m0[1]; if(m0[2]) classNum=parseFloat(m0[2]); if(m0[3]) rest=[m0[3]].concat(rest); }
    else classAlpha=toks[0];
    if(!classNum && rest.length && /^\d+\.?\d*$/.test(rest[0])){ classNum=parseFloat(rest[0]); rest=rest.slice(1); } }
  out.push({t:'A',a:classAlpha}); out.push({t:'N',n:classNum});
  rest.forEach(t=>{ const mm=t.match(/^([A-Z]+)(\d*)([A-Z]*)$/);
    if(mm){ const d=mm[2]?parseFloat('0.'+mm[2]):0; out.push({t:'C',a:mm[1],n:d,s:mm[3]}); }
    else out.push({t:'C',a:t,n:0,s:''}); });
  return out;
}
function cmpSeg(a,b){ if(!a) return -1; if(!b) return 1;
  if(a.t!==b.t) return a.t<b.t?-1:1;
  if(a.t==='A') return a.a===b.a?0:(a.a<b.a?-1:1);
  if(a.t==='N') return a.n===b.n?0:(a.n<b.n?-1:1);
  if(a.a!==b.a) return a.a<b.a?-1:1;
  if(a.n!==b.n) return a.n<b.n?-1:1;
  if(a.s!==b.s) return a.s<b.s?-1:1; return 0; }
function cmpCN(x,y){ const a=parseCN(x), b=parseCN(y), n=Math.max(a.length,b.length);
  for(let i=0;i<n;i++){const c=cmpSeg(a[i],b[i]); if(c!==0) return c<0?-1:1;} return 0; }
function scheme(cn){ return /^\s*W[1-4]([A-Z]|\b)/i.test(cn||'') ? 'w1' : 'nlm'; }
function routeLocate(cn){ const qs=scheme(cn), hits=[];
  for(const key in DATA){ const d=DATA[key]; if(!d.start||!d.end) continue; if(scheme(d.start)!==qs) continue;
    if(cmpCN(cn,d.start)>=0 && cmpCN(cn,d.end)<=0){ const [lvl,id,side]=key.split('|'); hits.push({lvl:+lvl,id,side,d}); } }
  hits.sort((a,b)=>a.lvl-b.lvl); return hits; }

// SHELVES table
const SHELVES=[];
SHELVES.push({id:'top-0',index:0,row:'top'});
SHELVES.push({id:'bot-0',index:0,row:'bottom'});
for(let i=1;i<=16;i++) SHELVES.push({id:`top-${i}`,index:i,row:'top'});
[1,2,3,10,11,12,15,16].forEach(i=>SHELVES.push({id:`bot-${i}`,index:i,row:'bottom'}));
SHELVES.push({id:'bot-14',index:14,row:'bottom'});
const shelfById=id=>SHELVES.find(s=>s.id===id);

function sweep(L,R,s,e){
  const a=Math.abs(s-L)+(R-L)+Math.abs(R-e), b=Math.abs(s-R)+(R-L)+Math.abs(L-e);
  return a<=b?{cost:a,dir:'LR'}:{cost:b,dir:'RL'};
}
const rowOrd=s=>s.row==='top'?0:1;
function groupStops(items){
  const m={};
  items.forEach(it=>{ const s=shelfById(it.hit.id), key=it.hit.id+'|'+it.hit.side;
    if(!m[key]) m[key]={id:it.hit.id,side:it.hit.side,x:s?s.index:8,row:s?s.row:'',d:it.hit.d,cns:[]};
    m[key].cns.push(it.cn); });
  return Object.values(m);
}

function buildRoute(want){
  want=[...new Set(want)];
  const located=[], missing=[];
  want.forEach(cn=>{ const h=routeLocate(cn); if(h.length) located.push({cn,hit:h[0]}); else missing.push(cn); });
  if(!located.length) return {steps:[],unlocated:missing,bookCount:0,stairs:0,skips:0};
  const byLvl={};
  located.forEach(it=>{ (byLvl[it.hit.lvl]=byLvl[it.hit.lvl]||[]).push(it); });
  const levels=Object.keys(byLvl).map(Number).sort((a,b)=>b-a);

  let entry=ELEV_X, stairs=0, skips=0;
  const steps=[{type:'transit',kind:'elevator',to:levels[0],skipping:0}];
  for(let i=0;i<levels.length;i++){
    const lvl=levels[i], stops=groupStops(byLvl[lvl]);
    const xs=stops.map(s=>s.x), L=Math.min(...xs), R=Math.max(...xs);
    let exit=ELEV_X, nextTransit=null, nextEntry=ELEV_X;
    if(i<levels.length-1){
      const nlvl=levels[i+1], gap=lvl-nlvl;
      if(gap===1){
        const ns=groupStops(byLvl[nlvl]), nc=ns.reduce((a,s)=>a+s.x,0)/ns.length;
        let best=null;
        [['west',STAIR_W],['east',STAIR_E]].forEach(([nm,x])=>{ const sc=sweep(L,R,entry,x).cost+Math.abs(x-nc); if(!best||sc<best.sc) best={nm,x,sc}; });
        exit=best.x; nextEntry=best.x; stairs++;
        nextTransit={type:'transit',kind:'stairs',well:best.nm,to:nlvl};
      } else {
        exit=ELEV_X; nextEntry=ELEV_X; skips++;
        nextTransit={type:'transit',kind:'elevator',to:nlvl,skipping:gap-1};
      }
    }
    const dir=sweep(L,R,entry,exit).dir;
    stops.sort((a,b)=> dir==='LR' ? (a.x-b.x)||(rowOrd(a)-rowOrd(b)) : (b.x-a.x)||(rowOrd(a)-rowOrd(b)));
    steps.push({type:'floor',level:lvl,direction:dir,stops:stops.map(s=>({id:s.id,side:s.side,x:s.x,cns:s.cns}))});
    if(nextTransit) steps.push(nextTransit);
    entry=nextEntry;
  }
  return {steps,unlocated:missing,bookCount:located.length,stairs,skips};
}

// Deterministic sample trips exercising: single floor, adjacent floors (stairs),
// skipped floors (elevator), and both sweep directions.
const trips=[
  { name:'single-book',   cns:['W1 NA388 no.66 1984'] },
  { name:'one-floor',     cns:['W1 NA388 no.66 1984','W1 NA835','W1 NA1991'] },
  { name:'multi-floor',   cns:['W1 NA388 no.66 1984','W1 AM477','WM 13 D5537','W1 AN819','W1 MO283'] },
  { name:'wide-sweep',    cns:['W1 A1C7','W1 AM477','W1 AN819','W1 AO671','W1 AQ141','W1 AR405','W1 AT257','W1 AU759'] },
  { name:'with-unlocated',cns:['W1 NA388 no.66 1984','ZZ 999 X1'] },
];
const out=trips.map(t=>({name:t.name, input:t.cns, expected:buildRoute(t.cns)}));
fs.writeFileSync(process.argv[3], JSON.stringify(out,null,1));
for(const t of out){
  const s=t.expected;
  console.log(`${t.name.padEnd(16)} books=${s.bookCount} steps=${s.steps.length} stairs=${s.stairs} skips=${s.skips} unlocated=${s.unlocated.length}`);
  s.steps.forEach(st=>{
    if(st.type==='transit') console.log(`   transit: ${st.kind}${st.well?'/'+st.well:''} -> L${st.to}${st.skipping?` (skip ${st.skipping})`:''}`);
    else console.log(`   floor L${st.level} dir=${st.direction} stops=${st.stops.map(x=>x.id+'/'+x.side).join(', ')}`);
  });
}
