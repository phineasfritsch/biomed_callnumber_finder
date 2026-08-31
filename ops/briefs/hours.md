# Brief: /hours (hours.html)

Written from the frozen direction in `ops/DIRECTION.md`. Rulings are numbered so a code
comment can cite one six weeks from now by somebody arguing with it.

**The job.** /hours answers one question — "is it open, and until when" — for every UCLA location on any date, read live from LibCal, and it always says out loud which of the two things happened: LibCal answered, or it did not.

**The reader.** Two readers, one task. A desk worker with a patron standing there needs "open now / closed now / until when" for a named location in seconds, and needs to know whether what is on screen is live or stale before repeating it aloud. A student planning Thursday needs the same rows for a date that is not today. Failing looks like this: the page shows "Asking LibCal…" and then nothing ever changes, or it shows a plausible list of hours that is actually the last thing LibCal said before it stopped answering — and the reader walks a patron to a locked door on the authority of this page. The screen-reader case is the sharp end: the visible skeleton rows and the live region can disagree, and a reader who cannot see the rows appear is told nothing at all.

## Rulings

### HOURS-1

Every asynchronous outcome resolves into one string that is simultaneously the visible text of #hrsStatus and its aria-live content; there is no visible-only outcome and no announced-only outcome, and the pending string "Asking LibCal…" is never the last thing that string ever says.

*Because.* The frozen /hours section: "in one string that is both the visible text and the aria-live region." Grafted from subtract-3 and ruled non-negotiable, it is the only stated fix for the /hours failure. Serves G6 and G2. Without it the pending state is a permanent claim that an answer is still coming.

*Caught by.* Drive the page with LibCal stubbed to (a) success, (b) HTTP 500, (c) a never-resolving promise then a reject. In every case assert #hrsStatus.textContent is non-empty, is not the pending string, and equals the rendered outcome sentence. Assert no code path writes the outcome to out.innerHTML without also writing statusEl.

### HOURS-2

The failure string keeps the fragment "Could not reach LibCal" and adds the door clause in the same sentence — the upstream is named first, the fallback second, e.g. "Could not reach LibCal — the posted hours are on the door." The technical reason (HTTP status, "network error") stays appended; it is not replaced by the friendlier sentence.

*Because.* G4 plus pins.test.js pin `libcal-failure-names-libcal`, signature 'Could not reach LibCal', whose stated reason is that naming the upstream tells a desk worker whether to wait or to phone somebody. The direction's example phrasing ("LibCal did not answer; the posted hours are on the door") would delete that fragment and fail the guard. A refusal may be reworded, never removed — and rewording that drops the named upstream is removal.

*Caught by.* node Tools/pins.test.js — the pin fails if the fragment is gone. Add an assertion that on an upstream failure the status string also contains the door clause and the diagnostic detail.

### HOURS-3

No shelf drawing, crop or floor SVG appears on /hours, at any zoom, ever.

*Because.* Binding rule 2: the drawing never appears without a mark, and a mark asserts a looked-up shelf. /hours looks up nothing spatial, so any drawing here would assert a place nobody looked up (G2), and would cost paint on a page whose whole job is one line (G1). The direction is silent on decorating /hours; this ruling refuses the decoration rather than inventing a use for it.

*Caught by.* Assert hours.html contains no <svg> other than the brand mark in the header, and loads no geometry module.

### HOURS-4

A statistic never appears without naming what it covers: the count line states open-of-total and that total is computed from the locations LibCal actually returned for today, never a number written into prose or metadata. The strings "27 locations" and "32 locations" do not appear anywhere on the page.

*Because.* G2. Today the meta description says 27 and the script comment says 32 while the rendered count is derived — a hardcoded count is a claim the page cannot check and will silently be wrong the first time LibCal's roster changes.

*Caught by.* Grep hours.html for a digit followed by " locations"; fail on any literal. Assert the rendered count equals the length of the filtered known-today set.

### HOURS-5

"Open now" and "Closed now" are claimed only for today and only from `currently_open`; on any other date the word is the tenseless "Open", and status is always a word, never a colour or dot alone.

