# Work queue

The queue lives here, in the repository, and not in a session or in anyone's head. Sessions end,
limits are reached, agents crash mid-task. Whatever is not written down is gone.

Every item states how you would know it is done, because "fix the flaky check" is not a task and
"ops/health exits 0 with no BLOCKED rows" is.

Status vocabulary, greppable: `OPEN`, `BLOCKED`, `DOING`, `DONE`, `DROPPED`.
An item that is `BLOCKED` names what would unblock it and who can do that.

---

## DONE · The scheduled routines had no repository to check

**What happened.** The first tester run reported `could not run. No repository is present in this
environment` and stopped. That part was the brief working: it refused to round a gate it never
reached up to a pass. But a monitor that cannot reach the thing it monitors reports nothing, every
hour, forever.

**Why.** `create_trigger` fires a fresh session and has no `source_url` parameter, so nothing is
cloned. Both briefs assumed a checkout would be present.

**Fixed.** The clone is in the routine's own hands now, and `ops/bootstrap` verifies the result
before any gate runs. The incantation matters:

    git clone --depth 1 --branch <branch> --filter=blob:none --sparse \
      https://github.com/phineasfritsch/biomed_callnumber_finder <dir>
    cd <dir> && git sparse-checkout set --no-cone '/*' '!/Floors'

A plain clone is 2.1 GB and about forty seconds, because `Floors/` holds the raw shelf photographs.
Excluding that one directory gives 13 MB in three seconds and every suite still passes: 2102
assertions green in a sparse tree, measured rather than assumed. `ios/` is deliberately not
excluded, because it carries 785 of them.

**Verified, and one line of that verification was wrong.** `ops/bootstrap` was run in a full
checkout, in the sparse clone, and against `main` where the machinery has not landed; the last case
fails with the branch name and a refusal to improvise a substitute gate. That part holds.

The claim that a plain clone can push does not. It was tested with `git push --dry-run` from a
temporary clone **inside an interactive session, which has the repository in its authorized sources
and a credential helper injected for it**. A trigger-fired session has no sources, so the git proxy
answers 403 to every push. The test passed because it was pointed at the one environment where the
answer was already yes. Reads work either way: the repository is public.

The first fixer run found this the way it should have been found, by trying: it did the work,
could not push, and said so instead of claiming success. See the item below.

---

## OPEN · Stage 02b: settle the audit before any page is ported

**Where Stage 02 got to.** Seven briefs, `ops/briefs/`, **82 numbered rulings**, 128 sentences
listed as must-survive, 36 new claims to pin. Every ruling carries how a suite would catch a
violation.

**Then one reader held all seven at once**, which is the only way a disagreement between two of
them is visible. Its verdict, in `ops/briefs/AUDIT.md`: *close to one product, but not yet one.
Port them as they stand and it ships as seven pages that agree about ethics and disagree about
nouns.*

Eleven contradictions and eight gaps. Three matter more than the rest:

- **MAP-1 swapped the whole bet for something easier.** The direction says the marked shelf stays
  under the same point on screen when you cross from home to `/map`. MAP-1 wrote "centred". Those
  are not the same property, and continuity is the entire reason this direction won its bracket.
- **Nobody owns the drawing.** Seven briefs regulate what may be drawn where; none owns the
  renderer contract that makes home's crop and `/map`'s plan the same drawing at two zooms. Ported
  as written, the product gets two drawings, which is the one thing the direction is named after
  not doing.
- **Five briefs cite G5 and instantiate four different grammars of failure.** The ruling that says
  one grammar for failure was broken by the process meant to enforce it, which is what parallel
  authorship does when nobody owns the shared thing.

**Done when.** The eleven contradictions are resolved in the briefs themselves, the eight gaps have
a named owner, and a re-audit returns "one product". Ten escalations need the owner rather than us.

---

## DONE · Stage 02: page briefs, written from the frozen direction

**Stopping condition.** `ops/SHIP.md` now defines what finished means and who says so, written
before the work it judges, because a bar set afterwards is set to whatever was achieved. Eight
criteria plus a human gate the board cannot close on its own.

