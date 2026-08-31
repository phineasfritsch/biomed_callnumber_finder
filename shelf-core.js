/* Everything both the map and the home page need to answer "which shelf is this on".
 *
 * This used to live inline in index.html, which was fine while there was one page. There are five
 * now, and a comparator that exists twice is a comparator that disagrees with itself eventually —
 * so it exists once, here, and the pages that need it load it.
 *
 * Depends on DATA from shelf-data.js. Defines, in order: escaping, the call-number comparator,
 * the floor layout, the walking geometry, and the floor-plan drawing. Everything here is a pure
 * function or a constant; nothing in this file touches the DOM, which is what lets the tests run
 * it in Node.
 */

/* ===== what goes into the page =====
   Every panel below grew its own copy of this, for a reason each one documents. The shelf map
   had none, and put the search box straight into `innerHTML` inside a `<code>` tag, uppercased.
   Uppercasing is not escaping — tag and attribute names are case-insensitive, and `&#60;` comes
   through it unchanged — so a call number with a tag in it was a tag. These two are the shared
   pair for the code above the panels. */
const escHtml = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* A URL is only a link if it is the web. Escaping stops a quote from breaking out of the
   attribute; it does nothing about `javascript:`, and several of these URLs are written by
   upstreams we do not control. */
function safeHref(u){
  const s=String(u==null?'':u).trim();
  return /^https?:\/\//i.test(s) ? s : '';
}

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
/* The inverse has to be complete. With only floor 4 in here, picking floor 9 off the levels bar
   left the section on "Main stacks" while the map showed Special Collections, and the stacks
   search skips every `9|` key by design — so every search from that state was a guaranteed miss
   against shelves the reader was looking straight at. */
const LEVEL_TO_COLL={4:'ref', 9:'spec'};
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

/* == walk-core:start ==
   Where the walk physically goes.

   The itinerary already knew the *order* of the faces. It never knew the *floor*, so it said
   "index 6 · top · right" and left you to work out which side of which aisle that is while
   pushing a cart. This turns an ordered list of stops into a path: which aisle you stand in,
   which way you turn into it, and which hand the shelf is on.

   Two coordinate systems, kept apart on purpose:
   * **Column units** — the same 0..16 index the shelf ids already use. Everything below is
     computed in column units and stays free of pixels, so the Swift port in
     `ios/BiomedShelfScanner/Models/WalkPath.swift` is a transcription rather than a second
     opinion. Anything that has to agree across the two apps lives here.
   * **Plan pixels** — `colX()` and `LANE_Y` map into the floor-plan viewBox. Only renderers
     touch those.

   **You do not stand at the column, you stand beside it.** A full shelf is two faces back to
   back: the `left` face's readable surface points west, the `right` face's points east, and
   you cannot read a face from inside the shelf. So a stop sits in the aisle at `index - 0.5`
   for a left face and `index + 0.5` for a right one. Half shelves are right-side-only and
   take the same `+0.5`. Two stops on the same column are therefore often two different
   places to stand, and one aisle usually serves two faces — the right face of shelf 6 and
   the left face of shelf 7 are the same spot, and the path must not leave and re-enter it.

   **No left and right.** There was an egocentric model here — which hand the shelf is on,
   which way you pivot into the aisle — and it was wrong three times running, each time for a
   different reason: it assumed you were already walking when you were still stepping out of a
   lift, it assumed one corridor when the floor has three, and once both were fixed the answer
   still depended on where the reader pictured themselves standing. None of that ambiguity is
   in the coordinates. East and west are the arrow, north and south are the row, and which of
   the two faces in an aisle is the `L` or `R` on the label. The reader can orient themselves;
   the app cannot do it for them, and getting it wrong is worse than not saying it. */
