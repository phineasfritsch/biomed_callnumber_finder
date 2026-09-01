// The site in a real browser, driven the way a person drives it.
//
//   node Tools/ui.test.js                 every journey, headless, against a local server
//   node Tools/ui.test.js --shot          the same, writing screenshots to ops/shots/
//   node Tools/ui.test.js --only catalog  journeys whose name contains "catalog"
//   node Tools/ui.test.js --origin https://shelfmark.phineasfritsch.com   against production
//
// Every other suite in this repo reads the shipped files as text. That catches a great deal and
// it cannot catch the class of failure that matters most at a desk: the page loads, the markup is
// present, every assertion passes, and clicking the button does nothing. A comparator can be
// perfect while the form that feeds it is wired to the wrong element.
//
// So this one opens Chromium, types into the real input, presses the real button, and reads what
// a person would read. Journeys are written from the three people this tool is for — the desk
// worker with someone waiting, the librarian who knows the collection, and the patron who does
// not want to be handled by software.
//
// WHAT IS REAL AND WHAT IS A STUB, stated plainly, because a harness that blurs this teaches you
// to trust the wrong thing:
//
//   real    every page, every stylesheet, the comparator, the dataset, the routing (the local
//           server serves exactly the published set, computed from .assetsignore), all rendering,
//           all keyboard behaviour, all layout.
//   stub    the four network dependencies. Alma SRU is served from fixtures/, which are SAVED
//           LIVE RESPONSES, so the catalog path is exercised against bytes UCLA really sent.
//           LibCal, /api/*, and the cover art are synthesised here and are the weakest part of
//           this file — they prove the page handles a shape, not that the shape is current.
//
// THREE MODES, and which one you can run depends on where you are:
//
//   (default)   the files in this working tree, served locally, upstreams stubbed.
//   --deployed  the files CURRENTLY PUBLISHED, fetched with curl and served locally, upstreams
//               stubbed. This drives the real deployed artefact in a real browser, which matters
//               whenever the deployment and the tree disagree; run ops/parity to find out whether
//               they do. What it does not cover is anything that depends on the real hostname:
//               the worker's /api routes, edge caching, redirects, headers.
//   --origin U  the identical journeys straight at a real deployment, no stubs and no local
//               server. This is the only mode that can tell you production works, and it is the
//               one to run after every deploy.
//
// --origin does not work from inside this container, and the reason is worth writing down because
// it looks exactly like the site being down. Chromium does not read HTTPS_PROXY, so it is launched
// with the proxy explicitly. Even then its TLS handshake to some hosts dies in the tunnel with
// ERR_CONNECTION_RESET while curl reaches the same URL and gets a 200. Chromium also needs the
// proxy CA in the NSS store, which is not there by default:
//
//     apt-get update && apt-get install -y libnss3-tools
//     certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n ccr-agent-proxy-ca -i /root/.ccr/agent-proxy-ca.crt
//
// That fixes ERR_CERT_AUTHORITY_INVALID and is enough for some hosts. Never pass
// --ignore-certificate-errors instead: a browser that trusts everything is not testing TLS at all.
// --deployed exists because of this, and it is the honest substitute rather than the equal one.

'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const SHOT = argv.includes('--shot');
const ORIGIN = (() => { const i = argv.indexOf('--origin'); return i >= 0 ? argv[i + 1] : null; })();
const DEPLOYED = argv.includes('--deployed');
const DEPLOYED_FROM = (process.env.SHELFMARK_ORIGIN || 'https://shelfmark.phineasfritsch.com').replace(/\/$/, '');
const ONLY = (() => { const i = argv.indexOf('--only'); return i >= 0 ? argv[i + 1] : null; })();
const SHOTDIR = path.join(ROOT, 'ops', 'shots');

let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIPPED — playwright is not installed in this working tree.');
  console.log('  This suite drives the real pages in a real browser, which is the only check here');
  console.log('  that can catch a button wired to nothing. Install it and re-run:');
  console.log('    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install');
  console.log('  Chromium itself is already at PLAYWRIGHT_BROWSERS_PATH; only the driver is missing.');
  process.exit(2);
}

/* ---------- the local server: exactly what Cloudflare publishes, and nothing else ---------- */

const ignorePatterns = fs.readFileSync(path.join(ROOT, '.assetsignore'), 'utf8')
  .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
