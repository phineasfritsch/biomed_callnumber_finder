// The six pages have to feel like one product.
//
//   node Tools/cohesion.test.js
//
// A tool that grew a page at a time drifts a page at a time, and the drift is never visible from
// inside the page you are editing. It shows up when somebody uses the whole thing in one sitting:
// a nav that reorders itself, a disclaimer that appears on four pages out of seven, one screen
// that says "could not reach LibCal" and another that says "Error 502". Each of those is defensible
// alone. Together they read as several tools wearing the same header, and a reader who notices
// that stops trusting all of them at once.
//
// So this file asserts the things that make it one product rather than seven pages. What is pinned
// here was measured across the shipped files first, and everything asserted was already true when
// it was written, with one exception noted below. A guard that is red on the day it lands teaches
// people to edit guards.
//
// The exception: about, methodology and 404 had no skip link and no #main to skip to, while the
// other four pages had both. That was fixed in the same commit as this file rather than recorded
// as a budget, because "four of our seven pages are keyboard navigable" is not a state to pin.
//
// What this deliberately does NOT check: whether the design is any good. Cohesion is consistency,
// and a page can be consistently bad. Look at ops/shots/.

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGES = ['index.html', 'about.html', 'methodology.html', 'hours.html', 'map.html', 'databases.html', '404.html'];
/* 404 is deliberately outside some of these. It must not be canonicalised and must not carry a
   share card: a shared link to a missing page is not a thing anyone wants to render a preview of.
   Stated here so the exemption is a decision on the record rather than a page nobody checked. */
const IN_NAV = ['index.html', 'map.html', 'hours.html', 'databases.html'];
const INDEXABLE = PAGES.filter(p => p !== '404.html');

let pass = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
}
const section = t => console.log(`\n${t}`);

const raw = Object.fromEntries(PAGES.map(p => [p, fs.readFileSync(path.join(ROOT, p), 'utf8')]));
/* Comments are stripped everywhere below, for the same reason the rest of this repo strips them:
   a thing that has been deleted is often quoted in the comment explaining its deletion, and a
   check that reads comments is satisfied by the explanation of its own failure. */
const src = Object.fromEntries(PAGES.map(p => [p, raw[p].replace(/<!--[\s\S]*?-->/g, '')]));
const visible = p => src[p].replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');

/* ---- one way in, on every page ---- */

section('the same way around, everywhere');

