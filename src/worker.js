/* The only server this project has, and it exists for one reason.
 *
 * Everything else Shelfmark uses is keyless and CORS-open, so the browser calls it directly:
 * Alma SRU for the catalog, Alma's OpenURL resolver for full-text access, LibCal for hours.
 * Primo's PNX endpoint is the exception. It answers without a key, but it sends no
 * `Access-Control-Allow-Origin`, so a page cannot call it. It is also the only endpoint that
 * searches the article index at all — SRU indexes UCLA's own holdings and nothing else.
 *
 * So: one route, narrow on purpose.
 *
 *   - Only `/api/articles`, only GET. Everything else goes to the static assets.
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

const first = v => (Array.isArray(v) ? v[0] : v) || '';
const list = v => (Array.isArray(v) ? v : v ? [v] : []);

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
  const has = re => avail.some(x => re.test(x));
  const access = has(/no_fulltext/) ? 'none'
    : has(/linktorsrc/) ? 'link'
    : has(/fulltext/) ? 'full'
    : cats.some(x => /alma-p/.test(x)) || has(/available_in_library|physical/) ? 'print'
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
    authors: list(d.creator).length ? list(d.creator) : list(d.contributor),
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
    oa: list(f.toplevel).some(x => /open_?access/i.test(x)) || !!first(a.oa),
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

async function articles(request, url, ctx) {
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) return json({ error: 'q is required' }, 400);
  if (q.length > 300) return json({ error: 'q is too long' }, 400);

  const limit = Math.min(parseInt(url.searchParams.get('limit'), 10) || 10, MAX_LIMIT);
  const offset = Math.max(parseInt(url.searchParams.get('offset'), 10) || 0, 0);

  const up = new URL(PNX);
  up.searchParams.set('q', 'any,contains,' + q);
  up.searchParams.set('vid', VID);
  up.searchParams.set('inst', INST);
  up.searchParams.set('scope', 'MyInst_and_CI');
  up.searchParams.set('tab', 'LibraryCatalog');
  up.searchParams.set('sort', 'rank');
  up.searchParams.set('lang', 'en');
  // A few spare rows so that dropping duplicates does not hand back a short page.
  up.searchParams.set('limit', String(Math.min(limit + 5, 30)));
  up.searchParams.set('offset', String(offset));
  if (url.searchParams.get('articlesOnly') !== 'no')
    up.searchParams.set('qInclude', 'facet_rtype,exact,articles');

  /* Primo's default is holdings-only: without `pcAvailability` the central index answers with
     what UCLA can actually deliver, and nothing else. That is the right default for a tool
     whose question is "can I read this" — "crispr gene editing" returns 39,743 that way against
     48,636 expanded, and the 8,893 difference is papers a reader would click into a dead end.
     The wider search stays one request away, because sometimes knowing a paper exists is the
     point. Verified 2026-08-10. */
  const beyond = url.searchParams.get('beyond') === 'yes';
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
  if (!res) return json({ error: 'could not reach the article index' }, 502);
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
    docs: dedupe((data.docs || []).map(slim).filter(d => d.title)).slice(0, limit),
  };

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
 * 1.17 MB of markup to extract about 60 KB of facts. Parsing here and caching for a day means
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

function parseAZ(raw) {
  const html = raw.replace(/\\\//g, '/').replace(/\\"/g, Q).replace(/\\n/g, '\n').replace(/\\t/g, ' ');
  const blocks = html.split('s-lg-az-result').slice(1);
  const re = new RegExp('<a[^>]+href=' + Q + '([^' + Q + ']+)' + Q + '[^>]*>([\\s\\S]{0,300}?)<\\/a>');
  const out = [], seen = new Set();
  for (const b of blocks) {
    const a = re.exec(b);
    if (!a) continue;
    const name = a[2].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    if (!name || name.length > 160) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    /* The access mode is not a field, it is an icon: entries UCLA licenses carry a key image
       with alt="Requires UCLA authentication". Everything without one is reachable by anybody,
       which is the free-versus-campus-only distinction the A-Z page itself draws. */
    const auth = /Requires UCLA authentication/i.test(b.slice(0, 2000));
    const best = /Best Bet/i.test(b.slice(0, 2000));
    const dm = /class=.s-lg-az-result-description[^>]*>([\s\S]{0,700}?)<\/div>/.exec(b);
    const desc = dm ? dm[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim() : '';
    out.push({ name: name, url: a[1], desc: desc.slice(0, 320), auth: auth, best: best });
  }
  return out.sort((x, y) => x.name.localeCompare(y.name));
}

async function databases(request, url, ctx) {
  const key = new Request('https://shelfmark.internal/az-v1', { method: 'GET' });
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) {
    const body = await hit.json();
    return json(Object.assign({ cached: true }, body));
  }
  let res;
  try {
    res = await fetch(AZ, { headers: { 'User-Agent': 'Shelfmark/1.0 (UCLA library tool)' } });
  } catch (e) { return json({ error: 'could not reach the database list' }, 502); }
  if (!res.ok) return json({ error: 'the database list returned HTTP ' + res.status }, 502);

  const items = parseAZ(await res.text());
  if (!items.length) return json({ error: 'the database list could not be read' }, 502);
  const out = { count: items.length, licensed: items.filter(i => i.auth).length, items: items };
  ctx.waitUntil(cache.put(key, new Response(JSON.stringify(out), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=' + AZ_TTL },
  })));
  return json(out, 200, AZ_TTL);
}

function json(body, status, ttl) {
  const code = status || 200;
  return new Response(JSON.stringify(body), {
    status: code,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      /* Only a good answer is worth keeping. Caching the failures too meant one transient 522
         from Primo was stored by the browser for ten minutes, so the panel kept reporting an
         outage that had already ended and no retry could get past it. */
      'Cache-Control': code === 200 ? 'public, max-age=' + (ttl || TTL) : 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/articles') {
      if (request.method !== 'GET') return json({ error: 'GET only' }, 405);
      return articles(request, url, ctx);
    }
    if (url.pathname === '/api/databases') {
      if (request.method !== 'GET') return json({ error: 'GET only' }, 405);
      return databases(request, url, ctx);
    }
    return env.ASSETS.fetch(request);
  },
};