*Because.* G2 and G6. This is an incident already paid for: the code comment records that `status: open` means "has hours on this day", and rendering it green at 6.45pm sent a reader to a closed room. Colour-only status is unreadable to the screen reader and to colour-blind readers.

*Caught by.* Unit-test statusOf() across the six LibCal statuses × isToday true/false; assert every returned object carries a non-empty word, and that word 'Open now'/'Closed now' is unreachable when isToday is false.

### HOURS-6

"Nobody has posted hours" is a distinct rendered outcome from "closed" and from "LibCal failed", rendered as a filled sentence naming the date — never as an empty list.

*Because.* Binding rule 2's grammar of refusal (a refusal is a positive object, blank space reads as a page that failed to load) and G5's one grammar for failure. Far-future weeks come back entirely `not-set`; calling that "closed" is a false claim and calling it an error blames an upstream that answered correctly.

*Caught by.* Stub a week of all-`not-set` days; assert #hrsOut renders the 'No hours are posted for <date> yet.' object and that #hrsStatus carries the same sentence, and that neither has the error class.

### HOURS-7

Any control the fetch disables returns focus to itself when the fetch settles, and only if focus was not moved by the reader in the meantime; a week already in the cache disables nothing.

*Because.* G6 and G1. Disabling the element the reader is standing on drops them to document top with no way back to the control they just pressed — written into the code today. Cached weeks re-render rather than re-fetch, which is also why day switching must never disable.

*Caught by.* Keyboard test: focus 'next week', activate, resolve the fetch, assert document.activeElement is that button; repeat with focus moved elsewhere mid-fetch and assert focus is left alone. Assert no busy(true) call on a cache hit.

### HOURS-8

A week move announces the week it landed on in front of the day sentence; a day move announces the day. Both are one write to the single live region, not two.

*Because.* G6 plus HOURS-1's one-string rule. Pressing 'next week' replaces the day strip and every row under it; a status line that names only a date does not say the week moved. Announced once on change, per the frozen /hours section.

*Caught by.* Assert that after a week press #hrsStatus begins 'Week of ' and that statusEl was assigned exactly once in that transition.

### HOURS-9

There is no silent retry. If a second attempt is made it is a second visible line in the same region, in the same grammar, naming that it is a second attempt.

*Because.* Verbatim from the frozen /hours section: "No silent retry — a second attempt is a second line." Serves G2: a page that quietly re-asks can show a stale outcome as a fresh one.

*Caught by.* Assert no timer or catch block calls fetchWeek without writing a new status line first.

### HOURS-10

Nav, footer, skip link and the shared vocabulary stay exactly as they are on the other six surfaces; /hours does not grow a nav, a heading or a disclosure of its own.

*Because.* G5, one product. The page today deliberately has no disclosure panel — the comment records that on a page that is only this, a collapsed panel is a click charged for nothing and a repeated heading is a second thing to read. G3: explanation is available without occupying the fold, and here the fold is the whole page.

*Caught by.* Tools/cohesion.test.js already asserts the shared nav/footer/skip link across all seven pages; keep hours.html in that list.

### HOURS-11

The font-loading construction (preload + media="print" swap + preloaded woff2 + noscript fallback) is carried over unchanged, and no new render-blocking external request is added.

*Because.* G1 and the hard constraint: web fonts once cost 803 ms of a 3.5 s first paint, and the late swap was the whole of a 0.375 layout shift. The one permitted network call on this page is the LibCal grid.

*Caught by.* Assert exactly one fetch origin (api2.libcal.com) in the script, and that no stylesheet link lacks either media="print" or a local href.

## Must survive the port

Read off the working page. These are what a rewrite deletes without noticing.