function ignored(rel) {
  return ignorePatterns.some(p => {
    if (p.endsWith('/')) return rel === p.slice(0, -1) || rel.startsWith(p);
    if (p.startsWith('*.')) return rel.endsWith(p.slice(1));
    return rel === p || rel.startsWith(p + '/');
  });
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8' };

function startServer(docRoot) {
  const RT = docRoot || ROOT;
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const send = (code, body, type) => { res.writeHead(code, { 'content-type': type || 'text/html; charset=utf-8' }); res.end(body); };
    const notFound = () => send(404, fs.readFileSync(path.join(RT, '404.html')));
    /* The published set is the whole document root. A path .assetsignore excludes must 404 here
       exactly as it does on the web, or this harness would happily serve /README.md and prove
       nothing about the deployment. */
    for (const candidate of [rel, rel + '.html', rel === '' ? 'index.html' : null]) {
      if (!candidate || ignored(candidate)) continue;
      const abs = path.join(RT, candidate);
      if (!abs.startsWith(RT)) return notFound();
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
        return send(200, fs.readFileSync(abs), TYPES[path.extname(abs)] || 'application/octet-stream');
      }
    }
    return notFound();
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

/* ---------- stubs for the four things that leave the browser ---------- */

const FIX = f => fs.readFileSync(path.join(ROOT, 'fixtures', f), 'utf8');
function sruResponse(url) {
  const q = decodeURIComponent(url).toLowerCase();
  if (/maximumrecords=0/.test(q)) {
    /* Count-only probes: the typo repair asks "does this word appear in any UCLA record". A
       plausible non-zero count for real words, zero for the invented ones, so the repair path
       actually branches instead of always taking one side. */
    const n = /shurgged|wtlas|principals|zzzq/.test(q) ? 0 : 4217;
    return `<?xml version="1.0"?><searchRetrieveResponse xmlns="http://www.loc.gov/zing/srw/"><version>1.2</version><numberOfRecords>${n}</numberOfRecords><records/></searchRetrieveResponse>`;
  }
  if (/harrison/.test(q)) return FIX('harrisons.xml');
  if (/ultrasound/.test(q)) return FIX('focused-ultrasound.xml');
  if (/explain/.test(q)) return FIX('explain.xml');
  return '<?xml version="1.0"?><searchRetrieveResponse xmlns="http://www.loc.gov/zing/srw/"><version>1.2</version><numberOfRecords>0</numberOfRecords><records/></searchRetrieveResponse>';
}
const LIBCAL_WEEK = (() => {
  /* A Sunday-anchored week with two open locations and one closed: enough shape for the page to
     summarise, list, and render a day.
     The dates are computed from the current week rather than hard-coded, and the first version of
     this did hard-code them, as `30 + i` on a fixed August Sunday. That produced "Tue 32" and
     "Wed 33" and the page rendered them without complaint, because a day number is somebody
     else's field and the page is not in the business of second-guessing LibCal's calendar.
     A frozen week is worse than a computed one here for a second reason: the page marks TODAY by
     matching a date, so a fixture that does not contain today renders a week with no today in it,
     which is not the state any reader ever sees. */
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const now = new Date();
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const iso = i => {
    const d = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const mk = (name, open) => ({ lid: name.length, name, weeks: [Object.fromEntries(days.map((d, i) => [d, {
    date: iso(i),
    times: open ? { status: 'open', currently_open: true, hours: [{ from: '8am', to: '10pm' }] } : { status: 'closed', currently_open: false },
  }]))] });
  return { locations: [mk('Biomedical Library', true), mk('Powell Library', true), mk('Law Library', false)] };
})();
const DB_LIST = { count: 3, licensed: 2, items: [
  { name: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/', auth: false, best: true },
  { name: 'Embase', url: 'https://www.embase.com/', auth: true, best: true },
  { name: 'Web of Science', url: 'https://www.webofscience.com/', auth: true, best: false },
] };
/* Shaped from src/worker.js's own slim() output, field for field. The first version of this
   invented {count, items:[{creator, isPeerReviewed, id}]} while the worker returns
   {total, docs:[{title, authors, jtitle, ..., access, oa, link}]} and the page reads the latter.
   A stub that does not match the contract is worse than no stub: it makes the panel look
   exercised while nothing on either side of the wire has been checked against the other.
   Tools/worker.test.js proves the worker emits this shape; this proves the page can read it. */
const ARTICLES = { total: 2, docs: [
  { title: 'Asthma in adults', authors: ['Smith J'], jtitle: 'The Lancet', volume: '403', issue: '10422',
    pages: '112-120', date: '2024', doi: '10.1000/x', issn: '0140-6736', type: 'article',
    source: 'The Lancet', access: 'subscription', oa: false, link: 'https://example.invalid/a1' },
  { title: 'Childhood asthma review', authors: ['Doe A'], jtitle: 'BMJ', date: '2023',
    doi: '10.1000/y', issn: '0959-8138', type: 'article', source: 'BMJ',
    access: 'free', oa: true, link: 'https://example.invalid/a2' },
] };

async function installStubs(context, seen) {
  await context.route('**/*', route => {
    const url = route.request().url();
    const host = (() => { try { return new URL(url).host; } catch { return ''; } })();
    if (host.startsWith('127.0.0.1') || host.startsWith('localhost')) return route.continue();
    seen.add(host);
    if (/alma\.exlibrisgroup\.com/.test(url) && /\/sru\//.test(url))
      return route.fulfill({ status: 200, contentType: 'application/xml', body: sruResponse(url) });
    if (/api2\.libcal\.com/.test(url))
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LIBCAL_WEEK) });
    if (/covers\.openlibrary\.org/.test(url))
      return route.fulfill({ status: 404, body: '' });          // the "no cover" branch, on purpose
    if (/fonts\.(googleapis|gstatic)\.com/.test(url))
      return route.fulfill({ status: 200, contentType: /css2/.test(url) ? 'text/css' : 'font/woff2', body: '' });
    if (/cdn\.jsdelivr\.net/.test(url))
      return route.abort();                                     // OCR is not on any journey here
    return route.abort();
  });
  /* /api/* is same-origin, so it is served by the local server, which does not implement it.
     These three routes stand in for the worker; Tools/worker.test.js is what tests the worker. */
  await context.route('**/api/databases', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DB_LIST) }));
  await context.route('**/api/articles**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ARTICLES) }));
  await context.route('**/api/suggest**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ q: 'asthmaa', suggest: 'asthma' }) }));
}

/* ---------- the harness ---------- */

let pass = 0;
const failures = [];
let current = '';
function ok(label, cond, detail) {
  if (cond) { pass++; return true; }
  failures.push(`${current} › ${label}${detail ? `\n      ${detail}` : ''}`);
  return false;
}
const journeys = [];
const journey = (name, persona, fn) => journeys.push({ name, persona, fn });

const CN_HIT = 'W1 AM4990';        // inside 7|top-9|left, W1 AM4986 -> W1 AM511
const CN_NLM = 'WA 900.1 M300';    // inside 10|bot-10|left
const CN_MISS = 'ZZ 999 Q999';     // in no mapped range on any level

/* Waits for the page to have actually answered, rather than for a fixed number of milliseconds.
   A sleep here would pass on a fast machine and fail on a loaded one, which is the shape of a
   test everybody learns to re-run instead of read.
   AND CHECKS THE ANSWER IS ON THE SCREEN. The first version of this read textContent and stopped
   there, which returns text for hidden nodes: appending
       .result,.cat-results,.hr-row,.db-row{display:none}
   to site.css passed all 52 of these assertions. Every answer was computed, inserted into the
   DOM, and invisible, and the suite written specifically to catch "the page loads and the button
   does nothing" could not see "the page loads and the reader gets an empty box". That is the
   rule in OPERATIONS.md about never weakening an assertion into one that would pass on an empty
   artefact, broken by the file that enforces it.
   Height rather than a CSS property lookup, because there are many ways to end up invisible
   (display, visibility, opacity, zero height, clipped) and only one way to occupy space. */
const settled = async (page, sel, ms = 15000) => {
  await page.waitForFunction(
    s => { const el = document.querySelector(s); return el && el.textContent.trim().length > 0; },
    sel, { timeout: ms },
  ).catch(() => {});
  const text = (await page.textContent(sel).catch(() => '')) || '';
  if (text.trim()) {
    const seen = await page.evaluate(s => {
      const el = document.querySelector(s);
      if (!el) return { box: 0, vis: 'no element' };
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      return { box: r.height * r.width, vis: cs.visibility, display: cs.display, opacity: cs.opacity };
    }, sel);
    ok(`${sel} is actually on the screen, not just in the DOM`,
      seen.box > 0 && seen.vis !== 'hidden' && seen.display !== 'none' && Number(seen.opacity) > 0,
      `${sel} holds ${text.trim().length} characters the reader cannot see: ` +
      `box=${seen.box}px2 display=${seen.display} visibility=${seen.vis} opacity=${seen.opacity}`);
  }
  return text;
};

journey('locate · a call number becomes a shelf', 'desk worker', async (page, base) => {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  ok('the one search box is there and is focusable', await page.locator('#q').count() === 1);
  await page.fill('#q', CN_HIT);
  await page.press('#q', 'Enter');
  const txt = await settled(page, '#result');
  ok('it answers at all', txt.length > 0, 'the result region stayed empty');
  ok('the answer names a level', /level\s*7|\b7\b/i.test(txt), txt.slice(0, 240));
  ok('the answer names a side or a face', /left|right|single|top|bot/i.test(txt), txt.slice(0, 240));
  ok('the answer shows the range it landed in', /AM4986|AM511/i.test(txt), txt.slice(0, 240));
  ok('it does not claim more than one shelf for a plain hit', !/no shelf|not mapped/i.test(txt), txt.slice(0, 200));
});

journey('locate · the NLM scheme works too', 'desk worker', async (page, base) => {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.fill('#q', CN_NLM);
  await page.press('#q', 'Enter');
  const txt = await settled(page, '#result');
  ok('a WA-class number resolves', /level\s*10|\b10\b/.test(txt), txt.slice(0, 240));
});

journey('locate · an unmapped number is refused, not guessed', 'librarian', async (page, base) => {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.fill('#q', CN_MISS);
  await page.press('#q', 'Enter');
  const txt = await settled(page, '#result');
  ok('it says it does not know', /not (in|mapped)|no shelf|outside|could not|nothing/i.test(txt), txt.slice(0, 300));
  ok('and it does NOT name a shelf face anyway', !/aisle \d+·\d+/.test(txt), txt.slice(0, 300));
});

journey('locate · the box says where it sent the query', 'patron who dislikes AI', async (page, base) => {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.fill('#q', CN_HIT);
  await page.press('#q', 'Enter');
  await settled(page, '#result');
  const body = await page.textContent('body');
  /* The one box guesses where a query belongs. The README's claim is that the guess is stated
     and reversible — a silent guess is the behaviour this persona will not forgive. */
  ok('the routing decision is stated on the page', /call number|catalog|shelf map|searching/i.test(body));
});

journey('catalog · a title search finds the book', 'patron', async (page, base) => {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.fill('#q', 'harrisons principles of internal medicine');
  await page.press('#q', 'Enter');
  const status = await settled(page, '#catStatus', 25000);
  const results = await settled(page, '#catResults', 25000);
  const seen = status + '\n' + results;
  ok('the catalog answers', seen.trim().length > 0, 'both #catStatus and #catResults were empty');
  ok('Harrison\'s is in the answer', /harrison/i.test(seen), seen.slice(0, 300));
  ok('the status line names the scope the answer came from', /biomed|ucla|librar/i.test(status), status.slice(0, 200));
});

journey('catalog · a query with no hits says so honestly', 'librarian', async (page, base) => {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.fill('#q', 'zzzq nonexistent monograph zzzq');
  await page.press('#q', 'Enter');
  const status = await settled(page, '#catStatus', 25000);
  ok('it says there is nothing rather than showing a blank', status.trim().length > 0, 'the status line was empty');
  ok('the wording is about the search, not a crash', !/undefined|\[object|NaN|error: error/i.test(status), status.slice(0, 200));
});

journey('hours · the week loads and a day can be read', 'desk worker', async (page, base) => {
  await page.goto(base + '/hours', { waitUntil: 'domcontentloaded' });
  const summary = await settled(page, '#hrsSummary', 20000);
  ok('the summary answers "is anything open"', /open|closed|unavailable/i.test(summary), summary.slice(0, 200));
  ok('locations are listed', (await page.textContent('body')).includes('Biomedical'), 'no location names rendered');
  ok('the date control is operable', await page.locator('#hrsDate').isEnabled());
});

journey('hours · LibCal failing says which upstream failed', 'librarian', async (page, base, ctx) => {
  await ctx.route('**/api2.libcal.com/**', r => r.fulfill({ status: 503, body: 'down' }));
  await page.goto(base + '/hours', { waitUntil: 'domcontentloaded' });
  const status = await settled(page, '#hrsStatus', 20000);
  ok('the error names LibCal rather than saying "something went wrong"', /libcal/i.test(status), status.slice(0, 200));
  ok('the error carries the actual status code', /503|http/i.test(status), status.slice(0, 200));
});

journey('databases · the list loads and filters', 'patron', async (page, base) => {
  await page.goto(base + '/databases', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => /pubmed/i.test(document.body.textContent), null, { timeout: 20000 }).catch(() => {});
  const body = await page.textContent('body');
  ok('the A-Z list renders', /pubmed/i.test(body), body.slice(0, 200));
  const rows = () => page.evaluate(() => Array.from(document.querySelectorAll('.db-row')).map(r => r.textContent.trim()));
  const before = await rows();
  ok('every database is listed to begin with', before.length === 3, JSON.stringify(before));
  const input = page.locator('#dbQ');
  if (ok('there is a filter box', await input.count() > 0)) {
    await input.fill('embase');
    await page.waitForTimeout(300);
    const after = await rows();
    /* Counted on the rows, not on the body text. The first version of this check asked whether
       "PubMed" had left the page, and it never does: it is in the filter box's own placeholder
       ("PubMed, Embase, Scopus…"). The list was narrowing correctly the whole time and the check
       was reading the wrong element. Rows are also the assertion that cannot pass on an empty
       page, which the body-text version could. */
    ok('filtering narrows the list to the match', after.length === 1 && /embase/i.test(after[0]),
      `${before.length} rows -> ${JSON.stringify(after)}`);
    ok('and the status line says what was narrowed away', /1 of 3/.test(await page.textContent('#dbStatus')),
      await page.textContent('#dbStatus'));
  }
});

journey('databases · a failing list explains itself', 'librarian', async (page, base, ctx) => {
  await ctx.route('**/api/databases', r => r.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'could not reach the database list' }) }));
  await page.goto(base + '/databases', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => /could not|unavailable|error/i.test(document.body.textContent), null, { timeout: 20000 }).catch(() => {});
  const body = await page.textContent('body');
  ok('it says the list could not load', /could not load|could not reach/i.test(body), body.slice(0, 300));
  ok('and it points at the library\'s own A-Z as the way through', /library\.ucla\.edu|A to Z|A–Z/i.test(body), body.slice(0, 300));
});