**What.** The bracket is finished. `ops/DIRECTION.md` is the frozen direction: One Drawing, Two
Zooms, with fifteen grafts from the directions it eliminated. Next is one brief per surface, each
with numbered rulings a code comment can cite.

**What the direction commits to, and what a brief may not undo.** Three rules the bracket made
binding rather than decorative:

1. The drawing is never the answer. The answer is the text line in its current position and
   wording, plus the staff code at equal weight. Nothing is ever placed between the top of the
   viewport and that line.
2. The drawing never appears without a mark, because a plan with nothing filled asserts a place
   nobody looked up. A refusal renders as a positive object with the named refusal, the voided
   staff-code slot, and the evidence line, and draws nothing.
3. One answer shape serves one book and twelve. A pull list is a route; one call number is a route
   of length one.

**Done when.** Every surface in `ops/DIRECTION.md` has a brief, roughly three rulings each, and a
brief with no rulings is unfinished. Any new claim a brief introduces is pinned in
`Tools/pins.test.js` before the page carrying it is written.

**Before any of it lands.** The live-ahead item below still blocks Stage 05. Briefs touch no code
and can be written now.

---

## DONE · The fixer could not push what it had built

**What happened.** The first fixer run completed its queue item and then reported: *the repo isn't
in this session's authorized sources, so all pushes get a 403 from the git proxy.* It did not
claim success, which is the brief working twice in two days.

**Why.** Pushing needs the repository in the session's authorized sources; an interactive session
has that and a trigger-fired session does not. `create_trigger` takes no source. `add_repo` would
attach one, but it is an MCP connector tool and fired sessions carry no connectors, which the
trigger warned about when it was created.

**Fixed by changing what the fixer delivers.** It now commits locally, runs `git format-patch`,
**checks the patch applies to a clean clone**, and sends the `.patch` file with `SendUserFile`,
which fired sessions do have. A patch that has been verified to apply is worth more than a branch
nobody reviewed, and the human was already required to open the pull request.

Applying one:

    git am < 0001-<name>.patch        # or: git apply, to stage without the commit message

**What would restore real pushing**, either is a one-time action and neither is mine to take:

- Recreate the two routines from the Routines interface on claude.ai so they carry connectors.
  A fired session holding the `claude-code-remote` connector can call `add_repo` with
  `access: "push"` and attach the repository itself.
- Or attach the repository to the environment the routines fire into, so every fired session has
  it in its sources from the start.

---

## DONE · Two surfaces answered without looking anything up

**What.** A six-person review panel drove the site and raised 45 findings; 24 survived adversarial
verification. The full report is `ops/PANEL.md`. Two findings are one defect wearing two coats,
and both were reproduced by hand before being written here.

**The home box appends the next query to the last one and answers for the previous book.**
Locate `W1 AM4990`, then click the box and type `WA 900.1 M300`. The field becomes
`W1 AM4990WA 900.1 M300`, and the page returns a normal green panel reading
`Level 7 · top row · index 9 · Left side`. That is the first book's shelf. Nothing says the rest
of the input was discarded. This is the most repeated gesture at a service desk, and it produces
a wrong aisle that looks exactly like a right one.

*Fix.* Two changes, and shipping only the first is worse than shipping neither, because it makes
the common case safe and leaves pasted input silently wrong while looking fixed.

1. `shelfPreview()` refuses, or flags, any input `parseCN` did not fully consume, and echoes the
   number it actually matched.
2. `#q.select()` on focus, so a fresh slip overwrites rather than concatenating.

**The Reference view of the map cannot refuse anything.** In `map.html`, the `collection==='ref'`
branch does no lookup at all: it upper-cases whatever was typed and asserts it is on floor 4.
Verified directly: `NOT A CALL NUMBER AT ALL is on floor 4, shelved by call number.` And
`W1 AM4990 is on floor 4` for the tool's own worked example, which its own dataset puts on
Level 7.

*Fix.* Run the string through `findFaces` before answering. Refuse anything that is not
call-number shaped, using the same miss sentence the stacks branch already uses, and when a
string matches a mapped stacks range say so and offer the switch instead of asserting floor 4.