const PLAN={startX:20, slotW:40, topY:46, topH:140, botY:232, botH:140};
const colX = x => PLAN.startX + x*PLAN.slotW + PLAN.slotW/2;
const LANE_Y = {
  top:      PLAN.topY + PLAN.topH*0.52,
  corridor: (PLAN.topY + PLAN.topH + PLAN.botY)/2,
  bottom:   PLAN.botY + PLAN.botH*0.48
};
/* Aisle you stand in to read this face, in column units. Always a half-integer. */
const standX = st => st.side==='left' ? st.x-0.5 : st.x+0.5;
const laneOf  = st => st.row==='top' ? 'top' : 'bottom';
/* ── Absolute, not egocentric ─────────────────────────────────────────────────────────────
   There was a left/right model here — which hand the shelf is on, which way you pivot into the
   aisle. It was wrong three times in a row, and each time for a different reason: it assumed you
   were already walking when you were still stepping out of a lift, it assumed one corridor when
   the floor has three, and even once both were fixed the answer still depended on where the
   reader imagined themselves standing.

   None of that ambiguity exists in the coordinates. East and west are the arrow, north and south
   are the row, and which of the two faces in an aisle is the `L`/`R` on the label. So the walk is
   stated in those and the reader orients themselves, which they can do and the app cannot. */
function aisleLabel(sx){
  const a=Math.floor(sx), b=a+1;
  if(a<0)  return 'the west wall, before shelf 0';
  if(b>16) return 'the east end, past shelf 16';
  return `the aisle between ${a} and ${b}`;
}
/* The same name with the words taken out, for a line that has to fit everything about one stop. */
function aisleShort(sx){
  const a=Math.floor(sx), b=a+1;
  if(a<0)  return 'west wall';
  if(b>16) return 'east end';
  return `aisle ${a}·${b}`;
}
/* The same walk as prose: one numbered instruction per stop. `shelves` counts the shelves you
   pass along the corridor, which is the unit you can actually count while walking. Stop to stop
   it is a whole number, because every standing position is a half-integer; the first move is
   measured from a door and can land on a half, so callers state that one differently. */
function walkSteps(stops, entryX, exitX){
  let from=entryX;
  const out=stops.map((st,i)=>{
    const sx=standX(st), delta=sx-from;
    const step={ n:i+1, head:(delta>0?1:delta<0?-1:0), shelves:Math.abs(delta), x:sx,
                 aisle:aisleLabel(sx), row:st.row||'bottom', side:st.side,
                 index:st.x, cns:st.cns||[], range:st.d };
    from=sx; return step;
  });
  out.exitShelves = Math.abs(exitX-from);
  return out;
}
/* ── Doors ────────────────────────────────────────────────────────────────────────────────
   A stairwell is not a point, and neither is an elevator. You come out of one at a particular
   edge, and which edge decides which way you set off — so a map that starts and ends every
   floor at the same dot is not just imprecise, it points you the wrong way half the time.

   * **Elevator** — door in the middle of the south edge, opening onto the floor south of the
     block.
   * **West stairwell** (the one behind the elevator) — you walk *down* from its west edge and
     arrive on the floor below at its east edge. Entry and exit are on opposite sides, so a
     descent through it also moves you across the block.
   * **East stairwell** — you walk *down* from its north edge, which is on the corridor between
     the rows, and arrive on the floor below at its south edge.

   `via` is the side the door faces. Only the captions use it now; it decides where a label can
   sit without landing inside the block it belongs to.

   **The floor is walkable all the way round.** Both rows are islands: there is open floor north
   of the top row, south of the bottom row, and at both ends, and every aisle is a passage with
   two open ends rather than a dead end. An earlier version had the bottom row sealed except for
   the gaps either side of the elevator block, which made a door on the south side expensive to
   leave and sent the routing to the wrong stairwell. There are no forced detours: the cost of
   reaching a column from a door is how far along you have to walk, plus how far in from the
   corridor the door is set. */
function planDoors(){
  const {startX,slotW,botY,botH}=PLAN;
  const ax=i=>startX+i*slotW;
  const eLeft=ax(5), eW=ax(9)-ax(5), stairsH=Math.round(botH*0.38), inset=18;
  const wsY=botY+stairsH/2, esX=(ax(13)+(startX+14*slotW+slotW/2-2))/2;
  return {
    elevator: {x:eLeft+eW/2,      y:botY+botH, via:'lobby',    name:'elevator'},
    wsDown:   {x:eLeft+inset,     y:wsY,       via:'west',     name:'west stairwell'},
    wsUp:     {x:eLeft+eW-inset,  y:wsY,       via:'east',     name:'west stairwell'},
    esDown:   {x:esX,             y:botY,      via:'corridor', name:'east stairwell'},
    esUp:     {x:esX,             y:botY+botH, via:'lobby',    name:'east stairwell'}
  };
}
/* Which column you are standing at when you come through a door. */
const doorCol = d => (d.x - PLAN.startX - PLAN.slotW/2)/PLAN.slotW;
/* How far the door is set back from the corridor the stops are reached from, in columns, so it
   can be added to a distance measured along that corridor. The elevator is a full row's depth
   away; the east stairwell's north door is already on it. */