journey('keyboard · the whole locate task without a mouse', 'patron who dislikes AI', async (page, base) => {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.keyboard.press('Tab');
  const firstStop = await page.evaluate(() => {
    const a = document.activeElement;
    return { tag: a.tagName, text: (a.textContent || '').trim().slice(0, 40), href: a.getAttribute('href') || '' };
  });
  ok('the first tab stop is a skip link', /skip/i.test(firstStop.text) || firstStop.href.startsWith('#'),
    `first stop was <${firstStop.tag}> "${firstStop.text}"`);
  /* Tab until the search box has focus. A box you cannot reach by keyboard is a box that does
     not exist for anyone using a screen reader or a switch. */
  let reached = false;
  for (let i = 0; i < 25 && !reached; i++) {
    reached = await page.evaluate(() => document.activeElement && document.activeElement.id === 'q');
    if (!reached) await page.keyboard.press('Tab');
  }
  if (ok('the search box is reachable by Tab alone', reached, 'not focused after 25 tabs')) {
    await page.keyboard.type(CN_HIT);
    await page.keyboard.press('Enter');
    const txt = await settled(page, '#result');
    ok('and Enter alone runs the search', /level|shelf|aisle|\b7\b/i.test(txt), txt.slice(0, 200));
  }
});

journey('accessibility · the answer is announced, not just drawn', 'patron who dislikes AI', async (page, base) => {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  const live = await page.getAttribute('#result', 'aria-live');
  ok('the result region is a live region', live === 'polite' || live === 'assertive', `aria-live=${live}`);
  ok('the result region has a role', ['status', 'alert', 'region'].includes(await page.getAttribute('#result', 'role')));
  const labelled = await page.evaluate(() => {
    const q = document.getElementById('q');
    if (!q) return 'no #q';
    if (q.getAttribute('aria-label')) return 'aria-label';
    if (q.getAttribute('aria-labelledby')) return 'aria-labelledby';
    if (q.id && document.querySelector(`label[for="${q.id}"]`)) return 'label[for]';
    if (q.closest('label')) return 'wrapping label';
    if (q.getAttribute('placeholder')) return 'PLACEHOLDER-ONLY';
    return 'NOTHING';
  });
  ok('the search box has a real accessible name', labelled !== 'NOTHING' && labelled !== 'PLACEHOLDER-ONLY',
    `named by: ${labelled} — a placeholder is not a label; it disappears as soon as you type`);
  const imgs = await page.evaluate(() => Array.from(document.images).filter(i => !i.hasAttribute('alt')).map(i => i.src).slice(0, 5));
  ok('every image has an alt attribute', imgs.length === 0, imgs.join(', '));
});

