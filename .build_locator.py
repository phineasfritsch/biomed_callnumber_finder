"""Build index.html (CF Pages entry point) with the current JSON baked in."""
import json, os

REPO = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(REPO, 'biomed-shelf-ranges.json')
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
<title>Shelfmark</title>
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

  /* The library picker is page context, not a search option, so it reads as a line above the
     box rather than as another control inside it. */
  .whereami{display:flex; gap:9px; align-items:center; flex-wrap:wrap; margin:18px 0 0; padding:0 2px}
  .whereami label{font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:var(--ink-soft)}
  .whereami select{font:inherit; font-size:13px; font-weight:500; padding:7px 10px; border:1px solid var(--line);
    border-radius:8px; background:var(--card); color:var(--ink); max-width:100%}
  .whereami select:focus-visible{outline:none; border-color:var(--accent); box-shadow:0 0 0 3px var(--orange-soft)}
  .whereami-note{font-size:11px; color:var(--ink-faint)}
  .lookup{display:flex; gap:8px; align-items:center; margin:10px 0 10px; padding:12px 14px; background:var(--card); border:1px solid var(--line); border-radius:var(--r); flex-wrap:wrap}
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

  .levels{display:flex; flex-wrap:wrap; gap:5px; align-items:center; margin:22px 0 8px}
  .lvl-total{margin-left:auto; padding-left:12px; font-size:11px; color:var(--ink-faint); line-height:1.5; text-align:right}
  .lvl-total .n{color:var(--accent); font-size:13px}
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
  footer .by{display:block; margin-top:12px; color:var(--ink-faint)}
  footer .by a{color:var(--ink-soft)}
  .legend{display:flex; gap:14px; flex-wrap:wrap; margin-top:12px; padding-left:2px; font-size:11px; color:var(--ink-soft)}
  .legend span{display:inline-flex; align-items:center; gap:6px}
  .sw{width:11px; height:11px; border-radius:3px; display:inline-block; border:1px solid rgba(0,0,0,.12)}

  /* ── collapsible panels (route planner, catalog search) ── */
  .route,.cat{margin:18px 0 6px; background:var(--card); border:1px solid var(--line); border-radius:var(--r); overflow:hidden}
  .route-head,.cat-head{display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 16px; cursor:pointer}
  .route-head h2,.cat-head h2{font-family:var(--disp); font-size:17px; font-weight:600; margin:0; display:flex; align-items:baseline; gap:9px; flex-wrap:wrap}
  .h2-sub{font-family:var(--mono); font-size:11px; font-weight:400; color:var(--ink-faint); letter-spacing:0.03em}
  .route-head .tag,.cat-head .tag{font-size:9.5px; letter-spacing:1.2px; text-transform:uppercase; color:var(--accent); background:var(--orange-soft); padding:2px 7px; border-radius:99px; margin-left:9px}
  .route-body,.cat-body{padding:0 16px 16px; border-top:1px solid var(--line)}

  /* ── article access (OpenURL resolver) ── */
  .art-lookup{margin-top:14px}
  .prov .pick{margin-top:8px}
  .art-ex{font-size:11px; color:var(--ink-soft); margin:8px 2px 0; display:flex; gap:7px; align-items:center; flex-wrap:wrap}
  .prov{border:1px solid var(--line); border-radius:9px; padding:11px 13px; margin-top:9px; background:var(--paper)}
  .prov-h{display:flex; align-items:baseline; gap:9px; flex-wrap:wrap}
  .prov-n{font-weight:600; font-size:13.5px}
  .prov-i{font-size:11px; color:var(--ink-soft)}
  .prov-c{font-size:12px; color:var(--ink-soft); margin-top:4px; line-height:1.6}
  .prov a.go{display:inline-block; margin-top:8px; font-size:12px; color:var(--accent); text-decoration:none;
    border:1px solid var(--line); border-radius:7px; padding:6px 11px; min-height:34px; line-height:20px}
  .prov a.go:hover{background:var(--orange-soft)}
  .prov a.go:focus-visible{outline:none; border-color:var(--accent); box-shadow:0 0 0 3px var(--orange-soft)}
  .chip.free{background:var(--green-soft); color:var(--good)}

  /* ── hours ── */
  .hr-lib{border-top:1px solid var(--line); padding:10px 2px}
  .hr-lib:first-child{border-top:0}
  .hr-row{display:flex; align-items:baseline; gap:10px; flex-wrap:wrap}
  .hr-n{font-weight:600; font-size:13.5px; flex:1 1 auto}
  .hr-t{font-size:12.5px; color:var(--ink-soft)}
  /* Status is a dot plus a word: colour alone must never carry the meaning. */
  .hr-s{display:inline-flex; align-items:center; gap:6px; font-size:11px; text-transform:uppercase; letter-spacing:.6px}
  .hr-s i{width:8px; height:8px; border-radius:99px; display:inline-block; background:var(--ink-faint)}
  .hr-s.open{color:var(--good)}   .hr-s.open i{background:var(--good)}
  .hr-s.shut{color:var(--accent)} .hr-s.shut i{background:var(--accent)}
  .hr-sub{margin:6px 0 0 12px; padding-left:10px; border-left:2px solid var(--line)}
  .hr-sub .hr-row{padding:3px 0}
  .hr-sub .hr-n{font-weight:400; font-size:12.5px; color:var(--ink-soft)}
  .skel{height:13px; border-radius:4px; background:var(--paper-2); animation:pulse 1.3s ease-in-out infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
  @media (prefers-reduced-motion: reduce){ .skel{animation:none} }
  .route-hint,.cat-hint{font-size:12px; color:var(--ink-soft); line-height:1.65; margin:13px 0}
  .route-hint b,.cat-hint b{color:var(--ink)}
  .drop{display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:16px; border:1.5px dashed var(--line); border-radius:10px; background:var(--paper); transition:.15s}
  .drop.over{border-color:var(--accent); background:var(--orange-soft)}
  .drop-hint{font-size:11px; color:var(--ink-soft)}
  .ocr-status{font-size:12px; color:var(--ink-soft); min-height:18px; margin:9px 2px 0}
  .ocr-status.err{color:var(--accent)}
  .thumbs{display:flex; flex-wrap:wrap; gap:8px; margin:8px 0 0}
  .thumbs img{width:50px; height:50px; object-fit:cover; border-radius:6px; border:1px solid var(--line)}
  .cn-label{display:block; font-size:11px; text-transform:uppercase; letter-spacing:1px; color:var(--ink-soft); margin:14px 0 5px}
  #cnList{width:100%; font-family:var(--mono); font-size:14px; padding:10px 12px; border:1px solid var(--line); border-radius:8px; background:var(--paper); color:var(--ink); resize:vertical}
  #cnList:focus{outline:none; border-color:var(--accent); box-shadow:0 0 0 3px var(--orange-soft)}
  .route-actions{display:flex; gap:8px; margin:10px 0 0}
  .itinerary{margin-top:12px}
  .itin-summary{font-size:12px; color:var(--ink); background:var(--paper-2); border:1px solid var(--line); border-radius:8px; padding:10px 12px; margin-bottom:10px; line-height:1.6}
  .itin-summary b{color:var(--accent)}
  .itin-transit{display:flex; align-items:center; gap:9px; font-size:12px; color:var(--ink-soft); margin:9px 0; padding-left:4px}
  .itin-transit .ic{display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:6px; font-size:12px; color:var(--paper); flex:none}
  .itin-transit .ic.st{background:var(--orange)}
  .itin-transit .ic.el{background:var(--accent)}
  .itin-floor{border:1px solid var(--line); border-radius:10px; overflow:hidden; margin:8px 0}
  .itin-floor-h{display:flex; justify-content:space-between; align-items:center; gap:8px; padding:9px 13px; background:var(--green-soft); border-bottom:1px solid #bcce9e; cursor:pointer}
  .itin-floor-h .lv{font-family:var(--disp); font-size:15px; font-weight:600}
  .itin-floor-h .ct{font-size:10.5px; color:var(--ink-soft); text-transform:uppercase; letter-spacing:.5px}

  /* ── per-floor walking map ── */
  .walkwrap{padding:12px 13px 0; overflow-x:auto; -webkit-overflow-scrolling:touch}
  .walkmap{min-width:520px}   /* below this the aisle numbers collide; scroll instead of lying */
  .ramp{display:flex; align-items:center; gap:8px; padding:6px 13px 2px; font-size:10px; color:var(--ink-soft)}
  .ramp .bar{display:flex; flex:1 1 auto; height:7px; border-radius:99px; overflow:hidden; max-width:260px}
  .ramp .bar span{flex:1 1 auto}
  .ramp .rl{white-space:nowrap}
  /* One row per stop. Everything a stop is — the move, the face, the books, the shelf-end label
     — used to be printed twice, once as an instruction and again as a location line saying the
     same thing in other words. It is one line now, and the columns line up down the floor so you
     can read any one of them without reading the rest. */
  .itin-steps{list-style:none; margin:8px 0 4px; padding:0 13px}
  .itin-steps li{display:flex; flex-wrap:wrap; gap:2px 12px; align-items:baseline; padding:7px 0; border-top:1px solid var(--line)}
  .itin-steps li:first-child{border-top:0}
  .itin-steps .sn{flex:none; width:21px; height:21px; border-radius:99px; color:#fff; font-family:var(--mono); font-size:11px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; align-self:flex-start}
  .itin-steps .sn.out{background:var(--slate)}
  .itin-steps .sd{flex:0 0 auto; min-width:170px; font-size:12px; line-height:1.6; color:var(--ink-soft)}
  .itin-steps .sd .k{color:var(--ink)}
  .itin-steps .sat{flex:0 0 auto; min-width:80px; font-size:12px; line-height:1.6; color:var(--ink-soft)}
  .itin-steps .sat .k{color:var(--ink)}
  .itin-steps .scn{flex:1 1 auto; font-family:var(--mono); font-size:11.5px; color:var(--accent)}
  /* The shelf-end label is what you check when you get there, so it goes last and gives way
     first: on a narrow screen it drops to its own line rather than squeezing the instruction. */
  .itin-steps .srng{flex:0 1 auto; margin-left:auto; font-family:var(--mono); font-size:11px; color:var(--ink-soft)}
  .itin-miss{font-size:12px; color:var(--accent); background:var(--orange-soft); border:1px solid var(--line); border-radius:8px; padding:9px 12px; margin-top:10px; line-height:1.65}

  /* ── catalog search (Alma SRU) ── */
  .sr-only{position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0}
  .cat-form{display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin:12px 0 0}
  .cat-form input{flex:1 1 240px; min-width:0; font-family:var(--mono); font-size:15px; padding:11px 13px; border:1px solid var(--line); border-radius:8px; background:var(--paper); color:var(--ink)}
  .cat-form input:focus-visible,.cat-form input:focus{outline:none; border-color:var(--accent); box-shadow:0 0 0 3px var(--orange-soft)}
  .cat-modes{display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin:13px 0 0}
  .cat-opts{display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin:11px 0 0}
  .chk{display:inline-flex; align-items:center; gap:7px; font-size:12px; color:var(--ink-soft); cursor:pointer; min-height:32px}
  .chk input{width:16px; height:16px; accent-color:var(--accent); cursor:pointer}
  .cat-status{font-size:12px; color:var(--ink-soft); min-height:18px; margin:11px 2px 0; line-height:1.65}
  .cat-diag{display:block; margin-top:4px; font-size:11px; color:var(--ink-faint)}
  .cat-status.err{color:var(--accent)}
  .cat-results{margin-top:10px}

  .chk-note{color:var(--ink-faint)}
  .work{border:1px solid var(--line); border-radius:10px; overflow:hidden; margin:9px 0; background:var(--paper)}
  .work-h{display:flex; gap:12px; align-items:flex-start; padding:10px 13px; background:var(--paper-2); border-bottom:1px solid var(--line)}
  .work-t{flex:1 1 auto; min-width:0}
  /* Reserve the box before the image lands so results don't jump as covers stream in. */
  .cover{flex:none; width:96px; height:144px; object-fit:contain; object-position:top;
    border:1px solid var(--line); border-radius:5px; background:var(--card)}
  .work-h .ti{font-family:var(--disp); font-size:15px; font-weight:600; line-height:1.28}
  .work-h .by{font-size:11.5px; color:var(--ink-soft); margin-top:3px; line-height:1.5}
  .work-h .tags{display:flex; flex-wrap:wrap; gap:5px; align-items:center; margin-top:8px}
  .work-h .ed{display:inline-block; font-size:9.5px; text-transform:uppercase; letter-spacing:1px; color:var(--accent); background:var(--orange-soft); border-radius:99px; padding:3px 9px}
  /* The carrier chip is loud on purpose: an audiobook filed as the newest "edition" of a
     novel has to be visible before the year is, not after the walk. */
  .carr{display:inline-block; font-size:9.5px; text-transform:uppercase; letter-spacing:1px;
    color:var(--paper); background:var(--slate); border-radius:99px; padding:3px 9px}
  .carr.audio,.carr.music{background:#7a5c9e}
  .carr.video{background:#9e5c5c}
  .carr.online{background:var(--slate)}
  .carr.microform{background:#6b6b5c}
  .lib{padding:10px 13px; border-top:1px solid var(--line)}
  .lib-n{font-size:10.5px; text-transform:uppercase; letter-spacing:1px; color:var(--ink-soft); margin-bottom:3px}
  .lib.away{background:var(--paper-2)}
  .hold{padding:8px 0 2px; border-top:1px dotted var(--line)}
  .lib .hold:first-of-type{border-top:0; padding-top:4px}
  .hold-l{display:flex; flex-wrap:wrap; align-items:center; gap:5px 10px}
  .hold .cn{font-size:13px; font-weight:600; letter-spacing:.2px}
  .hold .cn.none{font-weight:400; color:var(--ink-faint)}
  .hold .where{display:block; font-size:11.5px; color:var(--ink-soft); line-height:1.55; margin-top:4px}
  .chip{font-size:10px; text-transform:uppercase; letter-spacing:.7px; padding:3px 8px; border-radius:99px; border:1px solid var(--line); color:var(--ink-soft); background:var(--card); white-space:nowrap}
  .chip.ok{color:var(--good); border-color:#bcce9e; background:var(--green-soft)}
  .chip.no{color:var(--accent); border-color:#e0bfa2; background:var(--orange-soft)}
  .chip.vol{color:var(--slate); border-color:var(--slate-soft); background:var(--slate-soft)}

  .found{display:block; width:100%; text-align:left; font-family:var(--mono); font-size:13px; color:var(--ink);
    background:var(--green-soft); border:1px solid #bcce9e; border-radius:8px; padding:9px 12px; margin-top:6px; cursor:pointer; min-height:44px}
  .found:hover{border-color:var(--green)}
  .found:focus-visible{outline:none; border-color:var(--accent); box-shadow:0 0 0 3px var(--orange-soft)}
  .found .lead{display:block; font-weight:600}
  .found .rng{display:block; font-size:11px; color:var(--ink-soft); margin-top:3px}
  .nofind,.elsewhere{font-size:11.5px; border:1px solid var(--line); border-radius:8px; padding:8px 11px; margin-top:6px; line-height:1.6}
  .nofind{color:var(--accent); background:var(--orange-soft)}
  .elsewhere{color:var(--ink-soft); background:var(--paper-2)}
  .cat-empty{font-size:12.5px; color:var(--ink-soft); background:var(--paper-2); border:1px solid var(--line); border-radius:8px; padding:12px 14px; line-height:1.7}
  .cat-empty .k{color:var(--ink)}
  .cat-more{display:flex; justify-content:center; margin:12px 0 2px}
  .routed{font-size:11.5px; color:var(--ink-soft); margin:9px 2px 0; line-height:1.6}
  .linky{font:inherit; font-size:11.5px; color:var(--accent); background:none; border:0; border-bottom:1px solid currentColor; padding:0; cursor:pointer}
  .linky:hover{color:var(--ink)}
  .cat-scope{display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin:13px 0 0}
  .cat-libnote{font-size:11.5px; color:var(--ink-soft); background:var(--paper-2); border:1px solid var(--line); border-radius:8px; padding:8px 11px; margin:9px 0 0; line-height:1.65}
  .cat-opts select{font:inherit; font-size:12px; padding:5px 7px; border:1px solid var(--line); border-radius:7px; background:var(--paper); color:var(--ink)}
  .cat-adv{margin:11px 0 0; border:1px solid var(--line); border-radius:9px; background:var(--paper-2)}
  .cat-adv>summary{cursor:pointer; list-style:none; padding:9px 13px; font-size:11px; text-transform:uppercase; letter-spacing:1px; color:var(--ink-soft); min-height:38px; display:flex; align-items:center}
  .cat-adv>summary::-webkit-details-marker{display:none}
  .cat-adv>summary::before{content:'\25b8'; margin-right:8px; color:var(--accent)}
  .cat-adv[open]>summary::before{content:'\25be'}
  .cat-adv>summary:focus-visible{outline:none; box-shadow:inset 0 0 0 2px var(--accent)}
  .filt{display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:9px 12px; padding:4px 13px 12px}
  .filt .f{display:flex; flex-direction:column; gap:4px; font-size:11px; color:var(--ink-soft)}
  .filt .f>span{text-transform:uppercase; letter-spacing:.6px; font-size:9.5px}
  .filt .f input[type=text],.filt .f input:not([type]),.filt .f select{font:inherit; font-size:13px; padding:7px 9px; border:1px solid var(--line); border-radius:7px; background:var(--paper); color:var(--ink); min-width:0}
  .filt .f input:focus-visible,.filt .f select:focus-visible{outline:none; border-color:var(--accent); box-shadow:0 0 0 3px var(--orange-soft)}
  .filt .chk2{flex-direction:row; align-items:center; gap:7px; font-size:12px; min-height:34px}
  .filt .chk2 input{width:16px; height:16px; accent-color:var(--accent); flex:none}
  .filt-note{font-size:11.5px; color:var(--ink-soft); line-height:1.7; margin:0; padding:0 13px 12px}
  .filt-note code,.cheat code{font-family:var(--mono); font-size:11px; background:var(--card); border:1px solid var(--line); border-radius:4px; padding:1px 5px; color:var(--accent)}
  .cheat{display:grid; grid-template-columns:auto 1fr; gap:6px 14px; padding:0 13px 12px; font-size:11.5px; color:var(--ink-soft); line-height:1.6; align-items:baseline}
  .cheat>div:nth-child(odd){white-space:nowrap}
  .cheat .cheat-h{font-size:9.5px; text-transform:uppercase; letter-spacing:1px; color:var(--ink-faint); padding-top:8px; border-top:1px solid var(--line); white-space:normal}
  .cat-example{font:inherit; font-size:11.5px; color:var(--accent); background:var(--card); border:1px solid var(--line); border-radius:99px; padding:5px 11px; margin:3px 4px 0 0; cursor:pointer; min-height:30px}
  .cat-example:hover{border-color:var(--accent)}
  .cat-applied{margin:10px 0 0; font-size:11.5px; line-height:1.7}
  .cat-applied .ap-row{display:flex; flex-wrap:wrap; gap:5px; align-items:baseline; color:var(--ink-soft)}
  .cat-applied .ap-n{background:var(--green-soft); border:1px solid #bcce9e; border-radius:99px; padding:2px 9px; font-size:11px}
  .cat-applied .ap-eq{color:var(--ink-faint); margin-top:5px}
  .cat-applied .ap-eq code{font-family:var(--mono); font-size:11px; color:var(--ink-soft)}
  .cat-applied .ap-err{color:var(--accent); background:var(--orange-soft); border:1px solid #e0bfa2; border-radius:8px; padding:7px 11px; margin-top:6px}
  .cat-status code{font-family:var(--mono); font-size:11px}
  .cat-note{font-size:11.5px; color:var(--ink-soft); text-align:center; margin:10px 0 0}
  .edcount{display:inline-block; font-size:9.5px; text-transform:uppercase; letter-spacing:1px; color:var(--slate); background:var(--slate-soft); border-radius:99px; padding:3px 9px}
  .eds{border-top:1px solid var(--line); background:var(--paper-2)}
  .eds>summary{cursor:pointer; list-style:none; padding:8px 13px; font-size:11px; color:var(--ink-soft); min-height:36px; display:flex; align-items:center}
  .eds>summary::-webkit-details-marker{display:none}
  .eds>summary::before{content:'\25b8'; margin-right:8px; color:var(--accent)}
  .eds[open]>summary::before{content:'\25be'}
  .eds-body{padding:0 0 4px}
  .edrow{border-top:1px dotted var(--line)}
  .edrow-h{display:flex; gap:9px; align-items:baseline; padding:8px 13px 2px}
  .edrow-h .edy{font-family:var(--mono); font-size:12px; font-weight:600; color:var(--accent); flex:none}
  .edrow-h .edt{font-size:12px; color:var(--ink-soft); line-height:1.45}

  /* ── responsive / mobile ── */
  .planwrap{width:100%}
  @media (hover:hover) and (pointer:fine){ #shoot{display:none} }
  @media (max-width:620px){
    .wrap{padding:16px 12px 56px}
    h1{font-size:22px; line-height:1.12}
    h1 .sub{letter-spacing:1.2px}
    header{gap:8px; padding-bottom:12px}
    .lookup{padding:10px; gap:7px}
    .lookup label{flex:1 0 100%}
    .lookup input{flex:1 1 100%; min-width:0; font-size:16px}
    .lookup .btn{flex:1 1 0}
    .planwrap{overflow-x:auto; -webkit-overflow-scrolling:touch}
    #plan{min-width:560px}
    #cnList{font-size:16px}
    .drop{padding:13px}
    .drop .btn{flex:1 1 auto}
    .route-head,.cat-head{padding:11px 13px}
    .route-body,.cat-body{padding:0 13px 14px}
    .detail{padding:14px 15px}
    .itin-steps .sd,.itin-steps .sat,.itin-steps .scn,.itin-steps .srng{flex:1 1 100%; min-width:0; margin-left:0}
    /* 16px keeps iOS from auto-zooming the field; 44px is the Apple/Material tap floor */
    .cat-form input{font-size:16px; flex:1 1 100%}
    .cat-form .btn{flex:1 1 0; min-height:44px}
    .cat-modes .pill{min-height:44px; padding:8px 16px}
    .cat-scope .pill{min-height:44px; padding:8px 16px}
    .whereami select{font-size:16px; min-height:44px; flex:1 1 100%}
    .whereami-note{flex:1 1 100%}
    .filt{grid-template-columns:1fr}
    .filt .f input,.filt .f select{font-size:16px}
    .cheat{grid-template-columns:1fr; gap:2px 0}
    .cheat>div:nth-child(even){padding-bottom:7px}
    .cat-head .btn{min-height:44px}
    .chk{min-height:44px}
    .work-h{padding:9px 11px; gap:10px}
    .cover{width:74px; height:111px}
    .lib{padding:9px 11px}
  }
  @media (prefers-reduced-motion:reduce){
    *,*::before,*::after{animation-duration:.01ms !important; animation-iteration-count:1 !important; transition-duration:.01ms !important; scroll-behavior:auto !important}
  }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Shelfmark<span class="sub">the book, then the aisle</span></h1>
  </header>

  <!-- Which desk you are standing at decides what "here" means for every search on the page,
       so it sits above the search box rather than inside a panel that starts closed. -->
  <div class="whereami">
    <label for="catLibrary">I&rsquo;m working at:</label>
    <select id="catLibrary" aria-label="Which library you are working at">
      <option value="biomed">Biomed Library</option>
      <option value="yrl">Young Research Library</option>
      <option value="powell">Powell Library</option>
      <option value="sel">Science &amp; Engineering &middot; SEL/EMS</option>
      <option value="geology">SEL &middot; Geology</option>
      <option value="arts">Arts Library</option>
      <option value="music">Music Library</option>
      <option value="law">Law Library</option>
      <option value="eal">East Asian Library</option>
      <option value="management">Management Library</option>
      <option value="clark">Clark Library</option>
      <option value="lsc">Library Special Collections</option>
      <option value="ftva">Film &amp; Television Archive</option>
      <option value="iml">Instructional Media Laboratory</option>
      <option value="csrc">Chicano Studies Research Center</option>
      <option value="aisc">American Indian Studies Center</option>
      <option value="aasc">Asian American Studies Center</option>
      <option value="err">English Reading Room</option>
      <option value="ethno">Ethnomusicology Archive</option>
      <option value="labschool">UCLA Lab School Library</option>
      <option value="srlf">SRLF &middot; offsite storage</option>
    </select>
    <span class="whereami-note">searches here first, and shows this library&rsquo;s copies</span>
  </div>

  <div class="lookup">
    <label for="q">Search:</label>
    <input id="q" placeholder="call number, book title, author, ISBN, DOI…" autocomplete="off" autofocus
           enterkeyhint="search" spellcheck="false">
    <button class="btn" id="go">Search</button>
    <button class="btn ghost" id="clear">Clear</button>
  </div>
  <div class="routed" id="routed" hidden></div>
  <div class="sect" id="sect">
    <span class="sect-label">Biomed map:</span>
    <button class="pill active" data-coll="stacks">Main stacks</button>
    <button class="pill" data-coll="ref">Reference · L4</button>
    <button class="pill" data-coll="spec">Special Collections · L9</button>
  </div>
  <div class="result" id="result">
    <div class="examples">Try a call number:
      <b data-q="QL737.C22 M616g">QL737.C22</b> ·
      <b data-q="W1 BI700">W1 BI700</b> ·
      <b data-q="QW 4 S851b">QW 4 S851b</b> ·
      <b data-q="BF 400">BF 400</b>
      &nbsp;&nbsp;or a book:
      <b data-q="harrison's principles of internal medicine">harrison&rsquo;s principles</b> ·
      <b data-q="mesh:neoplasms year:2020+ shelf:yes">mesh:neoplasms year:2020+</b>
      &nbsp;&nbsp;or an article:
      <b data-q="10.1056/NEJMoa1816897">10.1056/NEJMoa1816897</b>
    </div>
  </div>

  <div class="cat" id="cat">
    <div class="cat-head" id="catHead">
      <h2>Find a book in the catalog <span class="h2-sub">all 21 UCLA libraries</span></h2>
      <button class="btn ghost" type="button" id="catToggle" aria-expanded="false" aria-controls="catBody"><span class="tgl">Open</span></button>
    </div>
    <div class="cat-body" id="catBody" hidden>
      <p class="cat-hint">Everything goes in the one box at the top. A call number goes to the shelf map; anything else searches UCLA&rsquo;s catalog.</p>
      <p class="cat-hint">Results are scoped to the library you say you&rsquo;re at, newest first, and widen to the rest of UCLA only if yours has nothing. All 21 libraries work. Only Biomed stacks copies resolve to a shelf you can walk to.</p>
      <p class="cat-hint">The catalog ranks nothing and corrects no spelling, so both happen here. A typo or two still finds the book.</p>
      <div class="cat-scope" role="group" aria-label="Where to search">
        <span class="sect-label">Search:</span>
        <button class="pill active" type="button" data-scope="here" aria-pressed="true">Biomed</button>
        <button class="pill" type="button" data-scope="stacks" aria-pressed="false">Walkable stacks</button>
        <button class="pill" type="button" data-scope="ucla" aria-pressed="false">All of UCLA</button>
      </div>
      <div class="cat-libnote" id="catLibNote" hidden></div>
      <div class="cat-modes" role="group" aria-label="Search field">
        <span class="sect-label">Search by:</span>
        <button class="pill active" type="button" data-mode="kw" aria-pressed="true">Keyword</button>
        <button class="pill" type="button" data-mode="title" aria-pressed="false">Title</button>
        <button class="pill" type="button" data-mode="author" aria-pressed="false">Author</button>
        <button class="pill" type="button" data-mode="isbn" aria-pressed="false">ISBN</button>
      </div>
      <div class="cat-opts">
        <label class="chk" for="catSort">Sort:
          <select id="catSort">
            <option value="best" selected>Best match, then newest</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title A&ndash;Z</option>
            <option value="author">Author A&ndash;Z</option>
            <option value="shelf">Shelf order (walk it)</option>
          </select>
        </label>
        <label class="chk"><input type="checkbox" id="catGroupEd" checked> Group editions <span class="chk-note">(newest on top)</span></label>
        <label class="chk"><input type="checkbox" id="catBiomed" checked> Only my library</label>
        <label class="chk"><input type="checkbox" id="catCovers" checked> Show covers <span class="chk-note">(sends the ISBN to openlibrary.org)</span></label>
      </div>

      <details class="cat-adv">
        <summary>Filters</summary>
        <div class="filt" id="catFilters">
          <label class="f"><span>Published from</span><input id="fYearFrom" inputmode="numeric" placeholder="2015" autocomplete="off"></label>
          <label class="f"><span>&hellip; to</span><input id="fYearTo" inputmode="numeric" placeholder="2026" autocomplete="off"></label>
          <label class="f"><span>Language</span><select id="fLang">
            <option value="">any</option><option value="eng">English</option><option value="spa">Spanish</option>
            <option value="fre">French</option><option value="ger">German</option><option value="ita">Italian</option>
            <option value="por">Portuguese</option><option value="rus">Russian</option><option value="chi">Chinese</option>
            <option value="jpn">Japanese</option><option value="kor">Korean</option><option value="lat">Latin</option>
          </select></label>
          <label class="f"><span>Carrier</span><select id="fCarrier">
            <option value="">any</option><option value="print">Print / physical book</option>
            <option value="audio">Audiobook</option><option value="music">Recorded music</option>
            <option value="video">Video</option><option value="score">Printed score</option>
            <option value="map">Map</option><option value="microform">Microform</option>
            <option value="software">Software / data</option><option value="image">Image</option>
            <option value="online">Online only</option>
          </select></label>
          <label class="f"><span>Kind of thing</span><select id="fType">
            <option value="">any</option><option value="book">Book (monograph)</option><option value="journal">Journal / serial</option>
            <option value="video">Video</option><option value="audio">Audio</option><option value="music">Recorded music</option>
            <option value="score">Printed score</option><option value="map">Map</option><option value="software">Software / data</option>
            <option value="manuscript">Manuscript</option><option value="image">Image</option><option value="archive">Mixed / archive</option>
          </select></label>
          <label class="f"><span>Item type</span><select id="fMaterial">
            <option value="">any</option><option value="book">BOOK</option><option value="issue">ISSUE</option>
            <option value="bound">Bound issue</option><option value="dvd">DVD</option><option value="cdrom">CD-ROM</option>
            <option value="map">MAP</option><option value="microform">Microform</option><option value="score">Score</option>
            <option value="record">Sound recording</option><option value="mixed">Mixed</option><option value="other">Other</option>
          </select></label>
          <label class="f"><span>Exact location</span><select id="fLoc">
            <option value="">any in scope</option><option value="bi">bi &middot; general stacks</option>
            <option value="biper">biper &middot; bound volumes</option><option value="biprwt">biprwt &middot; building use</option>
            <option value="bian">bian &middot; annual / series</option><option value="birf">birf &middot; Reference, Floor 4</option>
            <option value="birs">birs &middot; Reserves</option><option value="bicidperm">bicidperm &middot; desk reserves</option>
            <option value="bicimm">bicimm &middot; desk media</option><option value="biherb">biherb &middot; Herbarium</option>
          </select></label>
          <label class="f"><span>MeSH subject</span><input id="fMesh" placeholder="neoplasms" autocomplete="off"></label>
          <label class="f"><span>Any subject</span><input id="fSubject" placeholder="nursing" autocomplete="off"></label>
          <label class="f"><span>Series</span><input id="fSeries" placeholder="Lange" autocomplete="off"></label>
          <label class="f"><span>Genre / form</span><input id="fGenre" placeholder="atlases" autocomplete="off"></label>
          <label class="f"><span>Publisher</span><input id="fPublisher" placeholder="Elsevier" autocomplete="off"></label>
          <label class="f"><span>Author</span><input id="fAuthor" placeholder="longo" autocomplete="off"></label>
          <label class="f"><span>Call number</span><input id="fCall" placeholder="WM 100" autocomplete="off"></label>
          <label class="f chk2"><input type="checkbox" id="fShelf"> Only copies that resolve to a shelf</label>
          <label class="f chk2"><input type="checkbox" id="fAvail"> Only titles with a copy on the shelf now</label>
        </div>
        <p class="filt-note">Each control is shorthand for a token you could type. The tokens are echoed above the results, so nothing narrows silently.</p>
      </details>

      <details class="cat-adv">
        <summary>Search syntax</summary>
        <p class="filt-note">Type <code>field:value</code> anywhere. Quote values with spaces, prefix with <code>-</code> to exclude. Everything else is ordinary search text. Every index below was probed live on 2026&#8209;08&#8209;05; none of them returns nothing.</p>
        <div class="cheat">
          <div><code>title:</code> <code>ti:</code></div><div>Title phrase. <code>title:"internal medicine"</code></div>
          <div><code>author:</code> <code>au:</code> <code>by:</code></div><div>Creator (MARC 100/110/111). <code>au:"longo, dan"</code></div>
          <div><code>subject:</code> <code>su:</code></div><div>Any subject heading.</div>
          <div><code>mesh:</code></div><div>Medical subject heading. <code>mesh:neoplasms</code></div>
          <div><code>lcsh:</code></div><div>Library of Congress subject heading.</div>
          <div><code>series:</code></div><div>Series statement. <code>series:Lange</code></div>
          <div><code>genre:</code> <code>form:</code></div><div>Genre / form. <code>genre:atlases</code>, <code>genre:handbooks</code></div>
          <div><code>uniform:</code></div><div>Uniform title.</div>
          <div><code>publisher:</code> <code>pub:</code></div><div>Publisher name. <code>pub:Elsevier</code></div>
          <div><code>place:</code></div><div>Place of publication.</div>
          <div><code>note:</code></div><div>Any MARC note field.</div>
          <div><code>isbn:</code> <code>issn:</code></div><div>Standard numbers; punctuation is stripped.</div>
          <div><code>cn:</code> <code>call:</code></div><div>Call number as shelved. <code>cn:"WM 100"</code> browses the class.</div>
          <div><code>nlm:</code> <code>lc:</code></div><div>The NLM-type or LC-type number specifically.</div>
          <div><code>lang:</code></div><div>Language, by name or MARC code. <code>lang:spanish</code>, <code>lang:jpn</code></div>
          <div><code>year:</code> <code>date:</code></div><div><code>year:2015</code> &middot; <code>year:&gt;=2015</code> &middot; <code>year:2010..2020</code> &middot; <code>year:2015+</code> &middot; <code>year:1990s</code></div>
          <div><code>after:</code> <code>before:</code></div><div>Shorthand for the same. <code>after:2015 before:2020</code></div>
          <div><code>type:</code> <code>format:</code></div><div>book &middot; journal &middot; video &middot; audio &middot; music &middot; score &middot; map &middot; software &middot; manuscript &middot; image &middot; archive</div>
          <div><code>material:</code> <code>item:</code></div><div>Item type on the shelf: book &middot; issue &middot; dvd &middot; cdrom &middot; microform &middot; score &middot; map</div>
          <div><code>loc:</code></div><div>One exact Biomed location code. <code>loc:birf</code></div>
          <div><code>at:</code> <code>in:</code></div><div>Where to search, overriding the pills. Any library: <code>at:yrl</code>, <code>at:powell</code>, <code>at:law</code>, <code>at:sel</code>, <code>at:arts</code>, <code>at:music</code>, <code>at:clark</code>, <code>at:srlf</code>&hellip; Also <code>at:here</code> for the one you picked, <code>at:stacks</code> for Biomed&rsquo;s walkable shelves, <code>at:ucla</code> for everywhere.</div>
          <div><code>sort:</code></div><div>best &middot; newest &middot; oldest &middot; title &middot; author &middot; shelf</div>
          <div><code>word*</code></div><div>Trailing truncation, in free text or any phrase field. <code>cardio*</code> catches cardiology and cardiovascular. End of a word only: <code>*word</code> is ignored, <code>car*logy</code> matches nothing.</div>
          <div class="cheat-h">Two words, both required</div><div class="cheat-h">Free text uses the <code>all</code> relation: every word must appear somewhere in the record. Quote a phrase to require the words together.</div>
          <div class="cheat-h">Applied here, not by the catalog</div><div class="cheat-h">These are facts about the shelf map</div>
          <div><code>shelf:</code></div><div><code>shelf:yes</code> keeps only copies that resolve to a real shelf face.</div>
          <div><code>level:</code></div><div><code>level:8</code> or <code>level:8,10</code>. Only books on those stack levels.</div>
          <div><code>avail:</code></div><div><code>avail:yes</code>. Only titles Alma reports as on the shelf now.</div>
          <div><code>online:</code></div><div><code>online:no</code>. Excludes anything with an electronic copy.</div>
          <div><code>editions:</code></div><div><code>editions:all</code> lists every printing separately instead of grouping them.</div>
          <div><code>carrier:</code> <code>is:</code></div><div>print &middot; audio &middot; music &middot; video &middot; score &middot; map &middot; microform &middot; software &middot; image &middot; online. Read from six MARC fields, not the leader alone, because audiobooks are routinely catalogued as text. <code>carrier:print</code> excludes them. Editions group per carrier, so a recording never leads a book.</div>
        </div>
        <p class="filt-note">Examples:
          <button class="cat-example" type="button" data-q="harrison's principles of internal medicine">newest Harrison&rsquo;s at Biomed</button>
          <button class="cat-example" type="button" data-q="cn:&quot;WM 100&quot; at:stacks sort:shelf">browse WM 100 in shelf order</button>
          <button class="cat-example" type="button" data-q="mesh:neoplasms year:2020+ type:book shelf:yes">recent oncology books on a shelf</button>
          <button class="cat-example" type="button" data-q="anatomy genre:atlases -lang:eng">non-English anatomy atlases</button>
          <button class="cat-example" type="button" data-q="type:journal at:stacks level:7">journals shelved on level 7</button>
        </p>
      </details>

      <div class="cat-applied" id="catApplied" hidden></div>
      <div class="cat-status" id="catStatus" role="status" aria-live="polite"></div>
      <div class="cat-results" id="catResults"></div>
    </div>
  </div>

  <!-- Electronic access. The shelf map answers "where is the print copy"; this answers the
       other half, which the app had no answer for at all. Alma's OpenURL resolver is keyless
       and CORS-open, so it needs no more infrastructure than the catalog search does. -->
  <div class="cat" id="art">
    <div class="cat-head" id="artHead">
      <h2>Find an article <span class="h2-sub">DOI, PMID or ISSN</span></h2>
      <button class="btn ghost" type="button" id="artToggle" aria-expanded="false" aria-controls="artBody"><span class="tgl">Open</span></button>
    </div>
    <div class="cat-body" id="artBody" hidden>
      <p class="cat-hint">Paste a DOI, a PubMed ID or an ISSN. This asks UCLA&rsquo;s link resolver who carries the full text, and for which years. A journal title goes to the catalog search instead.</p>
      <div class="lookup art-lookup">
        <label for="artQ">Article:</label>
        <input id="artQ" placeholder="10.1056/NEJMoa1816897 &middot; PMID 30883058 &middot; 0028-4793" autocomplete="off" spellcheck="false" enterkeyhint="search">
        <button class="btn" type="button" id="artGo">Look up</button>
      </div>
      <div class="art-ex">Try
        <button class="cat-example" type="button" data-q="10.1056/NEJMoa1816897">a DOI</button>
        <button class="cat-example" type="button" data-q="0028-4793">an ISSN</button>
        <button class="cat-example" type="button" data-q="10.1016/j.cell.2020.02.052">another DOI</button>
      </div>
      <div class="cat-status" id="artStatus" role="status" aria-live="polite"></div>
      <div class="cat-results" id="artOut"></div>
    </div>
  </div>

  <!-- Hours. Keyless, CORS-open, no personal data. The count of what is open rides on the
       collapsed header, because "is anything open" is the whole question most of the time. -->
  <div class="cat" id="hrs">
    <div class="cat-head" id="hrsHead">
      <h2>Library hours <span class="h2-sub" id="hrsSummary">loading&hellip;</span></h2>
      <button class="btn ghost" type="button" id="hrsToggle" aria-expanded="false" aria-controls="hrsBody"><span class="tgl">Open</span></button>
    </div>
    <div class="cat-body" id="hrsBody" hidden>
      <div class="cat-status" id="hrsStatus" role="status" aria-live="polite"></div>
      <div id="hrsOut"></div>
    </div>
  </div>

  <div class="route" id="route">
    <div class="route-head" id="routeHead">
      <h2>Plan a pickup walk <span class="h2-sub">Biomed stacks</span></h2>
      <button class="btn ghost" type="button"><span class="tgl">Open</span></button>
    </div>
    <div class="route-body" id="routeBody" hidden>
      <p class="route-hint">Upload photos of ILL slips or a pull list (JPEG/PNG) and the call numbers are read for you, or type them in.</p>
      <p class="route-hint">The walk starts at the highest floor and takes the stairs down one floor at a time. The elevator skips floors or goes up. Over five books is a truck trip, so it is the elevator between every floor.</p>
      <p class="route-hint">Text recognition runs in your browser and is imperfect, especially on handwriting. Check the list before building.</p>
      <div class="drop" id="drop">
        <input type="file" id="files" accept="image/*,.heic,.heif" multiple hidden>
        <input type="file" id="camera" accept="image/*" capture="environment" hidden>
        <button class="btn" type="button" id="pick">Choose images</button>
        <button class="btn" type="button" id="shoot">Take photo</button>
        <span class="drop-hint">or drag &amp; drop here</span>
      </div>
      <div class="ocr-status" id="ocrStatus"></div>
      <div class="thumbs" id="thumbs"></div>
      <label class="cn-label" for="cnList">Call numbers, one per line</label>
      <textarea id="cnList" rows="6" placeholder="W1 AM477&#10;QL 737 C22 M616g&#10;WM 13 D5537"></textarea>
      <div class="route-actions">
        <button class="btn" type="button" id="buildRoute">Build route</button>
        <button class="btn ghost" type="button" id="clearRoute">Clear</button>
      </div>
      <div class="itinerary" id="itinerary"></div>
    </div>
  </div>

  <div class="levels" id="levels"></div>

  <div class="stage">
    <div class="planwrap"><svg id="plan" viewBox="0 0 720 400" role="img" aria-label="Floor plan"></svg></div>
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
  const {botY,botH}=PLAN;
  let svg=planShelves(level,null,true)+planFeatures();
  plan.innerHTML=svg; plan.setAttribute('viewBox',`0 0 720 ${botY+botH+16}`);
}

/* The stacks themselves. Drawn by the big floor plan and by the small per-floor walk maps, so
   the two are the same picture rather than two drawings of the same building — same frames,
   same L/R face letters, same em dash for a face with no range mapped, same index ruler.

   `tint(shelf, side, hasRange)` overrides a face's fill; return null for the standard treatment
   (its shelf-group colour when a range is mapped, empty when not). The walk map uses it to
   colour the faces it is sending you to. `interactive` adds the click handlers, which only the
   big plan wants. */
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
        if(!lFill) inner+=`<text x="${c-w/2}" y="${y+h/2+5}" text-anchor="middle" font-family="var(--mono)" font-size="15" fill="var(--ink-soft)">—</text>`;
        if(!rFill) inner+=`<text x="${c+w/2}" y="${y+h/2+5}" text-anchor="middle" font-family="var(--mono)" font-size="15" fill="var(--ink-soft)">—</text>`;
      }
    } else {
      const w=9;
      const sFill = present && filled(lvl,s.id,'single');
      // half shelves are right-side only: start at cx (not cx-w)
      inner+=`<rect x="${c}" y="${y}" width="${w*2}" height="${h}" fill="${fillOf(s,'single',sFill)}"/>`;
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
  /* The total belongs beside the per-floor counts it is the sum of, not in the masthead of a
     tool that also searches 21 libraries and answers article questions. */
  const tot=document.createElement('div');
  tot.className='lvl-total';
  tot.innerHTML=`<span class="n">${Object.keys(DATA).length}</span> Biomed shelf faces mapped`;
  el.appendChild(tot);
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
  const inp=document.getElementById('q');
  let q=inp.value.trim();
  // "Hist Div WZ 100 ..." typed directly → strip prefix, switch to Special Collections
  const hd=q.match(/^hist\.?\s*div\.?\s+(.+)/i);
  if(hd){ q=hd[1].trim(); inp.value=q; setCollection('spec'); }
  const out=document.getElementById('result');
  if(collection==='ref'){
    const subject = q ? `<code>${q.toUpperCase()}</code>` : 'Your book';
    out.innerHTML = `<div class="hit"><div class="loc">Floor 4 · Reference</div>`+
      `<div class="rng">${subject} is on floor 4, shelved by call number.</div></div>`;
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
      out.innerHTML=`<div class="miss">No mapped Special Collections range contains <code>${q.toUpperCase()}</code>.</div>`;
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
    + (hits.length>1?`<div class="examples">${hits.length} shelves match. For serials, check the volume and year on the spine.</div>`:'');
    const first=hits[0]; level=first.lvl; selected=first.id; flashId=first.id;
    renderLevels(); renderPlan(); renderDetail();
    setTimeout(()=>{flashId=null;renderPlan();},1600);
  } else {
    out.innerHTML=`<div class="miss">No mapped shelf contains <code>${q.toUpperCase()}</code>. It may be on a level not yet entered, or outside the mapped ranges.</div>`;
  }
}

document.getElementById('footer').innerHTML=
  'Type a call number as printed. Spaces and the Cutter dot are optional, so <code>QL737.C22</code>, <code>QL 737 C22</code> and <code>W1 JO600</code> all work. A W1 number needs the space after W1. '+
  'The locator finds the shelf whose range contains it, comparing class letters, then class number, then each Cutter as a decimal, so AM4733 sorts before AM477. '+
  'Each green column is a double-sided shelf (L and R faces); black is the bottom row. Where a range start equals its end, many volumes share one call number, so every matching shelf is returned and you check the spine. '+
  'Reference is on floor 4 and Special Collections on floor 9. Switch the Biomed map pill to search those.'+
  /* The byline is also the disclaimer. Anything that searches a university catalog and draws
     its floors will be taken for an official service unless it says otherwise in its own
     voice, and saying so once here is cheaper than being asked. */
  '<span class="by">Built by <a href="https://phineasfritsch.com">Phineas Fritsch</a>. '+
  'The shelf map is surveyed by hand and the catalog data comes from UCLA\'s public SRU endpoint. '+
  'Not affiliated with, or endorsed by, the UCLA Library.</span>';

/* ===== init ===== */ renderLevels(); renderPlan(); renderDetail();
/* ===== one box =====
   Two searches used to sit on this page with a box each, and you had to know which question
   you were asking before you could ask it. There is now one field, and it decides: anything
   shaped like a call number goes to the shelf map, anything else goes to the catalog. The
   decision is always shown, and always reversible in one click — guessing wrong silently
   would be worse than not guessing.

   "Shaped like a call number" is deliberately narrow: class letters followed by a number, or
   the W1-series form. A title is almost never either. A `field:value` filter token and a bare
   ISBN are sent to the catalog outright. */
function looksLikeCallNumber(t){
  const s=(t||'').trim();
  if(!s || s.length>48) return false;
  if(/\s/.test(s)===false && s.length<3) return false;
  if(/[A-Za-z]{2,}:/.test(s)) return false;                       // mesh:, title:, at: …
  const digits=s.replace(/[^0-9Xx]/g,'');
  if(/^[0-9][0-9Xx-]{8,}$/.test(s) && (digits.length===10||digits.length===13)) return false;
  if(/^W[1-4][A-Z]{0,2}\s*[A-Z]/i.test(s)) return true;           // W1 AM477
  if(/^[A-Z]{1,3}\s*\d{1,4}(?:\.\d+)?\b/i.test(s)) return true;   // WM 100, QL737.C22, BF 400
  return false;
}
function showRouted(kind,typed){
  const el=document.getElementById('routed');
  if(!el) return;
  if(!kind){ el.hidden=true; el.innerHTML=''; return; }
  el.hidden=false;
  el.innerHTML = kind==='shelf'
    ? 'Read as a call number and looked up on the shelf map. '+
      '<button type="button" class="linky" id="routeToCat">Search the catalog for this instead</button>'
    : kind==='article'
    ? 'Read as an article or journal identifier and sent to the link resolver. '+
      '<button type="button" class="linky" id="routeToCat">Search the catalog for this instead</button>'
    : 'Searched the catalog. '+
      '<button type="button" class="linky" id="routeToShelf">Treat it as a call number instead</button>';
  const a=document.getElementById('routeToCat');
  if(a) a.onclick=()=>{ showRouted('catalog'); if(window.catalogSearch) window.catalogSearch(); };
  const b=document.getElementById('routeToShelf');
  if(b) b.onclick=()=>{ showRouted('shelf'); locate(); };
}
/* A DOI, a PubMed ID or an ISSN identifies an *article or a journal run*, which the catalog
   answers badly and the link resolver answers exactly. Recognised here so the one box keeps
   being the one box.

   Length is what separates these from an ISBN: 10 or 13 digits is a book and belongs to the
   catalog, 8 with a hyphen is an ISSN, 7 or 8 bare is a PubMed ID. */
function looksLikeArticle(s){
  const t=(s||'').trim();
  if(/\b10\.\d{4,9}\/\S+/i.test(t)) return true;              // DOI, bare or inside a URL
  if(/^pmid[:\s]*\d{7,8}$/i.test(t)) return true;
  if(/^\d{4}-\d{3}[\dxX]$/.test(t)) return true;              // ISSN, hyphenated
  if(/^\d{7,8}$/.test(t)) return true;                        // bare PMID; ISBNs are 10 or 13
  return false;
}
function unifiedSearch(){
  const t=document.getElementById('q').value.trim();
  if(!t){ showRouted(''); document.getElementById('result').innerHTML=''; return; }
  // The section pills are an explicit instruction about the shelf map; honour them.
  if(collection!=='stacks' || looksLikeCallNumber(t)){ showRouted('shelf',t); locate(); return; }
  if(looksLikeArticle(t) && window.articleLookup){ showRouted('article',t); window.articleLookup(t); return; }
  showRouted('catalog',t);
  if(window.catalogSearch) window.catalogSearch();
}
document.getElementById('go').onclick=unifiedSearch;
document.getElementById('clear').onclick=()=>{document.getElementById('q').value='';document.getElementById('result').innerHTML='';showRouted('');selected=null;flashId=null;setCollection('stacks');renderPlan();renderDetail();if(window.catalogClear)window.catalogClear();};
document.getElementById('q').addEventListener('keydown',e=>{if(e.key==='Enter')unifiedSearch();});
document.querySelectorAll('.examples b').forEach(b=>b.onclick=()=>{document.getElementById('q').value=b.dataset.q;if(looksLikeCallNumber(b.dataset.q))setCollection('stacks');unifiedSearch();});

/* ===== Smart paste: accept full UCLA catalog Ctrl+A text =====
   Looks for the location line pattern: "Biomed Library ; W3 JA271 1977"
   If pasted text is multi-line or long, extract the call number and auto-search.
*/
function extractCallNumber(text){
  // "Available Biomed Library Hist Div ; W3 JA271 1977"  → spec=true
  const mH=text.match(/Biomed\s+Library\s+Hist\.?\s*Div\.?\s*;\s*([^\n\r;(]+)/i);
  if(mH) return {cn:mH[1].trim(), spec:true};
  // "Available Biomed Library ; W3 JA271 1977"
  const m=text.match(/Biomed\s+Library\s*;\s*([^\n\r;(]+)/i);
  if(m) return {cn:m[1].trim(), spec:false};
  // Fallback: first short CN-looking line
  const lines=text.split(/[\n\r]+/).map(l=>l.trim()).filter(Boolean);
  const cn=lines.find(l=>/^[A-Z*][A-Z0-9]*[\s.]/i.test(l) && l.length<60);
  if(cn) return {cn, spec:false};
  return {cn:text.trim(), spec:false};
}
document.getElementById('q').addEventListener('paste',e=>{
  const pasted=(e.clipboardData||window.clipboardData).getData('text');
  if(pasted.includes('\n') || pasted.length>80){
    const {cn,spec}=extractCallNumber(pasted);
    if(cn && cn.length<60){
      e.preventDefault();
      const inp=document.getElementById('q');
      inp.value=cn;
      // "Biomed Library Hist. Div." is the Special Collections sequence on L9, and the
      // pasted line is the only place that says so — set the section before searching.
      if(spec) setCollection('spec');
      inp.dispatchEvent(new Event('input'));
      setTimeout(unifiedSearch,60);
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
    if(document.getElementById('q').value.trim()) unifiedSearch();
  };
});

/* ===== Route planner =====
   OCR (client-side Tesseract.js) fills an editable list of call numbers; the human
   corrects it; then a deterministic engine builds a top-down walk. Movement model:
   each stairwell goes DOWN exactly one floor (the quick move); the elevator handles
   going up or skipping floors. Two stairwells per floor (west ~col 6.5, east ~col 13.5);
   the elevator sits at the west block (~col 6.5). Within a floor we sweep across the
   stacks once instead of backtracking. */
(function(){
  const ELEV_X=6.5, STAIR_W=6.5, STAIR_E=13.5;
  const $=id=>document.getElementById(id);
  const route=$('route'); if(!route) return;
  const head=$('routeHead'), body=$('routeBody'), statusEl=$('ocrStatus'),
        thumbs=$('thumbs'), cnList=$('cnList'), itin=$('itinerary'),
        drop=$('drop'), fileInput=$('files'), cam=$('camera');
  let tessLoaded=false, heicLoaded=false, tessWorker=null;

  head.addEventListener('click',()=>{ body.hidden=!body.hidden; head.querySelector('.tgl').textContent=body.hidden?'Open':'Close'; });
  $('pick').addEventListener('click',e=>{ e.stopPropagation(); fileInput.click(); });
  $('shoot').addEventListener('click',e=>{ e.stopPropagation(); cam.click(); });
  fileInput.addEventListener('change',e=>handleFiles(e.target.files));
  cam.addEventListener('change',e=>handleFiles(e.target.files));
  ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop',e=>{ if(e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files); });
  $('buildRoute').addEventListener('click',buildRoute);
  $('clearRoute').addEventListener('click',()=>{ cnList.value=''; itin.innerHTML=''; thumbs.innerHTML=''; setStatus(''); });

  function setStatus(t,err){ statusEl.textContent=t||''; statusEl.classList.toggle('err',!!err); }
  function lines(){ return cnList.value.split(/[\n\r]+/).map(s=>s.trim()).filter(Boolean); }
  function setLines(arr){ cnList.value=arr.join('\n'); }

  /* ---- OCR ---- */
  function loadTess(){
    if(tessLoaded) return Promise.resolve();
    return new Promise((res,rej)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload=()=>{ tessLoaded=true; res(); };
      s.onerror=()=>rej(new Error('Could not load the text-recognition library (are you offline?). You can still type call numbers below.'));
      document.head.appendChild(s);
    });
  }
  /* One reusable worker, tuned for short library call-number labels. */
  async function getWorker(onProgress){
    await loadTess();
    if(tessWorker) return tessWorker;
    tessWorker=await Tesseract.createWorker('eng',1,{logger:onProgress});
    await tessWorker.setParameters({
      tessedit_pageseg_mode:'11',                                   // sparse text: find scattered labels on a shelf
      tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789. ',
      preserve_interword_spaces:'1'
    });
    return tessWorker;
  }
  /* iPhone HEIC/HEIF can't be decoded by <canvas>; convert to JPEG first. */
  function loadHeic(){
    if(heicLoaded) return Promise.resolve();
    return new Promise((res,rej)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
      s.onload=()=>{ heicLoaded=true; res(); };
      s.onerror=()=>rej(new Error('Could not load the HEIC photo converter (are you offline?).'));
      document.head.appendChild(s);
    });
  }
  const isHeic=f=>/image\/hei[cf]/i.test(f.type||'') || /\.hei[cf]$/i.test(f.name||'');
  async function toJpeg(file){
    if(!isHeic(file)) return file;
    await loadHeic();
    const out=await heic2any({blob:file, toType:'image/jpeg', quality:0.85});
    return Array.isArray(out) ? out[0] : out;
  }
  // Otsu: pick the grayscale threshold that best splits ink from paper.
  function otsu(hist,total){
    let sum=0; for(let i=0;i<256;i++) sum+=i*hist[i];
    let sumB=0,wB=0,max=0,thr=127;
    for(let t=0;t<256;t++){
      wB+=hist[t]; if(!wB) continue; const wF=total-wB; if(!wF) break;
      sumB+=t*hist[t];
      const mB=sumB/wB, mF=(sum-sumB)/wF, between=wB*wF*(mB-mF)*(mB-mF);
      if(between>max){ max=between; thr=t; }
    }
    return thr;
  }
  function preprocess(file){
    return new Promise(res=>{
      const url=URL.createObjectURL(file), img=new Image();
      img.onload=()=>{
        let scale=1900/img.width; scale=Math.max(0.5, Math.min(3, scale));   // shrink big phone photos, enlarge tiny labels
        const c=document.createElement('canvas'); c.width=Math.round(img.width*scale); c.height=Math.round(img.height*scale);
        const ctx=c.getContext('2d'); ctx.drawImage(img,0,0,c.width,c.height);
        try{
          const d=ctx.getImageData(0,0,c.width,c.height), p=d.data;
          const hist=new Array(256).fill(0), g=new Uint8Array(p.length/4);
          for(let i=0,j=0;i<p.length;i+=4,j++){ const v=(0.299*p[i]+0.587*p[i+1]+0.114*p[i+2])|0; g[j]=v; hist[v]++; }
          const thr=otsu(hist,g.length), bias=thr+8;                          // small bias toward white = cleaner glyphs
          for(let i=0,j=0;i<p.length;i+=4,j++){ const v=g[j]>=bias?255:0; p[i]=p[i+1]=p[i+2]=v; }
          ctx.putImageData(d,0,0);
        }catch(_){}
        URL.revokeObjectURL(url); res(c);
      };
      img.onerror=()=>{ URL.revokeObjectURL(url); res(file); };
      img.src=url;
    });
  }
  // Books get photographed sideways/upside-down; Tesseract can't read rotated text.
  function rotateCanvas(src,deg){
    if(!deg) return src;
    const c=document.createElement('canvas'), rad=deg*Math.PI/180;
    if(deg===90||deg===270){ c.width=src.height; c.height=src.width; } else { c.width=src.width; c.height=src.height; }
    const ctx=c.getContext('2d');
    ctx.translate(c.width/2,c.height/2); ctx.rotate(rad); ctx.drawImage(src,-src.width/2,-src.height/2);
    return c;
  }
  async function handleFiles(fl){
    const files=[...fl].filter(f=>/^image\//.test(f.type)||isHeic(f));
    if(!files.length){ setStatus('Those files are not images. Upload JPEG, PNG or HEIC photos, or type call numbers below.',true); return; }
    setStatus('Loading text-recognition…');
    let worker;
    try{ worker=await getWorker(m=>{ if(m.status==='recognizing text') setStatus(`Reading… ${Math.round(m.progress*100)}%`); }); }
    catch(e){ setStatus(e.message,true); return; }
    const found=new Set(lines());
    for(let i=0;i<files.length;i++){
      try{
        let src=files[i];
        if(isHeic(src)){ setStatus(`Converting iPhone photo ${i+1} of ${files.length}…`); src=await toJpeg(src); }
        const im=new Image(); im.src=URL.createObjectURL(src); thumbs.appendChild(im);
        const pre=await preprocess(src);
        let hits=[];
        for(const deg of [0,90,270,180]){                                    // try each orientation until one reads
          setStatus(`Reading image ${i+1} of ${files.length}${deg?` (rotated ${deg}°)`:''}…`);
          const r=await worker.recognize(rotateCanvas(pre,deg));
          hits=extractCNs(r.data.text);
          if(hits.length) break;
        }
        hits.forEach(c=>found.add(c));
      }catch(_){ /* skip an unreadable image */ }
    }
    setLines([...found]);
    setStatus(`Read ${files.length} image${files.length===1?'':'s'}, found ${found.size} call number${found.size===1?'':'s'}. Check the list, then build the route.`);
  }
  function extractCNs(text){
    if(!text) return [];
    // Labels are stacked one token per line ("W1 / NA388 / no.66 / 1984") — flatten newlines to
    // spaces so the whole call number assembles, and drop the "Biomed" collection prefix.
    const norm=' '+text.toUpperCase()
        .replace(/\bBIOMED\b/g,' ')
        .replace(/[|=_]+/g,' ')
        .replace(/[^A-Z0-9. ]/g,' ')
        .replace(/\s+/g,' ')+' ';
    const vol='(?:\\s+NO\\.?\\s?\\d+[A-Z]?)?(?:\\s+(?:18|19|20)\\d{2}[A-Z]?)?';  // optional "NO.66" + year
    const out=[], rx=[
      new RegExp('\\bW[1-4][A-Z]{0,2}\\s*[A-Z]{1,3}\\s?\\d{1,4}[A-Z]?'+vol,'g'),    // W1 serials: "W1 NA388 NO.66 1984"
      new RegExp('\\b[A-Z]{1,3}\\s?\\d{1,4}(?:\\.\\d+)?\\s+\\.?[A-Z]\\d[\\dA-Z. ]{0,14}','g')  // NLM/LC: "WM 13 D5537", "QL737.C22"
    ];
    rx.forEach(r=>{ let m; while((m=r.exec(norm))) out.push(m[0].replace(/\s+/g,' ').trim().replace(/[ .]+$/,'')); });
    return out;
  }

  /* ---- routing ---- */
  /* Level 9 is Special Collections: a second, parallel sequence whose seventeen faces run
     `A` to `ZWZ 330` and therefore contain almost every call number in the building. Routing
     used to search it alongside the general stacks and then take the lowest-numbered floor,
     which meant **every** book whose real home was level 10 or 11 was routed to level 9 --
     98 of the 436 mapped faces, i.e. all of both floors. It looked like an OCR failure
     because the call number on screen was right and only the floor was wrong.

     `shelfHits` in the catalog module and `search` in the iOS port had always excluded level
     9; only the trip planner did not. It does now. Special Collections is reachable through
     its own section pill, which is the only place it should ever be reached from. */
  function routeLocate(cn){
    const qs=scheme(cn), hits=[];
    for(const key in DATA){ const d=DATA[key]; if(!d.start||!d.end) continue;
      if(key.charAt(0)==='9' && key.charAt(1)==='|') continue;
      if(scheme(d.start)!==qs) continue;
      if(cmpCN(cn,d.start)>=0 && cmpCN(cn,d.end)<=0){ const [lvl,id,side]=key.split('|'); hits.push({lvl:+lvl,id,side,d}); } }
    hits.sort((a,b)=>a.lvl-b.lvl);
    return hits;
  }
  // 1-D sweep: cover span [L,R] starting at s, ending at e; return cheaper direction.
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
  function buildRoute(){
    const want=[...new Set(lines())];
    if(!want.length){ itin.innerHTML='<div class="itin-miss">Add call numbers first: upload an image or type them above.</div>'; return; }
    const located=[], missing=[];
    want.forEach(cn=>{ const h=routeLocate(cn); if(h.length) located.push({cn,hit:h[0]}); else missing.push(cn); });
    if(!located.length){ itin.innerHTML=miss(missing); return; }
    const byLvl={};
    located.forEach(it=>{ (byLvl[it.hit.lvl]=byLvl[it.hit.lvl]||[]).push(it); });
    const levels=Object.keys(byLvl).map(Number).sort((a,b)=>b-a);   // top floor first

    /* **Over five books is a truck trip.** You are not carrying nine books down a stairwell, so
       past that point the stairs stop being an option at all and every floor change is the
       elevator. The threshold is a load, not a distance, which is why it overrides the routing
       maths rather than being folded into it as a cost. */
    const truck = located.length>5;

    let entryKind='elevator', html='', stairs=0, lifts=0;
    html+=transit('el',`Elevator to Level ${levels[0]} to start.`);
    for(let i=0;i<levels.length;i++){
      const lvl=levels[i], stops=groupStops(byLvl[lvl]);
      const xs=stops.map(s=>s.x), L=Math.min(...xs), R=Math.max(...xs);
      const entryCol=doorCol(doorFor(entryKind,'in'));
      let nextTransit='', exitKind='done', nextKind='elevator';
      if(i<levels.length-1){
        const nlvl=levels[i+1], gap=lvl-nlvl;
        const ns=groupStops(byLvl[nlvl]);
        const nc=ns.reduce((a,st)=>a+standX(st),0)/ns.length;
        if(gap===1 && !truck){
          /* Which stairwell is cheaper is a question about doors, not columns. The west
             stairwell's landing is behind the elevator block: reaching it means walking out to
             the gap at column 4 and back in, and you arrive on the floor below on its *far*
             side. The east stairwell opens straight onto the corridor going down, but drops you
             into the south lobby coming out. Costing them as two bare x-positions gets this
             backwards on exactly the floors where it matters, so both legs are measured along
             the paths that will actually be drawn. */
          let best=null;
          ['west stairs','east stairs'].forEach(kind=>{
            const out=doorFor(kind,'out'), back=doorFor(kind,'in');
            const sc=sweep(L,R,entryCol,doorCol(out)).cost + doorDrop(out) + doorCost(back,nc);
            if(!best||sc<best.sc) best={kind,sc};
          });
          exitKind=nextKind=best.kind; stairs++;
          nextTransit=transit('st',`${best.kind.replace(' stairs','')} stairwell down one floor to Level ${nlvl}.`);
        } else {
          exitKind=nextKind='elevator'; lifts++;
          const why = truck && gap===1 ? ' (truck trip, no stairs)'
                    : gap>1 ? ` (skips ${gap-1} floor${gap-1===1?'':'s'})` : '';
          nextTransit=transit('el',`Elevator down to Level ${nlvl}${why}.`);
        }
      }
      const outDoor=exitKind==='done'?null:doorFor(exitKind,'out');
      const exitCol=outDoor?doorCol(outDoor):entryCol;
      const dir=sweep(L,R,entryCol,exitCol).dir;
      stops.sort((a,b)=> dir==='LR' ? (a.x-b.x)||(rowOrd(a)-rowOrd(b)) : (b.x-a.x)||(rowOrd(a)-rowOrd(b)));
      html+=floorCard(lvl,stops,entryKind,exitKind);
      html+=nextTransit; entryKind=nextKind;
    }
    const books=located.length, fl=levels.length;
    let plan;
    if(fl===1){ plan=`All on Level ${levels[0]}. Elevator there.`; }
    else if(truck){ plan=`Over five books, so it is a truck trip: elevator between every floor (${lifts} move${lifts===1?'':'s'}).`; }
    else { plan=`Elevator to Level ${levels[0]}, then ${stairs} stair descent${stairs===1?'':'s'}`+(lifts?` and ${lifts} elevator move${lifts===1?'':'s'}.`:'.'); }
    const sum=`${books} book${books===1?'':'s'} across ${fl} floor${fl===1?'':'s'}. ${plan}`;
    html=`<div class="itin-summary">${sum}</div>`+html;
    if(missing.length) html+=miss(missing);
    itin.innerHTML=html;
  }
  function transit(kind,txt){ const cls=kind==='st'?'st':'el', ic=kind==='st'?'↓':'⇅'; return `<div class="itin-transit"><span class="ic ${cls}">${ic}</span><span>${txt}</span></div>`; }
  /* ── Order as colour ──────────────────────────────────────────────────────────────────
     A number badge tells you where a stop sits in the sequence, but only if you read every
     badge. A colour ramp tells you the *shape* of the walk in one glance — where it starts,
     which way it sweeps, how far it has to go. So order is encoded twice: the badge is exact,
     the ramp is instant, and neither is load-bearing alone (colour-blind readers keep the
     badges; a photocopy keeps the numbers).

     Cool-to-warm, four anchors, because a single-hue light-to-dark ramp loses its middle at
     the small sizes these maps render at, and because "blue is early, red is late" is the one
     ramp convention nobody has to be taught. The anchors sit in a narrow luminance band so
     white badge text stays legible at every position. */
  const RAMP=[[3,105,161],[46,125,91],[198,138,30],[179,64,26]];
  function orderColor(i,n){
    if(n<=1) return `rgb(${RAMP[0].join(',')})`;
    const t=i/(n-1), seg=Math.min(Math.floor(t*(RAMP.length-1)), RAMP.length-2),
          f=t*(RAMP.length-1)-seg, a=RAMP[seg], b=RAMP[seg+1];
    return `rgb(${a.map((v,j)=>Math.round(v+(b[j]-v)*f)).join(',')})`;
  }

  function floorCard(lvl,stops,entryKind,exitKind){
    const total=stops.reduce((a,s)=>a+s.cns.length,0);
    let h=`<div class="itin-floor"><div class="itin-floor-h" onclick="routeShow(${lvl},'${stops[0].id}')"><span class="lv">Level ${lvl}</span><span class="ct">${total} book${total===1?'':'s'} · ${stops.length} stop${stops.length===1?'':'s'} · tap to open the big map</span></div>`;
    const m=walkMap(lvl,stops,entryKind,exitKind);
    h+=m.html;
    h+=walkList(stops,m.entryCol,m.exitCol,m.inDoor,m.outDoor);
    return h+'</div>';
  }

  /* `entryKind`/`exitKind` name the stairwell or the elevator; `planDoors()` turns that into the
     edge you actually come through, and `doorCol`/`doorCost` say what it costs to get from there
     to the stacks. Which edge is not cosmetic: descending the west stairwell puts you out on its
     far side, so the same descent that ended "at the stairs" starts you facing the other way on
     the floor below. */
  function doorFor(kind,dir){
    const D=planDoors();
    if(kind==='elevator') return D.elevator;
    if(kind==='west stairs') return dir==='out'?D.wsDown:D.wsUp;
    if(kind==='east stairs') return dir==='out'?D.esDown:D.esUp;
    return null;
  }
  /* ── The map ──────────────────────────────────────────────────────────────────────────
     One SVG per floor, built from the same `planShelves()` and `planFeatures()` as the big floor
     plan, so it is that drawing with the walk marked on it rather than a second, different
     picture of the same building.

     **There is no drawn route.** There was, and it did not survive contact with the building: an
     aisle is a twelve-pixel gap, a sweep doubles back down the corridor it came along, and every
     device for keeping those legs apart — offset tracks, rounded corners, arrowheads — added more
     ink to a picture that was already too busy to read. What a route line was carrying is order,
     and order fits in the two things already on the map: the face you are going to, tinted, and a
     numbered badge in the aisle you read it from. Colour gives you the shape of the walk at a
     glance; the number settles any ambiguity. Neither can overlap anything, because neither is a
     line.

     Faces you are not visiting keep their shelf-group colour at soft strength, so the floor still
     reads as the floor. */
  function walkMap(lvl,stops,entryKind,exitKind){
    const n=stops.length;
    const inDoor=doorFor(entryKind,'in'), outDoor=doorFor(exitKind,'out');
    const entryCol=doorCol(inDoor), exitCol=outDoor?doorCol(outDoor):entryCol;

    const visited={}; stops.forEach((st,i)=>{ visited[st.id+'|'+st.side]=i; });
    let s=planShelves(lvl,(sh,side,has)=>{
      const key=sh.id+'|'+side;
      if(key in visited) return orderColor(visited[key],n);
      return has ? groupSoft[sh.group] : null;
    },false);
    s+=planFeatures();

    /* Where you come in and where you leave. On a truck trip both are the same elevator door, so
       two captions would land on one point and interleave into gibberish; say it once. */
    const sameDoor = outDoor && outDoor.x===inDoor.x && outDoor.y===inDoor.y;
    s+=endCap(inDoor, sameDoor?'START / EXIT':'START', entryKind);
    if(outDoor && !sameDoor) s+=endCap(outDoor,'EXIT',exitKind);

    /* Badges sit in the aisle you stand in, beside the face they belong to. Two faces read from
       one aisle are one place to stand, so their badges would land on each other — they get
       spread along the aisle instead of stacked. */
    const at={};
    stops.forEach((st,i)=>{
      const lane=laneOf(st), x=colX(standX(st)), slot=x+'|'+lane;
      const k=(at[slot]=(at[slot]||0)+1)-1;
      const y=LANE_Y[lane]+(k ? (k%2?1:-1)*Math.ceil(k/2)*26 : 0);
      const col=orderColor(i,n);
      s+=`<circle cx="${x}" cy="${y}" r="11.5" fill="${col}" stroke="var(--paper)" stroke-width="2.2"/>`;
      s+=`<text x="${x}" y="${y+4}" text-anchor="middle" font-family="var(--mono)" font-size="12" font-weight="700" fill="#fff">${i+1}</text>`;
    });

    const h=PLAN.botY+PLAN.botH+30;   // room for the caption under a door on a south edge
    const html=`<div class="walkwrap"><svg class="walkmap" viewBox="0 0 720 ${h}" role="img" `
      + `aria-label="Level ${lvl} walking route: ${n} stop${n===1?'':'s'} in order">${s}</svg></div>`
      + rampLegend(n);
    return {html, entryCol, exitCol, inDoor, outDoor};
  }
  /* The cap sits on the door, in the door's own colour — orange for stairs, blue for the lift,
     matching the blocks they are drawn on. The caption goes wherever the open floor is, which
     is the direction the door faces: a caption placed by habit above the door lands inside the
     orange stairs block, orange on orange, and half of it disappears. */
  function endCap(door,label,kind){
    const c=/stairs/.test(kind)?'var(--orange)':'var(--accent)';
    const {x,y}=door;
    let t;
    if(door.via==='lobby')         t=`x="${x+12}" y="${y+16}" text-anchor="start"`;
    else if(door.via==='corridor') t=`x="${x}" y="${y-13}" text-anchor="middle"`;
    /* A door on a side edge is approached along its own row, so the caption goes above it —
       level with it would sit on the line that arrives there. */
    else if(door.via==='west')     t=`x="${x-2}" y="${y-13}" text-anchor="end"`;
    else                           t=`x="${x+2}" y="${y-13}" text-anchor="start"`;
    /* The route line is drawn before this and passes through several of these positions, so the
       caption carries its own paper-coloured outline rather than relying on finding a clear
       spot on every floor. */
    return `<circle cx="${x}" cy="${y}" r="7.5" fill="var(--paper)" stroke="${c}" stroke-width="3"/>`
         + `<text ${t} font-family="var(--mono)" font-size="9" letter-spacing="1" `
         + `stroke="var(--paper)" stroke-width="3" paint-order="stroke" fill="${c}">${label}</text>`;
  }
  /* Reading key for the ramp. Without it the colours are just pretty; with it they are a scale. */
  function rampLegend(n){
    let bar='';
    for(let i=0;i<24;i++) bar+=`<span style="background:${orderColor(i,24)}"></span>`;
    return `<div class="ramp"><span class="rl">first stop</span><span class="bar">${bar}</span>`
         + `<span class="rl">last stop (${n})</span></div>`;
  }

  /* ── The same walk in words ────────────────────────────────────────────────────────────
     The map answers "where"; this answers "what do I do next", which is the question you have
     while walking and not looking at a screen. Distances count shelves passed along the
     corridor, because that is the unit that is painted on the floor in front of you.

     The first move is measured from a door rather than from another aisle, so it can land on a
     half shelf; it is stated as a direction rather than a count. Every later move is aisle to
     aisle and comes out whole. */
  /* One row per stop, in absolute terms. East and west are the arrow, north and south are the
     row, and which face in the aisle is the L or R on the label — so nothing here depends on
     which way the reader happens to be pointing. Anything they already have is left out: the
     transit line above named the door, and "shelf" and "row" and "face" are the only kinds of
     thing these numbers could be. */
  function walkList(stops,entry,exit,inDoor,outDoor){
    const steps=walkSteps(stops,entry,exit), n=stops.length;
    const arrow={1:'→','-1':'←',0:'↳'};
    const face={left:'L',right:'R',single:'R'};
    const shortDoor = d => d.name.replace('stairwell','stairs');
    let h='<ol class="itin-steps">';
    steps.forEach(st=>{
      /* A move off a door is measured from the middle of a block and can land on half a shelf, so
         it gives the direction and skips the count. Every later move is aisle to aisle and whole. */
      const move = st.shelves===0 ? 'same aisle'
                 : Number.isInteger(st.shelves) ? `${st.shelves} ${st.shelves===1?'shelf':'shelves'}`
                 : (st.head>0?'east':'west');
      h+=`<li><span class="sn" style="background:${orderColor(st.n-1,n)}">${st.n}</span>`
       + `<span class="sd"><span class="k">${arrow[st.head]} ${move}</span> to ${aisleShort(st.x)}</span>`
       + `<span class="sat"><span class="k">${st.index}${face[st.side]||''}</span> ${st.row}</span>`
       + `<span class="scn">${st.cns.join(' · ')}</span>`
       + `<span class="srng">${st.range.start} → ${st.range.end}</span></li>`;
    });
    if(outDoor){
      h+=`<li class="out"><span class="sn out">↺</span>`
       + `<span class="sd">back to the <span class="k">${shortDoor(outDoor)}</span></span></li>`;
    }
    return h+'</ol>';
  }
  function miss(arr){ return `<div class="itin-miss">Not located (${arr.length}): ${arr.join(' · ')}<br>Mis-read by OCR, shelved in Reference on floor 4, or outside the mapped ranges. Fix the spelling above and rebuild.</div>`; }

  window.routeShow=function(lvl,id){ level=lvl; selected=id; flashId=id; if(typeof syncCollectionToLevel==='function') syncCollectionToLevel(); renderLevels(); renderPlan(); renderDetail(); setTimeout(()=>{ flashId=null; renderPlan(); },1600); const st=document.querySelector('.stage'); if(st) st.scrollIntoView({behavior:'smooth',block:'center'}); };
})();

/* ===== Catalog search (Alma SRU) =====
   Answers the question the shelf map alone can't: "do we have this book, and which
   edition is newest?" One unauthenticated GET to Alma SRU returns bib records with
   holdings already injected (AVA = physical, AVE = electronic), so there is no second
   availability call and no server of our own — the endpoint sends
   `Access-Control-Allow-Origin: *`, verified, so the browser may call it directly.

   The dangerous half of this is the join back into the shelf map. A wrong aisle is
   worse than no aisle, so `resolve()` below refuses in five separate ways and only
   ever hands back a shelf when the call number survived all of them.

   The default is the question asked at the desk all day: *the newest edition of this
   book, in this building*. So a search is scoped to Biomed and sorted newest-first
   before anything else happens, and only widens to the rest of UCLA when Biomed has
   nothing. Everything beyond that default — twenty-odd filter fields, negation, year
   ranges, call-number browsing — is reachable from the same box as `field:value`
   tokens. The Filters panel is a mouse-driven way of typing the same tokens; it shows
   what it added, because a filter that narrows results invisibly reads as "not held". */
(function(){
  const $=id=>document.getElementById(id);
  const root=$('cat'); if(!root) return;
  // One box for the whole page. The catalog module does not own an input any more; it reads
  // the field at the top, and the router there decides whether a query belongs to the shelf
  // map or to here.
  const head=$('catHead'), toggle=$('catToggle'), body=$('catBody'), input=$('q'),
        statusEl=$('catStatus'), out=$('catResults'), biomedOnly=$('catBiomed'), covers=$('catCovers'),
        groupEd=$('catGroupEd'), sortSel=$('catSort'), applied=$('catApplied'), filtForm=$('catFilters'),
        libSel=$('catLibrary');

  const SRU='https://ucla.alma.exlibrisgroup.com/view/sru/01UCS_LAL';
  const MARC='http://www.loc.gov/MARC21/slim';
  const PAGE=50;                 // Alma silently caps maximumRecords at 50 (probed)

/* == catalog-core:start ==
   Everything between these markers is pure: no DOM, no network, no globals except the
   comparator (parseCN/cmpCN/scheme/DATA) it shares with the rest of the app. The test
   harness in Tools/catalog.test.js extracts this block verbatim and runs it against the
   two live SRU fixtures, so the tested code is literally the shipped code. */

  /* Media copies (DVD, CD-ROM …) carry the class number of the work but do not sit in
     the stacks sequence — they live at a desk. Strip the prefix so it is visible, and
     treat its presence as a hard "no shelf lookup". */
  const MEDIA_PREFIX=/^(?:(?:DVD-ROM|CD-ROM|DVD|CD|VHS|VIDEO|VIDEODISC|VIDEOCASSETTE|AUDIO|CASSETTE|MICROFILM|MICROFICHE|MICROCARD|SLIDE|KIT|MAP|ATLAS|OVERSIZE|FOLIO)[\s.:-]+)+/i;
  const BARCODE=/\[\s*barcode\s*:[^\]]*\]/ig;

  // AVA $d -> { cn, prefix, barcode, year }. Never guesses: if nothing usable is left,
  // cn is '' and every downstream step declines.
  function splitCallNumber(raw){
    const src=(raw||'').trim();
    const bc=src.match(/\[\s*barcode\s*:\s*([^\]]*)\]/i);
    let s=src.replace(BARCODE,' ').replace(/\s+/g,' ').trim();
    let prefix='';
    const mp=s.match(MEDIA_PREFIX);
    if(mp){ prefix=mp[0].trim().replace(/[\s.:-]+$/,''); s=s.slice(mp[0].length).trim(); }
    return { raw:src, cn:s, prefix, barcode: bc?bc[1].trim():'', year:yearOf(s) };
  }

  /* The edition-ordering key. It must come from the call number, not from MARC 250
     (inconsistent) and not from the string as a whole: Harrison's cutter is reassigned
     from H248p to H322 in 2015, so alphabetical order is chronologically wrong.
     Only tokens *after* the class letters + class number are considered, so a large
     class number can never be mistaken for a year. */
  function yearOf(cn){
    const toks=(cn||'').trim().split(/\s+/);
    for(let i=toks.length-1;i>=2;i--){
      const m=toks[i].match(/^(1[5-9]\d{2}|20\d{2})[a-z]?\.?$/i);
      if(m) return +m[1];
    }
    return null;
  }

  /* The comparator is deliberately tolerant — it will happily order garbage. This is
     the gate that decides whether its answer is trustworthy at all. Two accepted
     shapes: the W1-series serials scheme, and a class-letters + class-number + cutter
     call number (NLM, or an LC-shaped number, which Biomed does use for non-medical
     subjects such as BF789.D4 despite $k saying "0"). */
  function isLocatable(cn){
    if(!cn) return false;
    if(/^W[1-4][A-Z]{0,2}\s+[A-Z]/i.test(cn)) return true;
    return /^[A-Z]{1,3}\s*\d{1,4}(?:\.\d+)?[\s.]+\.?[A-Z]/i.test(cn);
  }

  /* Biomed location codes ($j). Confirmed live against the endpoint, not guessed.
     `stacks` is the only kind that may resolve to a shelf. An unlisted bi* code falls
     through to `unknown` and is shown honestly rather than routed by assumption —
     the authoritative list still has to come from Library IT. */
  const BIOMED_LOC={
    bi:        {kind:'stacks', label:'Biomed Library \u00b7 general stacks'},
    biper:     {kind:'stacks', label:'Biomed stacks \u00b7 bound volumes', note:'Current issues are shelved separately in Current Journals.'},
    biprwt:    {kind:'stacks', label:'Biomed stacks \u00b7 building use only', note:'Does not circulate. Current issues are in Current Journals.'},
    bian:      {kind:'stacks', label:'Biomed \u00b7 annual or series', note:'Volumes of a series can shelve apart from the run. Check the series record if the shelf is empty.'},
    birf:      {kind:'desk',   label:'Biomed Reference \u00b7 Floor 4', note:'Shelved by call number in Reference. That floor has no per-shelf map.'},
    birs:      {kind:'desk',   label:'Biomed Reserves', note:'Ask at the Circulation Desk.'},
    bicidperm: {kind:'desk',   label:'Biomed Circulation Desk \u00b7 permanent reserves', note:'Held at the desk. Ask for it by call number.'},
    bicimm:    {kind:'desk',   label:'Biomed Circulation Desk \u00b7 media', note:'Held at the desk. Ask for it by call number.'},
    biherb:    {kind:'desk',   label:'Biomed Herbarium', note:'Ask at the desk; access is by arrangement.'}
  };
  const OFFSITE={
    sr:'Offsite at SRLF (Southern Regional Library Facility) \u2014 not in this building; request it in the catalog.',
    lsyrboxm:'YRL Special Collections, boxed, stored at SRLF \u2014 offsite; request it in the catalog.'
  };
  /* Not every AVA is a copy. `RES_SHARE` rows are resource-sharing request placeholders
     attached to records UCLA does not hold at all \u2014 the 2022 Blackstone Audio recording of
     Atlas Shrugged is one. Rendering it as "held at Resource Sharing Library" invents a
     building that does not exist. */
  const PHANTOM_LIB={
    RES_SHARE:'Not a UCLA copy \u2014 this row is a resource-sharing request placeholder, so there is no shelf anywhere to walk to.'
  };

  function classify(ava){
    const lib=(ava.b||'').toUpperCase(), j=(ava.j||'').toLowerCase();
    if(PHANTOM_LIB[lib]) return {kind:'phantom', here:false, code:j,
                                 label:'Request only \u00b7 not held at UCLA', note:PHANTOM_LIB[lib]};
    /* Biomed is the only library with a shelf map, so it is the only one whose holdings can
       reach `kind:'stacks'` — the gate `resolve` opens to hand out an aisle. Everything below
       that is presentation. */
    if(lib==='BIOMED'){
      const known=BIOMED_LOC[j];
      if(known) return Object.assign({here:hereLib==='BIOMED', code:j}, known);
      return {kind:'unknown', here:hereLib==='BIOMED', code:j,
              label:ava.c||('Biomed \u00b7 location code '+(j||'unknown')),
              note:'This Biomed location is not in the routing table yet. Ask at the desk rather than walking the stacks.'};
    }
    const known=LIB_BY_CODE[lib];
    /* The reader's own library, when it is not Biomed. It is in this building and worth
       showing first, but there is no per-shelf map for it, and saying so is the whole point —
       the alternative is a blank space where an aisle would be. */
    if(lib && lib===hereLib) return {kind:'here', here:true, code:j,
            label:ava.c||ava.q||(known?known.name:lib),
            note:'In this building, shelved by call number. There is no per-shelf map for '+
                 esc0(known?known.name:lib)+' yet, so the call number is as precise as this gets.'};
    return {kind:'away', here:false, code:j,
            label:ava.q||ava.c||lib||'Another UCLA library',
            note:OFFSITE[j]||('Held at '+(ava.c||(known?known.name:lib)||'another UCLA library')+'. Not in this building.')};
  }
  // The core block has no DOM; this is only here so a library name cannot smuggle markup in.
  const esc0=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // Shelf faces whose mapped range contains this call number. Level 9 is excluded:
  // Special Collections has its own routing and must never be reached from a stacks code.
  function shelfHits(cn){
    if(!cn) return [];
    const qs=scheme(cn), hits=[];
    for(const key in DATA){
      const d=DATA[key]; if(!d.start||!d.end) continue;
      if(key.charAt(0)==='9' && key.charAt(1)==='|') continue;
      if(scheme(d.start)!==qs) continue;
      if(cmpCN(cn,d.start)>=0 && cmpCN(cn,d.end)<=0){
        const p=key.split('|'); hits.push({lvl:+p[0], id:p[1], side:p[2], d});
      }
    }
    hits.sort((a,b)=>a.lvl-b.lvl);
    return hits;
  }

  /* The single decision point: does this patron get pointed at a shelf, and if not, why
     not. Every `reason` is rendered to the user — silence would read as "not held". */
  function resolve(ava){
    const parts=splitCallNumber(ava.d||''), route=classify(ava);
    const r={ava, parts, route, hits:[], reason:''};
    if(route.kind!=='stacks'){ r.reason='not-stacks'; return r; }
    if(parts.prefix)          { r.reason='media';         return r; }
    if(!parts.cn)             { r.reason='no-call-number';return r; }
    if(!isLocatable(parts.cn)){ r.reason='unparseable';   return r; }
    r.hits=shelfHits(parts.cn);
    if(!r.hits.length) r.reason='unmapped';
    return r;
  }

  /* ---- carrier: what the thing physically is ----
     "The newest edition of Atlas Shrugged" at UCLA is a 2022 Blackstone Audio recording, and
     not one field designed to say so says so: the leader calls it language material, there is
     no 007, no 336, no 338, no GMD and no 300 — it is an OverDrive brief record. Detection is
     therefore a ladder of signals, strongest first, and the bottom rung only fires when every
     rung above it came up empty.

     This matters beyond labelling. Editions cluster per carrier, so the audiobook forms its
     own group instead of crowning itself the newest edition of the novel, and print gets a
     small ranking bonus, because at a physical library desk the default question is about a
     book. */
  const CARRIER={
    print:     {label:'', short:'print'},
    audio:     {label:'Audiobook',       short:'audio'},
    music:     {label:'Recorded music',  short:'music'},
    video:     {label:'Video',           short:'video'},
    score:     {label:'Printed score',   short:'score'},
    map:       {label:'Map',             short:'map'},
    image:     {label:'Image',           short:'image'},
    software:  {label:'Software / data', short:'software'},
    manuscript:{label:'Manuscript',      short:'manuscript'},
    object:    {label:'Object',          short:'object'},
    mixed:     {label:'Mixed material',  short:'mixed'},
    microform: {label:'Microform',       short:'microform'},
    online:    {label:'Online only',     short:'online'}
  };
  const AUDIO_PHRASE=/\b(sound recording|audiobook|audio ?book|spoken word|audio disc|sound disc|sound cassette|audiocassette|audio cassette|playaway|mp3)\b/i;
  // `dvd` must not fire on DVD-ROM: that is data in a book's back pocket, not a film.
  const VIDEO_PHRASE=/\b(videorecording|video ?disc|video ?cassette|dvd(?!\s*-?\s*rom)|blu-?ray|motion picture|streaming video|two-dimensional moving image)\b/i;
  const FILM_PHRASE=/\bmicro(film|fiche|opaque)\b/i;
  // Not `online resource` — that is an ebook, and the AVE rule at the bottom names it
  // correctly. Calling it software was a worse answer than calling it nothing.
  const DATA_PHRASE=/\b(cd-?rom|dvd-?rom|computer disc|computer disk)\b/i;
  // Publishers whose name states what they manufacture. Only consulted on the bottom rung.
  const AUDIO_PUB=/\b(audio|audiobooks|sound|recorded books|blackstone|books on tape|listening library|brilliance|tantor|audible|naxos|dreamscape|highbridge|caedmon)\b/i;

  function carrierOf(m){
    /* 007 is repeatable, and **only the first one describes the item itself** — the ones after
       it describe accompanying material. Harrison's 19th edition is a two-volume printed book
       with a DVD-ROM in the pocket: its 007s are `ta` (text, regular print) and then
       `vf cbahos`. Scanning all of them called the book a video and split it out of its own
       edition cluster, which is worse than not classifying it at all. */
    const t7=String((m.f007||[])[0]||'').charAt(0).toLowerCase();
    if(t7==='s') return m.ldr06==='j'?'music':'audio';
    if(t7==='v'||t7==='m'||t7==='g') return 'video';
    if(t7==='h') return 'microform';
    if(t7==='k') return 'image';
    if(t7==='a'||t7==='d') return 'map';
    if(t7==='q') return 'score';
    if(t7==='t') return 'print';          // "regular print", stated outright
    switch(m.ldr06){
      case 'i': return 'audio';
      case 'j': return 'music';
      case 'g': return 'video';
      case 'c': case 'd': return 'score';
      case 'e': case 'f': return 'map';
      case 'k': return 'image';
      case 'm': return 'software';
      case 'r': return 'object';
      case 'p': return 'mixed';
    }
    /* RDA says it plainly when it is present: 336 content + 338 carrier. "text" in a "volume"
       is a book and nothing in the 300 can argue with it. */
    const c336=(m.term336||'').toLowerCase(), c338=(m.term338||'').toLowerCase();
    if(/\btext\b/.test(c336) && /\bvolume\b/.test(c338)) return 'print';
    const bag=[m.term338,m.term336,m.gmd,m.phys].filter(Boolean).join(' ');
    if(AUDIO_PHRASE.test(bag)) return 'audio';
    if(VIDEO_PHRASE.test(bag)) return 'video';
    if(FILM_PHRASE.test(bag))  return 'microform';
    if(DATA_PHRASE.test(bag) && !m.hasAVA) return 'software';
    /* The bottom rung, and the reason it exists: "Unabridged." in the edition statement beside
       a publisher named for what it makes. Both are required. "Unabridged" on its own is an
       ordinary print edition statement, and a publisher with "Sound" in its name is not
       evidence of anything by itself. */
    if(/\b(un)?abridged\b/i.test(m.edition||'') && AUDIO_PUB.test(m.publisher||'')) return 'audio';
    if(!m.hasAVA && m.hasAVE) return 'online';
    return 'print';
  }
  const carrierLabel=c=>(CARRIER[c]||CARRIER.print).label;

  /* ---- libraries and scopes ----
     `alma.permanentPhysicalLocation` is the only index that filters by where a copy sits.
     Every library-shaped index — `itemLibrary`, `holding_Library`, `rep_Library`,
     `current_Library` — returns zero for every spelling of every library name, probed. So
     "which building" has to be asked as "which location codes", and those are per-shelf, not
     per-library.

     What makes that workable is that UCLA's location codes are prefixed by library, and the
     index honours **trailing truncation under the `all` relation** (`=` with a star returns
     zero, which is the usual silent-failure trap here). One clause per library:

         alma.permanentPhysicalLocation all "bi*"

     A prefix beats the enumerated list the Biomed routing table carries: it returned 83 more
     records than the nine known `bi*` codes, i.e. sublocations nobody has catalogued here yet,
     and those still land honestly on the "not in the routing table" path rather than vanishing.

     All 22 prefixes below were checked for leakage against a 40-holding sample each: every one
     resolves to exactly one library, none bleeds into another. `code` is the AVA `$b`. */
  const LIBRARY={
    biomed:    {pre:'bi',  code:'BIOMED',     name:'Biomed Library',                    short:'Biomed', mapped:true},
    yrl:       {pre:'yr',  code:'YRL',        name:'Young Research Library',            short:'YRL'},
    powell:    {pre:'cl',  code:'POWELL',     name:'Powell Library',                    short:'Powell'},
    arts:      {pre:'ar',  code:'ARTS',       name:'Arts Library',                      short:'Arts'},
    music:     {pre:'mu',  code:'MUSIC',      name:'Music Library',                     short:'Music'},
    law:       {pre:'lw',  code:'LAW',        name:'Law Library',                       short:'Law'},
    eal:       {pre:'ea',  code:'EAL',        name:'East Asian Library',                short:'East Asian'},
    sel:       {pre:'sm',  code:'SEL_EMS',    name:'Science & Engineering · SEL/EMS',    short:'SEL/EMS'},
    geology:   {pre:'sg',  code:'SEL_GEO',    name:'SEL · Geology',                      short:'SEL/Geology'},
    clark:     {pre:'ck',  code:'CLARK',      name:'Clark Library',                     short:'Clark'},
    lsc:       {pre:'ls',  code:'LSC',        name:'Library Special Collections',       short:'Special Collections'},
    ftva:      {pre:'ft',  code:'FTVA',       name:'Film & Television Archive',         short:'FTVA'},
    management:{pre:'mg',  code:'MANAGEMENT', name:'Management Library',                short:'Management'},
    csrc:      {pre:'cs',  code:'CSRC',       name:'Chicano Studies Research Center',   short:'CSRC'},
    aisc:      {pre:'ai',  code:'AISC',       name:'American Indian Studies Center',    short:'AISC'},
    aasc:      {pre:'aa',  code:'AASC',       name:'Asian American Studies Center',     short:'AASC'},
    iml:       {pre:'il',  code:'IML',        name:'Instructional Media Laboratory',    short:'IML'},
    err:       {pre:'err', code:'ERR',        name:'English Reading Room',              short:'English RR'},
    ethno:     {pre:'et',  code:'ETHNOMUS',   name:'Ethnomusicology Archive',           short:'Ethnomusicology'},
    labschool: {pre:'ue',  code:'LABS',       name:'UCLA Lab School Library',           short:'Lab School'},
    srlf:      {pre:'sr',  code:'SRLF',       name:'SRLF, offsite storage',             short:'SRLF', offsite:true},
    ucla:      {pre:null,  code:'',           name:'Every UCLA library',                short:'All of UCLA'}
  };
  const LIB_BY_CODE=(function(){ const m={}; for(const k in LIBRARY) if(LIBRARY[k].code) m[LIBRARY[k].code]=LIBRARY[k]; return m; })();

  // Sub-scopes. Only Biomed has a shelf map, so only Biomed has a "walkable" subset.
  const SUBSCOPE={
    stacks:{codes:['bi','biper','biprwt','bian'], lib:'biomed',
            label:'Biomed, shelves you can walk to', short:'Walkable stacks'},
    ref:   {codes:['birf'], lib:'biomed', label:'Biomed Reference \u00b7 Floor 4', short:'Reference'},
    desk:  {codes:['birs','bicidperm','bicimm','biherb'], lib:'biomed',
            label:'Biomed service desks (reserves, media, herbarium)', short:'At the desk'}
  };
  // One scope key is either a LIBRARY key or a SUBSCOPE key. This resolves either.
  function SCOPE(key){
    if(SUBSCOPE[key]) return SUBSCOPE[key];
    const L=LIBRARY[key]||LIBRARY.ucla;
    return {pre:L.pre, lib:key, label:L.name, short:L.short};
  }
  /* Which library the reader is standing in. It changes what counts as "here" — grouping,
     the copies-only filter and the ranking nudge — but never what may be given a shelf: the
     shelf map covers Biomed and nothing else, so `resolve` still refuses everywhere else. */
  let hereLib='BIOMED';
  const setHereLib=c=>{ hereLib=String(c||'BIOMED').toUpperCase(); };
  const SCOPE_ALIAS=(function(){
    const m={ bio:'biomed', building:'biomed',
      stacks:'stacks', walkable:'stacks', shelf:'stacks', shelves:'stacks',
      ref:'ref', reference:'ref', desk:'desk', reserves:'desk', reserve:'desk',
      ucla:'ucla', all:'ucla', any:'ucla', anywhere:'ucla', everywhere:'ucla',
      young:'yrl', research:'yrl', sciences:'sel', engineering:'sel', boelter:'sel',
      geo:'geology', geology:'geology', special:'lsc', specialcollections:'lsc',
      film:'ftva', television:'ftva', mgmt:'management', anderson:'management',
      eastasian:'eal', chicano:'csrc', offsite:'srlf', storage:'srlf', labschool:'labschool' };
    for(const k in LIBRARY) m[k]=k;         // every library key is its own alias
    return m;
  })();
  // `at:here` means wherever the reader said they are, not a fixed building.
  const resolveScopeAlias=(v,current)=>{
    const k=String(v||'').toLowerCase().replace(/[^a-z]/g,'');
    if(k==='here'||k==='mine'||k==='thislibrary') return current||'biomed';
    return SCOPE_ALIAS[k]||'';
  };

  /* ---- the filter vocabulary ----
     Each entry is one index probed live against this endpoint on 2026-08-05. Nothing is
     offered that was not observed to narrow a real result set: `alma.mms_resource_type`,
     `alma.audience` and every *_Library index answer queries and return zero for every
     value tried, which is worse than not existing, so none of them is here. */
  const FIELD={
    keyword:  {ix:'alma.all_for_ui',           rel:'all', label:'keyword'},
    title:    {ix:'alma.title',                rel:'words', label:'title'},
    author:   {ix:'alma.creator',              rel:'words', label:'author'},
    subject:  {ix:'alma.subjects',             rel:'words', label:'subject'},
    mesh:     {ix:'alma.mesh',                 rel:'words', label:'MeSH subject'},
    lcsh:     {ix:'alma.lcsh',                 rel:'words', label:'LC subject'},
    series:   {ix:'alma.series',               rel:'words', label:'series'},
    genre:    {ix:'alma.genre_form',           rel:'words', label:'genre / form'},
    uniform:  {ix:'alma.uniform_title',        rel:'words', label:'uniform title'},
    publisher:{ix:'alma.publisher',            rel:'words', label:'publisher'},
    place:    {ix:'alma.publisher_location',   rel:'words', label:'place of publication'},
    note:     {ix:'alma.notes',                rel:'words', label:'note'},
    isbn:     {ix:'alma.isbn',                 rel:'=',   label:'ISBN', strip:/[^0-9Xx]/g},
    issn:     {ix:'alma.issn',                 rel:'=',   label:'ISSN'},
    cn:       {ix:'alma.PermanentCallNumber',  rel:'=',   label:'call number'},
    nlm:      {ix:'alma.nlm_call_number',      rel:'=',   label:'NLM call number'},
    lc:       {ix:'alma.lc_class_number',      rel:'=',   label:'LC call number'},
    lang:     {ix:'alma.language',             rel:'=',   label:'language', map:'lang'},
    loc:      {ix:'alma.permanentPhysicalLocation', rel:'=', label:'location code', lower:true},
    material: {ix:'alma.materialType',         rel:'=',   label:'item material type', upper:true},
    year:     {kind:'year',  label:'publication year'},
    after:    {kind:'year',  label:'published after',  op:'>'},
    before:   {kind:'year',  label:'published before', op:'<'},
    type:     {kind:'type',  label:'record type'},
    at:       {kind:'scope', label:'search scope'},
    sort:     {kind:'sort',  label:'sort order'},
    shelf:    {kind:'local', label:'has a walkable shelf'},
    level:    {kind:'local', label:'stack level'},
    avail:    {kind:'local', label:'on the shelf now'},
    online:   {kind:'local', label:'electronic copy'},
    editions: {kind:'local', label:'edition grouping'},
    /* Local rather than server-side on purpose. `type:` asks Alma about the MARC leader,
       which is exactly the field the Atlas Shrugged audiobook gets wrong; `carrier:` asks
       this app, which read six fields instead of one. */
    carrier:  {kind:'local', label:'carrier'}
  };
  const ALIAS={ti:'title', t:'title', au:'author', a:'author', creator:'author', by:'author',
    su:'subject', subj:'subject', subjects:'subject', kw:'keyword', all:'keyword', anyword:'keyword',
    pub:'publisher', form:'genre', ut:'uniform', notes:'note', comment:'note',
    call:'cn', callno:'cn', callnumber:'cn', cno:'cn',
    language:'lang', location:'loc', item:'material', mat:'material',
    date:'year', published:'year', yr:'year', y:'year', since:'after', from:'after',
    until:'before', to:'before', kind:'type', format:'type',
    scope:'at', library:'at', lib:'at', in:'at',
    edition:'editions', eds:'editions', lvl:'level', floor:'level',
    available:'avail', instock:'avail', ebook:'online', electronic:'online',
    is:'carrier', medium:'carrier'};
  // carrier: values, and the words people reach for first
  const CARRIER_ALIAS={print:'print', book:'print', paper:'print', physical:'print',
    audio:'audio', audiobook:'audio', spoken:'audio', music:'music',
    video:'video', dvd:'video', film:'video', score:'score', map:'map', image:'image',
    software:'software', data:'software', manuscript:'manuscript', object:'object',
    mixed:'mixed', microform:'microform', microfilm:'microform', online:'online',
    ebook:'online', electronic:'online'};

  // MARC language codes for the languages a UCLA biomedical collection actually contains.
  // Anything unrecognised is passed through, so `lang:tur` works without being listed.
  const LANG={english:'eng', spanish:'spa', french:'fre', german:'ger', italian:'ita',
    portuguese:'por', russian:'rus', chinese:'chi', japanese:'jpn', korean:'kor',
    latin:'lat', arabic:'ara', hebrew:'heb', dutch:'dut', polish:'pol', swedish:'swe',
    danish:'dan', norwegian:'nor', greek:'gre', hindi:'hin', persian:'per', turkish:'tur',
    vietnamese:'vie', thai:'tha', czech:'cze', hungarian:'hun', ukrainian:'ukr'};

  /* MARC leader/06 (type of record) and leader/07 (bibliographic level). Alma exposes both
     and they are the only working format filter — `alma.mms_resource_type` returns zero for
     every documented value. Counts in a probe: type_of_record a=115692, g=2741, j=201,
     t=1185; bib_level m=112725, s=6904. */
  const TYPE={
    book:      ['alma.type_of_record=a','alma.bib_level=m'],
    monograph: ['alma.type_of_record=a','alma.bib_level=m'],
    journal:   ['alma.bib_level=s'],
    serial:    ['alma.bib_level=s'],
    periodical:['alma.bib_level=s'],
    magazine:  ['alma.bib_level=s'],
    video:     ['alma.type_of_record=g'],
    film:      ['alma.type_of_record=g'],
    dvd:       ['alma.type_of_record=g'],
    audio:     ['(alma.type_of_record=i or alma.type_of_record=j)'],
    sound:     ['(alma.type_of_record=i or alma.type_of_record=j)'],
    music:     ['alma.type_of_record=j'],
    score:     ['alma.type_of_record=c'],
    map:       ['alma.type_of_record=e'],
    software:  ['alma.type_of_record=m'],
    dataset:   ['alma.type_of_record=m'],
    manuscript:['alma.type_of_record=t'],
    image:     ['alma.type_of_record=k'],
    object:    ['alma.type_of_record=r'],
    mixed:     ['alma.type_of_record=p'],
    archive:   ['alma.type_of_record=p'],
    collection:['alma.bib_level=c']
  };
  // alma.materialType, item level. Values verified to return records; VIDEO, AUDIOCD and
  // GOVDOC all return zero here and are deliberately absent.
  const MATERIAL={book:'BOOK', issue:'ISSUE', bound:'ISSBD', dvd:'DVD', cdrom:'CDROM',
    map:'MAP', microform:'MICROFORM', score:'SCORE', record:'RECORD', mixed:'MIXED',
    other:'OTHER'};

  const SORTS={
    best:  {label:'Best match, then newest', server:'alma.main_pub_date/descending'},
    newest:{label:'Newest first',            server:'alma.main_pub_date/descending'},
    oldest:{label:'Oldest first',            server:'alma.main_pub_date/ascending'},
    title: {label:'Title A\u2013Z',          server:'alma.title/ascending'},
    author:{label:'Author A\u2013Z',         server:'alma.creator/ascending'},
    shelf: {label:'Shelf order (walk it)',   server:'alma.main_pub_date/descending'}
  };
  const SORT_ALIAS={relevance:'best', best:'best', match:'best', new:'newest', newest:'newest',
    year:'newest', recent:'newest', old:'oldest', oldest:'oldest', title:'title',
    az:'title', author:'author', creator:'author', shelf:'shelf', callnumber:'shelf', cn:'shelf'};

  /* ---- query parsing ----
     One box, two languages. Anything that is not a recognised `field:value` token is free
     text and goes to whichever index the mode pills selected. A leading `-` negates.
     Values may be quoted, so `series:"Current clinical strategies"` is one value. */
  function tokenize(s){
    const re=/(-)?(?:([A-Za-z_]+):)?(?:"([^"]*)"|'([^']*)'|(\S+))/g, out=[];
    let m;
    while((m=re.exec(s||''))){
      const val=m[3]!==undefined?m[3]:(m[4]!==undefined?m[4]:m[5]);
      if(val===undefined) continue;
      // Whether the reader quoted the value is a real instruction, not punctuation: it is
      // what separates "the words, in any order" from "these words, in this order".
      out.push({neg:!!m[1], field:(m[2]||'').toLowerCase(), val:val, raw:m[0],
                quoted:(m[3]!==undefined||m[4]!==undefined)});
    }
    return out;
  }

  /* year:2015  year:>=2015  year:2010-2020  year:2010..2020  year:2015+  year:..1990
     Returns a list of CQL clauses, or null if the value is not a year expression at all —
     in which case the caller reports it rather than quietly dropping the filter. */
  function yearClauses(v,forced){
    const IX='alma.main_pub_date', s=String(v==null?'':v).trim();
    let m;
    if(forced && /^\d{3,4}$/.test(s)) return [IX+forced+s];
    if((m=s.match(/^(>=|<=|>|<|=)?\s*(\d{3,4})$/))) return [IX+(m[1]==='='||!m[1]?'=':m[1])+m[2]];
    if((m=s.match(/^(\d{3,4})\s*(?:\.\.|-|\u2013|to)\s*(\d{3,4})$/i))) return [IX+'>='+m[1], IX+'<='+m[2]];
    if((m=s.match(/^(\d{3,4})\s*\+$/))) return [IX+'>='+m[1]];
    if((m=s.match(/^(?:\.\.|-|\u2013)\s*(\d{3,4})$/))) return [IX+'<='+m[1]];
    if((m=s.match(/^(\d{4})s$/))) return [IX+'>='+m[1], IX+'<='+(+m[1]+9)];
    return null;
  }

  const YESNO={yes:true, y:true, true:true, on:true, '1':true, only:true,
               no:false, n:false, false:false, off:false, '0':false, none:false};

  /* Parse the whole box into: free text, server clauses, client-side predicates, sort and
     scope. `notes` records every decision in words so the UI can show what it did — an
     advanced filter that narrows silently is indistinguishable from a catalogue gap. */
  function parseQuery(s,here){
    const p={text:'', phrase:false, pos:[], neg:[], local:{}, sort:'', scope:'', here:here||'', notes:[], errors:[]};
    const free=[]; let freeQuoted=0;
    tokenize(s).forEach(tk=>{
      if(!tk.field){ free.push(tk.neg?'-'+tk.val:tk.val); if(tk.quoted) freeQuoted++; return; }
      const name=ALIAS[tk.field]||tk.field, spec=FIELD[name];
      if(!spec){ p.errors.push('There is no filter called \u201c'+tk.field+'\u201d. It was searched as ordinary text.'); free.push(tk.raw); return; }
      const v=String(tk.val==null?'':tk.val).trim();
      if(!v){ p.errors.push('\u201c'+tk.field+':\u201d was given no value, so it was ignored.'); return; }

      if(spec.kind==='scope'){
        const k=resolveScopeAlias(v,p.here);
        if(!k) p.errors.push('Unknown place \u201c'+v+'\u201d. Try a library (biomed, yrl, powell, arts, music, law, sel, clark\u2026), or stacks, reference, desk, ucla.');
        else { p.scope=k; p.notes.push('scope: '+SCOPE(k).label); }
        return;
      }
      if(spec.kind==='sort'){
        const k=SORT_ALIAS[v.toLowerCase()];
        if(!k) p.errors.push('Unknown sort \u201c'+v+'\u201d. Try best, newest, oldest, title, author or shelf.');
        else { p.sort=k; p.notes.push('sort: '+SORTS[k].label.toLowerCase()); }
        return;
      }
      if(spec.kind==='year'){
        const cl=yearClauses(v, spec.op);
        if(!cl){ p.errors.push('\u201c'+tk.field+':'+v+'\u201d is not a year or year range.'); return; }
        (tk.neg?p.neg:p.pos).push.apply(tk.neg?p.neg:p.pos, cl);
        p.notes.push((tk.neg?'not ':'')+spec.label+' '+v);
        return;
      }
      if(spec.kind==='type'){
        const cl=TYPE[v.toLowerCase()];
        if(!cl){ p.errors.push('Unknown type \u201c'+v+'\u201d. Try book, journal, video, audio, music, score, map, software, manuscript, image or archive.'); return; }
        (tk.neg?p.neg:p.pos).push.apply(tk.neg?p.neg:p.pos, cl);
        p.notes.push((tk.neg?'not ':'')+'type: '+v.toLowerCase());
        return;
      }
      if(spec.kind==='local'){
        localFilter(p,name,v,tk.neg);
        return;
      }
      // an ordinary index
      let val=v;
      if(spec.map==='lang') val=LANG[val.toLowerCase()]||val.toLowerCase();
      if(name==='material') val=MATERIAL[val.toLowerCase()]||val.toUpperCase();
      if(spec.strip) val=val.replace(spec.strip,'');
      if(spec.lower) val=val.toLowerCase();
      if(!val){ p.errors.push('\u201c'+tk.field+':'+v+'\u201d left nothing to search for.'); return; }
      /* Not `tk.quoted`. In `field:value` the quotes are how a multi-word value is supplied
         at all, so reading them as a request for a phrase would mean `author:"ayn rand"` —
         the only way to write that filter — was the one spelling of it that fails. Quoting
         means "phrase" in the search box, where it is optional; here it means nothing. */
      (tk.neg?p.neg:p.pos).push(clause(spec,val,false));
      p.notes.push((tk.neg?'not ':'')+spec.label+': '+val);
    });
    p.text=free.join(' ').trim();
    // One quoted run and nothing else is a phrase search. Two quoted runs, or a quoted run
    // beside loose words, is not: there is no phrase to ask the endpoint for.
    p.phrase=(freeQuoted===1 && free.length===1);
    return p;
  }

  function localFilter(p,name,v,neg){
    const lv=v.toLowerCase();
    if(name==='level'){
      const lv2=v.split(/[,\s]+/).map(x=>parseInt(x,10)).filter(x=>!isNaN(x));
      if(!lv2.length){ p.errors.push('\u201clevel:'+v+'\u201d is not a stack level.'); return; }
      p.local.levels=(p.local.levels||[]).concat(lv2);
      p.notes.push('only shelves on level '+lv2.join(' or '));
      return;
    }
    if(name==='carrier'){
      const want=v.split(/[,\s]+/).map(x=>CARRIER_ALIAS[x.toLowerCase()]).filter(Boolean);
      if(!want.length){ p.errors.push('“carrier:'+v+'” is not a carrier. Try print, audio, video, music, score, map, microform, software, image or online.'); return; }
      (neg?(p.local.carrierNot=p.local.carrierNot||[]):(p.local.carrier=p.local.carrier||[])).push.apply(
        neg?p.local.carrierNot:p.local.carrier, want);
      p.notes.push((neg?'not ':'')+'carrier: '+want.join(' or '));
      return;
    }
    if(name==='editions'){
      if(lv==='all'||lv==='every'||lv==='show'){ p.local.groupEditions=false; p.notes.push('every printing listed separately'); }
      else if(lv==='newest'||lv==='group'||lv==='latest'){ p.local.groupEditions=true; p.notes.push('editions grouped, newest on top'); }
      else p.errors.push('\u201ceditions:'+v+'\u201d is not valid. Try editions:all or editions:newest.');
      return;
    }
    const b=YESNO[lv];
    if(b===undefined){ p.errors.push('\u201c'+name+':'+v+'\u201d expects yes or no.'); return; }
    const want=neg?!b:b;
    p.local[name]=want;
    p.notes.push(name==='shelf' ? (want?'only copies that resolve to a shelf':'only copies with no mapped shelf')
              : name==='avail' ? (want?'only titles with a copy on the shelf now':'only titles with nothing available')
              : name==='online'? (want?'only titles with an electronic copy':'only titles with no electronic copy')
              : name+': '+(want?'yes':'no'));
  }

  const cqlSafe=v=>String(v==null?'':v).replace(/["\\]/g,' ').replace(/\s+/g,' ').trim();
  /* `=` on this endpoint is a phrase match: the words, in that order, adjacent. That is right
     for an identifier and wrong for everything a reader types from memory, and it was wrong in
     the way that costs the most — `alma.creator="ayn rand"` returns 3 records because MARC
     files the name as "Rand, Ayn, 1905-1982", while `all` returns 61. "dan longo" is the
     starker case: 0 as a phrase, 11 as words.

     So descriptive fields resolve to `all` and identifier fields stay `=`, and quoting the
     value asks for the phrase back. Nothing is lost and the common case stops failing. */
  function relationFor(spec,quoted){
    if(spec.rel==='all') return 'all';
    if(spec.rel==='words') return quoted?'=':'all';
    return '=';
  }
  function clause(spec,val,quoted){
    const v=cqlSafe(val);
    return relationFor(spec,quoted)==='all' ? spec.ix+' all "'+v+'"' : spec.ix+'="'+v+'"';
  }

  /* ---- CQL assembly ----
     Three rules this endpoint enforces and does not document, all probed:
       1. A single clause must never be wrapped in parentheses. `(alma.title="x") and y`
          comes back "Invalid query".
       2. A clause using the `all` relation must never be wrapped either — and that one
          fails *silently*: `(alma.all_for_ui all "x") and y` returns 0 records, which
          reads as "the library does not have it". It is the worst failure available here,
          so the keyword clause is always emitted bare and first.
       3. A parenthesised group of two or more simple clauses is fine anywhere.
     Hence: no parentheses are ever emitted around one clause, and the free-text clause
     always leads. */
  const orGroup=cl=>!cl.length?'':(cl.length===1?cl[0]:'('+cl.join(' or ')+')');

  function buildCQL(parsed,mode,scopeKey,sortKey){
    const lead=[], rest=[];
    if(parsed.text){
      const f=FIELD[mode]||FIELD.keyword;
      let t=parsed.text;
      if(f.strip) t=t.replace(f.strip,'');
      /* A search box holding one quoted run is a phrase search; otherwise the words.
         `all` clauses lead, because rule 2 above is about where they must not end up. */
      const q=!!parsed.phrase;
      if(t) (relationFor(f,q)==='all'?lead:rest).push(clause(f,t,q));
    }
    parsed.pos.forEach(c=>rest.push(c));
    // A scope is a narrowing of somebody's question, never a question of its own: with
    // nothing else asked for it would return the entire Biomed collection.
    if(!lead.length && !rest.length && !parsed.neg.length) return '';
    const sc=SCOPE(scopeKey);
    if(sc.codes)      rest.push(orGroup(sc.codes.map(c=>'alma.permanentPhysicalLocation='+c)));
    else if(sc.pre)   rest.push('alma.permanentPhysicalLocation all "'+sc.pre+'*"');
    let q=lead.concat(rest).filter(Boolean).join(' and ');
    if(!q) return '';
    parsed.neg.forEach(c=>{ q+=' not '+c; });
    const srt=SORTS[sortKey]||SORTS.best;
    // Only alma.main_pub_date, alma.title and alma.creator are sortable; anything else is
    // rejected outright, so the table above is the whole permitted vocabulary.
    if(srt.server) q+=' sortBy '+srt.server;
    return q;
  }

  /* ---- relevance ----
     Alma SRU does no relevance ranking: it returns hits in filing-title order, so a search
     for "atlas shrugged" hands back "The American Bible" first. The `sortKeys` *parameter*
     is accepted and ignored; the CQL `sortBy` *clause* does work and is used above, but it
     sorts by date or title, never by how well a record answers the question. Every bit of
     that is local, below. */

  const ARTICLE=/^(?:the|a|an|le|la|les|el|los|las|der|die|das|il|un|une)\s+/;
  function norm(s){
    // NFD splits an accented letter into letter + combining mark, and \p{M} then deletes the
    // mark outright — it must not go through the punctuation pass below, which would leave a
    // space and turn "Pediatría" into "pediatri a". Apostrophes are deleted for the same
    // reason: "harrison's" has to become "harrisons", not "harrison s".
    return (s||'').toLowerCase().normalize('NFD')
      .replace(/\p{M}/gu,'')
      .replace(/['\u2019]/g,'')
      .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  }
  const normTitle=s=>norm(s).replace(ARTICLE,'');
  const words=s=>normTitle(s).split(' ').filter(Boolean);

  // Bounded Levenshtein — bails out as soon as it cannot come in under `max`.
  function lev(a,b,max){
    if(a===b) return 0;
    const m=a.length, n=b.length;
    if(Math.abs(m-n)>max) return max+1;
    let prev=new Array(n+1), cur=new Array(n+1);
    for(let j=0;j<=n;j++) prev[j]=j;
    for(let i=1;i<=m;i++){
      cur[0]=i;
      let best=cur[0];
      for(let j=1;j<=n;j++){
        cur[j]=Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+(a.charCodeAt(i-1)===b.charCodeAt(j-1)?0:1));
        if(cur[j]<best) best=cur[j];
      }
      if(best>max) return max+1;
      const t=prev; prev=cur; cur=t;
    }
    return prev[n];
  }
  // How wrong a word may be before it stops counting as the same word. Short words get no
  // slack — at three letters an edit is a different word, not a typo.
  const slack=t=>t.length<=3?0:t.length<=6?1:2;
  // Returns both how good the match was and *which* word matched, because the weighting
  // below needs the document word's rarity, not the typo's.
  function matchWord(t,list){
    const d=slack(t);
    let best={q:0,w:null};
    for(let i=0;i<list.length;i++){
      const w=list[i];
      if(w===t) return {q:1,w:w};
      if(t.length>=4 && w.indexOf(t)===0){ if(best.q<0.9) best={q:0.9,w:w}; continue; }
      if(d && lev(t,w,d)<=d && best.q<0.8) best={q:0.8,w:w};
    }
    return best;
  }
  const wordIn=(t,list)=>matchWord(t,list).q;

  /* Inverse document frequency over the pool actually fetched. Without it every query word
     weighs the same, and in a medical library "medicine" — in a large share of all titles —
     drowns out "harrisons", which is in almost none. The pool is a sample rather than the
     whole catalogue, which is enough to separate the distinctive words in a query from the
     filler, and it costs no extra request. */
  function idfContext(recs){
    const df=Object.create(null), N=(recs&&recs.length)||0;
    if(!N) return null;
    recs.forEach(r=>{
      const seen=Object.create(null);
      words(r.title).concat(norm(r.author).split(' ')).forEach(w=>{
        if(w && !seen[w]){ seen[w]=1; df[w]=(df[w]||0)+1; }
      });
    });
    const lg=Math.log(1+N);
    return { N:N, df:df, weight:function(t){ return Math.log(1+N/(1+(df[t]||0)))/lg; } };
  }

  // Share of the query the list accounts for. With a context the share is weighted by how
  // rare each word is; without one — which is how the unit tests call it — every word
  // counts the same and this is the original plain average.
  function coverage(qw,list,ctx){
    if(!qw.length) return 0;
    let num=0, den=0;
    for(let i=0;i<qw.length;i++){
      const m=matchWord(qw[i],list);
      const wt=ctx?Math.max(0.05,ctx.weight(m.w||qw[i])):1;
      den+=wt; num+=wt*m.q;
    }
    return den?num/den:0;
  }

  // The longest run of query words that appears in the title in the same order, adjacent.
  // "principles of internal medicine" inside a 30-word title is a real signal that a bag of
  // words cannot see.
  function runBonus(qw,tw){
    if(qw.length<2||!tw.length) return 0;
    let best=0;
    for(let i=0;i<tw.length;i++){
      let k=0;
      while(k<qw.length && i+k<tw.length && matchWord(qw[k],[tw[i+k]]).q>0) k++;
      if(k>best) best=k;
    }
    return best<2?0:(best-1)/(qw.length-1);
  }

  /* Score one record against the typed query. Title dominates; a long title that merely
     contains the query is worth less than a title that *is* it; everything else earns
     credit only for the words the title left unexplained. `ctx` is optional — pass the
     pool's idf context to weight rare words, omit it to weight every word alike. */
  function scoreRecord(rec,query,ctx){
    const qn=normTitle(query), qw=qn.split(' ').filter(Boolean);
    if(!qw.length) return 0;
    const mainN=normTitle(rec.titleMain||rec.title), fullN=normTitle(rec.title);
    const fullW=fullN.split(' ').filter(Boolean);

    let s=0, exact=true;
    if(fullN===qn)      s+=190;            // the whole title is what was typed
    else if(mainN===qn) s+=100;            // the main title is, but there is a subtitle
    else exact=false;

    if(!exact){
      // Whole-string typo tolerance, so "wtlas shrugged" still finds Atlas Shrugged.
      const tol=Math.max(1,Math.floor(qn.length*0.15));
      if(lev(qn,fullN,tol)<=tol || lev(qn,mainN,tol)<=tol) s+=85;
    }
    if(mainN.indexOf(qn)===0 || fullN.indexOf(qn)===0) s+=60;
    if(fullN.indexOf(qn)>=0) s+=40;
    s+=35*coverage(qw,fullW,ctx);
    s+=22*runBonus(qw,fullW);
    /* The author only earns credit for words the title did not already explain. Without this,
       searching "harrison's principles of internal medicine" gives the printings that happen
       to carry a MARC 100 for Tinsley Harrison a bonus the 2018 edition (no 100) never gets,
       and a tiny author score silently reorders every edition of the same book. The same rule
       is what lets series, subject and publisher contribute at all without doing that damage:
       "cardiology lange" finds the Lange series, "atlas shrugged rand" still finds Rand. */
    const resid=qw.filter(w=>wordIn(w,fullW)===0);
    if(resid.length){
      const share=resid.length/qw.length;
      s+=15*coverage(resid,norm(rec.author).split(' ').filter(Boolean),ctx)*share;
      const other=norm([rec.uniformTitle,rec.series,rec.subjects,rec.publisherName].join(' '))
        .split(' ').filter(Boolean);
      if(other.length) s+=10*coverage(resid,other,ctx)*share;
    }
    /* Every extra word in the title is a little less likely to be the book meant, but the old
       flat 2-per-word cap punished a six-word subtitle as hard as a thirty-word one. This
       saturates instead: the first few extra words cost real points, the twentieth costs
       almost nothing, and the ceiling is never reached abruptly. */
    const extra=Math.max(0,fullW.length-qw.length);
    s-=26*(extra/(extra+7));
    // A copy in the building you are standing in. A tiebreak, not an override.
    if(rec.hasHere===undefined?rec.hasBiomed:rec.hasHere) s+=12;
    if(rec.hasShelf)  s+=6;                // …and a copy that resolved to an actual shelf face
    /* At a physical library desk the unqualified question is about a book. A 2022 audiobook is
       not a newer edition of a 1957 novel, it is a different object; without this the year
       tiebreak crowns it. Uniform across a `carrier:`-filtered search, so it costs nothing
       when the reader did ask for the recording. */
    if(rec.carrier==='print') s+=10;
    return s;
  }

  /* ---- typo repair ----
     Dropping a word only works when the words that survive are distinctive. "wtlas shrugged"
     survives it, because "shrugged" is rare enough that the right book comes back and the
     local scorer recognises "wtlas" as one edit from "atlas". "atlas shurgged" does not:
     drop the broken word and what is left is "atlas", which matches 23 314 records at UCLA,
     none of them the novel. The query has to be *repaired*, not shortened.

     There is no spelling dictionary in this app, but there is a catalogue, and
     `maximumRecords=0` returns a count in well under a tenth of a second once the connection
     is warm. So the catalogue is the dictionary: generate the edit-1 variants of the dead
     word, substitute each back into the whole query, and ask how many records it matches.
     "atlas shurgged" is repaired to "atlas shrugged" by the third probe, in about 200 ms.

     Transpositions and deletions only. Substitution ("wtlas" for "atlas") needs 25 variants
     per character, and it is precisely the case the drop-a-word pass below already handles.
     Insertion is not covered by either, and is the known gap. */
  function wordRepairs(w){
    const out=[];
    for(let i=0;i<w.length-1;i++){                 // two letters the wrong way round
      if(w.charAt(i)===w.charAt(i+1)) continue;
      out.push(w.slice(0,i)+w.charAt(i+1)+w.charAt(i)+w.slice(i+2));
    }
    for(let i=0;i<w.length;i++){                   // one letter too many
      const d=w.slice(0,i)+w.slice(i+1);
      if(d.length>=3) out.push(d);
    }
    return out.filter((v,i,a)=>v!==w && a.indexOf(v)===i);
  }
  const substituteWord=(words,i,w)=>words.slice(0,i).concat([w],words.slice(i+1)).join(' ');

  /* ---- the catalogue as a spelling dictionary ----
     Guessing letters bounds repair to the typo classes whose variant set is small enough to
     probe: transposition and deletion. It leaves three holes. Insertion and substitution each
     need 25–26 variants per character. Worse, a **real-word typo** cannot be detected at all —
     "principals" for "principles" is a word, the catalog has 2 800 records about principals,
     so the liveness probe reports it alive and repair never even runs.

     All three close without guessing a single letter. Every probe this app makes comes back
     with records in it, and those records are made of words spelled the way the catalogue
     spells them. Match the broken word against that vocabulary and the edit class stops
     mattering: "wtlas" is one edit from "atlas", "principals" is two from "principles",
     "shruged" is one from "shrugged". Nothing was enumerated; the words were simply read off
     the results that were being fetched anyway. */
  function harvestVocab(recs){
    const n=Object.create(null);
    (recs||[]).forEach(r=>{
      normTitle(r.title||'').split(' ').concat(norm(r.author||'').split(' ')).forEach(w=>{
        if(w.length>=3) n[w]=(n[w]||0)+1;
      });
    });
    return n;
  }
  // Closest word in a harvested vocabulary. Ties go to the commoner one: the vocabulary is a
  // sample of what the catalogue actually holds, so frequency is evidence.
  function nearestWord(word,vocab,max){
    let best=null;
    for(const w in vocab){
      if(w===word) continue;
      const d=lev(word,w,max);
      if(d>max) continue;
      if(!best || d<best.d || (d===best.d && vocab[w]>best.n)) best={w:w, d:d, n:vocab[w]};
    }
    return best;
  }
  /* Prefix ladder for a truncation probe, used when a broken word has no surviving neighbours
     distinctive enough to harvest from — "atlas shruged" drops to "atlas", which is 23 314
     records of anatomy. `length - 2` is the right first rung: an insertion or a substitution
     past that point leaves the prefix intact, and every character dropped from the prefix
     dilutes the harvest with unrelated titles. Trailing `*` is the only truncation this
     endpoint honours; leading is ignored and infix returns nothing. */
  function prefixLadder(w){
    const out=[];
    [w.length-2, w.length-3, 3].forEach(L=>{ if(L>=3 && L<w.length && out.indexOf(L)<0) out.push(L); });
    return out.map(L=>w.slice(0,L));
  }
  /* Edit-1 variants that the other passes cannot reach, cheapest-to-find first.
     A missing letter at position 1 defeats everything above it: "srugged" for "shrugged"
     shares no useful prefix ("atlas srug*" returns nothing), deleting from it never produces
     the right word, and dropping it leaves "atlas" and 23 314 records of anatomy. Only
     enumeration reaches it, and enumeration means 26 insertions per position plus 25
     substitutions per character — 383 candidates for a seven-letter word.

     383 probes would be absurd. 383 *clauses* are not: a top-level OR of keyword clauses is
     accepted, 26 of them cost 1.1 s in one request, and any batch that matches something can
     simply be read for its vocabulary. So the candidates are generated in position order —
     earliest first, since late errors were already covered upstream — batched to a URL budget,
     and the first batch that returns records is harvested rather than bisected. */
  const ALPHA='abcdefghijklmnopqrstuvwxyz';
  function wordGuesses(w){
    const out=[], seen=Object.create(null);
    const add=v=>{ if(v!==w && v.length>=3 && !seen[v]){ seen[v]=1; out.push(v); } };
    for(let i=0;i<=w.length;i++){
      for(let a=0;a<26;a++) add(w.slice(0,i)+ALPHA.charAt(a)+w.slice(i));     // a letter omitted
      if(i<w.length) for(let a=0;a<26;a++) add(w.slice(0,i)+ALPHA.charAt(a)+w.slice(i+1)); // mistyped
    }
    return out;
  }
  // Group clauses into requests that stay well inside a sane URL length.
  function batchClauses(clauses,budget){
    const out=[]; let cur=[], len=0;
    clauses.forEach(c=>{
      if(cur.length && len+c.length>budget){ out.push(cur); cur=[]; len=0; }
      cur.push(c); len+=c.length+4;
    });
    if(cur.length) out.push(cur);
    return out;
  }

  // Which words of the original query a relaxation left behind.
  function wordsMissing(all,kept){
    const k=Object.create(null);
    String(kept||'').split(' ').filter(Boolean).forEach(w=>{ k[w]=1; });
    return all.filter(w=>!k[w]);
  }
  // How wrong a word may be and still be the same word, with at least one edit allowed for
  // anything long enough to be worth repairing at all.
  const repairBudget=w=>Math.max(1,slack(w));

  /* Spelling fallback. The endpoint has no fuzzy matching and no "did you mean", so when a
     query returns nothing, drop one word at a time — longest remaining query first — and let
     the local scorer fuzzy-match the survivors against what was originally typed. */
  function relaxations(query){
    const w=norm(query).split(' ').filter(Boolean);
    if(w.length<2) return [];
    const out=[];
    for(let i=0;i<w.length;i++){                       // drop one word
      const rest=w.slice(0,i).concat(w.slice(i+1));
      if(rest.length) out.push(rest.join(' '));
    }
    out.sort((a,b)=>b.length-a.length);                // keep as much of the query as possible
    const byLen=w.slice().sort((a,b)=>b.length-a.length);
    /* Two words wrong at once needs two dropped. Only pairs among the four longest words are
       tried, which bounds this at six extra queries: a real-word typo like "principals" for
       "principles" cannot be detected — it is a word, and the catalog has books about
       principals — so removing candidates is the only lever left. */
    if(w.length>=4){
      const top=byLen.slice(0,4);
      for(let i=0;i<top.length;i++) for(let j=i+1;j<top.length;j++){
        const rest=w.filter(x=>x!==top[i]&&x!==top[j]);
        if(rest.length) out.push(rest.join(' '));
      }
    }
    if(byLen.length>=2) out.push(byLen.slice(0,2).join(' '));   // then just the two longest words
    if(byLen[0] && byLen[0].length>=4) out.push(byLen[0]);      // then the single longest
    return out.filter((v,i,a)=>a.indexOf(v)===i && v);
  }
  const bestScore=(recs,q,ctx)=>recs.reduce((m,r)=>Math.max(m,scoreRecord(r,q,ctx)),0);

  // Newest first, by the year inside the call number. Holdings with no year sort last.
  function byYearDesc(a,b){
    const x=a.parts.year, y=b.parts.year;
    if(x===y) return 0;
    if(x==null) return 1;
    if(y==null) return -1;
    return y-x;
  }

  // The year a record is filed under: 008/07-10 if it is a real year, else the 264/260
  // string, else the newest year on any of its own spines.
  function recordYear(rec){
    if(rec.year!=null) return rec.year;
    let y=null;
    (rec.holdings||[]).forEach(h=>{ if(h.parts.year!=null) y=Math.max(y==null?-Infinity:y,h.parts.year); });
    return y;
  }

  /* ---- client-side predicates ----
     Filters the endpoint cannot express, because they are facts about the shelf map rather
     than about the catalogue. */
  function passesLocal(rec,local){
    if(!local) return true;
    const holds=rec.holdings||[];
    if(local.shelf!==undefined){
      const has=holds.some(h=>h.hits.length>0);
      if(has!==local.shelf) return false;
    }
    if(local.levels && local.levels.length){
      const on=holds.some(h=>h.hits.some(x=>local.levels.indexOf(x.lvl)>=0));
      if(!on) return false;
    }
    if(local.avail!==undefined){
      const av=holds.some(h=>(h.ava.e||'').toLowerCase()==='available');
      if(av!==local.avail) return false;
    }
    if(local.online!==undefined){
      const on=(rec.online||[]).length>0;
      if(on!==local.online) return false;
    }
    const car=rec.carrier||'print';
    if(local.carrier && local.carrier.indexOf(car)<0) return false;
    if(local.carrierNot && local.carrierNot.indexOf(car)>=0) return false;
    return true;
  }

  // Where in the building a record's best copy sits, for shelf-order sorting: level first,
  // then the call number itself through the same comparator the locator uses.
  function shelfKey(rec){
    let best=null;
    (rec.holdings||[]).forEach(h=>{
      h.hits.forEach(x=>{
        if(!best || x.lvl<best.lvl) best={lvl:x.lvl, cn:h.parts.cn};
      });
    });
    return best;
  }
  function cmpShelf(a,b){
    const x=shelfKey(a), y=shelfKey(b);
    if(!x&&!y) return 0;
    if(!x) return 1;
    if(!y) return -1;
    if(x.lvl!==y.lvl) return x.lvl-y.lvl;
    return cmpCN(x.cn,y.cn);
  }

  /* ---- edition clustering ----
     SRU returns flat records with no FRBR group: a Harrison's title search is 33 separate
     MMS IDs, one per printing. Clustering on the *full* 245 ($a plus $b) is the conservative
     choice — it keeps "Harrison's principles of internal medicine" together across every
     edition from 1970 to 2025 while leaving the companion handbook, the PreTest
     self-assessment and the board review as the separate books they are, because their
     subtitles differ. The cluster inherits its best member's score, so grouping never
     changes which book wins, only how many rows it takes to say so.

     The carrier is part of the key. Without it the 2022 Blackstone Audio recording of Atlas
     Shrugged joins the novel's cluster, wins the year tiebreak and is presented as the newest
     edition of the book — which is how this was found. */
  const clusterKey=rec=>(normTitle(rec.title)||('mms:'+(rec.mms||'')))+
                        ((rec.carrier&&rec.carrier!=='print')?' · '+rec.carrier:'');

  function clusterRecords(recs,query,ctx){
    const byKey=Object.create(null), order=[];
    recs.forEach((r,i)=>{
      const k=clusterKey(r);
      if(!byKey[k]){ byKey[k]={key:k, members:[], score:-Infinity, i:i}; order.push(byKey[k]); }
      const c=byKey[k];
      c.members.push({rec:r, i:i, s:scoreRecord(r,query,ctx), y:recordYear(r)});
      if(c.members[c.members.length-1].s>c.score) c.score=c.members[c.members.length-1].s;
    });
    order.forEach(c=>orient(c,'newest'));
    return order;
  }
  /* Which printing represents its cluster. Newest, except when the sort explicitly asks for
     the oldest — a "oldest first" list whose rows are each the *newest* printing of a book
     would be answering a question nobody asked. A printing with no year can never lead a
     cluster that has one, either way round: "no date" is not evidence of being current. */
  function orient(c,mode){
    const asc=mode==='oldest';
    const ordered=c.members.slice()
      .sort((a,b)=>(asc?cmpYear(b.y,a.y):cmpYear(a.y,b.y))||(a.i-b.i));
    c.head=ordered[0].rec;
    c.rest=ordered.slice(1).map(m=>m.rec);
    c.year=ordered[0].y;
    return c;
  }
  function cmpYear(x,y){
    if(x===y) return 0;
    if(x==null) return 1;
    if(y==null) return -1;
    return y-x;
  }

  /* Best match first, then newest edition first. The year tiebreak is what makes a title
     search land on the current edition: every printing of Harrison's scores identically, so
     the 2018 sorts above the 1998 without any edition clustering — and with clustering on,
     the same tiebreak picks which printing leads its group. */
  function sortClusters(clusters,mode){
    const m=SORTS[mode]?mode:'best';
    const arr=clusters.slice();
    arr.forEach(c=>{ if(c.members&&c.members.length) orient(c,m); });
    if(m==='best')   arr.sort((a,b)=>(b.score-a.score)||cmpYear(a.year,b.year)||(a.i-b.i));
    if(m==='newest') arr.sort((a,b)=>cmpYear(a.year,b.year)||(b.score-a.score)||(a.i-b.i));
    if(m==='oldest') arr.sort((a,b)=>cmpYear(b.year,a.year)||(b.score-a.score)||(a.i-b.i));
    if(m==='title')  arr.sort((a,b)=>(a.key<b.key?-1:a.key>b.key?1:0)||(a.i-b.i));
    if(m==='author') arr.sort((a,b)=>{
      const x=norm(a.head.author), y=norm(b.head.author);
      if(x&&!y) return -1;
      if(!x&&y) return 1;
      return (x<y?-1:x>y?1:0)||(a.i-b.i);
    });
    if(m==='shelf')  arr.sort((a,b)=>cmpShelf(a.head,b.head)||(b.score-a.score)||(a.i-b.i));
    return arr;
  }

  /* Does the typed string look like something other than a title? Getting this right saves
     the patron from choosing a mode pill for the two cases where the answer is unambiguous:
     a 10- or 13-digit ISBN, and a call number they copied off a spine. */
  function detectMode(s,current){
    const t=(s||'').trim();
    const digits=t.replace(/[^0-9Xx]/g,'');
    if(current==='kw'||current==='title'){
      if(/^[0-9][0-9Xx-]{8,}$/.test(t) && (digits.length===10||digits.length===13)) return 'isbn';
    }
    return null;
  }
/* == catalog-core:end == */

  /* ---- MARCXML ---- */
  function fields(rec,tag){
    const all=rec.getElementsByTagNameNS(MARC,'datafield'), out=[];
    for(let i=0;i<all.length;i++) if(all[i].getAttribute('tag')===tag) out.push(all[i]);
    return out;
  }
  function subs(df){
    const sf=df.getElementsByTagNameNS(MARC,'subfield'), m={};
    for(let i=0;i<sf.length;i++){
      const c=sf[i].getAttribute('code'), v=(sf[i].textContent||'').trim();
      m[c]= m[c]===undefined ? v : m[c]+' '+v;
    }
    return m;
  }
  function text(rec,tag,codes){
    const f=fields(rec,tag)[0]; if(!f) return '';
    const sf=f.getElementsByTagNameNS(MARC,'subfield'), parts=[];
    for(let i=0;i<sf.length;i++) if(codes.indexOf(sf[i].getAttribute('code'))>=0) parts.push((sf[i].textContent||'').trim());
    return parts.join(' ').replace(/\s+/g,' ').replace(/[\s\/:;,]+$/,'').trim();
  }
  // Every value of a repeated field, joined — subjects and series are both repeatable and
  // the second 650 is as good a match as the first.
  function texts(rec,tag,codes){
    return fields(rec,tag).map(f=>{
      const sf=f.getElementsByTagNameNS(MARC,'subfield'), parts=[];
      for(let i=0;i<sf.length;i++) if(codes.indexOf(sf[i].getAttribute('code'))>=0) parts.push((sf[i].textContent||'').trim());
      return parts.join(' ');
    }).filter(Boolean).join(' \u00b7 ').replace(/\s+/g,' ').trim();
  }
  function readRecord(rec){
    let mms='', f008='';
    const f007=[];
    const cf=rec.getElementsByTagNameNS(MARC,'controlfield');
    for(let i=0;i<cf.length;i++){
      const t=cf[i].getAttribute('tag');
      if(t==='001') mms=(cf[i].textContent||'').trim();
      if(t==='007') f007.push(cf[i].textContent||'');
      if(t==='008') f008=(cf[i].textContent||'');
    }
    const ldrEl=rec.getElementsByTagNameNS(MARC,'leader')[0];
    const ldr=ldrEl?(ldrEl.textContent||''):'';
    const pub=text(rec,'264',['b','c'])||text(rec,'260',['b','c']);
    const holdings=fields(rec,'AVA').map(df=>resolve(subs(df)));
    const online=fields(rec,'AVE').map(df=>subs(df));
    const publisherName=text(rec,'264',['b'])||text(rec,'260',['b']);
    const editionStmt=text(rec,'250',['a']);
    const carrier=carrierOf({
      ldr06:ldr.charAt(6).toLowerCase(), f007:f007,
      term338:texts(rec,'338',['a']), term336:texts(rec,'336',['a']),
      gmd:text(rec,'245',['h']), phys:text(rec,'300',['a']),
      edition:editionStmt, publisher:publisherName,
      hasAVA:holdings.length>0, hasAVE:online.length>0
    });
    return {
      carrier, online, publisherName,
      mms, pub, holdings,
      title:    text(rec,'245',['a','b'])||'(untitled record)',
      titleMain:text(rec,'245',['a']),          // ranked separately: "Atlas shrugged" beats "Atlas shrugged : manifesto of the mind"
      author:   text(rec,'100',['a','b','c','d'])||text(rec,'110',['a','b'])||text(rec,'111',['a']),
      edition:  editionStmt,          // $a only — $b is the statement of responsibility, far too long for a chip
      // Ranked, but only for query words the title did not already explain.
      uniformTitle: text(rec,'240',['a'])||text(rec,'130',['a']),
      series:   [texts(rec,'490',['a']),texts(rec,'830',['a'])].filter(Boolean).join(' \u00b7 '),
      subjects: [texts(rec,'650',['a','x']),texts(rec,'651',['a']),texts(rec,'655',['a'])].filter(Boolean).join(' \u00b7 '),
      isbns:    isbnsOf(rec),
      // 008/07-10 is the machine-readable date of publication; the 264/260 string is the fallback.
      year:     (/^(1[5-9]\d{2}|20\d{2})$/.test(f008.substr(7,4)) ? +f008.substr(7,4)
                 : (pub.match(/(1[5-9]\d{2}|20\d{2})/)||[])[1] ? +pub.match(/(1[5-9]\d{2}|20\d{2})/)[1] : null),
      hasBiomed:holdings.some(h=>(h.ava.b||'').toUpperCase()==='BIOMED'),
      hasHere:  holdings.some(h=>(h.ava.b||'').toUpperCase()===hereLib),
      hasShelf: holdings.some(h=>h.hits.length>0)
    };
  }
  // 020 $a carries qualifiers ("9780071802154 (hardcover)"); keep only well-formed ISBNs.
  function isbnsOf(rec){
    const out=[];
    fields(rec,'020').forEach(df=>{
      const raw=subs(df).a||'';
      const m=raw.match(/[0-9][0-9Xx-]{8,}/);
      if(!m) return;
      const v=m[0].replace(/-/g,'').toUpperCase();
      if((v.length===10||v.length===13) && out.indexOf(v)<0) out.push(v);
    });
    return out;
  }

  /* ---- SRU ---- */
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  /* Everything in this block exists to keep the endpoint's load proportionate to the
     question being asked. The counters are read by the diagnostics line, so the cost of a
     search is a number anyone can look at rather than something to be argued about. */
  const perf={reqs:0, cached:0, records:0, sessionReqs:0, sessionCached:0};

  /* A search is allowed this many requests. Ordinary searches use one to four; only the
     spelling-recovery ladder ever approaches the ceiling, and a query that would exceed it
     is answered with what has been found so far rather than by spending more. */
  const REQ_BUDGET=25;
  let reqSpent=0;
  function budgetLeft(){ return REQ_BUDGET-reqSpent; }

  /* Responses are reused within a session. The recovery passes re-ask identical questions by
     construction (the same probe is reached from more than one rung), and a reader who
     retypes a search that is already on screen should not cost a request at all. Availability
     is the one field that goes stale, so entries expire; the cap keeps memory bounded. */
  const CACHE_TTL=300000, CACHE_MAX=120;
  const cache=new Map();
  function cacheGet(k){
    const e=cache.get(k);
    if(!e) return null;
    if(Date.now()-e.t>CACHE_TTL){ cache.delete(k); return null; }
    cache.delete(k); cache.set(k,e);          // move to the end: plain LRU
    return e.v;
  }
  function cachePut(k,v){
    cache.set(k,{t:Date.now(), v:v});
    while(cache.size>CACHE_MAX) cache.delete(cache.keys().next().value);
  }

  /* One request in flight at a time, and never two inside this many milliseconds. The gap is
     imperceptible against a 0.5-3 s response but it puts a hard ceiling on the burst rate of
     the recovery ladder, which is the only path that ever issues requests back to back. */
  const MIN_GAP=120;
  let lastSent=0, chain=Promise.resolve();
  function throttled(fn){
    const run=chain.then(async ()=>{
      const wait=MIN_GAP-(Date.now()-lastSent);
      if(wait>0) await sleep(wait);
      lastSent=Date.now();
      return fn();
    });
    chain=run.catch(()=>{});                  // a failure must not break the queue
    return run;
  }

  // Rate limits are undocumented, so: one request in flight at a time, and two backed-off
  // retries before giving up. Never a retry storm. `sortBy` is a CQL 1.2 clause this tenant
  // does honour, but it is undocumented enough that a rejection has to be survivable: the
  // clause is dropped and the query retried once before the error reaches the user.
  async function sru(query,start,signal,max){
    /* `max||PAGE` was here, and 0 is falsy: every count-only probe asked for and was sent
       fifty full MARC records, which is the entire cost the probe existed to avoid. A
       recovered typo issued a dozen of them. */
    const want=(max===undefined||max===null)?PAGE:max;
    const key=want+'|'+start+'|'+query;
    const hit=cacheGet(key);
    if(hit){ perf.cached++; perf.sessionCached++; return hit; }
    if(reqSpent>=REQ_BUDGET){ const e=new Error('this search reached its request budget'); e.budget=true; throw e; }
    let q=query, droppedSort=false, lastErr;
    for(let attempt=0;attempt<3;attempt++){
      if(attempt) await sleep(500*Math.pow(3,attempt-1));
      const p=new URLSearchParams({version:'1.2', operation:'searchRetrieve', recordSchema:'marcxml',
                                   maximumRecords:String(want), startRecord:String(start), query:q});
      try{
        reqSpent++; perf.reqs++; perf.sessionReqs++;
        const res=await throttled(()=>fetch(SRU+'?'+p.toString(),{signal}));
        if(!res.ok) throw new Error('the catalog returned HTTP '+res.status);
        const doc=new DOMParser().parseFromString(await res.text(),'application/xml');
        if(doc.getElementsByTagName('parsererror').length) throw new Error('the catalog sent a response we could not read');
        const all=doc.getElementsByTagName('*');
        let diag='', total=0;
        for(let i=0;i<all.length;i++){
          const ln=all[i].localName;
          if(ln==='message' && !diag) diag=(all[i].textContent||'').trim();
          if(ln==='numberOfRecords' && !total) total=parseInt(all[i].textContent,10)||0;
        }
        if(diag) throw new Error(diag);
        const recs=[], marc=doc.getElementsByTagNameNS(MARC,'record');
        for(let i=0;i<marc.length;i++) recs.push(readRecord(marc[i]));
        perf.records+=recs.length;
        const out={total, records:recs, sorted:!droppedSort && / sortBy /.test(q)};
        cachePut(key,out);
        return out;
      }catch(e){
        if(e.name==='AbortError') throw e;
        lastErr=e;
        if(!droppedSort && / sortBy /.test(q)){ q=q.replace(/ sortBy .*$/,''); droppedSort=true; attempt=-1; }
      }
    }
    throw lastErr;
  }

  /* ---- render ---- */
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const SIDE={left:'Left', right:'Right', single:'Single (R)'};

  // Counts are per holding, not per bib (verified on multi-AVA records). check_holdings
  // arrives with $f/$g absent, so no number is invented for it.
  function availChip(a){
    const e=(a.e||'').toLowerCase();
    if(e==='check_holdings') return '<span class="chip vol">Multiple volumes, check at the desk</span>';
    const tot=a.f===undefined?null:parseInt(a.f,10), un=a.g===undefined?0:parseInt(a.g,10);
    if(e==='available')   return '<span class="chip ok">On shelf'+(isFinite(tot)?' \u00b7 '+Math.max(tot-un,0)+' of '+tot:'')+'</span>';
    if(e==='unavailable') return '<span class="chip no">All copies out'+(isFinite(tot)?' \u00b7 '+tot:'')+'</span>';
    return '<span class="chip">'+esc(a.e||'status unknown')+'</span>';
  }

  const WHY={
    media:'Media copy. Discs are held at a service desk, not in the stacks, so no shelf is shown.',
    'no-call-number':'This holding carries no call number, so no shelf can be resolved.',
    unparseable:'This call number could not be parsed with confidence. No shelf is shown, because a wrong aisle is worse than none.',
    unmapped:'Range not mapped. This call number falls outside every recorded shelf range. Check the floor by class letter, or ask at the desk.'
  };

  function shelfBlock(r){
    if(r.hits.length){
      let h=r.hits.map(hit=>{
        const s=shelfById(hit.id);
        const where=s?(s.row+' row \u00b7 index '+s.index):('shelf '+hit.id);
        return '<button class="found" type="button" data-lvl="'+hit.lvl+'" data-id="'+esc(hit.id)+'">'+
               '<span class="lead">Level '+hit.lvl+' \u00b7 '+esc(where)+' \u00b7 '+(SIDE[hit.side]||esc(hit.side))+' side</span>'+
               '<span class="rng">'+esc(hit.d.start)+' \u2192 '+esc(hit.d.end)+'</span></button>';
      }).join('');
      if(r.hits.length>1) h+='<div class="elsewhere">'+r.hits.length+' shelves match. A serial run shares one call number, so check the volume and year on the spine.</div>';
      return h;
    }
    return WHY[r.reason]?'<div class="nofind">'+esc(WHY[r.reason])+'</div>':'';
  }

  const groupName=ava=>ava.q||ava.c||(ava.b||'').toUpperCase()||'OTHER';

  /* Jacket art. Open Library's cover API is keyless, CORS-open, and returns 404 with
     `default=false` when it has nothing — so a missing cover removes itself rather than
     leaving a grey box. This is the one request the app makes to a third party, it carries
     only the ISBN, and the checkbox above turns it off. */
  function coverTag(rec){
    if(!covers.checked || !rec.isbns.length) return '';
    // -L is Open Library's large file (~500 px wide). -M is 180 px, which was visibly soft at
    // the size these are now displayed. Same request count, same one ISBN, no extra bytes on
    // the covers it does not have — `default=false` still 404s and the element removes itself.
    return '<img class="cover" loading="lazy" decoding="async" alt="" '+
           'src="https://covers.openlibrary.org/b/isbn/'+encodeURIComponent(rec.isbns[0])+'-L.jpg?default=false">';
  }

  function holdingRow(r){
    const shown=(r.parts.prefix?r.parts.prefix+' ':'')+(r.parts.cn||'');
    let h='<div class="hold"><div class="hold-l">';
    h+= shown ? '<span class="cn">'+esc(shown)+'</span>'
              : '<span class="cn none">no call number on this holding</span>';
    h+=availChip(r.ava);
    h+='</div>';
    // The library name is already the section heading; repeating it here reads as stutter.
    const lead=(r.route.label===groupName(r.ava))?'':esc(r.route.label);
    h+='<span class="where">'+lead+(r.route.note?(lead?'. ':'')+esc(r.route.note):'')+'</span>';
    if(r.route.kind==='stacks') h+=shelfBlock(r);
    return h+'</div>';
  }

  /* "Only my library" and "your library had nothing, so this is the rest of UCLA" are
     contradictory instructions, and the checkbox is on by default, so the reader never chose
     the one that wins. When a search has widened away from your library the filter is
     suspended for that result set: otherwise every card reads "no Biomed copy, untick only my
     library" and the answer is buried under an instruction to undo a default. */
  function onlyMine(){ return biomedOnly.checked && !widenedAway; }

  function holdingsHtml(rec){
    const keep=onlyMine()
      ? rec.holdings.filter(h=>(h.ava.b||'').toUpperCase()===LIBRARY[library].code)
      : rec.holdings.slice();
    const groups={};
    keep.forEach(h=>{
      const lib=(h.ava.b||'').toUpperCase()||'OTHER';
      (groups[lib]=groups[lib]||{name:groupName(h.ava), here:h.route.here, rows:[]}).rows.push(h);
    });
    // Group by library; the one you are standing in first, everything else alphabetically.
    const HERE=LIBRARY[library].code;
    const order=Object.keys(groups).sort((a,b)=>
      (a===HERE?-1:b===HERE?1:0) || (a<b?-1:a>b?1:0));
    let h='';
    order.forEach(lib=>{
      const g=groups[lib];
      g.rows.sort(byYearDesc);
      h+='<section class="lib'+(g.here?'':' away')+'">';
      h+='<div class="lib-n">'+esc(g.name)+'</div>';
      h+=g.rows.map(holdingRow).join('');
      h+='</section>';
    });
    if(!onlyMine() && rec.online.length){
      const names=[...new Set(rec.online.map(o=>o.m).filter(Boolean))].slice(0,3);
      h+='<section class="lib away"><div class="lib-n">Online</div><div class="hold"><span class="where">'+
         rec.online.length+' electronic '+(rec.online.length===1?'copy':'copies')+
         (names.length?' \u00b7 '+esc(names.join(', ')):'')+'. Read it in the catalog; nothing to walk to.</span></div></section>';
    }
    if(!keep.length && !rec.online.length)
      h+='<section class="lib away"><div class="hold"><span class="where">'+
         (onlyMine()?'No '+esc(LIBRARY[library].short)+' copy on this record. Untick \u201conly my library\u201d to see where else it is held.'
                            :'No copies attached to this record.')+'</span></div></section>';
    return {html:h, kept:keep.length};
  }

  function workHead(rec,extra){
    let h='<div class="work-h">'+coverTag(rec)+'<div class="work-t">';
    h+='<div class="ti">'+esc(rec.title)+'</div>';
    const by=[rec.author, rec.pub].filter(Boolean).join(' \u00b7 ');
    if(by) h+='<div class="by">'+esc(by)+'</div>';
    let tags='';
    // The carrier chip leads the row. A reader scanning results has to be able to see that
    // the 2022 "edition" is a recording before they read the year, not after they walk.
    const cl=carrierLabel(rec.carrier);
    if(cl) tags+='<span class="carr '+esc(rec.carrier)+'">'+esc(cl)+'</span>';
    if(rec.edition) tags+='<span class="ed">'+esc(rec.edition)+'</span>';
    if(extra) tags+=extra;
    if(tags) h+='<div class="tags">'+tags+'</div>';
    return h+'</div></div>';
  }

  // One cluster = one book. The newest printing is the card; the rest fold away behind a
  // count, because "which edition is current" is the question and 32 rows of Harrison's is
  // an answer to a different one.
  function clusterCard(c,idx){
    const head=holdingsHtml(c.head);
    if(onlyMine() && !head.kept && !c.head.online.length && !c.rest.length) return '';
    const older=c.rest.filter(r=>r!==c.head);
    let badge='';
    if(older.length) badge='<span class="edcount">'+(older.length+1)+' printings \u00b7 newest shown</span>';
    let h='<article class="work">'+workHead(c.head,badge)+head.html;
    if(older.length){
      h+='<details class="eds"><summary>'+older.length+' earlier printing'+(older.length===1?'':'s')+
         ' of this title</summary><div class="eds-body">';
      older.forEach(r=>{
        const sub=holdingsHtml(r), y=recordYear(r);
        h+='<div class="edrow"><div class="edrow-h"><span class="edy">'+(y==null?'no date':y)+'</span>'+
           '<span class="edt">'+esc(r.edition||r.title)+'</span></div>'+sub.html+'</div>';
      });
      h+='</div></details>';
    }
    return h+'</article>';
  }

  /* ---- state / wiring ---- */
  const POOL=150, MAX_PAGES=3,   // rank over this many records before showing anything
        MAX_TRIES=8, PROBE=10, GOOD_ENOUGH=120,  // spelling retries, probe page size, score that ends the search
        MAX_REPAIR_WORDS=6, MAX_REPAIRS=18, MIN_REPAIR_LEN=6,  // bounds on the typo-repair pass
        HARVEST=50,                              // records pulled when mining the catalogue for a spelling
        GUESS_URL=2600, MAX_GUESS_BATCHES=8,     // OR-batched edit-1 guessing: URL budget, and a hard stop
        WEAK_GUESS=45,                           // below this, a recovered query is a guess and is labelled one
        WEAK=60, WIDEN_MARGIN=40; // "nothing here resembles the title" / "out there is clearly better"
  let mode='kw', library='biomed', scopeMode='here', ctl=null, seq=0,
      loaded=[], total=0, lastQuery='', rankQuery='', relaxedTo='', usedScope='biomed',
      widenReason='', relaxedBy='', parsed=null, ctx=null, modeAuto=false, widenedAway=false;

  const MODE_FIELD={kw:'keyword', title:'title', author:'author', isbn:'isbn'};

  function setStatus(msg,err){ statusEl.innerHTML=msg||''; statusEl.classList.toggle('err',!!err); }

  /* Every control in the Filters panel is shorthand for a token you could have typed. It is
     compiled to exactly that, and the compiled string is shown back, so nothing narrows the
     result set without saying so. */
  function panelTokens(){
    const t=[];
    const g=id=>{ const el=$(id); return el?String(el.value||'').trim():''; };
    const yf=g('fYearFrom'), yt=g('fYearTo');
    if(yf&&yt) t.push('year:'+yf+'..'+yt);
    else if(yf) t.push('year:'+yf+'+');
    else if(yt) t.push('year:..'+yt);
    [['fCarrier','carrier'],['fLang','lang'],['fType','type'],['fMaterial','material'],['fLoc','loc'],
     ['fMesh','mesh'],['fSubject','subject'],['fSeries','series'],['fGenre','genre'],
     ['fPublisher','publisher'],['fAuthor','author'],['fCall','cn']].forEach(([id,field])=>{
      const v=g(id);
      if(v) t.push(field+':'+(/\s/.test(v)?'"'+v.replace(/"/g,'')+'"':v));
    });
    if($('fShelf') && $('fShelf').checked) t.push('shelf:yes');
    if($('fAvail') && $('fAvail').checked) t.push('avail:yes');
    return t;
  }

  function effectiveQuery(){
    const typed=input.value.trim();
    const extra=panelTokens();
    return {typed, full:(typed+' '+extra.join(' ')).trim(), extra};
  }

  function showApplied(p,extra){
    if(!applied) return;
    const bits=[];
    if(p.notes.length) bits.push('<span class="ap-n">'+p.notes.map(esc).join('</span><span class="ap-n">')+'</span>');
    let h='';
    if(bits.length) h+='<div class="ap-row">Filters: '+bits.join('')+'</div>';
    if(extra.length) h+='<div class="ap-eq">Equivalent to typing: <code>'+esc(extra.join(' '))+'</code></div>';
    if(p.errors.length) h+='<div class="ap-err">'+p.errors.map(esc).join('<br>')+'</div>';
    applied.innerHTML=h;
    applied.hidden=!h;
  }

  /* The footer is rendered by every branch below, including the ones that show nothing.
     It used to be attached only to a non-empty list, so a filter that emptied the ranked pool
     also removed the only control that could fetch the records where the matches actually
     were: 34 931 hits, 150 ranked, 0 shown, and no way forward. An empty page is exactly when
     "load more" is the thing the reader needs. */
  function footer(hidden){
    let f='';
    if(hidden>0) f+='<div class="cat-note">'+hidden+' record'+(hidden===1?'':'s')+
      ' in the ranked pool hidden by the shelf-side filters.</div>';
    if(loaded.length<total) f+='<div class="cat-more"><button class="btn ghost" type="button" id="catMore">Load '+
      Math.min(PAGE,total-loaded.length)+' more \u00b7 '+loaded.length+' of '+total+' ranked so far</button></div>';
    return f;
  }

  function draw(){
    if(!loaded.length){ out.innerHTML=''; return; }
    const local=(parsed&&parsed.local)||{};
    const kept=loaded.filter(r=>passesLocal(r,local));
    const hidden=loaded.length-kept.length;
    if(!kept.length){
      out.innerHTML='<div class="cat-empty">All '+loaded.length+' ranked record'+(loaded.length===1?'':'s')+
        ' were removed by the shelf-side filters (<code>'+esc(localSummary(local))+'</code>). '+
        'Those are applied here, not by the catalog. Clear them, or load more of the '+total+
        ' matches and they will be filtered too.</div>'+footer(0);
      wireCards();
      return;
    }
    const grouping=local.groupEditions!==undefined?local.groupEditions:(groupEd?groupEd.checked:true);
    const sortMode=(parsed&&parsed.sort)||(sortSel?sortSel.value:'best')||'best';
    let clusters;
    if(grouping) clusters=clusterRecords(kept,rankQuery,ctx);
    else clusters=kept.map((r,i)=>({key:'mms:'+r.mms, head:r, rest:[], members:[], i:i,
                                    score:scoreRecord(r,rankQuery,ctx), year:recordYear(r)}));
    const cards=sortClusters(clusters,sortMode).map(clusterCard).filter(Boolean);
    if(!cards.length){
      out.innerHTML='<div class="cat-empty">None of the '+kept.length+' ranked records has a copy left to show. '+
        'Untick &ldquo;only my library&rdquo; to see where else at UCLA they are held.</div>'+footer(hidden);
      wireCards();
      return;
    }
    out.innerHTML=cards.join('')+footer(hidden);
    wireCards();
  }
  // A cover Open Library does not have 404s; drop the element rather than leave a gap.
  function wireCards(){
    out.querySelectorAll('img.cover').forEach(img=>img.addEventListener('error',()=>img.remove(),{once:true}));
  }
  function localSummary(l){
    const b=[];
    if(l.shelf!==undefined) b.push('shelf:'+(l.shelf?'yes':'no'));
    if(l.avail!==undefined) b.push('avail:'+(l.avail?'yes':'no'));
    if(l.online!==undefined) b.push('online:'+(l.online?'yes':'no'));
    if(l.levels) b.push('level:'+l.levels.join(','));
    if(l.carrier) b.push('carrier:'+l.carrier.join(','));
    if(l.carrierNot) b.push('-carrier:'+l.carrierNot.join(','));
    return b.join(' ');
  }

  /* Ranking is only as good as the pool it ranks. Alma returns records in the order the
     `sortBy` clause asks for — newest first by default here — so the pool is the newest N of
     the result set rather than an alphabetical slice of it, which is the right N for
     "what is the current edition". */
  async function fetchPool(query,signal,mine){
    let recs=[], tot=0;
    for(let page=0;page<MAX_PAGES;page++){
      const r=await sru(query, recs.length+1, signal);
      if(mine!==seq) return null;
      tot=r.total;
      recs=recs.concat(r.records);
      if(!r.records.length || recs.length>=Math.min(tot,POOL)) break;
      setStatus('Ranking '+recs.length+' of '+tot+' records\u2026');
    }
    return {total:tot, records:recs};
  }

  /* How many records a query matches, and nothing else. `maximumRecords=0` is answered in
     70–100 ms once the connection is warm, which is the whole reason probing a dozen spelling
     candidates is affordable. The sort clause is stripped — there is nothing to sort. */
  async function countOnly(query,signal){
    const r=await sru(query.replace(/ sortBy .*$/,''), 1, signal, 0);
    return r.total;
  }

  /* Find the one word that is in no UCLA record and repair it. Three rungs, cheapest first,
     each producing *candidates* rather than answers: a candidate that matches records is not
     necessarily the right word. "srugged" is one deletion from "rugged", and "atlas rugged"
     really does match eight records about the deserts of California — taking the first hit
     answered the wrong question with total confidence. So every candidate that matches is
     scored against what was actually typed, the best one wins, and the search stops early only
     when a candidate is unambiguously right.

     Returns the repaired query text, '' if nothing convincing was found, or null if the
     search was superseded. */
  async function repairQuery(p,field,wide,signal,mine){
    const qw=norm(p.text).split(' ').filter(Boolean);
    if(qw.length<2 || qw.length>MAX_REPAIR_WORDS) return '';
    /* Only long words are candidates. A short broken word is cheap for the drop-a-word pass
       to recover from — "wtlas shrugged" drops "wtlas", finds the book on "shrugged" and
       stops — whereas repairing it would spend nine probes on variants that cannot be right,
       because a five-letter word's plausible repairs are mostly other short words. Long words
       are the opposite case: they are the distinctive half of the query, so losing one leaves
       nothing to search with, which is the whole reason this pass exists. */
    const dead=[];
    for(let i=0;i<qw.length;i++){
      if(qw[i].length<MIN_REPAIR_LEN) continue;
      setStatus('Nothing matches “'+esc(p.text)+'”. Checking “'+esc(qw[i])+'”…');
      const n=await countOnly(buildCQL(Object.assign({},p,{text:qw[i]}),field,wide,'best'),signal);
      if(mine!==seq) return null;
      if(!n) dead.push(i);
      if(dead.length>1) return '';       // two broken words at once is a different problem
    }
    if(dead.length!==1) return '';
    const bad=qw[dead[0]];

    let best=null, aborted=false;
    // Score one candidate word against the query as the reader typed it. A candidate that
    // matches nothing is worthless; a candidate that matches the wrong books is worse.
    async function consider(word){
      if(aborted || !word || word===bad) return false;
      const text=substituteWord(qw,dead[0],word);
      const pr=await sru(buildCQL(Object.assign({},p,{text}),field,wide,'best'),1,signal,PROBE);
      if(mine!==seq){ aborted=true; return false; }
      if(!pr.total) return false;
      const s=bestScore(pr.records,p.text,null);
      if(!best || s>best.s) best={text:text, word:word, s:s};
      return s>=GOOD_ENOUGH;              // unambiguous: stop looking
    }

    /* Rung 1 — enumerate the two typo classes with a small variant set: two letters the wrong
       way round, and one letter too many. Transpositions are generated first, so the commoner
       typo is found first. */
    const cands=wordRepairs(bad).slice(0,MAX_REPAIRS);
    for(let k=0;k<cands.length && !aborted;k++){
      setStatus('“'+esc(bad)+'” is in no UCLA record. Trying “'+esc(cands[k])+'”…');
      const n=await countOnly(buildCQL(Object.assign({},p,{text:substituteWord(qw,dead[0],cands[k])}),field,wide,'best'),signal);
      if(mine!==seq) return null;
      if(n && await consider(cands[k])) return best.text;
    }
    if(aborted) return null;

    /* Rung 2 — ask the catalogue for its own spelling. Search whatever survived alongside a
       truncated form of the broken word and read the real word out of the titles. This is the
       rung that catches a letter missing or mistyped *late* in the word, where the prefix is
       still intact. */
    const others=qw.filter((w,k)=>k!==dead[0]).join(' ');
    const ladder=prefixLadder(bad);
    for(let k=0;k<ladder.length && !aborted;k++){
      const probeText=(others?others+' ':'')+ladder[k]+'*';
      setStatus('Looking up how the catalog spells “'+esc(bad)+'”…');
      const pr=await sru(buildCQL(Object.assign({},p,{text:probeText}),field,wide,'best'),1,signal,HARVEST);
      if(mine!==seq) return null;
      if(!pr.total) continue;
      // Only words that actually begin with the prefix; the rest of each title is noise here.
      const all=harvestVocab(pr.records), pv=Object.create(null);
      for(const w in all) if(w.indexOf(ladder[k])===0) pv[w]=all[w];
      const near=nearestWord(bad,pv,repairBudget(bad));
      if(near && await consider(near.w)) return best.text;
    }
    if(aborted) return null;

    /* Rung 3 — the error is early in the word, where neither a shared prefix nor a deletion
       can reach it: "srugged" for "shrugged" shares only "s", and "atlas srug*" returns
       nothing. Enumerate every edit-1 variant and ask about them all at once, as a top-level
       OR. 26 clauses cost one 1.1 s request, so a seven-letter word's 383 variants are seven
       requests rather than 383. Any batch that matches is read for its vocabulary instead of
       bisected. */
    const spec=FIELD[field]||FIELD.keyword;
    const clauses=wordGuesses(bad).map(g=>clause(spec,substituteWord(qw,dead[0],g)));
    const batches=batchClauses(clauses,GUESS_URL).slice(0,MAX_GUESS_BATCHES);
    for(let k=0;k<batches.length && !aborted;k++){
      setStatus('Still nothing for “'+esc(bad)+'”. Asking the catalog about '+
                batches[k].length+' near-misses at once…');
      const pr=await sru(batches[k].join(' or '),1,signal,HARVEST);
      if(mine!==seq) return null;
      if(!pr.total) continue;
      const vocab=harvestVocab(pr.records);
      // Verify the closest few: "srugged" is one edit from "rugged" as well as "shrugged".
      for(let t=0;t<3 && !aborted;t++){
        const near=nearestWord(bad,vocab,repairBudget(bad));
        if(!near) break;
        delete vocab[near.w];
        if(await consider(near.w)) return best.text;
      }
    }
    if(aborted) return null;
    /* Nothing was unambiguous. Take the best candidate only if it actually looks like the
       query — otherwise say nothing and let the drop-a-word pass answer, which at least
       labels itself a guess. */
    return (best && best.s>=WEAK_GUESS) ? best.text : '';
  }

  /* Run a query down the scope chain and return the scope that actually answers it.
     Narrowest first, and the first scope with any records normally wins — but *any records*
     is not the same as *the right records*. "atlas shrugged" matches exactly one Biomed
     record, on a stray keyword rather than on the title, and taking that answers a question
     nobody asked. So when the best thing in scope does not resemble the query at all, one
     cheap page is spent on the widest scope and taken only if it is materially better.

     Both the as-typed pass and the recovered-spelling pass go through here. When only the
     first one did, a *corrected* query would narrow back down and settle for that same stray
     Biomed hit — the search repaired "atlas shurgged" to "atlas shrugged" perfectly and then
     showed one unrelated record. */
  async function bestScope(pq,field,chain,sortMode,scoreAgainst,signal,mine){
    let page=null, used=chain[0], why='';
    for(let i=0;i<chain.length;i++){
      setStatus('Searching '+esc(SCOPE(chain[i]).label)+'…');
      const q=buildCQL(pq,field,chain[i],sortMode);
      const r=await fetchPool(q,signal,mine);
      if(r===null) return null;
      used=chain[i]; page=r; lastQuery=q;
      if(r.total){ if(i>0) why='empty'; break; }
    }
    const wide=chain[chain.length-1];
    if(page && page.total && scoreAgainst && used!==wide){
      const here=bestScore(page.records,scoreAgainst,null);
      if(here<WEAK){
        setStatus('Nothing in '+esc(SCOPE(used).short)+' looks like “'+esc(scoreAgainst)+'”. Checking the rest of UCLA…');
        const pr=await sru(buildCQL(pq,field,wide,sortMode),1,signal,PROBE);
        if(mine!==seq) return null;
        if(pr.total && bestScore(pr.records,scoreAgainst,null)>=here+WIDEN_MARGIN){
          const q=buildCQL(pq,field,wide,sortMode);
          const full=await fetchPool(q,signal,mine);
          if(full===null) return null;
          if(full.total){ page=full; used=wide; why='weak'; lastQuery=q; }
        }
      }
    }
    return {page, used, why};
  }

  // The scope the pills currently describe: your library, a sub-shelf of it, or everywhere.
  const scopeNow=()=> scopeMode==='ucla' ? 'ucla' : (SUBSCOPE[scopeMode] ? scopeMode : library);
  const scopeChain=p=>{
    if(p.scope) return [p.scope];                     // an explicit at: is an instruction, not a hint
    const k=scopeNow();
    if(k==='ucla') return ['ucla'];
    return [k,'ucla'];                                // your library first, the rest only if empty
  };

  /* What this search cost the catalog, in the open. It is off by default because a patron
     has no use for it, and on with `?diag=1` because the first question anyone responsible
     for the endpoint will ask is "how many requests is this", and the honest answer should
     be a number they can read off the screen rather than one they have to take on trust. */
  const DIAG=/[?&]diag=1\b/.test(location.search);
  function diagLine(){
    if(!DIAG) return '';
    return '<span class="cat-diag">'+perf.reqs+' catalog request'+(perf.reqs===1?'':'s')+
           (perf.cached?' · '+perf.cached+' served from cache':'')+
           ' · '+perf.records+' records transferred'+
           ' · session '+perf.sessionReqs+' sent, '+perf.sessionCached+' cached</span>';
  }

  async function run(reset){
    const eq=effectiveQuery();
    const p=parseQuery(eq.full,library);
    showApplied(p,eq.extra);
    const hasQuery=!!(p.text||p.pos.length||p.neg.length);
    if(!hasQuery){
      loaded=[]; total=0; out.innerHTML=''; parsed=p;
      setStatus(p.errors.length?esc(p.errors.join(' ')):'Type a title, author or ISBN in the box at the top, or a filter such as <code>mesh:cardiology year:2015+</code>.',!!p.errors.length);
      return;
    }
    const mine=++seq;
    if(ctl) ctl.abort();
    ctl=new AbortController();
    const signal=ctl.signal;
    const sortMode=p.sort||(sortSel?sortSel.value:'best')||'best';
    /* Typing a bare ISBN switches the mode for you. It has to switch *back*: the mode used to
       stick, so the next title typed into the shared box was searched as an ISBN, stripped to
       no digits at all, and sent as an empty query — which the endpoint answers with
       "Invalid query". Only an automatic switch is ever undone; a mode the reader picked is
       left alone. */
    let autoMode=mode;
    const det=detectMode(p.text,mode);
    if(det){ autoMode=det; modeAuto=true; }
    else if(modeAuto && mode!=='kw'){ autoMode='kw'; modeAuto=false; }
    if(autoMode!==mode) setMode(autoMode,false);
    const field=MODE_FIELD[autoMode]||'keyword';

    /* A query that compiles to nothing must never be sent. `alma.isbn=""` is not a search for
       everything, it is a syntax error, and the reader would be told the catalog was
       unreachable when the truth is that "atlas shrugged" has no digits in it. */
    if(!buildCQL(p,field,scopeChain(p)[0],sortMode)){
      loaded=[]; total=0; out.innerHTML='';
      setStatus('\u201c'+esc(p.text||eq.typed)+'\u201d has nothing to search for as '+
                esc((FIELD[field]||FIELD.keyword).label)+'. Pick a different Search by field; Keyword is the loosest.',true);
      return;
    }

    /* The budget is per search, so a reader who searches all afternoon is never throttled;
       what is bounded is how much one question may cost. "Load more" continues the same
       question and shares the same allowance. */
    if(reset){ reqSpent=0; perf.reqs=0; perf.cached=0; perf.records=0; }
    let budgetHit=false;

    try{
      if(!reset){
        setStatus('Loading more\u2026');
        const more=await sru(lastQuery, loaded.length+1, signal);
        if(mine!==seq) return;
        total=more.total; loaded=loaded.concat(more.records);
      } else {
        loaded=[]; total=0; parsed=p; rankQuery=p.text||eq.typed; relaxedTo=''; relaxedBy=''; ctx=null; widenReason='';
        const chain=scopeChain(p);
        const wide=chain[chain.length-1];
        // Pass 1: the query exactly as typed.
        let res=await bestScope(p,field,chain,sortMode,p.text,signal,mine);
        if(res===null) return;
        let page=res.page; usedScope=res.used; widenReason=res.why;

        /* Nothing matched as typed anywhere. Two recovery passes, in this order, because the
           first is both cheaper and far more precise than the second. */
        if(page && !page.total && p.text && autoMode!=='isbn'){
          let recovered='', recoveredBy='';
          /* Recovery is best-effort. Running out of the request budget mid-ladder means the
             answer is "no match", which is what the page was already going to say; turning it
             into "could not reach the catalog" would blame the network for a spending limit. */
          try{

          /* Pass 2a: repair the broken word. See `wordRepairs` for why this exists — dropping
             a word is useless when the word that survives is "atlas". */
          const fixed=await repairQuery(p,field,wide,signal,mine);
          if(fixed===null) return;
          if(fixed){ recovered=fixed; recoveredBy='repair'; }

          /* Pass 2b: drop a word, and read the dropped word's real spelling out of whatever
             comes back. Two things happen per probe:

             The reduced query is scored, and the *best* one is kept — not the first that
             returns anything, which would let "harrisons principals of internal medicin"
             settle for a single unrelated record.

             And its records are harvested for vocabulary. This is what closes the two holes
             letter-guessing leaves. A substitution ("wtlas") is unreachable by enumeration but
             sits one edit from "atlas", which is in the title of every record the reduced
             query "shrugged" returns. A **real-word typo** ("principals" for "principles") is
             not detectable as a broken word at all — the liveness probe finds 2 800 records
             about principals — but drop it, search "harrisons of internal medicine", and
             "principles" is right there in the results, two edits away. Repairing the whole
             query beats shortening it, so a correction that matches anything wins outright. */
          if(!recovered){
            const alts=relaxations(p.text).slice(0,MAX_TRIES);
            const qwAll=norm(p.text).split(' ').filter(Boolean);
            let best=null, repaired='';
            for(let i=0;i<alts.length && !repaired;i++){
              setStatus('Nothing matches \u201c'+esc(p.text)+'\u201d. Trying \u201c'+esc(alts[i])+'\u201d\u2026');
              const probe=Object.assign({},p,{text:alts[i]});
              const pr=await sru(buildCQL(probe,field,wide,sortMode), 1, signal, PROBE);
              if(mine!==seq) return;
              if(!pr.total) continue;
              const s=bestScore(pr.records,p.text,null);
              if(!best || s>best.s) best={alt:alts[i], s};

              const vocab=harvestVocab(pr.records), gone=wordsMissing(qwAll,alts[i]);
              for(let g=0;g<gone.length && !repaired;g++){
                const near=nearestWord(gone[g],vocab,repairBudget(gone[g]));
                if(!near) continue;
                const text=substituteWord(qwAll,qwAll.indexOf(gone[g]),near.w);
                setStatus('\u201c'+esc(gone[g])+'\u201d looks like \u201c'+esc(near.w)+'\u201d. Checking\u2026');
                const n=await countOnly(buildCQL(Object.assign({},p,{text}),field,wide,'best'),signal);
                if(mine!==seq) return;
                if(n) repaired=text;
              }
              if(!repaired && s>=GOOD_ENOUGH) break;  // clearly the right book; stop spending requests
            }
            if(repaired){ recovered=repaired; recoveredBy='repair'; }
            else if(best){ recovered=best.alt; recoveredBy='drop'; }
          }

          if(recovered){
            relaxedTo=recovered; relaxedBy=recoveredBy;
            const relaxed=Object.assign({},p,{text:recovered});
            /* Narrow it back down: a misspelt title whose book *is* at Biomed should come
               back as a Biomed answer rather than an all-of-UCLA one. Scored against the
               corrected spelling, because that is now the question being asked. */
            const rr=await bestScope(relaxed,field,chain,sortMode,recovered,signal,mine);
            if(rr===null) return;
            if(rr.page){ page=rr.page; usedScope=rr.used; widenReason=rr.why; }
          }

          }catch(e){
            if(e.name==='AbortError') throw e;
            if(!e.budget) throw e;
            budgetHit=true;
          }
        }
        if(!page) return;
        total=page.total; loaded=page.records;
        /* The answer came from a library other than the one the reader is standing in, so
           "only my library" would now hide the whole answer. See `onlyMine`.

           Compared against the library rather than against the scope: `at:stacks` and
           `at:reference` are scopes *of* Biomed, so a Biomed reader who picks one has not
           gone anywhere, and suspending their filter would show them the whole of UCLA. */
        const usedLib=SUBSCOPE[usedScope]?SUBSCOPE[usedScope].lib:usedScope;
        widenedAway=(usedLib!==library);
      }
      if(mine!==seq) return;

      if(!total){
        out.innerHTML='<div class="cat-empty">No UCLA record matches <span class="k">'+esc(eq.full)+'</span>'+
          (p.text?', even after retrying with fewer words':'')+'. '+
          (p.notes.length?'Filters are active; clearing them widens the search. ':'')+
          'Check the spelling, or switch the search field above. Keyword is the loosest.</div>';
        setStatus('');
        return;
      }
      ctx=idfContext(loaded);
      draw();
      const shown=Math.min(loaded.length,total);
      const bits=[];
      /* A recovered search has to say what it actually searched for, and how sure it is.
         A repaired spelling is a near-certainty; a dropped word is a guess, and when its best
         hit does not even match a title it is a bad one — "atlas shurgged" used to present a
         shelf full of anatomy atlases in the same confident tone as a direct hit. */
      if(relaxedTo){
        if(relaxedBy==='repair')
          bits.push('\u201c'+esc(rankQuery)+'\u201d is in no UCLA record. Corrected to \u201c'+esc(relaxedTo)+'\u201d.');
        else if(bestScore(loaded,rankQuery,null)<WEAK_GUESS)
          bits.push('No match for \u201c'+esc(rankQuery)+'\u201d, and nothing close either. These are the records for \u201c'+esc(relaxedTo)+'\u201d and are probably not the book you meant.');
        else
          bits.push('No exact match for \u201c'+esc(rankQuery)+'\u201d. Closest matches are for \u201c'+esc(relaxedTo)+'\u201d.');
      }
      if(widenReason==='empty') bits.push('Nothing in '+esc(SCOPE(scopeNow()).short)+'. Widened to '+esc(SCOPE(usedScope).label)+'.');
      if(widenReason==='weak')  bits.push('Nothing in '+esc(SCOPE(scopeNow()).short)+' matched the title. Widened to '+esc(SCOPE(usedScope).label)+'.');
      bits.push(total+' record'+(total===1?'':'s')+' in '+esc(SCOPE(usedScope).label)+
                (shown<total?' \u00b7 newest '+shown+' ranked':''));
      if(widenedAway && biomedOnly.checked)
        bits.push('Showing copies at other libraries; “only my library” would hide every one of them.');
      if(budgetHit) bits.push('Stopped looking for a better spelling after '+REQ_BUDGET+' catalog requests.');
      setStatus(bits.join(' ')+diagLine());
    }catch(e){
      if(e.name==='AbortError') return;
      if(mine!==seq) return;
      out.innerHTML='';
      setStatus('Could not reach the catalog: '+esc(e.message||'network error')+'. Check the connection and search again.',true);
    }
  }

  function setMode(m,rerun){
    mode=m;
    if(rerun) modeAuto=false;          // a deliberate choice is not undone later
    root.querySelectorAll('.cat-modes .pill').forEach(o=>{
      const on=o.dataset.mode===m; o.classList.toggle('active',on); o.setAttribute('aria-pressed',String(on));
    });
    // The field is shared with the call-number lookup, so the hint has to stay true for both.
    input.placeholder = m==='isbn'   ? '9780071802154'
                      : m==='author' ? 'longo, dan l.'
                      : m==='title'  ? "harrison's principles of internal medicine"
                      : 'call number, book title, author, ISBN\u2026';
    if(rerun && input.value.trim()) run(true);
  }
  function setScopeMode(m,rerun){
    scopeMode=m;
    root.querySelectorAll('.cat-scope .pill').forEach(o=>{
      const on=o.dataset.scope===m; o.classList.toggle('active',on); o.setAttribute('aria-pressed',String(on));
    });
    if(rerun && input.value.trim()) run(true);
  }
  /* Setting the library is the one piece of state worth remembering between visits: you work
     where you work. The walkable-stacks pill only exists for Biomed, because Biomed is the
     only library with a shelf map, and offering it elsewhere would promise an aisle that
     cannot be computed. */
  function setLibrary(k,rerun){
    if(!LIBRARY[k]||k==='ucla') k='biomed';
    library=k;
    setHereLib(LIBRARY[k].code);
    if(libSel && libSel.value!==k) libSel.value=k;
    try{ localStorage.setItem('cat.library',k); }catch(e){}
    const stacksPill=root.querySelector('.cat-scope .pill[data-scope="stacks"]');
    if(stacksPill){
      const ok=!!LIBRARY[k].mapped;
      stacksPill.hidden=!ok;
      if(!ok && scopeMode==='stacks') scopeMode='here';
    }
    const herePill=root.querySelector('.cat-scope .pill[data-scope="here"]');
    if(herePill) herePill.textContent=LIBRARY[k].short;
    const note=$('catLibNote');
    if(note){
      note.hidden=!!LIBRARY[k].mapped;
      note.textContent=LIBRARY[k].mapped ? ''
        : LIBRARY[k].name+' has no per-shelf map in this app. Results are scoped and ranked for it, '+
          'and each copy shows its call number, but only Biomed resolves to an actual aisle.';
    }
    setScopeMode(scopeMode,false);
    if(rerun && input.value.trim()) run(true);
  }

  head.addEventListener('click',()=>{
    const open=body.hidden;
    body.hidden=!open;
    toggle.setAttribute('aria-expanded',String(open));
    toggle.querySelector('.tgl').textContent=open?'Close':'Open';
    if(open) input.focus();
  });
  root.querySelectorAll('.cat-modes .pill').forEach(p=>{
    p.addEventListener('click',e=>{ e.stopPropagation(); setMode(p.dataset.mode,true); });
  });
  root.querySelectorAll('.cat-scope .pill').forEach(p=>{
    p.addEventListener('click',e=>{ e.stopPropagation(); setScopeMode(p.dataset.scope,true); });
  });
  if(libSel) libSel.addEventListener('change',e=>{ e.stopPropagation(); setLibrary(libSel.value,true); });
  /* Driven from the page's single search field. `catalogSearch` opens the panel if it is
     shut — a result nobody can see is not a result — and scrolls to it only when the reader
     is not already looking at it. */
  window.catalogSearch=function(){
    if(body.hidden) head.click();
    run(true);
    const r=root.getBoundingClientRect();
    if(r.top<0 || r.top>window.innerHeight*0.6) root.scrollIntoView({behavior:'smooth',block:'start'});
  };
  window.catalogClear=function(){
    loaded=[]; total=0; parsed=null; ctx=null; out.innerHTML='';
    if(filtForm) filtForm.querySelectorAll('input,select').forEach(el=>{ if(el.type==='checkbox') el.checked=false; else el.value=''; });
    if(applied){ applied.innerHTML=''; applied.hidden=true; }
    setStatus('');
  };
  biomedOnly.addEventListener('change',draw);
  covers.addEventListener('change',draw);
  if(groupEd) groupEd.addEventListener('change',draw);
  if(sortSel) sortSel.addEventListener('change',()=>{
    // Title and author order are server-side sorts, so changing to them has to re-ask;
    // the rest are pure reorderings of what is already here.
    const v=sortSel.value;
    if((v==='title'||v==='author'||v==='oldest') && loaded.length) run(true); else draw();
  });
  if(filtForm) filtForm.addEventListener('change',()=>{ if(input.value.trim()||panelTokens().length) run(true); });
  root.querySelectorAll('.cat-example').forEach(b=>{
    b.addEventListener('click',e=>{ e.stopPropagation(); input.value=b.dataset.q||b.textContent; run(true); });
  });
  out.addEventListener('click',e=>{
    const more=e.target.closest('#catMore');
    if(more){ run(false); return; }
    const btn=e.target.closest('.found');
    if(btn && window.routeShow) window.routeShow(+btn.dataset.lvl, btn.dataset.id);
  });
  let saved='biomed';
  try{ saved=localStorage.getItem('cat.library')||'biomed'; }catch(e){}
  setLibrary(saved,false);
})();

/* ===== article access, via Alma's OpenURL resolver =====
   The shelf map answers "where is the print copy". This answers the other half — is there
   electronic access, through whom, and for which years — which the app previously had no
   answer for at all.

   `/view/uresolver/<INST>/openurl` is keyless and sends `Access-Control-Allow-Origin: *`, so
   this costs no server and no credential, exactly like the SRU search. Probed 2026-08-06. */
(function(){
  const $=id=>document.getElementById(id);
  const root=$('art'); if(!root) return;
  const head=$('artHead'), body=$('artBody'), toggle=$('artToggle'),
        input=$('artQ'), go=$('artGo'), statusEl=$('artStatus'), out=$('artOut');
  const RESOLVER='https://ucla.alma.exlibrisgroup.com/view/uresolver/01UCS_LAL/openurl';
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let seq=0, ctl=null;

  function setStatus(msg,err){ statusEl.innerHTML=msg||''; statusEl.classList.toggle('err',!!err); }

  /* What the reader pasted decides which OpenURL key it becomes. A DOI and a PMID both
     identify one article; an ISSN or a title identifies the journal, and the resolver answers
     the coverage question for the whole run. Getting this wrong sends an empty context object,
     which the resolver answers with no services and which reads as "no access". */
  function identify(raw){
    const s=(raw||'').trim();
    if(!s) return null;
    let m=s.match(/\b(10\.\d{4,9}\/[^\s"'<>]+)/i);          // DOI, bare or inside a URL
    if(m) return {kind:'doi', label:'DOI', value:m[1].replace(/[.,;]+$/,''), key:'rft_id', prefix:'info:doi/'};
    m=s.match(/^(?:pmid[:\s]*)?(\d{7,8})$/i);
    if(m) return {kind:'pmid', label:'PubMed ID', value:m[1], key:'rft_id', prefix:'info:pmid/'};
    m=s.match(/\b(\d{4})[-–\s]?(\d{3}[\dxX])\b/);
    if(m) return {kind:'issn', label:'ISSN', value:m[1]+'-'+m[2].toUpperCase(), key:'rft.issn'};
    return {kind:'title', label:'journal title', value:s, key:'rft.jtitle'};
  }

  function buildURL(id){
    const p=new URLSearchParams({'url_ver':'Z39.88-2004', 'svc_dat':'CTO', 'svc.fulltext':'yes'});
    p.set(id.key, (id.prefix||'')+id.value);
    if(id.kind==='doi'||id.kind==='pmid') p.set('rft.genre','article');
    else p.set('rft.genre','journal');
    return RESOLVER+'?'+p.toString();
  }

  // The resolver answers in its own namespace; read <key id="..."> pairs per context_service.
  function parseServices(xml){
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.getElementsByTagName('parsererror').length) throw new Error('the resolver sent a response we could not read');
    const all=doc.getElementsByTagName('*'), svcs=[];
    for(let i=0;i<all.length;i++){
      const el=all[i];
      if(el.localName!=='context_service') continue;
      const type=el.getAttribute('service_type')||'';
      const keys={}, kk=el.getElementsByTagName('*');
      for(let j=0;j<kk.length;j++){
        if(kk[j].localName!=='key') continue;
        const id=kk[j].getAttribute('id');
        if(id && keys[id]===undefined) keys[id]=(kk[j].textContent||'').trim();
      }
      svcs.push({type, keys});
    }
    // resolution_url sits alongside, one per service, in document order.
    const urls=[];
    for(let i=0;i<all.length;i++) if(all[i].localName==='resolution_url') urls.push((all[i].textContent||'').trim());
    svcs.forEach((s,i)=>{ s.url=s.keys['Authentication']||urls[i]||''; });
    return svcs;
  }

  // "Available from 01/01/1990 volume: 322 issue: 1.<br>" — the resolver embeds markup in a
  // field that is otherwise plain text, so it is stripped rather than rendered.
  const clean=s=>String(s||'').replace(/<br\s*\/?>/gi,' ').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();

  function render(svcs,id){
    const full=svcs.filter(s=>s.type==='getFullTxt');
    if(!full.length){
      out.innerHTML='<div class="cat-empty">No electronic full text at UCLA for this '+esc(id.label)+
        '. It may still be held in print; search the catalog above by title. '+
        'Interlibrary loan can usually get an article UCLA does not license.</div>';
      return 0;
    }
    out.innerHTML=full.map(s=>{
      const k=s.keys;
      const name=k['package_public_name']||k['package_display_name']||k['package_name']||'Unnamed package';
      const iface=k['interface_name']||'';
      const cov=clean(k['Availability']);
      const free=k['Is_free']==='1';
      const mat=(k['electronic_material_type']||'').toLowerCase();
      let h='<div class="prov"><div class="prov-h"><span class="prov-n">'+esc(name)+'</span>';
      if(iface && iface!==name) h+='<span class="prov-i">via '+esc(iface)+'</span>';
      if(free) h+='<span class="chip free">Free to read</span>';
      if(mat && mat!=='journal') h+='<span class="chip">'+esc(mat)+'</span>';
      h+='</div>';
      if(cov) h+='<div class="prov-c">'+esc(cov)+'</div>';
      if(s.url) h+='<a class="go" href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">Open at '+esc(iface||name)+'</a>';
      return h+'</div>';
    }).join('');
    return full.length;
  }

  /* The resolver does not answer on `rft.jtitle`, and there is no cheap way to ask SRU for
     "the serial whose title *is* Nature": `alma.title="Nature"` matches 292 records, none of
     them the journal, because the phrase relation is not anchored and the only sort available
     is alphabetical. Guessing from that list produced "JAMA" -> Archives of Dermatology.

     So a title is not resolved here at all. It is handed to the catalog search, which does
     rank titles properly, and the reader comes back with an identifier. */
  async function look(){
    let id=identify(input.value);
    if(!id){
      out.innerHTML=''; setStatus('Paste a DOI, a PubMed ID or an ISSN.');
      return;
    }
    const mine=++seq;
    if(ctl) ctl.abort();
    ctl=new AbortController();
    go.disabled=true;
    setStatus('Asking the resolver about this '+esc(id.label)+'…');
    out.innerHTML='<div class="prov"><div class="skel" style="width:60%"></div>'+
                  '<div class="skel" style="width:35%; margin-top:8px"></div></div>';
    let via='';
    try{
      if(id.kind==='title'){
        out.innerHTML='<div class="cat-empty">The link resolver needs an identifier, not a title. '+
          'Search the catalog for &ldquo;'+esc(id.value)+'&rdquo; to find the journal, then paste its ISSN or '+
          'a DOI here.<br><button class="cat-example" type="button" id="artToCat">Search the catalog for this</button></div>';
        const btn=document.getElementById('artToCat');
        if(btn) btn.addEventListener('click',()=>{
          const box=document.getElementById('q');
          if(box){ box.value=id.value; if(window.catalogSearch) window.catalogSearch(); }
        });
        setStatus('');
        go.disabled=false;
        return;
      }
      const res=await fetch(buildURL(id),{signal:ctl.signal});
      if(!res.ok) throw new Error('the resolver returned HTTP '+res.status);
      const svcs=parseServices(await res.text());
      if(mine!==seq) return;
      const n=render(svcs,id);
      setStatus(n ? n+' provider'+(n===1?'':'s')+' for this '+esc(id.label)+' · '+esc(id.value)+esc(via)
                  : 'Read as a '+esc(id.label)+': '+esc(id.value)+esc(via));
    }catch(e){
      if(e.name==='AbortError') return;
      if(mine!==seq) return;
      out.innerHTML='';
      setStatus('Could not reach the link resolver: '+esc(e.message||'network error')+'. Try again.',true);
    }finally{
      if(mine===seq) go.disabled=false;
    }
  }

  head.addEventListener('click',()=>{
    const open=body.hidden;
    body.hidden=!open;
    toggle.setAttribute('aria-expanded',String(open));
    toggle.querySelector('.tgl').textContent=open?'Close':'Open';
    if(open) input.focus();
  });
  /* Driven from the page's single search field, the same way `catalogSearch` is: open the
     panel if it is shut, because a result nobody can see is not a result, and scroll to it
     only when the reader is not already looking at it. */
  window.articleLookup=function(text){
    if(text!==undefined) input.value=text;
    if(body.hidden) head.click();
    look();
    const r=root.getBoundingClientRect();
    if(r.top<0 || r.top>window.innerHeight*0.6) root.scrollIntoView({behavior:'smooth',block:'start'});
  };
  go.addEventListener('click',e=>{ e.stopPropagation(); look(); });
  input.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); look(); } });
  root.querySelectorAll('.art-ex .cat-example').forEach(b=>{
    b.addEventListener('click',e=>{ e.stopPropagation(); input.value=b.dataset.q||''; look(); });
  });
})();

/* ===== hours, from LibCal =====
   `api_hours_today.php` is keyless, CORS-open and carries no personal data at all. Departments
   nest under their library by `parent_lid`, which is the only structure in the payload and the
   only thing that makes it readable. Probed 2026-08-06. */
(function(){
  const $=id=>document.getElementById(id);
  const root=$('hrs'); if(!root) return;
  const head=$('hrsHead'), body=$('hrsBody'), toggle=$('hrsToggle'),
        summary=$('hrsSummary'), statusEl=$('hrsStatus'), out=$('hrsOut');
  const HOURS='https://api2.libcal.com/api_hours_today.php?iid=3244&lid=0&format=json';
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let loaded=false, loading=false;

  /* Status is a dot *and* a word. `currently_open` is the field to trust: `status` says
     "open" for a location that opens later today, which at 7am is the opposite of the truth. */
  function statusOf(loc){
    const t=loc.times||{}, s=(t.status||'').toLowerCase();
    if(s==='24hours') return {cls:'open', word:'Open 24 hours'};
    if(s==='byapp')   return {cls:'', word:'By appointment'};
    if(t.currently_open===true)  return {cls:'open', word:'Open now'};
    if(s==='closed' || t.currently_open===false) return {cls:'shut', word:'Closed'};
    return {cls:'', word:esc(t.status||'unknown')};
  }

  /* LibCal returns `not-set` for locations whose hours nobody has filled in. Rendering those
     as "unknown" pads the list with rows that answer nothing, so they are dropped and the
     counts are computed over what is left. */
  const known=l=>((l.times||{}).status||'').toLowerCase()!=='not-set';

  function row(loc,sub){
    const s=statusOf(loc), when=esc(loc.rendered||(loc.times&&loc.times.status)||'');
    return '<div class="hr-row">'+
      '<span class="hr-n">'+esc(loc.name||'Unnamed location')+'</span>'+
      (when?'<span class="hr-t">'+when+'</span>':'')+
      '<span class="hr-s '+s.cls+'"><i></i>'+s.word+'</span></div>';
  }

  function render(all){
    const locs=all.filter(known);
    const parents=locs.filter(l=>!l.parent_lid);
    const kids={};
    locs.forEach(l=>{ if(l.parent_lid) (kids[l.parent_lid]=kids[l.parent_lid]||[]).push(l); });
    const openNow=locs.filter(l=>{
      const t=l.times||{};
      return t.currently_open===true || (t.status||'').toLowerCase()==='24hours';
    }).length;
    summary.textContent=openNow?openNow+' of '+locs.length+' locations open now':'all locations closed';
    if(!parents.length){
      out.innerHTML='<div class="cat-empty">LibCal returned no locations. Try again later, or check calendar.library.ucla.edu.</div>';
      return;
    }
    out.innerHTML=parents.map(p=>{
      let h='<div class="hr-lib">'+row(p);
      const sub=kids[p.lid]||[];
      if(sub.length) h+='<div class="hr-sub">'+sub.map(k=>row(k,true)).join('')+'</div>';
      return h+'</div>';
    }).join('');
  }

  async function load(){
    if(loading) return;
    loading=true;
    setTimeout(()=>{ if(loading) statusEl.textContent='Asking LibCal…'; },300);
    out.innerHTML='<div class="hr-lib"><div class="skel" style="width:45%"></div></div>'+
                  '<div class="hr-lib"><div class="skel" style="width:55%"></div></div>'+
                  '<div class="hr-lib"><div class="skel" style="width:40%"></div></div>';
    try{
      const res=await fetch(HOURS);
      if(!res.ok) throw new Error('LibCal returned HTTP '+res.status);
      const data=await res.json();
      render(data.locations||[]);
      statusEl.textContent='';
      loaded=true;
    }catch(e){
      out.innerHTML='';
      summary.textContent='hours unavailable';
      statusEl.innerHTML='Could not reach LibCal: '+esc(e.message||'network error')+'.';
      statusEl.classList.add('err');
    }finally{ loading=false; }
  }

  head.addEventListener('click',()=>{
    const open=body.hidden;
    body.hidden=!open;
    toggle.setAttribute('aria-expanded',String(open));
    toggle.querySelector('.tgl').textContent=open?'Close':'Open';
    if(open && !loaded) load();
  });
  /* The summary rides on the collapsed header, so it is fetched once on load rather than on
     open: "is anything open" is the question most of the time, and it should not need a click.
     One request, and the panel reuses the same render when opened. */
  load();
})();
</script>
</body>
</html>
"""

html = HTML.replace('__DATA__', DATA_JS)
with open(INDEX_PATH, 'w', encoding='utf-8') as f:  # CF Pages serves index.html at /
    f.write(html)

print(f'wrote {INDEX_PATH}: {len(html)} chars (CF Pages entry point)')
print(f'embedded {len(d)} keys across {len({k.split("|")[0] for k in d})} floors')
