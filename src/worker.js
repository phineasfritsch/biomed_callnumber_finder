/* The only server this project has, and it exists for one reason.
 *
 * Everything else Shelfmark uses is keyless and CORS-open, so the browser calls it directly:
 * Alma SRU for the catalog, Alma's OpenURL resolver for full-text access, LibCal for hours.
 * Primo's PNX endpoint is the exception. It answers without a key, but it sends no
 * `Access-Control-Allow-Origin`, so a page cannot call it. It is also the only endpoint that
 * searches the article index at all — SRU indexes UCLA's own holdings and nothing else.
 *
 * So: three routes, narrow on purpose, all GET. Everything else goes to the static assets.
 *
 *   - `/api/articles` searches the article index.
 *   - `/api/suggest` returns Primo's spelling correction for a phrase and nothing else. The
 *     catalog side of the app is SRU, which has no dictionary, so this is where a misspelt book
 *     title gets an answer.
 *   - `/api/databases` parses the A-Z list out of the LibGuides widget.
 *   - Only the parameters below reach Primo, with fixed values for the ones that identify the
 *     institution. This is not an open proxy and cannot be pointed anywhere else.
 *   - Responses are cached at the edge, so repeated searches cost Primo nothing.
 *   - The 17 KB PNX payload is reduced here to the ~2 KB the interface actually renders. Less
 *     to send, and the browser never handles the raw internal record.
 */

const PNX = 'https://search.library.ucla.edu/primaws/rest/pub/pnxs';
const VID = '01UCS_LAL:UCLA';
const INST = '01UCS_LAL';
const TTL = 600;                       // seconds; article metadata does not move
const MAX_LIMIT = 20;
/* Deep paging is a way to spend an upstream's time for nothing: the page shows ten rows at a
   time, so a hundred pages is already further than anyone goes, and past that the request is a
   crawler or a mistake. */
const MAX_OFFSET = 1000;
/* Neither upstream promises to answer, and a request with nobody left waiting on it still holds
   a subrequest slot. Eight seconds is longer than either has ever taken and shorter than a
   reader will sit in front of a spinner. */
const DEADLINE = 8000;

const first = v => (Array.isArray(v) ? v[0] : v) || '';
const list = v => (Array.isArray(v) ? v : v ? [v] : []);
/* An allowlist is a plain object, and a plain object answers for everything it inherits:
   `FIELDS['constructor']` is a function, which is truthy, which is a validation that passes.
   `?sort=constructor` reached Primo as `sort=function Object() { [native code] }`. */
const allowed = (table, k) => Object.prototype.hasOwnProperty.call(table, k);

/* Primo's `q` is `field,operator,value`, and a fourth comma-separated token is a boolean that
   joins the next clause. So a comma a reader typed is a clause a reader did not ask for:
   verified 2026-08-10, `aspirin,AND,title,contains,zzzzqqq` returns 0 where `aspirin` alone
   returns millions. A comma carries no search meaning here — `smith, john` and `smith john`
   both return 395,471 — so it becomes a space and the grammar stays ours. */
const phrase = s => s.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

/* Primo writes its booleans as strings, and every non-empty string is truthy, so `oa: "false"`
   read as open access. */
function flag(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  return !!s && s !== 'false' && s !== '0' && s !== 'no';
}

// One name per entry, whichever way the record arrived, with the repeats a merged record carries.
function names(vals) {
  const seen = new Set(), out = [];
  for (const v of vals) {
    if (v === null || v === undefined) continue;   // an absent author is not an author called "null"
    for (const part of String(v).split(/\s*;\s*/)) {
      const n = part.trim().replace(/[,;]+$/, '');
      const k = n.toLowerCase();
      if (!n || seen.has(k)) continue;
      seen.add(k);
      out.push(n);
    }
  }
  return out;
}

/* One PNX doc reduced to what a result row needs. Nothing here is personal: it is
   bibliographic metadata about published articles. */