journey('privacy · the page talks to who it says it talks to', 'patron who dislikes AI', async (page, base, ctx, seen) => {
  seen.clear();
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.fill('#q', CN_HIT);
  await page.press('#q', 'Enter');
  await settled(page, '#result');
  await page.waitForTimeout(600);
  /* The README's claim is that a shelf lookup is entirely local and that the cover art is the
     only third-party request the app makes. A locate is the commonest thing anyone does here,
     and it should reach nothing but the fonts. Anything else on this list is a finding. */
  const ALLOWED = /^(fonts\.googleapis\.com|fonts\.gstatic\.com)$/;
  const unexpected = [...seen].filter(h => h && !ALLOWED.test(h));
  ok('a shelf lookup contacts no third party', unexpected.length === 0,
    'contacted: ' + unexpected.join(', '));
  const body = (await page.textContent('body')).toLowerCase();
  ok('the page does not claim to be an AI or a chatbot', !/\b(ai-powered|chatbot|ask our ai|powered by ai)\b/.test(body));
});

/* The two findings a review panel ranked first and second, both reproduced by hand before being
   written here. Both are the same defect: a surface that returns a confident answer without
   checking that it answered the question asked, on a tool whose entire argument is that it
   refuses to guess. These are regression tests, not pins: they were RED when written, which is
   the correct order for a test that proves a fix, and the opposite of the rule for a pin. */

