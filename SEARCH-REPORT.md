# Shelfmark: endpoint load and result quality

Measured against the live UCLA Alma SRU endpoint on **2026‑08‑06**. Every number below is
reproducible from the shipped file; §6 says how. Companion to [`CATALOG.md`](CATALOG.md),
which documents what the endpoint does; this documents what we ask of it.

---

## 1. Summary

Shelfmark is a browser page. There is no server, no API key, and no stored patron data: the
browser calls `ucla.alma.exlibrisgroup.com/view/sru/01UCS_LAL` directly, because that endpoint
sends `Access-Control-Allow-Origin: *`.

An ordinary search costs the endpoint **one to four requests**. Only a misspelling escalates,
and that path is now capped at 25. One request is in flight at a time, ever.

A defect was found during this review and fixed: count-only probes were transferring fifty
full MARC records each. On the worst measured query that was thirteen wasted page transfers.
Records moved per search dropped by roughly 86 % as a result.

---

## 2. How the page talks to the catalog

| | |
| --- | --- |
| Requests in flight | 1, always. A new search aborts the one before it. |
| Minimum gap between requests | 120 ms |
| Requests per search | 1–4 typical, 25 hard ceiling |
| Retries | 2, backed off 500 ms then 1.5 s, then a visible failure |
| Trigger | Form submit. **Not** keystroke, and not debounced-per-keystroke. |
| Session cache | 120 entries, 5 minute TTL |
| Page size | 50 records (the endpoint silently caps at 50) |
| Ranking pool | up to 150 records, 3 pages |
| Third-party calls | Open Library cover images, ISBN only, lazy, one checkbox turns it off |

The 5 minute cache TTL is chosen so that availability (`AVA $e`) cannot go stale in a way that
matters at a desk. Counts and bibliographic data would tolerate much longer; availability is
what sets the number.

---

## 3. Requests per search, measured

Ten queries, run cold against the live endpoint, before and after the fixes in §4.

| Query | Before | After | Records transferred, after |
| --- | --- | --- | --- |
| `harrison's principles of internal medicine` | 1 | 1 | 21 |
| `cardiology` | 3 | 3 | 150 |
| the same title, searched a second time | 1 | **0** | 0 |
| `mesh:neoplasms year:2020+` | 1 | 1 | 2 |
| `9780071802154` (ISBN) | 2 | 2 | 2 |
| `atlas shrugged` (nothing in scope resembles it, so it widens) | 4 | 4 | ~110 |
| `atlas shurgged` (transposition) | 11 · ~450 rec | 10 | **68** |
| `atlas srugged` (early deletion, the worst case) | 24 · ~970 rec | 23 | **134** |

The typo rows are the ones worth reading. They are also rare: they are what a *failed* search
costs, and only when the failure is a misspelling of a long word.

**Request count barely moved on those rows, and that is expected.** The spelling-recovery
ladder still has to ask the same questions. What changed is what each question costs.

---

## 4. The defect

```js
maximumRecords: String(max || PAGE)     // PAGE = 50
```

`countOnly()` calls this with `max = 0`, meaning "tell me how many records match and send me
none of them" — a request the endpoint answers in 70–100 ms. But `0` is falsy, so `0 || 50`
is `50`, and every probe that existed to avoid a transfer performed one.

`atlas srugged` issued thirteen of them. The liveness check, and each rung of the letter
enumeration, pulled a full page of MARC XML and discarded it.

```js
const want = (max === undefined || max === null) ? PAGE : max;
```

Confirmed in the network log after the fix: twelve probes at `maximumRecords=0`, zero records
returned by any of them.

---

## 5. Controls now in place

**Session cache.** The recovery ladder reaches the same probe from more than one rung by
construction, and a reader who retypes a search still on screen was paying a full round trip
for it. Repeating a search now costs **zero requests**.

**A floor of 120 ms between requests.** Imperceptible against a 0.5–3 s response. It puts a
hard ceiling on the burst rate of the recovery ladder, which is the only code path that ever
issues requests back to back.

**A budget of 25 requests per search.** Running out mid-ladder means the answer is "no
match" — which is what the page was about to say anyway — so it is reported as having stopped
looking for a better spelling, not as a network failure. "Load more" continues the same search
and shares its allowance. A reader searching all afternoon is never throttled; what is bounded
is how much one question may cost.

