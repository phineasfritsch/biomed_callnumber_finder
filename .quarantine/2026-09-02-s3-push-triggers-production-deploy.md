# s3 REFUSED: `git push origin main` is a production deploy

- Date: 2026-09-02
- Routine: fixer, worker 1043a463
- Item: s3 ("Push main, so that every later pull request is readable")
- Outcome: **REFUSED. The push was not performed.** Refused, nothing was done.
- Branched from: `14e848e` (local `main` HEAD)

## One-line summary

This repository has a **Cloudflare Workers Builds** GitHub integration attached to it. Pushes to
`main` trigger a **production build that deploys to the live Worker**. A fixer is categorically
forbidden to deploy, so the item cannot be executed as written and was refused rather than
performed hopefully.

## Why this was not obvious

Every file-based signal says there is no deploy automation, and a reasonable audit concludes
"safe to push". All of the following are true, and all of them are misleading:

- There is no `.github/` directory and no tracked CI yaml anywhere in the tree.
- `gh workflow list` is empty. The GitHub Deployments API returns `[]`.
- There is no `package.json`, no Makefile, no Procfile.
- All fifteen files in `.git/hooks` are the untouched `.sample` files; `core.hooksPath` is unset.
- `wrangler.jsonc` has no `build` block and no deploy-on-push directive.
- `README.md` documents deploying as a manual `npx wrangler deploy`.
- QUEUE.md item s7 is premised on deploys being four things the operator "does by hand".

Workers Builds is configured in the **Cloudflare dashboard**, not in the repository, so it is
invisible to any audit that only reads files. It is visible from the GitHub side, as check runs.

A four-agent review panel was run against this question this morning. It read the files, reasoned
carefully, and returned "safe-to-push" on all four audits. It was wrong. The check-run evidence
below is what settled it.

## The evidence, reproducible and read-only

Cloudflare's GitHub App ("Cloudflare Workers and Pages") posts a check run named
`Workers Builds: biomed-callnumber-finder` on pushed commits. The **shape of that check run
differs between the production branch and every other branch**, and that is what identifies
`main` as the production branch:

    gh api repos/phineasfritsch/biomed_callnumber_finder/commits/<sha>/check-runs

| commit | branch | build | `Preview URL` in summary |
|---|---|---|---|
| `a11c89f` | `fix/s2-all-test-runner` | yes | **yes**, plus `Preview Alias URL` and `Version ID` |
| `98d4c3a` | `fix/s1-assetsignore-verify-docs` | yes | **yes**, plus `Preview Alias URL` and `Version ID` |
| `be399f5` | `main` (current `origin/main`) | yes | **no** |
| `091164f` | `main` history | yes | **no** |
| `3ce0ce6` | `main` history | yes | **no** |

Non-production branches produce a `Version ID` plus a preview URL. That is the
`wrangler versions upload` signature: an uploaded version that is not serving traffic. Commits on
`main` produce a build with **no preview URL at all**. That is the `wrangler deploy` signature, a
live deployment. Three separate `main` commits show that shape.

The build on the current `origin/main` (`be399f5`) completed `2026-08-12T01:42:03Z`, which is the
last time anyone pushed `main`.

## Which Worker it would deploy

The Cloudflare service the integration is attached to is still named `biomed-callnumber-finder`,
but the Worker was renamed in commit `0274a6e` ("Rename the worker to shelfmark"), and
`wrangler.jsonc` at `14e848e` declares:

    "name": "shelfmark",

A build runs the deploy command against the repository's own `wrangler.jsonc`, so the target is
`shelfmark`, the Worker serving <https://shelfmark.phineasfritsch.com>. Whichever way that
mismatch resolves, the push causes a deploy command to run against a live account. That alone is
enough to refuse.

## Why "production already serves these bytes" does not make the push inert