**Why these two are first.** The product's entire trust case is that it refuses to guess, and
four of the six reviewers named that refusal, unprompted, as the thing that bought their trust.
These are the two places it does not.

**Done when.** Neither surface asserts a location it did not look up, and `Tools/ui.test.js` has a
journey for each: one typing a second call number into a used box, one asking the Reference view
for something that is not a call number.

**DONE.** Both journeys exist and pass: `locate · a second call number does not answer for the
first` and `map · the Reference view refuses what it cannot look up`. Both were written RED before
the fix and went green with it.

The home box needed two attempts. The first parsed the field into a call number plus a remainder,
which cannot be done: the tail of a real call number can itself be a real call number, and judged
on shape eleven of the 906 endpoints in the survey came apart. What shipped instead needs no
parsing. The page already knows what it last answered, so a box beginning with exactly that string
and carrying more after it is an append, and the appended part is what the reader meant.

Left as a note for whoever reads this next: this item sat marked `OPEN` for several commits after
it was finished, which would have sent the daily fixer to redo it, because that routine takes the
topmost `OPEN` item. Closing an item is part of doing it.

---

## OPEN · The live site is ahead of this repository, and nobody has the difference

**What.** Two of the eleven published files on `https://shelfmark.phineasfritsch.com` contain code
that exists on no ref in this repository.

- `index.html`, 30 lines: a feature linking catalog results out to Primo. `PRIMO_VIEW`,
  `primoHref()`, `recordLink()`, a linked title on each result card, and an "In the catalog" chip
  in the tag row.
- `site.css`, 25 lines: the styling for those links, and a `@media (forced-colors: active)` block
  that restores keyboard focus rings for Windows High Contrast users. Focus is drawn everywhere
  else as `outline:none` plus a box-shadow ring, in twenty-six declarations; under forced colours
  the browser discards the shadow and honours the `outline:none`, so without that block a keyboard
  user gets no focus indicator on any control on the site.

The string `forced-colors` does not appear anywhere in this repository. The live `index.html`
hashes to nothing in the history. The live code's own comment says `ENDPOINTS.md` documents the
Primo URL and `Tools/catalog.test.js` asserts it agrees with the worker's, and neither file
mentions Primo, so the tests and documentation intended to land with the feature did not arrive
either.

`databases.html` also differs, but only in line endings: the deployed copy is CRLF and the
committed one is LF. Content identical, no work lost.

**Why it matters.** Until this is resolved, any deploy from this repository deletes a shipped
feature and an accessibility fix, and reports success while doing it, because every gate it passes
is a gate about the repository. `ops/parity` now refuses that deploy, so the immediate danger is
handled, but the work is still only in two places: the public web, and whichever machine ran
wrangler. It is not in version control.

**Who can resolve it.** Whoever deployed it. They have the source, and they know whether the
tests and the `ENDPOINTS.md` section exist on that machine too.

**How to see exactly what is missing.**

    ops/parity                     # which files, and how many lines
    ops/parity --diff /            # the index.html difference
    ops/parity --diff /site.css    # the stylesheet difference

**Done when.** The Primo linking feature, its styles and the forced-colors block are committed and
pushed, `ops/parity` exits 0 or 2, and `ops/health` stops reporting that the deployment does not
match the tree. If the tests and documentation that comment refers to also exist locally, they
belong in the same commit.

---

## DONE · Nothing here could see production

**What.** The container this runs in reaches `github.com` and `registry.npmjs.org` and nothing
else. `shelfmark.phineasfritsch.com` is refused by the egress proxy with a 403 on CONNECT, and so
are all four upstreams the site depends on: Alma SRU, LibCal, Primo, LibGuides.

**Why it matters.** Every remote check in `ops/health` and every route in `ops/prod` reports
`BLOCKED` rather than `ok`, which is the honest answer and a useless one. Nothing in this
repository currently knows whether the live site is up, whether the deployed build matches the
commit, or whether a private file has been published by accident. The browser journeys run
against a local server serving the identical bytes, which is a good stand-in for the pages and no
statement at all about the deployment.

