"""Build biomed-shelf-locator.html (and index.html for CF Pages) with the current JSON baked in."""
import json, os, shutil

REPO = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(REPO, 'biomed-shelf-ranges.json')
OUT_PATH = os.path.join(REPO, 'biomed-shelf-locator.html')
INDEX_PATH = os.path.join(REPO, 'index.html')  # CF Pages entry point

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
    --ink-faint:#9a9080; --r:12px;
    --mono:'Spline Sans Mono', ui-monospace, monospace;
    --disp:'Fraunces', Georgia, serif;
  }
  *{box-sizing:border-box}
  body{margin:0; background:var(--paper); color:var(--ink); font-family:var(--mono); font-size:13px; line-height:1.5; -webkit-font-smoothing:antialiased;
    background-image:radial-gradient(var(--paper-2) 0.5px, transparent 0.5px); background-size:14px 14px;}
  .wrap{max-width:1060px; margin:0 auto; padding:30px 22px 80px}
  header{display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:14px; border-bottom:2px solid var(--ink); padding-bottom:16px}
  h1{font-family:var(--disp); font-size:30px; font-weight:600; margin:0; letter-spacing:-0.4px; line-height:1.05}
  h1 .sub{display:block; font-size:11px; font-weight:400; color:var(--ink-soft); letter-spacing:1.6px; text-transform:uppercase; margin-top:6px}
  .coverage{font-size:11px; color:var(--ink-soft); text-align:right; line-height:1.6}
  .coverage b{color:var(--accent); font-size:16px; font-weight:600}

  .lookup{display:flex; gap:8px; align-items:center; margin:20px 0 10px; padding:12px 14px; background:var(--card); border:1px solid var(--line); border-radius:var(--r); flex-wrap:wrap}
  .lookup label{font-size:11px; color:var(--ink-soft); text-transform:uppercase; letter-spacing:1px}
  .lookup input{flex:1; font-family:var(--mono); font-size:15px; padding:11px 13px; border:1px solid var(--line); border-radius:8px; background:var(--paper); color:var(--ink); min-width:180px}
  .lookup input:focus{outline:none; border-color:var(--accent); box-shadow:0 0 0 3px var(--orange-soft)}
  .btn{font-family:var(--mono); font-size:11px; font-weight:600; padding:11px 16px; background:var(--ink); color:var(--paper); border:1px solid var(--ink); border-radius:8px; cursor:pointer; text-transform:uppercase; letter-spacing:.8px}
  .btn.ghost{background:transparent; color:var(--ink-soft); border-color:var(--line)}
  .btn:hover{opacity:.88}

  .result{margin:12px 0 0; min-height:20px}
  .hit{background:var(--green-soft); border:1px solid #bcce9e; border-radius:10px; padding:11px 14px; margin-bottom:7px}
  .hit .loc{font-size:13px; font-weight:600; color:var(--ink)}
  .hit .rng{font-size:12px; color:var(--ink-soft); margin-top:4px; letter-spacing:.2px}
  .miss{font-size:13px; color:var(--accent); padding:8px 2px}
  .examples{font-size:11px; color:var(--ink-soft); margin-top:8px}
  .examples b{color:var(--ink); font-weight:500; cursor:pointer; border-bottom:1px dotted var(--ink-faint)}
  .examples b:hover{color:var(--accent); border-color:var(--accent)}

  .sect{display:flex; gap:6px; align-items:center; margin:8px 2px 0; flex-wrap:wrap}
  .sect-label{font-size:11px; color:var(--ink-soft); text-transform:uppercase; letter-spacing:1px; margin-right:4px}
  .pill{font-family:var(--mono); font-size:11px; padding:6px 13px; background:var(--card); color:var(--ink-soft); border:1px solid var(--line); border-radius:99px; cursor:pointer; transition:.15s}
  .pill:hover{border-color:var(--ink-soft); color:var(--ink)}
  .pill.active{background:var(--ink); color:var(--paper); border-color:var(--ink)}

  .levels{display:flex; flex-wrap:wrap; gap:5px; margin:22px 0 8px}
  .lvl{font-family:var(--mono); font-size:13px; font-weight:500; min-width:48px; padding:7px 5px 6px; text-align:center; background:var(--card); border:1px solid var(--line); border-radius:8px; cursor:pointer; color:var(--ink-soft)}
  .lvl:hover{border-color:var(--ink-soft); color:var(--ink)}
  .lvl.active{background:var(--ink); color:var(--paper); border-color:var(--ink); font-weight:600}
  .lvl.empty{opacity:.45}
  .lvl.special{opacity:1; border-style:dashed; border-color:var(--ink-soft)}
  .lvl.special small{color:var(--accent)}
  .lvl small{display:block; font-size:9.5px; font-weight:400; margin-top:3px; letter-spacing:.2px; opacity:.9}

  .stage{margin-top:6px; background:var(--card); border:1px solid var(--line); border-radius:var(--r); padding:8px 12px 12px}
  svg{display:block; width:100%; height:auto}
  .shelf{cursor:pointer}
  .shelf .frame{fill:none; stroke:var(--ink); stroke-width:1.4}
  .shelf.absent{cursor:default}
  .shelf.absent .frame{stroke:var(--line); stroke-dasharray:3 4; stroke-width:1}
  .shelf.sel .frame{stroke:var(--accent); stroke-width:2.6}
  .shelf.flash .frame{stroke:var(--hi); stroke-width:2.6}
  .idx{font-family:var(--mono); font-size:11px; fill:var(--ink-soft)}
  .face{font-family:var(--mono); font-size:8px; fill:var(--ink-faint)}

  .detail{margin-top:14px; background:var(--card); border:1px solid var(--line); border-radius:var(--r); padding:16px 20px}
  .detail.empty{color:var(--ink-soft); text-align:center; padding:22px; font-size:13px}
  .detail h2{font-family:var(--disp); font-size:18px; font-weight:600; margin:0 0 3px}
  .detail .meta{font-size:11px; color:var(--ink-soft); text-transform:uppercase; letter-spacing:.8px; margin-bottom:8px}
  .detail .face-row{display:flex; gap:12px; padding:8px 0; border-top:1px solid var(--line); font-size:13px}
  .detail .face-row .fl{min-width:64px; color:var(--ink-soft); text-transform:uppercase; font-size:11px; letter-spacing:.5px; padding-top:1px}
  .detail .face-row .rg{font-weight:500}
  footer{margin-top:28px; padding-top:16px; border-top:1px solid var(--line); font-size:11px; color:var(--ink-soft); line-height:1.75; max-width:760px}
  .legend{display:flex; gap:14px; flex-wrap:wrap; margin-top:12px; padding-left:2px; font-size:11px; color:var(--ink-soft)}
  .legend span{display:inline-flex; align-items:center; gap:6px}
  .sw{width:11px; height:11px; border-radius:3px; display:inline-block; border:1px solid rgba(0,0,0,.12)}
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
    <input id="q" placeholder="call number or paste full catalog page" autocomplete="off" autofocus>
    <button class="btn" id="go">Locate</button>
    <button class="btn ghost" id="clear">Clear</button>
  </div>
  <div class="sect" id="sect">
    <span class="sect-label">Section:</span>
    <button class="pill active" data-coll="stacks">Main stacks</button>
    <button class="pill" data-coll="ref">Reference · L4</button>
    <button class="pill" data-coll="spec">Special Collections · L9</button>
  </div>
  <div class="result" id="result">
    <div class="examples">Try:
      <b data-q="QL737.C22 M616g">QL737.C22</b> ·
      <b data-q="W1 BI700">W1 BI700</b> ·
      <b data-q="W1 JO600">W1 JO600</b> ·
      <b data-q="QW 4 S851b">QW 4 S851b</b> ·
      <b data-q="BF 400">BF 400</b> ·
      <b data-q="WS 200 P370">WS 200 P370</b>
    </div>
  </div>

  <div class="levels" id="levels"></div>

  <div class="stage">
    <svg id="plan" viewBox="0 0 720 400" role="img" aria-label="Floor plan"></svg>
    <div class="legend">
      <span><i class="sw" style="background:var(--orange)"></i>orange · top-0 half (L3, L7)</span>
      <span><i class="sw" style="background:var(--green)"></i>green · top-1..16 full</span>
      <span><i class="sw" style="background:var(--char)"></i>black · bottom row</span>
      <span><i class="sw" style="background:var(--slate)"></i>slate · bot-0 half (L3)</span>
      <span><i class="sw" style="background:var(--orange)"></i>stairs</span>
      <span><i class="sw" style="background:var(--accent)"></i>elevator</span>
      <span>│ = double-sided · filled = mapped · — = unmapped</span>
    </div>
  </div>

  <div class="detail empty" id="detail">Tap any shelf to see its mapped ranges, or search a call number above.</div>

  <footer id="footer"></footer>
</div>

<script>
/* ===== embedded dataset ===== */
const DATA = __DATA__;

/* ===== NLM call-number comparator =====
   Tolerant of how people actually type call numbers:
   "QL737.C22 M616g 1971" parses the same as the stored "QL 737 C22 M616g 1971".
   - an LC-style cutter dot (a '.' before a letter) starts a new Cutter
   - a class number jammed onto the letters (QL737) or onto a cutter (QL737C22) is split out
   - a decimal class number (WL102.8) is preserved
*/
function parseCN(raw){
  let s=(raw||'').toUpperCase().replace(/\*/g,'');
  s=s.replace(/\.(?=[A-Z])/g,' ');           // ".C22" -> " C22" (cutter dot), leaves "102.8" alone
  const toks=s.trim().replace(/\s+/g,' ').split(' ').filter(Boolean);
  if(!toks.length) return [];
  const out=[];
  let classAlpha, classNum=0, rest=toks.slice(1);
  if(/^W[1-4][A-Z]{0,2}$/.test(toks[0])){
    // Biomedical serials prefix (W1, W2, W3, W4C). Keep it as an opaque class so it
    // never collides with NLM class W + number (e.g. "W 13" on floor 10).
    classAlpha=toks[0];
  } else {
    // NLM: class letters, optional class number, optional jammed cutter
    const m0=toks[0].match(/^([A-Z]+)(\d+\.?\d*)?(.*)$/);
    if(m0){
      classAlpha=m0[1];
      if(m0[2]) classNum=parseFloat(m0[2]);
      if(m0[3]) rest=[m0[3]].concat(rest);    // leftover jammed cutter, e.g. "QL737C22" -> "C22"
    } else {
      classAlpha=toks[0];
    }
    // class number may instead be the next standalone token (NLM: "QL 737 C22")
    if(!classNum && rest.length && /^\d+\.?\d*$/.test(rest[0])){ classNum=parseFloat(rest[0]); rest=rest.slice(1); }
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
/* Two classification namespaces share the letter W: the biomedical serials prefix
   (W1, W2, W3, W4C — floors 1–7) and NLM class W + number (e.g. "W 13" — floor 10).
   They must never match across schemes, so gate containment by scheme. */
function scheme(cn){ return /^\s*W[1-4]([A-Z]|\b)/i.test(cn||'') ? 'w1' : 'nlm'; }

/* ===== layout =====
   Standard biomed grid:
     - top row: index 0 sometimes (half), 1..16 full
     - bot row: full at 1, 2, 3, 10, 11, 12, 15, 16; half at 14
   Floor 3 deviation: also has a bot-0 half (back-wall, right-side-only).
*/
const STACK_LEVELS=[1,2,3,4,5,6,7,8,9,10,11];
const SPECIAL_FLOORS={4:'Reference'};
const COLL_TO_LEVEL={ref:4, spec:9};
const LEVEL_TO_COLL={4:'ref'};
let collection='stacks';
const SHELVES=[];
SHELVES.push({id:'top-0',  index:0, row:'top',    group:'orange', type:'half'});
SHELVES.push({id:'bot-0',  index:0, row:'bottom', group:'slate',  type:'half'});
for(let i=1;i<=16;i++) SHELVES.push({id:`top-${i}`,index:i,row:'top',group:'green',type:'full'});
[1,2,3,10,11,12,15,16].forEach(i=>SHELVES.push({id:`bot-${i}`,index:i,row:'bottom',group:'black',type:'full'}));
SHELVES.push({id:'bot-14',index:14,row:'bottom',group:'black',type:'half'});

/* which levels actually have data (computed from DATA) */
const levelsWithData={};
Object.keys(DATA).forEach(key=>{ levelsWithData[+key.split('|')[0]]=true; });

/* Floor 9: Special Collections — standard bottom row only, no top row */
const FLOOR9_BOT=new Set(['bot-1','bot-2','bot-3','bot-10','bot-11','bot-12','bot-14','bot-15','bot-16']);
function existsOnLevel(s,lvl){
  if(s.id==='top-0') return lvl===3 || lvl===7;
  if(s.id==='bot-0') return lvl===3;
  if(lvl===9) return FLOOR9_BOT.has(s.id);
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
  const plan=document.getElementById('plan');
  if(SPECIAL_FLOORS[level]){
    const name=SPECIAL_FLOORS[level];
    plan.innerHTML =
      `<rect x="40" y="40" width="640" height="160" rx="14" fill="var(--paper-2)" stroke="var(--line)" stroke-dasharray="6 5" stroke-width="1.2"/>`+
      `<text x="360" y="92" text-anchor="middle" font-family="var(--disp)" font-size="26" font-weight="600" fill="var(--accent)">${name}</text>`+
      `<text x="360" y="118" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--ink-soft)" letter-spacing="2">FLOOR ${level}</text>`+
      `<text x="360" y="152" text-anchor="middle" font-family="var(--mono)" font-size="12" fill="var(--ink)">All ${name.toLowerCase()} books are on this floor.</text>`+
      `<text x="360" y="172" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--ink-soft)">Books are shelved by call number. No per-shelf map.</text>`;
    plan.setAttribute('viewBox','0 0 720 230');
    return;
  }
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
      // half shelves are right-side only: start at cx (not cx-w)
      inner+=`<rect x="${c}" y="${y}" width="${w*2}" height="${h}" fill="${sf}"/>`;
      inner+=`<rect class="frame" x="${c}" y="${y}" width="${w*2}" height="${h}" rx="3"/>`;
      if(present){
        inner+=`<text class="face" x="${c+w}" y="${y+h-6}" text-anchor="middle">R</text>`;
        if(!sFill) inner+=`<text x="${c+w}" y="${y+h/2+5}" text-anchor="middle" font-family="var(--mono)" font-size="15" fill="var(--ink-soft)">—</text>`;
      }
    }
    svg+=`<g class="${cls}"${click}>${inner}</g>`;
  });
  for(let i=0;i<=16;i++) svg+=`<text class="idx" x="${cx(i)}" y="38" text-anchor="middle">${i}</text>`;
  // Both row labels are SVG text at the SAME font-size so they scale identically with the plan.
  const rlbl=`text-anchor="start" font-family="var(--mono)" font-size="11" fill="var(--ink-soft)" letter-spacing="0.6"`;
  svg+=`<text x="${startX+2}" y="16" ${rlbl}>top row · index 0–16</text>`;
  svg+=`<text x="${startX+2}" y="${botY-7}" ${rlbl}>bottom row · index 0–16</text>`;

  /* ── Architectural features (elevator + stairs) — same on every floor ── */
  const ax=i=>startX+i*slotW;       // left edge of slot i
  const fstroke=`stroke="var(--ink)" stroke-width="1.3"`;

  // ── Block 1: Elevator + Stairs (indices 5–8, bottom row) ──
  const eLeft=ax(5), eW=(ax(9)-ax(5));
  const stairsH=Math.round(botH*0.38);
  const stairsInset=18;   // each corner gap is this wide

  // Stairs: narrower block at the TOP — corner rectangles each side are just blank page background
  svg+=`<rect x="${eLeft+stairsInset}" y="${botY}" width="${eW-2*stairsInset}" height="${stairsH}" rx="4" fill="var(--orange)" ${fstroke}/>`;
  svg+=`<text x="${eLeft+eW/2}" y="${botY+stairsH/2+5}" text-anchor="middle" font-family="var(--mono)" font-size="9" fill="var(--paper)" letter-spacing="1.5">STAIRS</text>`;

  // Elevator: full width, starts BELOW the stairs block — corners stay blank
  const elevTop=botY+stairsH+2;  // 2px gap
  svg+=`<rect x="${eLeft}" y="${elevTop}" width="${eW}" height="${botH-stairsH-2}" rx="4" fill="var(--accent)" ${fstroke}/>`;
  svg+=`<text x="${eLeft+eW/2}" y="${elevTop+(botH-stairsH-2)/2+4}" text-anchor="middle" font-family="var(--mono)" font-size="9" fill="var(--paper)" letter-spacing="1.5">ELEVATOR</text>`;

  // ── Block 2: Stairs at index 13 + left half of slot 14 ──
  // Ends at cx(14) — does NOT overlap the right-aligned bot-14|single half shelf
  const s2Left=ax(13), s2Right=startX+14*slotW+slotW/2-2, s2W=s2Right-s2Left;
  svg+=`<rect x="${s2Left}" y="${botY}" width="${s2W}" height="${botH}" rx="4" fill="var(--orange)" ${fstroke}/>`;
  svg+=`<text x="${s2Left+s2W/2}" y="${botY+botH/2+5}" text-anchor="middle" font-family="var(--mono)" font-size="9" fill="var(--paper)" letter-spacing="1.5">STAIRS</text>`;

  plan.innerHTML=svg; plan.setAttribute('viewBox',`0 0 720 ${botY+botH+16}`);
}