journey('locate · a second call number does not answer for the first', 'desk worker', async (page, base) => {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.fill('#q', CN_HIT);                       // W1 AM4990, level 7
  await page.press('#q', 'Enter');
  const first = await settled(page, '#result');
  ok('the first slip resolves', /\b7\b/.test(first), first.slice(0, 120));

  /* The commonest gesture at a service desk: click into the box and type the next slip. Not
     fill(), which replaces the value and would test nothing. */
  await page.click('#q');
  await page.keyboard.type(CN_NLM);                    // WA 900.1 M300, level 10
  await page.press('#q', 'Enter');
  const second = await settled(page, '#result');

  const box = await page.inputValue('#q');
  const answeredFirstAgain = /\bAM4986\b|\bAM511\b/.test(second);
  /* Either the box took only the new number, or the page refused a string it could not fully
     read. What it must never do is return the PREVIOUS book's shelf in a panel shaped exactly
     like a correct answer: that is a wrong aisle, and the reader has no way to see it. */
  ok('the second slip does not return the first book\'s shelf',
    !answeredFirstAgain,
    `box held ${JSON.stringify(box)} and the answer was ${JSON.stringify(second.slice(0, 100))}`);
});

journey('locate · a space inside the cutter does not silently move the shelf', 'desk worker', async (page, base) => {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.fill('#q', CN_HIT);                       // W1 AM4990 -> level 7, index 9
  await page.press('#q', 'Enter');
  const clean = await settled(page, '#result');
  ok('the well-formed number resolves', /AM4986/.test(clean), clean.slice(0, 120));

  /* The same number with a stray space inside the cutter. It used to PARSE, not miss: "AM" became
     a cutter with no number and "4990" a second cutter, landing confidently on the face that holds
     bare "W1 AM" — index 4 rather than 9, five bays from the book, with no note. A wrong hit is
     worse than a miss, and the repair for the missing-space case only ever ran on a miss. */
  await page.fill('#q', 'W1 AM 4990');
  await page.press('#q', 'Enter');
  const spaced = await settled(page, '#result');

  ok('it does not answer with the shelf for a bare cutter',
    !/AL157/.test(spaced),
    `answered with the "W1 AM" face instead: ${spaced.slice(0, 140)}`);
  ok('it says what it read, or says it does not know',
    /Read as/i.test(spaced) || /No mapped shelf contains/i.test(spaced),
    spaced.slice(0, 160));
  /* If it repaired, it must land on the SAME shelf the clean form does. Announcing a repair and
     then answering with a different shelf would be the original bug wearing a receipt. */
  if (/Read as/i.test(spaced)) {
    ok('and the repaired lookup lands where the clean one did', /AM4986/.test(spaced),
      spaced.slice(0, 160));
  }
});

journey('map · the Reference view refuses what it cannot look up', 'librarian', async (page, base) => {
  await page.goto(base + '/map', { waitUntil: 'domcontentloaded' });
  await page.click('[data-coll="ref"]');
  await page.waitForTimeout(200);

  await page.fill('#q', 'NOT A CALL NUMBER AT ALL');
  await page.press('#q', 'Enter');
  const nonsense = await settled(page, '#result');
  /* The branch used to echo whatever was typed and assert floor 4, so it could not be wrong in
     any way it was able to detect. A surface with no lookup behind its sentence is the one thing
     this product says it does not do. */
  /* Asserted on the claim, not on the presence of hedging words. The first version of this line
     allowed "floor 4" if the text also matched /not|cannot|no /, which the echoed query
     "NOT A CALL NUMBER AT ALL" satisfies by itself: the assertion passed on the exact output it
     existed to catch, because the reader's own input supplied the word that excused it. */
  ok('a string that is not a call number is not placed on a floor',
    !/is on floor 4/i.test(nonsense),
    nonsense.slice(0, 160));

  await page.fill('#q', CN_HIT);                       // mapped on level 7, not Reference
  await page.press('#q', 'Enter');
  const mapped = await settled(page, '#result');
  ok('a number the map places elsewhere is not asserted onto floor 4',
    !/is on floor 4/i.test(mapped),
    mapped.slice(0, 160));
});

journey('map · a pull list does not walk you to a word', 'desk worker', async (page, base) => {
  /* Round 1 of the ship review failed on this, after round 0 had been declared fixed. The guard
     went into findFaces and shelf-core said in a comment that everything resolving a shelf went
     through it, naming the route builder. map.html had a second copy, routeLocate, so the walk
     never saw the guard: "asthma" came back as a stop on Level 11 with the word printed on the
     shelf face, and the counter read "5 books across 3 floors". The desk worker found it by
     pasting a list, which is the one input where junk lines are guaranteed because they come out
     of OCR. Two readers had shipped round 0 believing this surface was covered. */
  await page.goto(base + '/map', { waitUntil: 'domcontentloaded' });
  await page.click('#routeToggle');                 // the planner is a collapsed disclosure
  await page.waitForSelector('#cnList', { state: 'visible' });

  await page.fill('#cnList', ['W1 AM4990', 'asthma', 'banana bread', 'ZZ 999 Q999'].join('\n'));
  await page.click('#buildRoute');
  await page.waitForTimeout(300);
  const walk = await settled(page, '#itinerary');

  ok('a word that is not a call number is not printed on a shelf face',
    !/asthma/i.test(walk) || /Not read as call numbers/i.test(walk),
    walk.slice(0, 300));
  ok('and it is named as unread rather than silently dropped',
    /Not read as call numbers/i.test(walk) && /banana bread/i.test(walk),
    walk.slice(0, 300));
  /* The counter is the claim the reader acts on: it is what tells them the bag is full. */
  const n = walk.match(/(\d+)\s+books? across/);
  ok('the book count counts only the lines that resolved',
    n ? Number(n[1]) === 1 : /Not located|Not read/.test(walk),
    `counter said ${n ? n[1] : 'nothing'} for one real call number: ${walk.slice(0, 200)}`);

  /* The same string, the same page, two boxes. The walk used to answer index 4 while the box
     above answered index 9 -- five bays apart, from one input, with nothing said. */
  await page.fill('#cnList', 'W1 AM 4990');
  await page.click('#buildRoute');
  await page.waitForTimeout(300);
  const spaced = await settled(page, '#itinerary');
  ok('a cutter split by a space is repaired in the walk too, and said out loud',
    /Read as/i.test(spaced), spaced.slice(0, 200));
  ok('and the walk does not land on the bare-cutter face',
    !/AL157/.test(spaced), spaced.slice(0, 200));
});