**RESOLVED 2026-08-31.** The account owner added the hosts to the environment's network policy
mid-session. All six now answer. `ops/prod` reports all 23 routes correct, `ops/health` reports
all four upstreams answering, and the browser journeys can be pointed at the real site with
`node Tools/ui.test.js --origin https://shelfmark.phineasfritsch.com`. Two checks in this
repository fired on healthy production data at first contact and both were wrong rather than
production being wrong; see the commit that added `ops/parity`. The heading above is left as
`BLOCKED` for one more read so the next operator sees what the state was and what changed.

    shelfmark.phineasfritsch.com
    ucla.alma.exlibrisgroup.com
    api2.libcal.com
    search.library.ucla.edu
    lgapi-us.libapps.com
    covers.openlibrary.org

**Done when.** `ops/health` exits 0 or 1 rather than 3, with no row reading `BLOCKED`, and
`node Tools/ui.test.js --origin https://shelfmark.phineasfritsch.com` runs the journeys green
against the real site.

---

## OPEN · The deploy stamp has never been written

**What.** `ops/deploy` writes `version.txt` with the commit sha and reads it back off the live
site, which is what turns deploy parity from a hope into a fact. No deploy has run since that was
added, so `/version.txt` is not published yet and `ops/health` reports parity as `BLOCKED`.

**Done when.** `curl https://shelfmark.phineasfritsch.com/version.txt` returns a 40 character sha
and `ops/health` says the deployed build is this commit.

---

## DONE · README documented a build step that is not in the repository

Rewritten to describe how `index.html` is actually maintained: no build step, `shelf-data.js` then
`shelf-core.js` loaded as ordinary scripts. Also corrected a second stale line claiming
`Tools/walk.test.js` reads geometry out of the built HTML; it reads `shelf-core.js`.

The fixer routine completed this same item and could not push it. Redone here rather than left in
an ephemeral container. The note about the retired script is kept deliberately, because a reader
who remembers it should find out where it went.

---

## OPEN · README documents a build step that is not in the repository

<!-- superseded -->

**What.** `README.md` says `index.html` is generated, that `.build_locator.py` is the source of
truth for the HTML, and that the two must stay in sync. There is no `.build_locator.py` in the
repository. It is not in `git ls-files` and it is not on disk. The build script appears to have
been retired when the single page became five, and the README was not updated.

**Why it matters.** This is the most dangerous kind of stale documentation, because it tells the
next person that hand edits to `index.html` will be overwritten. Someone acting on that either
goes looking for a file that does not exist, or does not make an edit they should have made.

**Done when.** The README either describes how `index.html` is actually maintained now, or the
build script is restored and `ops/test` proves the generated file matches the committed one.

---

## DROPPED · Range overlap detection by flat per-level sort

**What.** A candidate check for `ops/health`: sort every face on a level by its start call number
and flag any pair where one range's end sorts past the next range's start.

**Why it was dropped rather than tuned.** Pointed at the real survey it fires on eleven pairs
spread across seven levels, and inspection says all eleven are legitimate. The collection runs as
one continuous snake weaving between the top and bottom rows column by column, so a top row face
and a bottom row face at the same column genuinely interleave when read in a flat sort. Serial
runs, where start equals end, trivially collide with a neighbour as well.

A check that fires eleven times on healthy data is not a check that needs its threshold raised to
eleven. It is a check that is modelling the wrong thing, and shipping it at that threshold would
mean the twelfth overlap, the real one, arrives as a number nobody reads. A guard that cries wolf
gets muted, and a muted guard protects nothing.

**What would make it real.** Walk the snake in shelving order rather than sorting flat: order the
faces by the path the collection actually takes across the floor, then assert that each face's end
sorts at or before the next face's start along that path. Level 9 is a second parallel sequence
and must be walked separately rather than merged with the general stacks.

---

## OPEN · One suite has been skipped for as long as it has existed

**What.** `ios/Tools/headcount.parity.test.mjs` exits 2 with a clear reason: it diffs the Swift
copy of a Google Form schema against a pinned schema that lives in a different repository, and
that repository is not cloned alongside this one.

