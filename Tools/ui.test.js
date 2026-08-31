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
const ARTICLES = { count: 2, items: [
  { title: 'Asthma in adults', creator: 'Smith J', date: '2024', isPeerReviewed: true, doi: '10.1000/x', id: 'a1', source: 'The Lancet' },
  { title: 'Childhood asthma review', creator: 'Doe A', date: '2023', isPeerReviewed: false, id: 'a2', source: 'BMJ' },
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
  await context.route('**/api/suggest**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ suggestion: 'asthma' }) }));
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
   test everybody learns to re-run instead of read. */
const settled = async (page, sel, ms = 15000) => {
  await page.waitForFunction(
    s => { const el = document.querySelector(s); return el && el.textContent.trim().length > 0; },
    sel, { timeout: ms },
  ).catch(() => {});
  return (await page.textContent(sel).catch(() => '')) || '';
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
