var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.js
var PNX = "https://search.library.ucla.edu/primaws/rest/pub/pnxs";
var VID = "01UCS_LAL:UCLA";
var INST = "01UCS_LAL";
var TTL = 600;
var MAX_LIMIT = 20;
var first = /* @__PURE__ */ __name((v) => (Array.isArray(v) ? v[0] : v) || "", "first");
var list = /* @__PURE__ */ __name((v) => Array.isArray(v) ? v : v ? [v] : [], "list");
function slim(doc) {
  const pnx = doc.pnx || {};
  const d = pnx.display || {}, a = pnx.addata || {}, f = pnx.facets || {};
  const c = pnx.control || {};
  const dl = doc.delivery || {};
  const avail = list(dl.availability).map((x) => String(x).toLowerCase());
  const cats = list(dl.deliveryCategory).map((x) => String(x).toLowerCase());
  const has = /* @__PURE__ */ __name((re) => avail.some((x) => re.test(x)), "has");
  const access = has(/no_fulltext/) ? "none" : has(/linktorsrc/) ? "link" : has(/fulltext/) ? "full" : cats.some((x) => /alma-p/.test(x)) || has(/available_in_library|physical/) ? "print" : "";
  const recordid = first(c.recordid);
  const context = /^cdi_/.test(recordid) ? "PC" : "L";
  const permalink = recordid ? "https://search.library.ucla.edu/discovery/fulldisplay?docid=" + encodeURIComponent(recordid) + "&context=" + context + "&vid=" + VID : "";
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
    access,
    // Open access is kept because it *is* an access fact: it is the copy that still opens
    // from a coffee shop, with no VPN and no proxy.
    oa: list(f.toplevel).some((x) => /open_?access/i.test(x)) || !!first(a.oa),
    link: permalink
  };
}
__name(slim, "slim");
async function articles(request, url, ctx) {
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return json({ error: "q is required" }, 400);
  if (q.length > 300) return json({ error: "q is too long" }, 400);
  const limit = Math.min(parseInt(url.searchParams.get("limit"), 10) || 10, MAX_LIMIT);
  const offset = Math.max(parseInt(url.searchParams.get("offset"), 10) || 0, 0);
  const up = new URL(PNX);
  up.searchParams.set("q", "any,contains," + q);
  up.searchParams.set("vid", VID);
  up.searchParams.set("inst", INST);
  up.searchParams.set("scope", "MyInst_and_CI");
  up.searchParams.set("tab", "LibraryCatalog");
  up.searchParams.set("sort", "rank");
  up.searchParams.set("lang", "en");
  up.searchParams.set("limit", String(limit));
  up.searchParams.set("offset", String(offset));
  if (url.searchParams.get("articlesOnly") !== "no")
    up.searchParams.set("qInclude", "facet_rtype,exact,articles");
  const beyond = url.searchParams.get("beyond") === "yes";
  if (beyond) up.searchParams.set("pcAvailability", "true");
  const key = new Request(up.toString(), { method: "GET" });
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) {
    const body = await hit.json();
    return json(Object.assign({ cached: true }, body));
  }
  const ask = /* @__PURE__ */ __name(() => fetch(up.toString(), {
    headers: {
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://search.library.ucla.edu/discovery/search?vid=" + VID,
      // Say who this is. An unidentified client is the one nobody can ask about.
      "User-Agent": "Shelfmark/1.0 (UCLA library tool; +https://shelfmark.phineasfritsch.com)"
    }
  }), "ask");
  let res = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 400));
    try {
      res = await ask();
    } catch (e) {
      res = null;
    }
    if (res && res.ok) break;
    if (res && res.status < 500) break;
  }
  if (!res) return json({ error: "could not reach the article index" }, 502);
  if (!res.ok) return json({ error: "the article index returned HTTP " + res.status }, 502);
  let data;
  try {
    data = await res.json();
  } catch (e) {
    return json({ error: "the article index sent a response we could not read" }, 502);
  }
  const info = data.info || {};
  const out = {
    total: info.total || 0,
    local: info.totalResultsLocal,
    central: info.totalResultsPC,
    beyond,
    // so the page can say which of the two searches it is showing
    docs: (data.docs || []).map(slim).filter((d) => d.title)
  };
  const stored = json(out);
  ctx.waitUntil(cache.put(key, new Response(JSON.stringify(out), {
    headers: { "Content-Type": "application/json", "Cache-Control": "max-age=" + TTL }
  })));
  return stored;
}
__name(articles, "articles");
var AZ = "https://lgapi-us.libapps.com/widgets.php?site_id=705&widget_type=2&output_format=1";
var AZ_TTL = 86400;
var Q = String.fromCharCode(34);
function parseAZ(raw) {
  const html = raw.replace(/\\\//g, "/").replace(/\\"/g, Q).replace(/\\n/g, "\n").replace(/\\t/g, " ");
  const blocks = html.split("s-lg-az-result").slice(1);
  const re = new RegExp("<a[^>]+href=" + Q + "([^" + Q + "]+)" + Q + "[^>]*>([\\s\\S]{0,300}?)<\\/a>");
  const out = [], seen = /* @__PURE__ */ new Set();
  for (const b of blocks) {
    const a = re.exec(b);
    if (!a) continue;
    const name = a[2].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    if (!name || name.length > 160) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const auth = /Requires UCLA authentication/i.test(b.slice(0, 2e3));
    const best = /Best Bet/i.test(b.slice(0, 2e3));
    const dm = /class=.s-lg-az-result-description[^>]*>([\s\S]{0,700}?)<\/div>/.exec(b);
    const desc = dm ? dm[1].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim() : "";
    out.push({ name, url: a[1], desc: desc.slice(0, 320), auth, best });
  }
  return out.sort((x, y) => x.name.localeCompare(y.name));
}
__name(parseAZ, "parseAZ");
async function databases(request, url, ctx) {
  const key = new Request("https://shelfmark.internal/az-v1", { method: "GET" });
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) {
    const body = await hit.json();
    return json(Object.assign({ cached: true }, body));
  }
  let res;
  try {
    res = await fetch(AZ, { headers: { "User-Agent": "Shelfmark/1.0 (UCLA library tool)" } });
  } catch (e) {
    return json({ error: "could not reach the database list" }, 502);
  }
  if (!res.ok) return json({ error: "the database list returned HTTP " + res.status }, 502);
  const items = parseAZ(await res.text());
  if (!items.length) return json({ error: "the database list could not be read" }, 502);
  const out = { count: items.length, licensed: items.filter((i) => i.auth).length, items };
  ctx.waitUntil(cache.put(key, new Response(JSON.stringify(out), {
    headers: { "Content-Type": "application/json", "Cache-Control": "max-age=" + AZ_TTL }
  })));
  return json(out, 200, AZ_TTL);
}
__name(databases, "databases");
function json(body, status, ttl) {
  const code = status || 200;
  return new Response(JSON.stringify(body), {
    status: code,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      /* Only a good answer is worth keeping. Caching the failures too meant one transient 522
         from Primo was stored by the browser for ten minutes, so the panel kept reporting an
         outage that had already ended and no retry could get past it. */
      "Cache-Control": code === 200 ? "public, max-age=" + (ttl || TTL) : "no-store",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(json, "json");
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/articles") {
      if (request.method !== "GET") return json({ error: "GET only" }, 405);
      return articles(request, url, ctx);
    }
    if (url.pathname === "/api/databases") {
      if (request.method !== "GET") return json({ error: "GET only" }, 405);
      return databases(request, url, ctx);
    }
    return env.ASSETS.fetch(request);
  }
};

// ../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-V2XQU3/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-V2XQU3/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