**Why it matters.** The test says it plainly and it is worth repeating: nothing is checking that
the app's copy of the form field ids is still the right one. A skip with a good reason is still a
skip, and this one has never run.

**Done when.** Either the sibling repository is cloned in the environment where the suite runs, so
the check actually executes, or the pinned schema moves into this repository and the check stops
depending on a clone that is usually absent.

---

## OPEN · House style has a standing backlog

**What.** `Tools/style.test.js` records 240 em dashes across five budgeted files. A file at its
budget is queued, not clean. The budgets only ratchet down.

**Done when.** `BUDGETS` in that file is empty and every listed document asserts zero.

---

## OPEN · The panel has not been read by a person

**What.** `ops/shoot` renders every page at two viewports into `ops/shots/`, and a review panel
has judged those renders for whether each page serves its reader.

**Why it matters, and why no agent closes this item.** A panel can rank whether a layout serves a
task. It cannot tell you that something is ugly, off brand, or embarrassing. Every visual decision
needs one human look before it ships, and that look takes thirty seconds.

**Done when.** A person has opened `ops/shots/` and said so.

---

## OPEN · Two colours in the design system have no name

**What.** `Tools/cohesion.test.js` budgets thirteen raw hex colours in `site.css` that sit outside
the token definitions. Nine of the thirteen are two colours used the same way every time:

- `#bcce9e`, seven times, always as the border that pairs with `var(--green-soft)`.
- `#e0bfa2`, twice, always as the border that pairs with `var(--orange-soft)`.

**Why it matters.** These are two tokens that should exist and do not. The pattern is the ordinary
way a design system comes apart: the eighth caller copies the hex from the seventh, and then
changing the green means finding all eight by hand and getting seven of them.

**Done when.** `--green-line` and `--orange-line` exist beside the other twenty-one tokens, the
nine call sites use them, and `LOOSE_COLOUR_BUDGET` in `Tools/cohesion.test.js` comes down to
four. The remaining four are the carrier chips and one white, which are genuinely one-off.

---

## OPEN · Chromium cannot reach the site from this container, though curl can

**What.** `node Tools/ui.test.js --origin https://shelfmark.phineasfritsch.com` fails every journey
with `net::ERR_CONNECTION_RESET`, while `ops/prod` fetches all 23 routes successfully from the same
container at the same moment. Two separate causes were found and one is fixed:

- Chromium does not read `HTTPS_PROXY`, and needs the proxy CA in the NSS store, which is absent by
  default. Fixed by launching with an explicit proxy and installing the CA:

      apt-get update && apt-get install -y libnss3-tools
      certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n ccr-agent-proxy-ca -i /root/.ccr/agent-proxy-ca.crt

  That resolves `ERR_CERT_AUTHORITY_INVALID` and `https://api.github.com` then loads in Chromium.

- The remaining failure is host specific and not understood. The relay reports
  `ws_closed_mid_exchange`: roughly 1,750 bytes sent, 39 received, tunnel closed after six seconds,
  every time. Disabling PostQuantumKyber, EncryptedClientHello and TLS13EarlyData changed nothing.
  The CA is not the issue any more, because github loads.

**What was done instead.** `Tools/ui.test.js --deployed` fetches the published set with curl, which
does reach the site, serves it locally and runs all 18 journeys against it. That drives the real
deployed artefact in a real browser and currently passes 52 of 52. It is the honest substitute and
not the equal one: it cannot exercise anything that depends on the real hostname, which means the
worker's `/api` routes, edge caching, redirects and response headers.

**Never fix this with `--ignore-certificate-errors`.** A browser that trusts everything is not
testing TLS at all, and the failure it hides next time will be a real one.

**Done when.** `node Tools/ui.test.js --origin https://shelfmark.phineasfritsch.com` runs green
from somewhere, whether that is this container with the tunnel problem solved or a developer
machine with ordinary network access.

---

## OPEN · Nine mutations that a green suite does not notice

**What.** An inventory pass verified each of these by making the change and running the gate. Every
one passes all assertions. Two were about `Tools/ui.test.js` itself and are fixed; these nine are
not, and each is its own piece of work.