The item's premise is that production already serves the five commits, so publishing them changes
nothing. The premise is true about `index.html`, and was verified this run:

    local index.html (14e848e)        197907 bytes
    sha256                            d23914752b52d20f41260e8169dffe8f240825ddbd88538e70087fe86b7af2ee
    origin/main index.html (be399f5)  195624 bytes
    GET https://shelfmark.phineasfritsch.com/   HTTP 200, 197907 bytes, byte-identical to local

Production is byte-identical to `14e848e` and is **not** what `origin/main` holds. But the premise
is about *content*, and the prohibition is about *causing a deployment*. Two things would still
change:

1. The live **published file set** would change. The current live site was hand-deployed from this
   working tree, which contains untracked files: `Tools/assets.test.js` fails today on
   `verify/pins.ps1, verify/read-prod.ps1, verify/sane.ps1, verify/test.ps1` being published. A
   Cloudflare build runs from a **fresh clone**, which has no untracked `verify/` at all, so the
   deployed asset set would differ from what is live now. Arguably an improvement. Not a change an
   unattended agent gets to make on its own.
2. A new Worker version and deployment would be created on a live patron-facing service, and a
   fixer cannot roll one back.

A build could also simply fail, and a failed production build is a worse state than the one it
started from.

## What was verified before refusing

Every push precondition the item asks for was checked, and every one of them passed. The refusal
is not because a precondition failed:

    git merge-base --is-ancestor origin/main HEAD   exit 0   (pure fast-forward)
    origin/main = be399f590d168ec4c0b46ac4e50170e9514c7e20
    HEAD        = 14e848e90ee5e4d91d9e2d138c11c1123439baa9
    5 commits:    7651889, 9ae2226, e0d1f28, 622f690, 14e848e
    git status --porcelain   only untracked scaffold; no tracked file modified; nothing staged
    git push --dry-run origin main    be399f5..14e848e  main -> main   (one ref, no +, no tags)
    push.default, push.followTags, remote.origin.push   all unset; zero local tags

Also established: all five commits are **already on the public remote**, reachable from
`origin/fix/s1-assetsignore-verify-docs` and `origin/fix/s2-all-test-runner`. The push would
transfer no new git objects and publish no new bytes to GitHub. It moves one ref, and that ref
movement is what fires the deploy.

## Gates

Run on `main` at `14e848e`, before anything was changed:

    TESTS could-not-run                                  exit 2
    SANE checks=0 ok=0 failed=0 skipped=0 broken=0       exit 0
    PINS pinned=0 found=0 missing=0 stale=0 files=145    exit 0

`verify/test.ps1` exits 2 because `$Runner = 'node Tools/all.test.js'` and that file exists only on
the unmerged branch `fix/s2-all-test-runner`. This is the condition QUEUE.md already records under
Findings. It is not new breakage. Because the aggregate gate reported no count, the 14 suites were
run directly and serially, which is the brief's prescribed fallback:

    TESTS total=2064 passed=2062 failed=2 skipped=0

The only two failures are `Tools/assets.test.js` on the unignored `verify/` directory, which is
exactly what unmerged PR #1 fixes. No new breakage. No assertion was added, weakened or removed
anywhere this run; checks modified = 0.

## What the next run should do

Do **not** take s3 and push `main` until a human has answered one question in the Cloudflare
dashboard: is Workers Builds configured with `main` as the production branch, and does a build on
`main` run `wrangler deploy`?

The evidence above says yes. If it is yes, s3 cannot be performed by any routine whose ceiling
forbids deploying, and the item should be rewritten as an operator task rather than a fixer task.
The operator either pushes `main` themselves, accepting that this deploys, or disconnects Workers
Builds first and then lets a fixer push.

Note also that pushing **any** branch to this repository causes a non-production build, which is a
`wrangler versions upload` plus a preview URL. PR #1 and PR #2 both did this, and so did the branch
carrying this note. It does not touch the production route, but it is worth knowing before anyone
assumes that pushing a branch here is inert.