function slim(doc) {
  const pnx = doc.pnx || {};
  const d = pnx.display || {}, a = pnx.addata || {}, f = pnx.facets || {};
  /* `delivery.link` is empty in a search response — Primo resolves links lazily, per record,
     on the full-display page. Rather than issue a second request per result, link to the
     record itself. `cdi_` prefixed ids come from the central index (context PC); everything
     else is a local holding (context L). */
  const c = pnx.control || {};
  /* The one thing a result row has to answer is whether the reader can get it, and Primo says
     so in `delivery.availability`. Probed 2026-08-10 across four queries, 60 records:
     `fulltext` for everything UCLA licenses or hosts, `fulltext_linktorsrc` where the link goes
     straight to the publisher, `no_fulltext` only when the search is expanded past the
     holdings. Peer review and open access are facts about the paper, not about whether it can
     be read here, so they do not belong in the same place. */
  const dl = doc.delivery || {};
  const avail = list(dl.availability).map(x => String(x).toLowerCase());
  const cats = list(dl.deliveryCategory).map(x => String(x).toLowerCase());
  /* `no_fulltext` contains `fulltext`, so a positive has to be read as "says full text, and is
     not the negative". Reading the negative first was wrong for merged records: one that carries
     both — a copy UCLA licenses and one it does not — was reported unreachable when the reader
     could in fact read it. Positives first, then a physical copy, and only then nothing. */
  const yes = re => avail.some(x => re.test(x) && !/no_fulltext/.test(x));
  const access = yes(/linktorsrc/) ? 'link'
    : yes(/fulltext/) ? 'full'
    : cats.some(x => /alma-p/.test(x)) || avail.some(x => /available_in_library|physical/.test(x)) ? 'print'
    : avail.some(x => /no_fulltext/.test(x)) ? 'none'
    : '';
  const recordid = first(c.recordid);
  const context = /^cdi_/.test(recordid) ? 'PC' : 'L';
  const permalink = recordid
    ? 'https://search.library.ucla.edu/discovery/fulldisplay?docid=' + encodeURIComponent(recordid) +
      '&context=' + context + '&vid=' + VID
    : '';
  /* Primo joins a record's title variants with a slash, and for the JAMA reply above that
     printed the same sentence three times before the part that differed. Exact repeats are
     dropped; anything that actually differs is kept, because a slash in a title is ordinary.
     A variant that is only the start of another is dropped too: JAMA's reply came back as the
     article title, then the same title again with "-Reply" on the end, and the shorter one adds
     nothing except length. */
  const title = String(first(d.title)).split('/').filter((p, i, all) => {
    const k = p.trim().toLowerCase();
    if (!k) return false;
    return !all.some((x, j) => {
      const o = x.trim().toLowerCase();
      return o !== k ? o.startsWith(k) : j < i;      // a longer variant, or an earlier identical one
    });
  }).join('/').trim();
  return {
    title: title,
    /* Primo is inconsistent about this: sometimes one author per entry, sometimes forty authors
       in a single string joined with " ; ". A page that trusts the array length shows either
       three names or a five-line wall of them depending on the record, so the joined form is
       split back apart here and the array always means what it says. */
    authors: names(list(d.creator).length ? list(d.creator) : list(d.contributor)),
    jtitle: first(a.jtitle) || first(d.ispartof),
    volume: first(a.volume),
    issue: first(a.issue),
    pages: first(a.pages),
    date: first(a.date) || first(d.creationdate),
    doi: first(a.doi),
    issn: first(a.issn) || first(a.eissn),
    type: first(d.type),
    source: first(d.source),
    access: access,
    // Open access is kept because it *is* an access fact: it is the copy that still opens
    // from a coffee shop, with no VPN and no proxy.
    oa: list(f.toplevel).some(x => /open_?access/i.test(x)) || flag(first(a.oa)),
    link: permalink,
  };
}

/* The same paper twice is one paper. Primo's central index already merges most duplicates, so
   this catches the rest: identical DOI, or identical title and year where a DOI is missing.
   Cheap, and the alternative is two cards that open the same article. */