**`?diag=1`.** Prints requests sent, requests served from cache, and records transferred, for
the search and for the session. The first question anyone responsible for an endpoint will ask
is how many requests this is, and the answer should be a number on the screen rather than one
to be taken on trust.

**The cost of the controls, stated plainly:** the worst typo path got about 2.5 s slower, from
the rate floor. Ordinary searches are unaffected.

---

## 6. Reproducing this

```bash
node Tools/sru.test.js        # 9 assertions on the request layer, no network
node Tools/catalog.test.js    # 396 assertions on the catalog → shelf join, no network
node Tools/walk.test.js       # 52 assertions on the route builder
```

`Tools/sru.test.js` extracts the request layer **verbatim from the built `index.html`** and
runs it against a stubbed endpoint. It pins each control in §5: a count probe must transfer no
records, an identical question must be asked once, a search must not exceed its budget, and
requests must be spaced. All four are invisible in the UI and would regress silently.

For live request counts, open the page with `?diag=1` and read the line under the results.

---

## 7. Result quality

Two queries, run against both systems on 2026‑08‑06.

### `harrison's principles of internal medicine`

**UC Library Search (Primo), page 1**, in order: 1966, 1954, 1958, 1958, 1962, 1958, 1950. The
current edition does not appear on the first page.

**Shelfmark**, first card: 20th edition, 2018, `WB 115 H322 2018`, Level 10 · top row · index
10 · right side, with fourteen earlier printings folded underneath. The companion handbook,
the board review and the PreTest volume stay separate books rather than merging into the run.

### `atlas shurgged`

**Primo:** zero results, no spelling suggestion offered.

**Shelfmark:** corrects to `atlas shrugged`, returns 57 records, and says in the status line
that it corrected the spelling.

### Grades

| | Grade | Why |
| --- | --- | --- |
| UC Library Search | **D** | Thirty printings of one title, and the ones surfaced first are the ones from the 1950s. A misspelling returns nothing at all. |
| Shelfmark | **A−** | Newest edition first, grouped, with an aisle. The minus is §8. |

### The caveat, which belongs in any conversation about this

Shelfmark queries **SRU**; Primo queries its own **PNX** index. Same catalog, different
retrieval stacks. The gap above is real and reproducible, but "SRU returns hits in filing-title
order with no relevance ranking" is a description of that API, not evidence that the discovery
layer is misconfigured. The comparison says a task-specific tool beats a general one at its own
task. It does not say anyone chose badly.

---

## 8. Known limits

**The ranking pool is 150 records.** All relevance ranking is computed locally, because the
endpoint offers none. For a query matching thousands, the best match can in principle sit
outside the pool. Mitigated by the server-side newest-first sort and by scoping to one library
first; not eliminated.

**Edition clustering is a heuristic**, not a work identifier. It groups on the normalised full
245. Two different books sharing a title will merge; a printing with a differently transcribed
subtitle will split off.

**Two misspelt words at once** are not recovered, and neither is a real-word typo whose reduced
query returns nothing to harvest a spelling from. Both fall back to a dropped-word answer that
labels itself a guess.

**The Biomed location table is empirical.** Nine `$j` codes are routed; they were found by
sampling ~300 holdings, not from an authoritative list. An unlisted `bi*` code falls through to
"not in the routing table yet, ask at the desk" and is never given a shelf.

**Only Biomed resolves to an aisle.** All 21 libraries are searched, scoped and ranked, and
every copy shows its call number. Biomed is the only one with a surveyed shelf map, and the UI
says so rather than leaving a blank where an aisle would be.

---

## 9. What would make this better, from the library's side

1. **The authoritative location-code table.** Replacing the sampled list in §8 would close the
   one gap where a real holding can fail to route. The failure is currently visible rather than
   silent, which is the right behaviour, but it is still a failure.
2. **Confirmation of acceptable request volume.** SRU rate limits are undocumented. Nothing was
   observed at this volume, but the ceilings in §5 were chosen by guessing conservatively. A
   real number would let them be set correctly instead of cautiously.
3. **Shelf maps for other libraries.** The map format is 453 hand-surveyed shelf faces in a
   flat JSON file. Nothing in the code is Biomed-specific except the data.

---

Built by Phineas Fritsch. Not affiliated with, or endorsed by, the UCLA Library.
