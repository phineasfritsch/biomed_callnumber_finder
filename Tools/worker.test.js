// Tests for src/worker.js, run against stubbed upstreams.
//
//   node Tools/worker.test.js
//
// The worker is the only server this project has and the only code a reader cannot inspect by
// viewing source, so it is the one place a silent regression is invisible from the outside. It
// also talks to two endpoints that answer plausibly when they are misused: Primo returns a full,
// unfiltered result set for a filter it does not understand, and LibGuides returns 1.17 MB of
// markup whose shape is not a contract. Both failures look like success.
//
// Nothing here touches the network. `fetch`, `caches` and `setTimeout` are stubbed; every
// upstream answer is scripted per test.
//
// Two ways in, both reading the same bytes off disk so they cannot drift:
//   - the routes, through a real `import()` of the module, so the export shape is tested too;
//   - the helpers, through the source slice before `export default`, because they are private.

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const SRC_PATH = path.join(ROOT, 'src', 'worker.js');
const SRC = fs.readFileSync(SRC_PATH, 'utf8');

/* ---- assertion harness (same shape as Tools/catalog.test.js) ---- */
let pass = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
}
function eq(name, got, want) {
  ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}
function section(t) { console.log(`\n${t}`); }

/* ---- extract the private helpers ---- */
const cut = SRC.indexOf('export default');
if (cut < 0) throw new Error('could not find `export default` in src/worker.js — did the shape change?');
const head = SRC.slice(0, cut);
if (/^\s*import\s/m.test(head)) throw new Error('src/worker.js grew an import — the sandbox slice is no longer a script');

const H = {};
new Function('exports', head + `
  Object.assign(exports, { first, list, names, slim, dedupe, repair, year, parseAZ, json,
    FIELDS, TYPES, SORTS, LANGS, MAX_LIMIT, TTL, SUGGEST_TTL, AZ_TTL, YEAR_FLOOR });
`)(H);

/* ---- stubs ---- */

// Cloudflare's edge cache. Keyed on the request URL, not on the Request object: the worker
// builds a fresh Request for every read and never holds a reference, so identity keying would
// report a permanent miss and every cache test would pass for the wrong reason.
function makeCache() {
  const store = new Map();
  const puts = [];
  let throwOn = null;
  return {
    store, puts,
    throwOn(which) { throwOn = which; },
    async match(req) {
      if (throwOn === 'match') throw new Error('cache exploded');
      const e = store.get(String(req.url));
      // A Response body is single-read, so every hit has to be a new one.
      return e ? new Response(e.body, { headers: e.headers }) : undefined;
    },
    async put(req, res) {
      if (throwOn === 'put') throw new Error('cache exploded');
      const body = await res.text();
      const headers = {};
      res.headers.forEach((v, k) => { headers[k] = v; });
      store.set(String(req.url), { body, headers });
      puts.push({ url: String(req.url), body, headers });
    },
  };
}

// A scripted upstream. Steps are consumed in order; the last one repeats.
const net = { calls: [], script: [{ body: '{}' }] };
function upstream(...steps) { net.script = steps.length ? steps : [{ body: '{}' }]; net.calls.length = 0; }
globalThis.fetch = async (url, init) => {
  net.calls.push({ url: String(url), init: init || {} });
  const step = net.script.length > 1 ? net.script.shift() : net.script[0];
  if (step.throw) throw new Error(step.throw);
  if (step.raw) return step.raw;
  return new Response(step.body === undefined ? '{}' : step.body, {
    status: step.status || 200,
    headers: { 'Content-Type': step.ct || 'application/json' },
  });
};

// Wrapped, not replaced: the retry pause becomes assertable and the suite stays under a second.
const realSetTimeout = globalThis.setTimeout;
const sleeps = [];
globalThis.setTimeout = (fn, ms) => { sleeps.push(ms); return realSetTimeout(fn, 0); };

let cache = makeCache();
globalThis.caches = { get default() { return cache; } };

const waited = [];
const ctx = { waitUntil: p => waited.push(p) };
// Cache writes ride on waitUntil, so anything asserting a second call is a hit must settle first.
const settle = () => Promise.all(waited.splice(0));

const assetCalls = [];
const env = { ASSETS: { fetch: async req => { assetCalls.push(req); return new Response('asset', { status: 200 }); } } };
const envBroken = { ASSETS: { fetch: async () => { throw new Error('assets exploded'); } } };

function reset() {
  cache = makeCache();
  net.calls.length = 0;
  net.script = [{ body: '{}' }];
  sleeps.length = 0;
  waited.length = 0;
  assetCalls.length = 0;
}