function dedupe(docs) {
  const seen = new Set(), out = [];
  for (const d of docs) {
    const key = d.doi
      ? 'doi:' + String(d.doi).toLowerCase()
      : 'tt:' + String(d.title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() +
        '|' + String(d.date || '').slice(0, 4);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}

/* What this index will and will not narrow on. Probed 2026-08-10 against the live endpoint,
   and written down because every failure here is a silent one — a filter Primo does not
   understand returns a full, plausible, unfiltered result set.

     - `facet_rtype`, `facet_tlevel`, `facet_lang` and `facet_jtitle` all narrow both halves of
       the search, local holdings and the central index alike.
     - Dates only work in Lucene bracket form. `facet_searchcreationdate,include,2020|,|2026` —
       the syntax Primo's own facet links use — drops the central index entirely
       (`totalResultsPC` comes back as -1), which on an article search means dropping
       everything: 0 results once `facet_rtype,exact,articles` is also on. The bracket form
       `include,[2020 TO 2026]` filters both halves, and takes `*` for an open end.
     - `facet_creator` is local-only: an author with 1,162 central hits faceted down to 5 local
       books and nothing else. So filtering by author has to be a query field, not a facet,
       which is also why author cannot be combined with a topic — see FIELDS below.
     - `mfacet`, `facet`, `dr_s`/`dr_e` are accepted and ignored. `sort` understands date_d,
       date_a, title and author; the plausible spellings it does not know (date, scdate,
       dateOld, sortby=) silently mean rank.
     - Responses carry no facet value lists, so there is nothing to build a menu of journals or
       authors from. The journal filter is offered from a result row instead, where the exact
       string the index uses is already in hand — "The Lancet" matches 26 records and "lancet"
       matches none, so a typed guess would mostly be a wrong answer with no error.
*/
const FIELDS = { any: 1, title: 1, creator: 1, sub: 1 };
const TYPES = {
  articles: 1, reviews: 1, books: 1, book_chapters: 1,
  dissertations: 1, conference_proceedings: 1, newspaper_articles: 1,
};
// The page's words on the left, Primo's on the right. Only these five sorts do anything.
const SORTS = { rank: 'rank', newest: 'date_d', oldest: 'date_a', title: 'title', author: 'author' };
const LANGS = {
  eng: 1, spa: 1, chi: 1, fre: 1, ger: 1, jpn: 1, kor: 1,
  por: 1, rus: 1, ita: 1, ara: 1, heb: 1, dut: 1, pol: 1,
};

const YEAR_FLOOR = 1500;

/* A misspelling gets nothing here and says nothing about why: the index ANDs every word and does
 * not correct anything, so one wrong letter in one word returns a confident zero. `parkisons tFUS`
 * was the report — 0 results, while `parkinsons tFUS` finds 14.
 *
 * Primo does know. A query it thinks has misfired comes back with a top-level `did_u_mean`, absent
 * otherwise. What it hands back cannot be offered as-is, though, because its corrector treats an
 * acronym as a misspelt word: `parkisons tFUS` suggests `parkinsons thus`, which is not what anyone
 * meant and finds the wrong papers. So the correction is applied word by word, and any word
 * carrying a capital letter after the first — tFUS, mRNA, pH, CRISPR — keeps the spelling it was
 * given. That turns "parkinsons thus" into "parkinsons tFUS", which is the search that was wanted.
 *
 * Returns '' when there is nothing worth offering, including when the only thing Primo wanted to
 * change was an acronym it should have left alone.
 */
function repair(q, raw) {
  const sug = String(raw || '').trim();
  if (!sug) return '';
  const words = q.split(/\s+/), sugWords = sug.split(/\s+/);
  const merged = sugWords.length === words.length
    ? sugWords.map((s, i) => (/[A-Z]/.test(words[i].slice(1)) ? words[i] : s)).join(' ')
    : sug;
  return merged.toLowerCase() === q.toLowerCase() ? '' : merged;
}

/* A year, or nothing. Nonsense is refused rather than dropped: `[abcd TO 2026]` is a range the
   index accepts and then ignores, so a typo would otherwise come back as an unfiltered search
   wearing a filter's label. */
function year(raw, nowYear) {
  const v = (raw || '').trim();
  if (!v) return null;
  if (!/^\d{4}$/.test(v)) return NaN;
  const n = parseInt(v, 10);
  return n >= YEAR_FLOOR && n <= nowYear + 1 ? n : NaN;
}

/* Ask Primo how a phrase is spelled, and nothing else.
 *
 * `did_u_mean` rides on an ordinary search response, so this is a search asking for one row and
 * throwing the row away. Cheap, and the only way to get the answer: it appears on the bare query
 * and disappears under any `qInclude`.
 *
 * Its own cache, and a generous one. A spelling correction is a property of Primo's dictionary
 * rather than of the collection, so it does not go stale the way a result count does, and the
 * callers are the searches that just failed — the same typo arriving twice should cost nothing.
 */
const SUGGEST_TTL = 86400;

/* Returns the correction, `''` when there is nothing to correct, and `null` when the question
   could not be asked. The caller needs the difference: `''` is an answer worth keeping for a
   day, and `null` is an outage that must not be. */
async function didUMean(q) {
  const up = new URL(PNX);
  up.searchParams.set('q', 'any,contains,' + q);
  up.searchParams.set('vid', VID);
  up.searchParams.set('inst', INST);
  up.searchParams.set('scope', 'MyInst_and_CI');
  up.searchParams.set('tab', 'LibraryCatalog');
  up.searchParams.set('lang', 'en');
  up.searchParams.set('limit', '1');
  up.searchParams.set('offset', '0');
  try {
    const res = await fetch(up.toString(), {
      signal: AbortSignal.timeout(DEADLINE),
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://search.library.ucla.edu/discovery/search?vid=' + VID,
        'User-Agent': 'Shelfmark/1.0 (UCLA library tool; +https://shelfmark.phineasfritsch.com)',
      },
    });
    if (!res.ok) return null;
    return repair(q, (await res.json()).did_u_mean);
  } catch (e) {
    return null;      // a suggestion is a courtesy; failing to get one is not an error
  }
}

/* The spelling route, for the catalog side of the app.
 *
 * The catalog is Alma SRU, which has no dictionary and no suggestions: a misspelt title returns
 * zero records and says nothing about why. It recovers by probing itself — the repair ladder in
 * the page — which works but costs several requests and only ever fixes one broken word. Primo's
 * dictionary is one request and knows about the words SRU can only guess at, so the page asks
 * here first and spends catalog requests only if this comes back empty.
 */
async function suggest(request, url, ctx) {
  const asked = (url.searchParams.get('q') || '').trim();
  if (!asked) return json({ error: 'q is required' }, 400);
  if (asked.length > 300) return json({ error: 'q is too long' }, 400);
  const q = phrase(asked);

  const key = new Request('https://shelfmark.internal/suggest-v1?q=' + encodeURIComponent(q.toLowerCase()), { method: 'GET' });
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) {
    const body = await hit.json();
    // The key is folded, the answer is not: echo the phrase this reader asked about, not the
    // casing of whoever asked first.
    return json(Object.assign({ cached: true }, body, { q: asked }), 200, SUGGEST_TTL);
  }

  const found = await didUMean(q);
  const out = { q: asked, suggest: found || '' };
  /* Only a real answer is worth a day. Storing the empty string that a failed lookup returns
     pinned "no suggestion" for twenty-four hours on exactly the searches that had just failed
     and most needed one. */
  if (found !== null) {
    ctx.waitUntil(cache.put(key, new Response(JSON.stringify(out), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=' + SUGGEST_TTL },
    })));
  }
  return json(out, 200, SUGGEST_TTL);
}