/* ===== section pills + level sync ===== */
function setCollection(coll){
  collection = coll;
  document.querySelectorAll('.pill').forEach(p=>p.classList.toggle('active', p.dataset.coll===coll));
}
function syncCollectionToLevel(){
  setCollection(LEVEL_TO_COLL[level] || 'stacks');
}

/* ===== levels bar ===== */
function renderLevels(){
  const el=document.getElementById('levels'); el.innerHTML='';
  STACK_LEVELS.forEach(l=>{
    const has=levelsWithData[l];
    const special = SPECIAL_FLOORS[l];
    const n = has ? Object.keys(DATA).filter(k=>k.startsWith(l+'|')).length : 0;
    const b=document.createElement('div');
    let cls='lvl'+(l===level?' active':'');
    if(!has){ cls += special ? ' special' : ' empty'; }
    b.className=cls;
    const sub = has ? (n+' faces') : (special ? (l===4?'Ref':'Spec') : '—');
    b.innerHTML=`${l}<small>${sub}</small>`;
    b.onclick=()=>{ level=l; selected=null; flashId=null; syncCollectionToLevel(); renderLevels(); renderPlan(); renderDetail(); };
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
  if(collection==='ref'){
    const subject = q ? `<b>${q.toUpperCase()}</b>` : 'Your book';
    out.innerHTML = `<div class="hit"><div class="loc">Floor 4 · Reference</div>`+
      `<div class="rng">${subject} is in the reference section on floor 4. Books are shelved by call number.</div></div>`;
    level=4; selected=null; flashId=null;
    renderLevels(); renderPlan(); renderDetail();
    return;
  }
  if(collection==='spec'){
    if(!q){ out.innerHTML=''; level=9; renderLevels(); renderPlan(); renderDetail(); return; }
    const qs=scheme(q);
    const hits=[];
    for(const key in DATA){
      const dd=DATA[key]; if(!dd.start||!dd.end) continue;
      if(!key.startsWith('9|')) continue;
      if(scheme(dd.start)!==qs) continue;
      if(cmpCN(q,dd.start)>=0 && cmpCN(q,dd.end)<=0){
        const [lvl,id,side]=key.split('|'); hits.push({lvl:+lvl,id,side,d:dd});
      }
    }
    if(hits.length){
      out.innerHTML=hits.map(h=>{
        const s=shelfById(h.id);
        return `<div class="hit"><div class="loc">Level 9 · Special Collections · ${s?s.row+' row · index '+s.index:'shelf '+h.id} · ${sideName[h.side]} side</div>`
          +`<div class="rng">${h.d.start} → ${h.d.end}</div></div>`;
      }).join('');
      level=9; selected=hits[0].id; flashId=hits[0].id;
      renderLevels(); renderPlan(); renderDetail();
      setTimeout(()=>{flashId=null;renderPlan();},1600);
    } else {
      out.innerHTML=`<div class="miss">Not found in mapped Special Collections ranges for <b>${q.toUpperCase()}</b>.</div>`;
      level=9; renderLevels(); renderPlan(); renderDetail();
    }
    return;
  }
  if(!q){ out.innerHTML=''; return; }
  const qs=scheme(q);
  const hits=[];
  for(const key in DATA){
    const d=DATA[key]; if(!d.start||!d.end) continue;
    if(key.startsWith('9|')) continue;     // Special Collections excluded from main stacks search
    if(scheme(d.start)!==qs) continue;     // don't match across W1-serials / NLM schemes
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
  'Type a call number as printed — spaces and the Cutter dot are optional, so <b style="color:var(--ink)">QL737.C22</b>, <b style="color:var(--ink)">QL 737 C22</b>, and <b style="color:var(--ink)">W1 JO600</b> all work. '+
  'The locator finds the shelf whose range contains it, comparing class letters, then class number, then each Cutter as a decimal — so AM4733 sorts before AM477. '+
  'Each green column is a double-sided shelf (L / R faces); black is the bottom row. A range where start = end is a serial run — many volumes share one call number, so the search returns every matching shelf and you check the spine. '+
  'Reference is shelved on floor 4 and Special Collections on floor 9; switch the Section pill to search those.';

/* ===== init ===== */
renderCoverage(); renderLevels(); renderPlan(); renderDetail();
document.getElementById('go').onclick=locate;
document.getElementById('clear').onclick=()=>{document.getElementById('q').value='';document.getElementById('result').innerHTML='';selected=null;flashId=null;setCollection('stacks');renderPlan();renderDetail();};
document.getElementById('q').addEventListener('keydown',e=>{if(e.key==='Enter')locate();});
document.querySelectorAll('.examples b').forEach(b=>b.onclick=()=>{setCollection('stacks');document.getElementById('q').value=b.dataset.q;locate();});

/* ===== Smart paste: accept full UCLA catalog Ctrl+A text =====
   Looks for the location line pattern: "Biomed Library ; W3 JA271 1977"
   If pasted text is multi-line or long, extract the call number and auto-search.
*/
function extractCallNumber(text){
  // Primary: UCLA catalog location line "Available Biomed Library ; <call number>"
  const m=text.match(/Biomed\s+Library\s*;\s*([^\n\r;(]+)/i);
  if(m) return m[1].trim();
  // Fallback: first short line that looks like a call number (letters then digits/space)
  const lines=text.split(/[\n\r]+/).map(l=>l.trim()).filter(Boolean);
  const cn=lines.find(l=>/^[A-Z*][A-Z0-9]*[\s.]/i.test(l) && l.length<60);
  if(cn) return cn;
  return text.trim();
}
document.getElementById('q').addEventListener('paste',e=>{
  const pasted=(e.clipboardData||window.clipboardData).getData('text');
  // Only intercept if it's clearly multi-line or long catalog text
  if(pasted.includes('\n') || pasted.length>80){
    const cn=extractCallNumber(pasted);
    if(cn && cn.length<60){
      e.preventDefault();
      const inp=document.getElementById('q');
      inp.value=cn;
      inp.dispatchEvent(new Event('input'));
      setTimeout(locate,60);
    }
  }
});
document.querySelectorAll('#sect .pill').forEach(p=>{
  p.onclick=()=>{
    setCollection(p.dataset.coll);
    if(collection==='stacks'){
      // jumping back to stacks: pick a floor with data if currently on L4/L9
      if(SPECIAL_FLOORS[level]) level=3;
    } else {
      level = COLL_TO_LEVEL[collection];
    }
    selected=null; flashId=null;
    renderLevels(); renderPlan(); renderDetail();
    // If there's a query in the box, re-run locate so the result panel updates
    if(document.getElementById('q').value.trim()) locate();
  };
});
</script>
</body>
</html>
"""

html = HTML.replace('__DATA__', DATA_JS)
with open(OUT_PATH, 'w', encoding='utf-8') as f:
    f.write(html)
shutil.copy2(OUT_PATH, INDEX_PATH)  # CF Pages serves index.html at /

print(f'wrote {OUT_PATH}: {len(html)} chars')
print(f'wrote {INDEX_PATH} (CF Pages entry point)')
print(f'embedded {len(d)} keys across {len({k.split("|")[0] for k in d})} floors')