- **'Could not reach LibCal: ' + the upstream detail (HTTP status or 'network error'), with the .err class on the status region.** — Pinned claim libcal-failure-names-libcal. Names which service failed, so a reader knows the hours are stale rather than wrong. A rewrite to a friendlier sentence deletes it.
- **'No hours are posted for <long date> yet.' rendered into #hrsOut AND into #hrsStatus, with .err removed.** — A self-explaining empty state that distinguishes unposted from closed from broken. It is not currently pinned in pins.test.js and would be deleted with a green suite.
- **summary.textContent = 'hours unavailable' on a first-load failure, set only if nothing has loaded yet.** — Stops the lede asserting a live count when no count exists. The `if(!loaded)` guard is the load-bearing part: a later failure must not overwrite a count that was genuinely fetched.
- **The two-word distinction between 'Open now'/'Closed now' (today, from currently_open) and 'Open'/'24 hours' (any other day).** — Documented incident: the Collaboration Hub rendered green and 'Open' at 6.45pm for a 9am–6pm day. This is a G2 property that looks like word-fiddling.
- **Status rendered as a dot AND a word, with the word always present.** — Colour alone must never carry meaning. The <i></i> is decoration; the word is the answer.
- **The `known()` filter dropping `not-set` days, and the consequence that a location with no hours all week never appears.** — Rendering 'unknown' rows pads the list with rows that answer nothing. The behaviour is intentional and reads like a bug to someone reviewing for completeness.
- **The `</br>` handling in row(): LibCal's hand-written `rendered` strings carry markup (the Law Reference Desk reads '9am - 5pm </br>(1pm-4pm in-person)'). Line breaks become ' · ' BEFORE escaping.** — Escaping alone printed the literal tag; not escaping is an injection hole. Both halves are needed and the order matters.
- **The suppression of the time string when it is identical to the status word.** — Prevents rows reading 'Closed Closed'.
- **localDate() built from local getFullYear/getMonth/getDate rather than toISOString().** — toISOString is UTC and puts Los Angeles on tomorrow's row after 4pm — the page would claim the wrong day's hours every evening.
- **parse/fmt/addDays/sundayOf doing date arithmetic in UTC on purpose, with the comment explaining why.** — These are calendar dates, not moments. Local-time addition across a DST boundary gives 23 or 25 hours and slips a day. Someone 'fixing the inconsistency' with localDate() will reintroduce the bug.
- **The week cache keyed on the Sunday LibCal itself returned, not the locally computed one.** — The cache can then never disagree with the payload about which week it is holding. Also the reason day switching is free (G1).
- **dateIn.min = today-365, dateIn.max = today+730.** — A picker that offers a date nobody has posted hours for promises an answer it cannot give. The probe dates behind the bound (2028-03 almost entirely unset) are recorded in the comment.
- **The date-input change handler rejecting a half-typed or emptied value and restoring `sel`.** — An emptied field is not a date; without the guard the page fetches garbage and blanks the day on screen mid-typing.
- **parent_lid nesting: departments render inside .hr-sub under their parent library.** — It is the only structure in the payload and the only thing that makes 30-odd rows readable.
- **The count line riding in BOTH the lede and the status region, and only beside today.** — The lede is a plain <p> with nothing to announce it, so a reader not looking at it is never told the count. And 'open now' is a claim about now, not about the Thursday somebody is browsing.
- **announceWeek() only firing when the prev/next buttons asked, not on every show().** — Otherwise a date-picker change announces a week the reader did not move to.
- **The 300 ms delay before 'Asking LibCal…' appears.** — A fast answer never shows a pending state at all, which is the G1-correct behaviour. Removing the delay makes every load flash.
- **The campus-map paragraph: the PDF link with its 'PDF · 2 MB · opens in a new tab' meta, and the fallback link to UCLA's own Locations & Hours page 'which carries the building and address for each in text'.** — The desk question this page does not answer. The size/format/new-tab disclosure and the text-alternative to a 2 MB PDF are both accessibility and honesty properties that a visual cleanup deletes as clutter.
- **Skip link reading 'Skip to the hours' (not a generic 'Skip to content'), and rel="noopener noreferrer" on both external links.** — Pinned claim skip-link-exists; the specific wording is the accessible name for this page.
- **role="status" aria-live="polite" on #hrsStatus and role="group" aria-label="Day of the week" on the day strip; aria-pressed on each day pill; aria-label on the week buttons.** — Pinned claim result-is-a-live-region. Nothing about the page looks different when these go.
- **The footer sentence 'The shelf map is surveyed by hand and the data comes from UCLA's public endpoints. Not affiliated with, or endorsed by, the UCLA Library.'** — Pinned claims map-surveyed-by-hand and not-affiliated-with-ucla. On every page deliberately (G5).
- **aria-current="page" on the Hours nav item.** — The only thing telling a screen-reader user which of the four surfaces they are on.
- **The 'no disclosure here' comment and the absence of a collapsed panel.** — A prior decision with a stated reason. A redesign harmonising /hours with the disclosure pattern on other pages will re-add a click charged for nothing.