async function articles(request, url, ctx) {
  const p = url.searchParams;
  const asked = (p.get('q') || '').trim();
  if (!asked) return json({ error: 'q is required' }, 400);
  if (asked.length > 300) return json({ error: 'q is too long' }, 400);
  const q = phrase(asked);
  if (!q) return json({ error: 'q is required' }, 400);

  /* Both ends, not just the top. `Math.min(-5, 20)` is -5, which asked the index for zero rows
     and then ran `docs.slice(0, -5)`, which takes rows off the *end* — an empty list, HTTP 200,
     and nothing anywhere saying why. */
  const limitNum = parseInt(p.get('limit'), 10);
  const limit = Number.isFinite(limitNum) ? Math.min(Math.max(limitNum, 1), MAX_LIMIT) : 10;

  const offsetRaw = (p.get('offset') || '').trim();
  if (offsetRaw && !/^-?\d+$/.test(offsetRaw)) return json({ error: 'offset must be a whole number' }, 400);
  const offset = Math.max(parseInt(offsetRaw || '0', 10), 0);
  if (offset > MAX_OFFSET) return json({ error: 'offset cannot be past ' + MAX_OFFSET }, 400);

  const field = p.get('field') || 'any';
  if (!allowed(FIELDS, field)) return json({ error: 'unknown field: ' + field }, 400);

  // `articlesOnly=no` was the old spelling of "search everything"; it still means that.
  const type = p.get('type') || (p.get('articlesOnly') === 'no' ? 'any' : 'articles');
  if (type !== 'any' && !allowed(TYPES, type)) return json({ error: 'unknown type: ' + type }, 400);

  const sortName = p.get('sort') || 'rank';
  if (!allowed(SORTS, sortName)) return json({ error: 'unknown sort: ' + sortName }, 400);

  const lang = p.get('lang') || '';
  if (lang && !allowed(LANGS, lang)) return json({ error: 'unknown language: ' + lang }, 400);

  const nowYear = new Date().getUTCFullYear();
  const from = year(p.get('from'), nowYear), to = year(p.get('to'), nowYear);
  if (Number.isNaN(from) || Number.isNaN(to)) {
    return json({ error: 'from and to must be four-digit years between ' + YEAR_FLOOR + ' and ' + (nowYear + 1) }, 400);
  }
  if (from && to && from > to) return json({ error: 'from is later than to' }, 400);

  const peer = p.get('peer') === 'yes';
  const oa = p.get('oa') === 'yes';
  /* Facets are joined with `|,|`, so a journal title carrying that separator would splice in
     filters nobody asked for — the one place this worker takes free text into the upstream
     query grammar. A comma is fine, because a facet's value is the rest of its token and real
     journals have commas in their names; a vertical bar is not, and no journal has one. */
  const jtitle = (p.get('jtitle') || '').trim().slice(0, 200);
  if (jtitle.includes('|')) return json({ error: 'jtitle cannot contain a vertical bar' }, 400);

  const filters = [];
  if (type !== 'any') filters.push('facet_rtype,exact,' + type);
  if (peer) filters.push('facet_tlevel,include,peer_reviewed');
  if (oa) filters.push('facet_tlevel,include,open_access');
  if (lang) filters.push('facet_lang,exact,' + lang);
  if (jtitle) filters.push('facet_jtitle,exact,' + jtitle);

  /* Sorting by date needs a bound even when the reader asked for none. Newest-first on any
     query returns a wall of records dated 2027 through 2029 — forthcoming issues and bad
     metadata, six of six on the first page — which is not what "newest" means to anyone. So
     newest-first is capped at this year unless the reader named a later one, and oldest-first
     starts at 1900 rather than at the year-zero records that sit below it.

     A bound a sort supplies must never argue with one a reader asked for, though: `oldest` with
     `to=1800` used to build `[1900 TO 1800]`, which is empty, and said "from 1900 to 1800" as
     though that were the search. An implicit bound only appears where it leaves a real range. */
  let lo = from, hi = to;
  if (!lo && sortName === 'oldest' && (!hi || hi >= 1900)) lo = 1900;
  if (!hi && sortName === 'newest' && (!lo || lo <= nowYear)) hi = nowYear;
  if (lo || hi) {
    filters.push('facet_searchcreationdate,include,[' + (lo || '*') + ' TO ' + (hi || '*') + ']');
  }

  const up = new URL(PNX);
  up.searchParams.set('q', field + ',contains,' + q);
  up.searchParams.set('vid', VID);
  up.searchParams.set('inst', INST);
  up.searchParams.set('scope', 'MyInst_and_CI');
  up.searchParams.set('tab', 'LibraryCatalog');
  up.searchParams.set('sort', SORTS[sortName]);
  up.searchParams.set('lang', 'en');
  // A few spare rows so that dropping duplicates does not hand back a short page.
  up.searchParams.set('limit', String(Math.min(limit + 5, 30)));
  up.searchParams.set('offset', String(offset));
  if (filters.length) up.searchParams.set('qInclude', filters.join('|,|'));

  /* Primo's default is holdings-only: without `pcAvailability` the central index answers with
     what UCLA can actually deliver, and nothing else. That is the right default for a tool
     whose question is "can I read this" — "crispr gene editing" returns 39,743 that way against
     48,636 expanded, and the 8,893 difference is papers a reader would click into a dead end.
     The wider search stays one request away, because sometimes knowing a paper exists is the
     point. Verified 2026-08-10. */
  const beyond = p.get('beyond') === 'yes';
  if (beyond) up.searchParams.set('pcAvailability', 'true');

  // Edge cache keyed on the upstream request, so two readers asking the same thing cost one.
  const key = new Request(up.toString(), { method: 'GET' });
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) {
    const body = await hit.json();
    return json(Object.assign({ cached: true }, body));
  }

  /* Primo returns an occasional 5xx that is gone a second later. One retry, once, with a short
     pause: enough to absorb a blip, not enough to make a bad minute worse. Two requests is the
     ceiling for one search. */
  const ask = () => fetch(up.toString(), {
    signal: AbortSignal.timeout(DEADLINE),
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://search.library.ucla.edu/discovery/search?vid=' + VID,
      // Say who this is. An unidentified client is the one nobody can ask about.
      'User-Agent': 'Shelfmark/1.0 (UCLA library tool; +https://shelfmark.phineasfritsch.com)',
    },
  });

  let res = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise(r => setTimeout(r, 400));
    try { res = await ask(); } catch (e) { res = null; }
    if (res && res.ok) break;
    if (res && res.status < 500) break;      // a 4xx is our fault and will not fix itself
  }
  if (!res) return json({ error: 'the article index did not respond' }, 502);
  if (!res.ok) return json({ error: 'the article index returned HTTP ' + res.status }, 502);

  let data;
  try { data = await res.json(); }
  catch (e) { return json({ error: 'the article index sent a response we could not read' }, 502); }

  const info = data.info || {};
  const out = {
    total: info.total || 0,
    local: info.totalResultsLocal,
    central: info.totalResultsPC,
    beyond: beyond,          // so the page can say which of the two searches it is showing
    // Only ever set when the search misfired, so the page can offer it instead of a shrug.
    suggest: repair(q, data.did_u_mean),
    /* Handed back rather than assumed. The page can be one search behind — a filter changed
       while a request was in flight — and the two date bounds are not always the ones asked
       for, because sorting by date supplies its own. A result list should be able to say what
       it is a list of. */
    applied: {
      field: field, type: type, sort: sortName, lang: lang, jtitle: jtitle,
      peer: peer, oa: oa, from: lo || null, to: hi || null,
    },
    docs: dedupe((data.docs || []).map(slim).filter(d => d.title)).slice(0, limit),
  };

  /* Primo drops `did_u_mean` the moment any `qInclude` is present, and this panel filters to
     articles by default — so the one search that needs a spelling suggestion is the one that
     never carries it. Verified 2026-08-10: `parkisons tFUS` suggests "parkinsons thus" bare and
     suggests nothing at all with `facet_rtype,exact,articles` applied.
     So an empty result asks once more, unfiltered, purely to read the correction. It costs a
     request only when the answer was nothing, which is the moment a reader is most owed
     something better than a shrug, and the reply is cached with the rest.

     A full index is not a spelling problem, though: a page of records that all lost their titles
     is still thousands of matches, so the second request is spent only when the index itself
     found nothing. */
  if (!out.docs.length && !out.suggest && !out.total) out.suggest = (await didUMean(q)) || '';

  const stored = json(out);
  ctx.waitUntil(cache.put(key, new Response(JSON.stringify(out), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=' + TTL },
  })));
  return stored;
}

