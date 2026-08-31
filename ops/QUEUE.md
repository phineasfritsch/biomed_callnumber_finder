# Work queue

The queue lives here, in the repository, and not in a session or in anyone's head. Sessions end,
limits are reached, agents crash mid-task. Whatever is not written down is gone.

Every item states how you would know it is done, because "fix the flaky check" is not a task and
"ops/health exits 0 with no BLOCKED rows" is.

Status vocabulary, greppable: `OPEN`, `BLOCKED`, `DOING`, `DONE`, `DROPPED`.
An item that is `BLOCKED` names what would unblock it and who can do that.

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

## OPEN · README documents a build step that is not in the repository

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