const doorDrop = d => Math.abs(d.y - LANE_Y.corridor)/PLAN.slotW;
/* What it costs to get between a door and a column of the stacks. */
const doorCost = (d,col) => Math.abs(doorCol(d)-col) + doorDrop(d);
/* == walk-core:end == */

/* ===== floor plan ===== */
const groupColor={green:'var(--green)',orange:'var(--orange)',black:'var(--char)',slate:'var(--slate)'};
const groupSoft ={green:'var(--green-soft)',orange:'var(--orange-soft)',black:'var(--char-soft)',slate:'var(--slate-soft)'};
const filled=(lvl,id,side)=>{const d=DATA[k(lvl,id,side)];return d&&d.start&&d.end;};

/* The face names, needed by shelfLabel below and by whichever page draws a detail panel. */
const sideName={left:'Left',right:'Right',single:'Single (R)'};

/* The stacks themselves. Drawn by the big floor plan and by the small per-floor walk maps, so
   the two are the same picture rather than two drawings of the same building — same frames,
   same L/R face letters, same em dash for a face with no range mapped, same index ruler.

   `tint(shelf, side, hasRange)` overrides a face's fill; return null for the standard treatment
   (its shelf-group colour when a range is mapped, empty when not). The walk map uses it to
   colour the faces it is sending you to. `interactive` adds the click handlers, which only the
   big plan wants. */
/* What a shelf is called out loud. The visual answer is a position on a drawing, which is no
   answer at all if the drawing is not what you are using; the ranges are the point. */
function shelfLabel(lvl, s){
  const parts=[`Index ${s.index}, ${s.row} row, level ${lvl}`];
  sidesOf(s).forEach(side=>{
    const d=DATA[k(lvl,s.id,side)];
    if(d) parts.push(`${sideName[side]}: ${d.start} to ${d.end}`);
  });
  if(parts.length===1) parts.push('no ranges mapped');
  return parts.join('. ');
}