/* The A-Z database list.
 *
 * LibGuides has no JSON API without a key, but the public widget carries the whole list as
 * escaped HTML inside a JS file. It is CORS-open, so a browser could fetch it — except it is
 * 1.17 MB of markup to extract about 184 KB of facts. Parsing here and caching for a day means
 * the page downloads the answer instead of the haystack, and LibGuides sees one request a day
 * rather than one per reader.
 *
 * What it does not carry is an access mode: UCLA tags one database as a trial and none as free
 * or campus-only, so this is an inventory, not an entitlement list. The free-versus-licensed
 * question is answered per provider by the OpenURL resolver's `Is_free`, not here.
 */
const AZ = 'https://lgapi-us.libapps.com/widgets.php?site_id=705&widget_type=2&output_format=1';
const AZ_TTL = 86400;
const Q = String.fromCharCode(34);

const ENTITY = { amp: '&', lt: '<', gt: '>', quot: Q, apos: "'", nbsp: ' ', '#39': "'", '#039': "'" };
function plain(s) {
  return s.replace(/<[^>]*>/g, ' ')
    .replace(/&(#0?39|amp|lt|gt|quot|apos|nbsp);/g, (m, k) => (ENTITY[k] === undefined ? m : ENTITY[k]))
    .replace(/\s+/g, ' ')
    .trim();
}

/* Every record in the widget is a tracked anchor: LibGuides wraps each database link in an
   `onclick` that reports the click back to Springshare, and nothing else in the payload carries
   one. That is what separates a database from the "Requires UCLA authentication" icon beside it,
   which is also an `<li><a href=...>` and which a looser pattern reads as a database called
   nothing, linking to a UCLA help page.
   Verified against the live widget 2026-08-10: 1,354 databases, 1,248 licensed, 337 best bets.
   The class this used to split on, `s-lg-az-result`, is no longer in the markup at all — only
   `s-lg-az-result-badge-*` survives it, so the split was landing on badges and returning 374
   fragments of the list instead of the list.
   There are no descriptions to read: all 1,365 `s-lg-guide-list-info` divs come back empty, and
   `show_descriptions=1` returns the same bytes. This is a list of names and links, and saying so
   is better than shipping a field that is always "". */
const AZ_REC = new RegExp(
  '<a href=' + Q + '([^' + Q + ']+)' + Q + '[^>]*onclick=' + Q + 'return springSpace[^>]*>([\\s\\S]{0,400}?)<\\/a>',
  'g');

function parseAZ(raw) {
  const html = raw
    .replace(/\\\//g, '/').replace(/\\"/g, Q).replace(/\\n/g, '\n').replace(/\\t/g, ' ')
    /* The payload is a JSON string, so everything outside ASCII arrives as `\uXXXX`. Without this
       a Japanese title shipped as the literal text "Kindai seishin ryōhō kirokushū
       近代...", which is not a name anyone can read or search for.
       Only code points at or above U+00A0 are decoded: below that lies the structural punctuation
       this parser is about to read — a `"` turning into a quote partway through would move
       the boundaries of the very attributes being matched. Nothing legitimate escapes ASCII that
       way here, and a surrogate pair is two escapes both above the floor, so it survives. */
    .replace(/\\u([0-9a-fA-F]{4})/g, (m, hex) => {
      const c = parseInt(hex, 16);
      return c >= 0xA0 ? String.fromCharCode(c) : m;
    });
  const hits = [];
  let m;
  AZ_REC.lastIndex = 0;
  while ((m = AZ_REC.exec(html))) hits.push({ url: m[1], name: m[2], end: AZ_REC.lastIndex, at: m.index });

  const out = [], seen = new Set();
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    // A record owns the markup between its own link and the next one.
    const block = html.slice(h.end, i + 1 < hits.length ? hits[i + 1].at : Math.min(html.length, h.end + 4000));
    const name = plain(h.name);
    if (!name || name.length > 160) continue;
    /* Whatever the widget puts in an href ends up in a link on our page. Only the web belongs
       there — a `javascript:` URL in someone else's markup should not become a link we drew. */
    const link = h.url.trim();
    if (!/^https?:\/\//i.test(link)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    /* The access mode is not a field, it is an icon: entries UCLA licenses carry a key image
       with alt="Requires UCLA authentication". Everything without one is reachable by anybody,
       which is the free-versus-campus-only distinction the A-Z page itself draws. */
    out.push({
      name: name,
      url: link,
      auth: /alt="Requires UCLA authentication"/i.test(block),
      best: /s-lg-az-result-badge-featured/.test(block),
    });
  }
  return out.sort((x, y) => x.name.localeCompare(y.name, 'en'));
}

async function databases(request, url, ctx) {
  /* The version in this key is what the version is for. The entry is kept for a day, so a fix to
     how the list is parsed does not reach anybody until the old body expires — bumping the key
     retires it now. Last bumped when \uXXXX escapes stopped being left in the names. */
  const key = new Request('https://shelfmark.internal/az-v2', { method: 'GET' });
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) {
    const body = await hit.json();
    return json(Object.assign({ cached: true }, body), 200, AZ_TTL);
  }
  let res;
  try {
    res = await fetch(AZ, {
      signal: AbortSignal.timeout(DEADLINE),
      headers: { 'User-Agent': 'Shelfmark/1.0 (UCLA library tool)' },
    });
  } catch (e) { return json({ error: 'the database list did not respond' }, 502); }
  if (!res.ok) return json({ error: 'the database list returned HTTP ' + res.status }, 502);

  let raw;
  try { raw = await res.text(); }
  catch (e) { return json({ error: 'the database list could not be read' }, 502); }
  const items = parseAZ(raw);
  if (!items.length) return json({ error: 'the database list could not be read' }, 502);
  const out = { count: items.length, licensed: items.filter(i => i.auth).length, items: items };
  ctx.waitUntil(cache.put(key, new Response(JSON.stringify(out), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=' + AZ_TTL },
  })));
  return json(out, 200, AZ_TTL);
}

const ALLOW = 'GET, HEAD, OPTIONS';

function json(body, status, ttl, extra) {
  const code = status || 200;
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    /* Only a good answer is worth keeping. Caching the failures too meant one transient 522
       from Primo was stored by the browser for ten minutes, so the panel kept reporting an
       outage that had already ended and no retry could get past it. */
    'Cache-Control': code === 200 ? 'public, max-age=' + (ttl || TTL) : 'no-store',
    'Access-Control-Allow-Origin': '*',
  };
  if (extra) Object.assign(headers, extra);
  return new Response(JSON.stringify(body), { status: code, headers: headers });
}

