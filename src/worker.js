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
  const recordid = first(c.recordid);
  const context = /^cdi_/.test(recordid) ? 'PC' : 'L';
  const permalink = recordid
    ? 'https://search.library.ucla.edu/discovery/fulldisplay?docid=' + encodeURIComponent(recordid) +
      '&context=' + context + '&vid=' + VID
    : '';
  return {
    title: first(d.title),
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
    peer: list(d.lds50).some(x => /peer/i.test(x)) || list(f.toplevel).some(x => /peer/i.test(x)),
    oa: list(f.toplevel).some(x => /open_?access/i.test(x)) || !!first(a.oa),
    link: permalink,
  };
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
  up.searchParams.set('limit', String(limit));
  up.searchParams.set('offset', String(offset));
  if (url.searchParams.get('articlesOnly') !== 'no')
    up.searchParams.set('qInclude', 'facet_rtype,exact,articles');

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
    docs: (data.docs || []).map(slim).filter(d => d.title),
  };

  const stored = json(out);
  ctx.waitUntil(cache.put(key, new Response(JSON.stringify(out), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=' + TTL },
  })));
  return stored;
}

function json(body, status) {
  const code = status || 200;
  return new Response(JSON.stringify(body), {
    status: code,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      /* Only a good answer is worth keeping. Caching the failures too meant one transient 522
         from Primo was stored by the browser for ten minutes, so the panel kept reporting an
         outage that had already ended and no retry could get past it. */
      'Cache-Control': code === 200 ? 'public, max-age=' + TTL : 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/articles') {
      if (request.method !== 'GET')
        return json({ error: 'GET only' }, 405);
      return articles(request, url, ctx);
    }
    return env.ASSETS.fetch(request);
  },
};
