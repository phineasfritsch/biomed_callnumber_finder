// Emit golden test vectors from the known-good JS comparator, for validating the Swift port.
const fs=require('fs');
const DATA=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
function parseCN(raw){
  let s=(raw||'').toUpperCase().replace(/\*/g,'');
  s=s.replace(/\.(?=[A-Z])/g,' ');
  const toks=s.trim().replace(/\s+/g,' ').split(' ').filter(Boolean);
  if(!toks.length) return [];
  const out=[];
  let classAlpha, classNum=0, rest=toks.slice(1);
  if(/^W[1-4][A-Z]{0,2}$/.test(toks[0])){ classAlpha=toks[0]; }
  else {
    const m0=toks[0].match(/^([A-Z]+)(\d+\.?\d*)?(.*)$/);
    if(m0){ classAlpha=m0[1]; if(m0[2]) classNum=parseFloat(m0[2]); if(m0[3]) rest=[m0[3]].concat(rest); }
    else classAlpha=toks[0];
    if(!classNum && rest.length && /^\d+\.?\d*$/.test(rest[0])){ classNum=parseFloat(rest[0]); rest=rest.slice(1); }
  }
  out.push({t:'A', a:classAlpha});
  out.push({t:'N', n:classNum});
  rest.forEach(t=>{ const mm=t.match(/^([A-Z]+)(\d*)([A-Z]*)$/);
    if(mm){ const d=mm[2]?parseFloat('0.'+mm[2]):0; out.push({t:'C', a:mm[1], n:d, s:mm[3]}); }
    else out.push({t:'C', a:t, n:0, s:''}); });
  return out;
}
function cmpSeg(a,b){
  if(!a) return -1; if(!b) return 1;
  if(a.t!==b.t) return a.t<b.t?-1:1;
  if(a.t==='A') return a.a===b.a?0:(a.a<b.a?-1:1);
  if(a.t==='N') return a.n===b.n?0:(a.n<b.n?-1:1);
  if(a.a!==b.a) return a.a<b.a?-1:1;
  if(a.n!==b.n) return a.n<b.n?-1:1;
  if(a.s!==b.s) return a.s<b.s?-1:1;
  return 0;
}
function cmpCN(x,y){ const a=parseCN(x), b=parseCN(y), n=Math.max(a.length,b.length);
  for(let i=0;i<n;i++){const c=cmpSeg(a[i],b[i]); if(c!==0) return c<0?-1:1;} return 0; }
function scheme(cn){ return /^\s*W[1-4]([A-Z]|\b)/i.test(cn||'') ? 'w1' : 'nlm'; }
// Level 9 is Special Collections: seventeen faces running `A` to `ZWZ 330`, so it
// contains almost every call number in the building. Including it here and then taking
// the lowest level routed every level-10 and level-11 book to level 9 -- all of both
// floors. It is excluded from routing, exactly as the catalog lookup already excluded it.
// The seam tiebreak has to be explicit. 237 of 651 endpoints are contained by two faces on the
// same level, and sorting by level alone leaves those ties to iteration order — which here is
// the raw JSON's (5|bot-1, 5|bot-2, … 5|bot-10), while the built index.html iterates
// `sorted(d.keys())` (5|bot-1, 5|bot-10, … 5|bot-2) and Swift's Dictionary iterates randomly
// per launch. Three different answers for the same book. Sorting by (level, key) is the one
// the web app and the Swift port both produce, so the golden file must produce it too.
function locate(cn){
  const qs=scheme(cn), hits=[];
  for(const key in DATA){ const d=DATA[key]; if(!d.start||!d.end) continue;
    if(key.startsWith('9|')) continue;
    if(scheme(d.start)!==qs) continue;
    if(cmpCN(cn,d.start)>=0 && cmpCN(cn,d.end)<=0){ const [lvl,id,side]=key.split('|'); hits.push({key,lvl:+lvl,id,side}); } }
  hits.sort((a,b)=> a.lvl!==b.lvl ? a.lvl-b.lvl : (a.key<b.key?-1:1));
  return hits[0] ? {lvl:hits[0].lvl, id:hits[0].id, side:hits[0].side} : null;
}

// 1. Every distinct endpoint, sorted by the real comparator -> order must match in Swift.
const all=new Set();
Object.values(DATA).forEach(d=>{ if(d.start) all.add(d.start); if(d.end) all.add(d.end); });
const sorted=[...all].sort(cmpCN);

// 2. Locate cases: each endpoint + real-world samples.
const samples=['W1 NA388 no.66 1984','W1 AM477','WM 13 D5537','W1 NA1991','W1 NA835','QL737.C22'];
const locates=[...new Set([...all,...samples])].map(cn=>({cn, hit:locate(cn)}));

// 2b. Search cases: the website's search box (index.html `locate()`), which is a DIFFERENT
// operation from routeLocate — returns every matching face, excludes Level 9. The Swift
// Router.search must match this exactly.
function searchAll(cn){
  const qs=scheme(cn), hits=[];
  for(const key in DATA){
    const d=DATA[key]; if(!d.start||!d.end) continue;
    if(key.startsWith('9|')) continue;                 // Special Collections excluded from search
    if(scheme(d.start)!==qs) continue;
    if(cmpCN(cn,d.start)>=0 && cmpCN(cn,d.end)<=0){ const [lvl,id,side]=key.split('|'); hits.push({key,lvl:+lvl,id,side}); }
  }
  hits.sort((a,b)=> a.lvl!==b.lvl ? a.lvl-b.lvl : (a.key<b.key?-1:1));
  return hits.map(({lvl,id,side})=>({lvl,id,side}));
}
const searches=[...new Set([...all,...samples])].map(cn=>({cn, hits:searchAll(cn)}));

// 3. Pairwise comparator cases that specifically exercise decimal-cutter ordering.
const pairs=[
  ['W1 NA388','W1 NA1991'], ['W1 NA388','W1 NA835'], ['W1 AM477','W1 AM4733'],
  ['W1 NA388','W1 NA388 no.66'], ['W 13','W1 A1C7'], ['QL737.C22','QL737 C22'],
].map(([a,b])=>({a,b,cmp:cmpCN(a,b)}));

fs.writeFileSync(process.argv[3], JSON.stringify({sortedOrder:sorted, locates, searches, pairs}, null, 1));
console.log('sorted endpoints:',sorted.length);
console.log('locate cases:',locates.length,'| resolved:',locates.filter(l=>l.hit).length);
console.log('search cases:',searches.length,'| multi-face:',searches.filter(s=>s.hits.length>1).length,'| max faces:',Math.max(...searches.map(s=>s.hits.length)));
console.log('pair cases:',pairs.length);
pairs.forEach(p=>console.log(`  cmp(${p.a}, ${p.b}) = ${p.cmp}`));
