# UCLA library endpoints reachable without a key

Probed live on **2026‑08‑06**. Everything here was verified by request; nothing is quoted from
vendor documentation. Companion to [`CATALOG.md`](CATALOG.md) (what the SRU endpoint does) and
[`SEARCH-REPORT.md`](SEARCH-REPORT.md) (what Shelfmark costs it).

Institution identifiers: Alma/Primo `01UCS_LAL`, view `01UCS_LAL:UCLA`, LibCal `iid=3244`,
LibGuides `site_id=705`.

---

## Summary

| Endpoint | Key | CORS | Verdict |
| --- | --- | --- | --- |
| Alma **SRU** | none | `*` | In use by Shelfmark |
| Alma **OpenURL resolver** | none | `*` | **Best new find.** Browser-callable |
| Alma **OAI‑PMH** | — | — | **Switched off** (`error_code 21`) |
| Alma REST | required | — | Not pursued |
| Primo **PNX search** | none | **none** | Powerful, needs a proxy |
| Primo **public config** | none | — | 367 KB of scope and UI config |
| LibCal **hours** | none | `*` | Clean JSON, no personal data |
| LibCal **events** | none | — | Returns HTML, not JSON |
| LibCal **space availability** | none | **403 on `Origin`** | Free/busy only, needs a proxy |
| LibGuides widgets | none | — | Returns JS, no clean JSON |
| LibAnswers | — | — | Tenant exists, not deployed |

---

## 1. Alma OpenURL resolver — open, and browser-callable

```
https://ucla.alma.exlibrisgroup.com/view/uresolver/01UCS_LAL/openurl
  ?svc_dat=CTO&rft.issn=0028-4793&rft.volume=380&rft.date=2019
  &svc.fulltext=yes&url_ver=Z39.88-2004
→ 200, text/xml, 14 KB
→ Access-Control-Allow-Origin: *
```

This answers *does UCLA have access to this article, through whom, and for which years* — and it
does so with the same no-key, CORS-open properties Shelfmark already relies on. No proxy, no
server, no credential.

The response carries a `<context_service service_type="getFullTxt">` per provider:

```xml
<key id="package_public_name">Journals@Ovid NEJM Bundle (NEJM-CS-BDL)</key>
<key id="interface_name">Ovid</key>
<key id="electronic_material_type">JOURNAL</key>
<key id="Availability">Available from 01/01/1990 volume: 322 issue: 1.</key>
<key id="Is_free">0</key>
```

Plus `<resolution_url>` per target — the actual link to send a reader to.

Of everything probed today this is the one that fits the existing architecture without
compromise. It is also the piece Shelfmark currently has no answer for: the app resolves print
holdings to a shelf and says nothing useful about electronic access.

## 2. Alma SRU — unchanged

Documented in full in [`CATALOG.md`](CATALOG.md). Open, no key, `ACAO: *`, 437 indexes, no
relevance ranking of any kind.

## 3. Alma OAI‑PMH — off

```
/view/oai/01UCS_LAL/request?verb=Identify
→ <error_code>21</error_code>
   Unauthorized access to the OAI services – please contact the system administrator
```

`ListSets` answers identically. This is an **institution toggle**, not an Ex Libris limitation,
which makes it an ask rather than a dead end — and the highest-value one available. A nightly
harvest into a local index would take Shelfmark's per-search load on Alma to roughly zero and
remove the 150-record ranking ceiling described in `SEARCH-REPORT.md` §8 at the same time.

## 4. Primo PNX — the most capable, the least usable

```
https://search.library.ucla.edu/primaws/rest/pub/pnxs
  ?q=any,contains,atlas+shrugged&vid=01UCS_LAL:UCLA&scope=MyInst_and_CI&sort=rank
→ 200, application/json, 17 KB, no key
```

Three things SRU structurally cannot do:

- **`sort=rank`** — Primo's real relevance ranking.
- **`pnx.facets.frbrgroupid`** (e.g. `["9021446034995830076"]`) — genuine work-level clustering.
  This is the exact upgrade `CATALOG.md` §7 lists as deliberately not built, where Shelfmark
  currently clusters on a normalised 245.
- **`info.totalResultsLocal` / `totalResultsPC`** — holdings split from the article index, plus
  facet counts, which `CATALOG.md` §7 rules out as unaffordable over SRU.

`pnx` sections present: `display`, `control`, `addata`, `sort`, `facets`.

**It sends no `Access-Control-Allow-Origin` header,** so a browser cannot call it. Using it means
a Worker proxy, which costs the "no server, nothing to run" property that makes Shelfmark cheap
to defend. It is also an undocumented, unversioned internal UI endpoint, and traffic to
`search.library.ucla.edu` is considerably more visible than traffic to the SRU host.

### Primo public configuration

```
/primaws/rest/pub/configuration/vid/01UCS_LAL:UCLA
→ 200, 367 KB JSON, no key
```

Top-level keys include `scopes-context-map`, `mapping-tables`, `system-configuration`,
`UIComponents`, `customization`, `tab-to-tiles`, `institution-base-url`. Useful for building
against Primo without guessing.

### The scopes that actually exist

`scopes-context-map` lists nine. Probed against `cardiology`:

| Scope | `total` | `totalResultsLocal` |
| --- | --- | --- |
| `MyInst_and_CI` | 1 786 101 | 4 256 |
| `ArticlesBooksMore` | 1 787 242 | 5 397 |
| `CentralIndex` | 1 781 845 | −1 |
| `MyInstitution` | 4 256 | 4 256 |
| `UCSDiscoveryNetwork` | 5 397 | 5 397 |
| `CourseReserves` | 0 | 0 |
| `FTVA` | 0 | 0 |
| `LIBRARY_SPECIAL_COLLECTIONS`, `clark` | non‑JSON | — |

