# What the parser does with things that are not call numbers

Run while ship round 5 was in flight, against the frozen commit, read-only. It exists because the
same defect has now been found twice in this product and both times by accident: a string that is
not a call number, answered with a confident shelf face. The board found it once (a phrase,
`B12 deficiency`); attacking the code directly found it once (bare acronyms, `TP53`, `HER2`). Four
ship rounds and roughly forty reader-drives missed the second one entirely.

Two things were not going to find a third instance: another ship round briefed the same way, and my
own intuition about what a reader types. So this is a corpus instead.

## Direction one: can anything that is not a call number get a shelf?

**139 strings, and the only ones that reach a shelf are the four that should.**

The corpus: 39 gene and protein names (TP53, HER2, BRCA1, CFTR, ACE2), 18 virus and coding-system
names (H1N1, SARS2, ICD10, DSM5), 24 dosages and analytes (5mg, 1000mcg, B12, HbA1c, PM2.5, CO2),
20 code-plus-word phrases (`HER2 positive`, `T4 levels`, `G6PD deficiency`), 11 word-plus-code
phrases (`vitamin D3`, `type 2 diabetes`, `phase 3 trial`), 11 hyphenated forms (`BCR-ABL1`,
`PD-L1`, `HLA-B27`, `5-HT2A`), 11 real call numbers with junk attached (`1. WB 115 H322`,
`WB 115 H322 (reserve)`, a barcode), and 7 book titles that open with a code (`P53 the gene that
cracked the cancer code`, `T2 mapping of cartilage`).

The four that reach a shelf are `WB 115 H322 v.2`, `WB 115 H322 2018`, `QL 737 C22 M616g 2010` and
`W1 AM4990 v.3` — real call numbers carrying a volume or a year, which is correct.

## Direction two: did the guard overshoot?

Every range endpoint in the survey, typed seven ways that must not change the sort: as recorded,
lowercased, uppercased, padded, double-spaced, with the class run into its number, and with every
space removed. **37 fail, all in the fully spaceless form, all deliberate, and none of them lands
on a wrong shelf** — they refuse:

- **`W49H847`, `W74D795s`, `W84AA1` and the rest of the single-letter class W.** A one-letter stem
  run together with digits cannot be told from an acronym, which is exactly how `H1N1` reached
  level 11. Typed with its spaces, `W 49 H847` is untouched.
- **`WD308A28876`.** Its cutter carries five digits and the reading rule allows four. This one is a
  real limit rather than a principle, and it is queued rather than fixed, because changing it while
  a round is in flight is what made round 4 void.

## The honest caveat

A corpus proves the absence of what is in it and nothing more. Both instances of this defect were
found outside whatever anybody was looking at, so the useful conclusion is not "there is no third
instance" — it is that the two known ones are dead and this particular net is now empty.
