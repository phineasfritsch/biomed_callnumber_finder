# Operating Shelfmark

For whoever is running this next, which is usually an agent in a fresh clone with no memory of
how anything here came to be. Read this file first. It is written on the assumption that you know
nothing about this repository and have no access to the conversation that produced it.

## The premise everything else is downstream of

Agents report success on broken work. Routinely, confidently, and with a detailed account of what
they verified. Not occasionally, and not only the weak ones. This is the normal case, and it gets
worse at scale because nobody reads twelve reports as carefully as one.

So the machinery below exists for one purpose: to be able to disbelieve a report. When a gate and
a report disagree, the gate is right. If you find yourself editing a gate so that a report can be
believed, stop and read the section on adjudication.

## The six commands

    ops/test        every suite, one command, one number. The number is the point.
    ops/health      is the state sane. Different question from whether the code is right.
    ops/prod        one read only way to look at production. GET only.
    ops/shoot       render every page to ops/shots/ as a person sees it.
    ops/parity      does the deployment match this tree, and WHICH WAY does it differ.
    ops/deploy      the gate, then push, then deploy, then read the version back.
    ops/QUEUE.md    the work queue. Not a session, not your head. That file.

Two suites are worth knowing about by name, because they check things the others structurally
cannot.

`Tools/pins.test.js` holds the sentences this tool would be worse without: the refusals, the
statements of scope, the errors that name their upstream, the two accessibility properties that
are invisible on screen. Nothing else asserts them, so a rewrite deletes them while the suite
stays green. Read the header of that file before changing any of them; it explains why a pin is
a fragment rather than a sentence, why the search is app wide rather than per file, and why the
comment stripper is not a regular expression.

`Tools/ui.test.js` is the only suite that opens a browser, and therefore the only one that can
catch a control wired to nothing. Everything else here reads the shipped files as text. It has
three modes and the middle one matters whenever the tree and the deployment disagree: the default
drives this working tree, `--deployed` fetches the published bytes and drives those, and
`--origin` goes straight at a real deployment. Only the last can tell you production works, and it
does not run from inside the cloud container; see the queue.

`ops/test` and `ops/health` both take `--json`, which is what a routine should read. Neither ever
reports success for a check that did not run.

## Three outcomes, never two

Every check here returns one of three things, and the third is the one that gets lost:

    ok        the check looked and was satisfied.
    BAD       the check looked and was not. Someone has to act.
    BLOCKED   the check could not look, and therefore has no opinion.

A missing verification is treated exactly like a failed one. When one wave's verifier died
mid response, the work shipped unchecked and failed nineteen tests. `ops/test` follows the same
rule: a suite that exits 0 while printing no count is a failure, because a harness that crashed
after its last log line looks identical to one that had nothing to say.

`ops/health` exits 3 when nothing is BAD but something is BLOCKED. Exit 3 means "no opinion". If
you write anything that treats 3 as success, you have built a monitor that will report green for a
week about a site that is down.

## The gate, numbered, with the numbers as they stand

Run these in order. The expected numbers are recorded so that drift is visible rather than
discovered later.

1. `ops/test` passes. **2062 assertions across 14 suites, 1 skipped.** The skip is
   `ios/Tools/headcount.parity.test.mjs`, which needs a sibling repository that is normally not
   cloned; it says so itself. The per suite counts are in `ops/baseline.json`.
2. A count that FELL fails the run even when everything is green. Something stopped being asked.
   Either restore it or bless the drop deliberately with `ops/test --bless`.
3. `node Tools/ui.test.js` passes. **52 assertions across 18 journeys.** This is the only suite
   that opens a browser, and therefore the only one that can catch a button wired to nothing.
   It is included in `ops/test`, and it is worth running alone while iterating.
4. `ops/health --local` does not exit 1. Exit 3 is expected while production is unreachable.
5. `ops/parity` does not report the live site as ahead of this tree. It currently does, and that
   is a known item at the top of `ops/QUEUE.md`: two published files carry a Primo linking feature
   and a forced-colors focus fix that exist on no ref here. Until that is recovered, a deploy from
   this repository would delete a shipped feature and an accessibility fix and report success.
6. `ops/deploy` runs 1 through 5 itself and refuses to ship past any of them. It is the only
   thing that should ever deploy.

`ops/parity` is the check that pushing before deploying does not give you. That rule stops the
repository from lagging the site for three minutes. This one stops a deploy from overwriting a
site that got ahead and stayed there, which is the same failure with the sign flipped and a much
longer half-life.

## What parallelises here and what does not

The dividing line is shared mutable state, not task size.