const navOf = p => {
  const m = /<nav[^>]*class="site-nav"[^>]*>([\s\S]*?)<\/nav>/.exec(src[p]);
  if (!m) return null;
  return [...m[1].matchAll(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map(a => `${a[2].replace(/<[^>]+>/g, '').trim()} -> ${a[1]}`);
};
const reference = navOf('index.html');
ok('there is a site nav at all', reference && reference.length === 4, JSON.stringify(reference));
for (const p of PAGES) {
  const nav = navOf(p);
  ok(`${p} carries the same nav, in the same order, with the same words`,
    JSON.stringify(nav) === JSON.stringify(reference),
    `${JSON.stringify(nav)}\n      expected ${JSON.stringify(reference)}`);
}

/* Exactly one pill says "you are here", and only on a page the nav actually points at. Two would
   be a lie about where the reader is; on /about, which is not in the nav, none is correct. */
for (const p of PAGES) {
  const n = (src[p].match(/aria-current="page"/g) || []).length;
  const want = IN_NAV.includes(p) ? 1 : 0;
  ok(`${p} marks the current section ${want === 1 ? 'once' : 'not at all'}`, n === want, `found ${n}`);
}

for (const p of PAGES) {
  const skip = /<a class="skip" href="#([a-zA-Z0-9_-]+)">([^<]+)<\/a>/.exec(src[p]);
  if (!ok(`${p} opens with a skip link`, !!skip, 'no <a class="skip">')) continue;
  ok(`${p}'s skip link points at something that exists`, src[p].includes(`id="${skip[1]}"`),
    `href="#${skip[1]}" but no id="${skip[1]}" on the page`);
  /* "Skip to content" on every page is a link that tells a screen reader nothing about where it
     is about to land. Each page names its own destination. */
  ok(`${p}'s skip link names where it goes`, !/^skip to (the )?(content|main)$/i.test(skip[2].trim()),
    JSON.stringify(skip[2]));
}
const skipTexts = PAGES.map(p => (/<a class="skip"[^>]*>([^<]+)</.exec(src[p]) || [, ''])[1].trim());
ok('every page names a different destination', new Set(skipTexts).size === PAGES.length,
  JSON.stringify(skipTexts));

/* ---- one voice ---- */

section('one voice, one set of promises');

for (const p of PAGES) {
  /* The disclaimer is the load-bearing sentence on the whole site: this is one person's hand
     survey, not the library speaking. A reader who meets it on six pages and not the seventh has
     been told something different by the seventh. */
  ok(`${p} says it is not the library`, visible(p).includes('Not affiliated with, or endorsed by, the UCLA Library'),
    'the affiliation disclaimer is missing');
  ok(`${p} says who built it`, /Built by\s*<a[^>]*>\s*Phineas Fritsch/.test(visible(p)) || /Built by Phineas Fritsch/.test(visible(p)));
}

/* ---- one design system ---- */

section('one design system, defined in one place');

for (const p of PAGES) {
  const sheets = [...src[p].matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map(m => m[0]);
  const local = sheets.filter(s => !/fonts\.googleapis\.com/.test(s));
  ok(`${p} links exactly one local stylesheet`, local.length === 1 && local[0].includes('/site.css'),
    JSON.stringify(local));
  /* A <style> block on a page is where a design system goes to die: the next page needing the
     same thing copies it, and then there are two. Every rule belongs in site.css. */
  ok(`${p} defines no styles of its own`, !/<style[\s>]/.test(src[p]),
    `${(src[p].match(/<style[\s>]/g) || []).length} <style> block(s)`);
  const inlineColour = [...src[p].matchAll(/style="[^"]*(#[0-9a-fA-F]{3,8})/g)].map(m => m[1]);
  ok(`${p} hard-codes no colours inline`, inlineColour.length === 0, inlineColour.slice(0, 5).join(', '));
}

/* The palette is a fixed vocabulary. Its size is asserted so that adding a twenty-second token
   is a decision somebody makes on purpose, rather than the way a page gets a colour it needed
   once. The count is 21, measured; the first draft of this line said 11, because it was written
   from a regex anchored to the start of a line and site.css puts three tokens on some lines. The
   number was wrong and site.css was right, which is the usual direction. */
const css = fs.readFileSync(path.join(ROOT, 'site.css'), 'utf8');
const tokens = [...new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]))].sort();
ok('the palette is the twenty-one named tokens', tokens.length === 21,
  `${tokens.length}: ${tokens.join(' ')}`);
/* Every rule should draw from that vocabulary rather than reaching past it. Thirteen raw hex
   colours currently sit outside the token definitions, and this is a BUDGET in the same sense as
   the ones in Tools/style.test.js: a number at its budget is queued, not clean. It only ratchets
   down.
   Seven of the thirteen are one colour, #bcce9e, used as the border that pairs with --green-soft
   every time it appears; two more are #e0bfa2 pairing with --orange-soft. Those are two tokens
   that should exist and do not, which is exactly the drift this file is for: the eighth caller
   copies the hex from the seventh, and then changing the green means finding all eight.
   See ops/QUEUE.md. */
const LOOSE_COLOUR_BUDGET = 13;
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '');
const loose = [...cssCode.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].length
  - [...cssCode.matchAll(/--[a-z0-9-]+\s*:\s*#[0-9a-fA-F]{3,8}/g)].length;
ok(`colours outside the token vocabulary are at or under the budget of ${LOOSE_COLOUR_BUDGET}`,
  loose <= LOOSE_COLOUR_BUDGET, `now ${loose}`);
if (loose < LOOSE_COLOUR_BUDGET) console.log(`  (${loose} loose colours left, down from ${LOOSE_COLOUR_BUDGET} — lower the budget in this file)`);

/* ---- one page in the head, too ---- */

section('the same page in a tab, a search result and a shared link');

for (const p of PAGES) {
  ok(`${p} declares its language`, /<html[^>]*lang="en"/.test(src[p]));
  ok(`${p} sets a viewport`, /name="viewport"/.test(src[p]));
  ok(`${p} has a title`, /<title>[^<]{3,}<\/title>/.test(src[p]));
  ok(`${p} has a description`, /name="description"\s+content="[^"]{20,}"/.test(src[p]));
  const title = (/<title>([^<]*)<\/title>/.exec(src[p]) || [, ''])[1];
  /* Every tab in the row should say which product it belongs to. */
  ok(`${p}'s title names the product`, /Shelfmark/.test(title), JSON.stringify(title));
}
for (const p of INDEXABLE) {
  ok(`${p} is canonical about itself`, /rel="canonical"\s+href="https:\/\/shelfmark\.phineasfritsch\.com/.test(src[p]));
  ok(`${p} carries a share card`, (src[p].match(/property="og:/g) || []).length >= 6,
    `${(src[p].match(/property="og:/g) || []).length} og: tags`);
}
ok('404 is not canonicalised', !/rel="canonical"/.test(src['404.html']),
  'a missing page must not claim to be the canonical version of anything');
ok('404 carries no share card', !/property="og:/.test(src['404.html']),
  'nobody wants a rich preview of a page that is not there');

console.log(`\n${pass} passed, ${failures.length} failed`);
failures.forEach(f => console.log('  FAIL ' + f));
process.exit(failures.length ? 1 : 0);