/* These answers are open to anyone, so the preflight has to say so in the words a browser reads.
   Answering it with the same 405 as a POST meant `Access-Control-Allow-Origin: *` was an
   invitation nothing could take up: any request with a header on it never got past the check. */
function preflight() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': ALLOW,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/* The page is static and same-origin, so it needs none of these to work — they are here because
   a public URL gets pointed at scanners and embedded in frames by people who did not ask us. */
function guarded(res) {
  const headers = new Headers(res.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  const empty = res.status === 204 || res.status === 304;
  return new Response(empty ? null : res.body, {
    status: res.status, statusText: res.statusText, headers: headers,
  });
}

// A Map, not an object: `ROUTES['/constructor']` on an object literal is a function, and a
// truthy route is a route the worker would try to call.
const ROUTES = new Map([
  ['/api/articles', articles],
  ['/api/suggest', suggest],
  ['/api/databases', databases],
]);

export default {
  async fetch(request, env, ctx) {
    /* Nothing may leave here without the envelope. A throw from the cache, from a body that
       stops mid-read, or from the assets binding used to reach the runtime's own error page —
       HTML, no `Access-Control-Allow-Origin`, which the page cannot tell from being offline. */
    try {
      const url = new URL(request.url);
      const route = ROUTES.get(url.pathname);
      if (route) {
        if (request.method === 'OPTIONS') return preflight();
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          return json({ error: 'GET only' }, 405, null, { 'Allow': ALLOW });
        }
        const res = await route(request, url, ctx);
        // A HEAD is a GET with the body dropped; it must not be able to answer differently.
        return request.method === 'HEAD'
          ? new Response(null, { status: res.status, headers: res.headers })
          : res;
      }
      return guarded(await env.ASSETS.fetch(request));
    } catch (e) {
      return json({ error: 'shelfmark could not answer that' }, 500);
    }
  },
};
