# The work that exists only on the web

`ops/parity --lost` regenerates everything in this directory. It is kept in the repository because
a report that the live site is ahead is not the same as being able to recover what is on it, and
the recovery is the point of the alarm.

**What is here.** Thirty-one lines in `index.html` and twenty-five in `site.css` that are served at
`shelfmark.phineasfritsch.com` and exist on no ref in this repository. They were deployed from
somebody's machine and never pushed. `ops/deploy` refuses to run while this is true, and it is
right to: a deploy from this tree would overwrite both and report success.

**They are two separate pieces of work, and they should be judged separately.**

1. **Primo record linking** (`index.html` plus most of the CSS). A catalog result's title becomes a
   link to the UCLA record it came from, with an "In the catalog" chip repeating the link in the
   tag row. `primoHref()` builds the URL from the Alma MMS id already parsed out of the 001, and
   returns empty for an 001 that is not an MMS number, so an unlinkable record still renders its
   title as plain text. The comment says `Tools/catalog.test.js` asserts the page and
   `src/worker.js` still agree on a bib id.

2. **Keyboard focus under Windows High Contrast** (`site.css`, the last block). This one is not a
   feature, it is a defect fix, and the defect is still in this tree:

   ```css
   @media (forced-colors: active){
     :focus-visible, :focus{outline:3px solid currentColor !important; outline-offset:2px}
   }
   ```

   Focus is drawn throughout the site as `outline:none` plus a soft box-shadow ring, in twenty-six
   places. Under forced colours the browser discards the box-shadow and honours the `outline:none`,
   so a keyboard user gets **no focus indicator at all** on every link, button, select and input on
   the site. The string `forced-colors` appears nowhere else in this repository.

**Why this matters more than its size.** The ship board has passed a screen-reader and keyboard
reader twice. That reader drives a normal browser, so the forced-colours failure is outside what
any round has tested, and shipping this tree as it stands would deploy a site that is *less*
accessible than the one already running.

**What nobody here can decide.** Whether piece 1 is finished. It is coherent and commented in the
house style, but only whoever wrote it knows whether it was deployed as done or as a trial.