function planShelves(lvl, tint, interactive){
  const {startX,topY,topH,botY,botH}=PLAN;
  const cx=colX;
  const fillOf=(s,side,has)=>{
    const t = tint ? tint(s,side,has) : null;
    if(t) return t;
    return has ? groupColor[s.group] : 'transparent';
  };
  let svg='';
  SHELVES.forEach(s=>{
    const present=existsOnLevel(s,lvl);
    const y=s.row==='top'?topY:botY, h=s.row==='top'?topH:botH, c=cx(s.index);
    let cls='shelf'+(present?'':' absent')
      +(interactive&&selected===s.id?' sel':'')+(interactive&&flashId===s.id?' flash':'');
    const click=(interactive&&present)?` onclick="pick('${s.id}')"`:'';
    let inner='';
    if(s.type==='full'){
      const w=14;
      const lFill = present && filled(lvl,s.id,'left');
      const rFill = present && filled(lvl,s.id,'right');
      inner+=`<rect x="${c-w}" y="${y}" width="${w}" height="${h}" fill="${fillOf(s,'left',lFill)}"/>`;
      inner+=`<rect x="${c}" y="${y}" width="${w}" height="${h}" fill="${fillOf(s,'right',rFill)}"/>`;
      inner+=`<line x1="${c}" y1="${y+5}" x2="${c}" y2="${y+h-5}" stroke="var(--line)" stroke-width="0.8"/>`;
      inner+=`<rect class="frame" x="${c-w}" y="${y}" width="${w*2}" height="${h}" rx="3"/>`;
      if(present){
        inner+=`<text class="face" x="${c-w/2}" y="${y+h-6}" text-anchor="middle">L</text>`;
        inner+=`<text class="face" x="${c+w/2}" y="${y+h-6}" text-anchor="middle">R</text>`;
        if(!lFill) inner+=`<text x="${c-w/2}" y="${y+h/2+5}" text-anchor="middle" font-family="var(--mono)" font-size="15" fill="var(--ink-soft)">–</text>`;
        if(!rFill) inner+=`<text x="${c+w/2}" y="${y+h/2+5}" text-anchor="middle" font-family="var(--mono)" font-size="15" fill="var(--ink-soft)">–</text>`;
      }
    } else {
      const w=9;
      const sFill = present && filled(lvl,s.id,'single');
      // half shelves are right-side only: start at cx (not cx-w)
      inner+=`<rect x="${c}" y="${y}" width="${w*2}" height="${h}" fill="${fillOf(s,'single',sFill)}"/>`;
      inner+=`<rect class="frame" x="${c}" y="${y}" width="${w*2}" height="${h}" rx="3"/>`;
      if(present){
        inner+=`<text class="face" x="${c+w}" y="${y+h-6}" text-anchor="middle">R</text>`;
        if(!sFill) inner+=`<text x="${c+w}" y="${y+h/2+5}" text-anchor="middle" font-family="var(--mono)" font-size="15" fill="var(--ink-soft)">–</text>`;
      }
    }
    /* An interactive shelf is a button, and has to say so and be reachable: these were bare
       <g> elements with an onclick, inside a container marked role="img", which made them
       invisible to a keyboard and presentational to a screen reader. Enter and Space are wired
       once, by delegation, in renderPlan. */
    const a11y=(interactive&&present)
      ? ` role="button" tabindex="0" aria-label="${escHtml(shelfLabel(lvl,s))}"`
      : ' aria-hidden="true"';
    svg+=`<g class="${cls}"${click}${a11y}>${inner}</g>`;
  });
  for(let i=0;i<=16;i++) svg+=`<text class="idx" x="${cx(i)}" y="38" text-anchor="middle">${i}</text>`;
  // Both row labels are SVG text at the SAME font-size so they scale identically with the plan.
  const rlbl=`text-anchor="start" font-family="var(--mono)" font-size="11" fill="var(--ink-soft)" letter-spacing="0.6"`;
  svg+=`<text x="${startX+2}" y="16" ${rlbl}>top row · index 0–16</text>`;
  svg+=`<text x="${startX+2}" y="${botY-7}" ${rlbl}>bottom row · index 0–16</text>`;
  return svg;
}

/* Architectural features (elevator + stairs) — identical on every floor, and drawn by both the
   big floor plan and the small per-floor walk maps. One function so the two cannot drift: the
   walk path is routed to these coordinates, so a map whose elevator sat elsewhere would put the
   start of the walk in the wrong place. */
function planFeatures(){
  const {startX,slotW,botY,botH}=PLAN;
  const ax=i=>startX+i*slotW;       // left edge of slot i
  const fstroke=`stroke="var(--ink)" stroke-width="1.3"`;
  let svg='';

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
  return svg;
}


/* Which faces contain this call number.
 *
 * Pulled out of the map page's lookup so the home page's preview asks the same question the same
 * way. `coll` is 'spec' for the ninth-floor sequence and anything else for the main stacks; the
 * two never mix, because Special Collections re-uses call numbers that also sit in the stacks.
 *
 * Scheme is checked on both sides: the biomedical serials prefix (W1, W2, W3, W4C) and NLM class
 * W plus a number are different namespaces that share a letter, and a range in one must never
 * appear to contain a number from the other.
 */
/* A space INSIDE the cutter, which is the other half of the same typo and the more dangerous half.
   "W1 AM 4990" parses: W1, then a cutter "AM" with no number, then a stray "4990" the comparator
   reads as a second cutter. It does not miss. It lands, confidently, on the face that holds bare
   "W1 AM" — index 4 rather than index 9, five bays from the book, with no note that anything was
   reinterpreted. A desk worker hit it on the fourth thing they typed.

   The repair for the missing space already existed but only ran on a MISS, which is exactly
   backwards: a wrong hit needs it more than a miss does, because a miss is honest and a wrong hit
   is not. So this one runs BEFORE the lookup and always says what it read.

   Only the W1 scheme, where the cutter is one word. NLM keeps letters and numbers apart on purpose
   ("WM 100 D299a" is class, number, cutter), and joining those would break every NLM number in the
   building. Checked against all 906 endpoints in the survey: no real W1 call number has a bare
   letters token followed by a digits token, and the three with a third token ("W2 AW4 P6P",
   "W4C Z89P 2009") keep their digits attached and are untouched. */