| Work | Shares | Run |
| --- | --- | --- |
| Reading, reviewing, judging, ranking | nothing | fan out wide |
| One page or one file per agent, ownership declared | nothing | parallel |
| Anything running `ops/test` or `Tools/ui.test.js` | ports, `ops/shots/` | serial, always |
| Two agents editing one file | the file | never. Last write wins, silently |
| Anything committing | the index | one at a time, explicit paths |
| `ops/deploy` | production | one, after everything else |

This machine has four cores, so the practical concurrency cap is two agents. Fanning out twelve
readers here does not make them faster, it makes them queue.

Never let a worker grade its own work. Reviewers run separately, afterwards, with the workers'
reports as input, and with the authority to reject.

## Traps this project has already hit

Stated as prohibitions, because each one has already cost something.

**Never add a file to the repository root casually.** `assets.directory` in `wrangler.jsonc` is
the repository root, so the document root is the repository: every file is on the public web
unless `.assetsignore` names it. A local wrangler state file carrying an account id and an email
has shipped this way, and so has the deployment's own config at `/wrangler.jsonc`.
`Tools/assets.test.js` asserts the published set exactly, and it caught `ops/test` on the public
web within a minute of that file existing.

**Never assume `.gitignore` protects the site.** It does not. Cloudflare uploads the working tree,
not the index, so a path ignored by git is invisible in `git status` and still published.
`node_modules` was in exactly this position until the browser harness needed Playwright.

**Never `git add -A` here.** Something else is usually mid flight. Stage explicit paths. A tidy up
commit that swept five unrelated half finished files into history now carries a message describing
work it does not contain.

**Never deploy before pushing.** Deploying first opens a window in which the site runs code the
repository does not have, and anything reading the repository during that window honestly
describes older code as live. A scheduled checker once spent its headline on a phantom because of
a three minute gap. `ops/deploy` enforces the order.

**Never let a wrong answer look like a confident one.** This is the product rule, not just an
engineering one. A holding is never shown a shelf derived from a call number that did not fully
parse, because a wrong aisle is worse than no aisle: someone who trusts it walks to a shelf of
unrelated books and concludes the map is broken. The same reasoning retired a left and right
model that was wrong three times running, and a drawn route line that did not survive contact
with the building.

**Never pipe a full test log into a reasoning context.** One failure in this repository's history
put 745 KB into one. `ops/test` prints tails and writes the rest to a file.

**Never tune a threshold until the fixtures agree with you.** Point a check at real data before
trusting it. A candidate overlap check for `ops/health` passed every hand written case and then
fired on eleven perfectly healthy shelf ranges, because it modelled a flat sort and the collection
snakes. It was dropped rather than tuned. See `ops/QUEUE.md`.

## Adjudicating a failed gate

When a gate fails it is one of exactly two things, and from outside they are indistinguishable:

1. The work broke something. Fix the work.
2. The work deliberately changed something and the check is now stale. Fix the check, but only
   after confirming the property survives somewhere a reader will actually meet it.

Getting this wrong in the second direction is how a suite becomes decorative, one reasonable
accommodation at a time. It is also the only step where being wrong leaves no trace.

Rules for it:

- Read the rendered artefact, not the diff. `ops/shoot` exists for this. A change that reads as a
  regression in a diff is sometimes an improvement on the page.
- Never weaken an assertion into something that would pass on an empty artefact. When a check
  said "PubMed has left the page" it was reading the filter box's own placeholder; the replacement
  counts rows, which cannot pass on a blank list.
- When you change a check, leave a comment saying what the new form is and why the property is
  intact.
- A failing pin in `Tools/pins.test.js` is this decision in its sharpest form. If the sentence was
  deliberately reworded, move the signature to the smallest fragment of the NEW wording that
  carries the same meaning, and say so. If it was deleted, put it back. Never delete the pin: a
  pin removed to make a run green is the deletion, with the evidence tidied away after it.
- Count the changes and report the count. If it is large, the work is drifting, not the checks.

## When you cannot finish

Say so, precisely, and prefer the smaller honest result to the larger claimed one.

- Revert per page or per file, never per wave. One bad change should not cost three good ones.
- Quarantine a failed attempt before reverting it. The next attempt mines it.
- Ship the part that works and name the part that does not, in `ops/QUEUE.md`, with what would
  unblock it and who can do that.
- A smaller honest result beats a larger claimed one. Every time, without exception. If you ran
  out of budget, or a check could not run, or you are unsure whether something is real, write that
  down rather than rounding it up to done.

## The part that cannot be delegated

A panel can rank whether a layout serves a task. It cannot tell you that something is ugly, off
brand, or embarrassing. `ops/shoot` writes full page renders to `ops/shots/` at desktop and phone
widths precisely so that a person can look at them, and that look takes thirty seconds. Nothing in
this repository closes that item for you.