journey('map · a refusal leaves nothing on screen that looks like an answer', 'librarian', async (page, base) => {
  /* Ship round 2 passed six of six, and four of the six named this as the one thing they would
     fix. Three said in advance they would flip to NOT YET if the leftover panel were ever
     relabelled with the refused string. So the fix has to CLEAR it, not relabel it -- a panel
     that reads as an answer to the query just refused is the wrong aisle this product exists to
     refuse. */
  await page.goto(base + '/map', { waitUntil: 'domcontentloaded' });

  await page.fill('#q', 'W1 AM4990');
  await page.press('#q', 'Enter');
  await settled(page, '#result');
  const answered = await page.textContent('#detail');
  ok('a real call number fills the detail panel first', /is on this face|Index/i.test(answered), answered.slice(0, 120));

  await page.fill('#q', 'asthma');
  await page.press('#q', 'Enter');
  const refusal = await settled(page, '#result');
  const after = await page.textContent('#detail');

  ok('the refusal says the string is not a call number, not that the survey missed it',
    /is not a call number/i.test(refusal), refusal.slice(0, 200));
  ok('and no shelf face is left on screen under it',
    !/is on this face/i.test(after), after.slice(0, 200));
  const lit = await page.locator('.plan .sel, .plan .flash, [class*="sel"]').count().catch(() => 0);
  ok('and no shelf is left lit on the plan', lit === 0, `${lit} shelf/shelves still marked`);

  /* A call number the survey genuinely has not reached keeps the old sentence, which is true
     about it. The pinned signature lives here. */
  await page.fill('#q', 'ZZ 999 Q999');
  await page.press('#q', 'Enter');
  const unmapped = await settled(page, '#result');
  ok('a real call number outside the survey still says no mapped shelf contains it',
    /No mapped shelf contains/i.test(unmapped), unmapped.slice(0, 200));
});

journey('map · pressing Build route says something out loud', 'screen-reader user', async (page, base) => {
  /* The reader pressed the button and heard nothing: the walk was drawn into a region with no
     live semantics, so the entire result was visible-only. A walk that quietly dropped two of
     your five lines is the one result you must not have to look at to learn about. */
  await page.goto(base + '/map', { waitUntil: 'domcontentloaded' });
  await page.click('#routeToggle');
  await page.waitForSelector('#cnList', { state: 'visible' });

  const region = page.locator('#routeStatus');
  ok('there is a polite live region for the route result', await region.count() === 1, 'no #routeStatus');
  ok('and it is a status region', await region.getAttribute('aria-live') === 'polite', 'not polite');

  await page.fill('#cnList', ['W1 AM4990', 'asthma', 'ZZ 999 Q999'].join('\n'));
  await page.click('#buildRoute');
  await page.waitForFunction(() => (document.getElementById('routeStatus') || {}).textContent, null, { timeout: 5000 });
  const said = await region.textContent();

  ok('it announces the walk it just built', /book/i.test(said), said);
  ok('and it announces the lines it could not read, which are the ones you cannot see are missing',
    /not read as call numbers/i.test(said) && /not located/i.test(said), said);
});

journey('locate · where the spacebar landed does not change the shelf', 'desk worker', async (page, base) => {
  /* Ship round 3 passed six of six and still named this the one must-fix, because it is the
     single place the tool asserted something untrue rather than admitting ignorance. Three
     failures, one cause: spaces were treated as structure rather than punctuation.
       wb115h322   told "is not a call number", while /about promises spaces are optional
       W1AM4990    "No mapped shelf contains it" -- a miss dressed as a gap in the survey
       W 1 AM4990  Level 10. A WRONG SHELF, seven levels from the book, silently. */
  await page.goto(base, { waitUntil: 'domcontentloaded' });

  await page.fill('#q', 'WB 115 H322');
  await page.press('#q', 'Enter');
  const spaced = await settled(page, '#result');
  const level = (spaced.match(/Level (\d+)/) || [])[1];
  ok('the well-formed number locates', !!level, spaced.slice(0, 140));

  for (const variant of ['wb115h322', 'WB115H322']) {
    await page.fill('#q', variant);
    await page.press('#q', 'Enter');
    const got = await settled(page, '#result');
    ok(`${variant} is not told it is not a call number`,
      !/is not a call number/i.test(got), got.slice(0, 160));
    ok(`${variant} lands on the same level as the spaced form`,
      (got.match(/Level (\d+)/) || [])[1] === level, got.slice(0, 160));
  }

  /* The wrong-shelf one. A split W-prefix is something the NLM comparator will happily sort,
     and it sorts it onto a different floor. This must be repaired BEFORE the lookup, because
     unlike the others it does not miss -- it answers, confidently, wrongly. */
  await page.fill('#q', 'W1 AM4990');
  await page.press('#q', 'Enter');
  const w1 = await settled(page, '#result');
  const w1level = (w1.match(/Level (\d+)/) || [])[1];

  for (const variant of ['W1AM4990', 'W 1 AM4990', 'W1 AM 4990']) {
    await page.fill('#q', variant);
    await page.press('#q', 'Enter');
    const got = await settled(page, '#result');
    ok(`${variant} reaches the same shelf as W1 AM4990`,
      (got.match(/Level (\d+)/) || [])[1] === w1level,
      `expected level ${w1level}: ${got.slice(0, 160)}`);
    ok(`${variant} says what it read instead of repairing silently`,
      /Read as/i.test(got), got.slice(0, 160));
  }

  /* The other half of the rule, and the reason the repair is not applied to everything: a
     one-letter class stem run together with digits is indistinguishable from an acronym.
     "H 1 N1" really does sort inside a mapped range on level 11. */
  await page.fill('#q', 'H1N1');
  await page.press('#q', 'Enter');
  const virus = await settled(page, '#result');
  ok('a virus name is not repaired into a shelf',
    !/Level \d+ · /.test(virus), virus.slice(0, 160));
});

