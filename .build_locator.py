"""Build biomed-shelf-locator.html with the current JSON baked in."""
import json, os

REPO = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(REPO, 'biomed-shelf-ranges.json')
OUT_PATH = os.path.join(REPO, 'biomed-shelf-locator.html')

d = json.load(open(JSON_PATH))
parts = []
for k in sorted(d.keys()):
    v = d[k]
    parts.append(f'"{k}":{{"start":"{v["start"]}","end":"{v["end"]}"}}')
DATA_JS = '{' + ','.join(parts) + '}'

HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Biomed Stacks — Shelf Locator</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Spline+Sans+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root{
    --paper:#f3efe4; --paper-2:#ece6d6; --card:#fbf9f3;
    --ink:#26221a; --ink-soft:#6b6353; --line:#d8cfba;
    --green:#5b7d3a; --green-soft:#dde7cb;
    --orange:#c66a25; --orange-soft:#f3ddc6;
    --char:#3a3631; --char-soft:#d7d2c8;
    --slate:#6a7080; --slate-soft:#cdd2dc;
    --accent:#7a2e1e; --good:#3b6d3b; --hi:#1d9e75;
    --mono:'Spline Sans Mono', ui-monospace, monospace;
    --disp:'Fraunces', Georgia, serif;
  }
  *{box-sizing:border-box}
  body{margin:0; background:var(--paper); color:var(--ink); font-family:var(--disp); -webkit-font-smoothing:antialiased;
    background-image:radial-gradient(var(--paper-2) 0.5px, transparent 0.5px); background-size:14px 14px;}
  .wrap{max-width:1080px; margin:0 auto; padding:28px 22px 80px}
  header{display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:16px; border-bottom:2px solid var(--ink); padding-bottom:14px}
  h1{font-size:30px; font-weight:600; margin:0; letter-spacing:-0.5px}
  h1 .sub{display:block; font-size:13px; font-weight:400; color:var(--ink-soft); letter-spacing:1.5px; text-transform:uppercase; margin-top:4px}
  .coverage{font-family:var(--mono); font-size:12px; color:var(--ink-soft); text-align:right; line-height:1.5}
  .coverage b{color:var(--accent); font-size:18px}

  .lookup{display:flex; gap:8px; align-items:center; margin:18px 0 6px; padding:14px 16px; background:var(--card); border:1px solid var(--line); border-radius:12px; flex-wrap:wrap}
  .lookup label{font-size:15px; color:var(--ink-soft)}
  .lookup input{flex:1; font-family:var(--mono); font-size:16px; padding:11px 13px; border:1px solid var(--line); border-radius:8px; background:var(--paper); color:var(--ink); min-width:160px}
  .lookup input:focus{outline:none; border-color:var(--accent)}
  .btn{font-family:var(--mono); font-size:13px; padding:11px 16px; background:var(--ink); color:var(--paper); border:1px solid var(--ink); border-radius:8px; cursor:pointer; text-transform:uppercase; letter-spacing:.5px}
  .btn.ghost{background:var(--card); color:var(--ink); border-color:var(--line)}
  .btn:hover{opacity:.9}

  .result{margin:10px 0 0; min-height:24px; font-family:var(--mono); font-size:14px}
  .hit{background:var(--green-soft); border:1px solid #b9cd9b; border-radius:10px; padding:12px 14px; margin-bottom:8px}
  .hit .loc{font-size:16px; color:var(--good); font-weight:600}
  .hit .rng{color:var(--ink-soft); font-size:12.5px; margin-top:3px}
  .miss{color:var(--accent); padding:8px 2px}
  .examples{font-family:var(--mono); font-size:12px; color:var(--ink-soft); margin-top:8px}
  .examples b{color:var(--ink); cursor:pointer; border-bottom:1px dotted var(--ink-soft)}

  .levels{display:flex; flex-wrap:wrap; gap:5px; margin:20px 0 6px}
  .lvl{font-family:var(--mono); font-size:13px; min-width:46px; padding:8px 5px; text-align:center; background:var(--card); border:1px solid var(--line); border-radius:8px; cursor:pointer; color:var(--ink-soft)}
  .lvl:hover{border-color:var(--ink-soft)}
  .lvl.active{background:var(--ink); color:var(--paper); border-color:var(--ink); font-weight:600}
  .lvl.empty{opacity:.4}
  .lvl small{display:block; font-size:9px; margin-top:2px; letter-spacing:.3px}

  .stage{margin-top:8px; background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 10px 10px}
  .rowlabel{font-size:11px; color:var(--ink-soft); letter-spacing:1.5px; text-transform:uppercase; margin:0 0 0 12px}
  svg{display:block; width:100%; height:auto}
  .shelf{cursor:pointer}
  .shelf .frame{fill:none; stroke:var(--ink); stroke-width:1.4}
  .shelf.absent{cursor:default}
  .shelf.absent .frame{stroke:var(--line); stroke-dasharray:3 4; stroke-width:1}
  .shelf.sel .frame{stroke:var(--accent); stroke-width:2.6}
  .shelf.flash .frame{stroke:var(--hi); stroke-width:2.6}
  .idx{font-family:var(--mono); font-size:11px; fill:var(--ink-soft)}
  .face{font-family:var(--mono); font-size:8px; fill:var(--ink-soft)}

  .detail{margin-top:14px; background:var(--card); border:1px solid var(--line); border-radius:12px; padding:16px 20px; font-family:var(--mono); font-size:13px}
  .detail.empty{color:var(--ink-soft); text-align:center; padding:22px; font-family:var(--disp); font-size:15px}
  .detail h2{font-family:var(--disp); font-size:19px; margin:0 0 4px}
  .detail .meta{color:var(--ink-soft); font-size:12px; margin-bottom:10px}
  .detail .face-row{display:flex; gap:10px; padding:7px 0; border-top:1px solid var(--line)}
  .detail .face-row .fl{min-width:64px; color:var(--ink-soft)}
  .detail .face-row .rg{font-weight:500}
  footer{margin-top:26px; font-size:12px; color:var(--ink-soft); font-family:var(--mono); line-height:1.7}
  .legend{display:flex; gap:16px; flex-wrap:wrap; margin-top:10px; font-family:var(--mono); font-size:11px; color:var(--ink-soft); padding-left:12px}
  .legend span{display:inline-flex; align-items:center; gap:5px}
  .sw{width:11px; height:11px; border-radius:2px; display:inline-block}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Biomed stacks · shelf locator<span class="sub">enter a call number → find the shelf</span></h1>
    <div class="coverage" id="coverage"></div>
  </header>

  <div class="lookup">
    <label>Call number:</label>
    <input id="q" placeholder="e.g. W1 JO600  ·  W1 ME500  ·  BF 400  ·  WL 200" autocomplete="off" autofocus>
    <button class="btn" id="go">Locate</button>
    <button class="btn ghost" id="clear">Clear</button>
  </div>
  <div class="result" id="result">
    <div class="examples">Try:
      <b data-q="W1 BI700">W1 BI700</b> ·
      <b data-q="W1 JO600">W1 JO600</b> ·
      <b data-q="W1 ME500">W1 ME500</b> ·
      <b data-q="W1 PE200">W1 PE200</b> ·
      <b data-q="BF 400">BF 400</b> ·
      <b data-q="HM 271 M598o">HM 271 M598o</b>
    </div>
  </div>

  <div class="levels" id="levels"></div>

  <div class="stage">
    <div class="rowlabel">Top row →  (index 0–16)</div>
    <svg id="plan" viewBox="0 0 720 400" role="img" aria-label="Floor plan"></svg>
    <div class="legend">
      <span><i class="sw" style="background:var(--orange)"></i>orange · top-0 half (L3, L7)</span>
      <span><i class="sw" style="background:var(--green)"></i>green · top-1..16 full</span>
      <span><i class="sw" style="background:var(--char)"></i>black · bottom row</span>
      <span><i class="sw" style="background:var(--slate)"></i>slate · bot-0 half (L3)</span>
      <span>│ = double-sided · filled = mapped · — = unmapped</span>
    </div>
  </div>

  <div class="detail empty" id="detail">Tap any shelf to see its mapped ranges, or search a call number above.</div>

  <footer id="footer"></footer>
</div>

<script>
/* ===== embedded dataset ===== */
const DATA = __DATA__;

/* ===== NLM call-number comparator (matches the Python parser in the spec) ===== */
function parseCN(raw){
  const toks=(raw||'').trim().toUpperCase().replace(/\*/g,'').replace(/\s+/g,' ').split(' ').filter(Boolean);
  if(!toks.length) return [];
  const out=[];
  const m0=toks[0].match(/^([A-Z]+)(\d*\.?\d*)$/);
  let classAlpha, classNum, rest;
  if(m0){
    classAlpha=m0[1];
    rest=toks.slice(1);
    if(m0[2]){ classNum=parseFloat(m0[2]); }
    else if(rest.length && /^\d+\.?\d*$/.test(rest[0])){ classNum=parseFloat(rest[0]); rest=rest.slice(1); }
    else { classNum=0; }
  } else {
    classAlpha=toks[0]; classNum=0; rest=toks.slice(1);
  }
  out.push({t:'A', a:classAlpha});
  out.push({t:'N', n:classNum});
  rest.forEach(t=>{
    const mm=t.match(/^([A-Z]+)(\d*)([A-Z]*)$/);
    if(mm){
      const d=mm[2]?parseFloat('0.'+mm[2]):0;
      out.push({t:'C', a:mm[1], n:d, s:mm[3]});
    } else {
      out.push({t:'C', a:t, n:0, s:''});
    }
  });
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
function cmpCN(x,y){
  const a=parseCN(x), b=parseCN(y), n=Math.max(a.length,b.length);
  for(let i=0;i<n;i++){const c=cmpSeg(a[i],b[i]); if(c!==0) return c<0?-1:1;}
  return 0;
}

/* ===== layout =====
   Standard biomed grid:
     - top row: index 0 sometimes (half), 1..16 full
     - bot row: full at 1, 2, 3, 10, 11, 12, 15, 16; half at 14
   Floor 3 deviation: also has a bot-0 half (back-wall, right-side-only).
*/
const STACK_LEVELS=[1,2,3,4,5,6,7,8,9,10,11];
const SHELVES=[];
SHELVES.push({id:'top-0',  index:0, row:'top',    group:'orange', type:'half'});
SHELVES.push({id:'bot-0',  index:0, row:'bottom', group:'slate',  type:'half'});
for(let i=1;i<=16;i++) SHELVES.push({id:`top-${i}`,index:i,row:'top',group:'green',type:'full'});
[1,2,3,10,11,12,15,16].forEach(i=>SHELVES.push({id:`bot-${i}`,index:i,row:'bottom',group:'black',type:'full'}));
SHELVES.push({id:'bot-14',index:14,row:'bottom',group:'black',type:'half'});

/* which levels actually have data (computed from DATA) */
const levelsWithData={};
Object.keys(DATA).forEach(key=>{ levelsWithData[+key.split('|')[0]]=true; });

function existsOnLevel(s,lvl){
  if(s.id==='top-0') return lvl===3 || lvl===7;
  if(s.id==='bot-0') return lvl===3;
  return levelsWithData[lvl] === true;
}
const sidesOf = s => s.type==='full' ? ['left','right'] : ['single'];
const shelfById = id => SHELVES.find(s=>s.id===id);
const k=(lvl,id,side)=>`${lvl}|${id}|${side}`;

let level=3, selected=null, flashId=null;

/* ===== floor plan ===== */
const groupColor={green:'var(--green)',orange:'var(--orange)',black:'var(--char)',slate:'var(--slate)'};
const groupSoft ={green:'var(--green-soft)',orange:'var(--orange-soft)',black:'var(--char-soft)',slate:'var(--slate-soft)'};
const filled=(lvl,id,side)=>{const d=DATA[k(lvl,id,side)];return d&&d.start&&d.end;};

function renderPlan(){
  const startX=20, slotW=40, topY=46, topH=140, botY=232, botH=140;
  const cx=i=>startX+i*slotW+slotW/2;
  let svg='';
  SHELVES.forEach(s=>{
    const present=existsOnLevel(s,level);
    const y=s.row==='top'?topY:botY, h=s.row==='top'?topH:botH, c=cx(s.index);
    let cls='shelf'+(present?'':' absent')+(selected===s.id?' sel':'')+(flashId===s.id?' flash':'');
    const click=present?` onclick="pick('${s.id}')"`:'';
    let inner='';
    if(s.type==='full'){
      const w=14;
      const lFill = present && filled(level,s.id,'left');
      const rFill = present && filled(level,s.id,'right');
      const lf = lFill ? groupColor[s.group] : 'transparent';
      const rf = rFill ? groupColor[s.group] : 'transparent';
      inner+=`<rect x="${c-w}" y="${y}" width="${w}" height="${h}" fill="${lf}"/>`;
      inner+=`<rect x="${c}" y="${y}" width="${w}" height="${h}" fill="${rf}"/>`;
      inner+=`<line x1="${c}" y1="${y+5}" x2="${c}" y2="${y+h-5}" stroke="var(--line)" stroke-width="0.8"/>`;
      inner+=`<rect class="frame" x="${c-w}" y="${y}" width="${w*2}" height="${h}" rx="3"/>`;
      if(present){
        inner+=`<text class="face" x="${c-w/2}" y="${y+h-6}" text-anchor="middle">L</text>`;
        inner+=`<text class="face" x="${c+w/2}" y="${y+h-6}" text-anchor="middle">R</text>`;
        if(!lFill) inner+=`<text x="${c-w/2}" y="${y+h/2+5}" text-anchor="middle" font-family="var(--mono)" font-size="15" fill="var(--ink-soft)">—</text>`;
        if(!rFill) inner+=`<text x="${c+w/2}" y="${y+h/2+5}" text-anchor="middle" font-family="var(--mono)" font-size="15" fill="var(--ink-soft)">—</text>`;
      }
    } else {
      const w=9;
      const sFill = present && filled(level,s.id,'single');
      const sf = sFill ? groupColor[s.group] : 'transparent';
      inner+=`<rect x="${c-w}" y="${y}" width="${w*2}" height="${h}" fill="${sf}"/>`;
      inner+=`<rect class="frame" x="${c-w}" y="${y}" width="${w*2}" height="${h}" rx="3"/>`;
      if(present){
        inner+=`<text class="face" x="${c}" y="${y+h-6}" text-anchor="middle">R</text>`;
        if(!sFill) inner+=`<text x="${c}" y="${y+h/2+5}" text-anchor="middle" font-family="var(--mono)" font-size="15" fill="var(--ink-soft)">—</text>`;
      }
    }
    svg+=`<g class="${cls}"${click}>${inner}</g>`;
  });
  for(let i=0;i<=16;i++) svg+=`<text class="idx" x="${cx(i)}" y="38" text-anchor="middle">${i}</text>`;
  svg+=`<text class="idx" x="${startX}" y="${botY-8}" text-anchor="start" style="letter-spacing:1.5px">▾ bottom row</text>`;
  const plan=document.getElementById('plan');
  plan.innerHTML=svg; plan.setAttribute('viewBox',`0 0 720 ${botY+botH+16}`);
}

/* ===== levels bar ===== */
function renderLevels(){
  const el=document.getElementById('levels'); el.innerHTML='';
  STACK_LEVELS.forEach(l=>{
    const has=levelsWithData[l];
    const n = has ? Object.keys(DATA).filter(k=>k.startsWith(l+'|')).length : 0;
    const b=document.createElement('div');
    b.className='lvl'+(l===level?' active':'')+(has?'':' empty');
    b.innerHTML=`${l}<small>${has?n+' faces':'—'}</small>`;
    b.onclick=()=>{ level=l; selected=null; flashId=null; renderLevels(); renderPlan(); renderDetail(); };
    el.appendChild(b);
  });
}

/* ===== detail panel ===== */
const sideName={left:'Left',right:'Right',single:'Single (R)'};
function pick(id){ selected=id; flashId=null; renderPlan(); renderDetail(); }
window.pick=pick;
function renderDetail(){
  const el=document.getElementById('detail');
  if(!selected){ el.className='detail empty'; el.textContent='Tap any shelf to see its mapped ranges, or search a call number above.'; return; }
  const s=shelfById(selected); el.className='detail';
  let html=`<h2>Index ${s.index} · ${s.row} row</h2><div class="meta">level ${level} · ${s.group} · ${s.type}-shelf</div>`;
  let any=false;
  sidesOf(s).forEach(side=>{
    const d=DATA[k(level,s.id,side)];
    if(d){any=true; html+=`<div class="face-row"><span class="fl">${sideName[side]}</span><span class="rg">${d.start} → ${d.end}</span></div>`;}
  });
  if(!any) html+=`<div class="face-row"><span class="rg" style="color:var(--ink-soft)">No ranges mapped on this level yet.</span></div>`;
  el.innerHTML=html;
}

/* ===== lookup ===== */
function locate(){
  const q=document.getElementById('q').value.trim();
  const out=document.getElementById('result');
  if(!q){ out.innerHTML=''; return; }
  const hits=[];
  for(const key in DATA){
    const d=DATA[key]; if(!d.start||!d.end) continue;
    if(cmpCN(q,d.start)>=0 && cmpCN(q,d.end)<=0){
      const [lvl,id,side]=key.split('|'); hits.push({lvl:+lvl,id,side,d});
    }
  }
  if(hits.length){
    hits.sort((a,b)=>a.lvl-b.lvl);
    out.innerHTML=hits.map(h=>{
      const s=shelfById(h.id);
      return `<div class="hit"><div class="loc">Level ${h.lvl} · ${s.row} row · index ${s.index} · ${sideName[h.side]} side</div>`
        +`<div class="rng">${h.d.start} → ${h.d.end}</div></div>`;
    }).join('')
    + (hits.length>1?`<div class="examples">${hits.length} shelves match — for serials, check the volume/year on the spine to pick the right one.</div>`:'');
    const first=hits[0]; level=first.lvl; selected=first.id; flashId=first.id;
    renderLevels(); renderPlan(); renderDetail();
    setTimeout(()=>{flashId=null;renderPlan();},1600);
  } else {
    out.innerHTML=`<div class="miss">No mapped shelf contains <b>${q.toUpperCase()}</b>. It may be on a shelf/level not yet entered, or just outside the mapped ranges.</div>`;
  }
}

/* ===== coverage summary ===== */
function renderCoverage(){
  const lv=Object.keys(levelsWithData).map(Number).sort((a,b)=>a-b);
  document.getElementById('coverage').innerHTML=`<b>${Object.keys(DATA).length}</b> shelf-sides mapped<br>levels ${lv.join(', ')}`;
}

document.getElementById('footer').innerHTML=
  'Lookup compares NLM call numbers by class, then class-number, then Cutter-as-decimal, then suffix. '+
  'Full shelves are double-sided (left + right); a few serial shelves share one call number across many volumes, so a search there returns every matching shelf. '+
  'Floors 2, 3, 5, 6, 7 are densely mapped in the W1 (biomed) scheme; floors 8 and 11 have partial NLM coverage.';

/* ===== init ===== */
renderCoverage(); renderLevels(); renderPlan(); renderDetail();
document.getElementById('go').onclick=locate;
document.getElementById('clear').onclick=()=>{document.getElementById('q').value='';document.getElementById('result').innerHTML='';selected=null;flashId=null;renderPlan();renderDetail();};
document.getElementById('q').addEventListener('keydown',e=>{if(e.key==='Enter')locate();});
document.querySelectorAll('.examples b').forEach(b=>b.onclick=()=>{document.getElementById('q').value=b.dataset.q;locate();});
</script>
</body>
</html>
"""

html = HTML.replace('__DATA__', DATA_JS)
with open(OUT_PATH, 'w', encoding='utf-8') as f:
    f.write(html)

print(f'wrote {OUT_PATH}: {len(html)} chars')
print(f'embedded {len(d)} keys across {len({k.split("|")[0] for k in d})} floors')