function w1RejoinCutter(term){
  const t=String(term||'').trim().toUpperCase().replace(/\s+/g,' ');
  if(scheme(t)!=='w1') return '';
  const k=t.split(' ');
  if(k.length<3) return '';
  const out=[k[0]];
  for(let i=1;i<k.length;i++){
    if(/^[A-Z]+$/.test(k[i]) && i+1<k.length && /^\d/.test(k[i+1])){ out.push(k[i]+k[i+1]); i++; }
    else out.push(k[i]);
  }
  const j=out.join(' ');
  return j===t ? '' : j;
}

/* Does this string read as a call number at all?
 *
 * One owner, because there were two and they disagreed. index.html had looksLikeCallNumber for
 * routing and map.html had cnShaped for its Reference branch, and map's main stacks path had
 * neither: it handed raw input straight to the comparator, which happily sorted it. "asthma"
 * came back as Level 11, index 1. "the book about hearts" came back as Level 10, index 4. A
 * confident shelf face for a sentence, on the one tool whose argument is that it refuses to guess.
 *
 * The guard lives in findFaces rather than at each call site, because a guard at each call site is
 * a guard somebody forgets at the fourth one, and that is exactly how this happened. Everything
 * that resolves a shelf goes through here: the home box, the map box, the route builder, and the
 * catalog holdings. The last of those was already documented as refusing a call number that did
 * not fully parse, so this makes the stated behaviour true everywhere rather than in one place.
 *
 * Checked against every endpoint in the survey: all 906 pass except the bare "A" that opens the
 * Special Collections sequence, and range endpoints are data rather than queries, so they are
 * never asked. */
function meansACallNumber(t){
  const s=(t||'').trim();
  if(!s || s.length>48) return false;
  if(/\s/.test(s)===false && s.length<3) return false;
  if(/[A-Za-z]{2,}:/.test(s)) return false;                       // mesh:, title:, at: …
  const digits=s.replace(/[^0-9Xx]/g,'');
  if(/^[0-9][0-9Xx-]{8,}$/.test(s) && (digits.length===10||digits.length===13)) return false;  // ISBN
  if(/^W[1-4][A-Z]{0,2}\s*[A-Z]/i.test(s)) return true;           // W1 AM477
  if(/^[A-Z]{1,3}\s*\d{1,4}(?:\.\d+)?\b/i.test(s)) return true;   // WM 100, QL737.C22, BF 400
  return false;
}

/* Two different questions, and the difference is the whole of the fix above.
 *
 *   meansACallNumber  - loose. Did the reader MEAN a call number? Used for routing, so a typo
 *                       still reaches the shelf path where something can repair it and say so.
 *   readsAsCallNumber - strict. Is this WELL FORMED enough to place on a shelf? Used by findFaces.
 *
 * Collapsing them into one predicate is a mistake I made and the rendered page caught: with the
 * strict test doing the routing, "W1 AM 4990" stopped being a typo the shelf path could repair and
 * became a catalog search for a book called W1 AM 4990. The loose test keeps it on the path that
 * knows what to do with it; the strict test stops the comparator answering it.
 *
 * A split cutter is the one case where they disagree: the reader plainly meant a call number, and
 * it is plainly not one yet. */
function readsAsCallNumber(t){
  const s=(t||'').trim();
  if(!meansACallNumber(s)) return false;
  if(w1RejoinCutter(s)) return false;   // a cutter split by a space is a typo, not a location
  return true;
}

function findFaces(q, coll){
  /* Nothing is placed on a shelf unless the whole string read as a call number. */
  if(!readsAsCallNumber(q)) return [];
  const qs=scheme(q), hits=[];
  for(const key in DATA){
    const d=DATA[key];
    if(!d.start||!d.end) continue;
    const isSpec=key.startsWith('9|');
    if(coll==='spec' ? !isSpec : isSpec) continue;
    if(scheme(d.start)!==qs) continue;
    if(cmpCN(q,d.start)>=0 && cmpCN(q,d.end)<=0){
      const [lvl,id,side]=key.split('|');
      hits.push({lvl:+lvl,id,side,d});
    }
  }
  return hits.sort((a,b)=>a.lvl-b.lvl);
}