journey('map · a status line does not outlive the question it answered', 'librarian', async (page, base) => {
  await page.goto(base + '/map', { waitUntil: 'domcontentloaded' });
  await page.fill('#q', 'asthma');
  await page.press('#q', 'Enter');
  const refused = await settled(page, '#result');
  ok('the refusal is shown', /is not a call number/i.test(refused), refused.slice(0, 140));

  const shelf = page.locator('#plan g.shelf').first();
  if (await shelf.count()) {
    await shelf.click({ force: true });
    await page.waitForTimeout(200);
    const line = await page.textContent('#result');
    ok('tapping a shelf clears the refusal that was answering the old query',
      !/is not a call number/i.test(line || ''), (line || '').slice(0, 160));
  }
});

journey('locate · a gene is not a shelf', 'librarian', async (page, base) => {
  /* The worst defect found in the whole review, and no ship round found it: I did, attacking my
     own spacing repair. On a BIOMEDICAL library's tool, eighteen of the commonest things a reader
     types came back as shelf faces -- TP53 on level 10, CD4 and HER2 and JAK2 on level 11 -- each
     with the confidence of a real answer. Sixteen predate the spacing work; it widened it by two.
     A gene name and a call number typed without spaces are the same shape, so the shape test could
     never have separated them. What separates them is a fact: whether this building has that class.
     These belong in the catalog, which is what somebody typing HER2 actually wants. */
  await page.goto(base, { waitUntil: 'domcontentloaded' });

  for (const term of ['TP53', 'CD4', 'HER2', 'JAK2', 'IL6', 'H1N1', 'HbA1c', 'BRCA1']) {
    await page.fill('#q', term);
    await page.press('#q', 'Enter');
    const got = await settled(page, '#result');
    ok(`${term} is not answered with a shelf face`,
      !/Level \d+ · (top|bottom) row · index/i.test(got), got.slice(0, 160));
  }

  /* The same failure with a word attached, found by the reference librarian in round 4 and worse
     than the bare acronyms: the shape test was anchored at the start and not at the end, so
     anything that merely BEGAN like a call number took the shelf path and the rest of the phrase
     was discarded. "B12 deficiency" is something a patron says out loud at the desk, and it was
     answered with Level 11, index 1 -- while "vitamin B12", the same topic the other way round,
     correctly reached the catalog. */
  for (const phrase of ['B12 deficiency', 'CD4 count', 'IL6 signaling', 'K2 vitamin therapy']) {
    await page.fill('#q', phrase);
    await page.press('#q', 'Enter');
    const got = await settled(page, '#result');
    ok(`"${phrase}" is a phrase, not a shelf`,
      !/Level \d+ · (top|bottom) row · index/i.test(got), got.slice(0, 160));
  }

  /* Third instance, found by five of six readers in round 5 after my own 139-string sweep missed
     it -- I had tested "1000mcg" alone and "B12" alone and never the two together. Worse than what
     it hid behind: bare "CD4" correctly reached the catalog while "CD4 350", the more specific and
     more real thing for a clinician to type, got an aisle on a floor of psychology books. */
  for (const dose of ['B12 1000mcg', 'D3 2000iu', 'K2 100mcg', 'T4 125', 'CD4 350', 'TP53 R175H', 'B6 50mg', 'IL6 2024']) {
    await page.fill('#q', dose);
    await page.press('#q', 'Enter');
    const got = await settled(page, '#result');
    ok(`"${dose}" is a dose or a lab value, not a shelf`,
      !/Level \d+ · (top|bottom) row · index/i.test(got), got.slice(0, 160));
  }

  /* The other direction, which cost two attempts: the first version of this rule refused
     "WB39 M294" and 363 other real endpoints typed with the class run into its number. */
  for (const real of ['WB39 M294', 'WA900.1 M297', 'AS 36 N4']) {
    await page.fill('#q', real);
    await page.press('#q', 'Enter');
    const got = await settled(page, '#result');
    ok(`"${real}" is a real call number and still reaches a shelf`,
      /Level \d+/.test(got), got.slice(0, 160));
  }

  /* And the other side of the same rule: a class this building really has still works spaceless. */
  await page.fill('#q', 'WB115H322');
  await page.press('#q', 'Enter');
  const real = await settled(page, '#result');
  ok('a real spaceless call number still reaches its shelf',
    /Level \d+/.test(real), real.slice(0, 160));

  /* W4CK79M reads as class W number 4, and as the W4C class. Those are different floors. The
     first version of the repair picked one and was wrong; it now prefers the longer stem the
     survey actually recorded. */
  await page.fill('#q', 'W4CK79M');
  await page.press('#q', 'Enter');
  const w4c = await settled(page, '#result');
  ok('W4CK79M reads as the W4C class, not as class W',
    /Level 1\b/.test(w4c) && !/Level 10/.test(w4c), w4c.slice(0, 160));
});

journey('404 · a wrong URL is a real 404, not the app', 'librarian', async (page, base) => {
  const res = await page.goto(base + '/aboutt', { waitUntil: 'domcontentloaded' });
  ok('the status really is 404', res.status() === 404, `got ${res.status()} — a soft 404 hides every broken link`);
  const body = await page.textContent('body');
  ok('and it is the 404 page, not 330 KB of tool', body.length < 12000 && !/plan a pickup walk/i.test(body),
    `${body.length} chars`);
  ok('it offers a way back', await page.locator('a[href="/"], a[href$="/"]').count() > 0);
});