/* ---- request helpers ---- */
const ORIGIN = 'https://shelfmark.example';
const req = (p, method) => new Request(ORIGIN + p, { method: method || 'GET' });

// Every response the worker produces has to carry the same envelope, errors included: a failure
// without the CORS header reads to the page as a network outage rather than as a 4xx it could
// explain.
async function envelope(name, res, want) {
  ok(name + ' — status ' + want.status, res.status === want.status, 'got ' + res.status);
  ok(name + ' — CORS', res.headers.get('Access-Control-Allow-Origin') === '*',
    'got ' + res.headers.get('Access-Control-Allow-Origin'));
  if (want.status !== 204) {
    ok(name + ' — JSON content type', /application\/json/.test(res.headers.get('Content-Type') || ''),
      'got ' + res.headers.get('Content-Type'));
    const cc = res.headers.get('Cache-Control') || '';
    if (want.status === 200) ok(name + ' — cacheable', /^public, max-age=\d+/.test(cc), 'got ' + cc);
    else ok(name + ' — not stored', cc === 'no-store', 'got ' + cc);
  }
}

// The upstream calls that are a search, as opposed to the bare one-row spelling probe. An empty
// result set triggers the spelling fallback, which would otherwise be counted as a retry.
const searchCalls = () => net.calls.filter(c => !/[?&]limit=1&/.test(c.url) || /qInclude/.test(c.url));
const suggestCalls = () => net.calls.filter(c => /[?&]limit=1&/.test(c.url) && !/qInclude/.test(c.url));

const upParam = (call, k) => new URL(call.url).searchParams.get(k);

// A Primo answer with one usable record, so retry and cache tests do not trip the fallback.
const oneDoc = (extra) => JSON.stringify(Object.assign({
  info: { total: 1, totalResultsLocal: 1, totalResultsPC: 0 },
  docs: [{ pnx: { display: { title: ['A paper'] }, control: { recordid: ['cdi_x1'] } } }],
}, extra || {}));
const noDocs = JSON.stringify({ info: { total: 0, totalResultsLocal: 0, totalResultsPC: 0 }, docs: [] });