| Mutation | What the reader gets |
| --- | --- |
| Swap `left` and `right` on all 453 shelf faces | Sent to the wrong side of every aisle, with the same confident wording |
| Delete every level 3 and level 6 face (99 of 453) | A third of the building silently unmapped |
| Drop the level 9 exclusion from `routeLocate` in map.html | Every book on levels 10 and 11 routed to Special Collections. This is the exact regression the code documents at length |
| Unwire the Build route button in map.html | The itinerary never appears; looks like an OCR failure |
| Read the publication year from MARC 008 offset 11 instead of 7 | Every "newest edition first" cluster silently reordered |
| Delete the `covers.checked` gate in index.html | Every catalog search sends an ISBN to openlibrary.org whether or not the reader opted in |
| Collapse `statusOf` in hours.html to always return "Open now" | Someone walked to a room that closed an hour ago |
| Remove the "Show 60 more" handler in databases.html | 1,300 of about 1,360 databases unreachable |
| Make `looksLikeArticle` always return false | Every DOI, PMID and ISSN goes to the catalog instead of the resolver |

**Why the suite misses them.** Three structural reasons, and they are worth separating because the
fixes differ.

The shelf survey's *content* is unverified. Six call numbers in `Tools/catalog.test.js` and three
in `Tools/ui.test.js` exercise 453 faces. `ops/health` catches a changed face count and a changed
side histogram, but `ops/health` is not part of `ops/test`, and its strongest dataset check
compares `shelf-data.js` to `biomed-shelf-ranges.json`, so a label mis-transcribed at survey time
is in both files and invisible to everything.

Whole modules are unreachable by any suite. The trip planner, the OCR pipeline and the one box
that routes every query all sit outside the `/* == …:start ==` markers the harnesses extract, so
nothing can reach them. The fix is mechanical: add markers and extract, exactly as
`Tools/catalog.test.js` does with `catalog-core`.

The MARCXML reader that ships has never parsed the fixtures. `Tools/sru.test.js` stubs
`readRecord` out entirely, and `Tools/catalog.test.js` parses `fixtures/*.xml` with its own regex
scanner rather than running the shipped parser over them.

**Done when.** Each row above fails at least one assertion. Take them one at a time; the shelf
survey and the trip planner are the two that decide whether the tool sends people to the right
place, and they are the two to do first.

---

## OPEN · The response, as opposed to the file on disk, is unchecked

**What.** `robots.txt` is in the `EXPECTED` list in `Tools/assets.test.js` and its contents are
never read, so changing it to `Disallow: /` ships green and deindexes the site. There is no
`_headers` file: no Content-Security-Policy, no Referrer-Policy, no X-Content-Type-Options, and
nothing notices their absence. That matters more here than it usually would, because `index.html`
loads two scripts from `cdn.jsdelivr.net` at runtime and the SRI check in `Tools/xss.test.js` is
the only thing standing behind them.

**Done when.** `Tools/assets.test.js` reads `robots.txt` and asserts it allows the site and
disallows `/api/`, a `_headers` file exists with a script-src allowlist, and `ops/prod` checks the
headers come back on a real response.

---

## OPEN · A third of the assertion count is a text scan of code nothing here can run

**What.** The iOS port contributes 785 of the 2075 assertions. There is no Swift toolchain in this
container. `ios/Tools/swiftcheck.test.js` says in its own header that it is not a type checker and
will not catch a wrong argument type or a missing await, and `ios/Tools/geometry.test.js` tests a
JavaScript transcription of `WalkPath.swift` rather than the Swift itself.

**Why it matters.** An operator reading "2075 assertions, all green" has no way to tell that a
third of that number is a textual scan. The number is the thing this system asks people to trust.

**Done when.** `ops/test` reports the iOS suites in a separate line with a word about what they
are, so the headline number is not read as more than it is. Separately, and more useful: drive
`ios/Tools/geometry.test.js` and `Tools/walk.test.js` from one shared table of cases, so a
divergence between the Swift-mirroring JavaScript and `shelf-core.js` fails rather than passing
twice in two dialects.