journey('privacy · what must not be on the web is not served', 'librarian', async (page, base) => {
  for (const p of ['/README.md', '/wrangler.jsonc', '/biomed-shelf-ranges.json', '/Instructions.txt', '/src/worker.js', '/ops/test', '/package.json', '/node_modules/playwright/package.json']) {
    const res = await page.request.get(base + p);
    ok(`${p} is not published`, res.status() === 404, `got ${res.status()}`);
  }
});

journey('mobile · the app is usable at 390px', 'desk worker', async (page, base) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  const overflow = await page.evaluate(() => {
    const d = document.documentElement;
    return { scrollW: d.scrollWidth, clientW: d.clientWidth,
      wide: Array.from(document.querySelectorAll('body *')).filter(e => e.getBoundingClientRect().right > d.clientWidth + 2)
        .slice(0, 4).map(e => e.tagName + '.' + (e.className || '').toString().split(' ')[0]) };
  });
  /* A page that scrolls sideways on a phone is the single most common way a responsive layout
     fails, and it is invisible on a desktop run. The floor plan is allowed its own horizontal
     scroll; the PAGE is not. */
  ok('the page does not scroll sideways', overflow.scrollW <= overflow.clientW + 2,
    `${overflow.scrollW} > ${overflow.clientW}; widest: ${overflow.wide.join(', ')}`);
  await page.fill('#q', CN_HIT);
  await page.press('#q', 'Enter');
  const txt = await settled(page, '#result');
  ok('and the locate still works on a phone', /level|shelf|\b7\b/i.test(txt), txt.slice(0, 200));
});

journey('console · nothing is throwing while a person uses it', 'desk worker', async (page, base) => {
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.fill('#q', CN_HIT);
  await page.press('#q', 'Enter');
  await settled(page, '#result');
  await page.goto(base + '/map', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  /* Blocked/aborted subresources are this harness's own doing, not the page's. */
  const real = errs.filter(e => !/ERR_(FAILED|ABORTED|BLOCKED)|net::|Failed to load resource/i.test(e));
  ok('no uncaught errors on the two main pages', real.length === 0, real.slice(0, 4).join('\n      '));
});

journey('map · the floor plan draws shelves', 'librarian', async (page, base) => {
  await page.goto(base + '/map', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const shelves = await page.evaluate(() =>
    document.querySelectorAll('svg rect, .shelf, [class*="shelf"], [data-face]').length);
  ok('the plan renders shelf faces', shelves > 20, `only ${shelves} shelf-ish elements found`);
  ok('the page names the level it is showing', /level|floor/i.test(await page.textContent('body')));
});

/* ---------- run ---------- */

/* Pull the published set down with curl and lay it out the way the server expects. curl rather
   than fetch because curl is what already reads this container's proxy configuration and CA
   bundle, and it is the client that demonstrably reaches the site. */
function fetchDeployed() {
  const { execFileSync } = require('child_process');
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'shelfmark-deployed-'));
  const SET = [['/', 'index.html'], ['/about', 'about.html'], ['/methodology', 'methodology.html'],
    ['/hours', 'hours.html'], ['/map', 'map.html'], ['/databases', 'databases.html'],
    ['/404', '404.html'], ['/site.css', 'site.css'], ['/shelf-core.js', 'shelf-core.js'],
    ['/shelf-data.js', 'shelf-data.js'], ['/robots.txt', 'robots.txt']];
  for (const [url, name] of SET) {
    const out = path.join(dir, name);
    execFileSync('curl', ['-sS', '-f', '-m', '45', '-o', out, DEPLOYED_FROM + url], { stdio: 'pipe' });
    if (!fs.existsSync(out) || fs.statSync(out).size === 0) throw new Error(`empty response for ${url}`);
  }
  return dir;
}

(async () => {
  let servedFrom = ROOT;
  if (DEPLOYED) {
    servedFrom = fetchDeployed();
    console.log(`fetched the published set from ${DEPLOYED_FROM} into ${servedFrom}`);
  }
  const local = ORIGIN ? null : await startServer(servedFrom);
  const base = ORIGIN ? ORIGIN.replace(/\/$/, '') : local.base;
  const browser = await chromium.launch(ORIGIN && process.env.HTTPS_PROXY
    ? { proxy: { server: process.env.HTTPS_PROXY } } : {});
  if (SHOT) fs.mkdirSync(SHOTDIR, { recursive: true });

  console.log(ORIGIN ? `against ${base} — LIVE, no stubs\n`
    : DEPLOYED ? `against the PUBLISHED bytes from ${DEPLOYED_FROM}, served locally, network stubbed\n`
    : `against ${base} — this working tree, served locally, network stubbed\n`);

  const list = ONLY ? journeys.filter(j => j.name.includes(ONLY)) : journeys;
  for (const j of list) {
    current = j.name;
    const before = pass, beforeF = failures.length;
    const seen = new Set();
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    if (!ORIGIN) await installStubs(ctx, seen);
    const page = await ctx.newPage();
    try {
      await j.fn(page, base, ctx, seen);
      if (SHOT) await page.screenshot({ path: path.join(SHOTDIR, j.name.replace(/[^a-z0-9]+/gi, '-') + '.png'), fullPage: true });
    } catch (e) {
      failures.push(`${j.name} › THREW ${e.message.split('\n')[0]}`);
    }
    await ctx.close();
    const n = pass - before, f = failures.length - beforeF;
    console.log(`  ${f ? 'FAIL' : ' ok '}  ${String(n).padStart(3)}  ${j.name}   [${j.persona}]`);
  }

  await browser.close();
  if (local) local.server.close();

  if (SHOT) console.log(`\nscreenshots in ops/shots/ — look at them. A layout that is ugly or off-brand passes every assertion above.`);
  console.log(`\n${pass} passed, ${failures.length} failed`);
  failures.forEach(f => console.log('  FAIL ' + f));
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.error('harness died: ' + e.stack); process.exit(1); });