`UCSDiscoveryNetwork` returns more local records than `MyInst_and_CI` (5 397 vs 4 256), so it
reaches beyond UCLA's own holdings. That is the closest thing to a systemwide scope found.

## 5. LibCal — `iid=3244`

### Hours: open, CORS-open, clean JSON

```
api2.libcal.com/api_hours_today.php?iid=3244&lid=0&format=json
api2.libcal.com/api_hours_grid.php?iid=3244&weeks=1&format=json
→ 200, JSON, Access-Control-Allow-Origin: *
```

Every location with `lid`, `name`, `category`, `parent_lid`, `times.currently_open`,
`times.status`, and a `rendered` string. Departments nest under libraries by `parent_lid`
(e.g. "Arts Library Reference Desk" → 4690). No personal data anywhere in it.

### Events: open, but not an API

`api2.libcal.com/api_events.php?iid=3244&format=json` returns an **HTML fragment** with inline
CSS regardless of `format`. Usable only by scraping.

### Spaces: free/busy, and not browser-callable

```
POST calendar.library.ucla.edu/spaces/availability/grid
form: lid, gid, eid, seat, seatId, zone, start, end, pageIndex, pageSize
→ 200 JSON  (no Origin header)
→ 403       (with an Origin header — cross-origin is refused)
```

`start` and `end` must differ; `start == end` returns an empty result rather than one day.

Response keys: `slots`, `bookings`, `isPreCreatedBooking`, `windowEnd`.

Slot objects are `{start, end, itemId, checksum, className}`. `className` is the whole free/busy
signal — `s-lc-eq-checkout` marks a booked half-hour, absent means free. `itemId` identifies the
room. Over 2026‑08‑06 → 08‑08 for the Collaboration Hub: 140 slots across 10 rooms, 8 booked.

**`bookings[]` was empty in every window probed** across all three Biomed groups. The array is in
the schema, so whether it populates — and with what — is install- and config-dependent. Anything
that does populate it is patron data: California Gov. Code §7927.105 exempts library circulation
and registration records from disclosure, and most UCLA patrons are students, which brings FERPA
in. The `slots` array alone supports a free/busy board and carries no identity at all.

The sanctioned route to booking data with names is the **LibCal v1.1 OAuth API**
(`/1.1/oauth/token`), where obtaining the credential is the library deciding you may have it.

### Location and group ids

| Library | `lid` |
| --- | --- |
| Powell | 4361 |
| Young Research | 5567 |
| Music | 4752 |
| **Biomedical** | **6578** |
| Science & Engineering | 8312 |
| Media Lab | 19391 |

| Group (`gid`) | |
| --- | --- |
| Biomed · Main Floor Study Room | 11674 |
| Biomed · Collaboration Hub Study Rooms | 14014 |
| Biomed · Collaboration Hub Presentation Space | 48355 |
| Group Study Rooms | 7748 |
| Loop Booths (Individual) | 35623 |
| Energy Pod (Individual) | 46885 |

### iCal

Every path tried 404s: `/ical/6578`, `/spaces/ical/6578`, `/ical.php?iid=3244`, `/events.ics`,
`/calendar.ics`. If feeds exist they are on some other path.

## 6. LibGuides — `site_id=705`

| Path | Result |
| --- | --- |
| `lgapi-us.libapps.com/widgets.php?site_id=705&widget_type=7&output_format=1` | 200, **JavaScript**, not JSON |
| `guides.library.ucla.edu/az.php` → `/az/databases` | 200, 170 KB, server-rendered shell |
| `/az/ajax/az_list`, `/az/ajax`, `/api/az`, `/az/all` | Error fragments, with or without params |
| `/srch.php?q=` | 200, HTML |

The A–Z database list loads client-side through `springSpace.azPublicObj.loadAzList`, whose
parameters are `first`, `subject_id`, `type_id`, `vendor_id`, `access_mode_id`, `page` — but every
route those plausibly hit returns an error screen when called directly. **No clean JSON API.**
Getting the database list means scraping rendered HTML or holding a LibGuides API key.

## 7. LibAnswers — not deployed

`ucla.libanswers.com` resolves and 307s to `/status?id=401` ("Whoops! – LibAnswers"). The
tenant exists; the service does not appear to be in public use. `answers.library.ucla.edu`,
`askus.library.ucla.edu` do not resolve.

Also non-resolving: `libcal.library.ucla.edu`, `ucla.libcal.com`, `ucla.libguides.com`.

---

## 8. What is worth building

**Article access lookup (§1).** No key, CORS-open, and it answers a question Shelfmark currently
cannot: paste a DOI, ISSN or PMID and get whether UCLA has full text, through which provider, and
for what years — alongside the print holding and its shelf. It fits the existing architecture
with no proxy and no new liability.

**"What is open right now", all six libraries (§5).** Keyless, CORS-open, no personal data, and
politically inert — it criticises nobody's software. The official hours page is a wall of tables.

**Ask for OAI‑PMH (§3).** Costs an email. If granted it restructures the load story entirely.

**PNX behind a cache (§4).** Highest capability, highest fragility, and it gives up the
serverless property. Worth it only for `frbrgroupid` and real ranking, and only after the above.

Not worth it: the A–Z database list (§6), and the events feed (§5) — both would mean scraping
rendered HTML for what they return.

---

Probed by Phineas Fritsch. All requests were single, read-only, and count-only where the endpoint
supported it. Not affiliated with, or endorsed by, the UCLA Library.