(async () => {
  const worker = (await import(pathToFileURL(SRC_PATH).href)).default;
  // A handler that throws instead of answering is the failure being tested for, not a reason to
  // stop testing: it becomes a response the envelope check can fail on.
  const call = async (p, method, e) => {
    try {
      return await worker.fetch(req(p, method), e || env, ctx);
    } catch (err) {
      return new Response(JSON.stringify({ error: 'the worker threw: ' + err.message }), {
        status: 599, headers: { 'Content-Type': 'text/plain' },
      });
    }
  };

  /* ================= 1. routing and method gates ================= */
  section('routing and method gates');
  reset();

  ok('module exports a fetch handler', typeof worker.fetch === 'function');

  let r = await call('/');
  ok('/ goes to the assets binding', assetCalls.length === 1 && net.calls.length === 0);
  ok('/ returns what the assets binding returned', r.status === 200);

  reset();
  await call('/api/articles/');
  ok('a trailing slash is not the API', assetCalls.length === 1);
  reset();
  await call('/API/Articles');
  ok('the path is case-sensitive', assetCalls.length === 1);

  reset();
  upstream({ body: oneDoc() });
  r = await call('/api/articles?q=x', 'HEAD');
  await envelope('HEAD /api/articles', r, { status: 200 });

  for (const m of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    reset();
    r = await call('/api/articles?q=x', m);
    await envelope(m + ' /api/articles', r, { status: 405 });
    ok(m + ' names the methods it allows', /GET/.test(r.headers.get('Allow') || ''),
      'Allow: ' + r.headers.get('Allow'));
    ok(m + ' never reaches the upstream', net.calls.length === 0);
  }
  reset();
  r = await call('/api/suggest?q=x', 'POST');
  ok('POST /api/suggest is 405', r.status === 405);
  r = await call('/api/databases', 'DELETE');
  ok('DELETE /api/databases is 405', r.status === 405);

  reset();
  r = await call('/api/articles', 'OPTIONS');
  await envelope('OPTIONS /api/articles', r, { status: 204 });
  ok('preflight names its methods', /GET/.test(r.headers.get('Access-Control-Allow-Methods') || ''),
    'got ' + r.headers.get('Access-Control-Allow-Methods'));
  ok('preflight allows a content type header',
    (r.headers.get('Access-Control-Allow-Headers') || '').length > 0);
  ok('preflight is worth caching', /\d/.test(r.headers.get('Access-Control-Max-Age') || ''));

  /* ================= 2. parameter validation ================= */
  section('parameter validation');
  reset();

  r = await call('/api/articles');
  await envelope('q missing', r, { status: 400 });
  eq('q missing says so', (await r.json()).error, 'q is required');
  ok('a rejected request costs the upstream nothing', net.calls.length === 0);

  r = await call('/api/articles?q=%20%20');
  eq('whitespace is not a query', (await r.json()).error, 'q is required');

  upstream({ body: oneDoc() });
  r = await call('/api/articles?q=' + 'a'.repeat(300));
  ok('300 characters is allowed', r.status === 200, 'got ' + r.status);
  r = await call('/api/articles?q=' + 'a'.repeat(301));
  eq('301 characters is not', (await r.json()).error, 'q is too long');

  // Allowlists must not answer for the things every object inherits.
  for (const [k, v] of [['field', 'constructor'], ['field', '__proto__'], ['type', 'toString'],
                        ['sort', 'constructor'], ['lang', 'hasOwnProperty'], ['field', 'valueOf']]) {
    reset();
    r = await call('/api/articles?q=x&' + k + '=' + v);
    ok(`${k}=${v} is refused`, r.status === 400, 'got ' + r.status);
    ok(`${k}=${v} never reaches the upstream`, net.calls.length === 0);
  }
  reset();
  r = await call('/api/articles?q=x&field=bogus');
  eq('an unknown field is named back', (await r.json()).error, 'unknown field: bogus');
  r = await call('/api/articles?q=x&lang=klingon');
  eq('an unknown language is named back', (await r.json()).error, 'unknown language: klingon');
  r = await call('/api/articles?q=x&sort=relevance');
  ok('an unknown sort is refused', r.status === 400);
  r = await call('/api/articles?q=x&type=videos');
  ok('an unknown type is refused', r.status === 400);

  r = await call('/api/articles?q=x&field=%3C/script%3E%22boom');
  ok('a reflected value stays inside JSON', r.status === 400);
  ok('the reflected body parses', typeof (await r.json()).error === 'string');

  const nowYear = new Date().getUTCFullYear();
  for (const y of ['abcd', '99', '0000', '1499', String(nowYear + 2), '20200']) {
    r = await call('/api/articles?q=x&from=' + y);
    ok('from=' + y + ' is refused', r.status === 400, 'got ' + r.status);
  }
  upstream({ body: oneDoc() });
  r = await call('/api/articles?q=x&from=1500&to=' + (nowYear + 1));
  ok('the year bounds are inclusive', r.status === 200, 'got ' + r.status);
  r = await call('/api/articles?q=x&from=2020&to=2019');
  eq('an inverted range is refused', (await r.json()).error, 'from is later than to');

  /* ================= 3. the upstream request ================= */
  section('the upstream request');
  reset();

  upstream({ body: oneDoc() });
  await call('/api/articles?q=aspirin');
  let c = searchCalls()[0];
  eq('the query carries the field and the operator', upParam(c, 'q'), 'any,contains,aspirin');
  eq('the institution is fixed', upParam(c, 'vid'), '01UCS_LAL:UCLA');
  eq('the scope is fixed', upParam(c, 'scope'), 'MyInst_and_CI');
  eq('articles are the default', upParam(c, 'qInclude'), 'facet_rtype,exact,articles');
  eq('a few spare rows are asked for', upParam(c, 'limit'), '15');
  eq('the default offset is zero', upParam(c, 'offset'), '0');
  ok('the client identifies itself', /Shelfmark/.test(c.init.headers['User-Agent']));
  ok('the request can be given up on', !!c.init.signal, 'no abort signal on the upstream fetch');

  // Primo's `q` is a comma-delimited grammar whose fourth token is a boolean joining the next
  // clause. Verified live: `aspirin,AND,title,contains,zzzzqqq` returns 0 where `aspirin` returns
  // millions, so a comma a reader typed is a clause a reader did not ask for.
  reset();
  upstream({ body: oneDoc() });
  await call('/api/articles?q=' + encodeURIComponent('aspirin,AND,title,contains,zzzz'));
  ok('a comma cannot open a second clause', !/,AND,/.test(upParam(searchCalls()[0], 'q')),
    upParam(searchCalls()[0], 'q'));
  reset();
  upstream({ body: oneDoc() });
  await call('/api/articles?q=' + encodeURIComponent('smith, john'));
  eq('a comma a reader typed still searches for the words',
    upParam(searchCalls()[0], 'q'), 'any,contains,smith john');

  for (const [qs, want] of [['limit=15', '20'], ['limit=99', '25'], ['limit=abc', '15'], ['limit=-5', '6'], ['limit=0', '6']]) {
    reset();
    upstream({ body: oneDoc() });
    r = await call('/api/articles?q=x&' + qs);
    ok(qs + ' asks the upstream for ' + want, r.status === 200 && upParam(searchCalls()[0], 'limit') === want,
      'status ' + r.status + ', limit ' + (searchCalls()[0] && upParam(searchCalls()[0], 'limit')));
  }
  reset();
  upstream({ body: oneDoc() });
  r = await call('/api/articles?q=x&limit=-5');
  eq('a negative limit never eats rows off the end', (await r.json()).docs.length, 1);

  reset();
  upstream({ body: oneDoc() });
  await call('/api/articles?q=x&offset=-3');
  eq('a negative offset is the first page', upParam(searchCalls()[0], 'offset'), '0');
  r = await call('/api/articles?q=x&offset=1e5');
  ok('an offset that is not digits is refused', r.status === 400, 'got ' + r.status);
  r = await call('/api/articles?q=x&offset=999999999');
  ok('an offset past the end of the index is refused', r.status === 400, 'got ' + r.status);

  reset();
  upstream({ body: oneDoc() });
  r = await call('/api/articles?q=x&articlesOnly=no');
  let body = await r.json();
  eq('articlesOnly=no still means everything', body.applied.type, 'any');
  ok('everything means no type facet', !/facet_rtype/.test(upParam(searchCalls()[0], 'qInclude') || ''));

  /* ================= 4. filters ================= */
  section('filters');
  reset();

  upstream({ body: oneDoc() });
  await call('/api/articles?q=x&peer=yes&oa=yes');
  let qi = upParam(searchCalls()[0], 'qInclude');
  ok('peer review is a facet', /facet_tlevel,include,peer_reviewed/.test(qi), qi);
  ok('open access is a facet', /facet_tlevel,include,open_access/.test(qi), qi);
  ok('facets are joined the way the index joins them', qi.includes('|,|'), qi);

  reset();
  upstream({ body: oneDoc() });
  await call('/api/articles?q=x&beyond=yes');
  eq('the wider search is one parameter', upParam(searchCalls()[0], 'pcAvailability'), 'true');
  reset();
  upstream({ body: oneDoc() });
  await call('/api/articles?q=x');
  eq('and is off by default', upParam(searchCalls()[0], 'pcAvailability'), null);

  // `|,|` separates facets, so a journal title carrying it would splice in filters nobody asked for.
  reset();
  r = await call('/api/articles?q=x&jtitle=' + encodeURIComponent('Nature|,|facet_rtype,exact,books'));
  ok('a journal title cannot splice in a facet', r.status === 400, 'got ' + r.status);
  ok('and costs the upstream nothing', net.calls.length === 0);
  upstream({ body: oneDoc() });
  r = await call('/api/articles?q=x&jtitle=' + encodeURIComponent('The Lancet, Neurology'));
  ok('a comma in a real journal title is fine', r.status === 200, 'got ' + r.status);
  qi = upParam(searchCalls()[0], 'qInclude');
  ok('and reaches the index whole', /facet_jtitle,exact,The Lancet, Neurology/.test(qi), qi);

  reset();
  upstream({ body: oneDoc() });
  await call('/api/articles?q=x&sort=newest');
  ok('newest-first is capped at this year',
    upParam(searchCalls()[0], 'qInclude').includes('[* TO ' + nowYear + ']'),
    upParam(searchCalls()[0], 'qInclude'));
  reset();
  upstream({ body: oneDoc() });
  await call('/api/articles?q=x&sort=oldest');
  ok('oldest-first starts at 1900',
    upParam(searchCalls()[0], 'qInclude').includes('[1900 TO *]'),
    upParam(searchCalls()[0], 'qInclude'));

  // The bound a sort supplies must never argue with the one a reader asked for.
  reset();
  upstream({ body: oneDoc() });
  r = await call('/api/articles?q=x&sort=oldest&to=1800');
  body = await r.json();
  ok('an implicit floor never rises above an explicit ceiling',
    !/\[1900 TO 1800\]/.test(upParam(searchCalls()[0], 'qInclude') || ''),
    upParam(searchCalls()[0], 'qInclude'));
  eq('and the reported range is the one asked for', body.applied.to, 1800);
  reset();
  upstream({ body: oneDoc() });
  r = await call('/api/articles?q=x&sort=newest&from=' + (nowYear + 1));
  ok('an implicit ceiling never falls below an explicit floor',
    !new RegExp('\\[' + (nowYear + 1) + ' TO ' + nowYear + '\\]').test(upParam(searchCalls()[0], 'qInclude') || ''),
    upParam(searchCalls()[0], 'qInclude'));

  reset();
  upstream({ body: oneDoc() });
  r = await call('/api/articles?q=x&type=reviews&sort=newest&lang=fre&peer=yes&from=2000&to=2010');
  body = await r.json();
  eq('the applied block reports what was applied',
    [body.applied.type, body.applied.sort, body.applied.lang, body.applied.peer, body.applied.from, body.applied.to],
    ['reviews', 'newest', 'fre', true, 2000, 2010]);

  /* ================= 5. the retry ladder ================= */
  section('the retry ladder');

  reset();
  upstream({ body: oneDoc() });
  r = await call('/api/articles?q=x');
  ok('a good answer is asked for once', searchCalls().length === 1, searchCalls().length + ' calls');
  ok('and nothing is slept off', sleeps.length === 0);

  reset();
  upstream({ status: 503 }, { body: oneDoc() });
  r = await call('/api/articles?q=x');
  ok('a 503 is retried', searchCalls().length === 2 && r.status === 200, searchCalls().length + ' calls, ' + r.status);
  ok('after a pause', sleeps.includes(400), JSON.stringify(sleeps));

  reset();
  upstream({ status: 503 }, { status: 500 });
  r = await call('/api/articles?q=x');
  await envelope('two 5xx', r, { status: 502 });
  eq('the second failure is reported', (await r.json()).error, 'the article index returned HTTP 500');

  reset();
  upstream({ throw: 'boom' }, { body: oneDoc() });
  r = await call('/api/articles?q=x');
  ok('a thrown request is retried', r.status === 200, 'got ' + r.status);

  reset();
  upstream({ throw: 'boom' });
  r = await call('/api/articles?q=x');
  await envelope('both requests threw', r, { status: 502 });
  eq('an unreachable index says so', (await r.json()).error, 'could not reach the article index');

  reset();
  upstream({ status: 404 });
  r = await call('/api/articles?q=x');
  ok('a 4xx is not retried', searchCalls().length === 1, searchCalls().length + ' calls');
  ok('and is reported as a bad gateway', r.status === 502);

  reset();
  upstream({ body: 'not json at all' });
  r = await call('/api/articles?q=x');
  eq('an unreadable answer says so', (await r.json()).error, 'the article index sent a response we could not read');

  /* ================= 6. caching ================= */
  section('caching');

  reset();
  upstream({ body: oneDoc() });
  r = await call('/api/articles?q=aspirin');
  body = await r.json();
  ok('a miss is not labelled a hit', body.cached === undefined);
  await settle();
  ok('a good answer is stored once', cache.store.size === 1, cache.store.size + ' entries');
  net.calls.length = 0;
  r = await call('/api/articles?q=aspirin');
  body = await r.json();
  ok('the same question costs the upstream nothing', net.calls.length === 0, net.calls.length + ' calls');
  ok('and says it was already answered', body.cached === true);
  eq('with the same records', body.docs.length, 1);

  reset();
  upstream({ body: oneDoc() });
  for (const qs of ['q=a', 'q=b', 'q=a&sort=newest', 'q=a&offset=10', 'q=a&limit=15', 'q=a&beyond=yes', 'q=a&lang=fre']) {
    await call('/api/articles?' + qs);
    await settle();
  }
  ok('every parameter that changes the answer changes the key', cache.store.size === 7,
    cache.store.size + ' entries');

  reset();
  upstream({ status: 500 });
  await call('/api/articles?q=x');
  await settle();
  ok('a failure is never stored', cache.store.size === 0, cache.store.size + ' entries');

  reset();
  upstream({ body: JSON.stringify({ did_u_mean: 'aspirin' }) });
  r = await call('/api/suggest?q=asprin');
  await envelope('/api/suggest', r, { status: 200 });
  body = await r.json();
  eq('a suggestion comes back', body.suggest, 'aspirin');
  eq('with the question that was asked', body.q, 'asprin');
  await settle();
  ok('the spelling cache is keyed on the folded phrase',
    [...cache.store.keys()][0] === 'https://shelfmark.internal/suggest-v1?q=asprin',
    [...cache.store.keys()][0]);
  ok('and kept for a day', /max-age=86400/.test(cache.puts[0].headers['cache-control'] || ''),
    JSON.stringify(cache.puts[0].headers));
  net.calls.length = 0;
  r = await call('/api/suggest?q=ASPRIN');
  body = await r.json();
  ok('the same typo in any casing costs nothing', net.calls.length === 0);
  ok('a spelling hit is still kept for a day', /max-age=86400/.test(r.headers.get('Cache-Control')),
    r.headers.get('Cache-Control'));
  eq('and answers the question that was asked', body.q, 'ASPRIN');

  reset();
  r = await call('/api/suggest');
  eq('/api/suggest needs a phrase', (await r.json()).error, 'q is required');
  r = await call('/api/suggest?q=' + 'a'.repeat(301));
  eq('/api/suggest has the same ceiling', (await r.json()).error, 'q is too long');

  // A minute of upstream trouble must not pin "no suggestion" for a day.
  reset();
  upstream({ throw: 'boom' });
  r = await call('/api/suggest?q=asprin');
  ok('a failed lookup still answers', r.status === 200, 'got ' + r.status);
  eq('with no suggestion', (await r.json()).suggest, '');
  await settle();
  ok('and is not stored', cache.store.size === 0, cache.store.size + ' entries');

  reset();
  upstream({ body: JSON.stringify({}) });
  r = await call('/api/suggest?q=aspirin');
  await settle();
  ok('a genuine "nothing to correct" is stored', cache.store.size === 1, cache.store.size + ' entries');

  /* ================= 7. the spelling fallback ================= */
  section('the spelling fallback');

  reset();
  upstream({ body: noDocs }, { body: JSON.stringify({ did_u_mean: 'aspirin' }) });
  r = await call('/api/articles?q=asprin');
  body = await r.json();
  eq('an empty result asks once more, unfiltered', suggestCalls().length, 1);
  ok('the second ask carries no filters', !/qInclude/.test(suggestCalls()[0].url));
  eq('and the correction is handed back', body.suggest, 'aspirin');

  reset();
  upstream({ body: JSON.stringify({ info: { total: 0 }, docs: [], did_u_mean: 'aspirin' }) });
  r = await call('/api/articles?q=asprin');
  eq('a correction already in hand is not asked for twice', suggestCalls().length, 0);
  eq('and is still repaired', (await r.json()).suggest, 'aspirin');

  reset();
  upstream({ body: oneDoc() });
  await call('/api/articles?q=aspirin');
  eq('a result set that is not empty asks nothing extra', suggestCalls().length, 0);

  // Thousands of matches with no printable title is not a spelling problem.
  reset();
  upstream({ body: JSON.stringify({ info: { total: 5000 }, docs: [{ pnx: { display: {} } }] }) });
  await call('/api/articles?q=aspirin');
  eq('a full index is never asked to spell-check itself', suggestCalls().length, 0);

  /* ================= 8. the helpers ================= */
  section('the helpers');

  eq('an empty record still has every field',
    Object.keys(H.slim({})).sort(),
    ['access', 'authors', 'date', 'doi', 'issn', 'issue', 'jtitle', 'link', 'oa', 'pages', 'source', 'title', 'type', 'volume'].sort());
  eq('an empty record has no title', H.slim({}).title, '');
  eq('an empty record has no link', H.slim({}).link, '');

  const withTitle = t => H.slim({ pnx: { display: { title: [t] } } }).title;
  eq('a title variant that only starts another is dropped',
    withTitle('Deep brain / Deep brain stimulation'), 'Deep brain stimulation');
  eq('an exact repeat is dropped', withTitle('X / X'), 'X');
  eq('a slash that means something is kept', withTitle('Cats / Dogs'), 'Cats / Dogs');

  const access = (avail, cats) => H.slim({ delivery: { availability: avail, deliveryCategory: cats } }).access;
  eq('no full text reads as none', access(['no_fulltext']), 'none');
  eq('a publisher link reads as a link', access(['fulltext_linktorsrc']), 'link');
  eq('full text reads as full', access(['fulltext']), 'full');
  eq('a physical copy reads as print', access([], ['Alma-P']), 'print');
  eq('nothing at all reads as nothing', access([]), '');
  // A merged record carrying one deliverable copy and one that is not is deliverable.
  eq('one readable copy beats one that is not', access(['no_fulltext', 'fulltext']), 'full');
  eq('order does not decide it', access(['fulltext', 'no_fulltext']), 'full');
  eq('a print copy beats no copy', access(['no_fulltext'], ['Alma-P']), 'print');

  const ctxOf = id => H.slim({ pnx: { control: { recordid: [id] }, display: { title: ['t'] } } }).link;
  ok('a central record links to the central context', /context=PC/.test(ctxOf('cdi_abc')));
  ok('a local record links to the local context', /context=L/.test(ctxOf('alma991')));
  ok('a record id is encoded into the link', /%2F/.test(ctxOf('cdi_a/b')), ctxOf('cdi_a/b'));

  eq('authors fall back to contributors',
    H.slim({ pnx: { display: { contributor: ['Doe, Jane'] } } }).authors, ['Doe, Jane']);
  eq('a joined author string is split back apart',
    H.names(['Smith, John ; Doe, Jane']), ['Smith, John', 'Doe, Jane']);
  eq('the same name twice is one name', H.names(['Smith, J', 'smith, j']), ['Smith, J']);
  eq('a trailing separator is not part of a name', H.names(['Smith, John,']), ['Smith, John']);
  eq('a missing name is not an author called null', H.names([null, undefined, '', 'Real Name']), ['Real Name']);

  const oaOf = v => H.slim({ pnx: { addata: { oa: [v] } } }).oa;
  eq('an open access flag is open access', oaOf('free_for_read'), true);
  eq('the word false is not open access', oaOf('false'), false);
  eq('and neither is zero', oaOf('0'), false);
  eq('the facet also says so',
    H.slim({ pnx: { facets: { toplevel: ['open_access'] } } }).oa, true);

  eq('two records with one DOI are one record',
    H.dedupe([{ doi: '10.1/A', title: 'x' }, { doi: '10.1/a', title: 'y' }]).length, 1);
  eq('without a DOI, title and year decide',
    H.dedupe([{ title: 'A Paper', date: '2020' }, { title: 'a  paper!', date: '2020-05' }]).length, 1);
  eq('a different year is a different record',
    H.dedupe([{ title: 'A', date: '2020' }, { title: 'A', date: '2021' }]).length, 2);
  eq('nothing dedupes to nothing', H.dedupe([]), []);

  eq('an acronym keeps its spelling', H.repair('parkisons tFUS', 'parkinsons thus'), 'parkinsons tFUS');
  eq('a correction that changes only an acronym is not offered', H.repair('tFUS', 'thus'), '');
  eq('a correction identical to the query is not offered', H.repair('aspirin', 'Aspirin'), '');
  eq('nothing to correct is nothing', H.repair('aspirin', ''), '');
  eq('a suggestion that is not a string is not offered', H.repair('aspirin', null), '');
  eq('a differently sized suggestion is taken whole', H.repair('a b', 'x y z'), 'x y z');

  eq('no year is absent, not invalid', H.year('', 2026), null);
  ok('a word is not a year', Number.isNaN(H.year('abcd', 2026)));
  ok('a year before printing is not a year', Number.isNaN(H.year('1499', 2026)));
  ok('next year is a year', H.year('2027', 2026) === 2027);
  ok('the year after next is not', Number.isNaN(H.year('2028', 2026)));
  eq('surrounding space is not part of a year', H.year(' 2020 ', 2026), 2020);

  /* ================= 9. the A-Z list ================= */
  section('the A-Z list');

  // Shaped like the live widget: tracked record anchors, a key icon for licensed entries, a
  // featured badge for best bets, and an info div that the widget always leaves empty.
  const rec = (url, name, opts) =>
    '<li><a href="' + url + '" target="_blank" onclick="return springSpace.springTrack.trackLink({link: this});">' + name + '</a>' +
    '<div class="s-lg-icons pad-left-sm"><ul><li><a href="http://www.library.ucla.edu/service/campus-access">' +
    ((opts && opts.auth) ? '<img loading="lazy" alt="Requires UCLA authentication" class="s-lg-icon" src="//x/key.gif"/>' : '') +
    '</a></li></ul></div>' +
    ((opts && opts.best) ? ' <span class="s-lg-az-result-badge-featured label label-success">Best Bet</span> ' : '') +
    '<div class="s-lg-guide-list-info"></div>';
  const AZDOC = '<ul>' + [
    rec('https://b.example/', 'Beta &amp; Sons', { auth: true }),
    rec('http://a.example/', 'Alpha Index', { best: true }),
    rec('https://c.example/', '<em>Gamma</em> Files', {}),
    rec('https://dupe.example/', 'Alpha Index', {}),
    rec('javascript:alert(1)', 'Evil Database', {}),
    rec('https://long.example/', 'L'.repeat(200), {}),
  ].join('') + '</ul>';

  let items = H.parseAZ(AZDOC);
  const at = (i, k) => (items[i] || {})[k];
  eq('every record is found, once', items.map(i => i.name), ['Alpha Index', 'Beta & Sons', 'Gamma Files']);
  eq('the list is alphabetical', at(0, 'name'), 'Alpha Index');
  eq('an entity in a name is decoded', at(1, 'name'), 'Beta & Sons');
  eq('markup in a name is stripped', at(2, 'name'), 'Gamma Files');
  eq('a licensed entry is marked', at(1, 'auth'), true);
  eq('an open entry is not', at(0, 'auth'), false);
  eq('a best bet is marked', at(0, 'best'), true);
  eq('a plain entry is not', at(1, 'best'), false);
  eq('a link that is not the web is dropped', items.filter(i => /^javascript:/.test(i.url)).length, 0);
  eq('a name longer than a name is dropped', items.filter(i => i.name.length > 160).length, 0);
  eq('plain http is still the web', at(0, 'url'), 'http://a.example/');
  eq('nothing parses to nothing', H.parseAZ(''), []);
  eq('markup with no records parses to nothing', H.parseAZ('<div>hello</div>'), []);

  // The widget escapes its payload as JSON, so the parser has to unescape before it reads.
  const ESCAPED = AZDOC.replace(/"/g, '\\"').replace(/\//g, '\\/');
  eq('an escaped payload reads the same', H.parseAZ(ESCAPED).map(i => i.name), items.map(i => i.name));

  reset();
  upstream({ body: AZDOC, ct: 'text/javascript' });
  r = await call('/api/databases');
  await envelope('/api/databases', r, { status: 200 });
  body = await r.json();
  eq('the count is the number of entries', body.count, 3);
  eq('the licensed count is the number that need a login', body.licensed, 1);
  ok('the list comes back', Array.isArray(body.items) && body.items.length === 3);
  ok('and is kept for a day', /max-age=86400/.test(r.headers.get('Cache-Control')), r.headers.get('Cache-Control'));
  await settle();
  net.calls.length = 0;
  r = await call('/api/databases');
  ok('a second reader costs LibGuides nothing', net.calls.length === 0);
  ok('and is told the truth about how long it keeps',
    /max-age=86400/.test(r.headers.get('Cache-Control')), r.headers.get('Cache-Control'));
  ok('a cached list says so', (await r.json()).cached === true);

  reset();
  upstream({ throw: 'boom' });
  r = await call('/api/databases');
  await envelope('unreachable LibGuides', r, { status: 502 });
  eq('an unreachable list says so', (await r.json()).error, 'could not reach the database list');

  reset();
  upstream({ status: 500 });
  r = await call('/api/databases');
  ok('a failing list is a bad gateway', r.status === 502);
  ok('and is not retried', net.calls.length === 1, net.calls.length + ' calls');

  reset();
  upstream({ body: '<div>the widget changed shape</div>' });
  r = await call('/api/databases');
  eq('a list that parses to nothing is an error, not an empty list',
    (await r.json()).error, 'the database list could not be read');

  /* ================= 10. nothing escapes without an envelope ================= */
  section('nothing escapes without an envelope');

  reset();
  cache.throwOn('match');
  upstream({ body: oneDoc() });
  r = await call('/api/articles?q=x');
  await envelope('the cache threw on read', r, { status: 500 });

  reset();
  cache.throwOn('put');
  upstream({ body: oneDoc() });
  r = await call('/api/articles?q=x');
  ok('a cache that will not be written to does not fail the search', r.status === 200, 'got ' + r.status);

  reset();
  cache.throwOn('match');
  r = await call('/api/databases');
  await envelope('the A-Z cache threw', r, { status: 500 });

  reset();
  cache.throwOn('match');
  r = await call('/api/suggest?q=x');
  await envelope('the spelling cache threw', r, { status: 500 });

  // The one upstream read that was never guarded the way the others are.
  reset();
  upstream({ raw: { ok: true, status: 200, text: () => Promise.reject(new Error('stream died')) } });
  r = await call('/api/databases');
  await envelope('the A-Z body would not read', r, { status: 502 });

  reset();
  r = await call('/some-page', 'GET', envBroken);
  await envelope('the assets binding threw', r, { status: 500 });

  console.log(`\n${pass} passed, ${failures.length} failed`);
  failures.forEach(f => console.log('  FAIL ' + f));
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