## New claims, to be pinned before the page is written

- The door clause: '…the posted hours are on the door.' — a new factual assertion about the physical building, appearing only in the failure string. It needs pinning by the fragment 'on the door' in Tools/pins.test.js, and it needs someone to confirm posted hours are in fact on the door at every location this page lists, or the clause must be narrowed to the ones where they are.
- The success announcement prefix ('LibCal answered' / equivalent) as a claim that the data on screen is live rather than cached. Pin it, because it is exactly the sentence a rewrite trims as redundant next to a visible list of hours.
- A second-attempt line, if retry is ever built (HOURS-9). It needs its own pinned fragment naming that it is a second attempt, so the retry can never become silent later.

## Out of remit (G7): a person decides

- The palette: the open/closed/neutral status colours, the .err treatment, the dot glyph's colour, --theme-color #f3efe4 and meta color-scheme. G7 — these go to a person. The only thing ruled here (HOURS-5) is that colour may not carry meaning alone.
- Typefaces: Fraunces and Spline Sans Mono, their weights, and which elements get which. G7. Only the LOADING construction is ruled (HOURS-11), because that is a G1 performance property, not taste.
- Brand: the Shelfmark mark SVG, the tagline 'the book, then the aisle', the og-card image, the favicon set.
- Whether the day pills read 'Sun/Mon/Tue' or full names, and the visual form of the 'today' badge — presentation, not a claim.
- Layout of the header block: whether the lede sits above or below the campus-map paragraph. Both are above the fold and neither is the answer; the ordering is a taste call, subject only to the constraint that nothing sits between the top of the viewport and the outcome line.
- Whether the skeleton rows are three bars or some other shimmer. Their existence during a >300 ms wait is a G1 matter; their appearance is not.
- Whether /hours ever gains a per-location deep link or filter. Not ruled by the direction and not decided here.

## Silences in the direction, raised not filled

- The direction gives the two outcome strings as examples ('LibCal answered — open until 10 pm' / 'LibCal did not answer; the posted hours are on the door') but does not say whether they are verbatim required text or illustrative grammar. HOURS-2 treats them as grammar because taking them verbatim would delete a pinned fragment; if they are meant verbatim, someone must deliberately update the pin signature and record why.
- 'Announced once on change' is not defined for the week/day navigation, which changes the whole list without any upstream call. HOURS-8 makes a decision, but the direction does not cover the cached-re-render case at all.
- The direction says nothing about the success case's content beyond the example 'open until 10 pm'. It does not say whether the announcement names one location, the count, or the date — and this page today has 30-odd rows, no single 'until 10 pm'. Whether the resolved string carries the count line, the date, or a named location is unruled.
- Nothing in the direction addresses date navigation on /hours: the week strip, the date picker, the bounded range, or whether browsing a non-today date is in scope for this surface at all. The whole week-walking capability exists today and the direction is silent on it.
- The direction is silent on the campus-map PDF paragraph and on whether 'where is it' belongs on /hours or on a location surface that does not exist.
- G5 asks for one vocabulary for the same thing, but nothing states whether /hours's 'location' and the shelf surfaces' 'library' are the same word. Unresolved.
- The direction does not say whether a stale cached week may be shown after a later fetch fails, or whether the page must clear back to a refusal. Today it clears the rows and keeps the count; nothing rules on which is right.

