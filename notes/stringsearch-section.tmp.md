
## String search app and shared page view

- `stringsearch.html` (0.1.0): enter a Greek string without diacritics, optionally limit to Iliad or scholia, list matching passages (grouped by text, paged 60 at a time, with a snippet), pick one to see the whole page with the Iliad lines interleaved with their scholia. Matches are marked; scholia holding a match are unfolded, the rest folded.
- Folding (`src/stringsearch.js`): accents, breathings, capitals and punctuation are ignored; ς/ϲ = σ; minimum two letters; matches may span words inside one text part, but not from a scholion's lemma into its comment. Diplomatic or normalized text can be searched. Hash form: `#q=..&s=..&t=..[&p=..]`.
- Release 2024c: "αχιλλευς" matches 305 passages (189 Iliad, 111 scholia, the rest other texts).
- Refactor: the page display shared by propernames and stringsearch now lives in `src/page-view.js` and `src/page-view.css`; propernames was moved onto it (tests unchanged and passing).
- Tests: `test/stringsearch.test.js` (9, includes an independent count against the real release); full suite 109 pass.
